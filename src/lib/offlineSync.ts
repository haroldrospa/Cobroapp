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

    private async handleOnline() {
        console.log('✅ Conexión restaurada - iniciando sincronización');
        // Intentar arreglar secuencias inmediatamente al conectar
        await this.reconcileSequences();
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
            // 1. Sincronizar datos (PRIMERO SUBIR CAMBIOS LOCALES)
            // Esto es crucial para que las secuencias locales avanzadas se guarden en el servidor
            // antes de descargar los valores del servidor (que podrían ser más viejos si no subimos primero).
            await this.syncToSupabase();

            // 2. Sincronizar datos desde Supabase a IndexedDB (DESCARGAR CAMBIOS)
            await this.syncFromSupabase();

            // 3. Sincronizar (Reconciliar) Secuencias - CRÍTICO para evitar duplicados
            await this.reconcileSequences();

            // 4. Limpiar items antiguos
            await offlineDB.cleanOldSyncedItems();

            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // RECONCILIADOR DE SECUENCIAS (Bidireccional)
    // Asegura que Online y Offline estén siempre en el número más alto
    private async reconcileSequences(): Promise<void> {
        try {
            console.log('⚖️ Reconciliando secuencias...');

            // 1. Obtener usuario y tienda
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile?.store_id) return;

            // 2. Obtener secuencias Locales
            const localSettings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || {};

            // 3. Obtener secuencias Remotas
            const { data: remoteSequences } = await supabase
                .from('invoice_sequences')
                .select('*')
                .eq('store_id', profile.store_id);

            if (!remoteSequences) return;

            let updatesMade = false;

            // 4. Comparar y corregir
            for (const remote of remoteSequences) {
                const typeCode = remote.invoice_type_id;
                const localSeq = localSettings[typeCode];

                // Caso A: Local está más adelantado (Offline avanzó más)
                if (localSeq && localSeq.current > remote.current_number) {
                    console.log(`⚡️ CORRIGIENDO REMOTO: ${typeCode} Local(${localSeq.current}) > Remoto(${remote.current_number})`);

                    // Actualizar Supabase directamente
                    const { error } = await supabase
                        .from('invoice_sequences')
                        .update({
                            current_number: localSeq.current,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', remote.id);

                    if (error) {
                        console.error('Error actualizando secuencia remota:', error);
                        // Fallback a RPC si el update directo falla
                        await supabase.rpc('update_invoice_sequence_max' as any, {
                            p_invoice_type_id: typeCode,
                            p_store_id: profile.store_id,
                            p_new_sequence_number: localSeq.current
                        });
                    }
                    updatesMade = true;
                }
                // Caso B: Remoto está más adelantado (Hubo ventas en otro PC)
                else if (localSeq && remote.current_number > localSeq.current) {
                    console.log(`⚡️ CORRIGIENDO LOCAL: ${typeCode} Remoto(${remote.current_number}) > Local(${localSeq.current})`);

                    localSettings[typeCode] = {
                        current: remote.current_number,
                        prefix: `${typeCode}-`
                    };
                    updatesMade = true;
                }
            }

            // Guardar cambios locales si hubo correcciones
            if (updatesMade) {
                await offlineDB.put(OfflineStore.SETTINGS, {
                    key: 'invoice_sequences',
                    ...localSettings
                });
                console.log('✅ Secuencias sincronizadas y corregidas');
            }

        } catch (error) {
            console.error('⚠️ Error en reconciliación de secuencias:', error);
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
                .select('store_id, is_active')
                .eq('id', user.id)
                .maybeSingle();

            const storeId = profile?.store_id;

            // Guardar perfil en offline DB para tener el store_id disponible offline
            if (profile) {
                await offlineDB.put(OfflineStore.SETTINGS, {
                    key: 'user_profile',
                    store_id: profile.store_id,
                    is_active: profile.is_active
                });
            }

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

            // Sincronizar tipos de facturas (cache)
            const { data: invoiceTypes, error: typesError } = await supabase
                .from('invoice_types')
                .select('*');

            if (!typesError && invoiceTypes) {
                for (const type of invoiceTypes) {
                    await offlineDB.put(OfflineStore.INVOICE_TYPES, type);
                }
                console.log(`📄 ${invoiceTypes.length} tipos de facturas sincronizados`);
            }

            // Sincronizar secuencias de facturas
            let sequencesQuery = supabase
                .from('invoice_sequences')
                .select('invoice_type_id, current_number');

            if (storeId) {
                sequencesQuery = sequencesQuery.eq('store_id', storeId);
            }

            const { data: sequences, error: sequencesError } = await sequencesQuery;

            if (!sequencesError && sequences) {
                const sequenceMap: any = { key: 'invoice_sequences' };

                for (const seq of sequences) {
                    sequenceMap[seq.invoice_type_id] = {
                        current: seq.current_number,
                        prefix: `${seq.invoice_type_id}-`
                    };
                }

                await offlineDB.put(OfflineStore.SETTINGS, sequenceMap);
                console.log(`🔢 ${sequences.length} secuencias sincronizadas`);
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
            // CRÍTICO: Asegurar que existe store_id. Las ventas offline antiguas podrían no tenerlo.
            if (!data.store_id) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('store_id')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (profile?.store_id) {
                        data.store_id = profile.store_id;
                        console.log('🔧 store_id parcheado para venta offline:', data.id);
                    }
                }
            }

            // Si aún no tenemos store_id, intentamos con el de la sesión actual como última opción
            // o insertamos y dejamos que falle si es obligatorio (mejor que fallar silenciosamente aquí)

            const { error } = await supabase
                .from('sales')
                .insert(data);

            if (error) {
                // Si es error de duplicado (ya existe la factura), lo ignoramos y marcamos como synced
                if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
                    console.warn(`⚠️ Venta ${data.invoice_number} ya existía en servidor. Ignorando error.`);
                    return;
                }
                throw error;
            }

            // CRÍTICO: Si la venta se insertó correctamente, debemos intentar actualizar la secuencia
            // para que la próxima venta online no reutilice este número.
            if (data.invoice_number && data.store_id && data.invoice_type_id) {
                try {
                    // Extraer número de la factura (ej: B02-00001739 -> 1739)
                    const match = data.invoice_number.match(/-(\d+)$/);
                    if (match && match[1]) {
                        const sequenceNumber = parseInt(match[1], 10);

                        await supabase.rpc('update_invoice_sequence_max' as any, {
                            p_invoice_type_id: data.invoice_type_id,
                            p_store_id: data.store_id,
                            p_new_sequence_number: sequenceNumber
                        });

                        console.log(`🔢 Secuencia actualizada a ${sequenceNumber} para ${data.invoice_type_id}`);
                    }
                } catch (seqError) {
                    console.error('⚠️ Error actualizando secuencia post-sync (no crítico):', seqError);
                    // No lanzamos el error porque la venta sí se guardó
                }
            }

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
