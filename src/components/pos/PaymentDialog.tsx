
import React, { useEffect, useRef } from 'react';
import { DollarSign, CreditCard, Printer, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreditInfo from './CreditInfo';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totals: {
    total: string;
  };
  paymentMethod: string;
  amountReceived: string;
  change: number;
  received: number;
  total: number;
  surchargeAmount?: number;
  selectedCustomer: string;
  creditDays: number;
  isProcessing?: boolean;
  onPaymentMethodChange: (method: string) => void;
  onAmountReceivedChange: (amount: string) => void;
  onCreditDaysChange: (days: number) => void;
  onProcessPayment: () => void;
  availableMethods?: { id: string; name: string; enabled: boolean }[];
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  totals,
  paymentMethod,
  amountReceived,
  change,
  received,
  total,
  surchargeAmount = 0,
  selectedCustomer,
  creditDays,
  isProcessing = false,
  onPaymentMethodChange,
  onAmountReceivedChange,
  onCreditDaysChange,
  onProcessPayment,
  availableMethods = [],
}) => {
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Sugerencias de monto inteligentes basadas en el total
  const suggestedAmounts = React.useMemo(() => {
    const amounts = new Set<number>();
    const tolerance = 0.01;

    // Siguientes múltiplos de denominaciones comunes (agilidad de cambio)
    [50, 100, 500, 1000].forEach(denom => {
      const next = Math.ceil((total + tolerance) / denom) * denom;
      if (next > total) amounts.add(next);
    });

    // Billetes comunes que cubren el monto
    [200, 500, 1000, 2000].forEach(bill => {
      if (bill > total) amounts.add(bill);
    });

    return Array.from(amounts).sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  // Focus on amount input when dialog opens or when switching to cash
  useEffect(() => {
    if (isOpen && paymentMethod === 'cash') {
      // Multiple attempts with different timings to ensure focus works
      const focusInput = () => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      };

      // Immediate attempt
      focusInput();

      // Delayed attempts for better reliability
      const timer1 = setTimeout(focusInput, 50);
      const timer2 = setTimeout(focusInput, 150);
      const timer3 = setTimeout(focusInput, 300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen, paymentMethod]);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Procesar Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            {surchargeAmount > 0 && (
              <p className="text-sm text-destructive mb-1">
                Recargo por tarjeta: +${surchargeAmount.toFixed(2)}
              </p>
            )}
            <p className="text-2xl font-bold">Total: ${totals.total}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Método de Pago:</label>
            <div className="grid grid-cols-2 gap-2">
              {availableMethods.length > 0 ? (
                availableMethods
                  .filter(m => m.enabled)
                  .map((method) => {
                    let MethodIcon = CreditCard;
                    if (method.id === 'cash') MethodIcon = DollarSign;
                    if (method.id === 'card') MethodIcon = CreditCard;
                    if (method.id === 'transfer' || method.id === 'bank') MethodIcon = CreditCard; // Maybe use different icon for transfer
                    if (method.id === 'check' || method.id === 'cheque') MethodIcon = FileText;
                    if (method.id === 'credit') MethodIcon = CreditCard;

                    return (
                      <Button
                        key={method.id}
                        variant={paymentMethod === method.id ? 'default' : 'outline'}
                        onClick={() => onPaymentMethodChange(method.id)}
                        disabled={isProcessing}
                      >
                        <MethodIcon className="h-4 w-4 mr-2" />
                        {method.name}
                      </Button>
                    );
                  })
              ) : (
                // Fallback hardcoded methods if no config is provided
                <>
                  <Button
                    variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                    onClick={() => onPaymentMethodChange('cash')}
                    disabled={isProcessing}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Efectivo
                  </Button>
                  <Button
                    variant={paymentMethod === 'card' ? 'default' : 'outline'}
                    onClick={() => onPaymentMethodChange('card')}
                    disabled={isProcessing}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Tarjeta
                  </Button>
                  <Button
                    variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                    onClick={() => onPaymentMethodChange('transfer')}
                    disabled={isProcessing}
                  >
                    Transferencia
                  </Button>
                  <Button
                    variant={paymentMethod === 'credit' ? 'default' : 'outline'}
                    onClick={() => onPaymentMethodChange('credit')}
                    disabled={isProcessing}
                  >
                    Crédito
                  </Button>
                </>
              )}
            </div>
          </div>

          {paymentMethod === 'credit' && (
            <CreditInfo
              selectedCustomer={selectedCustomer}
              creditDays={creditDays}
              onCreditDaysChange={onCreditDaysChange}
            />
          )}

          {paymentMethod === 'cash' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Monto Recibido:</label>
              <Input
                ref={amountInputRef}
                type="number"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => onAmountReceivedChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (received >= total && !isProcessing) {
                      onProcessPayment();
                    }
                  }
                }}
                step="0.01"
                disabled={isProcessing}
              />
              {/* Quick amount buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAmountReceivedChange(total.toFixed(2))}
                  className="text-xs"
                  disabled={isProcessing}
                >
                  Exacto (${total.toLocaleString()})
                </Button>
                {suggestedAmounts.map(amt => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => onAmountReceivedChange(amt.toString())}
                    className="text-xs"
                    disabled={isProcessing}
                  >
                    ${amt.toLocaleString()}
                  </Button>
                ))}
              </div>
              {received > 0 && (
                <div className="mt-2 p-2 bg-accent/20 rounded">
                  <p className="text-sm">
                    <strong>Cambio: ${change >= 0 ? change.toFixed(2) : '0.00'}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={onProcessPayment}
              className="flex-1"
              disabled={(paymentMethod === 'cash' && received < total) || (paymentMethod === 'credit' && !selectedCustomer) || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Procesando...' : 'Finalizar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
