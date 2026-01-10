import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserStore {
  id: string;
  store_code: string;
  store_name: string;
  slug: string;
  is_active: boolean;
}

export const useUserStore = () => {
  return useQuery({
    queryKey: ['user-store'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user's profile with store_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.store_id) return null;

      // Get store details
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, store_code, store_name, slug, is_active')
        .eq('id', profile.store_id)
        .single();

      if (storeError) return null;

      return store as UserStore;
    },
  });
};
