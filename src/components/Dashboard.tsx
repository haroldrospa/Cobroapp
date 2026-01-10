
import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Calendar as CalendarIcon,
  CreditCard,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  FileText,
  Settings,
  Menu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const Dashboard: React.FC = () => {
  // Estado para el rango de fechas
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      from: firstDayOfMonth,
      to: today
    };
  });

  // Obtener ventas reales filtradas por fecha
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales-dashboard', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Obtener productos reales
  const { data: products = [], isLoading: loadingProducts } = useProducts();

  // Obtener productos más vendidos con datos reales
  const { data: topProductsData = [] } = useQuery({
    queryKey: ['top-products', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('sale_items')
        .select(`
          product_id,
          quantity,
          total,
          products (name),
          sales!inner (created_at)
        `);

      if (dateRange?.from) {
        query = query.gte('sales.created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('sales.created_at', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por producto y sumar cantidades y totales
      const productMap = new Map<string, { name: string; quantity: number; sales: number }>();

      data?.forEach(item => {
        const productId = item.product_id;
        const productName = (item.products as any)?.name || 'Producto desconocido';

        if (productId) {
          const existing = productMap.get(productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.sales += Number(item.total);
          } else {
            productMap.set(productId, {
              name: productName,
              quantity: item.quantity,
              sales: Number(item.total)
            });
          }
        }
      });

      // Convertir a array y ordenar por ventas
      return Array.from(productMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
    },
  });

  // Calcular estadísticas reales
  const calculatedStats = useMemo(() => {
    if (loadingSales || loadingProducts) {
      return {
        totalSales: 0,
        todaySales: 0,
        yesterdaySales: 0,
        todayCount: 0,
        avgTicket: 0,
        activeProducts: 0,
        newProducts: 0
      };
    }

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const totalCount = sales.length;
    const avgTicket = totalCount > 0 ? totalSales / totalCount : 0;

    // Dates setup
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Today's stats
    const todaySalesData = sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });

    const todaySales = todaySalesData.reduce((sum, sale) => sum + Number(sale.total), 0);
    const todayCount = todaySalesData.length;

    // Yesterday's stats for comparison
    const yesterdaySales = sales
      .filter(sale => {
        const saleDate = new Date(sale.created_at);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === yesterday.getTime();
      })
      .reduce((sum, sale) => sum + Number(sale.total), 0);

    const activeProducts = products.filter(p => p.status === 'active').length;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newProducts = products.filter(p => p.created_at && new Date(p.created_at) > oneMonthAgo).length;

    return {
      totalSales,
      todaySales,
      yesterdaySales,
      todayCount,
      avgTicket,
      activeProducts,
      newProducts
    };
  }, [sales, products, loadingSales, loadingProducts]);

  // Calcular datos mensuales reales
  const monthlySalesData = useMemo(() => {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const colors = ['#0891b2', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];

    const monthlyData = monthNames.map((month, index) => ({
      month,
      sales: 0,
      color: colors[index]
    }));

    sales.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      const monthIndex = saleDate.getMonth();
      monthlyData[monthIndex].sales += Number(sale.total);
    });

    return monthlyData;
  }, [sales]);

  // Calcular mejor mes
  const bestMonth = useMemo(() => {
    if (!monthlySalesData.length) return { name: 'N/A', sales: 0 };

    const best = monthlySalesData.reduce((max, month) =>
      month.sales > max.sales ? month : max
    );

    return { name: best.month.toUpperCase(), sales: best.sales };
  }, [monthlySalesData]);

  // Obtener ventas por hora (datos reales)
  const { data: hourlySalesData = [] } = useQuery({
    queryKey: ['hourly-sales', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('created_at, total');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por hora
      const hourlyMap = new Map<number, { ventas: number; cantidad: number }>();

      // Inicializar todas las horas de 6AM a 10PM
      for (let i = 6; i <= 22; i++) {
        hourlyMap.set(i, { ventas: 0, cantidad: 0 });
      }

      data?.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        const hour = saleDate.getHours();

        const existing = hourlyMap.get(hour);
        if (existing) {
          existing.ventas += Number(sale.total);
          existing.cantidad += 1;
        }
      });

      // Convertir a array con formato de hora
      return Array.from(hourlyMap.entries())
        .map(([hour, data]) => ({
          hora: hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`,
          ventas: data.ventas,
          cantidad: data.cantidad
        }))
        .filter(item => item.ventas > 0 || item.cantidad > 0);
    },
  });

  // Usar datos reales de topProductsData
  const topProducts = topProductsData;

  // Obtener datos de ventas por categoría (datos reales)
  const { data: categoryData = [] } = useQuery({
    queryKey: ['category-sales', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('sale_items')
        .select(`
          total,
          products!inner (
            category_id,
            categories (name)
          ),
          sales!inner (created_at)
        `);

      if (dateRange?.from) {
        query = query.gte('sales.created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('sales.created_at', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por categoría
      const colors = ['#0891b2', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ec4899', '#a855f7'];
      const categoryMap = new Map<string, { name: string; value: number }>();

      data?.forEach(item => {
        const product = item.products as any;
        const categoryName = product?.categories?.name || 'Sin categoría';

        const existing = categoryMap.get(categoryName);
        if (existing) {
          existing.value += Number(item.total);
        } else {
          categoryMap.set(categoryName, {
            name: categoryName,
            value: Number(item.total)
          });
        }
      });

      // Convertir a array, ordenar y agregar colores
      return Array.from(categoryMap.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 7)
        .map((item, index) => ({
          ...item,
          color: colors[index % colors.length]
        }));
    },
  });

  // Obtener clientes top (datos reales)
  const { data: topClients = [] } = useQuery({
    queryKey: ['top-clients', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          customer_id,
          total,
          customers (name)
        `);

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por cliente
      const clientMap = new Map<string, { name: string; sales: number }>();

      data?.forEach(sale => {
        const customerId = sale.customer_id || 'general';
        const customerName = (sale.customers as any)?.name || 'Cliente General';

        const existing = clientMap.get(customerId);
        if (existing) {
          existing.sales += Number(sale.total);
        } else {
          clientMap.set(customerId, {
            name: customerName,
            sales: Number(sale.total)
          });
        }
      });

      // Ordenar por ventas y tomar los top 5
      return Array.from(clientMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
    },
  });

  // Calcular alertas del sistema con datos reales
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.min_stock && p.status === 'active');
  }, [products]);

  // Clientes con crédito vencido (ventas pendientes con due_date pasada)
  const { data: overdueCustomers = [] } = useQuery({
    queryKey: ['overdue-customers'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sales')
        .select(`
          customer_id,
          customers (name)
        `)
        .eq('payment_status', 'pending')
        .lt('due_date', now)
        .not('customer_id', 'is', null);

      if (error) throw error;

      // Obtener clientes únicos
      const uniqueCustomers = new Map<string, string>();
      data?.forEach(sale => {
        if (sale.customer_id) {
          uniqueCustomers.set(sale.customer_id, (sale.customers as any)?.name || 'Cliente');
        }
      });

      return Array.from(uniqueCustomers.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  // Secuencias de facturas próximas a agotarse
  const { data: invoiceSequences = [] } = useQuery({
    queryKey: ['invoice-sequences-alert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('*');

      if (error) throw error;

      // Calcular cuántos números quedan (asumiendo que el máximo es 99999999)
      const maxNumber = 99999999;
      return data?.map(seq => ({
        ...seq,
        remaining: maxNumber - seq.current_number
      })).filter(seq => seq.remaining < 1000) || []; // Alertar si quedan menos de 1000
    },
  });

  // Clientes con crédito alto (uso >= 80% del límite)
  const { data: highCreditCustomers = [] } = useQuery({
    queryKey: ['high-credit-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, credit_limit, credit_used')
        .gt('credit_limit', 0);

      if (error) throw error;

      // Filtrar clientes con uso >= 80% del límite
      return data?.filter(customer => {
        const used = customer.credit_used || 0;
        const limit = customer.credit_limit || 0;
        return limit > 0 && (used / limit) >= 0.8;
      }).map(customer => ({
        ...customer,
        percentage: Math.round(((customer.credit_used || 0) / (customer.credit_limit || 1)) * 100)
      })) || [];
    },
  });

  // Calculate trend for today vs yesterday
  const salesTrend = calculatedStats.yesterdaySales > 0
    ? ((calculatedStats.todaySales - calculatedStats.yesterdaySales) / calculatedStats.yesterdaySales) * 100
    : 100;

  const stats = [
    {
      title: 'Ventas de Hoy',
      value: `$${calculatedStats.todaySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${calculatedStats.todayCount} ventas (${salesTrend.toFixed(1)}% vs ayer)`,
      icon: DollarSign,
      color: salesTrend >= 0 ? 'text-green-500' : 'text-red-500',
      bgColor: salesTrend >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
    },
    {
      title: 'Ventas Totales',
      value: `$${calculatedStats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `Ticket Prom: $${calculatedStats.avgTicket.toFixed(0)}`,
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Cuentas por Cobrar',
      value: overdueCustomers.length.toString(),
      change: 'Clientes con Mora',
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      title: 'Alertas de Stock',
      value: lowStockProducts.length.toString(),
      change: 'Productos bajo mínimo',
      icon: Package,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  const chartConfig = {
    sales: {
      label: "Ventas",
      color: "hsl(var(--primary))",
    },
    cantidad: {
      label: "Cantidad",
      color: "hsl(var(--muted-foreground))",
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard Analítico
          </h1>
          <p className="text-muted-foreground">
            {dateRange?.from && dateRange?.to ? (
              <>
                Análisis de ventas - {format(dateRange.from, 'PPP', { locale: es })} hasta {format(dateRange.to, 'PPP', { locale: es })}
              </>
            ) : (
              <>
                Análisis completo de ventas - {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Selector de rango de fechas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
                    </>
                  ) : (
                    format(dateRange.from, 'dd/MM/yyyy', { locale: es })
                  )
                ) : (
                  <span>Seleccionar período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={es}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <Link to="/pos">
            <Button size="default" className="bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white shadow-lg">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Punto de Venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Menú Administrativo (Accesos Rápidos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link to="/products">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <Package className="h-6 w-6 text-orange-500" />
              <span className="text-sm font-medium">Productos</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/customers">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <Users className="h-6 w-6 text-blue-500" />
              <span className="text-sm font-medium">Clientes</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/invoices">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <FileText className="h-6 w-6 text-green-500" />
              <span className="text-sm font-medium">Facturas</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/reports">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <BarChart3 className="h-6 w-6 text-purple-500" />
              <span className="text-sm font-medium">Reportes</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/employees">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <Users className="h-6 w-6 text-pink-500" />
              <span className="text-sm font-medium">Empleados</span>
            </CardContent>
          </Card>
        </Link>
        <Link to="/settings">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed border-2 hover:border-solid hover:border-accent">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
              <Settings className="h-6 w-6 text-gray-500" />
              <span className="text-sm font-medium">Configuración</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Estadísticas principales con diseño mejorado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className={`absolute inset-0 ${stat.bgColor} opacity-50`} />
              <CardContent className="relative p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <p className={`text-sm ${stat.color} flex items-center gap-1`}>
                      <TrendingUp className="h-3 w-3" />
                      {stat.change}
                    </p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-full`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ventas Mensuales */}
        <Card className="xl:col-span-2 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Ventas Mensuales - {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySalesData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                  />
                  <Bar dataKey="sales" radius={4}>
                    {monthlySalesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Grupos de Productos */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-accent" />
              Top Grupos de Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                  />
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {categoryData.slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="hourly">Ventas por Hora</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-accent" />
                Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-sm font-bold text-accent">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {product.quantity} unidades vendidas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${product.sales.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Ventas por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlySalesData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="hora" />
                    <YAxis />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value, name) => [
                        name === 'ventas' ? `$${Number(value).toLocaleString()}` : value,
                        name === 'ventas' ? 'Ventas' : 'Cantidad'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="ventas"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="cantidad"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                Top Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topClients.map((client, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-secondary/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-bold text-blue-500">
                        {index + 1}
                      </div>
                      <p className="font-medium">{client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${client.sales.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card className="border-yellow-500/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-500">
                <AlertCircle className="h-5 w-5" />
                Alertas del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockProducts.length > 0 && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <p className="font-medium text-red-500">{lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock bajo</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {lowStockProducts.map((product) => (
                        <div key={product.id} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded">
                          <span>{product.name}</span>
                          <span className="text-red-500 font-medium">
                            Stock: {product.stock} / Mín: {product.min_stock}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {overdueCustomers.length > 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <p className="font-medium text-yellow-500">{overdueCustomers.length} cliente{overdueCustomers.length !== 1 ? 's' : ''} con crédito vencido</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {overdueCustomers.map((customer) => (
                        <div key={customer.id} className="text-sm p-2 bg-background/50 rounded">
                          {customer.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {highCreditCustomers.length > 0 && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      <p className="font-medium text-orange-500">{highCreditCustomers.length} cliente{highCreditCustomers.length !== 1 ? 's' : ''} con crédito alto</p>
                    </div>
                    <div className="space-y-2 ml-8">
                      {highCreditCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded">
                          <span>{customer.name}</span>
                          <span className="text-orange-500 font-medium">
                            ${(customer.credit_used || 0).toLocaleString()} / ${(customer.credit_limit || 0).toLocaleString()} ({customer.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {invoiceSequences.map((seq) => (
                  <div key={seq.id} className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    <p className="text-sm">Secuencia {seq.invoice_type_id} próxima a agotarse (quedan {seq.remaining.toLocaleString()} números)</p>
                  </div>
                ))}
                {lowStockProducts.length === 0 && overdueCustomers.length === 0 && highCreditCustomers.length === 0 && invoiceSequences.length === 0 && (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-green-500" />
                    <p className="text-sm">No hay alertas pendientes</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Acciones rápidas mejoradas */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/pos">
              <div className="group p-6 bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-3 text-accent group-hover:scale-110 transition-transform" />
                <p className="font-medium">Nueva Venta</p>
              </div>
            </Link>
            <Link to="/products">
              <div className="group p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <Package className="h-8 w-8 mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Gestionar Productos</p>
              </div>
            </Link>
            <Link to="/customers">
              <div className="group p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <Users className="h-8 w-8 mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Ver Clientes</p>
              </div>
            </Link>
            <Link to="/reports">
              <div className="group p-6 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 text-orange-500 group-hover:scale-110 transition-transform" />
                <p className="font-medium">Reportes</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
