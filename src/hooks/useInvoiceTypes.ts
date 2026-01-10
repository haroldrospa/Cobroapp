
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceType {
  id: string;
  name: string;
  description?: string;
  code: string;
}

export const useInvoiceTypes = () => {
  return useQuery({
    queryKey: ['invoice-types'],
    staleTime: 1000 * 60 * 60 * 24, // 24 hours cache (static data)
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_types')
        .select('*')
        .order('code');

      if (error) throw error;
      return data as InvoiceType[];
    },
  });
};
