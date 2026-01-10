import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Store {
  id: string;
  owner_id: string;
  store_code: string;
  store_name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  slogan: string | null;
}

export interface StoreWithSettings extends Store {
  company_settings: CompanySettings | CompanySettings[] | null;
  store_settings: any;
}

// Get store by slug
export const useStoreBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['store', 'slug', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data: storeData, error } = await supabase
        .from('stores')
        .select(`
          *,
          company_settings (
            company_name,
            logo_url,
            phone,
            email,
            address,
            slogan
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      // Manually fetch store settings
      const { data: settingsData } = await supabase
        .from('store_settings')
        .select('*')
        .eq('store_id', storeData.id)
        .maybeSingle();

      return {
        ...storeData,
        store_settings: settingsData ? [settingsData] : []
      } as StoreWithSettings;
    },
    enabled: !!slug,
  });
};

// Get store by store_code (for customer lookup)
export const useStoreByStoreCode = (storeCode: string | undefined) => {
  return useQuery({
    queryKey: ['store', 'store-code', storeCode],
    queryFn: async () => {
      if (!storeCode) return null;

      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          company_settings (
            company_name,
            logo_url,
            phone,
            email,
            address,
            slogan
          )
        `)
        .eq('store_code', storeCode)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data as StoreWithSettings;
    },
    enabled: !!storeCode,
  });
};

// Backward compatible alias (previously searched by profiles.user_number)
export const useStoreByUserNumber = (userNumber: string | undefined) => {
  return useStoreByStoreCode(userNumber);
};
