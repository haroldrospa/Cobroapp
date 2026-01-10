import React, { useState } from 'react';
import { Printer, FileText, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { useStoreSettings } from '@/hooks/useStoreSettings';

import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { PrinterSelectionDialog } from './PrinterSelectionDialog';

interface PrintOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: {
    total: number;
    items: any[];
    paymentMethod: string;
    change?: number;
    customer?: any;
    customerDebt?: number;
    invoice_number?: string;
    invoiceNumber?: string;
    invoiceType?: string;
    profile?: {
      full_name: string;
    };
  };
}

const PrintOptionsDialog: React.FC<PrintOptionsDialogProps> = ({
  isOpen,
  onClose,
  saleData,
}) => {
  const [emailAddress, setEmailAddress] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPrinterSelection, setShowPrinterSelection] = useState(false);
  const [invoiceContentForPrint, setInvoiceContentForPrint] = useState<string>('');
  const { toast } = useToast();
  const { printSettings, companyInfo: dbCompanyInfo } = usePrintSettings();
  const { settings: storeSettings } = useStoreSettings();

  // Use the invoice number from the sale data (already saved in database)
  const invoiceNumber = saleData.invoice_number || saleData.invoiceNumber || '000001';

  const generateBarcode = (text: string): string => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 5
      });
      return canvas.toDataURL();
    } catch (error) {
      console.error('Error generating barcode:', error);
      return '';
    }
  };

  // Function to generate unified invoice HTML
  const generateInvoiceHTML = (companyInfo: any, logoDataUrl: string, barcodeDataUrl: string) => {
    const invoiceNum = invoiceNumber;
    const logoSize = companyInfo.logoInvoiceSize || companyInfo.logoSize || 120;

    // Get print settings from database hook
    const paperSize = printSettings.paperSize || '80mm';

    // Define styles based on paper size
    const paperStyles = {
      '80mm': {
        width: '72mm', // Reduced slightly to account for non-printable areas
        height: 'auto',
        fontSize: '11px',
        logoSize: logoSize,
        pageMargin: '0mm', // Zero margin for @page, handling padding in body
        pageSize: '80mm auto' // Auto height for continuous roll
      },
      '50mm': {
        width: '45mm', // Reduced slightly
        height: 'auto',
        fontSize: '9px',
        logoSize: Math.floor(logoSize * 0.6),
        pageMargin: '0mm',
        pageSize: '50mm auto'
      },
      'A4': {
        width: '210mm',
        height: '297mm',
        fontSize: '14px',
        logoSize: Math.floor(logoSize * 1.5),
        pageMargin: '10mm',
        pageSize: 'A4 portrait'
      },
      'carta': {
        width: '215.9mm',
        height: '279.4mm',
        fontSize: '14px',
        logoSize: Math.floor(logoSize * 1.5),
        pageMargin: '10mm',
        pageSize: 'letter portrait'
      }
    };

    const styles = paperStyles[paperSize as keyof typeof paperStyles] || paperStyles['80mm'];

    // Calculate Tax and Subtotal
    const items = saleData.items || [];
    const taxAmount = items.reduce((sum, item) => sum + (item.tax_amount || 0), 0) || (saleData.total - (saleData.total / 1.18));
    const subtotalAmount = saleData.total - taxAmount;

    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Factura - ${companyInfo.name}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            @page { 
              size: ${styles.pageSize}; 
              margin: 0mm; 
            }
            @media print {
              html, body { 
                width: ${paperSize === 'A4' || paperSize === 'carta' ? '100%' : styles.width};
                height: 100%;
                margin: 0 auto;
                padding: 0;
              }
              body {
                padding: ${paperSize === 'A4' || paperSize === 'carta' ? '10mm' : '2mm'};
              }
            }
            @media screen {
              body { background: #f0f0f0; padding: 20px; }
            }
            .invoice-container {
              font-family: Arial, sans-serif; 
              width: ${styles.width}; 
              max-width: ${styles.width};
              margin: 0 auto; 
              font-size: ${styles.fontSize}; 
              line-height: 1.4; 
              padding: 5mm;
              background: white;
            }
            .header-section {
              text-align: center; 
              margin-bottom: 3px;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            .logo-img {
              width: ${styles.logoSize}px; 
              height: auto; 
              display: block; 
              margin: 0 auto 2px auto; 
              object-fit: contain;
            }
            .company-name {
              font-size: ${paperSize === '50mm' ? '14px' : paperSize === 'A4' || paperSize === 'carta' ? '24px' : '18px'}; 
              font-weight: bold; 
              margin: 8px 0; 
              text-transform: uppercase; 
              letter-spacing: 1px;
            }
            .company-info {
              font-size: ${paperSize === '50mm' ? '8px' : paperSize === 'A4' || paperSize === 'carta' ? '12px' : '10px'};
              line-height: 1.2;
              margin-bottom: 8px;
            }
            .invoice-header {
              background: #f0f0f0;
              padding: ${paperSize === '50mm' ? '4px' : '8px'};
              margin: ${paperSize === '50mm' ? '5px 0' : '10px 0'};
              border: 1px solid #000;
              text-align: center;
              font-size: ${paperSize === 'A4' || paperSize === 'carta' ? '16px' : 'inherit'};
            }
            .items-table {
              width: 100%;
              margin: ${paperSize === '50mm' ? '5px 0' : '10px 0'};
              border-collapse: collapse;
              font-size: ${paperSize === '50mm' ? '8px' : 'inherit'};
            }
            .items-table th,
            .items-table td {
              padding: ${paperSize === '50mm' ? '2px' : paperSize === 'A4' || paperSize === 'carta' ? '8px 4px' : '4px 2px'};
              text-align: ${paperSize === 'A4' || paperSize === 'carta' ? 'left' : 'left'};
              border-bottom: 1px solid #ddd;
            }
            .totals-section {
              margin-top: ${paperSize === '50mm' ? '5px' : '10px'};
              padding-top: ${paperSize === '50mm' ? '5px' : '10px'};
              border-top: 2px solid #000;
              font-size: ${paperSize === '50mm' ? '9px' : paperSize === 'A4' || paperSize === 'carta' ? '14px' : 'inherit'};
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              padding: ${paperSize === '50mm' ? '2px 0' : '4px 0'};
            }
            .total-final {
              font-weight: bold;
              font-size: ${paperSize === '50mm' ? '11px' : paperSize === 'A4' || paperSize === 'carta' ? '18px' : '14px'};
              margin-top: ${paperSize === '50mm' ? '3px' : '8px'};
              padding-top: ${paperSize === '50mm' ? '3px' : '8px'};
              border-top: 1px solid #000;
            }
            .barcode-section {
              text-align: center;
              margin-top: ${paperSize === '50mm' ? '8px' : '15px'};
              border-top: 1px dashed #000;
              padding-top: ${paperSize === '50mm' ? '5px' : '10px'};
            }
            .barcode-img {
              max-width: 100%;
              height: auto;
              transform: ${paperSize === '50mm' ? 'scale(0.7)' : 'scale(1)'};
            }
            .footer-text {
              text-align: center;
              margin-top: ${paperSize === '50mm' ? '5px' : '10px'};
              font-size: ${paperSize === '50mm' ? '7px' : paperSize === 'A4' || paperSize === 'carta' ? '12px' : '9px'};
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header-section" style="border-bottom: 1px solid #1a1a1a; padding-bottom: 5px; margin-bottom: 5px; text-align: center;">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="logo-img" style="margin: 0 auto -8px auto; display: block;" />` : ''}
              <div class="company-name" style="margin: 0; padding: 0; color: #1a1a1a; font-size: 22px; font-weight: 800; text-transform: uppercase; line-height: 1.0;">${companyInfo.name || 'MI EMPRESA'}</div>
              <div class="company-info" style="color: #4a5568; font-size: 11px; line-height: 1.2;">
                ${companyInfo.rnc ? `<div><strong>RNC:</strong> ${companyInfo.rnc}</div>` : ''}
                ${companyInfo.phone ? `<div><strong>Tel:</strong> ${companyInfo.phone}</div>` : ''}
                ${companyInfo.address ? `<div>${companyInfo.address}</div>` : ''}
              </div>
            </div>
            
            <div class="invoice-header" style="background: #fff; border: 2px solid #000; border-radius: 4px; padding: 10px; margin: 10px 0;">
              <div style="font-weight: 900; font-size: 22px; color: #000; line-height: 1.1;">NCF: ${invoiceNum}</div>
              <div style="font-size: 11px; margin-top: 6px; color: #333; border-top: 1px dashed #ccc; padding-top: 4px;">
                <strong>FECHA:</strong> ${new Date().toLocaleDateString('es-DO')} | <strong>HORA:</strong> ${new Date().toLocaleTimeString('es-DO')}
              </div>
              <div style="font-size: 11px; color: #333;"><strong>PAGO:</strong> ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'}</div>
              ${saleData.profile?.full_name ? `<div style="font-size: 11px; color: #333; margin-top: 4px;"><strong>LE ATENDIÓ:</strong> ${saleData.profile.full_name.toUpperCase()}</div>` : ''}
            </div>
            
            <div style="margin-bottom: 12px; font-size: 11px;">
              ${saleData.customer ? `<div><strong>CLIENTE:</strong> ${saleData.customer.name}</div>` : ''}
              <div><strong>MÉTODO DE PAGO:</strong> ${saleData.paymentMethod.toUpperCase()}</div>
              ${saleData.paymentMethod.toLowerCase() === 'crédito' && saleData.customerDebt ? `
                <div style="margin-top: 8px; padding: 5px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 3px;">
                  <strong style="color: #856404;">DEUDA TOTAL DEL CLIENTE:</strong> 
                  <span style="color: #856404; font-weight: bold;">$${saleData.customerDebt.toFixed(2)}</span>
                </div>
              ` : ''}
            </div>
            
            <div style="border: 1px solid #000; margin: 12px 0;">
              <div style="display: flex; background: #f0f0f0; font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; padding: 5px;">
                <span style="flex: 3;">PRODUCTO</span>
                <span style="flex: 1; text-align: center;">CANT</span>
                <span style="flex: 1; text-align: right;">PRECIO</span>
                <span style="flex: 1; text-align: right;">TOTAL</span>
              </div>
              ${saleData.items.map(item => `
                <div style="display: flex; font-size: 10px; padding: 3px 5px; border-bottom: 1px dotted #ccc;">
                  <span style="flex: 3; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
                  <span style="flex: 1; text-align: center;">${item.quantity}</span>
                  <span style="flex: 1; text-align: right;">$${item.price.toFixed(2)}</span>
                  <span style="flex: 1; text-align: right; font-weight: bold;">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
            
            <div style="text-align: right; font-size: 14px; margin: 15px 0; border-top: 2px solid #000; padding-top: 10px;">
              <div style="font-size: 12px; margin-bottom: 2px;">
                <strong>SUBTOTAL:</strong> $${subtotalAmount.toFixed(2)}
              </div>
              <div style="font-size: 12px; margin-bottom: 8px;">
                <strong>ITBIS:</strong> $${taxAmount.toFixed(2)}
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px; border-top: 1px solid #ddd; padding-top: 5px;">
                TOTAL: $${saleData.total.toFixed(2)}
              </div>
              ${saleData.change ? `<div style="font-size: 12px;">CAMBIO: $${saleData.change.toFixed(2)}</div>` : ''}
            </div>
            
            ${barcodeDataUrl ? `
              <div class="barcode-section">
                <img src="${barcodeDataUrl}" alt="Código de barras" class="barcode-img" />
              </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 15px; font-size: 11px;">
              <div style="font-weight: bold;">¡GRACIAS POR SU COMPRA!</div>
              <div style="margin-top: 3px;">CONSERVE SU RECIBO</div>
            </div>
          </div>
        </body>
      </html >
  `;
  };

  const handlePrinterTypeSelected = async (type: 'usb' | 'bluetooth' | 'browser') => {
    if (type === 'usb' || type === 'bluetooth') {
      // Use thermal printer
      await handleThermalPrint();
    } else {
      // Use browser print
      await executeBrowserPrint();
    }
  };

  const executeBrowserPrint = async () => {
    // Use company info from the database hook (dbCompanyInfo)
    const companyInfo = dbCompanyInfo;

    // Generate barcode for invoice number
    const barcodeDataUrl = generateBarcode(invoiceNumber);

    // Function to create and print content
    const createPrintContent = (logoDataUrl: string) => {
      return generateInvoiceHTML(companyInfo, logoDataUrl, barcodeDataUrl);
    };

    // Function to execute print using iframe (more reliable than popup)
    const printWithIframe = (content: string) => {
      return new Promise<void>((resolve, reject) => {
        try {
          // Create hidden iframe
          const iframe = document.createElement('iframe');
          iframe.style.position = 'absolute';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = 'none';
          iframe.style.left = '-9999px';
          document.body.appendChild(iframe);

          const iframeDoc = iframe.contentWindow?.document;
          if (!iframeDoc) {
            throw new Error('No se pudo crear el documento de impresión');
          }

          iframeDoc.open();
          iframeDoc.write(content);
          iframeDoc.close();

          // Wait for content to load then print
          iframe.onload = () => {
            setTimeout(() => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();

                // Clean up after print dialog closes
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  resolve();
                }, 1000);
              } catch (printError) {
                console.error('Error during print:', printError);
                document.body.removeChild(iframe);
                reject(printError);
              }
            }, 300);
          };
        } catch (error) {
          reject(error);
        }
      });
    };

    try {
      toast({
        title: "Preparando impresión",
        description: "Se está preparando la factura para imprimir...",
      });

      // Use live dbCompanyInfo from the hook
      const companyInfo = dbCompanyInfo;

      if (companyInfo.logo) {
        // Pre-load image to ensure it works
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Continue without logo if it fails
          img.src = companyInfo.logo;
        });

        await printWithIframe(createPrintContent(companyInfo.logo));
      } else {
        await printWithIframe(createPrintContent(''));
      }

      toast({
        title: "Impresión enviada",
        description: "La factura fue enviada a la impresora",
      });
    } catch (error: any) {
      console.error('Error printing:', error);
      toast({
        title: "Error de impresión",
        description: error.message || "No se pudo imprimir la factura. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handlePrintDirect = async () => {
    // Use live dbCompanyInfo from the hook
    const companyInfo = dbCompanyInfo;

    const barcodeDataUrl = generateBarcode(invoiceNumber);

    // Use the logo from companyInfo
    const logoDataUrl = companyInfo.logo || '';

    const content = generateInvoiceHTML(companyInfo, logoDataUrl, barcodeDataUrl);
    setInvoiceContentForPrint(content);
    setShowPrinterSelection(true);
  };

  const generateProfessionalPDF = (companyInfo: any) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    // --- 1. Top Header Area (Company Identity) ---
    if (companyInfo.logo) {
      try {
        const imgProps = doc.getImageProperties(companyInfo.logo);
        const maxWidth = 80;
        const maxHeight = 50;
        const ratio = imgProps.width / imgProps.height;

        let imgW = maxWidth;
        let imgH = maxWidth / ratio;

        if (imgH > maxHeight) {
          imgH = maxHeight;
          imgW = maxHeight * ratio;
        }

        const xPos = 15;
        const yPos = 10;
        doc.addImage(companyInfo.logo, 'PNG', xPos, yPos, imgW, imgH, undefined, 'FAST');
      } catch (e) {
        console.warn("Could not add logo to PDF:", e);
        doc.addImage(companyInfo.logo, 'PNG', 15, 10, 60, 45, undefined, 'FAST');
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(String(companyInfo.name || 'MI EMPRESA'), 200, 25, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let headerY = 32;
    if (companyInfo.rnc) {
      doc.text(`RNC: ${companyInfo.rnc} `, 200, headerY, { align: 'right' });
      headerY += 5;
    }
    if (companyInfo.phone) {
      doc.text(`Tel: ${companyInfo.phone} `, 200, headerY, { align: 'right' });
      headerY += 5;
    }
    if (companyInfo.address) {
      const addrLines = doc.splitTextToSize(String(companyInfo.address), 80);
      doc.text(addrLines, 200, headerY, { align: 'right' });
      headerY += (addrLines.length * 5);
    }

    // --- 2. Invoice Meta Info Box ---
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 65, 180, 22, 2, 2, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(26, 32, 44);
    doc.text(`NCF: ${invoiceNumber} `, 20, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(113, 128, 150);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-DO')} ${new Date().toLocaleTimeString('es-DO')} `, 130, 75);
    doc.text(`PAGO: ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'} `, 130, 82);

    // --- 3. Customer Section ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('INFORMACIÓN DEL CLIENTE:', 15, 95);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 97, 195, 97);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(saleData.customer ? String(saleData.customer.name) : 'CLIENTE FINAL / VENTA AL CONTADO', 15, 105);

    if (saleData.customer?.rnc) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`RNC / Cédula: ${saleData.customer.rnc} `, 15, 110);
    }

    // --- 4. Products Table ---
    const tableData = (saleData.items || []).map((item: any) => [
      String(item.name || 'Producto'),
      Number(item.quantity || 0),
      `$${Number(item.price || item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} `,
      `$${(Number(item.price || item.unit_price || 0) * Number(item.quantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} `
    ]);

    autoTable(doc, {
      head: [['Descripción del Producto/Servicio', 'Cantidad', 'Precio Unitario', 'Valor Total']],
      body: tableData,
      startY: 120,
      theme: 'striped',
      headStyles: { fillColor: [26, 32, 44], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 10, cellPadding: 4, textColor: [50, 50, 50] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center', cellWidth: 25 }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } }
    });

    // --- 5. Summary Section ---
    const finalY = (doc as any).lastAutoTable?.finalY + 10;
    const summaryLeft = 130;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    doc.text('Subtotal:', summaryLeft, finalY);
    doc.text(`$${(Number(saleData.total || 0) / 1.18).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY, { align: 'right' });

    doc.text('ITBIS (18%):', summaryLeft, finalY + 7);
    doc.text(`$${(Number(saleData.total || 0) - (Number(saleData.total || 0) / 1.18)).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY + 7, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(summaryLeft, finalY + 10, 195, finalY + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL DOP:', summaryLeft, finalY + 18);
    doc.text(`$${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} `, 195, finalY + 18, { align: 'right' });

    // --- 6. Footer ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Esta factura electrónica es un comprobante fiscal válido según las regulaciones locales.', 105, pageHeight - 15, { align: 'center' });
    doc.text('¡Gracias por su preferencia!', 105, pageHeight - 10, { align: 'center' });

    return doc;
  };

  const handleGeneratePDF = async () => {
    try {
      toast({
        title: "Generando Factura A4",
        description: "Creando PDF en formato de oficina profesional...",
      });

      const doc = generateProfessionalPDF(dbCompanyInfo);

      // Save PDF via explicit blob download
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Factura Generada",
        description: `La factura profesional ${invoiceNumber} se ha descargado correctamente en formato A4.`,
      });
    } catch (error: any) {
      console.error('CRITICAL Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `No se pudo generar el formato A4: ${error.message || "Error desconocido"} `,
      });
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      toast({
        variant: "destructive",
        title: "Email requerido",
        description: "Por favor ingrese una dirección de email.",
      });
      return;
    }

    setIsEmailLoading(true);
    toast({
      title: "Generando factura para envío",
      description: "Preparando el PDF profesional y convirtiendo...",
    });

    try {
      const companyInfo = dbCompanyInfo;

      // 1. Generate the same professional PDF
      const doc = generateProfessionalPDF(companyInfo);
      const pdfBlob = doc.output('blob');

      // 2. Convert Blob to base64 using FileReader
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64data = reader.result?.toString().split(',')[1];

        if (!base64data) {
          throw new Error("No se pudo generar el contenido del PDF.");
        }

        // 3. Generate barcode for reference
        const barcodeDataUrl = generateBarcode(invoiceNumber);

        // 4. Send to Edge Function
        const response = await fetch('https://hkzgxdmnvyoviwketxva.supabase.co/functions/v1/send-invoice-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: emailAddress,
            saleData: {
              ...saleData,
              invoiceNumber,
              companyInfo
            },
            barcodeDataUrl,
            pdfBase64: base64data,
            emailGreeting: storeSettings?.email_greeting || '¡Hola!',
            emailMessage: storeSettings?.email_message || 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.'
          }),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: "Email enviado",
            description: `La factura profesional ${invoiceNumber} se ha enviado a ${emailAddress} con el PDF adjunto.`,
          });
          setEmailAddress('');
          setShowEmailInput(false);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: result.error || 'Error enviando email',
          });
        }
        setIsEmailLoading(false);
      };

      reader.onerror = () => {
        throw new Error("Error leyendo el archivo PDF.");
      };
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo enviar el email. Inténtelo de nuevo.",
      });
      setIsEmailLoading(false);
    }
  };

  const handleThermalPrint = async () => {
    try {
      const { thermalPrinter } = await import('@/utils/thermalPrinter');

      if (!thermalPrinter.isConnected()) {
        toast({
          title: "Error",
          description: "Impresora térmica no conectada. Ve a Configuración para conectarla.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Imprimiendo...",
        description: "Enviando factura a la impresora térmica",
      });

      // Use live database data
      const companyInfo = dbCompanyInfo;
      const thermalPrintSettings = printSettings;

      // Prepare invoice data
      const invoiceData = {
        companyInfo,
        invoiceNumber,
        items: saleData.items,
        subtotal: saleData.total - (saleData.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0)),
        tax: saleData.items.reduce((sum, item) => sum + (item.tax_amount || 0), 0),
        total: saleData.total,
        customer: saleData.customer,
        paymentMethod: saleData.paymentMethod,
        change: saleData.change,
      };

      // Print to thermal printer - ensure we map PaperSize to what the thermal printer supports
      const printerWidth = (thermalPrintSettings.paperSize === '50mm' ? '50mm' : '80mm') as '80mm' | '50mm';
      const result = await thermalPrinter.printInvoice(invoiceData, printerWidth);

      if (result.success) {
        toast({
          title: "Impresión exitosa",
          description: "La factura se imprimió correctamente",
        });
        onClose();
      } else {
        toast({
          title: "Error al imprimir",
          description: result.error || "Error desconocido",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error printing to thermal printer:', error);
      toast({
        title: "Error",
        description: error.message || "Error al imprimir en impresora térmica",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-[480px] p-4">
          <DialogHeader className="space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  ¡Venta procesada exitosamente!
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Total: ${saleData.total.toFixed(2)}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Cambio destacado */}
          {saleData.change !== undefined && saleData.change > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Cambio a entregar</p>
              <p className="text-4xl font-bold text-green-500">
                ${saleData.change.toFixed(2)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {/* Invoice Info Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Factura {saleData.invoiceType || 'B02'}</p>
                <p className="text-lg font-bold font-mono tracking-wider">
                  {invoiceNumber}
                </p>
              </div>
            </Card>

            {/* Paper Size Info */}
            <Card className="bg-muted/30 p-2">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Tamaño de papel: <span className="font-bold text-primary">
                    {(() => {
                      const printSettings = JSON.parse(localStorage.getItem('print-settings') || '{"paperSize":"80mm"}');
                      const paperSize = printSettings.paperSize || '80mm';
                      const sizes: Record<string, string> = {
                        '80mm': '80mm',
                        '50mm': '50mm',
                        'A4': 'A4',
                        'carta': 'Carta'
                      };
                      return sizes[paperSize] || '80mm';
                    })()}
                  </span></p>
                  <p className="text-xs text-muted-foreground">
                    Para cambiar, ve a Settings → Impresión
                  </p>
                </div>
              </div>
            </Card>

            {/* Print Options */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Seleccione cómo desea imprimir la factura:
              </p>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={handlePrintDirect}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                >
                  <div className="p-1.5 rounded-md bg-green-500/10 group-hover:bg-green-500/20 transition-colors shrink-0">
                    <Printer className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">Imprimir directamente</span>
                </Button>
              </Card>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={handleGeneratePDF}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                >
                  <div className="p-1.5 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors shrink-0">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">Generar PDF</span>
                </Button>
              </Card>

              <Card className="group hover:shadow-sm transition-all duration-200 hover:border-primary/50 cursor-pointer">
                <Button
                  onClick={() => setShowEmailInput(!showEmailInput)}
                  className="w-full justify-start h-auto py-2 px-3 hover:bg-transparent"
                  variant="ghost"
                >
                  <div className="p-1.5 rounded-md bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors shrink-0">
                    <Mail className="h-4 w-4 text-purple-500" />
                  </div>
                  <span className="ml-2 font-semibold text-sm">Enviar por correo</span>
                </Button>
              </Card>
            </div>

            {showEmailInput && (
              <Card className="p-2 bg-accent/10 border-accent">
                <div className="space-y-1.5">
                  <Input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    disabled={isEmailLoading}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-1.5">
                    <Button
                      onClick={handleSendEmail}
                      disabled={isEmailLoading}
                      className="flex-1 h-8 text-xs"
                    >
                      {isEmailLoading ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="mr-1.5 h-3 w-3" />
                      )}
                      {isEmailLoading ? 'Enviando...' : 'Enviar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowEmailInput(false)}
                      disabled={isEmailLoading}
                      className="h-8 text-xs px-3"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <Button
              variant="outline"
              onClick={onClose}
              className="w-full h-8 text-sm mt-1"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrinterSelectionDialog
        isOpen={showPrinterSelection}
        onClose={() => setShowPrinterSelection(false)}
        onPrinterSelected={handlePrinterTypeSelected}
        invoiceContent={invoiceContentForPrint}
        saleData={{
          total: saleData.total,
          items: saleData.items,
          paymentMethod: saleData.paymentMethod,
          change: saleData.change,
          customer: saleData.customer,
          invoiceNumber: invoiceNumber,
        }}
      />
    </>
  );
};

export default PrintOptionsDialog;