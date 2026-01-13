/**
 * Indicador de estado offline/online
 * Muestra al usuario si está conectado o no, y si hay datos pendientes de sincronizar
 */

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { offlineDB } from '@/lib/offlineDB';
import { offlineSyncManager } from '@/lib/offlineSync';
import { useOnlineStatus } from '@/hooks/useProductsOffline';

export const OfflineIndicator: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

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
        <div className="fixed bottom-4 right-4 z-50">
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
    );
};
