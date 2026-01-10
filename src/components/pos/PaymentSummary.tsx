import React, { useState } from 'react';
import { Calculator, CreditCard, Plus, ChevronDown, ChevronUp, Percent, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Customer } from '@/hooks/useCustomers';
import { InvoiceType } from '@/hooks/useInvoiceTypes';
import { useIsMobile } from '@/hooks/use-mobile';
import { GlobalDiscount } from '@/types/pos';
import { cn } from '@/lib/utils';
import AddCustomerDialog from './AddCustomerDialog';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { usePrintSettings } from '@/hooks/usePrintSettings';

interface PaymentSummaryProps {
  totals: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
  };
  selectedCustomer: string;
  selectedInvoiceType: string;
  cartLength: number;
  customers: Customer[];
  invoiceTypes: InvoiceType[];
  globalDiscount: GlobalDiscount;
  onCustomerChange: (value: string) => void;
  onInvoiceTypeChange: (value: string) => void;
  onDiscountChange: (discount: GlobalDiscount) => void;
  onCheckout: () => void;
  fullscreenButton?: React.ReactNode;
}

const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  totals,
  selectedCustomer,
  selectedInvoiceType,
  cartLength,
  customers,
  invoiceTypes,
  globalDiscount,
  onCustomerChange,
  onInvoiceTypeChange,
  onDiscountChange,
  onCheckout,
  fullscreenButton,
}) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isInvoiceTypeOpen, setIsInvoiceTypeOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();

  const { companyInfo } = usePrintSettings();
  const companyLogo = companyInfo.logo || null;
  const logoSummarySize = companyInfo.logoSummarySize;

  const selectedType = invoiceTypes.find(type => type.id === selectedInvoiceType);
  const requiresCustomer = selectedType?.code === 'B01' || selectedType?.name?.toLowerCase().includes('crédito fiscal');

  const { data: customerBalance } = useCustomerBalance(selectedCustomer);
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  const isCheckoutDisabled = cartLength === 0 || (requiresCustomer && !selectedCustomer);

  const handleCustomerAdded = (customerId: string) => {
    onCustomerChange(customerId);
  };

  const handleDiscountTypeChange = (type: 'percentage' | 'amount') => {
    onDiscountChange({ value: 0, type });
  };

  const handleDiscountValueChange = (value: number) => {
    const maxValue = globalDiscount.type === 'percentage' ? 100 : parseFloat(totals.subtotal);
    onDiscountChange({
      ...globalDiscount,
      value: Math.max(0, Math.min(maxValue, value))
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-2 md:p-4 h-full flex flex-col">
      {/* Header con logo */}
      <div className="flex flex-col items-center gap-1 mb-2 flex-shrink-0">
        <div className="flex items-center gap-1 w-full justify-between">
          <div className="flex items-center gap-1">
            <Calculator className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <h2 className="text-[10px] md:text-xs font-bold">Resumen de Venta</h2>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            {fullscreenButton && <div className="shrink-0">{fullscreenButton}</div>}
          </div>
        </div>
        {companyLogo && (
          <div className="w-full flex justify-center py-0.5">
            <img
              src={companyLogo}
              alt="Logo"
              className="w-auto object-contain"
              style={{ height: isMobile ? `${Math.min(logoSummarySize * 0.6, 32)}px` : `${logoSummarySize}px` }}
            />
          </div>
        )}
      </div>

      {/* Contenido expandido */}
      {(!isMobile || isExpanded) && (
        <>
          {/* Totales */}
          <div className="border border-border rounded-lg p-2 md:p-4 space-y-1 mb-2 flex-shrink-0">
            <div className="flex justify-between text-xs md:text-base">
              <span>Subtotal:</span>
              <span className="font-medium">${totals.subtotal}</span>
            </div>

            {/* Descuento con controles */}
            <div className="flex justify-between items-center text-xs md:text-base gap-1">
              <span className="shrink-0">Descuento:</span>
              <div className="flex items-center gap-1 min-w-0">
                <div className="flex rounded-md border border-border overflow-hidden shrink-0">
                  <button
                    onClick={() => handleDiscountTypeChange('percentage')}
                    className={cn(
                      "p-1 transition-colors",
                      globalDiscount.type === 'percentage'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    title="Descuento por porcentaje"
                  >
                    <Percent className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDiscountTypeChange('amount')}
                    className={cn(
                      "p-1 transition-colors",
                      globalDiscount.type === 'amount'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    title="Descuento por monto"
                  >
                    <DollarSign className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  type="number"
                  value={globalDiscount.value || ''}
                  onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-12 h-6 text-xs px-1"
                  min={0}
                />
                <span className="font-medium text-destructive shrink-0 text-xs">-${totals.discount}</span>
              </div>
            </div>

            <div className="flex justify-between text-xs md:text-base">
              <span>ITBIS (18%):</span>
              <span className="font-medium">${totals.tax}</span>
            </div>
            <div className="flex justify-between text-sm md:text-lg font-bold border-t border-border pt-1 mt-1">
              <span>Total:</span>
              <span>${totals.total}</span>
            </div>
          </div>

          {/* Selección de cliente */}
          <Collapsible open={!isMobile || isCustomerOpen} onOpenChange={setIsCustomerOpen} className="mb-2 flex-shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-1 h-auto lg:pointer-events-none"
              >
                <label className="text-xs md:text-sm font-medium">
                  Cliente: {requiresCustomer && <span className="text-destructive">*</span>}
                </label>
                {isMobile && <ChevronDown className={`h-3 w-3 transition-transform ${isCustomerOpen ? 'rotate-180' : ''}`} />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 px-1">
              <div className="flex items-center justify-between mb-0.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCustomer(true)}
                  className="h-7 px-2 text-xs ml-auto"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  <span>Nuevo</span>
                </Button>
              </div>
              <Select value={selectedCustomer} onValueChange={onCustomerChange}>
                <SelectTrigger className={`h-8 text-xs ${requiresCustomer && !selectedCustomer ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id} className="text-xs">
                      {customer.name} {customer.rnc && `(${customer.rnc})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiresCustomer && !selectedCustomer && (
                <p className="text-[10px] text-destructive">
                  Este tipo de factura requiere seleccionar un cliente
                </p>
              )}
              {/* Info de crédito pendiente */}
              {selectedCustomer && customerBalance && customerBalance.totalDebt > 0 && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-1 text-yellow-500 mb-1">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-[10px] font-medium">Crédito Pendiente</span>
                  </div>
                  <p className="text-xs font-bold text-yellow-500">
                    ${customerBalance.totalDebt.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {customerBalance.pendingSales.length} factura{customerBalance.pendingSales.length !== 1 ? 's' : ''} pendiente{customerBalance.pendingSales.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Selección de tipo de factura */}
          <Collapsible open={!isMobile || isInvoiceTypeOpen} onOpenChange={setIsInvoiceTypeOpen} className="mb-2 flex-shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-1 h-auto lg:pointer-events-none"
              >
                <label className="text-xs md:text-sm font-medium">Tipo de Factura:</label>
                {isMobile && <ChevronDown className={`h-3 w-3 transition-transform ${isInvoiceTypeOpen ? 'rotate-180' : ''}`} />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 px-1">
              <Select value={selectedInvoiceType} onValueChange={onInvoiceTypeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  {invoiceTypes
                    .filter(type => ['B01', 'B02'].includes(type.code))
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id} className="text-xs">
                        {type.code} - {type.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* Botón de procesar venta */}
          <div className="mt-auto flex-shrink-0 pt-1">
            <Button
              onClick={onCheckout}
              className="w-full h-10 md:h-12 text-sm md:text-base font-semibold"
              disabled={isCheckoutDisabled}
            >
              <CreditCard className="mr-1.5 h-4 w-4 md:h-5 md:w-5" />
              Procesar Venta
              {!isMobile && <span className="ml-2 text-[10px] opacity-70 font-normal border border-current rounded px-1">F10</span>}
            </Button>
          </div>
        </>
      )}

      {/* Versión compacta cuando está colapsado en móvil */}
      {isMobile && !isExpanded && (
        <div className="flex items-center justify-between py-2 border-t border-border mt-1">
          <div className="text-base font-bold">Total: ${totals.total}</div>
          <Button
            onClick={onCheckout}
            className="h-9 px-3 text-xs font-semibold"
            disabled={isCheckoutDisabled}
          >
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Procesar
          </Button>
        </div>
      )}

      <AddCustomerDialog
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </div>
  );
};

export default PaymentSummary;
