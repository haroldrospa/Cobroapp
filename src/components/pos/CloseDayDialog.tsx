import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lock, Calculator, CheckCircle, AlertTriangle, Printer, Wallet } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useActiveSession, useCloseSession, useSessionHistory } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CashCountDialog from './CashCountDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { generateCloseDayPDF } from '@/utils/closeDayPdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';

interface CloseDayDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const CloseDayDialog: React.FC<CloseDayDialogProps> = ({ isOpen, onClose }) => {
    const [actualCash, setActualCash] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [showCashCount, setShowCashCount] = useState(false);

    // Options
    const [downloadPdf, setDownloadPdf] = useState(true);
    const [sendEmail, setSendEmail] = useState(true);
    const [printReport, setPrintReport] = useState(false);

    // Hooks
    const { data: activeSession } = useActiveSession();
    const { data: sales = [] } = useSales();
    const { data: movements = [] } = useCashMovements();
    const { data: history = [] } = useSessionHistory();
    const { companyInfo } = usePrintSettings();
    const { data: userData } = useUserStore();
    const closeSession = useCloseSession();
    const { toast } = useToast();

    // Filter sales for the current session
    const sessionSales = useMemo(() => {
        if (!activeSession) return [];
        const startTime = new Date(activeSession.opened_at);
        return sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            return saleDate >= startTime;
        });
    }, [sales, activeSession]);

    // Filter movements for the current session
    const sessionMovements = useMemo(() => {
        if (!activeSession) return [];
        const startTime = new Date(activeSession.opened_at);
        return movements.filter(m => {
            const mDate = new Date(m.created_at);
            return mDate >= startTime;
        });
    }, [movements, activeSession]);

    // Calculate Financials
    const stats = useMemo(() => {
        // Sales totals by method
        let cashSales = 0;
        let cardSales = 0;
        let transferSales = 0;
        let otherSales = 0;
        let totalRefunds = 0;

        sessionSales.forEach(sale => {
            const amount = sale.total || 0;

            if (amount < 0) {
                // Refund
                totalRefunds += Math.abs(amount);
                if (sale.payment_method === 'cash') {
                    cashSales -= Math.abs(amount);
                }
            } else {
                // Regular Sale
                if (sale.payment_method === 'cash') cashSales += amount;
                else if (sale.payment_method === 'card') cardSales += amount;
                else if (sale.payment_method === 'transfer') transferSales += amount;
                else otherSales += amount;
            }
        });

        // Cash Movements
        const deposits = sessionMovements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + Number(m.amount), 0);
        const withdrawals = sessionMovements.filter(m => m.type === 'withdrawal').reduce((acc, m) => acc + Number(m.amount), 0);

        // Initial Cash
        const initialCash = activeSession?.initial_cash || 0;

        // Expected Cash in Drawer
        const expectedCash = initialCash + cashSales + deposits - withdrawals;

        // Cash to Withdraw (Everything except initial)
        // If expected cash < initial cash (loss), then we withdraw 0 or negative (monitor)
        const cashToWithdraw = Math.max(0, expectedCash - initialCash);

        return {
            salesCount: sessionSales.length,
            cashSales,
            cardSales,
            transferSales,
            otherSales,
            totalRefunds,
            deposits,
            withdrawals,
            expectedCash,
            initialCash,
            cashToWithdraw,
            totalSales: cashSales + cardSales + transferSales + otherSales
        };
    }, [sessionSales, sessionMovements, activeSession]);

    const difference = (parseFloat(actualCash) || 0) - stats.expectedCash;

    const handleCloseDay = async () => {
        if (!activeSession) return;

        try {
            await closeSession.mutateAsync({
                sessionId: activeSession.id,
                closingData: {
                    total_sales_cash: stats.cashSales,
                    total_sales_card: stats.cardSales,
                    total_sales_transfer: stats.transferSales,
                    total_sales_other: stats.otherSales,
                    total_refunds: stats.totalRefunds,
                    total_cash_in: stats.deposits,
                    total_cash_out: stats.withdrawals,
                    expected_cash: stats.expectedCash,
                    actual_cash: parseFloat(actualCash) || 0,
                    difference: difference,
                    notes: notes
                }
            });

            toast({
                title: 'Cierre Exitoso',
                description: 'La caja se ha cerrado correctamente.'
            });

            // Handle Post-Close Actions
            if (downloadPdf || printReport) {
                const openerName = history.find((h: any) => h.id === activeSession.id)?.opener?.full_name || 'Desconocido';

                const doc = generateCloseDayPDF(companyInfo, {
                    stats,
                    actualCash: parseFloat(actualCash) || 0,
                    difference,
                    notes,
                    openedAt: activeSession.opened_at,
                    closedAt: new Date().toISOString(),
                    openedBy: openerName,
                    closedBy: userData?.full_name || 'Usuario Actual'
                });

                if (downloadPdf) {
                    doc.save(`Cierre_Caja_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
                }

                if (printReport) {
                    doc.autoPrint();
                    window.open(doc.output('bloburl'), '_blank');
                }
            }

            if (sendEmail && userData?.store_id) {
                try {
                    const { error } = await supabase.functions.invoke('send-daily-report', {
                        body: { store_id: userData.store_id, report_type: 'daily' }
                    });
                    if (error) throw error;
                    toast({ title: 'Reporte enviado', description: 'Se ha enviado el reporte por correo electrónico.' });
                } catch (e) {
                    console.error("Error sending email", e);
                    toast({ variant: 'destructive', title: 'Error enviando correo', description: 'No se pudo enviar el reporte por correo.' });
                }
            }

            onClose();
            setActualCash('');
            setNotes('');

        } catch (error: any) {
            console.error('Error Closing:', error);
            toast({
                variant: 'destructive',
                title: 'Error al cerrar caja',
                description: error.message || 'Ocurrió un error al procesar el cierre.'
            });
        }
    };

    if (!activeSession && isOpen) {
        // Fallback if accessed without session (should be blocked by UI but just in case)
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <CashCountDialog
                isOpen={showCashCount}
                onClose={() => setShowCashCount(false)}
                onConfirm={(total) => setActualCash(total.toString())}
            />
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Lock className="h-6 w-6 text-primary" />
                        Control de Caja (Sesión Actual)
                    </DialogTitle>
                    <DialogDescription>
                        Aperturado el: {activeSession ? format(new Date(activeSession.opened_at), 'dd/MM/yyyy hh:mm a', { locale: es }) : '-'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="close" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="close">Cierre Actual</TabsTrigger>
                        <TabsTrigger value="history">Historial de Cierres</TabsTrigger>
                    </TabsList>

                    <TabsContent value="close" className="pt-4">
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Left Column: Summary */}
                            <div className="flex-1 space-y-6">
                                <Card>
                                    <CardContent className="pt-6 space-y-4">
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <Calculator className="h-5 w-5" />
                                            Resumen del Sistema
                                        </h3>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between font-medium text-primary">
                                                <span>Fondo/Caja Inicial:</span>
                                                <span>RD$ {stats.initialCash.toLocaleString()}</span>
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ventas en Efectivo:</span>
                                                <span className="font-medium">RD$ {stats.cashSales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ventas Tarjeta:</span>
                                                <span className="font-medium">RD$ {stats.cardSales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-green-600">
                                                <span>(+) Entradas de Caja:</span>
                                                <span className="font-medium">RD$ {stats.deposits.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-red-600">
                                                <span>(-) Salidas de Caja:</span>
                                                <span className="font-medium">RD$ {stats.withdrawals.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <div className="bg-muted p-4 rounded-lg space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-lg">Efectivo Total en Caja:</span>
                                                <span className="font-bold text-2xl text-primary">
                                                    RD$ {stats.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <Separator className="bg-primary/20" />
                                            <div className="flex justify-between text-sm pt-1">
                                                <span className="text-muted-foreground">Dejar en Caja (Fondo):</span>
                                                <span className="font-medium">RD$ {stats.initialCash.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-semibold text-blue-600">
                                                <span>A Retirar / Depositar:</span>
                                                <span>RD$ {stats.cashToWithdraw.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column: Action */}
                            <div className="flex-1 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="actualCash" className="text-lg">Conteo Físico de Efectivo</Label>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowCashCount(true)}
                                            className="gap-2"
                                        >
                                            <Calculator className="h-4 w-4" />
                                            Conteo Detallado
                                        </Button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xl">$</span>
                                        <Input
                                            id="actualCash"
                                            type="number"
                                            placeholder="0.00"
                                            className="pl-8 h-14 text-2xl font-bold"
                                            value={actualCash}
                                            onChange={(e) => setActualCash(e.target.value)}
                                        />
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                        Cuente TODO el efectivo en la caja (incluyendo el fondo inicial).
                                    </p>
                                </div>

                                {actualCash && (
                                    <div className={`p-4 rounded-lg border ${difference === 0 ? 'bg-green-50 border-green-200' : difference > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold">Diferencia:</span>
                                            <span className={`font-bold text-lg ${difference === 0 ? 'text-green-700' : difference > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                                                RD$ {Math.abs(difference).toLocaleString()} {difference > 0 ? '(Sobrante)' : difference < 0 ? '(Faltante)' : ''}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground text-right w-full">
                                            {difference === 0 ? 'Cuadre Perfecto' :
                                                difference < 0 ? 'Faltante de dinero' : 'Sobrante de dinero'}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Notas del Cierre</Label>
                                    <Input
                                        placeholder="Opcional: Explicación de diferencias..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>

                                <Separator className="my-4" />

                                <div className="flex gap-4 mb-4 flex-wrap justify-between bg-muted/30 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="print-opt" checked={printReport} onCheckedChange={(c) => setPrintReport(!!c)} />
                                        <Label htmlFor="print-opt" className="cursor-pointer text-sm font-medium">Imprimir Reporte</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="pdf-opt" checked={downloadPdf} onCheckedChange={(c) => setDownloadPdf(!!c)} />
                                        <Label htmlFor="pdf-opt" className="cursor-pointer text-sm font-medium">Descargar PDF</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="email-opt" checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} />
                                        <Label htmlFor="email-opt" className="cursor-pointer text-sm font-medium">Enviar Correo</Label>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
                                    <Button
                                        className="flex-1"
                                        size="lg"
                                        disabled={!actualCash || closeSession.isPending}
                                        onClick={handleCloseDay}
                                    >
                                        {closeSession.isPending ? 'Cerrando...' : 'Cerrar Caja'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <Card>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[400px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha Cierre</TableHead>
                                                <TableHead>Responsable</TableHead>
                                                <TableHead className="text-right">Fondo</TableHead>
                                                <TableHead className="text-right">Esperado</TableHead>
                                                <TableHead className="text-right">Real</TableHead>
                                                <TableHead className="text-right">Diferencia</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.filter(h => h.status === 'closed').length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        No hay cierres registrados.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                history.filter(h => h.status === 'closed').map((closing: any) => (
                                                    <TableRow key={closing.id}>
                                                        <TableCell className="font-medium">
                                                            {closing.closed_at ? format(new Date(closing.closed_at), 'dd/MM/yyyy hh:mm a', { locale: es }) : '-'}
                                                        </TableCell>
                                                        <TableCell>{closing.opener?.full_name || 'N/A'}</TableCell>
                                                        <TableCell className="text-right">
                                                            RD$ {(closing.initial_cash || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            RD$ {(closing.expected_cash || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            RD$ {(closing.actual_cash || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-bold ${(closing.difference || 0) === 0 ? 'text-green-600' :
                                                            (closing.difference || 0) > 0 ? 'text-blue-600' : 'text-red-600'
                                                            }`}>
                                                            {(closing.difference || 0) > 0 ? '+' : ''}
                                                            RD$ {(closing.difference || 0).toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default CloseDayDialog;
