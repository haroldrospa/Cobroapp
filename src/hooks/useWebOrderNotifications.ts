import React, { useEffect, useRef } from 'react';
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
  onNewOrder?: (order: any) => void;
}

export const useWebOrderNotifications = ({
  storeId,
  enabled = true,
  soundEnabled = true,
  soundType = 'chime',
  soundVolume = 0.7,
  onNewOrder
}: UseWebOrderNotificationsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use a ref for the callback to avoid re-subscribing when the function identity changes
  const onNewOrderRef = React.useRef(onNewOrder);

  // Update ref when callback changes
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
  }, [onNewOrder]);

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
        },
        (payload) => {
          console.log('📨 RAW event received:', payload);
          const newOrder = payload.new as any;
          console.log('📦 Parsed order:', newOrder);
          console.log('🔍 Filters - storeId:', storeId, '| order.store_id:', newOrder.store_id, '| order.source:', newOrder.source);

          // DEBUG MODE: Commented out filters to see WHAT is coming in
          // Filter by store_id manually to ensure reliability
          /*
          if (storeId && newOrder.store_id !== storeId) {
            console.log('❌ Rejected: store_id mismatch');
            return;
          }

          // Only notify for web orders (case insensitive)
          if (newOrder.source?.toLowerCase() === 'web') {
          */
          console.log('🆕 Event received (DEBUG MODE):', newOrder);

          // Play notification sound
          playNotificationSound(soundType, soundEnabled, soundVolume);

          // Show toast notification
          toast({
            title: "🔔 Debug: Evento Recibido",
            description: `Source: "${newOrder.source}" | Store: ...${newOrder.store_id?.slice(-4)} | Order: ${newOrder.order_number}`,
            duration: 10000,
          });

          // Optimistically update the count
          if (storeId) {
            // Only update count if it actually MATCHES
            if (newOrder.store_id === storeId && newOrder.source?.toLowerCase() === 'web') {
              queryClient.setQueryData(['web-orders-count', storeId], (old: number | undefined) => (old || 0) + 1);
            }
          }

          // Refresh web orders query
          queryClient.invalidateQueries({ queryKey: ['web-orders'] });
          queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });

          // Custom callback
          console.log('🎯 Calling onNewOrder callback with:', newOrder);
          if (onNewOrderRef.current) {
            onNewOrderRef.current(newOrder);
            console.log('✅ onNewOrder callback executed');
          } else {
            console.warn('⚠️ onNewOrder callback is undefined');
          }
          /*
          } else {
            console.log('❌ Rejected: source is not web, got:', newOrder.source);
          }
          */
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
