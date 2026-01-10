import { useStoreSettings } from './useStoreSettings';
import { useCompanySettings } from './useCompanySettings';

export type PaperSize = '50mm' | '80mm' | 'A4' | 'carta';

export interface PrintSettings {
  paperSize: PaperSize;
  useThermalPrinter: boolean;
  thermalPrinterName: string;
}

export interface CompanyInfoForPrint {
  name: string;
  rnc: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logo: string;
  slogan: string;
  logoCartSize: number;
  logoSummarySize: number;
  logoInvoiceSize: number;
}

export const usePrintSettings = () => {
  const { settings: storeSettings, isLoading: isLoadingStore } = useStoreSettings();
  const { settings: companySettings, isLoading: isLoadingCompany } = useCompanySettings();

  const printSettings: PrintSettings = {
    paperSize: (storeSettings?.paper_size as PaperSize) || '80mm',
    useThermalPrinter: storeSettings?.use_thermal_printer || false,
    thermalPrinterName: storeSettings?.thermal_printer_name || '',
  };

  const companyInfo: CompanyInfoForPrint = {
    name: companySettings?.company_name || 'Mi Empresa',
    rnc: companySettings?.rnc || '',
    phone: companySettings?.phone || '',
    email: companySettings?.email || '',
    address: companySettings?.address || '',
    website: companySettings?.website || '',
    logo: companySettings?.logo_url || '',
    slogan: companySettings?.slogan || '',
    logoCartSize: companySettings?.logo_cart_size || 200,
    logoSummarySize: companySettings?.logo_summary_size || 64,
    logoInvoiceSize: companySettings?.logo_invoice_size || 120,
  };

  return {
    printSettings,
    companyInfo,
    isLoading: isLoadingStore || isLoadingCompany,
  };
};
