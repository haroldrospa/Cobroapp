/**
 * Hook para crear ventas con soporte offline completo
 * Las ventas se guardan localmente cuando no hay internet y se sincronizan automáticamente
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/pos';
import { offlineDB, OfflineStore } from '@/lib/offlineDB';
import { useOnlineStatus } from './useProductsOffline';

interface CreateSaleData {
    customer_id?: string;
    invoice_type_id: string;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
    payment_method: string;
    amount_received?: number;
    change_amount?: number;
    payment_status?: string;
    due_date?: string;
    items: CartItem[];
}

export const useCreateSaleOffline = () => {
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();

    return useMutation({
        mutationFn: async (saleData: CreateSaleData) => {
            const saleId = crypto.randomUUID();
            const localInvoiceNumber = await generateLocalInvoiceNumber(saleData.invoice_type_id);

            // Obtener store_id local
            const storeId = await getLocalStoreId();

            // Preparar la venta completa
            const completeSale = {
                id: saleId,
                invoice_number: localInvoiceNumber,
                customer_id: saleData.customer_id || null,
                invoice_type_id: saleData.invoice_type_id,
                subtotal: saleData.subtotal,
                discount_total: saleData.discount_total,
                tax_total: saleData.tax_total,
                total: saleData.total,
                payment_method: saleData.payment_method,
                amount_received: saleData.amount_received,
                change_amount: saleData.change_amount,
                payment_status: saleData.payment_status || 'paid',
                due_date: saleData.due_date || null,
                created_at: new Date().toISOString(),
                synced: false, // Marca para saber si se sincronizó
                store_id: storeId, // Agregamos store_id
                items: saleData.items, // Guardamos los items con la venta
            };

            // Guardar venta en IndexedDB siempre primero
            await offlineDB.put(OfflineStore.SALES, completeSale);
            console.log('💾 Venta guardada localmente:', localInvoiceNumber);

            // Actualizar stock local
            for (const item of saleData.items) {
                const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);
                if (isValidUuid) {
                    const product = await offlineDB.get<any>(OfflineStore.PRODUCTS, item.id);
                    if (product) {
                        product.stock = Math.max(0, (product.stock || 0) - item.quantity);
                        await offlineDB.put(OfflineStore.PRODUCTS, product);
                    }
                }
            }

            // Si estamos online, intentar guardar en Supabase
            if (isOnline) {
                try {
                    const result = await saveSaleToSupabase(saleData);

                    // Actualizar la venta local con el invoice_number de Supabase
                    completeSale.invoice_number = result.invoice_number;
                    completeSale.synced = true;
                    await offlineDB.put(OfflineStore.SALES, { ...completeSale, id: saleId });

                    // IMPORTANTE: Mantener la secuencia local sincronizada
                    await updateLocalSequenceFromOnlineSale(saleData.invoice_type_id, result.invoice_number);

                    console.log('✅ Venta sincronizada con Supabase:', result.invoice_number);
                    return result;
                } catch (error) {
                    console.error('⚠️ Error guardando en Supabase, quedará pendiente:', error);
                    // Agregar a cola de sincronización
                    await offlineDB.addToSyncQueue({
                        store: OfflineStore.SALES,
                        operation: 'CREATE',
                        data: completeSale,
                    });
                }
            } else {
                console.log('📵 Sin conexión - Venta guardada para sincronizar después');
                // Agregar a cola de sincronización
                await offlineDB.addToSyncQueue({
                    store: OfflineStore.SALES,
                    operation: 'CREATE',
                    data: completeSale,
                });
            }

            return completeSale;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['invoice-sequences'] });
        },
    });
};

// Función para generar número de factura local (cuando estamos offline)
async function generateLocalInvoiceNumber(invoiceTypeId: string): Promise<string> {
    // 1. Obtener los tipos de factura cacheados para resolver UUID -> Code
    let typeCode = invoiceTypeId;

    // Si parece ser un UUID (longitud 36), buscar su código real
    if (invoiceTypeId.length > 10) {
        const cachedType = await offlineDB.get<any>(OfflineStore.INVOICE_TYPES, invoiceTypeId);
        if (cachedType && cachedType.code) {
            typeCode = cachedType.code;
        }
    }

    // 2. Obtener las configuraciones de secuencias guardadas localmente
    const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences');

    // Si no hay configuración, usar un número temporal pero intentando respetar el prefijo
    if (!settings) {
        const timestamp = Date.now();
        return `${typeCode}-OFFLINE-${timestamp}`;
    }

    // 3. Generar número usando la secuencia correcta
    // Usamos typeCode (ej: 'B02') para buscar en settings
    const sequence = settings[typeCode] || { current: 0, prefix: `${typeCode}-` };

    sequence.current += 1;
    const formattedNumber = `${sequence.prefix}${String(sequence.current).padStart(8, '0')}`;

    console.log(`🎫 Generando factura offline: Tipo=${typeCode} (#${sequence.current})`);

    // Guardar la secuencia actualizada
    await offlineDB.put(OfflineStore.SETTINGS, {
        key: 'invoice_sequences',
        ...settings,
        [typeCode]: sequence,
    });

    return formattedNumber;
}

// Función auxiliar para actualizar la secuencia local desde una venta online exitosa
async function updateLocalSequenceFromOnlineSale(invoiceTypeId: string, invoiceNumber: string) {
    try {
        const match = invoiceNumber.match(/-(\d+)$/);
        if (!match || !match[1]) return;

        const currentNumber = parseInt(match[1], 10);
        const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'invoice_sequences') || {};
        const typeCode = invoiceTypeId;

        // Solo actualizar si el número es mayor al que tenemos
        const currentSequence = settings[typeCode] || { current: 0 };
        if (currentNumber > (currentSequence.current || 0)) {
            settings[typeCode] = {
                current: currentNumber,
                prefix: `${typeCode}-`
            };

            await offlineDB.put(OfflineStore.SETTINGS, {
                key: 'invoice_sequences',
                ...settings
            });
            console.log('🔄 Secuencia local actualizada desde venta online:', invoiceNumber);
        }
    } catch (e) {
        console.error('Error actualizando secuencia local:', e);
    }
}

// Función auxiliar para obtener el store_id localmente
async function getLocalStoreId(): Promise<string | null> {
    // Intentar obtenerlo del token de sesión almacenado o configuración
    // Por simplicidad, intentamos obtener un perfil cacheado si existe, o usamos null
    // y dejamos que el backend (o la sincronización) lo resuelva si es posible.
    // Una mejor opción es guardar el store_id en 'settings' al loguearse.
    const settings = await offlineDB.get<any>(OfflineStore.SETTINGS, 'user_profile');
    return settings?.store_id || null;
}

// Función para guardar venta en Supabase (cuando hay conexión)
async function saveSaleToSupabase(saleData: CreateSaleData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .maybeSingle();

    // Obtener el código del tipo de factura
    const { data: invoiceTypeData } = await supabase
        .from('invoice_types')
        .select('code')
        .eq('id', saleData.invoice_type_id)
        .single();

    const invoiceTypeCode = invoiceTypeData?.code || saleData.invoice_type_id;

    let attempts = 0;
    const maxAttempts = 50;
    let finalSale = null;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            // Generar número de factura
            const { data: invoiceNumber, error: invoiceError } = await supabase
                .rpc('get_next_invoice_number', { invoice_type_code: invoiceTypeCode });

            if (invoiceError) {
                throw new Error(`Error generando secuencia: ${invoiceError.message}`);
            }

            // Crear la venta
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    invoice_number: invoiceNumber,
                    customer_id: saleData.customer_id || null,
                    invoice_type_id: saleData.invoice_type_id,
                    subtotal: saleData.subtotal,
                    discount_total: saleData.discount_total,
                    tax_total: saleData.tax_total,
                    total: saleData.total,
                    payment_method: saleData.payment_method,
                    amount_received: saleData.amount_received,
                    change_amount: saleData.change_amount,
                    payment_status: saleData.payment_status || 'paid',
                    due_date: saleData.due_date || null,
                    store_id: profile?.store_id || null,
                    profile_id: user.id
                }])
                .select()
                .single();

            if (saleError) {
                if (saleError.code === '23505' || saleError.message.includes('unique constraint')) {
                    continue;
                }
                throw saleError;
            }

            finalSale = sale;
            break;
        } catch (err: any) {
            if (attempts === maxAttempts) throw err;
            if (!err.message?.includes('duplicate') && !err.message?.includes('unique constraint')) throw err;
        }
    }

    if (!finalSale) throw new Error('No se pudo generar número de factura único');

    // Crear los items
    const totalSubtotal = saleData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const saleItems = saleData.items.map(item => {
        const itemSubtotal = item.price * item.quantity;
        const itemProportion = totalSubtotal > 0 ? itemSubtotal / totalSubtotal : 0;
        const itemDiscountAmount = saleData.discount_total * itemProportion;
        const itemDiscountPercentage = itemSubtotal > 0 ? (itemDiscountAmount / itemSubtotal) * 100 : 0;
        const itemAfterDiscount = itemSubtotal - itemDiscountAmount;
        const itemTaxAmount = itemAfterDiscount * item.tax;

        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);

        return {
            sale_id: finalSale.id,
            product_id: isValidUuid ? item.id : null,
            quantity: item.quantity,
            unit_price: item.price,
            discount_percentage: itemDiscountPercentage,
            tax_percentage: item.tax * 100,
            subtotal: itemSubtotal,
            discount_amount: itemDiscountAmount,
            tax_amount: itemTaxAmount,
            total: itemAfterDiscount + itemTaxAmount,
        };
    });

    const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

    if (itemsError) throw itemsError;

    // Actualizar stock
    for (const item of saleData.items) {
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id);
        if (!isValidUuid) continue;

        const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.id)
            .single();

        if (product) {
            const newStock = Math.max(0, (product.stock || 0) - item.quantity);
            await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', item.id);
        }
    }

    return finalSale;
}
