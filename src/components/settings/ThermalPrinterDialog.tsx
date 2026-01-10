import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Usb, Bluetooth, Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { thermalPrinter } from '@/utils/thermalPrinter';
import { cn } from '@/lib/utils';

interface ThermalPrinterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (deviceName: string) => void;
}

export const ThermalPrinterDialog: React.FC<ThermalPrinterDialogProps> = ({
  open,
  onOpenChange,
  onConnect,
}) => {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'usb' | 'bluetooth' | null>(null);

  const handleConnectUSB = async () => {
    setConnecting(true);
    setActiveMethod('usb');

    try {
      const result = await thermalPrinter.connect();

      if (result.success) {
        onConnect(result.deviceName || 'Impresora USB');
        onOpenChange(false);
        toast({
          title: "¡Conexión Exitosa!",
          description: `Impresora térmica USB conectada: ${result.deviceName}`,
          className: "bg-green-50 text-white border-green-600",
        });
      } else {
        const errorLines = (result.error || "No se pudo conectar con la impresora").split('\n');
        toast({
          title: "Error de Conexión",
          description: (
            <div className="space-y-1">
              {errorLines.map((line, i) => (
                <p key={i} className="text-sm">{line}</p>
              ))}
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al conectar con la impresora",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
      setActiveMethod(null);
    }
  };

  const handleConnectBluetooth = async () => {
    setConnecting(true);
    setActiveMethod('bluetooth');

    try {
      // Check if Web Bluetooth API is available
      if (!('bluetooth' in navigator)) {
        toast({
          title: "Tecnología no soportada",
          description: "Tu navegador no soporta Bluetooth Web. Usa Chrome, Edge u Opera en Android/Windows/Mac.",
          variant: "destructive",
          duration: 6000,
        });
        setConnecting(false);
        setActiveMethod(null);
        return;
      }

      // Request Bluetooth device - Using acceptAllDevices to find more printers
      // Note: We request the printing service in optionalServices
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'battery_service']
      });

      if (device.name) {
        toast({
          title: "Bluetooth Vinculado",
          description: `Dispositivo seleccionado: ${device.name}. Configurando conexión...`,
        });

        // Simulating connection delay for UX
        setTimeout(() => {
          onConnect(device.name);
          onOpenChange(false);
        }, 1000);
      }
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        // User cancelled, standard behavior, no error toast needed
      } else {
        console.error("Bluetooth Error:", error);
        toast({
          title: "Error Bluetooth",
          description: "No se pudo establecer la conexión. Asegúrate que la impresora esté encendida y visible.",
          variant: "destructive",
        });
      }
    } finally {
      setConnecting(false);
      setActiveMethod(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-accent/20 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 z-0 pointer-events-none" />

        <DialogHeader className="px-6 pt-6 pb-2 relative z-10">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 ring-1 ring-primary/20">
            <Printer className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Conectar Impresora
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground/80">
            Elige el método de conexión para tu impresora térmica
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 relative z-10">

          {/* USB Option */}
          <div className="relative group">
            <div className={cn(
              "absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-20 blur transition duration-500",
              "group-hover:opacity-40",
              activeMethod === 'usb' && "opacity-60"
            )} />
            <button
              onClick={handleConnectUSB}
              disabled={connecting}
              className={cn(
                "relative w-full flex items-center gap-4 p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-all duration-200 text-left",
                activeMethod === 'usb' ? "border-emerald-500/50 ring-1 ring-emerald-500/20 bg-emerald-500/5" : "border-border/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                activeMethod === 'usb' ? "bg-emerald-500/20 text-emerald-600" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {activeMethod === 'usb' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Usb className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  Impresora USB
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">RECOMENDADO</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Epson, Star, Citizen, Xprinter, Web Serial API
                </p>
              </div>
              <div className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </button>
          </div>

          {/* Bluetooth Option */}
          <div className="relative group">
            <div className={cn(
              "absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl opacity-20 blur transition duration-500",
              "group-hover:opacity-40",
              activeMethod === 'bluetooth' && "opacity-60"
            )} />
            <button
              onClick={handleConnectBluetooth}
              disabled={connecting}
              className={cn(
                "relative w-full flex items-center gap-4 p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-all duration-200 text-left",
                activeMethod === 'bluetooth' ? "border-blue-500/50 ring-1 ring-blue-500/20 bg-blue-500/5" : "border-border/50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                activeMethod === 'bluetooth' ? "bg-blue-500/20 text-blue-600" : "bg-blue-500/10 text-blue-500"
              )}>
                {activeMethod === 'bluetooth' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Bluetooth className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground flex items-center gap-2">
                  Impresora Bluetooth
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">BETA</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Para móviles, tablets y laptops compatibles
                </p>
              </div>
              <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </button>
          </div>

          <div className="pt-2">
            <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Requisitos para conectar</p>
                  <ul className="text-[10px] text-muted-foreground list-disc pl-3 space-y-0.5">
                    <li>La impresora debe estar encendida y conectada.</li>
                    <li>Usa Google Chrome, Microsoft Edge u Opera.</li>
                    <li>La página debe tener candado de seguridad (HTTPS).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
