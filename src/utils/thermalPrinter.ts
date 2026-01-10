// Thermal Printer Utility using Web Serial API for ESC/POS printers

export interface ThermalPrinterConfig {
  paperWidth: '80mm' | '50mm';
  connected: boolean;
  deviceName?: string;
}

class ThermalPrinterManager {
  private port: any = null; // SerialPort from Web Serial API
  private writer: WritableStreamDefaultWriter | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  
  // Check if Web Serial API is supported
  isSupported(): boolean {
    return 'serial' in navigator;
  }

  // Connect to thermal printer
  async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Serial API no está soportada en este navegador. Usa Chrome, Edge o Opera.' };
    }

    try {
      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        return { 
          success: false, 
          error: 'La aplicación debe ejecutarse en HTTPS para usar impresoras USB. Localhost está permitido para pruebas.' 
        };
      }

      // Request any available serial port
      // This allows users to select any USB thermal printer, regardless of manufacturer
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      
      this.writer = this.port.writable?.getWriter() || null;
      this.reader = this.port.readable?.getReader() || null;
      
      const info = this.port.getInfo();
      const deviceName = `USB ${info.usbVendorId || 'Device'}`;
      
      return { success: true, deviceName };
    } catch (error: any) {
      console.error('Error connecting to printer:', error);
      
      // Handle specific error types
      if (error.name === 'NotFoundError') {
        return { success: false, error: 'No seleccionaste ninguna impresora.' };
      }
      
      if (error.name === 'SecurityError' || error.message?.includes('permissions policy')) {
        return { 
          success: false, 
          error: 'Permisos bloqueados. Asegúrate de que:\n1. Estás usando HTTPS (no HTTP)\n2. Tu navegador soporta Web Serial API (Chrome, Edge, Opera)\n3. No hay extensiones bloqueando el acceso' 
        };
      }
      
      return { success: false, error: error.message || 'Error al conectar con la impresora' };
    }
  }

  // Disconnect from printer
  async disconnect(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Check if printer is connected
  isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  // Send raw bytes to printer
  private async sendBytes(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error('Impresora no conectada');
    }
    await this.writer.write(data);
  }

  // ESC/POS Commands
  private ESC = 0x1b;
  private GS = 0x1d;
  private LF = 0x0a;
  private CR = 0x0d;

  // Initialize printer
  private initPrinter(): Uint8Array {
    return new Uint8Array([this.ESC, 0x40]); // ESC @
  }

  // Set text alignment (0=left, 1=center, 2=right)
  private setAlign(align: 0 | 1 | 2): Uint8Array {
    return new Uint8Array([this.ESC, 0x61, align]);
  }

  // Set text size (1-8)
  private setTextSize(width: number, height: number): Uint8Array {
    const size = ((width - 1) << 4) | (height - 1);
    return new Uint8Array([this.GS, 0x21, size]);
  }

  // Set bold
  private setBold(enabled: boolean): Uint8Array {
    return new Uint8Array([this.ESC, 0x45, enabled ? 1 : 0]);
  }

  // Line feed
  private lineFeed(lines: number = 1): Uint8Array {
    const feeds = new Array(lines).fill(this.LF);
    return new Uint8Array(feeds);
  }

  // Cut paper
  private cutPaper(): Uint8Array {
    return new Uint8Array([this.GS, 0x56, 0x00]); // Full cut
  }

  // Convert string to bytes
  private textToBytes(text: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  }

  // Merge multiple Uint8Arrays
  private mergeBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  // Print test page
  async printTest(paperWidth: '80mm' | '50mm'): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'Impresora no conectada' };
    }

    try {
      const commands: Uint8Array[] = [];
      
      // Initialize
      commands.push(this.initPrinter());
      
      // Header - centered
      commands.push(this.setAlign(1));
      commands.push(this.setTextSize(2, 2));
      commands.push(this.setBold(true));
      commands.push(this.textToBytes('PRUEBA DE IMPRESION'));
      commands.push(this.lineFeed(2));
      
      // Reset size
      commands.push(this.setTextSize(1, 1));
      commands.push(this.setBold(false));
      
      // Paper size info
      commands.push(this.textToBytes(`Tamano: ${paperWidth}`));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes(`Fecha: ${new Date().toLocaleDateString()}`));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes(`Hora: ${new Date().toLocaleTimeString()}`));
      commands.push(this.lineFeed(2));
      
      // Separator line
      commands.push(this.setAlign(0));
      commands.push(this.textToBytes('--------------------------------'));
      commands.push(this.lineFeed(1));
      
      // Test text
      commands.push(this.textToBytes('Texto de prueba:'));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes('abcdefghijklmnopqrstuvwxyz'));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes('0123456789'));
      commands.push(this.lineFeed(2));
      
      // Bold test
      commands.push(this.setBold(true));
      commands.push(this.textToBytes('Texto en Negrita'));
      commands.push(this.setBold(false));
      commands.push(this.lineFeed(2));
      
      // Sizes test
      commands.push(this.setAlign(1));
      commands.push(this.setTextSize(2, 1));
      commands.push(this.textToBytes('Texto Grande'));
      commands.push(this.lineFeed(1));
      commands.push(this.setTextSize(1, 1));
      commands.push(this.lineFeed(1));
      
      // Footer
      commands.push(this.setAlign(1));
      commands.push(this.textToBytes('Impresion exitosa!'));
      commands.push(this.lineFeed(3));
      
      // Cut paper
      commands.push(this.cutPaper());
      
      // Merge and send all commands
      const allCommands = this.mergeBytes(...commands);
      await this.sendBytes(allCommands);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error printing test:', error);
      return { success: false, error: error.message || 'Error al imprimir' };
    }
  }

  // Print invoice
  async printInvoice(data: {
    companyInfo: any;
    invoiceNumber: string;
    items: any[];
    subtotal: number;
    tax: number;
    total: number;
    customer?: any;
    paymentMethod: string;
    change?: number;
  }, paperWidth: '80mm' | '50mm'): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'Impresora no conectada' };
    }

    try {
      const commands: Uint8Array[] = [];
      const isSmall = paperWidth === '50mm';
      
      // Initialize
      commands.push(this.initPrinter());
      
      // Company name - centered
      commands.push(this.setAlign(1));
      commands.push(this.setTextSize(isSmall ? 1 : 2, isSmall ? 1 : 2));
      commands.push(this.setBold(true));
      commands.push(this.textToBytes(data.companyInfo.name || 'MI EMPRESA'));
      commands.push(this.lineFeed(1));
      commands.push(this.setTextSize(1, 1));
      commands.push(this.setBold(false));
      
      // Company info
      if (data.companyInfo.rnc) {
        commands.push(this.textToBytes(`RNC: ${data.companyInfo.rnc}`));
        commands.push(this.lineFeed(1));
      }
      if (data.companyInfo.phone) {
        commands.push(this.textToBytes(`Tel: ${data.companyInfo.phone}`));
        commands.push(this.lineFeed(1));
      }
      if (data.companyInfo.address) {
        commands.push(this.textToBytes(data.companyInfo.address));
        commands.push(this.lineFeed(1));
      }
      commands.push(this.lineFeed(1));
      
      // Invoice number
      commands.push(this.setBold(true));
      commands.push(this.textToBytes(`FACTURA: ${data.invoiceNumber}`));
      commands.push(this.setBold(false));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes(`Fecha: ${new Date().toLocaleString()}`));
      commands.push(this.lineFeed(1));
      
      // Customer info
      if (data.customer) {
        commands.push(this.textToBytes(`Cliente: ${data.customer.name}`));
        commands.push(this.lineFeed(1));
      }
      
      // Separator
      commands.push(this.setAlign(0));
      commands.push(this.textToBytes(isSmall ? '--------------------' : '--------------------------------'));
      commands.push(this.lineFeed(1));
      
      // Items header
      commands.push(this.setBold(true));
      if (isSmall) {
        commands.push(this.textToBytes('Cant Producto   Total'));
      } else {
        commands.push(this.textToBytes('Cant  Producto        P.Unit  Total'));
      }
      commands.push(this.lineFeed(1));
      commands.push(this.setBold(false));
      commands.push(this.textToBytes(isSmall ? '--------------------' : '--------------------------------'));
      commands.push(this.lineFeed(1));
      
      // Items
      for (const item of data.items) {
        const qty = item.quantity.toString().padEnd(4);
        const name = (item.product?.name || 'Producto').substring(0, isSmall ? 10 : 14).padEnd(isSmall ? 10 : 14);
        const total = `$${item.total.toFixed(2)}`.padStart(isSmall ? 6 : 8);
        
        if (isSmall) {
          commands.push(this.textToBytes(`${qty} ${name} ${total}`));
        } else {
          const price = `$${item.unit_price.toFixed(2)}`.padStart(6);
          commands.push(this.textToBytes(`${qty} ${name} ${price} ${total}`));
        }
        commands.push(this.lineFeed(1));
      }
      
      // Separator
      commands.push(this.textToBytes(isSmall ? '--------------------' : '--------------------------------'));
      commands.push(this.lineFeed(1));
      
      // Totals
      commands.push(this.setAlign(2));
      commands.push(this.textToBytes(`Subtotal: $${data.subtotal.toFixed(2)}`));
      commands.push(this.lineFeed(1));
      commands.push(this.textToBytes(`ITBIS:    $${data.tax.toFixed(2)}`));
      commands.push(this.lineFeed(1));
      commands.push(this.setBold(true));
      commands.push(this.setTextSize(isSmall ? 1 : 2, isSmall ? 1 : 1));
      commands.push(this.textToBytes(`TOTAL: $${data.total.toFixed(2)}`));
      commands.push(this.setTextSize(1, 1));
      commands.push(this.setBold(false));
      commands.push(this.lineFeed(2));
      
      // Payment info
      commands.push(this.setAlign(0));
      commands.push(this.textToBytes(`Metodo de pago: ${data.paymentMethod}`));
      commands.push(this.lineFeed(1));
      if (data.change && data.change > 0) {
        commands.push(this.textToBytes(`Cambio: $${data.change.toFixed(2)}`));
        commands.push(this.lineFeed(1));
      }
      
      // Footer
      commands.push(this.lineFeed(1));
      commands.push(this.setAlign(1));
      commands.push(this.textToBytes('Gracias por su compra!'));
      commands.push(this.lineFeed(3));
      
      // Cut paper
      commands.push(this.cutPaper());
      
      // Merge and send all commands
      const allCommands = this.mergeBytes(...commands);
      await this.sendBytes(allCommands);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      return { success: false, error: error.message || 'Error al imprimir factura' };
    }
  }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinterManager();
