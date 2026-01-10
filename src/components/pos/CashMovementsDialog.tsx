import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownCircle, ArrowUpCircle, DollarSign } from 'lucide-react';
import { useCashMovements, useCreateCashMovement } from '@/hooks/useCashMovements';
import { useActiveSession } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CashMovementsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const CashMovementsDialog: React.FC<CashMovementsDialogProps> = ({ isOpen, onClose }) => {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [activeTab, setActiveTab] = useState('new');

    // Get Active Session to filter history
    const { data: activeSession } = useActiveSession();

    // Fetch recent movements (from the start of the session day essentially)
    // We fetch broadly based on day, then refine filter by session time in render
    const sessionStartDate = activeSession?.opened_at ? new Date(activeSession.opened_at) : new Date();
    // Normalize to start of day for the query to ensure we catch everything, then filter in memory
    const queryDate = new Date(sessionStartDate);
    queryDate.setHours(0, 0, 0, 0);

    const { data: movements = [], isLoading } = useCashMovements(queryDate);

    // Filter movements to only show those belonging to the current session (after opened_at)
    const sessionMovements = movements.filter(m => {
        if (!activeSession?.opened_at) return false;
        return new Date(m.created_at) >= new Date(activeSession.opened_at);
    });

    const createMovement = useCreateCashMovement();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const amountValue = parseFloat(amount);
        if (!amountValue || amountValue <= 0) {
            toast({
                variant: 'destructive',
                title: 'Monto inválido',
                description: 'Por favor ingrese un monto mayor a 0'
            });
            return;
        }

        if (!reason.trim()) {
            toast({
                variant: 'destructive',
                title: 'Razón requerida',
                description: 'Por favor ingrese una descripción del movimiento'
            });
            return;
        }

        try {
            await createMovement.mutateAsync({
                type,
                amount: amountValue,
                reason
            });

            // Toast suppressed by user request
            // toast({
            //     title: 'Movimiento registrado',
            //     description: `Se ha registrado el ${type === 'deposit' ? 'depósito' : 'retiro'} correctamente.`
            // });

            setAmount('');
            setReason('');
            setActiveTab('history'); // Switch to history to show confirmation naturally

        } catch (error: any) {
            console.error(error);
            let description = error.message || 'No se pudo registrar el movimiento.';

            if (error.code === '42P01' || description.includes('does not exist')) {
                description = "Error de Sistema: La tabla 'cash_movements' no existe en la base de datos. Por favor contacte al soporte técnico para aplicar las migraciones necesarias.";
            }

            toast({
                variant: 'destructive',
                title: 'Error de Sistema',
                description: description
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Movimientos de Caja
                    </DialogTitle>
                    <DialogDescription>
                        {activeSession
                            ? `Sesión iniciada: ${format(new Date(activeSession.opened_at), 'hh:mm a')}`
                            : 'Registre entradas y salidas de efectivo manuales'
                        }
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="new">Nuevo Movimiento</TabsTrigger>
                        <TabsTrigger value="history">Historial (Sesión)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="new" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                type="button"
                                variant={type === 'deposit' ? 'default' : 'outline'}
                                className={`h-20 flex flex-col gap-2 ${type === 'deposit' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                onClick={() => setType('deposit')}
                            >
                                <ArrowUpCircle className="h-6 w-6" />
                                <span>Entrada / Depósito</span>
                            </Button>
                            <Button
                                type="button"
                                variant={type === 'withdrawal' ? 'default' : 'outline'}
                                className={`h-20 flex flex-col gap-2 ${type === 'withdrawal' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                onClick={() => setType('withdrawal')}
                            >
                                <ArrowDownCircle className="h-6 w-6" />
                                <span>Salida / Retiro</span>
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto (RD$)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-7 text-lg font-bold"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reason">Motivo / Descripción</Label>
                            <Input
                                id="reason"
                                placeholder={type === 'deposit' ? "Ej. Pago deuda Cliente X" : "Ej. Compra de agua/hielo"}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full mt-4"
                            onClick={handleSubmit}
                            disabled={createMovement.isPending}
                        >
                            {createMovement.isPending ? 'Registrando...' : 'Registrar Movimiento'}
                        </Button>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="border rounded-md max-h-[300px] overflow-y-auto mt-4">
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
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell>
                                        </TableRow>
                                    ) : sessionMovements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No hay movimientos en esta sesión.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sessionMovements.map((mov) => (
                                            <TableRow key={mov.id}>
                                                <TableCell className="text-xs">
                                                    {format(new Date(mov.created_at), 'hh:mm a')}
                                                </TableCell>
                                                <TableCell>
                                                    {mov.type === 'deposit' ? (
                                                        <span className="flex items-center text-green-600 text-xs font-bold">
                                                            <ArrowUpCircle className="h-3 w-3 mr-1" /> Entrada
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-red-600 text-xs font-bold">
                                                            <ArrowDownCircle className="h-3 w-3 mr-1" /> Salida
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">{mov.reason}</TableCell>
                                                <TableCell className="text-right font-bold text-xs">
                                                    RD$ {mov.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default CashMovementsDialog;
