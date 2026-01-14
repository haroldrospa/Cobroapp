
import React from 'react';
import { Search, Filter, User, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';

interface InvoiceSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  paymentMethodFilter: string;
  onPaymentMethodChange: (value: string) => void;
  customerFilter: string;
  onCustomerChange: (value: string) => void;
  userIdFilter: string;
  onUserIdChange: (value: string) => void;
  invoiceTypeFilter: string;
  onInvoiceTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  minAmount: string;
  onMinAmountChange: (value: string) => void;
  maxAmount: string;
  onMaxAmountChange: (value: string) => void;
  onClearFilters: () => void;
  customers?: Array<{ id: string; name: string; rnc?: string }>;
  employees?: Array<{ id: string; full_name: string }>;
}

const InvoiceSearch: React.FC<InvoiceSearchProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  paymentMethodFilter,
  onPaymentMethodChange,
  customerFilter,
  onCustomerChange,
  userIdFilter,
  onUserIdChange,
  invoiceTypeFilter,
  onInvoiceTypeChange,
  dateRange,
  onDateRangeChange,
  minAmount,
  onMinAmountChange,
  maxAmount,
  onMaxAmountChange,
  onClearFilters,
  customers = [],
  employees = [],
}) => {
  // Estado local para el término de búsqueda temporal
  const [tempSearchTerm, setTempSearchTerm] = React.useState(searchTerm);

  // Sincronizar cuando cambia externamente (ej: limpiar filtros)
  React.useEffect(() => {
    setTempSearchTerm(searchTerm);
  }, [searchTerm]);

  // Función para ejecutar la búsqueda
  const handleSearch = () => {
    onSearchChange(tempSearchTerm);
  };

  // Manejar Enter en el input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Date Range Picker - FIRST (on top) */}
          <div>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
            />
          </div>

          {/* Búsqueda principal */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por número de factura o cliente..."
                value={tempSearchTerm}
                onChange={(e) => setTempSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} className="px-6">
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>

          {/* Filtros principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="completed">Pagadas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paymentMethodFilter} onValueChange={onPaymentMethodChange}>
              <SelectTrigger>
                <CreditCard className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Método de Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Métodos</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerFilter} onValueChange={onCustomerChange}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Clientes</SelectItem>
                <SelectItem value="general">Cliente General</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.rnc && `(${customer.rnc})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userIdFilter} onValueChange={onUserIdChange}>
              <SelectTrigger>
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Usuario / Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Usuarios</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={invoiceTypeFilter} onValueChange={onInvoiceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Factura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="B01">B01 - Crédito Fiscal</SelectItem>
                <SelectItem value="B02">B02 - Consumo</SelectItem>
                <SelectItem value="B14">B14 - Regímenes Especiales</SelectItem>
                <SelectItem value="B15">B15 - Gubernamental</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtros de monto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="number"
              placeholder="Monto mínimo"
              value={minAmount}
              onChange={(e) => onMinAmountChange(e.target.value)}
              step="0.01"
            />
            <Input
              type="number"
              placeholder="Monto máximo"
              value={maxAmount}
              onChange={(e) => onMaxAmountChange(e.target.value)}
              step="0.01"
            />
            <Button
              variant="outline"
              onClick={() => {
                setTempSearchTerm('');
                onClearFilters();
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceSearch;
