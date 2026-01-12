import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/components/ThemeProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useInvoiceSequences, useUpdateInvoiceSequence, useMaxInvoiceNumbers } from '@/hooks/useInvoiceSequences';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserStore } from '@/hooks/useUserStore';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useStoreSettings, PaymentMethod } from '@/hooks/useStoreSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ThermalPrinterDialog } from '@/components/settings/ThermalPrinterDialog';
import MobileSettingsLayout from '@/components/settings/MobileSettingsLayout';
import SettingsStoreSection from '@/components/settings/SettingsStoreSection';
import BannerSettingsSection from '@/components/settings/BannerSettingsSection';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import {
  Building2,
  FileText,
  Calculator,
  CreditCard,
  Package,
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Printer,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Hash,
  Store,
  Copy,
  ExternalLink,
  Share2,
  Volume2,
  Mail,
  Send,
  Clock,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import { injectPrintStyles } from '@/utils/printHandler';

const Settings = () => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mobileActiveSection, setMobileActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const queryClient = useQueryClient();

  // Hooks for invoice sequences
  const { data: invoiceSequences, isLoading: sequencesLoading } = useInvoiceSequences();
  const { data: invoiceTypes } = useInvoiceTypes();
  const { data: maxInvoiceNumbers } = useMaxInvoiceNumbers();
  const updateSequenceMutation = useUpdateInvoiceSequence();

  // User profile and store hooks
  const { profile } = useUserProfile();
  const { data: userStore, isLoading: storeLoading } = useUserStore();
  const { settings: companySettingsDB, updateSettings, isUpdating, uploadLogo, isUploadingLogo } = useCompanySettings();
  const { settings: storeSettings, updateSettings: updateStoreSettings, isUpdating: isUpdatingStoreSettings } = useStoreSettings();

  // Category hooks
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', description: '' });

  // Company Information State - sync with database
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Mi Empresa',
    rnc: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    logo: '',
    slogan: '',
    logoSize: 120,
    logoCartSize: 200,
    logoSummarySize: 64,
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [shopType, setShopType] = useState('default');

  // Sync company settings from database to local state
  useEffect(() => {
    if (companySettingsDB) {
      const dbSettings = {
        name: companySettingsDB.company_name || 'Mi Empresa',
        rnc: companySettingsDB.rnc || '',
        phone: companySettingsDB.phone || '',
        email: companySettingsDB.email || '',
        address: companySettingsDB.address || '',
        website: companySettingsDB.website || '',
        logo: companySettingsDB.logo_url || '',
        slogan: companySettingsDB.slogan || '',
        logoSize: companySettingsDB.logo_invoice_size || 120,
        logoCartSize: companySettingsDB.logo_cart_size || 200,
        logoSummarySize: companySettingsDB.logo_summary_size || 64,
      };
      setCompanyInfo(dbSettings);
      setLogoPreview(companySettingsDB.logo_url || null);
    }
  }, [companySettingsDB]);

  // Invoice Settings State - synced with storeSettings
  const [invoiceSettings, setInvoiceSettings] = useState({
    nextInvoiceNumber: '0001',
    invoicePrefix: 'FAC-',
    autoIncrement: true,
    showTax: true,
    defaultTaxRate: '18',
    currency: 'DOP',
    paymentTerms: '30',
    footerText: 'Gracias por su preferencia',
    emailGreeting: '¡Hola!',
    emailMessage: 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.',
    showBarcode: false
  });

  // Sync invoice settings from database
  // Sync invoice settings from database
  useEffect(() => {
    if (storeSettings) {
      // Load local settings
      const localSettings = JSON.parse(localStorage.getItem('invoice_settings_local') || '{}');

      setInvoiceSettings({
        nextInvoiceNumber: '0001',
        invoicePrefix: storeSettings.invoice_prefix || 'FAC-',
        autoIncrement: storeSettings.auto_increment ?? true,
        showTax: storeSettings.show_tax ?? true,
        defaultTaxRate: storeSettings.default_tax_rate != null ? String(storeSettings.default_tax_rate) : '18',
        currency: storeSettings.currency || 'DOP',
        paymentTerms: storeSettings.payment_terms != null ? String(storeSettings.payment_terms) : '30',
        footerText: storeSettings.invoice_footer_text || 'Gracias por su preferencia',
        emailGreeting: storeSettings.email_greeting || '¡Hola!',
        emailMessage: storeSettings.email_message || 'Le agradecemos sinceramente por elegirnos y por la confianza depositada en nosotros. Valoramos enormemente su preferencia y estamos comprometidos con brindarle siempre la mejor calidad y servicio.',
        showBarcode: storeSettings.show_barcode || localSettings.showBarcode || false // Load from DB or Local
      });
      setShopType(storeSettings.shop_type || 'default');
    }
  }, [
    storeSettings?.invoice_prefix,
    storeSettings?.auto_increment,
    storeSettings?.show_tax,
    storeSettings?.default_tax_rate,
    storeSettings?.currency,
    storeSettings?.payment_terms,
    storeSettings?.invoice_footer_text,
    storeSettings?.email_greeting,
    storeSettings?.email_message,
    storeSettings?.shop_type,
    storeSettings?.show_barcode // NEW: Watch for changes
  ]);

  // System Settings State - synced with storeSettings
  const [systemSettings, setSystemSettings] = useState({
    notifications: true,
    autoBackup: true,
    lowStockAlert: true,
    lowStockThreshold: '10',
    theme: 'dark',
    language: 'es',
    timezone: 'America/Santo_Domingo',
    backupFrequency: 'daily',
    retentionDays: '30',
    posLayoutGridCols: '2'
  });

  // Sync system settings from database
  useEffect(() => {
    if (storeSettings) {
      setSystemSettings({
        notifications: storeSettings.notifications_enabled ?? true,
        autoBackup: storeSettings.auto_backup ?? false,
        lowStockAlert: storeSettings.low_stock_alert ?? false,
        lowStockThreshold: storeSettings.low_stock_threshold != null ? String(storeSettings.low_stock_threshold) : '10',
        theme: storeSettings.theme || 'light',
        language: storeSettings.language || 'es',
        timezone: storeSettings.timezone || 'America/Santo_Domingo',
        backupFrequency: storeSettings.backup_frequency || 'daily',
        retentionDays: storeSettings.log_retention_days != null ? String(storeSettings.log_retention_days) : '30',
        posLayoutGridCols: storeSettings.pos_layout_grid_cols != null ? String(storeSettings.pos_layout_grid_cols) : '2',
      });

      // Sync global theme with DB setting - REMOVED to prevent overriding local session
      // if (storeSettings.theme) {
      //   const dbTheme = storeSettings.theme === 'auto' ? 'system' : storeSettings.theme as "light" | "dark";
      //   setTheme(dbTheme);
      // }
    }
  }, [
    storeSettings?.notifications_enabled,
    storeSettings?.auto_backup,
    storeSettings?.low_stock_alert,
    storeSettings?.low_stock_threshold,
    storeSettings?.theme,
    storeSettings?.language,
    storeSettings?.timezone
  ]);

  // Payment methods state - synced with storeSettings
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { id: 'cash', name: 'Efectivo', enabled: true },
    { id: 'card', name: 'Tarjeta', enabled: true },
    { id: 'transfer', name: 'Transferencia', enabled: true },
    { id: 'check', name: 'Cheque', enabled: false },
    { id: 'credit', name: 'Crédito', enabled: true }
  ]);

  // Sync payment methods from database
  useEffect(() => {
    if (storeSettings?.payment_methods) {
      setPaymentMethods(storeSettings.payment_methods);
    }
  }, [storeSettings?.payment_methods]);

  // Print Settings State - synced with storeSettings
  const [printSettings, setPrintSettings] = useState({
    paperSize: '80mm',
    useThermalPrinter: false,
    thermalPrinterConnected: false,
    thermalPrinterName: '',
    pageMargin: '0mm',
    containerPadding: '4px',
    logoMarginTop: '6px',
    logoMarginBottom: '6px',
    logoWidth: 'auto', // Fix TS error by initializing
    fontSize: 12, // Default font size for invoice
  });

  // Sync print settings from database
  useEffect(() => {
    if (storeSettings) {
      const hasPrinterSaved = Boolean(storeSettings.thermal_printer_name);

      console.log('📡 Cargando configuración de impresora desde DB:', {
        thermal_printer_name: storeSettings.thermal_printer_name,
        use_thermal_printer: storeSettings.use_thermal_printer,
        hasPrinterSaved,
      });

      setPrintSettings(prev => {
        // Load local margin settings
        const localMargins = JSON.parse(localStorage.getItem('print_margins_settings') || '{}');

        return {
          ...prev,
          paperSize: storeSettings.paper_size || '80mm',
          useThermalPrinter: storeSettings.use_thermal_printer ?? false,
          thermalPrinterName: storeSettings.thermal_printer_name || '',
          thermalPrinterConnected: hasPrinterSaved,
          // Prioritize LocalStorage -> DB -> Default
          pageMargin: localMargins.pageMargin || storeSettings.page_margin || '0mm',
          containerPadding: localMargins.containerPadding || storeSettings.container_padding || '4px',
          logoMarginTop: localMargins.logoMarginTop || storeSettings.logo_margin_top || '6px',
          logoMarginBottom: localMargins.logoMarginBottom || storeSettings.logo_margin_bottom || '6px',
          logoWidth: localMargins.logoWidth || 'auto', // Load logo width setting
          fontSize: localMargins.fontSize || storeSettings.invoice_font_size || 12, // Load font size
        };
      });

      console.log('✅ Configuración de impresora cargada');
    }
  }, [storeSettings?.paper_size, storeSettings?.use_thermal_printer, storeSettings?.thermal_printer_name]);

  // Thermal printer dialog state
  const [showPrinterDialog, setShowPrinterDialog] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo es muy grande. Máximo 2MB.",
          variant: "destructive",
        });
        return;
      }

      try {
        setLogoUploadError(null);
        // Upload to Supabase storage
        // Upload to Supabase storage
        const publicUrl = await uploadLogo(file);
        const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`; // Bypass cache
        setLogoPreview(urlWithTimestamp);
        setCompanyInfo({ ...companyInfo, logo: urlWithTimestamp });

        toast({
          title: "Logo subido",
          description: "El logo se ha guardado correctamente.",
        });
      } catch (error: any) {
        console.error('Error uploading logo:', error);
        toast({
          title: "Error",
          description: error.message || "No se pudo subir el logo.",
          variant: "destructive",
        });
        setLogoUploadError(error.message || "No se pudo subir el logo. Verifique permisos.");
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateSettings({ logo_url: null });
      setLogoPreview(null);
      setCompanyInfo({ ...companyInfo, logo: '' });

      toast({
        title: "Logo removido",
        description: "El logo se ha removido correctamente.",
      });
    } catch (error) {
      console.error('Error removing logo:', error);
    }
  };

  const handleSaveSettings = async (section: string) => {
    setLoading(true);
    try {
      if (section === 'empresa') {
        // Save to Supabase database
        await updateSettings({
          company_name: companyInfo.name,
          rnc: companyInfo.rnc || null,
          phone: companyInfo.phone || null,
          email: companyInfo.email || null,
          address: companyInfo.address || null,
          website: companyInfo.website || null,
          slogan: companyInfo.slogan || null,
          logo_invoice_size: companyInfo.logoSize,
          logo_cart_size: companyInfo.logoCartSize,
          logo_summary_size: companyInfo.logoSummarySize,
        });

        // Also sync to localStorage for offline access
        localStorage.setItem('company-info', JSON.stringify(companyInfo));
      } else if (section === 'facturas') {
        // Save local settings (like barcode) to localStorage FIRST to ensure persistence
        const localSettings = JSON.parse(localStorage.getItem('invoice_settings_local') || '{}');
        localStorage.setItem('invoice_settings_local', JSON.stringify({
          ...localSettings,
          showBarcode: invoiceSettings.showBarcode
        }));

        // Also save print margins & font size since it's now editable in this section
        localStorage.setItem('print_margins_settings', JSON.stringify({
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginTop: printSettings.logoMarginTop,
          logoMarginBottom: printSettings.logoMarginBottom,
          logoWidth: printSettings.logoWidth,
          fontSize: printSettings.fontSize // Save font size FROM INVOICE TAB
        }));

        // Refresh print styles immediately
        injectPrintStyles();

        // Try access DB update, but don't block if it fails (e.g. missing column)
        try {
          await updateStoreSettings({
            invoice_prefix: invoiceSettings.invoicePrefix,
            auto_increment: invoiceSettings.autoIncrement,
            show_tax: invoiceSettings.showTax,
            default_tax_rate: parseFloat(invoiceSettings.defaultTaxRate) || 18,
            currency: invoiceSettings.currency,
            payment_terms: parseInt(invoiceSettings.paymentTerms) || 30,
            invoice_footer_text: invoiceSettings.footerText,
            email_greeting: invoiceSettings.emailGreeting,
            email_message: invoiceSettings.emailMessage,
            show_barcode: invoiceSettings.showBarcode,
          });
        } catch (err) {
          console.warn('Database update failed for invoice settings (likely missing columns), but local settings saved.', err);
        }
      } else if (section === 'pagos') {
        // Save payment methods to database
        await updateStoreSettings({
          payment_methods: paymentMethods,
        });
      } else if (section === 'productos') {
        // Save product settings to database
        await updateStoreSettings({
          low_stock_alert: systemSettings.lowStockAlert,
          low_stock_threshold: parseInt(systemSettings.lowStockThreshold) || 10,
        });
      } else if (section === 'sistema') {
        // Save system settings to database
        await updateStoreSettings({
          notifications_enabled: systemSettings.notifications,
          auto_backup: systemSettings.autoBackup,
          theme: systemSettings.theme,
          language: systemSettings.language,
          timezone: systemSettings.timezone,
          backup_frequency: systemSettings.backupFrequency,
          log_retention_days: parseInt(systemSettings.retentionDays) || 30,
          pos_layout_grid_cols: parseInt(systemSettings.posLayoutGridCols) || 2,
        });
      } else if (section === 'impresion') {
        // Save visual settings to LocalStorage FIRST (as DB likely lacks these columns)
        localStorage.setItem('print_margins_settings', JSON.stringify({
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginTop: printSettings.logoMarginTop,
          logoMarginBottom: printSettings.logoMarginBottom,
          logoWidth: printSettings.logoWidth, // Ensure this is preserved/saved
          fontSize: printSettings.fontSize // Save font size
        }));

        // Save supported print settings to database with try/catch
        try {
          await updateStoreSettings({
            paper_size: printSettings.paperSize,
            use_thermal_printer: printSettings.useThermalPrinter,
            thermal_printer_name: printSettings.thermalPrinterName || null,
            invoice_font_size: printSettings.fontSize, // Save to DB if supported
          });
        } catch (err) {
          console.warn('Database update failed for print settings, but local settings saved.', err);
        }

        // Refresh print styles immediately
        injectPrintStyles();
      } else if (section === 'tienda') {
        await updateStoreSettings({
          shop_type: shopType
        } as any);
      }

      const sectionNames: Record<string, string> = {
        'empresa': 'Empresa',
        'facturas': 'Facturación',
        'pagos': 'Métodos de Pago',
        'productos': 'Productos',
        'sistema': 'Sistema',
        'impresion': 'Impresión',
        'tienda': 'Tienda'
      };

      let toastTitle = "Configuración guardada";
      let toastDesc = `Los cambios en ${sectionNames[section] || section} se han guardado correctamente.`;

      // Custom message for sections that save to localStorage
      if (section === 'impresion' || section === 'facturas') {
        toastTitle = "Configuración Actualizada";
        toastDesc = `La configuración de ${sectionNames[section] || section} (incluyendo tamaño de letra) se ha guardado correctamente.`;
      }

      toast({
        title: toastTitle,
        description: toastDesc,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSequence = async (id: string, newNumber: number, invoiceTypeId: string) => {
    try {
      await updateSequenceMutation.mutateAsync({ id, current_number: newNumber, invoice_type_id: invoiceTypeId });
      toast({
        title: "Secuencia actualizada",
        description: "La secuencia de facturación se ha actualizado correctamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la secuencia.",
        variant: "destructive",
      });
    }
  };

  const handleSavePrintSettings = async () => {
    await handleSaveSettings('impresion');
  };

  const handleTestPrint = () => {
    // Check if thermal printer should be used
    if (printSettings.useThermalPrinter && printSettings.thermalPrinterConnected) {
      handleThermalTestPrint();
      return;
    }

    // Regular browser print test
    const testInvoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prueba de Impresión</title>
          <style>
            /* Reset defaults */
            * {
              box-sizing: border-box;
            }
            
            /* Page setup */
            @page {
              margin: 0;
              size: ${printSettings.paperSize === '80mm' || printSettings.paperSize === '50mm' ? 'auto' : printSettings.paperSize === 'carta' ? 'letter' : 'auto'};
            }

            @media print {
              html, body {
                width: ${printSettings.paperSize === '80mm' ? '72mm' : printSettings.paperSize === '50mm' ? '48mm' : '100%'};
                margin: 0; /* Important for thermal */
              }
            }

            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0;
              width: ${printSettings.paperSize === '80mm' ? '72mm' :
        printSettings.paperSize === '50mm' ? '48mm' : '100%'};
              /* Add a small margin for the content itself inside the paper */
              padding: ${printSettings.paperSize === '80mm' || printSettings.paperSize === '50mm' ? '2mm' : '20px'};
              color: #000;
              background: #fff;
            }

            .test-header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 2px dashed #000;
            }

            .test-content {
              padding: 5px 0;
            }

            /* Adjust sizes for thermal printing readability */
            h1 { font-size: ${Math.round((printSettings.fontSize || 12) * 1.5)}px; margin: 0; }
            h2 { font-size: ${Math.round((printSettings.fontSize || 12) * 1.3)}px; margin: 5px 0; }
            p { font-size: ${printSettings.fontSize || 12}px; margin: 3px 0; }
            
            /* Helper classes */
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="test-header">
            <h1>PRUEBA DE IMPRESIÓN</h1>
            <p>Tamaño de papel: ${printSettings.paperSize}</p>
          </div>
          <div class="test-content">
            <h2>Información del Sistema</h2>
            <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Hora:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Formato:</strong> ${printSettings.paperSize}</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
            <h2>Prueba de Texto</h2>
            <p>Este es un texto de prueba para verificar la impresión.</p>
            <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p>abcdefghijklmnopqrstuvwxyz</p>
            <p>0123456789</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px dashed #000;" />
            <h2>Prueba de Formato</h2>
            <p><strong>Negrita</strong> | <em>Cursiva</em> | <u>Subrayado</u></p>
            <p class="text-center">Texto Centrado</p>
            <p class="text-right">Texto Derecha</p>
            
            <div style="margin-top: 20px; text-align: center;">
              <p>*** FIN DE PRUEBA ***</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Use iframe method (more reliable, won't be blocked by popup blockers)
    const printWithIframe = () => {
      return new Promise<void>((resolve, reject) => {
        try {
          // First try window.open
          const printWindow = window.open('', '_blank', 'width=800,height=600');
          if (printWindow) {
            printWindow.document.write(testInvoiceHTML);
            printWindow.document.close();
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
                resolve();
              }, 200);
            };
            // Fallback if onload doesn't fire
            setTimeout(() => {
              printWindow.print();
              resolve();
            }, 500);
          } else {
            // Fallback to iframe if popup is blocked
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
              iframeDoc.write(testInvoiceHTML);
              iframeDoc.close();

              setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  resolve();
                }, 1000);
              }, 300);
            } else {
              reject(new Error('No se pudo crear el documento de impresión'));
            }
          }
        } catch (error) {
          reject(error);
        }
      });
    };

    printWithIframe()
      .then(() => {
        toast({
          title: "Impresión enviada",
          description: `Documento de prueba enviado a la impresora (${printSettings.paperSize})`,
        });
      })
      .catch((error) => {
        console.error('Error printing:', error);
        toast({
          title: "Error de impresión",
          description: "No se pudo imprimir. Intenta de nuevo.",
          variant: "destructive",
        });
      });
  };

  // Thermal printer functions
  const handleConnectThermalPrinter = async () => {
    const { thermalPrinter } = await import('@/utils/thermalPrinter');

    if (!thermalPrinter.isSupported()) {
      toast({
        title: "No soportado",
        description: "Tu navegador no soporta Web Serial API. Usa Chrome, Edge u Opera.",
        variant: "destructive",
      });
      return;
    }

    setShowPrinterDialog(true);
  };

  const handlePrinterConnected = async (deviceName: string) => {
    console.log('🖨️ Conectando impresora:', deviceName);

    // Actualizar estado local
    setPrintSettings(prev => ({
      ...prev,
      thermalPrinterConnected: true,
      thermalPrinterName: deviceName,
    }));

    // Guardar en la base de datos
    try {
      console.log('💾 Guardando en base de datos...', {
        thermal_printer_name: deviceName,
        use_thermal_printer: true,
      });

      await updateStoreSettings({
        thermal_printer_name: deviceName,
        use_thermal_printer: true,
      });

      console.log('✅ Impresora guardada exitosamente en la base de datos');

      toast({
        title: "Impresora Guardada",
        description: `"${deviceName}" ha sido configurada como impresora predeterminada`,
      });
    } catch (error) {
      console.error('❌ Error saving printer:', error);
      toast({
        title: "Error al guardar",
        description: "La impresora se conectó pero no se pudo guardar la configuración",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectThermalPrinter = async () => {
    const { thermalPrinter } = await import('@/utils/thermalPrinter');
    await thermalPrinter.disconnect();

    // Actualizar estado local
    setPrintSettings(prev => ({
      ...prev,
      thermalPrinterConnected: false,
      thermalPrinterName: '',
    }));

    // Guardar en la base de datos
    try {
      await updateStoreSettings({
        thermal_printer_name: null,
        use_thermal_printer: false,
      });

      toast({
        title: "Desconectado",
        description: "Impresora térmica desconectada y configuración guardada",
      });
    } catch (error) {
      console.error('Error saving disconnection:', error);
      toast({
        title: "Desconectado",
        description: "Impresora térmica desconectada (pero hubo un error al guardar)",
        variant: "destructive",
      });
    }
  };

  const handleThermalTestPrint = async () => {
    const { handlePrint, injectPrintStyles, markContentAsPrintable } = await import('@/utils/printHandler');
    const { generateCleanInvoiceHTML } = await import('@/utils/generateCleanInvoiceHTML');
    const JsBarcode = (await import('jsbarcode')).default;

    toast({
      title: "Imprimiendo...",
      description: "Enviando factura de prueba...",
    });

    try {
      // Generate barcode if needed
      let barcodeDataUrl: string | undefined;
      if (invoiceSettings.showBarcode) {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, 'B0200000001', {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 12,
            margin: 5
          });
          barcodeDataUrl = canvas.toDataURL();
        } catch (error) {
          console.error('Error generating barcode:', error);
        }
      }

      // Ensure styles are injected
      injectPrintStyles();

      // Determine format from settings
      let format: '80mm' | '58mm' | 'A4' = '80mm';
      if (printSettings.paperSize === '50mm' || printSettings.paperSize === '58mm') {
        format = '58mm';
      } else if (printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta') {
        format = 'A4';
      }

      // Generate test invoice HTML using EXACT same structure as preview
      const htmlContent = generateCleanInvoiceHTML(
        {
          name: companyInfo.name,
          logo: companyInfo.logo,
          logoSize: companyInfo.logoSize || 120,
          rnc: companyInfo.rnc,
          phone: companyInfo.phone,
          address: companyInfo.address,
          pageMargin: printSettings.pageMargin,
          containerPadding: printSettings.containerPadding,
          logoMarginBottom: printSettings.logoMarginBottom,
          fontSize: printSettings.fontSize, // Added font size
        },
        {
          invoiceNumber: 'B0200000001',
          invoicePrefix: 'B02',
          date: new Date(),
          items: [
            { name: 'Producto Ejemplo', quantity: 1, price: 100.00, total: 100.00 },
            { name: 'Servicio Ejemplo', quantity: 2, price: 75.00, total: 150.00 }
          ],
          subtotal: 250.00,
          tax: 45.00,
          taxRate: 18,
          total: 295.00,
          currency: invoiceSettings.currency || 'DOP',
          paymentTerms: invoiceSettings.paymentTerms,
          footerText: invoiceSettings.footerText,
          showBarcode: invoiceSettings.showBarcode,
          barcodeDataUrl: barcodeDataUrl,
        }
      );

      // Create print container
      let printContainer = document.getElementById('temp-print-container');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'temp-print-container';
        document.body.appendChild(printContainer);
      }

      printContainer.innerHTML = htmlContent;
      markContentAsPrintable('temp-print-container');

      await handlePrint(format);

      // Clean up
      if (printContainer.parentNode) {
        printContainer.parentNode.removeChild(printContainer);
      }

      toast({
        title: "Impresión exitosa",
        description: "La factura de prueba ha sido enviada.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error printing test invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Error al imprimir",
        variant: "destructive",
      });
    }
  };

  // Create store function
  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un nombre para tu tienda",
        variant: "destructive",
      });
      return;
    }

    setCreatingStore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No estás autenticado");
      }

      const { data, error } = await supabase.rpc('create_store_for_user', {
        user_id: user.id,
        company_name: storeName.trim()
      });

      if (error) throw error;

      toast({
        title: "¡Tienda creada!",
        description: "Tu tienda ha sido configurada exitosamente",
      });

      // Refresh store data
      queryClient.invalidateQueries({ queryKey: ['user-store'] });
      setStoreName('');
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la tienda",
        variant: "destructive",
      });
    } finally {
      setCreatingStore(false);
    }
  };

  const handleUpdateStoreName = async (newName: string) => {
    if (!newName.trim() || !userStore?.id) return;

    setLoading(true);
    try {
      // Create a slug from the name: "My Store" -> "my-store"
      const baseSlug = newName.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^\w\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-'); // Replace spaces with hyphens

      const storeCode = userStore.store_code || '';
      // Ensure unique slug by appending store code
      const newSlug = storeCode ? `${baseSlug}-${storeCode.toLowerCase()}` : baseSlug;

      const { error } = await supabase
        .from('stores')
        .update({
          store_name: newName.trim(),
          slug: newSlug
        })
        .eq('id', userStore.id);

      if (error) throw error;

      toast({
        title: "Nombre y enlace actualizados",
        description: "El nombre de la tienda y su enlace se han actualizado correctamente",
      });

      queryClient.invalidateQueries({ queryKey: ['user-store'] });
    } catch (error: any) {
      console.error('Error updating store:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre de la tienda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const handleExportData = async (isGlobal = false) => {
    if (!userStore?.id && !isGlobal) return;
    setLoading(true);
    try {
      // List of all functional tables in the database
      const tables = [
        'profiles', 'stores', 'categories', 'products', 'customers',
        'sales', 'sale_items', 'suppliers', 'expenses', 'payrolls',
        'payroll_items', 'invoice_sequences', 'invoice_types',
        'store_settings', 'company_settings', 'cash_sessions',
        'cash_movements', 'open_orders', 'open_order_items',
        'payment_methods_config'
      ];

      const backupData: any = {
        version: "1.1",
        timestamp: new Date().toISOString(),
        store_id: isGlobal ? 'GLOBAL' : userStore?.id,
        type: isGlobal ? 'FULL_DATABASE' : 'STORE_BACKUP',
        data: {}
      };

      for (const table of tables) {
        let query = supabase.from(table as any).select('*');

        let result;
        if (isGlobal) {
          result = await query;
        } else {
          // Try with store filter, fallback to no filter if column is missing
          result = await query.eq('store_id', userStore?.id);

          if (result.error && result.error.code === '42703') { // Column does not exist
            console.log(`Column store_id missing in ${table}, fetching without filter (RLS will still apply)`);
            result = await supabase.from(table as any).select('*');
          }
        }

        if (result.error) {
          console.warn(`Error fetching ${table}:`, result.error);
          continue;
        }
        backupData.data[table] = result.data;
      }

      const fileName = isGlobal
        ? `full-backup-${new Date().toISOString().split('T')[0]}.json`
        : `backup-${userStore?.slug || 'store'}-${new Date().toISOString().split('T')[0]}.json`;

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: isGlobal ? "Respaldo global completado" : "Respaldo completado",
        description: `El archivo ha sido descargado correctamente. (${tables.length} tablas procesadas)`,
      });
    } catch (error: any) {
      toast({
        title: "Error al exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userStore?.id) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string);

        if (!confirm("Atención: Esto reemplazará tus datos actuales. ¿Deseas continuar?")) return;

        setLoading(true);
        toast({ title: "Restaurando...", description: "Por favor espera mientras se procesan los datos." });

        const tables = [
          'payroll_items', 'payrolls', 'sale_items', 'sales',
          'expenses', 'suppliers', 'products', 'categories',
          'customers', 'invoice_sequences', 'store_settings', 'company_settings'
        ];

        // 1. Delete existing data for this store in correct order (children first)
        for (const table of tables) {
          await supabase.from(table as any).delete().eq('store_id', userStore.id);
        }

        // 2. Insert new data in correct order (parents first)
        const insertOrder = [
          'company_settings', 'store_settings', 'invoice_sequences',
          'categories', 'suppliers', 'products', 'customers',
          'sales', 'sale_items', 'payrolls', 'payroll_items', 'expenses'
        ];

        for (const table of insertOrder) {
          const rows = backupData.data[table];
          if (rows && rows.length > 0) {
            // Remove IDs to allow fresh insertion or keep them if needed? 
            // Better to keep them for relationship consistency if they are UUIDs.
            const rowsToInsert = rows.map((row: any) => ({
              ...row,
              store_id: userStore.id
            }));

            const { error } = await supabase.from(table as any).insert(rowsToInsert);
            if (error) console.error(`Error inserting into ${table}:`, error);
          }
        }

        toast({
          title: "Restauración exitosa",
          description: "Tus datos han sido restaurados correctamente.",
        });

        queryClient.invalidateQueries();
      } catch (error: any) {
        toast({
          title: "Error al importar",
          description: "El archivo no es válido o está dañado.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
        // Reset input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetSystem = async () => {
    if (!userStore?.id) return;

    const confirmed = confirm("¿ESTÁS COMPLETAMENTE SEGURO? Esta acción borrará TODOS tus productos, ventas, clientes y gastos. No se puede deshacer.");
    if (!confirmed) return;

    const doubleConfirmed = prompt("Escribe 'BORRAR TODO' para confirmar el reseteo del sistema:");
    if (doubleConfirmed !== 'BORRAR TODO') {
      toast({ title: "Cancelado", description: "La palabra de confirmación no coincide." });
      return;
    }

    setLoading(true);
    try {
      const tables = [
        'payroll_items', 'payrolls', 'sale_items', 'sales',
        'expenses', 'suppliers', 'products', 'categories',
        'customers', 'invoice_sequences'
      ];

      for (const table of tables) {
        await supabase.from(table as any).delete().eq('store_id', userStore.id);
      }

      // Re-initialize default invoice sequences
      const { data: invoiceTypes } = await supabase.from('invoice_types').select('id');
      if (invoiceTypes) {
        const sequences = invoiceTypes.map(type => ({
          invoice_type_id: type.id,
          current_number: 0,
          store_id: userStore.id
        }));
        await supabase.from('invoice_sequences').insert(sequences);
      }

      toast({
        title: "Sistema reseteado",
        description: "Se han eliminado todos los datos. Puedes empezar de cero.",
      });

      queryClient.invalidateQueries();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo resetear el sistema.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mobile banners section content
  const mobileBannersSectionContent = (
    <BannerSettingsSection />
  );

  // Mobile-optimized sections content
  const mobileStoreSectionContent = (
    <div className="space-y-8">
      <SettingsStoreSection
        storeLoading={storeLoading}
        userStore={userStore}
        profile={profile}
        storeName={storeName}
        setStoreName={setStoreName}
        creatingStore={creatingStore}
        handleCreateStore={handleCreateStore}
        onUpdateStoreName={handleUpdateStoreName}
        isMobile={true}
        logoUrl={logoPreview}
        shopType={shopType}
        setShopType={setShopType}
        handleSaveSettings={handleSaveSettings}
      />
      <Separator />
      <BannerSettingsSection />
    </div>
  );

  const mobileCompanySectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">Nombre de la Empresa</Label>
          <Input
            id="company-name"
            value={companyInfo.name}
            onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-rnc">RNC</Label>
          <Input
            id="company-rnc"
            value={companyInfo.rnc}
            onChange={(e) => setCompanyInfo({ ...companyInfo, rnc: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-phone">Teléfono</Label>
          <Input
            id="company-phone"
            value={companyInfo.phone}
            onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-email">Email</Label>
          <Input
            id="company-email"
            type="email"
            value={companyInfo.email}
            onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-website">Sitio Web</Label>
          <Input
            id="company-website"
            value={companyInfo.website}
            onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-address">Dirección</Label>
          <Textarea
            id="company-address"
            value={companyInfo.address}
            onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
            rows={2}
          />
        </div>
      </div>
      <Button onClick={() => handleSaveSettings('empresa')} disabled={loading || isUpdating || isUploadingLogo} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Guardar
      </Button>
    </div>
  );

  const mobileInvoicesSectionContent = (
    <div className="space-y-6 pb-10">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-prefix">Prefijo de Factura</Label>
          <Input
            id="invoice-prefix"
            value={invoiceSettings.invoicePrefix}
            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoicePrefix: e.target.value.toUpperCase() })}
            placeholder="FAC-"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Select value={invoiceSettings.currency} onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, currency: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DOP">Peso Dominicano (DOP)</SelectItem>
              <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
              <SelectItem value="EUR">Euro (EUR)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax-rate">Tasa de Impuesto (%)</Label>
          <Input
            id="tax-rate"
            type="number"
            value={invoiceSettings.defaultTaxRate}
            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, defaultTaxRate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-terms">Términos de Pago (días)</Label>
          <Input
            id="payment-terms"
            type="number"
            value={invoiceSettings.paymentTerms}
            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Auto-incrementar</p>
            <p className="text-xs text-muted-foreground">Incrementar número automáticamente</p>
          </div>
          <Switch
            checked={invoiceSettings.autoIncrement}
            onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, autoIncrement: checked })}
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Código de Barras NCF</p>
            <p className="text-xs text-muted-foreground">Mostrar código en facturas</p>
          </div>
          <Switch
            checked={invoiceSettings.showBarcode}
            onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, showBarcode: checked })}
          />
        </div>

        <Separator />
        <h4 className="text-sm font-medium">Estilo de Factura</h4>

        <div className="space-y-2">
          <Label htmlFor="font-size-mobile">Tamaño de Fuente (px)</Label>
          <div className="flex items-center gap-4">
            <Input
              id="font-size-mobile"
              type="number"
              value={printSettings.fontSize || 12}
              onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
              className="w-20"
            />
            <input
              type="range"
              min="8"
              max="24"
              value={printSettings.fontSize || 12}
              onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logo-margin-top-mobile" className="text-xs">Margen Logo Sup.</Label>
            <Select
              value={printSettings.logoMarginTop || '6px'}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginTop: value })}
            >
              <SelectTrigger id="logo-margin-top-mobile" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo-margin-bottom-mobile" className="text-xs">Margen Logo Inf.</Label>
            <Select
              value={printSettings.logoMarginBottom || '6px'}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
            >
              <SelectTrigger id="logo-margin-bottom-mobile" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button onClick={() => handleSaveSettings('facturas')} disabled={loading || isUpdatingStoreSettings} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Guardar Configuración
      </Button>
    </div>
  );

  const mobilePaymentsSectionContent = (
    <div className="space-y-6">
      <div className="space-y-3">
        {paymentMethods.map((method) => (
          <div key={method.id} className="flex items-center justify-between p-4 bg-card border rounded-lg">
            <div>
              <h4 className="font-medium">{method.name}</h4>
            </div>
            <Switch
              checked={method.enabled}
              onCheckedChange={(checked) => {
                setPaymentMethods(prev => prev.map(m =>
                  m.id === method.id ? { ...m, enabled: checked } : m
                ));
              }}
            />
          </div>
        ))}
      </div>
      <Button onClick={() => handleSaveSettings('pagos')} disabled={loading || isUpdatingStoreSettings} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Guardar
      </Button>
    </div>
  );

  const mobileProductsSectionContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
        <div>
          <p className="font-medium text-sm">Alertas de Stock Bajo</p>
          <p className="text-xs text-muted-foreground">Notificaciones cuando el stock esté bajo</p>
        </div>
        <Switch
          checked={systemSettings.lowStockAlert}
          onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, lowStockAlert: checked })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="stock-threshold">Umbral de Stock Bajo</Label>
        <Input
          id="stock-threshold"
          type="number"
          value={systemSettings.lowStockThreshold}
          onChange={(e) => setSystemSettings({ ...systemSettings, lowStockThreshold: e.target.value })}
        />
      </div>
      <Button onClick={() => handleSaveSettings('productos')} disabled={loading || isUpdatingStoreSettings} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Guardar
      </Button>
    </div>
  );

  const mobilePrintSectionContent = (
    <div className="space-y-6 pb-20">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="paper-size">Tamaño de Papel</Label>
          <Select
            value={printSettings.paperSize}
            onValueChange={(value) => setPrintSettings({ ...printSettings, paperSize: value })}
          >
            <SelectTrigger id="paper-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80mm">80mm (Térmica Estándar)</SelectItem>
              <SelectItem value="50mm">50mm (Térmica Pequeña)</SelectItem>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="carta">Carta</SelectItem>
            </SelectContent>
          </Select>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-[10px] text-blue-600 dark:text-blue-400">
              💡 <span className="font-semibold">Importante:</span> Esta configuración se aplica a "Imprimir directamente" en el POS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="page-margin" className="text-xs">Margen Página</Label>
            <Select
              value={printSettings.pageMargin}
              onValueChange={(value) => setPrintSettings({ ...printSettings, pageMargin: value })}
            >
              <SelectTrigger id="page-margin" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0mm">0mm</SelectItem>
                <SelectItem value="2mm">2mm</SelectItem>
                <SelectItem value="4mm">4mm</SelectItem>
                <SelectItem value="6mm">6mm</SelectItem>
                <SelectItem value="8mm">8mm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-padding" className="text-xs">Padding Interno</Label>
            <Select
              value={printSettings.containerPadding}
              onValueChange={(value) => setPrintSettings({ ...printSettings, containerPadding: value })}
            >
              <SelectTrigger id="container-padding" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
                <SelectItem value="16px">16px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logo-margin-top" className="text-xs">Margen Logo (Superior)</Label>
            <Select
              value={printSettings.logoMarginTop || '6px'}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginTop: value })}
            >
              <SelectTrigger id="logo-margin-top" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="2px">2px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="6px">6px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-margin-bottom" className="text-xs">Margen Logo (Inferior)</Label>
            <Select
              value={printSettings.logoMarginBottom}
              onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
            >
              <SelectTrigger id="logo-margin-bottom" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0px">0px</SelectItem>
                <SelectItem value="2px">2px</SelectItem>
                <SelectItem value="4px">4px</SelectItem>
                <SelectItem value="6px">6px</SelectItem>
                <SelectItem value="8px">8px</SelectItem>
                <SelectItem value="12px">12px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center">
            <Printer className="mr-2 h-4 w-4" />
            Información del Formato
          </h4>
          <div className="bg-muted p-3 rounded-lg space-y-1">
            {printSettings.paperSize === '80mm' && (
              <>
                <p className="text-[11px]"><strong>Ancho:</strong> 80mm (3.15")</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Térmica de 80mm</p>
                <p className="text-[11px]"><strong>Método:</strong> Impresión directa</p>
              </>
            )}
            {printSettings.paperSize === '50mm' && (
              <>
                <p className="text-[11px]"><strong>Ancho:</strong> 50mm (2")</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Térmica portátil</p>
                <p className="text-[11px]"><strong>Método:</strong> Impresión directa</p>
              </>
            )}
            {printSettings.paperSize === 'A4' || printSettings.paperSize === 'carta' ? (
              <>
                <p className="text-[11px]"><strong>Documento:</strong> Formato completo</p>
                <p className="text-[11px]"><strong>Tipo:</strong> Láser/Inyección</p>
              </>
            ) : null}
          </div>
        </div>

        <Separator />

        <h4 className="text-sm font-medium flex items-center">
          <Printer className="mr-2 h-4 w-4" />
          Impresora Térmica
        </h4>

        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Impresión Directa</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              {printSettings.thermalPrinterConnected ? (
                <>
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {printSettings.thermalPrinterName}
                </>
              ) : 'No conectada'}
            </p>
          </div>
          <Switch
            checked={printSettings.useThermalPrinter}
            onCheckedChange={(checked) => setPrintSettings({ ...printSettings, useThermalPrinter: checked })}
            disabled={!printSettings.thermalPrinterConnected}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleConnectThermalPrinter}
            variant="outline"
            className="h-10 text-xs"
          >
            <Printer className="mr-2 h-4 w-4 text-primary" />
            {printSettings.thermalPrinterConnected ? 'Cambiar' : 'Conectar'}
          </Button>

          {printSettings.thermalPrinterConnected && (
            <Button
              onClick={() => {
                thermalPrinter.disconnect();
                setPrintSettings(prev => ({ ...prev, thermalPrinterConnected: false }));
              }}
              variant="outline"
              className="h-10 text-xs text-destructive border-destructive/20 hover:bg-destructive/10"
            >
              Desconectar
            </Button>
          )}
        </div>

        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 space-y-2">
          <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400">Consejos</h5>
          <ul className="text-[10px] space-y-1 text-muted-foreground list-disc pl-4">
            <li>Realiza una prueba antes de usar en producción</li>
            <li>Verifica si el tamaño coincide con tu impresora</li>
            <li>Para térmicas, usa papel de calidad</li>
          </ul>
        </div>

        <div className="flex gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm pt-4 pb-2">
          <Button onClick={handleSavePrintSettings} disabled={loading || isUpdatingStoreSettings} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Guardar
          </Button>
          <Button onClick={handleTestPrint} variant="outline">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Mobile Notifications Section Content
  const mobileNotificationsSectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center">
          <Volume2 className="mr-2 h-4 w-4" />
          Sonido de Pedidos Web
        </h4>

        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Sonido de Notificación</p>
            <p className="text-xs text-muted-foreground">Reproducir sonido con nuevos pedidos</p>
          </div>
          <Switch
            checked={storeSettings?.web_order_sound_enabled ?? true}
            onCheckedChange={(checked) => updateStoreSettings({ web_order_sound_enabled: checked })}
          />
        </div>

        {(storeSettings?.web_order_sound_enabled ?? true) && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Sonido</Label>
              <div className="flex gap-2">
                <Select
                  value={storeSettings?.web_order_sound_type ?? 'chime'}
                  onValueChange={(value) => updateStoreSettings({ web_order_sound_type: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chime">🔔 Campanilla</SelectItem>
                    <SelectItem value="bell">🛎️ Campana</SelectItem>
                    <SelectItem value="ding">✨ Ding</SelectItem>
                    <SelectItem value="alert">⚠️ Alerta</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    import('@/utils/notificationSounds').then(({ playNotificationSound }) => {
                      playNotificationSound(
                        (storeSettings?.web_order_sound_type as any) ?? 'chime',
                        true,
                        storeSettings?.web_order_sound_volume ?? 0.7
                      );
                    });
                  }}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Volumen</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round((storeSettings?.web_order_sound_volume ?? 0.7) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={storeSettings?.web_order_sound_volume ?? 0.7}
                onChange={(e) => updateStoreSettings({ web_order_sound_volume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="font-medium flex items-center">
          <Bell className="mr-2 h-4 w-4" />
          Notificaciones del Sistema
        </h4>
        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Notificaciones</p>
            <p className="text-xs text-muted-foreground">Recibir alertas del sistema</p>
          </div>
          <Switch
            checked={systemSettings.notifications}
            onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, notifications: checked })}
          />
        </div>
      </div>
    </div>
  );

  const mobileSystemSectionContent = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Idioma</Label>
          <Select value={systemSettings.language} onValueChange={(value) => setSystemSettings({ ...systemSettings, language: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Zona Horaria</Label>
          <Select value={systemSettings.timezone} onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Santo_Domingo">Santo Domingo</SelectItem>
              <SelectItem value="America/New_York">New York</SelectItem>
              <SelectItem value="America/Los_Angeles">Los Angeles</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tema</Label>
          <Select value={systemSettings.theme} onValueChange={(value) => setSystemSettings({ ...systemSettings, theme: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Oscuro</SelectItem>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="auto">Automático</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
          <div>
            <p className="font-medium text-sm">Respaldo Automático</p>
            <p className="text-xs text-muted-foreground">Crear respaldos de los datos</p>
          </div>
          <Switch
            checked={systemSettings.autoBackup}
            onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, autoBackup: checked })}
          />
        </div>
      </div>
      <Button onClick={() => handleSaveSettings('sistema')} disabled={loading || isUpdatingStoreSettings} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        Guardar
      </Button>
    </div>
  );

  const mobileAdvancedSectionContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-20 flex-col">
          <Download className="mb-1 h-5 w-5" />
          <span className="text-xs">Exportar</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col">
          <Upload className="mb-1 h-5 w-5" />
          <span className="text-xs">Importar</span>
        </Button>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Frecuencia de Respaldo</Label>
          <Select defaultValue="daily">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Cada Hora</SelectItem>
              <SelectItem value="daily">Diario</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="p-4 border border-destructive rounded-lg">
        <h5 className="font-medium mb-2 text-destructive">Zona de Peligro</h5>
        <p className="text-sm text-muted-foreground mb-4">
          Esto eliminará todos los datos
        </p>
        <Button variant="destructive" size="sm" className="w-full">
          Resetear Sistema
        </Button>
      </div>
    </div>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-full">
        <MobileSettingsLayout
          activeSection={mobileActiveSection}
          onSectionChange={setMobileActiveSection}
        >
          {{
            store: mobileStoreSectionContent,
            company: mobileCompanySectionContent,
            invoices: mobileInvoicesSectionContent,
            payments: mobilePaymentsSectionContent,
            products: mobileProductsSectionContent,
            print: mobilePrintSectionContent,
            notifications: mobileNotificationsSectionContent,
            system: mobileSystemSectionContent,
            advanced: mobileAdvancedSectionContent,
          }}
        </MobileSettingsLayout>
        <ThermalPrinterDialog
          open={showPrinterDialog}
          onOpenChange={setShowPrinterDialog}
          onConnect={handlePrinterConnected}
        />
      </div>
    );
  }

  // Desktop layout (existing)
  return (
    <div className="p-6 space-y-6 max-h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">Administra la configuración del sistema de facturación</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="store">Mi Tienda</TabsTrigger>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="print">Impresión</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
          <TabsTrigger value="advanced">Avanzado</TabsTrigger>
        </TabsList>

        {/* Store Settings - Mi Tienda */}
        <TabsContent value="store" className="space-y-6">
          <SettingsStoreSection
            storeLoading={storeLoading}
            userStore={userStore}
            profile={profile}
            storeName={storeName}
            setStoreName={setStoreName}
            creatingStore={creatingStore}
            handleCreateStore={handleCreateStore}
            onUpdateStoreName={handleUpdateStoreName}
            logoUrl={logoPreview}
            shopType={shopType}
            setShopType={setShopType}
            handleSaveSettings={handleSaveSettings}
          />
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ImageIcon className="mr-2 h-5 w-5" />
                Banners Promocionales
              </CardTitle>
              <CardDescription>
                Configura los banners que aparecerán en la parte superior de tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BannerSettingsSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Settings */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>
                Configura los datos de tu empresa que aparecerán en las facturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nombre de la Empresa</Label>
                  <Input
                    id="company-name"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-rnc">RNC</Label>
                  <Input
                    id="company-rnc"
                    value={companyInfo.rnc}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, rnc: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Teléfono</Label>
                  <Input
                    id="company-phone"
                    value={companyInfo.phone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-website">Sitio Web</Label>
                  <Input
                    id="company-website"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-address">Dirección</Label>
                <Textarea
                  id="company-address"
                  value={companyInfo.address}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-4">
                <Label>Logo de la Empresa</Label>

                {logoPreview ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center w-full max-w-xs p-4 border-2 border-dashed border-border rounded-lg bg-muted/50">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="logo-size">Tamaño en Factura (px)</Label>
                          <Input
                            id="logo-size"
                            type="number"
                            value={companyInfo.logoSize || 120}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, logoSize: parseInt(e.target.value) || 120 })}
                            min="50"
                            max="300"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="logo-cart-size">Tamaño en Carrito (px)</Label>
                          <Input
                            id="logo-cart-size"
                            type="number"
                            value={companyInfo.logoCartSize || 200}
                            onChange={(e) => setCompanyInfo({ ...companyInfo, logoCartSize: parseInt(e.target.value) || 200 })}
                            min="100"
                            max="400"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="logo-summary-size">Tamaño en Resumen (px)</Label>
                        <Input
                          id="logo-summary-size"
                          type="number"
                          value={companyInfo.logoSummarySize || 64}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, logoSummarySize: parseInt(e.target.value) || 64 })}
                          min="30"
                          max="150"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('company-logo')?.click()}
                      >
                        Cambiar Logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                      >
                        Remover Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center w-full max-w-xs h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => document.getElementById('company-logo')?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Haz clic para subir el logo
                    </p>
                  </div>
                )}

                <Input
                  id="company-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: JPG, PNG. Tamaño máximo: 2MB. Recomendado: 500px ancho (PNG).
                </p>
                {logoUploadError && (
                  <p className="text-sm text-red-500 font-medium mt-1">
                    Error: {logoUploadError}
                  </p>
                )}
              </div>
              <Button onClick={() => handleSaveSettings('empresa')} disabled={loading || isUpdating || isUploadingLogo}>
                <Save className="mr-2 h-4 w-4" />
                Guardar Información de la Empresa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Settings */}
        <TabsContent value="invoices">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Configuración de Facturas
                </CardTitle>
                <CardDescription>
                  Personaliza el formato y numeración de tus facturas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Layout de 2 columnas: Formulario + Vista Previa */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Columna izquierda: Formulario */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Moneda</Label>
                        <Select value={invoiceSettings.currency} onValueChange={(value) => setInvoiceSettings({ ...invoiceSettings, currency: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DOP">Peso Dominicano (DOP)</SelectItem>
                            <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
                            <SelectItem value="EUR">Euro (EUR)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="logo-size">Tamaño del Logo (px)</Label>
                        <Input
                          id="logo-size"
                          type="number"
                          min="40"
                          max="200"
                          value={companyInfo.logoSize}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, logoSize: parseInt(e.target.value) || 120 })}
                        />
                        <Label htmlFor="logo-size">Tamaño del Logo (px)</Label>
                        <Input
                          id="logo-size"
                          type="number"
                          min="40"
                          max="200"
                          value={companyInfo.logoSize}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, logoSize: parseInt(e.target.value) || 120 })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="font-size">Tamaño de Fuente (px)</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            id="font-size"
                            type="number"
                            min="8"
                            max="24"
                            value={printSettings.fontSize || 12}
                            onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
                            className="w-20"
                          />
                          <input
                            type="range"
                            min="8"
                            max="24"
                            step="1"
                            value={printSettings.fontSize || 12}
                            onChange={(e) => setPrintSettings({ ...printSettings, fontSize: parseInt(e.target.value) || 12 })}
                            className="flex-1 cursor-pointer"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Ajusta el tamaño base de la letra en la factura.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo-margin-top-invoice">Margen Logo (Superior)</Label>
                        <Select
                          value={printSettings.logoMarginTop || '6px'}
                          onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginTop: value })}
                        >
                          <SelectTrigger id="logo-margin-top-invoice">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">Sin espacio (0px)</SelectItem>
                            <SelectItem value="2px">Muy pequeño (2px)</SelectItem>
                            <SelectItem value="4px">Pequeño (4px)</SelectItem>
                            <SelectItem value="6px">Normal (6px)</SelectItem>
                            <SelectItem value="8px">Medio (8px)</SelectItem>
                            <SelectItem value="12px">Grande (12px)</SelectItem>
                            <SelectItem value="16px">Muy grande (16px)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Espacio arriba del logo
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="logo-margin-invoice">Margen Logo (Inferior)</Label>
                        <Select
                          value={printSettings.logoMarginBottom || '6px'}
                          onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
                        >
                          <SelectTrigger id="logo-margin-invoice">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0px">Sin espacio (0px)</SelectItem>
                            <SelectItem value="2px">Muy pequeño (2px)</SelectItem>
                            <SelectItem value="4px">Pequeño (4px)</SelectItem>
                            <SelectItem value="6px">Normal (6px)</SelectItem>
                            <SelectItem value="8px">Medio (8px)</SelectItem>
                            <SelectItem value="12px">Grande (12px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col justify-center space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="logo-width"
                            checked={printSettings.logoWidth === 'full'}
                            onCheckedChange={(checked) => setPrintSettings({ ...printSettings, logoWidth: checked ? 'full' : 'auto' })}
                          />
                          <Label htmlFor="logo-width">Ajustar al Ancho Completo</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Expande el logo a todo el ancho del papel, ignorando la altura fija.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Mostrar Código de Barras NCF</Label>
                        <p className="text-sm text-muted-foreground">
                          Muestra el código de barras del NCF al final de la factura
                        </p>
                      </div>
                      <Switch
                        checked={invoiceSettings.showBarcode || false}
                        onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, showBarcode: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto-incrementar Numeración</Label>
                        <p className="text-sm text-muted-foreground">
                          Incrementar automáticamente el número de factura
                        </p>
                      </div>
                      <Switch
                        checked={invoiceSettings.autoIncrement}
                        onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, autoIncrement: checked })}
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tax-rate">Tasa de Impuesto (%)</Label>
                        <Input
                          id="tax-rate"
                          type="number"
                          value={invoiceSettings.defaultTaxRate}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, defaultTaxRate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-terms">Términos de Pago (días)</Label>
                        <Input
                          id="payment-terms"
                          type="number"
                          value={invoiceSettings.paymentTerms}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, paymentTerms: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="footer-text">Texto del Pie de Página</Label>
                      <Textarea
                        id="footer-text"
                        value={invoiceSettings.footerText}
                        onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerText: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <Separator className="my-6" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center">
                        <Mail className="mr-2 h-5 w-5" />
                        Configuración de Email Personalizado
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Personaliza el saludo y el mensaje que reciben tus clientes al enviar una factura por correo.
                      </p>

                      <div className="space-y-2">
                        <Label htmlFor="email-greeting">Saludo del Email</Label>
                        <Input
                          id="email-greeting"
                          placeholder="Ej: ¡Hola!"
                          value={invoiceSettings.emailGreeting}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailGreeting: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-message">Mensaje del Email</Label>
                        <Textarea
                          id="email-message"
                          placeholder="Escribe el mensaje de agradecimiento..."
                          value={invoiceSettings.emailMessage}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, emailMessage: e.target.value })}
                          rows={4}
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button onClick={() => handleSaveSettings('facturas')} disabled={loading || isUpdatingStoreSettings}>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Configuración de Facturas
                      </Button>
                    </div>
                  </div>

                  {/* Columna derecha: Vista Previa */}
                  <div className="lg:sticky lg:top-6 h-fit">
                    <div className="border rounded-lg p-6 bg-white dark:bg-gray-900 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Vista Previa del Recibo</h3>
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">EN VIVO</span>
                      </div>

                      {/* Simulación del recibo - Fondo BLANCO PURO (Simulación papel) - Dynamic Font Size */}
                      <div className="border border-gray-200 p-2 space-y-1 max-w-md mx-auto shadow-sm" style={{ backgroundColor: '#ffffff', color: '#000000', fontSize: `${printSettings.fontSize || 12}px`, lineHeight: '1.2' }}>
                        {/* Logo */}
                        {companyInfo.logo && (
                          <div className="text-center" style={{ marginTop: printSettings.logoMarginTop, marginBottom: printSettings.logoMarginBottom }}>
                            <img
                              src={companyInfo.logo}
                              alt="Logo"
                              className="mx-auto w-auto object-contain grayscale"
                              style={{
                                maxHeight: printSettings.logoWidth === 'full' ? 'none' : `${companyInfo.logoSize}px`,
                                width: printSettings.logoWidth === 'full' ? '100%' : 'auto',
                                height: 'auto',
                                maxWidth: '100%'
                              }}
                            />
                          </div>
                        )}

                        {/* Header */}
                        <div className="text-center border-b border-black pb-1 mb-1">
                          <h2 className="font-bold mb-1" style={{ color: '#000', fontSize: '1.25em' }}>{companyInfo.name}</h2>
                          {companyInfo.rnc && <p className="leading-tight" style={{ color: '#000', fontSize: '0.9em' }}>RNC: {companyInfo.rnc}</p>}
                          {companyInfo.phone && <p className="leading-tight" style={{ color: '#000', fontSize: '0.9em' }}>{companyInfo.phone}</p>}
                          {companyInfo.address && <p className="leading-tight" style={{ color: '#000', fontSize: '0.9em' }}>{companyInfo.address}</p>}
                        </div>

                        {/* Número de factura - Solo NCF */}
                        {/* Número de factura - Solo NCF */}
                        <div className="text-center py-1 border-b border-black mb-1">
                          <p className="font-bold leading-none" style={{ color: '#000', fontSize: '1.1em' }}>NCF</p>
                          <p className="font-mono font-bold leading-tight" style={{ color: '#000', fontSize: '1em' }}>B0200000001</p>
                          <p className="leading-tight" style={{ color: '#000', fontSize: '0.9em' }}>{new Date().toLocaleDateString('es-DO')}</p>
                        </div>

                        {/* Items ejemplo */}
                        {/* Items ejemplo */}
                        {/* Items ejemplo */}
                        <div className="border-t border-b border-black py-1 space-y-0.5 mb-1">
                          <div className="flex justify-between" style={{ fontSize: '0.9em' }}>
                            <span style={{ color: '#000' }}>Producto Ejemplo x1</span>
                            <span className="font-mono" style={{ color: '#000' }}>{invoiceSettings.currency} 100.00</span>
                          </div>
                          <div className="flex justify-between" style={{ fontSize: '0.9em' }}>
                            <span style={{ color: '#000' }}>Servicio Ejemplo x2</span>
                            <span className="font-mono" style={{ color: '#000' }}>{invoiceSettings.currency} 150.00</span>
                          </div>
                        </div>

                        {/* Totales */}
                        <div className="space-y-0.5 mb-1">
                          <div className="flex justify-between" style={{ fontSize: '0.9em' }}>
                            <span style={{ color: '#000' }}>Subtotal:</span>
                            <span className="font-mono" style={{ color: '#000' }}>{invoiceSettings.currency} 250.00</span>
                          </div>
                          <div className="flex justify-between" style={{ fontSize: '0.9em' }}>
                            <span style={{ color: '#000' }}>ITBIS ({invoiceSettings.defaultTaxRate}%):</span>
                            <span className="font-mono" style={{ color: '#000' }}>{invoiceSettings.currency} {(250 * parseFloat(invoiceSettings.defaultTaxRate || '0') / 100).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-black pt-2 mt-1" style={{ fontSize: '1.1em' }}>
                            <span style={{ color: '#000' }}>TOTAL:</span>
                            <span className="font-mono" style={{ color: '#000' }}>{invoiceSettings.currency} {(250 * (1 + parseFloat(invoiceSettings.defaultTaxRate || '0') / 100)).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Footer */}
                        {invoiceSettings.footerText && (
                          <div className="text-center border-t border-black pt-2 mt-3" style={{ fontSize: '0.9em' }}>
                            <p style={{ color: '#000' }}>{invoiceSettings.footerText}</p>
                          </div>
                        )}

                        {/* Términos de pago */}
                        {invoiceSettings.paymentTerms && (
                          <div className="text-center text-[10px] pt-2">
                            <p style={{ color: '#666' }}>Términos de pago: {invoiceSettings.paymentTerms} días</p>
                          </div>
                        )}

                        {/* Código de Barras */}
                        {invoiceSettings.showBarcode && (
                          <div className="text-center pt-3 mt-3 border-t border-dashed" style={{ borderColor: '#000' }}>
                            <div className="bg-white p-2 inline-block">
                              <svg width="200" height="50" className="mx-auto">
                                <rect width="200" height="50" fill="white" />
                                {/* Simulación de código de barras */}
                                {[...Array(20)].map((_, i) => (
                                  <rect
                                    key={i}
                                    x={10 + i * 9}
                                    y="5"
                                    width={Math.random() > 0.5 ? 3 : 2}
                                    height="35"
                                    fill="black"
                                  />
                                ))}
                                <text x="100" y="48" fontSize="8" textAnchor="middle" fill="black">B0200000001</text>
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground text-center mt-4">
                        ✨ Los cambios se reflejan automáticamente
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hash className="mr-2 h-5 w-5" />
                  Secuencias de Facturas
                </CardTitle>
                <CardDescription>
                  Configura y administra las secuencias numéricas para cada tipo de factura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {sequencesLoading ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Cargando secuencias...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invoiceSequences
                      ?.filter(seq => ['B01', 'B02'].includes(seq.invoice_type_id))
                      .map((sequence) => {
                        const invoiceType = invoiceTypes?.find(type => type.id === sequence.invoice_type_id);
                        const minNumber = maxInvoiceNumbers?.[sequence.invoice_type_id] || 0;
                        return (
                          <div key={sequence.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{sequence.invoice_type_id}</span>
                                <span className="text-muted-foreground">-</span>
                                <span className="text-sm text-muted-foreground">{invoiceType?.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {invoiceType?.description}
                              </p>
                              {minNumber > 0 && (
                                <p className="text-xs text-amber-500">
                                  Mínimo permitido: {minNumber + 1} (siguiente a la última factura usada)
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Próximo Número</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={sequence.current_number + 1}
                                    onChange={(e) => {
                                      const newValue = parseInt(e.target.value);
                                      if (newValue > 0) {
                                        // Guardamos newValue - 1 porque current_number es el último usado
                                        handleUpdateSequence(sequence.id, newValue - 1, sequence.invoice_type_id);
                                      }
                                    }}
                                    className="w-24 text-center"
                                    min={(minNumber || 0) + 1}
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    → {sequence.invoice_type_id}-{String(sequence.current_number + 1).padStart(8, '0')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Printer className="mr-2 h-5 w-5" />
                  Configuración de Impresión
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tamaño de Papel</Label>
                    <Select defaultValue="a4">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a4">A4</SelectItem>
                        <SelectItem value="letter">Carta</SelectItem>
                        <SelectItem value="thermal">Térmico 80mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Impresora Predeterminada</Label>
                    <Select defaultValue="default">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Impresora del Sistema</SelectItem>
                        <SelectItem value="thermal">Impresora Térmica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Métodos de Pago
              </CardTitle>
              <CardDescription>
                Configura los métodos de pago disponibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex flex-col gap-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{method.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Método de pago {method.name.toLowerCase()}
                        </p>
                      </div>
                      <Switch
                        checked={method.enabled}
                        onCheckedChange={(checked) => {
                          setPaymentMethods(prev => prev.map(m =>
                            m.id === method.id ? { ...m, enabled: checked } : m
                          ));
                        }}
                      />
                    </div>
                    {method.id === 'card' && method.enabled && (
                      <div className="flex items-center gap-4 pl-4 border-l-2 border-primary/20">
                        <Label htmlFor={`surcharge-${method.id}`} className="min-w-fit">
                          Recargo por uso (%):
                        </Label>
                        <Input
                          id={`surcharge-${method.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-24"
                          value={method.surcharge_percentage || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPaymentMethods(prev => prev.map(m =>
                              m.id === method.id ? { ...m, surcharge_percentage: val } : m
                            ));
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          Se aplicará al total de la factura
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={() => handleSaveSettings('pagos')} disabled={loading || isUpdatingStoreSettings}>
                <Save className="mr-2 h-4 w-4" />
                Guardar Métodos de Pago
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Settings */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Configuración de Productos
              </CardTitle>
              <CardDescription>
                Gestiona categorías y configuración de inventario
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas de Stock Bajo</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones cuando el stock esté bajo
                  </p>
                </div>
                <Switch
                  checked={systemSettings.lowStockAlert}
                  onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, lowStockAlert: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock-threshold">Umbral de Stock Bajo</Label>
                <Input
                  id="stock-threshold"
                  type="number"
                  value={systemSettings.lowStockThreshold}
                  onChange={(e) => setSystemSettings({ ...systemSettings, lowStockThreshold: e.target.value })}
                  className="w-32"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Categorías de Productos</h4>
                <div className="space-y-2">
                  {categoriesLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando categorías...</p>
                  ) : categories && categories.length > 0 ? (
                    categories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 border rounded">
                        <span>{category.name}</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCategoryForm({ id: category.id, name: category.name, description: category.description || '' });
                              setShowCategoryDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (confirm('¿Estás seguro de eliminar esta categoría?')) {
                                try {
                                  await deleteCategoryMutation.mutateAsync(category.id);
                                  toast({ title: "Categoría eliminada" });
                                } catch (e) {
                                  toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No hay categorías configuradas.</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategoryForm({ id: '', name: '', description: '' });
                    setShowCategoryDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir Nueva Categoría
                </Button>
              </div>

              {/* Category Management Dialog */}
              <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{categoryForm.id ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
                    <DialogDescription>
                      Ingresa los detalles de la categoría para tus productos.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Nombre</Label>
                      <Input
                        id="cat-name"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="Ej: Bebidas, Snacks..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-desc">Descripción (Opcional)</Label>
                      <Input
                        id="cat-desc"
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        placeholder="Breve descripción..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancelar</Button>
                    <Button
                      onClick={async () => {
                        if (!categoryForm.name) return;
                        try {
                          if (categoryForm.id) {
                            await updateCategoryMutation.mutateAsync({ id: categoryForm.id, name: categoryForm.name, description: categoryForm.description });
                            toast({ title: "Categoría actualizada" });
                          } else {
                            await createCategoryMutation.mutateAsync({ name: categoryForm.name, description: categoryForm.description });
                            toast({ title: "Categoría creada" });
                          }
                          setShowCategoryDialog(false);
                        } catch (e) {
                          toast({ title: "Error", description: "Ocurrió un problema", variant: "destructive" });
                        }
                      }}
                    >
                      {categoryForm.id ? 'Actualizar' : 'Crear'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button onClick={() => handleSaveSettings('productos')} disabled={loading || isUpdatingStoreSettings}>
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración de Productos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Print Settings */}
        <TabsContent value="print">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Printer className="mr-2 h-5 w-5" />
                Configuración de Impresión
              </CardTitle>
              <CardDescription>
                Configura el tamaño de papel para tus facturas y realiza pruebas de impresión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paper-size">Tamaño de Papel</Label>
                  <Select
                    value={printSettings.paperSize}
                    onValueChange={(value) => setPrintSettings({ ...printSettings, paperSize: value })}
                  >
                    <SelectTrigger id="paper-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm (Impresora Térmica Estándar)</SelectItem>
                      <SelectItem value="50mm">50mm (Impresora Térmica Pequeña)</SelectItem>
                      <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem value="carta">Carta (8.5 x 11 in)</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      💡 <span className="font-semibold">Importante:</span> Esta configuración se aplica a "Imprimir directamente" en el POS. Para impresoras térmicas como 2connet 2C-POS80, selecciona <strong>80mm</strong>.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="page-margin">Margen de Página</Label>
                    <Select
                      value={printSettings.pageMargin}
                      onValueChange={(value) => setPrintSettings({ ...printSettings, pageMargin: value })}
                    >
                      <SelectTrigger id="page-margin">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0mm">Sin margen (0mm)</SelectItem>
                        <SelectItem value="2mm">Pequeño (2mm)</SelectItem>
                        <SelectItem value="4mm">Medio (4mm)</SelectItem>
                        <SelectItem value="6mm">Grande (6mm)</SelectItem>
                        <SelectItem value="8mm">Muy grande (8mm)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Espacio alrededor del recibo completo
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="container-padding">Padding Interno</Label>
                    <Select
                      value={printSettings.containerPadding}
                      onValueChange={(value) => setPrintSettings({ ...printSettings, containerPadding: value })}
                    >
                      <SelectTrigger id="container-padding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0px">Sin padding (0px)</SelectItem>
                        <SelectItem value="4px">Pequeño (4px)</SelectItem>
                        <SelectItem value="8px">Medio (8px)</SelectItem>
                        <SelectItem value="12px">Grande (12px)</SelectItem>
                        <SelectItem value="16px">Muy grande (16px)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Espacio interno del contenido
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logo-margin-bottom">Margen Logo (Inferior)</Label>
                    <Select
                      value={printSettings.logoMarginBottom}
                      onValueChange={(value) => setPrintSettings({ ...printSettings, logoMarginBottom: value })}
                    >
                      <SelectTrigger id="logo-margin-bottom">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0px">Sin espacio (0px)</SelectItem>
                        <SelectItem value="2px">Muy pequeño (2px)</SelectItem>
                        <SelectItem value="4px">Pequeño (4px)</SelectItem>
                        <SelectItem value="6px">Normal (6px)</SelectItem>
                        <SelectItem value="8px">Medio (8px)</SelectItem>
                        <SelectItem value="12px">Grande (12px)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Espacio entre el logo y el texto debajo
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Printer className="mr-2 h-4 w-4" />
                    Información del Formato Seleccionado
                  </h4>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    {printSettings.paperSize === '80mm' && (
                      <>
                        <p className="text-sm"><strong>Ancho:</strong> 80mm (3.15 pulgadas)</p>
                        <p className="text-sm"><strong>Uso recomendado:</strong> Tickets de venta, facturas de punto de venta</p>
                        <p className="text-sm"><strong>Tipo de impresora:</strong> Térmica de 80mm (Epson TM, Star TSP, 2connet 2C-POS80, etc.)</p>
                        <p className="text-sm"><strong>Método de impresión:</strong> Usa "Imprimir directamente" en el POS</p>
                      </>
                    )}
                    {printSettings.paperSize === '50mm' && (
                      <>
                        <p className="text-sm"><strong>Ancho:</strong> 50mm (2 pulgadas)</p>
                        <p className="text-sm"><strong>Uso recomendado:</strong> Tickets pequeños, recibos compactos</p>
                        <p className="text-sm"><strong>Tipo de impresora:</strong> Térmica de 50mm (portátil)</p>
                        <p className="text-sm"><strong>Método de impresión:</strong> Usa "Imprimir directamente" en el POS</p>
                      </>
                    )}
                    {printSettings.paperSize === 'A4' && (
                      <>
                        <p className="text-sm"><strong>Dimensiones:</strong> 210 x 297 mm</p>
                        <p className="text-sm"><strong>Uso recomendado:</strong> Facturas formales, documentos oficiales</p>
                        <p className="text-sm"><strong>Tipo de impresora:</strong> Láser o inyección de tinta</p>
                        <p className="text-sm"><strong>Método de impresión:</strong> Usa "Imprimir directamente" en el POS</p>
                      </>
                    )}
                    {printSettings.paperSize === 'carta' && (
                      <>
                        <p className="text-sm"><strong>Dimensiones:</strong> 8.5 x 11 pulgadas (215.9 x 279.4 mm)</p>
                        <p className="text-sm"><strong>Uso recomendado:</strong> Facturas formales, documentos oficiales (estándar USA)</p>
                        <p className="text-sm"><strong>Tipo de impresora:</strong> Láser o inyección de tinta</p>
                        <p className="text-sm"><strong>Método de impresión:</strong> Usa "Imprimir directamente" en el POS</p>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Thermal Printer Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h4 className="font-medium flex items-center">
                        <Printer className="mr-2 h-4 w-4" />
                        Impresora Térmica (Impresión Directa)
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Conecta una impresora térmica ESC/POS para impresión sin diálogos
                      </p>
                    </div>
                    <Switch
                      checked={printSettings.useThermalPrinter}
                      onCheckedChange={(checked) => {
                        setPrintSettings({ ...printSettings, useThermalPrinter: checked });
                      }}
                      disabled={!printSettings.thermalPrinterConnected}
                    />
                  </div>

                  {printSettings.thermalPrinterConnected ? (
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="font-medium text-green-900 dark:text-green-100">
                            Conectada: {printSettings.thermalPrinterName}
                          </span>
                        </div>
                        <Button
                          onClick={handleDisconnectThermalPrinter}
                          variant="outline"
                          size="sm"
                          className="border-green-300 dark:border-green-700"
                        >
                          Desconectar
                        </Button>
                      </div>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Las facturas se imprimirán directamente sin diálogos del navegador
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <p className="text-sm">
                          <strong>Requisitos para impresión térmica directa:</strong>
                        </p>
                        <ul className="text-sm space-y-1 list-disc list-inside">
                          <li className="font-semibold">Impresora térmica ESC/POS de recibos (58mm o 80mm)</li>
                          <li>Cable USB físico (NO Bluetooth, NO WiFi)</li>
                          <li>Impresora encendida antes de conectar</li>
                          <li>Navegador Chrome, Edge u Opera</li>
                          <li>HTTPS o localhost para pruebas</li>
                        </ul>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mt-2">
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            ℹ️ <span className="font-semibold">Tipos de impresoras:</span>
                          </p>
                          <ul className="text-xs text-blue-600 dark:text-blue-400 mt-1 space-y-1 list-disc list-inside ml-2">
                            <li><strong>Impresoras térmicas ESC/POS:</strong> Impresoras pequeñas de recibos/tickets (compatibles con esta función)</li>
                            <li><strong>Impresoras normales (láser, inkjet, PostScript):</strong> Usa "Imprimir directamente" en el POS en su lugar</li>
                          </ul>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 mt-2">
                          <p className="text-xs text-yellow-600 dark:text-yellow-500">
                            ⚠️ <span className="font-semibold">Si ves puertos Bluetooth:</span> Significa que no hay impresoras térmicas USB conectadas. Las impresoras normales (láser, inkjet) NO aparecerán aquí.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          💡 Marcas de impresoras térmicas compatibles: Epson TM-series, Star TSP, Citizen CT-S, Bixolon SRP, Rongta, Xprinter.
                        </p>
                      </div>
                      <Button
                        onClick={handleConnectThermalPrinter}
                        variant="default"
                        className="w-full"
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Conectar Impresora Térmica
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button onClick={handleSavePrintSettings} disabled={loading || isUpdatingStoreSettings}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Configuración
                  </Button>
                  <Button onClick={handleTestPrint} variant="outline">
                    <Printer className="mr-2 h-4 w-4" />
                    Realizar Prueba de Impresión
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                    <Bell className="mr-2 h-4 w-4" />
                    Consejos para la Impresión
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Realiza una prueba de impresión antes de usar en producción</li>
                    <li>Verifica que el tamaño de papel coincida con tu impresora</li>
                    <li>Para impresoras térmicas, usa papel térmico de calidad</li>
                    <li>Configura tu navegador para imprimir sin encabezados ni pies de página</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2 h-5 w-5" />
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configura las alertas y sonidos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Web Order Sound Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Volume2 className="mr-2 h-4 w-4" />
                  Sonido de Pedidos Web
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sonido de Notificación</Label>
                    <p className="text-sm text-muted-foreground">
                      Reproducir sonido cuando llegue un nuevo pedido web
                    </p>
                  </div>
                  <Switch
                    checked={storeSettings?.web_order_sound_enabled ?? true}
                    onCheckedChange={(checked) => updateStoreSettings({ web_order_sound_enabled: checked })}
                  />
                </div>

                {(storeSettings?.web_order_sound_enabled ?? true) && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Tipo de Sonido</Label>
                      <div className="flex gap-2">
                        <Select
                          value={storeSettings?.web_order_sound_type ?? 'chime'}
                          onValueChange={(value) => updateStoreSettings({ web_order_sound_type: value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chime">🔔 Campanilla</SelectItem>
                            <SelectItem value="bell">🛎️ Campana</SelectItem>
                            <SelectItem value="ding">✨ Ding</SelectItem>
                            <SelectItem value="alert">⚠️ Alerta</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            import('@/utils/notificationSounds').then(({ playNotificationSound }) => {
                              playNotificationSound(
                                (storeSettings?.web_order_sound_type as any) ?? 'chime',
                                true,
                                storeSettings?.web_order_sound_volume ?? 0.7
                              );
                            });
                          }}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Volumen</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((storeSettings?.web_order_sound_volume ?? 0.7) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={storeSettings?.web_order_sound_volume ?? 0.7}
                        onChange={(e) => updateStoreSettings({ web_order_sound_volume: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Ajusta el volumen del sonido de notificación
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* System Notifications */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Bell className="mr-2 h-4 w-4" />
                  Notificaciones del Sistema
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificaciones</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibir notificaciones del sistema
                    </p>
                  </div>
                  <Switch
                    checked={systemSettings.notifications}
                    onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, notifications: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* Email Reports Section */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  Informes por Correo
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar Informes por Correo</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibe informes automáticos con resumen de ventas, inventario bajo y pedidos pendientes
                    </p>
                  </div>
                  <Switch
                    checked={storeSettings?.email_reports_enabled ?? false}
                    onCheckedChange={(checked) => updateStoreSettings({ email_reports_enabled: checked })}
                  />
                </div>

                {(storeSettings?.email_reports_enabled ?? false) && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label htmlFor="email-recipient">Correo de destino</Label>
                      <Input
                        id="email-recipient"
                        type="email"
                        placeholder="tu@email.com"
                        value={storeSettings?.email_reports_recipient || ''}
                        onChange={(e) => updateStoreSettings({ email_reports_recipient: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Los informes se enviarán a este correo
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Frecuencia de Informes</Label>
                      <Select
                        value={storeSettings?.email_reports_frequency ?? 'daily'}
                        onValueChange={(value) => updateStoreSettings({ email_reports_frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">📅 Diario</SelectItem>
                          <SelectItem value="weekly">📆 Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {storeSettings?.email_reports_frequency === 'weekly'
                          ? 'Recibirás un informe cada semana con el resumen de los últimos 7 días'
                          : 'Recibirás un informe cada día con el resumen del día anterior'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={!storeSettings?.email_reports_recipient || isUpdatingStoreSettings}
                        onClick={async () => {
                          if (!storeSettings?.email_reports_recipient || !userStore?.id) {
                            toast({
                              title: "Error",
                              description: "Ingresa un correo de destino válido",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            const { error } = await supabase.functions.invoke('send-daily-report', {
                              body: {
                                store_id: userStore.id,
                                recipient_email: storeSettings.email_reports_recipient,
                                report_type: storeSettings.email_reports_frequency || 'daily'
                              }
                            });
                            if (error) throw error;
                            toast({
                              title: "Informe enviado",
                              description: `Se ha enviado el informe a ${storeSettings.email_reports_recipient}`,
                            });
                          } catch (err: any) {
                            console.error('Error sending report:', err);
                            toast({
                              title: "Error",
                              description: err.message || "No se pudo enviar el informe",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Informe de Prueba
                      </Button>
                    </div>

                    {storeSettings?.email_reports_last_sent && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Último informe enviado: {new Date(storeSettings.email_reports_last_sent).toLocaleString('es-DO')}
                      </div>
                    )}

                    <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✅ <span className="font-semibold">Programado:</span> Los informes se enviarán automáticamente todos los días a las 7:00 AM (hora Santo Domingo). Si elegiste frecuencia semanal, recibirás el informe una vez por semana.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SettingsIcon className="mr-2 h-5 w-5" />
                  Configuración General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={systemSettings.language} onValueChange={(value) => setSystemSettings({ ...systemSettings, language: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zona Horaria</Label>
                    <Select value={systemSettings.timezone} onValueChange={(value) => setSystemSettings({ ...systemSettings, timezone: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Santo_Domingo">Santo Domingo</SelectItem>
                        <SelectItem value="America/New_York">New York</SelectItem>
                        <SelectItem value="America/Los_Angeles">Los Angeles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Respaldo Automático</Label>
                      <p className="text-sm text-muted-foreground">
                        Crear respaldos automáticos de los datos
                      </p>
                    </div>
                    <Switch
                      checked={systemSettings.autoBackup}
                      onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, autoBackup: checked })}
                    />
                  </div>
                </div>

                <Button onClick={() => handleSaveSettings('sistema')} disabled={loading || isUpdatingStoreSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración del Sistema
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="mr-2 h-5 w-5" />
                  Apariencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select
                    value={theme === 'system' ? 'auto' : theme}
                    onValueChange={(value) => {
                      const newTheme = value === 'auto' ? 'system' : value as "light" | "dark";
                      setTheme(newTheme);
                      setSystemSettings({ ...systemSettings, theme: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Oscuro</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="auto">Automático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Columnas de Productos (Tablet/Móvil)</Label>
                  <Select
                    value={systemSettings.posLayoutGridCols}
                    onValueChange={(value) => setSystemSettings({ ...systemSettings, posLayoutGridCols: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Columna (Lista)</SelectItem>
                      <SelectItem value="2">2 Columnas (Estándar)</SelectItem>
                      <SelectItem value="3">3 Columnas (Tablet)</SelectItem>
                      <SelectItem value="4">4 Columnas (Tablet Grande)</SelectItem>
                      <SelectItem value="5">5 Columnas</SelectItem>
                      <SelectItem value="6">6 Columnas</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Ajusta el tamaño de la cuadrícula de productos en dispositivos móviles y tablets.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Gestión de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-24 flex-col" onClick={() => handleExportData(false)} disabled={loading}>
                    <Download className="mb-2 h-6 w-6" />
                    Exportar Mis Datos
                    <span className="text-xs text-muted-foreground">Backup de esta tienda</span>
                  </Button>

                  {profile?.role === 'admin' && (
                    <Button variant="outline" className="h-24 flex-col border-blue-500/50 hover:bg-blue-500/10" onClick={() => handleExportData(true)} disabled={loading}>
                      <Shield className="mb-2 h-6 w-6 text-blue-500" />
                      Backup Total (Admin)
                      <span className="text-xs text-muted-foreground">Toda la base de datos</span>
                    </Button>
                  )}

                  <div className="relative">
                    <Button variant="outline" className="h-24 flex-col w-full" onClick={() => document.getElementById('import-backup')?.click()} disabled={loading}>
                      <Upload className="mb-2 h-6 w-6" />
                      Importar Datos
                      <span className="text-xs text-muted-foreground">Restaurar desde backup</span>
                    </Button>
                    <input
                      id="import-backup"
                      type="file"
                      accept=".json"
                      onChange={handleImportData}
                      className="hidden"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-destructive">Zona de Peligro</h4>
                  <div className="p-4 border border-destructive rounded-lg">
                    <h5 className="font-medium mb-2">Resetear Sistema</h5>
                    <p className="text-sm text-muted-foreground mb-4">
                      Esta acción eliminará todos los datos del sistema y no se puede deshacer.
                    </p>
                    <Button variant="destructive" size="sm" onClick={handleResetSystem} disabled={loading}>
                      Resetear Sistema
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Seguridad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Frecuencia de Respaldo</Label>
                  <Select
                    value={systemSettings.backupFrequency}
                    onValueChange={(value) => setSystemSettings({ ...systemSettings, backupFrequency: value })}
                  >
                    <SelectTrigger id="backup-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Cada Hora</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Días de Retención de Logs</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    value={systemSettings.retentionDays}
                    onChange={(e) => setSystemSettings({ ...systemSettings, retentionDays: e.target.value })}
                  />
                </div>

                <Button onClick={() => handleSaveSettings('sistema')} disabled={loading || isUpdatingStoreSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración de Seguridad
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ThermalPrinterDialog
        open={showPrinterDialog}
        onOpenChange={setShowPrinterDialog}
        onConnect={handlePrinterConnected}
      />
    </div>
  );
};

export default Settings;