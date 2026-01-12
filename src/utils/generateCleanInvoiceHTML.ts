// Utility to generate clean, black & white invoice HTML matching the Settings preview
// This ensures consistency between the preview and actual printed invoices

interface InvoiceData {
  invoiceNumber: string;
  invoicePrefix: string;
  date: Date;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  currency: string;
  paymentTerms?: string;
  footerText?: string;
  showBarcode?: boolean; // NEW: Option to show barcode
  barcodeDataUrl?: string; // NEW: Barcode data URL
}

interface CompanyData {
  name: string;
  logo?: string;
  logoSize?: number;
  rnc?: string;
  phone?: string;
  address?: string;
  pageMargin?: string;
  containerPadding?: string;
  logoMarginBottom?: string;
  logoWidth?: 'auto' | 'full';
  fontSize?: number; // NEW: Base font size
}

export const generateCleanInvoiceHTML = (
  companyData: CompanyData,
  invoiceData: InvoiceData
): string => {
  const logoHeight = companyData.logoSize || 64;
  const pageMargin = companyData.pageMargin || '0mm';
  const containerPadding = companyData.containerPadding || '4px';
  const logoMarginBottom = companyData.logoMarginBottom || '6px';
  const logoWidth = companyData.logoWidth || 'auto';
  const baseFontSize = companyData.fontSize || 12;

  // Calculate relative sizes
  const sizeH1 = Math.round(baseFontSize * 1.5); // 18px
  const sizeH2 = Math.round(baseFontSize * 1.25); // 15px
  const sizeBase = baseFontSize; // 12px
  const sizeSmall = Math.round(baseFontSize * 0.9); // 11px
  const sizeXSmall = Math.round(baseFontSize * 0.85); // 10px

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura NCF ${invoiceData.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: auto;
      margin: ${pageMargin};
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background-color: #ffffff;
      color: #000000;
      padding: 0;
      max-width: 80mm;
      margin: 0 auto;
      font-size: ${sizeBase}px;
    }
    
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
    }
    
    .invoice-container {
      background: #ffffff;
      color: #000000;
      padding: ${containerPadding};
      border: none;
    }
    
    .logo {
      text-align: center;
      margin-bottom: ${logoMarginBottom};
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .logo img {
      ${logoWidth === 'full'
      ? 'width: 100%; height: auto;'
      : `max-height: ${logoHeight}px; height: auto; width: auto;`}
      max-width: 100%;
      object-fit: contain;
      filter: grayscale(100%);
      display: block;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    
    .company-name {
      font-size: ${sizeH1}px;
      font-weight: bold;
      color: #000;
      margin-bottom: 2px;
      line-height: 1.2;
    }
    
    .company-info {
      font-size: ${sizeSmall}px;
      color: #000;
      line-height: 1.4;
    }
    
    /* Invoice Number */
    .invoice-number {
      text-align: center;
      border-bottom: 2px solid #000;
      padding: 6px 0;
      margin-bottom: 6px;
    }
    
    .invoice-label {
      font-size: ${sizeH2}px;
      font-weight: bold;
      color: #000;
      line-height: 1;
    }
    
    .invoice-id {
      font-size: ${Math.round(sizeBase * 1.1)}px;
      font-family: 'Courier New', monospace;
      color: #000;
      margin-top: 4px;
      font-weight: bold;
    }
    
    .invoice-date {
      font-size: ${sizeSmall}px;
      color: #000;
      margin-top: 4px;
    }
    
    /* Items */
    .items {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 4px 0;
      margin-bottom: 6px;
    }
    
    .item {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      color: #000;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    
    /* Ensure item text scales too */
    .item span {
        font-size: inherit;
    }
    
    .item-name {
      flex: 1;
      padding-right: 4px;
    }
    
    .item-price {
      font-family: 'Courier New', monospace;
      white-space: nowrap;
      margin-left: 4px;
      font-weight: 500;
    }
    
    /* Totals */
    .totals {
      margin-bottom: 6px;
    }
    
    .total-line {
      display: flex;
      justify-content: space-between;
      font-size: ${sizeSmall}px;
      color: #000;
      margin-bottom: 2px;
      line-height: 1.3;
    }
    
    .total-line.grand-total {
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 4px;
      font-size: ${sizeH2}px;
      font-weight: bold;
    }
    
    .total-value {
      font-family: 'Courier New', monospace;
      font-weight: 500;
    }
    
    /* Footer */
    .footer {
      border-top: 2px solid #000;
      padding-top: 8px;
      margin-top: 12px;
      text-align: center;
    }
    
    .footer-text {
      font-size: ${sizeSmall}px;
      color: #000;
      margin-bottom: 8px;
    }
    
    .payment-terms {
      font-size: ${sizeXSmall}px;
      color: #666;
      margin-bottom: 12px;
      text-align: center;
    }
    
    /* Barcode - CENTERED */
    .barcode {
      text-align: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed #000;
    }
    
    .barcode img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      filter: grayscale(100%);
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    ${companyData.logo ? `
      <div class="logo">
        <img src="${companyData.logo}" alt="Logo">
      </div>
    ` : ''}
    
    <div class="header">
      <div class="company-name">${companyData.name}</div>
      <div class="company-info">
        ${companyData.rnc ? `RNC: ${companyData.rnc}<br>` : ''}
        ${companyData.phone ? `${companyData.phone}<br>` : ''}
        ${companyData.address ? `${companyData.address}` : ''}
      </div>
    </div>
    
    <div class="invoice-number">
      <div class="invoice-label">NCF</div>
      <div class="invoice-id">${invoiceData.invoiceNumber}</div>
      <div class="invoice-date">${invoiceData.date.toLocaleDateString('es-DO')}</div>
    </div>
    
    <div class="items">
      ${invoiceData.items.map(item => `
        <div class="item">
          <span class="item-name">${item.name} x${item.quantity}</span>
          <span class="item-price">${invoiceData.currency} ${item.total.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
    
    <div class="totals">
      <div class="total-line">
        <span>Subtotal:</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.subtotal.toFixed(2)}</span>
      </div>
      <div class="total-line">
        <span>ITBIS (${invoiceData.taxRate}%):</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.tax.toFixed(2)}</span>
      </div>
      <div class="total-line grand-total">
        <span>TOTAL:</span>
        <span class="total-value">${invoiceData.currency} ${invoiceData.total.toFixed(2)}</span>
      </div>
    </div>
    
    ${invoiceData.footerText ? `
      <div class="footer">
        <div class="footer-text">${invoiceData.footerText}</div>
      </div>
    ` : ''}
    
    ${invoiceData.paymentTerms ? `
      <div class="payment-terms">
        Términos de pago: ${invoiceData.paymentTerms} días
      </div>
    ` : ''}
    
    ${invoiceData.showBarcode && invoiceData.barcodeDataUrl ? `
      <div class="barcode">
        <img src="${invoiceData.barcodeDataUrl}" alt="Código de Barras NCF">
      </div>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
};
