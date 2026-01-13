/**
 * Hook para usar productos con soporte offline
 * Funciona automáticamente sin internet usando IndexedDB
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { Product } from './useProducts';

// Hook para detectar estado online/offline
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = React.useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

export const useProductsOffline = () => {
    const isOnline = useOnlineStatus();

    return useQuery({
        queryKey: ['products', 'offline'],
        queryFn: async () => {
            try {
                // Intentar primero desde Supabase si estamos online
                if (isOnline) {
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

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

                        if (!error && data) {
                            // Guardar en IndexedDB para uso offline
                            for (const product of data) {
                                await offlineDB.put(OfflineStore.PRODUCTS, product);
                            }
                            return data as Product[];
                        }
                    }
                }

                // Si estamos offline o hubo error, usar IndexedDB
                console.log('📦 Usando productos desde IndexedDB (modo offline)');
                const products = await offlineDB.getAll<Product>(OfflineStore.PRODUCTS);
                return products;

            } catch (error) {
                // En caso de error, siempre volver a IndexedDB
                console.log('📦 Error en Supabase, usando IndexedDB:', error);
                const products = await offlineDB.getAll<Product>(OfflineStore.PRODUCTS);
                return products;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutos
    });
};

export const useCreateProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();

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
            const productId = crypto.randomUUID();
            const newProduct = {
                ...product,
                id: productId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            // Guardar en IndexedDB siempre
            await offlineDB.put(OfflineStore.PRODUCTS, newProduct);

            // Si estamos online, intentar guardar en Supabase
            if (isOnline) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('store_id')
                            .eq('id', user.id)
                            .maybeSingle();

                        const { error } = await supabase
                            .from('products')
                            .insert([{
                                ...newProduct,
                                store_id: profile?.store_id || null,
                            }]);

                        if (error) throw error;
                        return newProduct;
                    }
                } catch (error) {
                    console.error('Error guardando en Supabase, agregando a cola:', error);
                    // Agregar a cola de sincronización
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'CREATE',
                        data: newProduct,
                    });
                }
            } else {
                // Offline: agregar a cola de sincronización
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'CREATE',
                    data: newProduct,
                });
            }

            return newProduct;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
};

export const useUpdateProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();

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
            const updatedProduct = {
                ...product,
                id,
                updated_at: new Date().toISOString(),
            };

            // Actualizar en IndexedDB
            await offlineDB.put(OfflineStore.PRODUCTS, updatedProduct);

            // Si estamos online, intentar actualizar en Supabase
            if (isOnline) {
                try {
                    const { error } = await supabase
                        .from('products')
                        .update(product)
                        .eq('id', id);

                    if (error) throw error;
                    return updatedProduct;
                } catch (error) {
                    console.error('Error actualizando en Supabase, agregando a cola:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'UPDATE',
                        data: updatedProduct,
                    });
                }
            } else {
                // Offline: agregar a cola
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'UPDATE',
                    data: updatedProduct,
                });
            }

            return updatedProduct;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
};

import React from 'react';

export const useDeleteProductOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();

    return useMutation({
        mutationFn: async (id: string) => {
            // Eliminar de IndexedDB
            await offlineDB.delete(OfflineStore.PRODUCTS, id);

            // Si estamos online, intentar eliminar de Supabase
            if (isOnline) {
                try {
                    const { error } = await supabase
                        .from('products')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                } catch (error) {
                    console.error('Error eliminando de Supabase, agregando a cola:', error);
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.PRODUCTS,
                        operation: 'DELETE',
                        data: { id },
                    });
                }
            } else {
                // Offline: agregar a cola
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.PRODUCTS,
                    operation: 'DELETE',
                    data: { id },
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
};
