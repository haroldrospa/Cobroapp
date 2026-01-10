import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CashSession {
    id: string;
    store_id: string;
    opened_by: string;
    opened_at: string;
    initial_cash: number;
    status: 'open' | 'closed';
    closed_at?: string;
    closed_by?: string;
    total_sales_cash?: number;
    expected_cash?: number;
    actual_cash?: number;
    difference?: number;
    notes?: string;
}

export const useActiveSession = () => {
    return useQuery({
        queryKey: ['active-cash-session'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // First find store
            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .single();

            if (!profile?.store_id) return null;

            // @ts-ignore
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*')
                .eq('store_id', profile.store_id)
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data as CashSession | null;
        },
        retry: false
    });
};

export const useOpenSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ initialCash }: { initialCash: number }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('store_id')
                .eq('id', user.id)
                .single();

            if (!profile?.store_id) throw new Error('No store found');

            // @ts-ignore
            const { data, error } = await supabase
                .from('cash_sessions')
                .insert({
                    store_id: profile.store_id,
                    opened_by: user.id,
                    initial_cash: initialCash,
                    status: 'open',
                    opened_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (newItem) => {
            // Instant UI update
            queryClient.setQueryData(['active-cash-session'], newItem);
            queryClient.invalidateQueries({ queryKey: ['active-cash-session'] });
        }
    });
};

export const useCloseSession = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ sessionId, closingData }: { sessionId: string, closingData: any }) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // @ts-ignore
            const { data, error } = await supabase
                .from('cash_sessions')
                .update({
                    ...closingData,
                    status: 'closed',
                    closed_by: user.id,
                    closed_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-cash-session'] });
            queryClient.invalidateQueries({ queryKey: ['daily-closings'] }); // If we link reporting to this
        }
    });
};

export const useSessionHistory = () => {
    return useQuery({
        queryKey: ['cash-session-history'],
        queryFn: async () => {
            // @ts-ignore
            const { data, error } = await supabase
                .from('cash_sessions')
                .select('*, opener:opened_by(full_name), closer:closed_by(full_name)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        }
    });
};
