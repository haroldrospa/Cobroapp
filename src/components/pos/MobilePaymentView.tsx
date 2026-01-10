import React, { useState } from 'react';
import { 
  Calculator, 
  User, 
  FileText, 
  Percent, 
  DollarSign, 
  CreditCard,
  UserPlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import AddCustomerDialog from './AddCustomerDialog';

interface Totals {
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

interface GlobalDiscount {
  type: 'percentage' | 'amount';
  value: number;
}

interface Customer {
  id: string;
  name: string;
}

interface InvoiceType {
  id: string;
  name: string;
  code: string;
}

interface MobilePaymentViewProps {
  onCustomerAdded?: (customerId: string) => void;
  totals: Totals;
  selectedCustomer: string;
  selectedInvoiceType: string;
  cartLength: number;
  customers: Customer[];
  invoiceTypes: InvoiceType[];
  globalDiscount: GlobalDiscount;
  onCustomerChange: (customerId: string) => void;
  onInvoiceTypeChange: (typeId: string) => void;
  onDiscountChange: (discount: GlobalDiscount) => void;
  onCheckout: () => void;
}

const MobilePaymentView: React.FC<MobilePaymentViewProps> = ({
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
}) => {
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  
  const { companyInfo } = usePrintSettings();
  const companyLogo = companyInfo.logo || null;
  const logoSummarySize = companyInfo.logoSummarySize;

  const selectedInvoiceTypeData = invoiceTypes.find(t => t.id === selectedInvoiceType);
  const requiresCustomer = selectedInvoiceTypeData?.code !== 'B02';
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
  const canCheckout = cartLength > 0 && (!requiresCustomer || selectedCustomer);

  const handleDiscountTypeChange = (type: 'percentage' | 'amount') => {
    onDiscountChange({ ...globalDiscount, type, value: 0 });
  };

  const handleDiscountValueChange = (value: number) => {
    onDiscountChange({ ...globalDiscount, value });
  };

  return (
    <div className="h-full flex flex-col p-3 gap-3">
      {/* Header with logo */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          <h2 className="font-semibold text-lg">Resumen de Venta</h2>
        </div>
        {companyLogo && (
          <img 
            src={companyLogo} 
            alt="Logo" 
            className="w-auto object-contain"
            style={{ height: `${Math.min(logoSummarySize, 48)}px` }}
          />
        )}
      </div>

      {/* Totals Card */}
      <Card className="flex-shrink-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${totals.subtotal}</span>
          </div>
          
          {/* Discount controls */}
          <div className="flex justify-between items-center text-sm gap-2">
            <span className="text-muted-foreground shrink-0">Descuento</span>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => handleDiscountTypeChange('percentage')}
                  className={cn(
                    "p-1.5 transition-colors",
                    globalDiscount.type === 'percentage' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <Percent className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDiscountTypeChange('amount')}
                  className={cn(
                    "p-1.5 transition-colors",
                    globalDiscount.type === 'amount' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <DollarSign className="h-3 w-3" />
                </button>
              </div>
              <Input
                type="number"
                value={globalDiscount.value || ''}
                onChange={(e) => handleDiscountValueChange(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-16 h-8 text-sm"
                min={0}
              />
              <span className="font-medium text-destructive">-${totals.discount}</span>
            </div>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ITBIS (18%)</span>
            <span className="font-medium">${totals.tax}</span>
          </div>
          
          <div className="flex justify-between text-xl font-bold border-t border-border pt-3 mt-3">
            <span>Total</span>
            <span>${totals.total}</span>
          </div>
        </CardContent>
      </Card>

      {/* Customer Selection */}
      <Collapsible open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardContent className="p-3 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Cliente</span>
                  {requiresCustomer && !selectedCustomer && (
                    <span className="text-xs text-destructive">*Requerido</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground truncate max-w-32">
                    {selectedCustomerData?.name || 'Seleccionar'}
                  </span>
                  {isCustomerOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 pt-0 space-y-2">
              <Select value={selectedCustomer} onValueChange={onCustomerChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin cliente</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setShowAddCustomer(true)}
              >
                <UserPlus className="h-4 w-4" />
                Nuevo Cliente
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Invoice Type Selection */}
      <Collapsible open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardContent className="p-3 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Tipo de Factura</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground truncate max-w-32">
                    {selectedInvoiceTypeData?.name || 'Seleccionar'}
                  </span>
                  {isInvoiceOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 pt-0">
              <Select value={selectedInvoiceType} onValueChange={onInvoiceTypeChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {invoiceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Checkout Button */}
      <Button
        size="lg"
        className="w-full h-14 text-lg font-semibold gap-2"
        onClick={onCheckout}
        disabled={!canCheckout}
      >
        <CreditCard className="h-5 w-5" />
        Procesar Venta - ${totals.total}
      </Button>

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={(customerId) => {
          onCustomerChange(customerId);
          setShowAddCustomer(false);
        }}
      />
    </div>
  );
};

export default MobilePaymentView;
