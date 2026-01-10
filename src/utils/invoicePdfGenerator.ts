import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceItem {
    name: string;
    quantity: number;
    price: number;
    unit_price?: number;
    tax_amount?: number;
}

export interface Customer {
    name: string;
    rnc?: string;
}

export interface SaleData {
    items: InvoiceItem[];
    total: number;
    paymentMethod: string;
    change?: number;
    customer?: Customer;
    customerDebt?: number;
    invoiceNumber?: string;
    invoice_number?: string;
}

export interface CompanyInfo {
    name: string;
    logo?: string | null;
    rnc?: string | null;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
    website?: string | null;
}

export const generateProfessionalPDF = (companyInfo: CompanyInfo, saleData: SaleData, invoiceNumber: string) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // --- 1. Top Header Area (Company Identity) ---
    if (companyInfo.logo) {
        try {
            // We can't use getImageProperties easily without loading the image first in some contexts
            // simpler approach for now: standard size box
            doc.addImage(companyInfo.logo, 'PNG', 15, 10, 30, 30, undefined, 'FAST');
        } catch (e) {
            console.warn("Could not add logo to PDF:", e);
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
        doc.text(`RNC: ${companyInfo.rnc}`, 200, headerY, { align: 'right' });
        headerY += 5;
    }
    if (companyInfo.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, 200, headerY, { align: 'right' });
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
    doc.text(`NCF: ${invoiceNumber}`, 20, 80);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(113, 128, 150);
    doc.text(`FECHA: ${new Date().toLocaleDateString('es-DO')} ${new Date().toLocaleTimeString('es-DO')}`, 130, 75);
    doc.text(`PAGO: ${saleData.paymentMethod?.toUpperCase() || 'CONTADO'}`, 130, 82);

    // Add employee name if available
    // @ts-ignore - profile property might not be in the strict interface yet but passed at runtime
    if (saleData.profile?.full_name) {
        doc.setFontSize(9);
        // @ts-ignore
        doc.text(`LE ATENDIÓ: ${saleData.profile.full_name.toUpperCase()}`, 130, 88);
    }

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
        doc.text(`RNC/Cédula: ${saleData.customer.rnc}`, 15, 110);
    }

    // --- 4. Products Table ---
    const tableData = (saleData.items || []).map((item) => [
        String(item.name || 'Producto'),
        Number(item.quantity || 0),
        `$${Number(item.price || item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `$${(Number(item.price || item.unit_price || 0) * Number(item.quantity || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
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
    // @ts-ignore - lastAutoTable exists on the doc instance added by the plugin
    const finalY = (doc as any).lastAutoTable?.finalY + 10;
    const summaryLeft = 130;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const subtotal = Number(saleData.total || 0) / 1.18;
    const itbis = Number(saleData.total || 0) - subtotal;

    doc.text('Subtotal:', summaryLeft, finalY);
    doc.text(`$${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY, { align: 'right' });

    doc.text('ITBIS (18%):', summaryLeft, finalY + 7);
    doc.text(`$${itbis.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY + 7, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(summaryLeft, finalY + 10, 195, finalY + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL DOP:', summaryLeft, finalY + 18);
    doc.text(`$${Number(saleData.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 195, finalY + 18, { align: 'right' });

    // --- 6. Footer ---
    const pageHeight = doc.internal.pageSize.height;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Esta factura electrónica es un comprobante fiscal válido según las regulaciones locales.', 105, pageHeight - 15, { align: 'center' });
    doc.text('¡Gracias por su preferencia!', 105, pageHeight - 10, { align: 'center' });

    return doc;
};
