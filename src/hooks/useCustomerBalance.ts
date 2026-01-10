import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingSale {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  balance: number; // total - amount_paid
  due_date: string | null;
  created_at: string;
}

export const useCustomerBalance = (customerId?: string) => {
  return useQuery({
    queryKey: ['customerBalance', customerId],
    queryFn: async () => {
      if (!customerId) return { totalDebt: 0, pendingSales: [] };

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customerId)
        .eq('payment_status', 'pending')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Calculate balance for each sale (total - amount_paid)
      const pendingSales: PendingSale[] = (data || []).map(sale => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        total: sale.total,
        amount_paid: sale.amount_paid || 0,
        balance: sale.total - (sale.amount_paid || 0),
        due_date: sale.due_date,
        created_at: sale.created_at!,
      }));

      // Total debt is the sum of remaining balances
      const totalDebt = pendingSales.reduce((sum, sale) => sum + sale.balance, 0);

      return {
        totalDebt,
        pendingSales,
      };
    },
    enabled: !!customerId,
  });
};

export const useAllCustomersBalances = () => {
  return useQuery({
    queryKey: ['allCustomersBalances', 'v2'],
    queryFn: async () => {
      // Get all pending sales
      const { data, error } = await supabase
        .from('sales')
        .select('customer_id, total, amount_paid, due_date')
        .eq('payment_status', 'pending');

      if (error) throw error;

      // Group by customer_id
      const balances: Record<string, number> = {};
      const overdueCustomers = new Set<string>();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      data?.forEach((sale: any) => {
        if (sale.customer_id) {
          const debt = sale.total - (sale.amount_paid || 0);
          balances[sale.customer_id] = (balances[sale.customer_id] || 0) + debt;

          if (sale.due_date) {
            const dueDate = new Date(sale.due_date);
            // Use timestamp comparison
            if (dueDate.getTime() < today.getTime()) {
              overdueCustomers.add(sale.customer_id);
            }
          }
        }
      });

      return { balances, overdueCustomers };
    },
  });
};
