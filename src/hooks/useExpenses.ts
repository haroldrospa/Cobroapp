
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from './useUserStore';
import { useToast } from './use-toast';

export interface Expense {
    id: string;
    store_id: string;
    date: Date; // Transformed from string in DB
    description: string;
    amount: number;
    category: string;
    supplier_id: string | null;
    supplier_name?: string; // Optional helpful field join
    invoice_number: string | null;
    image_url: string | null;
    created_at: string;
}

export type CreateExpenseDTO = Omit<Expense, 'id' | 'created_at' | 'store_id' | 'supplier_name'> & {
    supplier_name?: string // We might pass name instead of ID for quick entry
};

export const useExpenses = () => {
    const { data: userStore } = useUserStore();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];

            // We join with suppliers to get the name if possible, although for simple expense
            // we might have stored the supplier name in a separate way or just use text logic.
            // For now, let's just fetch the raw table and maybe join suppliers manually if needed.
            // Or better, let's treat 'supplier_id' correctly.

            const { data, error } = await supabase
                .from('expenses')
                .select(`
          *,
          suppliers (
            name
          )
        `)
                .eq('store_id', userStore.id)
                .order('date', { ascending: false });

            if (error) {
                console.error('Error loading expenses:', error);
                throw error;
            }

            return data.map((item: any) => ({
                ...item,
                date: new Date(item.date),
                supplier_name: item.suppliers?.name || 'N/A' // Fallback or joined name
            })) as Expense[];
        },
        enabled: !!userStore?.id,
    });

    const createExpenseMutation = useMutation({
        mutationFn: async (newExpense: CreateExpenseDTO) => {
            if (!userStore?.id) throw new Error('No store configured');

            // Logic: If supplier_id is missing but supplier_name is provided, 
            // check if it exists or create it? 
            // For simplicity MVP: If user selects from list, we get ID. If types textual name, we ignore ID.
            // But database expects ID for FK or null?
            // Let's assume for now the UI passes supplier_id if it matched a known supplier.

            const { data, error } = await supabase
                .from('expenses')
                .insert({
                    store_id: userStore.id,
                    date: newExpense.date.toISOString(),
                    description: newExpense.description,
                    amount: newExpense.amount,
                    category: newExpense.category,
                    supplier_id: newExpense.supplier_id || null, // Ensure null if empty string
                    invoice_number: newExpense.invoice_number,
                    image_url: newExpense.image_url,
                    created_at: newExpense.created_at // Pass the override if present
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Gasto guardado",
                description: "El gasto se ha registrado correctamente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo guardar el gasto.",
                variant: "destructive",
            });
        },
    });

    const deleteExpenseMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            toast({
                title: "Gasto eliminado",
                description: "El registro ha sido borrado permamentemente.",
            });
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "No se pudo eliminar el gasto.",
                variant: "destructive",
            });
        }
    });

    return {
        expenses,
        isLoading,
        createExpense: createExpenseMutation.mutateAsync,
        deleteExpense: deleteExpenseMutation.mutateAsync,
        isCreating: createExpenseMutation.isPending,
    };
};
