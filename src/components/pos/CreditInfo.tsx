import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { useCustomers } from '@/hooks/useCustomers';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface CreditInfoProps {
  selectedCustomer: string;
  creditDays: number;
  onCreditDaysChange: (days: number) => void;
}

const CreditInfo: React.FC<CreditInfoProps> = ({
  selectedCustomer,
  creditDays,
  onCreditDaysChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: balance } = useCustomerBalance(selectedCustomer);
  const { data: customers = [] } = useCustomers();
  
  const customer = customers.find(c => c.id === selectedCustomer);

  if (!selectedCustomer) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Debe seleccionar un cliente para ventas a crédito
        </AlertDescription>
      </Alert>
    );
  }

  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-3">
      <div className="bg-muted p-3 rounded-lg space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Cliente:</span>
          <span className="text-sm">{customer?.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Deuda Total:</span>
          <span className="text-sm font-bold text-destructive">
            ${balance?.totalDebt.toFixed(2) || '0.00'}
          </span>
        </div>
        
        {balance?.pendingSales && balance.pendingSales.length > 0 && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between p-2 h-auto"
              >
                <span className="text-xs font-medium">
                  Facturas Pendientes: ({balance.pendingSales.length})
                </span>
                {isOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2 border-t border-border">
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {balance.pendingSales.map((sale: any) => {
                    const daysRemaining = getDaysRemaining(sale.due_date);
                    const isOverdue = daysRemaining < 0;
                    return (
                      <div key={sale.id} className="text-xs flex justify-between items-center">
                        <span>{sale.invoice_number}</span>
                        <span className="flex items-center gap-2">
                          <span>${sale.total.toFixed(2)}</span>
                          <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {isOverdue ? `${Math.abs(daysRemaining)} días vencido` : `${daysRemaining} días`}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      
      <div>
        <label className="text-sm font-medium mb-2 block">Días de Crédito:</label>
        <Input
          type="number"
          value={creditDays}
          onChange={(e) => onCreditDaysChange(parseInt(e.target.value) || 0)}
          min="1"
          max="180"
          placeholder="Ej: 30"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Fecha de vencimiento: {new Date(Date.now() + creditDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default CreditInfo;
