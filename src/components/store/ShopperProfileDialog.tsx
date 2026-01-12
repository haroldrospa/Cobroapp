import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Save, User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShopperProfile } from '@/hooks/useShopperProfile';

interface ShopperProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentProfile: ShopperProfile | null;
    onSave: (profile: ShopperProfile) => void;
}

export const ShopperProfileDialog: React.FC<ShopperProfileDialogProps> = ({
    open,
    onOpenChange,
    currentProfile,
    onSave,
}) => {
    const { register, handleSubmit, setValue, reset, watch } = useForm<ShopperProfile>({
        defaultValues: {
            name: '',
            phone: '',
            email: '',
            address: '',
            locationUrl: '',
            notes: ''
        }
    });

    const { toast } = useToast();
    const [gettingLocation, setGettingLocation] = React.useState(false);

    // Load profile into form when opening
    useEffect(() => {
        if (open && currentProfile) {
            reset(currentProfile);
        }
    }, [open, currentProfile, reset]);

    const onSubmit = (data: ShopperProfile) => {
        onSave(data);
        onOpenChange(false);
        toast({
            title: "Perfil Guardado",
            description: "Tus datos se usarán para agilizar tus pedidos.",
        });
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast({
                title: "Error",
                description: "Tu navegador no soporta geolocalización.",
                variant: "destructive"
            });
            return;
        }

        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const coords = `${latitude}, ${longitude}`;
                const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

                setValue('locationUrl', mapLink);
                setGettingLocation(false);
                toast({
                    title: "Ubicación obtenida",
                    description: "Coordenadas guardadas correctamente.",
                });
            },
            (error) => {
                console.error('[Geolocation Error]', error);
                setGettingLocation(false);

                let errorMessage = "No pudimos obtener tu ubicación.";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Permiso denegado. Activa la ubicación en tu navegador.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Ubicación no disponible. Verifica tu GPS.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Tiempo agotado. Intenta nuevamente.";
                        break;
                }

                toast({
                    title: "Error de ubicación",
                    description: errorMessage,
                    variant: "destructive"
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,        // 15 seconds timeout
                maximumAge: 0          // Don't use cached position
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Mi Perfil de Compras
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre y Apellido *</Label>
                        <Input id="name" {...register('name', { required: true })} placeholder="Ej: Juan Pérez" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono *</Label>
                            <Input id="phone" {...register('phone', { required: true })} placeholder="Celular / WhatsApp" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email (Opcional)</Label>
                            <Input id="email" {...register('email')} type="email" placeholder="correo@ejemplo.com" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Dirección Escrita *</Label>
                        <Textarea
                            id="address"
                            {...register('address', { required: true })}
                            placeholder="Ej: Calle Principal #12, Frente al parque..."
                            className="min-h-[80px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="locationUrl">Ubicación GPS / Link Google Maps</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={handleGetLocation}
                                disabled={gettingLocation}
                                className="h-6 text-xs"
                            >
                                {gettingLocation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                                Usar mi ubicación
                            </Button>
                        </div>
                        <Input
                            id="locationUrl"
                            {...register('locationUrl')}
                            placeholder="https://maps.google.com/..."
                            readOnly
                            className="bg-muted text-muted-foreground text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Haz clic en "Usar mi ubicación" para guardar tus coordenadas exactas automáticamente.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Nota para entregas (Opcional)</Label>
                        <Input id="notes" {...register('notes')} placeholder="Ej: Tocar timbre, dejar en recepción..." />
                    </div>

                    <DialogFooter>
                        <Button type="submit" className="w-full">
                            <Save className="h-4 w-4 mr-2" />
                            Guardar Mis Datos
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
