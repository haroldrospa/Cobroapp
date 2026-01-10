import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreditCard, Receipt, AlertTriangle, CheckCircle, DollarSign, Calendar, Loader2, Printer, X, Pencil, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useCustomerBalance } from '@/hooks/useCustomerBalance';
import { useUpdateCustomer, useCustomers, Customer } from '@/hooks/useCustomers';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface PaymentReceipt {
  customerName: string;
  invoicesPaid: Array<{ invoice_number: string; amountPaid: number; fullyPaid: boolean }>;
  totalPaid: number;
  paymentDate: Date;
  receiptNumber: string;
}

interface CustomerCreditDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomerCreditDialog: React.FC<CustomerCreditDialogProps> = ({
  customer: initialCustomer,
  open,
  onOpenChange,
}) => {
  const { data: customersList } = useCustomers();
  const customer = customersList?.find(c => c.id === initialCustomer?.id) || initialCustomer;

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');

  const handleUpdateLimit = async () => {
    const limit = parseFloat(newCreditLimit);
    if (isNaN(limit) || limit < 0) {
      toast.error("Límite inválido");
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_limit: limit
      });
      toast.success("Límite de crédito actualizado");
      setIsEditingLimit(false);
    } catch (e) {
      console.error(e);
      toast.error("Error actualizando límite");
    }
  };

  const { data: balanceData, isLoading } = useCustomerBalance(customer?.id);
  const updateCustomer = useUpdateCustomer();
  const queryClient = useQueryClient();

  if (!customer) return null;

  const { totalDebt, pendingSales } = balanceData || { totalDebt: 0, pendingSales: [] };

  const selectedTotal = pendingSales
    .filter(sale => selectedInvoices.includes(sale.id))
    .reduce((sum, sale) => sum + sale.balance, 0);

  // Get invoice numbers for display
  const pendingInvoiceNumbers = pendingSales.map(sale => sale.invoice_number).join(', ');

  const handleToggleInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === pendingSales.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(pendingSales.map(sale => sale.id));
    }
  };

  const getDaysOverdue = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REC-${timestamp}-${random}`;
  };

  const handlePaySelected = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Selecciona al menos una factura para pagar');
      return;
    }

    setIsProcessing(true);
    try {
      // Get the invoices being paid for the receipt (pay remaining balance)
      const invoicesPaid = pendingSales
        .filter(sale => selectedInvoices.includes(sale.id))
        .map(sale => ({
          invoice_number: sale.invoice_number,
          amountPaid: sale.balance,
          fullyPaid: true
        }));

      // Update selected invoices to paid (set amount_paid = total)
      for (const invoiceId of selectedInvoices) {
        const sale = pendingSales.find(s => s.id === invoiceId);
        if (sale) {
          const { error } = await supabase
            .from('sales')
            .update({
              payment_status: 'paid',
              amount_paid: sale.total,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoiceId);
          if (error) throw error;
        }
      }

      // Update customer's credit_used
      const newCreditUsed = Math.max(0, (customer.credit_used || 0) - selectedTotal);
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_used: newCreditUsed,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      // Generate receipt
      setPaymentReceipt({
        customerName: customer.name,
        invoicesPaid,
        totalPaid: selectedTotal,
        paymentDate: new Date(),
        receiptNumber: generateReceiptNumber(),
      });

      toast.success(`Se pagaron ${selectedInvoices.length} factura(s) por $${selectedTotal.toLocaleString()}`);
      setSelectedInvoices([]);
      setPaymentAmount('');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayAll = async () => {
    if (pendingSales.length === 0) {
      toast.error('No hay facturas pendientes');
      return;
    }

    setIsProcessing(true);
    try {
      const invoicesPaid = pendingSales.map(sale => ({
        invoice_number: sale.invoice_number,
        amountPaid: sale.balance,
        fullyPaid: true
      }));

      // Update all invoices to paid with amount_paid = total
      for (const sale of pendingSales) {
        const { error } = await supabase
          .from('sales')
          .update({
            payment_status: 'paid',
            amount_paid: sale.total,
            updated_at: new Date().toISOString()
          })
          .eq('id', sale.id);
        if (error) throw error;
      }

      // Update customer's credit_used to 0
      await updateCustomer.mutateAsync({
        id: customer.id,
        credit_used: 0,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });

      // Generate receipt
      setPaymentReceipt({
        customerName: customer.name,
        invoicesPaid,
        totalPaid: totalDebt,
        paymentDate: new Date(),
        receiptNumber: generateReceiptNumber(),
      });

      toast.success(`Se pagó la deuda total de $${totalDebt.toLocaleString()}`);
      setSelectedInvoices([]);
      setPaymentAmount('');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo de Pago</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 18px; }
            .info { margin-bottom: 15px; }
            .info p { margin: 5px 0; font-size: 12px; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 5px; text-align: left; }
            th { border-bottom: 1px solid #ccc; }
            .total { font-weight: bold; font-size: 14px; margin-top: 15px; text-align: right; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const creditLimit = customer.credit_limit || 0;
  // Use real-time totalDebt as the authority for credit used, rather than the potentially stale database field
  const creditUsed = totalDebt;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const creditPercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

  // If showing receipt
  if (paymentReceipt) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setPaymentReceipt(null);
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Recibo de Pago
            </DialogTitle>
          </DialogHeader>

          <div ref={receiptRef} className="space-y-4 p-4 bg-card rounded-lg border">
            <div className="header text-center">
              <h1 className="text-lg font-bold">RECIBO DE PAGO</h1>
              <p className="text-sm text-muted-foreground">No. {paymentReceipt.receiptNumber}</p>
            </div>

            <div className="info space-y-1">
              <p className="text-sm"><strong>Cliente:</strong> {paymentReceipt.customerName}</p>
              <p className="text-sm"><strong>Fecha:</strong> {format(paymentReceipt.paymentDate, 'PPP', { locale: es })}</p>
              <p className="text-sm"><strong>Hora:</strong> {format(paymentReceipt.paymentDate, 'HH:mm:ss')}</p>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold mb-2">Facturas Pagadas:</p>
              <div className="space-y-1">
                {paymentReceipt.invoicesPaid.map((invoice, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>
                      {invoice.invoice_number}
                      {!invoice.fullyPaid && <span className="text-xs text-muted-foreground ml-1">(abono)</span>}
                    </span>
                    <span>${invoice.amountPaid.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">TOTAL PAGADO:</span>
              <span className="text-xl font-bold text-green-500">
                ${paymentReceipt.totalPaid.toLocaleString()}
              </span>
            </div>

            <div className="footer text-center text-xs text-muted-foreground mt-4">
              <p>Gracias por su pago</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handlePrintReceipt} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Recibo
            </Button>
            <Button
              variant="outline"
              onClick={() => setPaymentReceipt(null)}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 outline-none overflow-hidden">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gestión de Crédito - {customer.name}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
          {/* Resumen de crédito */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-red-500">${totalDebt.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Deuda Total</p>
                {pendingSales.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 truncate" title={pendingInvoiceNumbers}>
                    {pendingSales.length} factura(s)
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-yellow-500">${creditUsed.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Crédito Usado</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-green-500">${creditAvailable.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Disponible</p>
              </CardContent>
            </Card>
          </div>

          {/* Show pending invoice numbers */}
          {pendingSales.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Facturas pendientes:</p>
              <p className="text-sm font-medium">{pendingInvoiceNumbers}</p>
            </div>
          )}

          {/* Barra de crédito */}
          <div className="space-y-1">
            <div className="flex justify-between items-end text-xs text-muted-foreground mb-1 h-8">
              {isEditingLimit ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                  <span className="font-medium text-foreground whitespace-nowrap">Nuevo Límite:</span>
                  <div className="relative">
                    <DollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      type="number"
                      value={newCreditLimit}
                      onChange={e => setNewCreditLimit(e.target.value)}
                      className="h-7 w-28 text-xs pl-5"
                      placeholder="0.00"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateLimit();
                        if (e.key === 'Escape') setIsEditingLimit(false);
                      }}
                    />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={handleUpdateLimit}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setIsEditingLimit(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span>Límite de crédito: <span className="font-medium text-foreground">${creditLimit.toLocaleString()}</span></span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-muted"
                    onClick={() => {
                      setNewCreditLimit(creditLimit.toString());
                      setIsEditingLimit(true);
                    }}
                    title="Editar límite de crédito"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <span>{creditPercentage.toFixed(0)}% utilizado</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ease-out ${creditPercentage >= 90 ? 'bg-red-500' : creditPercentage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                style={{ width: `${Math.min(creditPercentage, 100)}%` }}
              />
            </div>
          </div>

          {customer.credit_due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              <span>Vencimiento de crédito: {format(new Date(customer.credit_due_date), 'PPP', { locale: es })}</span>
            </div>
          )}

          <Separator />

          {/* Facturas pendientes */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Facturas Pendientes ({pendingSales.length})
              </h3>
              {pendingSales.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedInvoices.length === pendingSales.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : pendingSales.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-muted-foreground">No hay facturas pendientes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pendingSales.map((sale) => {
                  const daysOverdue = getDaysOverdue(sale.due_date);
                  const isOverdue = daysOverdue > 0;
                  const isSelected = selectedInvoices.includes(sale.id);

                  return (
                    <Card
                      key={sale.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => handleToggleInvoice(sale.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleInvoice(sale.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{sale.invoice_number}</span>
                              <div className="text-right">
                                <span className="font-bold">${sale.balance.toLocaleString()}</span>
                                {sale.amount_paid > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    (de ${sale.total.toLocaleString()})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                              <span>
                                {format(new Date(sale.created_at), 'dd/MM/yyyy')}
                              </span>
                              <div className="flex items-center gap-2">
                                {sale.amount_paid > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    Abonado: ${sale.amount_paid.toLocaleString()}
                                  </Badge>
                                )}
                                {sale.due_date && (
                                  <span className="flex items-center gap-1">
                                    Vence: {format(new Date(sale.due_date), 'dd/MM/yyyy')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isOverdue && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {daysOverdue} días
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Opciones de pago */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Procesar Pago
            </h3>

            {/* Pay All Button - Prominent */}
            <Button
              onClick={handlePayAll}
              disabled={pendingSales.length === 0 || isProcessing}
              className="w-full h-12 text-lg"
              variant="default"
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <DollarSign className="h-5 w-5 mr-2" />
              )}
              Pagar Todo - ${totalDebt.toLocaleString()}
            </Button>

            {/* Abonar section */}
            <Card className="border-primary/50">
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium">Abonar a la deuda</p>
                <p className="text-xs text-muted-foreground">
                  El abono se aplicará a las facturas más antiguas primero
                </p>
                {/* Quick amount buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {totalDebt > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(totalDebt.toFixed(2))}
                        className="text-xs"
                      >
                        Exacto (${totalDebt.toLocaleString()})
                      </Button>
                      {[500, 1000, 2000, 5000].filter(amt => amt <= totalDebt).map(amt => (
                        <Button
                          key={amt}
                          variant="outline"
                          size="sm"
                          onClick={() => setPaymentAmount(amt.toString())}
                          className="text-xs"
                        >
                          ${amt.toLocaleString()}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Monto a abonar"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={async () => {
                      const amount = parseFloat(paymentAmount);
                      if (isNaN(amount) || amount <= 0) {
                        toast.error('Ingresa un monto válido');
                        return;
                      }
                      if (amount > totalDebt) {
                        toast.error('El monto no puede ser mayor que la deuda total');
                        return;
                      }

                      setIsProcessing(true);
                      try {
                        let remainingAmount = amount;
                        const invoicesPaidDetails: Array<{ invoice_number: string; amountPaid: number; fullyPaid: boolean }> = [];

                        // Sort by due date (oldest first) and pay invoices
                        const sortedSales = [...pendingSales].sort((a, b) =>
                          new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime()
                        );

                        for (const sale of sortedSales) {
                          if (remainingAmount <= 0) break;

                          const currentBalance = sale.balance; // remaining balance on this invoice
                          const paymentForThisInvoice = Math.min(remainingAmount, currentBalance);
                          const newAmountPaid = sale.amount_paid + paymentForThisInvoice;
                          const fullyPaid = newAmountPaid >= sale.total;

                          // Update the invoice
                          const { error } = await supabase
                            .from('sales')
                            .update({
                              amount_paid: newAmountPaid,
                              payment_status: fullyPaid ? 'paid' : 'pending',
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', sale.id);

                          if (error) throw error;

                          invoicesPaidDetails.push({
                            invoice_number: sale.invoice_number,
                            amountPaid: paymentForThisInvoice,
                            fullyPaid
                          });

                          remainingAmount -= paymentForThisInvoice;
                        }

                        // Update customer's credit_used
                        const newCreditUsed = Math.max(0, (customer.credit_used || 0) - amount);
                        await updateCustomer.mutateAsync({
                          id: customer.id,
                          credit_used: newCreditUsed,
                        });

                        queryClient.invalidateQueries({ queryKey: ['customerBalance', customer.id] });
                        queryClient.invalidateQueries({ queryKey: ['sales'] });

                        // Generate receipt
                        setPaymentReceipt({
                          customerName: customer.name,
                          invoicesPaid: invoicesPaidDetails,
                          totalPaid: amount,
                          paymentDate: new Date(),
                          receiptNumber: generateReceiptNumber(),
                        });

                        const fullyPaidCount = invoicesPaidDetails.filter(i => i.fullyPaid).length;
                        const partialCount = invoicesPaidDetails.filter(i => !i.fullyPaid).length;
                        let message = `Se abonaron $${amount.toLocaleString()}`;
                        if (fullyPaidCount > 0) message += ` (${fullyPaidCount} factura(s) pagadas)`;
                        if (partialCount > 0) message += ` (${partialCount} abono(s) parcial(es))`;
                        toast.success(message);

                        setPaymentAmount('');
                      } catch (error) {
                        console.error('Error processing payment:', error);
                        toast.error('Error al procesar el abono');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={!paymentAmount || isProcessing}
                    className="min-w-[100px]"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Abonar'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">O pagar facturas seleccionadas</p>
              <Button
                onClick={handlePaySelected}
                disabled={selectedInvoices.length === 0 || isProcessing}
                className="w-full"
                variant="secondary"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Pagar Seleccionadas - ${selectedTotal.toLocaleString()}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog >
  );
};

export default CustomerCreditDialog;
