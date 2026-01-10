import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';

export const useWebOrdersCount = () => {
  const { data: userStore } = useUserStore();

  return useQuery({
    queryKey: ['web-orders-count', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return 0;

      const { count, error } = await supabase
        .from('open_orders')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', userStore.id)
        .eq('source', 'web')
        .eq('order_status', 'pending');

      if (error) {
        console.error('Error fetching web orders count:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!userStore?.id,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
  });
};
