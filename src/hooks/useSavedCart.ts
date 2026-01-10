import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/pos';
import { useUserStore } from './useUserStore';
import { useEffect, useRef } from 'react';

export const useSavedCart = () => {
  const { data: userStore } = useUserStore();
  const queryClient = useQueryClient();

  const { data: savedCart, isLoading } = useQuery({
    queryKey: ['saved-cart', userStore?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userStore?.id) return null;

      const { data, error } = await supabase
        .from('saved_carts')
        .select('cart_data')
        .eq('profile_id', user.id)
        .eq('store_id', userStore.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading saved cart:', error);
        return null;
      }

      return (data?.cart_data as unknown as CartItem[]) || null;
    },
    enabled: !!userStore?.id,
  });

  const saveCartMutation = useMutation({
    mutationFn: async (cart: CartItem[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userStore?.id) throw new Error('No user or store');

      const { error } = await supabase
        .from('saved_carts')
        .upsert({
          profile_id: user.id,
          store_id: userStore.id,
          cart_data: cart as any,
        }, {
          onConflict: 'store_id,profile_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-cart'] });
    },
  });

  return {
    savedCart,
    isLoading,
    saveCart: saveCartMutation.mutate,
    isSaving: saveCartMutation.isPending,
  };
};

// Hook para auto-guardar el carrito
export const useAutoSaveCart = (cart: CartItem[]) => {
  const { saveCart } = useSavedCart();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const { data: userStore } = useUserStore();

  useEffect(() => {
    if (!userStore?.id) return;

    // Debounce: guardar después de 2 segundos de inactividad
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveCart(cart);
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [cart, saveCart, userStore?.id]);
};
