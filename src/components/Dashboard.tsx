
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
import { LoadingLogo } from '@/components/ui/loading-logo';
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

  // 1. Obtener Métricas Generales (Rápido)
  const { data: dashboardMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['dashboard-metrics', dateRange],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return null;

      const { data, error } = await supabase.rpc('get_dashboard_metrics', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
      });

      if (error) {
        console.error('Error fetching metrics:', error);
        return null;
      }
      return data as any;
    }
  });

  // 2. Obtener Top Productos (Rápido)
  const { data: topProducts = [] } = useQuery({
    queryKey: ['top-products', dateRange],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_top_products_stats', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString(),
        p_limit: 5
      });

      if (error) throw error;

      return data?.map((item: any) => ({
        name: item.product_name,
        quantity: Number(item.quantity_sold),
        sales: Number(item.total_sales)
      })) || [];
    }
  });

  // 3. Obtener Ventas por Categoría (Rápido)
  const { data: categoryData = [] } = useQuery({
    queryKey: ['category-sales', dateRange],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_sales_by_category_stats', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
      });

      if (error) throw error;

      const colors = ['#0891b2', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ec4899', '#a855f7'];

      return data?.map((item: any, index: number) => ({
        name: item.category_name || 'Sin categoría',
        value: Number(item.total_sales),
        color: colors[index % colors.length]
      })) || [];
    }
  });

  // 4. Obtener Ventas Mensuales (Rápido)
  const { data: monthlySalesData = [] } = useQuery({
    queryKey: ['monthly-sales', new Date().getFullYear()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_sales_stats', {
        p_year: new Date().getFullYear()
      });

      if (error) throw error;

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const colors = ['#0891b2', '#06b6d4', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];

      // Mapear resultados a la estructura completa de meses
      return monthNames.map((month, index) => {
        const found = data?.find((d: any) => d.month_index === index);
        return {
          month,
          sales: found ? Number(found.total_sales) : 0,
          color: colors[index]
        };
      });
    }
  });

  // 5. Ventas por Hora (Rápido)
  const { data: hourlySalesData = [] } = useQuery({
    queryKey: ['hourly-sales', dateRange],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_hourly_sales_stats', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString()
      });

      if (error) throw error;

      // Rellenar horas vacías visualmente si se desea, o solo mostrar las que tienen ventas
      // Aquí devolvemos el formato esperado por el gráfico
      return data?.map((d: any) => ({
        hora: d.hour < 12 ? `${d.hour}AM` : d.hour === 12 ? '12PM' : `${d.hour - 12}PM`,
        ventas: Number(d.total_sales),
        cantidad: Number(d.usage_count)
      })) || [];
    }
  });

  // 6. Productos con Stock Bajo (RPC)
  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ['low-stock-products'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_low_stock_products_list');
      if (error) throw error;
      return data || [];
    }
  });

  // 7. Clientes con crédito alto (RPC)
  const { data: highCreditCustomers = [] } = useQuery({
    queryKey: ['high-credit-customers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_high_credit_customers_list');
      if (error) throw error;
      return data?.map((c: any) => ({
        ...c,
        percentage: Number(c.usage_percentage)
      })) || [];
    }
  });

  // 8. Clientes con crédito vencido (Lista para tab alertas)
  const { data: overdueCustomers = [] } = useQuery({
    queryKey: ['overdue-customers-list'],
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

  // 9. Secuencias de facturas (Alerta)
  const { data: invoiceSequences = [] } = useQuery({
    queryKey: ['invoice-sequences-alert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_sequences')
        .select('*');

      if (error) throw error;

      const maxNumber = 99999999;
      return data?.map(seq => ({
        ...seq,
        remaining: maxNumber - seq.current_number
      })).filter(seq => seq.remaining < 1000) || [];
    },
  });

  // 10. Top Clientes (Para Tab Clientes)
  const { data: topClients = [] } = useQuery({
    queryKey: ['top-clients', dateRange],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) return [];

      const { data, error } = await supabase.rpc('get_top_clients_stats', {
        p_start_date: dateRange.from.toISOString(),
        p_end_date: new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)).toISOString(),
        p_limit: 5
      });

      if (error) throw error;

      return data?.map((item: any) => ({
        name: item.customer_name,
        sales: Number(item.total_sales)
      })) || [];
    }
  });

  // Calcular tendencia
  const salesTrend = dashboardMetrics?.yesterday_sales > 0
    ? ((dashboardMetrics.today_sales - dashboardMetrics.yesterday_sales) / dashboardMetrics.yesterday_sales) * 100
    : 100;

  const stats = [
    {
      title: 'Ventas de Hoy',
      value: `$${(dashboardMetrics?.today_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${dashboardMetrics?.today_count || 0} ventas (${salesTrend.toFixed(1)}% vs ayer)`,
      icon: DollarSign,
      color: salesTrend >= 0 ? 'text-green-500' : 'text-red-500',
      bgColor: salesTrend >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
    },
    {
      title: 'Ventas Totales',
      value: `$${(dashboardMetrics?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `Ticket Prom: $${(dashboardMetrics?.avg_ticket || 0).toFixed(0)}`,
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Cuentas por Cobrar',
      value: (dashboardMetrics?.overdue_count || 0).toString(),
      change: 'Clientes con Mora',
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      title: 'Alertas de Stock',
      value: (dashboardMetrics?.low_stock || 0).toString(),
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

  if (loadingMetrics) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <LoadingLogo text="Analizando métricas..." size="md" />
      </div>
    );
  }

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
