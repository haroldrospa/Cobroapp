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
    staleTime: 1000 * 60 * 60, // 1 hour - store data rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours in cache
    refetchOnWindowFocus: false,
    retry: 3, // This is critical data, retry more
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Single optimized query using JOIN - much faster than 3 separate queries
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          store_id,
          stores:store_id (
            id,
            store_code,
            store_name,
            slug,
            is_active
          )
        `)
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user store:', error);
        return null;
      }

      if (!data?.stores) return null;

      return data.stores as UserStore;
    },
  });
};
