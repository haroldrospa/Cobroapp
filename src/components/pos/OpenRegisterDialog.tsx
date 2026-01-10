import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Wallet } from 'lucide-react';
import { useOpenSession } from '@/hooks/useCashSession';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface OpenRegisterDialogProps {
    isOpen: boolean;
}

const OpenRegisterDialog: React.FC<OpenRegisterDialogProps> = ({ isOpen }) => {
    const [initialCash, setInitialCash] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState(false);
    const openSession = useOpenSession();
    const { toast } = useToast();

    // If locally successful, force close visually even if parent prop hasn't updated yet
    if (isSuccess) return null;

    const handleOpenRegister = async () => {
        const amount = parseFloat(initialCash);
        if (isNaN(amount) || amount < 0) {
            toast({
                title: 'Monto inválido',
                description: 'Por favor ingrese un monto inicial válido.',
                variant: 'destructive'
            });
            return;
        }

        try {
            await openSession.mutateAsync({ initialCash: amount });
            toast({
                title: 'Caja Aperturada',
                description: `Caja iniciada con RD$ ${amount.toLocaleString()}`
            });
            setIsSuccess(true);

            // Success handled by hook optimistic update


        } catch (error: any) {
            console.error(error);
            let description = error.message || 'No se pudo aperturar la caja. Intente nuevamente.';

            if (error?.code === '42P01' || error?.message?.includes('relation "public.cash_sessions" does not exist')) {
                description = "Error Crítico: Faltan tablas en la base de datos (cash_sessions). Contacte al administrador para ejecutar las migraciones pendientes.";
            }

            toast({
                title: 'Error de Apertura',
                description: description,
                variant: 'destructive',
                duration: 5000
            });
        }
    };

    return (
        <Dialog open={isOpen}>
            <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-primary" />
                        Apertura de Caja
                    </DialogTitle>
                    <DialogDescription>
                        Para comenzar a facturar, debe iniciar la caja indicando el monto base disponible.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Caja Cerrada</AlertTitle>
                        <AlertDescription>
                            No hay un turno activo. Ingrese el efectivo inicial para comenzar.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="initial-cash">Monto Inicial en Efectivo</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="initial-cash"
                                type="number"
                                placeholder="0.00"
                                className="pl-7 text-lg font-semibold"
                                value={initialCash}
                                onChange={(e) => setInitialCash(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleOpenRegister();
                                }}
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Este es el dinero que se dejará en caja para cambio.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleOpenRegister}
                        disabled={!initialCash || openSession.isPending}
                    >
                        {openSession.isPending ? 'Abriendo...' : 'Abrir Caja'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default OpenRegisterDialog;
