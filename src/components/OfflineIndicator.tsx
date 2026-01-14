/**
 * Indicador de estado offline/online
 * Muestra al usuario si está conectado o no, y si hay datos pendientes de sincronizar
 */

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2, AlertCircle, ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { useOnlineStatus } from '@/hooks/useProductsOffline';
import { useUserStore } from '@/hooks/useUserStore';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useWebOrdersCount } from '@/hooks/useWebOrdersCount';
import { playNotificationSound } from '@/utils/notificationSounds';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';

export const OfflineIndicator: React.FC = () => {
    const location = useLocation();
    const isOnline = useOnlineStatus();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Don't show indicators on public store pages
    const isPublicPage = location.pathname.startsWith('/tienda/') || location.pathname.startsWith('/buscar-tienda');
    if (isPublicPage) {
        return null;
    }
    const { data: store } = useUserStore();
    const { settings: storeSettings } = useStoreSettings();
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Web Order Count - Monitor changes
    const { data: webOrdersCount = 0 } = useWebOrdersCount();
    const [previousCount, setPreviousCount] = useState<number>(0);
    const [lastWebOrder, setLastWebOrder] = useState<any>(null);

    // Monitor web orders count changes
    useEffect(() => {
        // Only notify if count increased (new order arrived)
        if (webOrdersCount > previousCount && previousCount > 0) {
            console.log('🆕 New web order detected! Count changed from', previousCount, 'to', webOrdersCount);

            // Play notification sound
            const soundEnabled = storeSettings?.web_order_sound_enabled ?? true;
            const soundType = (storeSettings?.web_order_sound_type as any) ?? 'chime';
            const soundVolume = storeSettings?.web_order_sound_volume ?? 0.7;
            playNotificationSound(soundType, soundEnabled, soundVolume);

            // Show toast notification
            toast({
                title: "🛒 ¡Nuevo Pedido Web!",
                description: `Tienes ${webOrdersCount} pedido${webOrdersCount > 1 ? 's' : ''} pendiente${webOrdersCount > 1 ? 's' : ''} por revisar`,
                duration: 10000,
            });

            // Show visual notification
            setLastWebOrder({
                customer_name: 'Pedido Web',
                total: 0,
                order_number: `${webOrdersCount} pedido${webOrdersCount > 1 ? 's' : ''}`
            });

            // Auto hide after 10 seconds
            setTimeout(() => {
                setLastWebOrder(null);
            }, 10000);
        }

        // Update previous count
        setPreviousCount(webOrdersCount);
    }, [webOrdersCount, previousCount, storeSettings, toast]);

    useEffect(() => {
        // Inicializar el sistema offline al montar
        offlineDB.init();
        offlineSyncManager.start();

        // Actualizar contador de items pendientes
        const updatePendingCount = async () => {
            const pending = await offlineDB.getPendingSyncItems();
            setPendingCount(pending.length);
        };

        updatePendingCount();
        const interval = setInterval(updatePendingCount, 5000);

        return () => {
            clearInterval(interval);
            offlineSyncManager.stop();
        };
    }, []);

    // Intentar sincronizar manualmente
    const handleSync = async () => {
        if (!isOnline || isSyncing) return;

        setIsSyncing(true);
        try {
            await offlineSyncManager.sync();
            const pending = await offlineDB.getPendingSyncItems();
            setPendingCount(pending.length);
        } catch (error) {
            console.error('Error sincronizando:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    return (

        <>
            {/* Notifications Container - Independent from Indicator to prevent layout issues */}
            <div className="fixed bottom-20 left-4 z-[9999] flex flex-col gap-2 pointer-events-none">

                {lastWebOrder && (
                    <div
                        className="pointer-events-auto flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-blue-500/30 animate-in slide-in-from-left-4 fade-in duration-300 max-w-sm cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => {
                            navigate('/pos');
                            setLastWebOrder(null);
                        }}
                    >
                        <div className="bg-blue-500/10 p-2.5 rounded-full ring-2 ring-blue-500/20 animate-pulse">
                            <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0 mr-4">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">¡Nuevo Pedido Web!</h4>
                            <p className="text-xs text-muted-foreground truncate font-medium">
                                {lastWebOrder.order_number}
                            </p>
                            <p className="text-sm font-black text-primary mt-0.5">
                                Haz clic para revisar
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLastWebOrder(null);
                            }}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Offline Indicator - Fixed position */}
            <div className="fixed bottom-4 left-4 z-[9998] flex flex-col items-start gap-2">
                <div
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300",
                        "backdrop-blur-md border cursor-pointer hover:scale-105",
                        isOnline
                            ? "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300"
                            : "bg-orange-500/20 border-orange-500/50 text-orange-700 dark:text-orange-300"
                    )}
                    onClick={handleSync}
                    title={isOnline ? "Haz clic para sincronizar" : "Sin conexión - Los datos se guardan localmente"}
                >
                    {/* Icono de conexión */}
                    {isOnline ? (
                        <Wifi className="w-5 h-5 animate-pulse" />
                    ) : (
                        <WifiOff className="w-5 h-5" />
                    )}

                    {/* Texto de estado */}
                    <span className="font-medium text-sm">
                        {isOnline ? 'En línea' : 'Modo Offline'}
                    </span>

                    {/* Indicador de sincronización */}
                    {pendingCount > 0 && (
                        <>
                            <div className="w-px h-5 bg-current opacity-30" />
                            {isSyncing ? (
                                <CloudUpload className="w-4 h-4 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-semibold">{pendingCount}</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Indicador de todo sincronizado */}
                    {isOnline && pendingCount === 0 && !isSyncing && (
                        <>
                            <div className="w-px h-5 bg-current opacity-30" />
                            <CheckCircle2 className="w-4 h-4" />
                        </>
                    )}
                </div>

                {/* Tooltip informativo */}
                {pendingCount > 0 && (
                    <div className="mt-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            {pendingCount} {pendingCount === 1 ? 'operación pendiente' : 'operaciones pendientes'} de sincronizar
                        </p>
                        {isOnline && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Se sincronizarán automáticamente
                            </p>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};
