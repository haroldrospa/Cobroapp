import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  store_id?: string;
  recipient_email?: string;
  report_type?: 'daily' | 'weekly';
  scheduled?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ReportRequest = await req.json().catch(() => ({}));

    if (body.scheduled) {
      console.log("Running scheduled email reports...");

      const { data: storesWithReports, error: storesError } = await supabase
        .from('store_settings')
        .select('store_id, email_reports_recipient, email_reports_frequency, email_reports_last_sent')
        .eq('email_reports_enabled', true)
        .not('email_reports_recipient', 'is', null);

      if (storesError) throw storesError;

      console.log(`Found ${storesWithReports?.length || 0} stores with email reports enabled`);

      const now = new Date();
      const results = [];

      for (const store of storesWithReports || []) {
        const lastSent = store.email_reports_last_sent ? new Date(store.email_reports_last_sent) : null;
        const frequency = store.email_reports_frequency || 'daily';

        let shouldSend = true;
        if (lastSent) {
          const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (frequency === 'daily' && hoursSinceLastSent < 20) shouldSend = false;
          else if (frequency === 'weekly' && hoursSinceLastSent < 140) shouldSend = false;
        }

        if (shouldSend && store.store_id && store.email_reports_recipient) {
          try {
            const result = await sendReportForStore(supabase, store.store_id, store.email_reports_recipient, frequency as 'daily' | 'weekly');
            results.push({ store_id: store.store_id, success: true, ...result });
          } catch (err: any) {
            console.error(`Error sending report for store ${store.store_id}:`, err);
            results.push({ store_id: store.store_id, success: false, error: err.message });
          }
        }
      }

      return new Response(JSON.stringify({ scheduled: true, results }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { store_id, recipient_email, report_type } = body;

    if (!store_id || !recipient_email) {
      throw new Error("store_id and recipient_email are required");
    }

    const result = await sendReportForStore(supabase, store_id, recipient_email, report_type || 'daily');

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-daily-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function sendReportForStore(
  supabase: any,
  store_id: string,
  recipient_email: string,
  report_type: 'daily' | 'weekly'
) {
  console.log(`Generating ${report_type} report for store ${store_id}`);

  const now = new Date();
  const currentStart = new Date();
  const previousStart = new Date();
  const previousEnd = new Date();

  if (report_type === 'weekly') {
    currentStart.setDate(now.getDate() - 7);
    previousEnd.setDate(now.getDate() - 7);
    previousStart.setDate(now.getDate() - 14);
  } else {
    currentStart.setDate(now.getDate() - 1);
    previousEnd.setDate(now.getDate() - 1);
    previousStart.setDate(now.getDate() - 2);
  }

  // Fetch company settings
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name')
    .eq('store_id', store_id)
    .single();

  const companyName = companySettings?.company_name || 'Tu Tienda';

  // Fetch current period sales
  const { data: currentSales } = await supabase
    .from('sales')
    .select('*, sale_items(product_id, quantity, total)')
    .eq('store_id', store_id)
    .gte('created_at', currentStart.toISOString())
    .lte('created_at', now.toISOString());

  // Fetch previous period sales for comparison
  const { data: previousSales } = await supabase
    .from('sales')
    .select('*')
    .eq('store_id', store_id)
    .gte('created_at', previousStart.toISOString())
    .lt('created_at', previousEnd.toISOString());

  // Calculate current period metrics
  const totalSales = currentSales?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const totalOrders = currentSales?.length || 0;
  const cashSales = currentSales?.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const cardSales = currentSales?.filter((s: any) => s.payment_method === 'card').reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const transferSales = currentSales?.filter((s: any) => s.payment_method === 'transfer').reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const creditSales = currentSales?.filter((s: any) => s.payment_method === 'credit').reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;

  // Calculate previous period metrics
  const prevTotalSales = previousSales?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
  const prevTotalOrders = previousSales?.length || 0;

  // Calculate percentage changes
  const salesChange = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : (totalSales > 0 ? 100 : 0);
  const ordersChange = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 : (totalOrders > 0 ? 100 : 0);

  // Get top selling products
  const productSalesMap = new Map<string, { quantity: number; total: number; product_id: string }>();
  currentSales?.forEach((sale: any) => {
    sale.sale_items?.forEach((item: any) => {
      if (item.product_id) {
        const existing = productSalesMap.get(item.product_id) || { quantity: 0, total: 0, product_id: item.product_id };
        existing.quantity += item.quantity;
        existing.total += item.total;
        productSalesMap.set(item.product_id, existing);
      }
    });
  });

  const topProductIds = Array.from(productSalesMap.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([id, data]) => ({ id, ...data }));

  // Fetch product names for Top Products
  let topProducts: any[] = [];
  if (topProductIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', topProductIds.map(p => p.id));

    topProducts = topProductIds.map(tp => {
      const product = products?.find((p: any) => p.id === tp.id);
      return {
        ...tp,
        name: product?.name || 'Producto desconocido'
      };
    });
  }

  // Fetch low stock products (Logic Update: Check against min_stock)
  // Fetch all active products to process logic in JS since comparing columns in filter is tricky in simple client
  const { data: allActiveProducts } = await supabase
    .from('products')
    .select('name, stock, min_stock, sku')
    .eq('store_id', store_id)
    .eq('status', 'active');

  const lowStockProducts = allActiveProducts
    ?.filter((p: any) => p.stock <= (p.min_stock !== null ? p.min_stock : 5))
    .sort((a: any, b: any) => a.stock - b.stock)
    .slice(0, 10);

  // Calculate daily breakdown for trend chart (last 7 days)
  const dailyBreakdown: { date: string; dayLabel: string; fullDate: string; total: number; orders: number }[] = [];
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayStart = new Date(d);

    // Create end of day
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const daySales = currentSales?.filter((s: any) => {
      const saleDate = new Date(s.created_at);
      return saleDate >= dayStart && saleDate <= dayEnd;
    }) || [];

    dailyBreakdown.push({
      date: d.getDate().toString(), // Just the number
      dayLabel: daysOfWeek[d.getDay()], // Mon, Tue...
      fullDate: d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }),
      total: daySales.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
      orders: daySales.length
    });
  }

  // Find max for chart scaling
  const maxDailyTotal = Math.max(...dailyBreakdown.map(d => d.total), 1);

  // Helper functions
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
    return `$${amount.toFixed(0)}`;
  };
  const formatDate = (date: Date) => date.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatChange = (change: number) => {
    const arrow = change >= 0 ? '↑' : '↓';
    const color = change >= 0 ? '#10b981' : '#ef4444';
    return `<span style="color: ${color}; font-weight: 600;">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
  };

  const reportPeriod = report_type === 'weekly' ? 'Semanal' : 'Diario';
  const periodText = report_type === 'weekly'
    ? `${formatDate(currentStart)} - ${formatDate(now)}`
    : formatDate(currentStart);
  const comparisonText = report_type === 'weekly' ? 'semana anterior' : 'día anterior';

  // Generate trend chart bars (Table-based for stability)
  const chartHeight = 100; // px

  // Row 1: Bars and Amounts
  const barsRow = dailyBreakdown.map((day, index) => {
    // Percentage relative to chart height
    const heightPercentage = Math.max(Math.round((day.total / maxDailyTotal) * 100), 2);
    const safeHeight = day.total > 0 ? heightPercentage : 0;

    const isToday = index === 6;
    const barColor = isToday ? '#2563eb' : '#94a3b8'; // Blue for today, Slate for others
    const amountText = day.total > 0
      ? new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(day.total)
      : '';

    return `
      <td width="14%" valign="bottom" align="center" style="padding: 0 4px; height: ${chartHeight}px; vertical-align: bottom;">
         <table width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
               <td align="center" style="padding-bottom: 4px;">
                  <div style="font-size: 8px; font-weight: 600; color: #64748b; white-space: nowrap;">${amountText}</div>
               </td>
            </tr>
            <tr>
               <td valign="bottom" align="center" height="${chartHeight}">
                  <div style="width: 14px; height: ${safeHeight}%; background-color: ${barColor}; border-radius: 4px 4px 0 0; min-height: 1px;"></div>
               </td>
            </tr>
         </table>
      </td>
    `;
  }).join('');

  // Row 3: Labels 
  const labelsRow = dailyBreakdown.map((day) => {
    return `
      <td width="14%" align="center" style="padding-top: 8px;">
        <div style="font-size: 10px; font-weight: 600; color: #475569; text-transform: uppercase;">${day.dayLabel}</div>
        <div style="font-size: 9px; color: #94a3b8;">${day.date}</div>
      </td>
    `;
  }).join('');

  const trendChartHTML = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed; border-collapse: collapse;">
      <!-- Bars Row -->
      <tr>
        ${barsRow}
      </tr>
      <!-- Baseline Row -->
      <tr>
        <td colspan="7" height="1" style="background-color: #e2e8f0; line-height: 1px; font-size: 0;">&nbsp;</td>
      </tr>
      <!-- Labels Row -->
      <tr>
        ${labelsRow}
      </tr>
    </table>
  `;

  // Generate top products bars (Table-based for clarity)
  const maxProductQty = Math.max(...topProducts.map(p => p.quantity), 1);
  const topProductsHTML = topProducts.map((product, index) => {
    const width = Math.round((product.quantity / maxProductQty) * 100);
    const medalColor = index === 0 ? '#fbbf24' : (index === 1 ? '#94a3b8' : (index === 2 ? '#b45309' : '#e2e8f0'));
    const textColor = index <= 2 ? 'white' : '#64748b';
    const isLast = index === topProducts.length - 1;
    const borderStyle = isLast ? '' : 'border-bottom: 1px dashed #e2e8f0;';

    return `
      <tr>
        <td width="40" valign="middle" style="padding: 12px 0; ${borderStyle}">
           <div style="width: 24px; height: 24px; background-color: ${medalColor}; color: ${textColor}; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 11px;">
             ${index + 1}
           </div>
        </td>
        <td valign="middle" style="padding: 12px 10px 12px 0; ${borderStyle}">
           <div style="font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 200px;">
             ${product.name}
           </div>
           <div style="width: 100%; height: 6px; background-color: #f1f5f9; border-radius: 3px; overflow: hidden;">
              <div style="width: ${width}%; height: 100%; background-color: #3b82f6; border-radius: 3px;"></div>
           </div>
        </td>
        <td align="right" valign="middle" style="padding: 12px 0; ${borderStyle} white-space: nowrap;">
           <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${product.quantity}</div>
           <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${formatCurrency(product.total)}</div>
        </td>
      </tr>
    `;
  }).join('');

  const topProductsTable = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 5px;">
      ${topProductsHTML}
    </table>
  `;

  const emailHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe ${reportPeriod} - ${companyName}</title>
  </head>
  <body style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background-color: #f1f5f9; color: #334155;">
    <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 40px 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Informe ${reportPeriod}</h1>
        <p style="margin: 10px 0 0; color: #94a3b8; font-size: 16px;">${companyName}</p>
        <div style="display: inline-block; background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 20px; font-size: 12px; margin-top: 15px; font-weight: 500;">
          ${periodText}
        </div>
      </div>
      
      <div style="padding: 30px;">
        <!-- Main Sales Card -->
        <div style="margin-bottom: 30px;">
           <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 35px 25px; border-radius: 16px; color: white; text-align: center; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">
              <div style="font-size: 15px; font-weight: 500; opacity: 0.9; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Ventas Totales</div>
              <div style="font-size: 46px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 15px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">${formatCurrency(totalSales)}</div>
              
              <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 600;">
                ${salesChange >= 0 ? '↗' : '↘'} ${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}% vs ${comparisonText}
              </div>
           </div>
        </div>

        <!-- Sales Trend Chart -->
        <div style="margin-bottom: 35px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
          <h3 style="margin: 0 0 20px; font-size: 16px; color: #0f172a; font-weight: 600;">Tendencia de Ventas (7 días)</h3>
          ${trendChartHTML}
        </div>

        <!-- Top Products -->
        <div style="margin-bottom: 35px;">
          <h3 style="margin: 0 0 15px; font-size: 16px; color: #0f172a; font-weight: 600;">🏆 Productos Más Vendidos</h3>
          ${topProducts.length > 0 ? `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 20px;">
              ${topProductsTable}
            </div>
          ` : `
            <div style="text-align: center; padding: 30px; color: #94a3b8; background: #f8fafc; border-radius: 12px;">
              Sin datos de ventas
            </div>
          `}
        </div>

        <!-- Low Stock Products -->
        <div style="margin-bottom: 35px;">
          <h3 style="margin: 0 0 15px; font-size: 16px; color: #0f172a; font-weight: 600;">⚠️ Alerta de Inventario Bajo</h3>
          ${lowStockProducts && lowStockProducts.length > 0 ? `
            <div style="overflow: hidden; border: 1px solid #e2e8f0; border-radius: 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f8fafc;">
                  <tr>
                    <th style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Producto</th>
                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Actual</th>
                    <th style="padding: 12px 15px; text-align: right; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  ${lowStockProducts.map((p: any) => `
                    <tr style="border-top: 1px solid #e2e8f0;">
                      <td style="padding: 12px 15px; color: #334155; font-size: 13px;">
                        <div style="font-weight: 500;">${p.name}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${p.sku || 'Sin SKU'}</div>
                      </td>
                      <td style="padding: 12px 15px; text-align: right; color: #ef4444; font-weight: 700; font-size: 13px;">${p.stock}</td>
                      <td style="padding: 12px 15px; text-align: right; color: #64748b; font-size: 13px;">${p.min_stock !== undefined && p.min_stock !== null ? p.min_stock : 5}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
             <div style="text-align: center; padding: 25px; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
              ✅ Todo el inventario está saludable
            </div>
          `}
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 25px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0;">Generado automáticamente por Cobro App</p>
        <p style="margin: 8px 0 0;">© ${new Date().getFullYear()} ${companyName}</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const emailResponse = await resend.emails.send({
    from: `${companyName} <onboarding@resend.dev>`,
    to: [recipient_email],
    subject: `📊 Informe ${reportPeriod} - ${periodText}`,
    html: emailHTML,
  });

  console.log("Email sent successfully:", emailResponse);

  await supabase
    .from('store_settings')
    .update({ email_reports_last_sent: now.toISOString() })
    .eq('store_id', store_id);

  return { emailId: emailResponse.id };
}
