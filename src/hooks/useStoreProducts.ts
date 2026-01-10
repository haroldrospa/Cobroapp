import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product } from './useProducts';

export const useStoreProducts = (storeId: string | undefined) => {
  return useQuery({
    queryKey: ['products', 'store', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name)
        `)
        .eq('store_id', storeId)
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!storeId,
  });
};
