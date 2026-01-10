import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';

export type PaymentMethod = {
  id: string;
  name: string;
  enabled: boolean;
  surcharge_percentage?: number;
}

export type StoreSettings = {
  // Invoice Settings
  invoice_prefix: string;
  auto_increment: boolean;
  show_tax: boolean;
  default_tax_rate: number;
  currency: string;
  payment_terms: number;
  invoice_footer_text: string;
  email_greeting?: string;
  email_message?: string;

  // POS / Payments
  payment_methods: PaymentMethod[];

  // Products / Inventory
  low_stock_alert: boolean;
  low_stock_threshold: number;

  // System
  notifications_enabled: boolean;
  auto_backup: boolean;
  theme: string;
  language: string;
  timezone: string;

  // Printing
  paper_size: string;
  use_thermal_printer: boolean;
  thermal_printer_name: string | null;

  // Web Orders
  web_order_sound_enabled: boolean;
  web_order_sound_type: string;
  web_order_sound_volume: number;

  // Shop Type
  shop_type?: string;

  // Payroll (Legacy/Payroll)
  afp_rate: number;
  sfs_rate: number;
  isr_rate: number;
  infotep_rate: number;
  enable_afp: boolean;
  enable_sfs: boolean;
  enable_isr: boolean;
  enable_infotep: boolean;
  afp_type: 'percentage' | 'fixed';
  sfs_type: 'percentage' | 'fixed';
  isr_type: 'percentage' | 'fixed';
  infotep_type: 'percentage' | 'fixed';

  // Email Reports
  email_reports_enabled?: boolean;
  email_reports_recipient?: string;
  email_reports_frequency?: string;
  // Advanced Settings
  backup_frequency?: string;
  log_retention_days?: number;
}

export const useStoreSettings = () => {
  const { data: store } = useUserStore();
  const storeId = store?.id;
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchSettings = async () => {
    if (!storeId) return null;

    // Check if store_settings exists for this store
    const { data: existingSettings, error: fetchError } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();

    if (fetchError) {
      console.warn("Error fetching store_settings:", fetchError);
    }

    if (!existingSettings) {
      // Create default settings if they don't exist
      const defaultSettings = {
        store_id: storeId,
        invoice_prefix: 'FAC-',
        auto_increment: true,
        show_tax: true,
        default_tax_rate: 18,
        currency: 'DOP',
        payment_terms: 30,
        invoice_footer_text: 'Gracias por su preferencia',
        payment_methods: [
          { id: 'cash', name: 'Efectivo', enabled: true },
          { id: 'card', name: 'Tarjeta', enabled: true, surcharge_percentage: 0 },
          { id: 'transfer', name: 'Transferencia', enabled: true },
          { id: 'check', name: 'Cheque', enabled: true },
          { id: 'credit', name: 'Crédito', enabled: true }
        ],
        low_stock_alert: true,
        low_stock_threshold: 10,
        notifications_enabled: true,
        auto_backup: false,
        theme: 'light',
        language: 'es',
        timezone: 'America/Santo_Domingo',
        paper_size: '80mm',
        use_thermal_printer: false,
        web_order_sound_enabled: true,
        web_order_sound_type: 'chime',
        web_order_sound_volume: 0.7,
        afp_rate: 2.87,
        sfs_rate: 3.04,
        isr_rate: 0,
        infotep_rate: 1.0,
        enable_afp: true,
        enable_sfs: true,
        enable_isr: false,
        enable_infotep: false,
        afp_type: 'percentage',
        sfs_type: 'percentage',
        isr_type: 'percentage',
        infotep_type: 'percentage'
      };

      const { data: newSettings, error: createError } = await supabase
        .from('store_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (createError) {
        console.error("Error creating default store_settings:", createError);
        return defaultSettings as any as StoreSettings;
      }
      return newSettings as any as StoreSettings;
    }

    return existingSettings as any as StoreSettings;
  };

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['storeSettings', storeId],
    queryFn: fetchSettings,
    enabled: !!storeId
  });

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    if (!storeId) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .update(newSettings as any)
        .eq('store_id', storeId);

      if (error) {
        console.error("Error updating store_settings:", error);
        throw error;
      }

      await refetch();
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    settings: (settings || {}) as StoreSettings,
    loadingSettings: isLoading,
    isUpdating,
    updateSettings
  };
};
