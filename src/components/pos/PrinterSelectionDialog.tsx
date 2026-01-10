import React, { useState } from 'react';
import { Printer, Usb, Bluetooth, Loader2, Monitor, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { thermalPrinter } from '@/utils/thermalPrinter';
import { usePrintSettings } from '@/hooks/usePrintSettings';

interface PrinterSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPrinterSelected: (type: 'usb' | 'bluetooth' | 'browser') => void;
  invoiceContent?: string;
  saleData?: {
    total: number;
    items: any[];
    paymentMethod: string;
    change?: number;
    customer?: any;
    invoiceNumber?: string;
  };
}

export const PrinterSelectionDialog: React.FC<PrinterSelectionDialogProps> = ({
  isOpen,
  onClose,
  onPrinterSelected,
  invoiceContent,
  saleData,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionType, setConnectionType] = useState<'usb' | 'bluetooth' | null>(null);
  const { toast } = useToast();
  const { printSettings, companyInfo: dbCompanyInfo } = usePrintSettings();

  // Print using ESC/POS commands for thermal printers
  const handleUSBThermalPrint = async () => {
    setIsConnecting(true);
    setConnectionType('usb');
    
    try {
      if (!thermalPrinter.isSupported()) {
        toast({
          title: "No soportado",
          description: "Tu navegador no soporta conexión USB. Usa Chrome, Edge o Opera.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Connect to the printer
      const connectResult = await thermalPrinter.connect();
      
      if (!connectResult.success) {
        toast({
          title: "Error de conexión",
          description: connectResult.error || "No se pudo conectar a la impresora",
          variant: "destructive",
        });
        setIsConnecting(false);
        setConnectionType(null);
        return;
      }

      toast({
        title: "Impresora conectada",
        description: `Conectado a: ${connectResult.deviceName}`,
      });

      // If we have sale data, print the invoice with ESC/POS commands
      if (saleData) {
        const companyInfo = {
          name: dbCompanyInfo.name,
          rnc: dbCompanyInfo.rnc,
          phone: dbCompanyInfo.phone,
          address: dbCompanyInfo.address,
        };

        const paperSize = (printSettings.paperSize === '50mm' || printSettings.paperSize === '80mm') 
          ? printSettings.paperSize 
          : '80mm';

        const invoiceData = {
          companyInfo,
          invoiceNumber: saleData.invoiceNumber || 'INV-000001',
          items: saleData.items,
          subtotal: saleData.total - (saleData.items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0)),
          tax: saleData.items.reduce((sum: number, item: any) => sum + (item.tax_amount || 0), 0),
          total: saleData.total,
          customer: saleData.customer,
          paymentMethod: saleData.paymentMethod,
          change: saleData.change,
        };

        const printResult = await thermalPrinter.printInvoice(invoiceData, paperSize);

        if (printResult.success) {
          toast({
            title: "Impresión exitosa",
            description: "La factura se imprimió correctamente",
          });
        } else {
          toast({
            title: "Error al imprimir",
            description: printResult.error || "Error desconocido",
            variant: "destructive",
          });
        }

        // Disconnect after printing
        await thermalPrinter.disconnect();
      }

      onPrinterSelected('usb');
      onClose();
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        toast({
          title: "Conexión cancelada",
          description: "No se seleccionó ninguna impresora",
          variant: "destructive",
        });
      } else {
        console.error('Error connecting to USB printer:', error);
        toast({
          title: "Error de conexión",
          description: "No se pudo conectar a la impresora USB",
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
      setConnectionType(null);
    }
  };

  const handleBluetoothConnect = async () => {
    setIsConnecting(true);
    setConnectionType('bluetooth');
    
    try {
      if (!('bluetooth' in navigator)) {
        toast({
          title: "No soportado",
          description: "Tu navegador no soporta Bluetooth. Usa Chrome, Edge o Opera.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] }],
        optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });
      
      toast({
        title: "Impresora Bluetooth conectada",
        description: `Conectado a: ${device.name}`,
      });
      
      onPrinterSelected('bluetooth');
      onClose();
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        toast({
          title: "Conexión cancelada",
          description: "No se seleccionó ninguna impresora",
          variant: "destructive",
        });
      } else {
        console.error('Error connecting to Bluetooth printer:', error);
        toast({
          title: "Error de conexión",
          description: "No se pudo conectar a la impresora Bluetooth",
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
      setConnectionType(null);
    }
  };

  // This opens the native system print dialog - ONLY for regular printers (laser/inkjet)
  const handleSystemPrint = () => {
    if (invoiceContent) {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(invoiceContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 200);
        };
        
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(invoiceContent);
          iframeDoc.close();
          
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          }, 300);
        }
      }
    }
    onPrinterSelected('browser');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Seleccionar impresora
          </DialogTitle>
          <DialogDescription className="text-sm">
            Elige cómo deseas imprimir tu factura
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-2">
          {/* USB Thermal Printer - Uses ESC/POS commands */}
          <Card className="group hover:shadow-md transition-all duration-200 hover:border-blue-500/50 cursor-pointer border-2 border-blue-500/30 bg-blue-500/5">
            <Button
              variant="ghost"
              className="w-full h-auto py-3 px-3 flex items-center gap-3 hover:bg-transparent"
              onClick={handleUSBThermalPrint}
              disabled={isConnecting}
            >
              <div className="p-2 rounded-md bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                {isConnecting && connectionType === 'usb' ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <Usb className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div className="text-left flex-1">
                <span className="font-semibold text-sm block">🖨️ Impresora Térmica USB</span>
                <span className="text-xs text-muted-foreground">Recomendado para impresoras de ticket (80mm/50mm)</span>
              </div>
            </Button>
          </Card>

          {/* Bluetooth Thermal Printer */}
          <Card className="group hover:shadow-md transition-all duration-200 hover:border-purple-500/50 cursor-pointer">
            <Button
              variant="ghost"
              className="w-full h-auto py-2 px-3 flex items-center gap-2 hover:bg-transparent"
              onClick={handleBluetoothConnect}
              disabled={isConnecting}
            >
              <div className="p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                {isConnecting && connectionType === 'bluetooth' ? (
                  <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                ) : (
                  <Bluetooth className="h-4 w-4 text-purple-500" />
                )}
              </div>
              <div className="text-left flex-1">
                <span className="font-semibold text-sm block">Impresora Bluetooth</span>
                <span className="text-xs text-muted-foreground">Impresoras térmicas inalámbricas</span>
              </div>
            </Button>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Impresoras normales</span>
            </div>
          </div>

          {/* System Printer - For regular printers ONLY */}
          <Card className="group hover:shadow-md transition-all duration-200 hover:border-green-500/50 cursor-pointer">
            <Button
              variant="ghost"
              className="w-full h-auto py-2 px-3 flex items-center gap-2 hover:bg-transparent"
              onClick={handleSystemPrint}
              disabled={isConnecting}
            >
              <div className="p-1.5 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <Monitor className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-left flex-1">
                <span className="font-semibold text-sm block">Impresora Normal (Láser/Tinta)</span>
                <span className="text-xs text-muted-foreground">HP, Epson, Canon, etc. (NO térmicas)</span>
              </div>
            </Button>
          </Card>

          {/* Warning about thermal printers */}
          <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Importante:</strong> Si tienes una impresora térmica (de tickets), usa la opción "Impresora Térmica USB". La opción de impresora normal imprimirá caracteres extraños en térmicas.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose} className="h-9">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
