
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Customer {
  id: string;
  name: string;
  rnc?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  customer_type?: 'final' | 'business' | null;
  credit_limit?: number | null;
  credit_used?: number | null;
  credit_due_date?: string | null;
  total_purchases?: number | null;
  last_purchase_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    queryFn: async () => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      // Build query - filter by store_id if user has one
      let query = supabase
        .from('customers')
        .select('*')
        .order('name');

      if (profile?.store_id) {
        query = query.eq('store_id', profile.store_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          ...customer,
          store_id: profile?.store_id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
