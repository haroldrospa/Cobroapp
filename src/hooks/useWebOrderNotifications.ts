import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { playNotificationSound, NotificationSoundType } from '@/utils/notificationSounds';

interface UseWebOrderNotificationsProps {
  storeId: string | null | undefined;
  enabled?: boolean;
  soundEnabled?: boolean;
  soundType?: NotificationSoundType;
  soundVolume?: number;
}

export const useWebOrderNotifications = ({ 
  storeId, 
  enabled = true,
  soundEnabled = true,
  soundType = 'chime',
  soundVolume = 0.7
}: UseWebOrderNotificationsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !storeId) return;

    console.log('🔔 Subscribing to web orders for store:', storeId);

    const channel = supabase
      .channel('web-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'open_orders',
          filter: `store_id=eq.${storeId}`
        },
        (payload) => {
          const newOrder = payload.new as any;
          
          // Only notify for web orders
          if (newOrder.source === 'web') {
            console.log('🆕 New web order received:', newOrder);
            
            // Play notification sound
            playNotificationSound(soundType, soundEnabled, soundVolume);

            // Show toast notification
            toast({
              title: "🛒 ¡Nuevo Pedido Web!",
              description: `Pedido ${newOrder.order_number} de ${newOrder.customer_name} - $${newOrder.total?.toLocaleString()}`,
              duration: 10000,
            });

            // Refresh web orders query and count
            queryClient.invalidateQueries({ queryKey: ['web-orders'] });
            queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔕 Unsubscribing from web orders');
      supabase.removeChannel(channel);
    };
  }, [storeId, enabled, soundEnabled, soundType, soundVolume, toast, queryClient]);
};
