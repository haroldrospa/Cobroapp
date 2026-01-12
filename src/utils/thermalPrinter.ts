import { isElectron, printToSystemPrinter } from './electronPrinter';

export interface ThermalPrinterConfig {
  paperWidth: '80mm' | '50mm';
  connected: boolean;
  deviceName?: string;
}

class ThermalPrinterManager {
  private port: any = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private currentDeviceName: string = '';

  isSupported(): boolean {
    return 'serial' in navigator;
  }

  async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Serial API no está soportada en este navegador. Usa Chrome, Edge o Opera.' };
    }

    try {
      if (!window.isSecureContext) {
        return {
          success: false,
          error: 'La aplicación debe ejecutarse en HTTPS para usar impresoras USB. Localhost está permitido para pruebas.'
        };
      }

      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });

      this.writer = this.port.writable?.getWriter() || null;
      this.reader = this.port.readable?.getReader() || null;

      const info = this.port.getInfo();
      const deviceName = `USB ${info.usbVendorId || 'Device'}`;
      this.currentDeviceName = deviceName;

      return { success: true, deviceName };
    } catch (error: any) {
      console.error('Error connecting to printer:', error);

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

  async tryReconnect(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) {
        console.log("Intentando reconexión automática al primer puerto disponible...");
        this.port = ports[0];
        try { await this.port.close(); } catch (e) { }
        await this.port.open({ baudRate: 9600 });
        this.writer = this.port.writable?.getWriter() || null;
        this.reader = this.port.readable?.getReader() || null;
        const info = this.port.getInfo();
        this.currentDeviceName = `USB ${info.usbVendorId || 'Device'}`;
        console.log("Reconexión exitosa:", this.currentDeviceName);
        return true;
      }
    } catch (e) {
      console.error("Auto-reconnect failed:", e);
    }
    return false;
  }

  setConnectedPrinter(name: string) {
    this.currentDeviceName = name;
  }

  async disconnect(): Promise<void> {
    try {
      this.currentDeviceName = '';
      if (this.reader) { await this.reader.cancel(); this.reader.releaseLock(); this.reader = null; }
      if (this.writer) { await this.writer.close(); this.writer = null; }
      if (this.port) { await this.port.close(); this.port = null; }
    } catch (error) { console.error('Error disconnecting:', error); }
  }

  isConnected(): boolean {
    return !!this.currentDeviceName || (this.port !== null && this.writer !== null);
  }

  private async sendBytes(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('Impresora no conectada');
    await this.writer.write(data);
  }

  private ESC = 0x1b;
  private GS = 0x1d;
  private LF = 0x0a;

  private initPrinter(): Uint8Array { return new Uint8Array([this.ESC, 0x40]); }
  private setAlign(align: 0 | 1 | 2): Uint8Array { return new Uint8Array([this.ESC, 0x61, align]); }
  private setTextSize(width: number, height: number): Uint8Array { return new Uint8Array([this.GS, 0x21, ((width - 1) << 4) | (height - 1)]); }
  private setBold(enabled: boolean): Uint8Array { return new Uint8Array([this.ESC, 0x45, enabled ? 1 : 0]); }
  private lineFeed(lines: number = 1): Uint8Array { return new Uint8Array(new Array(lines).fill(this.LF)); }
  private cutPaper(): Uint8Array { return new Uint8Array([this.GS, 0x56, 0x00]); }
  private textToBytes(text: string): Uint8Array { return new TextEncoder().encode(text); }

  private mergeBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
    return result;
  }

  private printBarcode(data: string): Uint8Array[] {
    const commands: Uint8Array[] = [];
    const barcodeData = this.textToBytes(data);
    commands.push(new Uint8Array([this.GS, 0x6B, 73, barcodeData.length]));
    commands.push(barcodeData);
    commands.push(new Uint8Array([this.GS, 0x48, 2]));
    commands.push(new Uint8Array([this.GS, 0x68, 60]));
    commands.push(new Uint8Array([this.GS, 0x77, 2]));
    return commands;
  }

  private async getImageCommands(url: string, maxWidth: number): Promise<Uint8Array | null> {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const w8 = Math.ceil(width / 8) * 8;

      const canvas = document.createElement('canvas');
      canvas.width = w8;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w8, height);
      ctx.drawImage(img, 0, 0, width, height);

      const imgData = ctx.getImageData(0, 0, w8, height);
      const data = imgData.data;

      const xL = (w8 / 8) % 256;
      const xH = Math.floor((w8 / 8) / 256);
      const yL = height % 256;
      const yH = Math.floor(height / 256);

      const buffer = [];
      buffer.push(0x1D, 0x76, 0x30, 0, xL, xH, yL, yH);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < w8; x += 8) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const px = (y * w8 + x + b) * 4;
            const gray = data[px] * 0.299 + data[px + 1] * 0.587 + data[px + 2] * 0.114;
            if (gray < 128) {
              byte |= (1 << (7 - b));
            }
          }
          buffer.push(byte);
        }
      }
      return new Uint8Array(buffer);
    } catch (e) {
      console.error("Error processing logo image:", e);
      return null;
    }
  }

  private generateInvoiceHTML(data: any, paperWidth: string): string {
    const items = data.items || [];
    const rows = items.map((item: any) => `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
        <span style="flex: 1">${item.quantity} x ${item.product?.name || item.name || 'Item'}</span>
        <span>$${(item.total || 0).toFixed(2)}</span>
      </div>
    `).join('');

    return `
      <html>
        <body style="font-family: monospace; width: ${paperWidth}; margin: 0; padding: 5px;">
          <div style="text-align: center;">
            ${data.companyInfo.logo_url ? `<img src="${data.companyInfo.logo_url}" style="max-width: 80%; max-height: 100px; object-fit: contain;"/>` : ''}
            <h2 style="margin: 5px 0 0 0;">${data.companyInfo.name || 'FACTURA'}</h2>
            <div style="font-size: 12px;">${data.companyInfo.phone || ''}</div>
            <div style="font-size: 12px;">${data.companyInfo.address || ''}</div>
            <hr/>
          </div>
          
          <div style="text-align: center; margin: 10px 0;">
            <div><strong>NCF</strong></div>
            <div style="font-size: 14px; font-weight: bold;">${data.invoiceNumber}</div>
            <div>${new Date().toLocaleDateString()}</div>
          </div>
          
          <hr/>
          
          <div style="margin: 10px 0;">
            ${rows}
          </div>
          
          <hr/>
          
          <div style="text-align: right; font-weight: bold; font-size: 14px;">
            <div>Subtotal: $${(data.subtotal || 0).toFixed(2)}</div>
            <div>ITBIS: $${(data.tax || 0).toFixed(2)}</div>
            <div style="font-size: 18px;">TOTAL: $${(data.total || 0).toFixed(2)}</div>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 12px;">Gracias por su preferencia</div>
        </body>
      </html>
    `;
  }

  private generateTestHTML(paperWidth: string): string {
    return `<html><body>TEST</body></html>`;
  }

  async printTest(paperWidth: '80mm' | '50mm'): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      const reconnected = await this.tryReconnect();
      if (!reconnected) {
        const conn = await this.connect();
        if (!conn.success) return { success: false, error: conn.error || 'No se pudo conectar.' };
      }
    }
    if (isElectron() && !this.writer) return await printToSystemPrinter(this.currentDeviceName, this.generateTestHTML(paperWidth), paperWidth);

    try {
      const commands: Uint8Array[] = [];
      commands.push(this.initPrinter());
      commands.push(this.setAlign(1));
      commands.push(this.setBold(true));
      commands.push(this.setTextSize(1, 2));
      commands.push(this.textToBytes("IMPRESION DE PRUEBA"));
      commands.push(this.lineFeed(2));
      commands.push(this.cutPaper());
      await this.sendBytes(this.mergeBytes(...commands));
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  }

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
      const reconnected = await this.tryReconnect();
      if (!reconnected) {
        const conn = await this.connect();
        if (!conn.success) return { success: false, error: conn.error || 'No se pudo conectar.' };
      }
    }

    if (isElectron() && !this.writer) {
      const html = this.generateInvoiceHTML(data, paperWidth);
      return await printToSystemPrinter(this.currentDeviceName, html, paperWidth);
    }

    try {
      const commands: Uint8Array[] = [];
      // Use 32 characters for ALL paper widths - ultra conservative
      const widthChars = 32;
      const maxImgWidth = 350;
      const lineSeparator = '-'.repeat(widthChars);

      const formatTwoColumns = (left: string, right: string, width: number) => {
        const maxLeftLength = width - right.length - 1;
        const leftText = left.length > maxLeftLength ? left.substring(0, maxLeftLength) : left;
        const spaceCount = width - leftText.length - right.length;
        const spaces = spaceCount > 0 ? ' '.repeat(spaceCount) : ' ';
        return leftText + spaces + right;
      };

      commands.push(this.initPrinter());
      commands.push(this.setAlign(1));

      if (data.companyInfo.logo_url) {
        try {
          const imageBytes = await this.getImageCommands(data.companyInfo.logo_url, maxImgWidth);
          if (imageBytes) {
            commands.push(imageBytes);
            commands.push(this.lineFeed(1));
          }
        } catch (e) { console.warn("Could not print logo:", e); }
      }

      commands.push(this.setTextSize(2, 1));
      commands.push(this.setBold(true));
      commands.push(this.textToBytes(data.companyInfo.name || 'MI EMPRESA'));
      commands.push(this.lineFeed(1));

      commands.push(this.setTextSize(1, 1));
      commands.push(this.setBold(false));

      if (data.companyInfo.rnc) {
        commands.push(this.textToBytes(`RNC: ${data.companyInfo.rnc}`));
        commands.push(this.lineFeed(1));
      }
      if (data.companyInfo.phone) {
        commands.push(this.textToBytes(`${data.companyInfo.phone}`));
        commands.push(this.lineFeed(1));
      }
      if (data.companyInfo.address) {
        commands.push(this.textToBytes(data.companyInfo.address));
        commands.push(this.lineFeed(1));
      }

      commands.push(this.textToBytes(lineSeparator));
      commands.push(this.lineFeed(1));

      commands.push(this.setBold(true));
      commands.push(this.textToBytes("NCF"));
      commands.push(this.lineFeed(1));

      commands.push(this.setTextSize(1, 2));
      const cleanNCF = data.invoiceNumber.replace(/^#?FAC-/, '').replace(/^#?NCF-/, '');
      commands.push(this.textToBytes(cleanNCF));
      commands.push(this.lineFeed(1));

      commands.push(this.setTextSize(1, 1));
      commands.push(this.setBold(false));
      commands.push(this.textToBytes(new Date().toLocaleDateString('es-DO')));
      commands.push(this.lineFeed(1));

      commands.push(this.textToBytes(lineSeparator));
      commands.push(this.lineFeed(1));

      commands.push(this.setAlign(0));

      for (const item of data.items) {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        const itemTotal = itemPrice * itemQty;

        const priceStr = `${itemTotal.toFixed(2)}`;
        const namePart = `${item.name || 'Producto'} x${itemQty}`;
        commands.push(this.textToBytes(formatTwoColumns(namePart, priceStr, widthChars)));
        commands.push(this.lineFeed(1));
      }

      commands.push(this.textToBytes(lineSeparator));
      commands.push(this.lineFeed(1));

      const subtotalVal = parseFloat(data.subtotal) || 0;
      const taxVal = parseFloat(data.tax) || 0;
      const totalVal = parseFloat(data.total) || 0;

      commands.push(this.textToBytes(formatTwoColumns("Subtotal:", subtotalVal.toFixed(2), widthChars)));
      commands.push(this.lineFeed(1));

      commands.push(this.textToBytes(formatTwoColumns("ITBIS (18%):", taxVal.toFixed(2), widthChars)));
      commands.push(this.lineFeed(1));

      commands.push(this.textToBytes(lineSeparator));
      commands.push(this.lineFeed(1));

      commands.push(this.setBold(true));
      commands.push(this.textToBytes(formatTwoColumns("TOTAL:", totalVal.toFixed(2), widthChars)));
      commands.push(this.setBold(false));
      commands.push(this.lineFeed(1));

      if (data.change && data.change > 0) {
        const changeVal = parseFloat(data.change) || 0;
        commands.push(this.textToBytes(formatTwoColumns("CAMBIO:", changeVal.toFixed(2), widthChars)));
        commands.push(this.lineFeed(1));
      }
      commands.push(this.lineFeed(1));

      commands.push(this.setAlign(1));
      commands.push(this.textToBytes(lineSeparator));
      commands.push(this.lineFeed(1));

      if (data.companyInfo.invoice_footer_text) {
        commands.push(this.textToBytes(data.companyInfo.invoice_footer_text));
        commands.push(this.lineFeed(1));
      } else {
        commands.push(this.textToBytes("Gracias por su preferencia"));
        commands.push(this.lineFeed(1));
      }

      commands.push(this.textToBytes("Terminos de pago: 30 dias"));
      commands.push(this.lineFeed(2));

      const barcodeValue = cleanNCF.replace(/[^a-zA-Z0-9]/g, '');
      if (barcodeValue) {
        const barcodeCmds = this.printBarcode(barcodeValue);
        barcodeCmds.forEach(cmd => commands.push(cmd));
        commands.push(this.lineFeed(1));
        commands.push(this.textToBytes(barcodeValue));
        commands.push(this.lineFeed(2));
      }

      commands.push(this.cutPaper());
      await this.sendBytes(this.mergeBytes(...commands));
      return { success: true };
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      return { success: false, error: error.message || 'Error al imprimir factura' };
    }
  }
}

export const thermalPrinter = new ThermalPrinterManager();
