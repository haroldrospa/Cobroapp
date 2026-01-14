import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  FileText,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  Mail,
  Printer,
  ChevronRight,
  LayoutDashboard,
  Wallet,
  FileSpreadsheet,
  Filter,
  XCircle,
  CalendarDays,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useSales, Sale } from '@/hooks/useSalesManagement';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useDailyClosings, DailyClosing } from '@/hooks/useDailyClosings';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useCategories } from '@/hooks/useCategories';
import { useEmployees } from '@/hooks/useEmployees';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { DateRangePicker } from '@/components/ui/date-range-picker';

// --- CONFIGURATION ---
const REPORT_TYPES = [
  { id: 'dashboard', label: 'Resumen General', icon: LayoutDashboard, description: 'Visión global del negocio' },
  { id: 'sales-daily', label: 'Ventas Diarias', icon: CalendarDays, description: 'Evolución de ventas día por día' },
  { id: 'sales-hourly', label: 'Ventas por Hora', icon: Clock, description: 'Análisis de horas pico' },
  { id: 'sales-b01', label: 'Facturas B01 (Crédito Fiscal)', icon: FileText, description: 'Reporte de comprobantes fiscales B01' },
  { id: 'sales-b02', label: 'Facturas B02 (Consumo Final)', icon: FileText, description: 'Reporte de comprobantes fiscales B02' },
  { id: 'all-invoices', label: 'Reporte de Facturas', icon: FileSpreadsheet, description: 'Listado general de todas las facturas (B01 y B02)' },
  { id: 'closings', label: 'Cierres de Caja', icon: Wallet, description: 'Historial de sesiones y cierres de caja' },
  { id: 'receivables', label: 'Cuentas por Cobrar', icon: Users, description: 'Clientes con deudas pendientes' },
  { id: 'inventory', label: 'Inventario Valorizado', icon: Package, description: 'Valoración de stock actual' },
  { id: 'movements', label: 'Movimientos de Efectivo', icon: RefreshCw, description: 'Entradas y salidas de caja' },
  { id: 'profit', label: 'Porcentaje de Ganancia', icon: TrendingUp, description: 'Análisis de utilidad estimada vs costo' },
];

const COLORS = ['hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))', 'hsl(var(--primary))'];

const Reports = () => {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState('dashboard');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });

  // Filter States
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // Data Hooks
  const { data: sales = [] } = useSales();
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const { data: closings = [] } = useDailyClosings();
  const { data: movements = [] } = useCashMovements(undefined);
  const { data: categories = [] } = useCategories();
  const { data: employees = [] } = useEmployees();

  // Dialog States
  const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  // --- FILTERING HELPERS ---
  const isDateInRange = (dateStr: string) => {
    const date = new Date(dateStr);
    if (!dateRange) return true;
    if (dateRange.from && date < dateRange.from) return false;
    if (dateRange.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      if (date > endOfDay) return false;
    }
    return true;
  };

  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set<string>();
    sales.forEach(s => { if (s.payment_method) methods.add(s.payment_method); });
    return Array.from(methods);
  }, [sales]);

  const clearFilters = () => {
    setFilterCustomer('all');
    setFilterPaymentMethod('all');
    setFilterCategory('all');
    setFilterUser('all');
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date()
    });
  };

  // --- DATA DERIVATIONS ---
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // 1. Date Check
      if (!isDateInRange(s.created_at)) return false;

      // 2. Customer Filter
      if (filterCustomer !== 'all' && s.customer_id !== filterCustomer) return false;

      // 3. Payment Method Filter
      if (filterPaymentMethod !== 'all' && s.payment_method !== filterPaymentMethod) return false;

      // 4. User Filter
      if (filterUser !== 'all' && s.profile_id !== filterUser) return false;

      // 5. Category Filter (Check if ANY item in sale belongs to category)
      if (filterCategory !== 'all') {
        const hasCategoryItem = s.sale_items?.some(item => {
          const product = products.find(p => p.id === item.product_id);
          return product?.category_id === filterCategory;
        });
        if (!hasCategoryItem) return false;
      }

      return true;
    });
  }, [sales, dateRange, filterCustomer, filterPaymentMethod, filterUser, filterCategory, products]);

  const salesB01 = useMemo(() => filteredSales.filter(s => s.invoice_type?.code === '01' || (s.invoice_number || '').startsWith('B01') || (s.invoice_number || '').startsWith('E31')), [filteredSales]);
  const salesB02 = useMemo(() => filteredSales.filter(s => s.invoice_type?.code === '02' || (s.invoice_number || '').startsWith('B02') || (s.invoice_number || '').startsWith('E32')), [filteredSales]);
  const allInvoices = useMemo(() => filteredSales.filter(s =>
    s.invoice_type?.code === '01' || (s.invoice_number || '').startsWith('B01') || (s.invoice_number || '').startsWith('E31') ||
    s.invoice_type?.code === '02' || (s.invoice_number || '').startsWith('B02') || (s.invoice_number || '').startsWith('E32')
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [filteredSales]);

  // New: Daily Sales Aggregation
  const dailySalesData = useMemo(() => {
    const grouped: Record<string, { date: string, rawDate: Date, total: number, count: number }> = {};

    filteredSales.forEach(sale => {
      // Use raw Date object for sorting, string for grouping
      const dateObj = new Date(sale.created_at);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: format(dateObj, 'dd MMM', { locale: es }),
          rawDate: dateObj,
          total: 0,
          count: 0
        };
      }
      grouped[dateKey].total += sale.total;
      grouped[dateKey].count += 1;
    });

    return Object.values(grouped).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [filteredSales]);

  // New: Hourly Sales Aggregation
  const hourlySalesData = useMemo(() => {
    // Initialize all 24 hours
    const grouped = Array(24).fill(0).map((_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      total: 0,
      count: 0
    }));

    filteredSales.forEach(sale => {
      const hour = new Date(sale.created_at).getHours();
      grouped[hour].total += sale.total;
      grouped[hour].count += 1;
    });

    return grouped;
  }, [filteredSales]);


  const filteredClosings = useMemo(() => closings.filter(c => isDateInRange(c.closing_time || c.created_at)), [closings, dateRange]);
  const filteredInventory = useMemo(() => {
    if (filterCategory === 'all') return products;
    return products.filter(p => p.category_id === filterCategory);
  }, [products, filterCategory]);

  const filteredMovements = useMemo(() => movements.filter(m => isDateInRange(m.created_at)), [movements, dateRange]);

  const receivables = useMemo(() => customers.filter(c => (c.credit_used || 0) > 0), [customers]);

  const inventoryValue = useMemo(() => filteredInventory.reduce((sum, p) => sum + ((p.stock || 0) * p.price), 0), [filteredInventory]);
  const inventoryCost = useMemo(() => filteredInventory.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0), [filteredInventory]);

  // Profit Calculation
  const profitData = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    filteredSales.forEach(sale => {
      totalRevenue += (sale.total || 0) - (sale.tax_total || 0);

      sale.sale_items?.forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.cost) {
          totalCost += product.cost * item.quantity;
        }
      });
    });

    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, profit, margin };
  }, [filteredSales, products]);


  // --- HELPERS: CLOSING MOVEMENTS ---
  const getClosingMovements = (closing: DailyClosing) => {
    const startTime = new Date(closing.created_at);
    const endTime = closing.closing_time ? new Date(closing.closing_time) : new Date();
    return movements.filter(m => {
      const mDate = new Date(m.created_at);
      return mDate >= startTime && mDate <= endTime;
    });
  };

  // --- GENERATE PDF ---
  const generatePDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const activeReportObj = REPORT_TYPES.find(r => r.id === activeReport);
    const title = activeReportObj?.label || 'Reporte';

    // Modern Header with gradient background
    doc.setFillColor(16, 185, 129); // Emerald green
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Add company logo if available
    if (companySettings?.logo_url) {
      try {
        // Try to add logo - note: this requires the image to be accessible
        const logoSize = 30;
        doc.addImage(companySettings.logo_url, 'PNG', 15, 7.5, logoSize, logoSize);
      } catch (error) {
        console.log('Could not load logo in PDF');
      }
    }

    // Company name and app name in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.name || 'Cobro App', companySettings?.logo_url ? 50 : 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${format(new Date(), 'PPpp', { locale: es })}`, companySettings?.logo_url ? 50 : 15, 28);

    // Report title on white background with colored bottom border
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 45, pageWidth, 30, 'F');

    // Title
    doc.setTextColor(31, 41, 55); // Dark gray
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 58, { align: 'center' });

    // Date range
    if (dateRange?.from) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128); // Medium gray
      const dateText = dateRange.to
        ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
        : format(dateRange.from, 'dd/MM/yyyy');
      doc.text(`Período: ${dateText}`, pageWidth / 2, 67, { align: 'center' });
    }

    // Accent line
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1);
    doc.line(15, 74, pageWidth - 15, 74);

    // Body
    let head: string[][] = [];
    let body: string[][] = [];

    if (activeReport === 'sales-daily') {
      head = [['Fecha', 'Cant. Transacciones', 'Total Ventas']];
      body = dailySalesData.map(d => [d.date, d.count.toString(), `$${d.total.toLocaleString()}`]);
    } else if (activeReport === 'sales-hourly') {
      head = [['Hora', 'Cant. Transacciones', 'Total Ventas']];
      body = hourlySalesData.map(d => [d.label, d.count.toString(), `$${d.total.toLocaleString()}`]);
    } else if (activeReport === 'sales-b01') {
      head = [['Fecha', 'NCF', 'Cliente', 'RNC', 'Total', 'Impuesto']];
      body = salesB01.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', s.customer?.rnc || 'N/A', `$${s.total.toLocaleString()}`, `$${s.tax_total.toLocaleString()}`]);
    } else if (activeReport === 'sales-b02') {
      head = [['Fecha', 'NCF', 'Cliente', 'Total']];
      body = salesB02.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', `$${s.total.toLocaleString()}`]);
    } else if (activeReport === 'all-invoices') {
      head = [['Fecha', 'NCF', 'Cliente', 'RNC', 'Total', 'Impuesto']];
      body = allInvoices.map(s => [format(new Date(s.created_at), 'dd/MM/yyyy'), s.invoice_number || 'N/A', s.customer?.name || 'Consumidor', s.customer?.rnc || 'N/A', `$${s.total.toLocaleString()}`, `$${s.tax_total.toLocaleString()}`]);
      // Add summary row to PDF
      const totalSum = allInvoices.reduce((sum, s) => sum + s.total, 0);
      const totalTax = allInvoices.reduce((sum, s) => sum + (s.tax_total || 0), 0);
      body.push(['', '', '', 'TOTAL GENERAL', `$${totalSum.toLocaleString()}`, `$${totalTax.toLocaleString()}`]);
    } else if (activeReport === 'closings') {
      head = [['Apertura', 'Cierre', 'Usuario', 'Esperado', 'Real', 'Diferencia']];
      body = filteredClosings.map(c => [format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'), c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO', c.profile?.full_name || 'N/A', `$${(c.expected_cash || 0).toLocaleString()}`, `$${(c.actual_cash || 0).toLocaleString()}`, `$${(c.difference || 0).toLocaleString()}`]);
    } else if (activeReport === 'receivables') {
      head = [['Cliente', 'Teléfono', 'Deuda', 'Límite']];
      body = receivables.map(c => [c.name, c.phone || '-', `$${(c.credit_used || 0).toLocaleString()}`, `$${(c.credit_limit || 0).toLocaleString()}`]);
    } else if (activeReport === 'inventory') {
      head = [['Producto', 'Stock', 'Costo', 'Precio', 'Valor Venta']];
      body = filteredInventory.map(p => [p.name, p.stock.toString(), `$${(p.cost || 0).toLocaleString()}`, `$${p.price.toLocaleString()}`, `$${(p.stock * p.price).toLocaleString()}`]);
    } else if (activeReport === 'movements') {
      head = [['Fecha', 'Tipo', 'Motivo', 'Monto']];
      body = filteredMovements.map(m => [format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'), m.type === 'deposit' ? 'Entrada' : 'Salida', m.reason, `$${m.amount.toLocaleString()}`]);
    } else if (activeReport === 'profit') {
      head = [['Concepto', 'Monto']];
      body = [
        ['Ingresos Totales', `$${profitData.totalRevenue.toLocaleString()}`],
        ['Costos Totales', `$${profitData.totalCost.toLocaleString()}`],
        ['Utilidad Bruta', `$${profitData.profit.toLocaleString()}`],
        ['Margen %', `${profitData.margin.toFixed(2)}%`]
      ];
    } else if (activeReport === 'dashboard') {
      // Dashboard summary report
      head = [['Métrica', 'Valor']];
      const totalSales = filteredSales.reduce((a, b) => a + b.total, 0);
      const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
      const totalCredit = receivables.reduce((a, c) => a + (c.credit_used || 0), 0);

      body = [
        ['Ventas Totales', `$${totalSales.toLocaleString()}`],
        ['Transacciones', filteredSales.length.toString()],
        ['Ticket Promedio', `$${avgTicket.toFixed(2)}`],
        ['Crédito Pendiente', `$${totalCredit.toLocaleString()}`],
        ['Utilidad Estimada', `$${profitData.profit.toLocaleString()}`],
        ['Margen de Ganancia', `${profitData.margin.toFixed(1)}%`]
      ];
    }

    if (head.length > 0) {
      autoTable(doc, {
        startY: 80,
        head,
        body,
        theme: 'striped',
        headStyles: {
          fillColor: [16, 185, 129], // Emerald green
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [31, 41, 55]
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251] // Light gray
        },
        margin: { left: 15, right: 15 },
        styles: {
          lineColor: [229, 231, 235],
          lineWidth: 0.1
        }
      });

      // Footer with page numbers and company info
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        if (companySettings?.name) {
          doc.text(
            companySettings.name,
            15,
            pageHeight - 10
          );
        }
      }

      doc.save(`reporte-${activeReport}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({
        title: 'PDF Generado',
        description: 'El reporte PDF se ha descargado correctamente.'
      });
    } else {
      toast({ title: 'PDF no disponible', description: 'Este reporte no tiene plantilla de PDF configurada aún.' });
    }
  };

  // --- GENERATE EXCEL ---
  const generateExcel = () => {
    const activeReportObj = REPORT_TYPES.find(r => r.id === activeReport);
    const title = activeReportObj?.label || 'Reporte';
    let data: any[] = [];
    let fileName = `reporte-${activeReport}`;

    if (activeReport === 'sales-daily') {
      data = dailySalesData.map(d => ({
        Fecha: d.date,
        Transacciones: d.count,
        Total_Ventas: d.total
      }));
    } else if (activeReport === 'sales-hourly') {
      data = hourlySalesData.map(d => ({
        Hora: d.label,
        Transacciones: d.count,
        Total_Ventas: d.total
      }));
    } else if (activeReport === 'sales-b01') {
      data = salesB01.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        RNC: s.customer?.rnc || 'N/A',
        Impuesto: s.tax_total,
        Total: s.total
      }));
    } else if (activeReport === 'sales-b02') {
      data = salesB02.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        Total: s.total
      }));
    } else if (activeReport === 'all-invoices') {
      data = allInvoices.map(s => ({
        Fecha: format(new Date(s.created_at), 'dd/MM/yyyy HH:mm'),
        NCF: s.invoice_number,
        Cliente: s.customer?.name || 'Consumidor Final',
        RNC: s.customer?.rnc || 'N/A',
        Impuesto: s.tax_total,
        Total: s.total
      }));
      const totalSum = allInvoices.reduce((sum, s) => sum + s.total, 0);
      data.push({
        Fecha: '', NCF: '', Cliente: '', RNC: 'TOTAL GENERAL', Impuesto: '', Total: totalSum
      });
    } else if (activeReport === 'closings') {
      data = filteredClosings.map(c => ({
        Apertura: format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
        Cierre: c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO',
        Responsable: c.profile?.full_name,
        Efectivo_Ventas: c.total_sales_cash,
        Entradas: c.total_cash_in,
        Salidas: c.total_cash_out,
        Esperado: c.expected_cash,
        Real: c.actual_cash,
        Diferencia: c.difference
      }));
    } else if (activeReport === 'receivables') {
      data = receivables.map(c => ({
        Cliente: c.name,
        Telefono: c.phone || 'N/A',
        Limite_Credito: c.credit_limit,
        Credito_Usado: c.credit_used,
        Disponible: (c.credit_limit || 0) - (c.credit_used || 0)
      }));
    } else if (activeReport === 'inventory') {
      data = filteredInventory.map(p => ({
        Producto: p.name,
        Categoria: p.category?.name,
        Stock: p.stock,
        Costo: p.cost || 0,
        Precio_Venta: p.price,
        Valor_Total_Stock: (p.stock || 0) * p.price
      }));
    } else if (activeReport === 'movements') {
      data = filteredMovements.map(m => ({
        Fecha: format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
        Tipo: m.type === 'deposit' ? 'Entrada' : 'Salida',
        Motivo: m.reason,
        Monto: m.amount
      }));
    } else if (activeReport === 'profit') {
      data = [
        { Concepto: 'Ingresos Totales', Monto: profitData.totalRevenue },
        { Concepto: 'Costos Totales', Monto: profitData.totalCost },
        { Concepto: 'Utilidad Bruta', Monto: profitData.profit },
        { Concepto: 'Margen %', Monto: `${profitData.margin.toFixed(2)}%` }
      ];
    } else if (activeReport === 'dashboard') {
      // Dashboard summary export
      const totalSales = filteredSales.reduce((a, b) => a + b.total, 0);
      const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
      const totalCredit = receivables.reduce((a, c) => a + (c.credit_used || 0), 0);

      data = [
        { Metrica: 'Ventas Totales', Valor: totalSales },
        { Metrica: 'Transacciones', Valor: filteredSales.length },
        { Metrica: 'Ticket Promedio', Valor: avgTicket.toFixed(2) },
        { Metrica: 'Crédito Pendiente', Valor: totalCredit },
        { Metrica: 'Utilidad Estimada', Valor: profitData.profit },
        { Metrica: 'Margen de Ganancia (%)', Valor: profitData.margin.toFixed(1) }
      ];
      fileName = 'resumen-dashboard';
    }

    if (data.length === 0) {
      toast({ title: 'Sin datos', description: 'No hay datos para exportar en este reporte.', variant: 'outline' });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    // Auto-width columns
    const cols = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 20) }));
    ws['!cols'] = cols;

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(wb, `${fileName}-${dateStr}.xlsx`);
    toast({
      title: 'Excel Generado',
      description: 'El archivo Excel se ha descargado correctamente.'
    });
  };

  const handleSendEmail = () => {
    // Improve email validation
    if (!emailAddress || !emailAddress.includes('@')) {
      toast({ title: 'Correo inválido', variant: 'destructive', description: 'Por favor ingrese un correo válido.' });
      return;
    }

    // Mock Sending
    setTimeout(() => {
      toast({
        title: 'Correo Enviado',
        description: `El reporte actual se ha enviado correctamente a ${emailAddress}`
      });
      setIsEmailDialogOpen(false);
      setEmailAddress('');
    }, 1000);
  };


  // --- RENDER CONTENT AREA ---
  const renderContent = () => {
    switch (activeReport) {
      case 'dashboard':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${filteredSales.reduce((a, b) => a + b.total, 0).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{filteredSales.length} transacciones</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${filteredSales.length > 0 ? (filteredSales.reduce((a, b) => a + b.total, 0) / filteredSales.length).toFixed(2) : 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Crédito Pendiente</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">${receivables.reduce((a, c) => a + (c.credit_used || 0), 0).toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Utilidad Estimada</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">${profitData.profit.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{profitData.margin.toFixed(1)}% Margen</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Tendencia de Ventas (Últimos Días)</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySalesData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value) => `$${Number(value).toLocaleString()}`}
                      contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                      itemStyle={{ color: 'black' }}
                      labelStyle={{ color: '#666' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#8884d8" fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-daily':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Ventas Diarias</CardTitle>
                <CardDescription>Resumen de ventas agrupadas por día.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySalesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                        contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                        itemStyle={{ color: 'black' }}
                        labelStyle={{ color: '#666' }}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-center">Transacciones</TableHead>
                      <TableHead className="text-right">Total Vendido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailySalesData.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-6">No hay datos en este rango.</TableCell></TableRow> :
                      dailySalesData.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.date}</TableCell>
                          <TableCell className="text-center">{d.count}</TableCell>
                          <TableCell className="text-right font-bold">${d.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-hourly':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Hora</CardTitle>
                <CardDescription>Identifica tus horas pico de mayor venta.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlySalesData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" interval={2} />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                        contentStyle={{ backgroundColor: 'white', color: 'black', border: '1px solid #ccc', borderRadius: '4px' }}
                        itemStyle={{ color: 'black' }}
                        labelStyle={{ color: '#666' }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead className="text-center">Transacciones</TableHead>
                        <TableHead className="text-right">Total Vendido</TableHead>
                        <TableHead className="text-right">Promedio / Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourlySalesData.map((d, i) => (
                        <TableRow key={i} className={d.total > 0 ? 'bg-muted/20' : ''}>
                          <TableCell className="font-medium">{d.label}</TableCell>
                          <TableCell className="text-center">{d.count}</TableCell>
                          <TableCell className="text-right font-bold text-primary">${d.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${d.count > 0 ? (d.total / d.count).toFixed(0) : 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'sales-b01':
      case 'sales-b02':
      case 'all-invoices':
        const currentList = activeReport === 'sales-b01' ? salesB01 :
          activeReport === 'sales-b02' ? salesB02 : allInvoices;

        const title = activeReport === 'sales-b01' ? 'Facturas con Valor Fiscal (B01)' :
          activeReport === 'sales-b02' ? 'Facturas de Consumo (B02)' : 'Reporte General de Facturas';

        // Calculate totals for the footer
        const totalAmount = currentList.reduce((sum, s) => sum + s.total, 0);
        const totalTax = currentList.reduce((sum, s) => sum + (s.tax_total || 0), 0);

        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>Mostrando {currentList.length} comprobantes emitidos en el periodo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>NCF</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>RNC/Cédula</TableHead>
                    <TableHead className="text-right">ITBIS</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Ver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentList.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron facturas de este tipo.</TableCell></TableRow> :
                    currentList.map(s => (
                      <TableRow key={s.id} onClick={() => setSelectedSale(s)} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>{format(new Date(s.created_at), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-mono">{s.invoice_number}</TableCell>
                        <TableCell>{s.customer?.name || 'Consumidor Final'}</TableCell>
                        <TableCell>{s.customer?.rnc || '-'}</TableCell>
                        <TableCell className="text-right">${(s.tax_total || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">${s.total.toLocaleString()}</TableCell>
                        <TableCell className="text-center"><Eye className="h-4 w-4 inline text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">TOTAL GENERAL</TableCell>
                    <TableCell className="text-right">${totalTax.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-lg text-primary">${totalAmount.toLocaleString()}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        );

      case 'closings':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Historial de Cierres de Caja</CardTitle>
              <CardDescription>Registro de aperturas y cierres de turno.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Apertura</TableHead>
                    <TableHead>Fecha Cierre</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosings.map(c => (
                    <TableRow key={c.id} onClick={() => setSelectedClosing(c)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>{c.closing_time ? format(new Date(c.closing_time), 'dd/MM/yyyy HH:mm') : 'ABIERTO'}</TableCell>
                      <TableCell>{c.profile?.full_name}</TableCell>
                      <TableCell className="text-right">${(c.expected_cash || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold">${(c.actual_cash || 0).toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${(c.difference || 0) < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {(c.difference || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center"><Eye className="h-4 w-4 inline text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'receivables':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Cuentas por Cobrar</CardTitle>
              <CardDescription>Cartera de clientes con balance pendiente.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Límite de Crédito</TableHead>
                    <TableHead className="text-right">Deuda Actual</TableHead>
                    <TableHead className="text-right">Disponible</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay clientes con deuda.</TableCell></TableRow> :
                    receivables.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-primary">{c.name}</TableCell>
                        <TableCell>{c.phone || '-'}</TableCell>
                        <TableCell>${(c.credit_limit || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-red-600">${(c.credit_used || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600">${((c.credit_limit || 0) - (c.credit_used || 0)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'inventory':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Costo Total Inventario</p>
                  <h3 className="text-2xl font-bold text-primary">${inventoryCost.toLocaleString()}</h3>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground">Valor de Venta Potencial</p>
                  <h3 className="text-2xl font-bold text-green-700">${inventoryValue.toLocaleString()}</h3>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Detalle de Inventario</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                        <TableHead className="text-right">Costo Unit.</TableHead>
                        <TableHead className="text-right">Precio Venta</TableHead>
                        <TableHead className="text-right">Valuación (Costo)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell className="text-center font-bold">{p.stock}</TableCell>
                          <TableCell className="text-right">${(p.cost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">${p.price.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${(p.stock * (p.cost || 0)).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'movements':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader><CardTitle>Historial de Movimientos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8">No hay movimientos.</TableCell></TableRow> :
                    filteredMovements.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          {m.type === 'deposit' ? <span className="text-green-600 flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> Entrada</span> : <span className="text-red-600 flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> Salida</span>}
                        </TableCell>
                        <TableCell>{m.reason}</TableCell>
                        <TableCell className="text-right font-bold">RD$ {m.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'profit':
        return (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle>Análisis de Rentabilidad</CardTitle>
              <CardDescription>Calculado base Ventas Netas - Costo de Productos vendidos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-muted-foreground mb-2">Ingresos por Ventas</p>
                  <p className="text-2xl font-bold text-primary">${profitData.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-muted-foreground mb-2">Costo de Mercancía</p>
                  <p className="text-2xl font-bold text-red-600">${profitData.totalCost.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-accent/10">
                  <p className="text-muted-foreground mb-2">Utilidad Bruta</p>
                  <p className="text-3xl font-bold text-green-600">${profitData.profit.toLocaleString()}</p>
                  <p className="text-sm font-semibold text-green-700 mt-1">{profitData.margin.toFixed(2)}% Margen</p>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Ingresos', value: profitData.totalRevenue },
                    { name: 'Costos', value: profitData.totalCost },
                    { name: 'Utilidad', value: profitData.profit }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))">
                      <Cell fill="#3b82f6" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#22c55e" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return <div className="p-8 text-center text-muted-foreground">Seleccione un reporte del menú izquierdo.</div>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] overflow-hidden bg-background">
      {/* --- SIDEBAR --- */}
      <div className="w-64 border-r bg-muted/20 hidden md:flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Reportes
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {REPORT_TYPES.map(report => (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-left",
                  activeReport === report.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <report.icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="font-medium truncate">{report.label}</p>
                </div>
                {activeReport === report.id && <ChevronRight className="h-3 w-3 opacity-50" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="border-b p-4 flex flex-col gap-4 bg-background">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 md:hidden">
                <LayoutDashboard className="h-5 w-5" /> Reportes
              </h1>
              <h2 className="text-lg font-semibold text-foreground hidden md:block">
                {REPORT_TYPES.find(r => r.id === activeReport)?.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {REPORT_TYPES.find(r => r.id === activeReport)?.description}
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* Modern Date Range Picker */}
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />

              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => generatePDF()} title="Descargar PDF">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600 hover:text-green-700" onClick={() => generateExcel()} title="Descargar Excel">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsEmailDialogOpen(true)} title="Enviar por Correo">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* FILTERS BAR */}
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
            </div>

            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Clientes</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Método Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Métodos</SelectItem>
                {uniquePaymentMethods.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Categorías</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Usuarios</SelectItem>
                {employees.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterCustomer !== 'all' || filterPaymentMethod !== 'all' || filterCategory !== 'all' || filterUser !== 'all') && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive">
                <XCircle className="h-3 w-3 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Report Display Area */}
        <ScrollArea className="flex-1 p-6 bg-muted/10">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>

      {/* --- Dialogs --- */}
      <Dialog open={!!selectedClosing} onOpenChange={(open) => !open && setSelectedClosing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalles de Cierre de Caja</DialogTitle>
            <DialogDescription>
              {selectedClosing && `Sesión: ${format(new Date(selectedClosing.created_at), 'dd/MM/yyyy hh:mm a')}`}
            </DialogDescription>
          </DialogHeader>
          {selectedClosing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Fondo Inicial</p>
                  <p className="font-bold">RD$ {selectedClosing.initial_cash?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Ventas Efectivo</p>
                  <p className="font-bold">RD$ {selectedClosing.total_sales_cash.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-700">Total Entradas</p>
                  <p className="font-bold text-green-700">RD$ {(selectedClosing.total_cash_in as number)?.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-700">Total Salidas</p>
                  <p className="font-bold text-red-700">RD$ {(selectedClosing.total_cash_out as number)?.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Movimientos de esta Sesión
                </h4>
                <ScrollArea className="h-[250px] border rounded-md p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getClosingMovements(selectedClosing).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No hubo movimientos extras en esta sesión.
                          </TableCell>
                        </TableRow>
                      ) : (
                        getClosingMovements(selectedClosing).map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{format(new Date(m.created_at), 'hh:mm a')}</TableCell>
                            <TableCell>
                              {m.type === 'deposit' ?
                                <span className="text-green-600 text-xs font-bold flex items-center gap-1"><ArrowUpCircle className="h-3 w-3" /> Entrada</span> :
                                <span className="text-red-600 text-xs font-bold flex items-center gap-1"><ArrowDownCircle className="h-3 w-3" /> Salida</span>
                              }
                            </TableCell>
                            <TableCell className="text-xs">{m.reason}</TableCell>
                            <TableCell className="text-xs font-bold text-right">RD$ {m.amount.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Factura #{selectedSale?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              {selectedSale && format(new Date(selectedSale.created_at), 'PPP pp', { locale: es })}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">Cliente:</span>
                  <p>{selectedSale.customer?.name || 'Cliente Final'}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Atendido por:</span>
                  <p>{selectedSale.profile?.full_name || 'Desconocido'}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Método Pago:</span>
                  <p className="capitalize">{selectedSale.payment_method}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Estado:</span>
                  <p className="capitalize">{selectedSale.status}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.sale_items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">${item.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end space-y-1 flex-col items-end pt-2">
                <div className="flex justify-between w-48 text-sm">
                  <span>Subtotal:</span>
                  <span>${(selectedSale.subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-48 text-sm">
                  <span>Impuestos:</span>
                  <span>${(selectedSale.tax_total || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-48 font-bold text-lg border-t pt-1 mt-1">
                  <span>Total:</span>
                  <span>${selectedSale.total.toLocaleString()}</span>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline">
                  <Printer className="mr-2 h-4 w-4" /> Imprimir
                </Button>
                <Button onClick={() => setSelectedSale(null)}>Cerrar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Reporte por Correo</DialogTitle>
            <DialogDescription>
              Se enviará el reporte actual ({REPORT_TYPES.find(r => r.id === activeReport)?.label}) a la dirección indicada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                placeholder="ejemplo@empresa.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendEmail}>
              <Mail className="mr-2 h-4 w-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;