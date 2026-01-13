/**
 * Sistema de Sincronización Automática
 * Sincroniza datos offline con Supabase cuando hay conexión
 */

import { offlineDB, OfflineStore, SyncQueueItem } from './offlineDB';
import { supabase } from '@/integrations/supabase/client';

class OfflineSyncManager {
    private isSyncing = false;
    private syncInterval: number | null = null;
    private onlineListener: (() => void) | null = null;
    private offlineListener: (() => void) | null = null;

    // Estado de conexión
    get isOnline(): boolean {
        return navigator.onLine;
    }

    // Iniciar el manager de sincronización
    start() {
        // Escuchar eventos de conexión
        this.onlineListener = this.handleOnline.bind(this);
        this.offlineListener = this.handleOffline.bind(this);

        window.addEventListener('online', this.onlineListener);
        window.addEventListener('offline', this.offlineListener);

        // Intentar sincronizar cada 30 segundos si estamos online
        this.syncInterval = window.setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.sync();
            }
        }, 30000);

        // Sincronizar inmediatamente si estamos online
        if (this.isOnline) {
            this.sync();
        }

        console.log('🔄 Offline Sync Manager iniciado');
    }

    // Detener el manager
    stop() {
        if (this.onlineListener) {
            window.removeEventListener('online', this.onlineListener);
        }
        if (this.offlineListener) {
            window.removeEventListener('offline', this.offlineListener);
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        console.log('⏹️ Offline Sync Manager detenido');
    }

    private handleOnline() {
        console.log('✅ Conexión restaurada - iniciando sincronización');
        this.sync();
    }

    private handleOffline() {
        console.log('❌ Sin conexión - modo offline activado');
    }

    // Sincronizar todos los datos pendientes
    async sync(): Promise<void> {
        if (this.isSyncing || !this.isOnline) {
            return;
        }

        this.isSyncing = true;
        console.log('🔄 Iniciando sincronización...');

        try {
            // 1. Sincronizar datos desde Supabase a IndexedDB
            await this.syncFromSupabase();

            // 2. Sincronizar cola de operaciones pendientes hacia Supabase
            await this.syncToSupabase();

            // 3. Limpiar items antiguos
            await offlineDB.cleanOldSyncedItems();

            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // Descargar datos desde Supabase a IndexedDB
    private async syncFromSupabase(): Promise<void> {
        try {
            // Obtener el usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Obtener store_id del usuario
            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            const storeId = profile?.store_id;

            // Sincronizar productos
            let productsQuery = supabase
                .from('products')
                .select('*');

            if (storeId) {
                productsQuery = productsQuery.eq('store_id', storeId);
            }

            const { data: products, error: productsError } = await productsQuery;

            if (!productsError && products) {
                for (const product of products) {
                    await offlineDB.put(OfflineStore.PRODUCTS, product);
                }
                console.log(`📦 ${products.length} productos sincronizados`);
            }

            // Sincronizar categorías
            let categoriesQuery = supabase
                .from('categories')
                .select('*');

            if (storeId) {
                categoriesQuery = categoriesQuery.eq('store_id', storeId);
            }

            const { data: categories, error: categoriesError } = await categoriesQuery;

            if (!categoriesError && categories) {
                for (const category of categories) {
                    await offlineDB.put(OfflineStore.CATEGORIES, category);
                }
                console.log(`📁 ${categories.length} categorías sincronizadas`);
            }

            // Sincronizar clientes
            let customersQuery = supabase
                .from('customers')
                .select('*');

            if (storeId) {
                customersQuery = customersQuery.eq('store_id', storeId);
            }

            const { data: customers, error: customersError } = await customersQuery;

            if (!customersError && customers) {
                for (const customer of customers) {
                    await offlineDB.put(OfflineStore.CUSTOMERS, customer);
                }
                console.log(`👥 ${customers.length} clientes sincronizados`);
            }

        } catch (error) {
            console.error('Error sincronizando desde Supabase:', error);
            throw error;
        }
    }

    // Enviar operaciones pendientes a Supabase
    private async syncToSupabase(): Promise<void> {
        const pendingItems = await offlineDB.getPendingSyncItems();

        if (pendingItems.length === 0) {
            return;
        }

        console.log(`⬆️ Sincronizando ${pendingItems.length} operaciones pendientes`);

        for (const item of pendingItems) {
            try {
                await this.processSyncItem(item);
                if (item.id) {
                    await offlineDB.markAsSynced(item.id);
                }
            } catch (error: any) {
                console.error('Error procesando item de sincronización:', error);
                if (item.id) {
                    await offlineDB.markAsError(item.id, error.message || 'Error desconocido');
                }
            }
        }
    }

    // Procesar un item de la cola de sincronización
    private async processSyncItem(item: SyncQueueItem): Promise<void> {
        const { store, operation, data } = item;

        switch (store) {
            case OfflineStore.SALES:
                await this.syncSale(operation, data);
                break;
            case OfflineStore.PRODUCTS:
                await this.syncProduct(operation, data);
                break;
            case OfflineStore.CUSTOMERS:
                await this.syncCustomer(operation, data);
                break;
            default:
                console.warn('Store no soportado para sincronización:', store);
        }
    }

    // Sincronizar venta
    private async syncSale(operation: string, data: any): Promise<void> {
        if (operation === 'CREATE') {
            const { error } = await supabase
                .from('sales')
                .insert(data);

            if (error) throw error;

            // También sincronizar items de venta si existen
            if (data.items && Array.isArray(data.items)) {
                const saleId = data.id;
                for (const item of data.items) {
                    await supabase
                        .from('sale_items')
                        .insert({
                            sale_id: saleId,
                            product_id: item.id || item.product_id,
                            quantity: item.quantity,
                            unit_price: item.price,
                            discount_percentage: item.discount || 0,
                            tax_percentage: (item.tax || 0) * 100,
                            subtotal: item.price * item.quantity,
                            discount_amount: ((item.discount || 0) / 100) * (item.price * item.quantity),
                            tax_amount: (item.tax || 0) * item.price * item.quantity,
                            total: item.price * item.quantity * (1 + (item.tax || 0)),
                        });
                }
            }
        }
    }

    // Sincronizar producto
    private async syncProduct(operation: string, data: any): Promise<void> {
        switch (operation) {
            case 'CREATE':
                const { error: createError } = await supabase
                    .from('products')
                    .insert(data);
                if (createError) throw createError;
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('products')
                    .update(updateData)
                    .eq('id', id);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', data.id);
                if (deleteError) throw deleteError;
                break;
        }
    }

    // Sincronizar cliente
    private async syncCustomer(operation: string, data: any): Promise<void> {
        switch (operation) {
            case 'CREATE':
                const { error: createError } = await supabase
                    .from('customers')
                    .insert(data);
                if (createError) throw createError;
                break;

            case 'UPDATE':
                const { id, ...updateData } = data;
                const { error: updateError } = await supabase
                    .from('customers')
                    .update(updateData)
                    .eq('id', id);
                if (updateError) throw updateError;
                break;

            case 'DELETE':
                const { error: deleteError } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', data.id);
                if (deleteError) throw deleteError;
                break;
        }
    }
}

// Singleton instance
export const offlineSyncManager = new OfflineSyncManager();
