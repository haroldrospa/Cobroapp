import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  cost_includes_tax?: boolean;
  tax_percentage?: number;
  internal_code?: string;
  barcode?: string;
  category_id?: string;
  stock: number;
  min_stock: number;
  status: 'active' | 'inactive' | 'low_stock';
  image_url?: string;
  created_at?: string;
  updated_at?: string;
  discount_percentage?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  is_featured?: boolean;
  category?: {
    name: string;
  };
}

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
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
        .from('products')
        .select(`
          *,
          category:categories(name)
        `)
        .order('name');

      if (profile?.store_id) {
        query = query.eq('store_id', profile.store_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      price: number;
      cost?: number;
      cost_includes_tax?: boolean;
      tax_percentage?: number;
      internal_code?: string;
      barcode?: string;
      category_id?: string | null;
      stock: number;
      min_stock: number;
      status: 'active' | 'inactive';
      image_url?: string;
      discount_percentage?: number;
      discount_start_date?: string | null;
      discount_end_date?: string | null;
      is_featured?: boolean;
    }) => {
      // Get current user's store_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Insert product with store_id
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...product,
          store_id: profile?.store_id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...product }: {
      id: string;
      name: string;
      price: number;
      cost?: number;
      cost_includes_tax?: boolean;
      tax_percentage?: number;
      internal_code?: string;
      barcode?: string;
      category_id?: string | null;
      stock: number;
      min_stock: number;
      status: 'active' | 'inactive';
      image_url?: string;
      discount_percentage?: number;
      discount_start_date?: string | null;
      discount_end_date?: string | null;
      is_featured?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useDeleteAllProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.store_id) throw new Error('No se encontró la tienda');

      // First, get all product IDs for this store to delete them explicitly
      // This sometimes bypasses issues where bulk delete is restricted
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', profile.store_id);

      if (!products || products.length === 0) return;

      const ids = products.map(p => p.id);

      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', ids);

      if (error) {
        console.error("Delete error details:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};
