
export interface DeductionDetail {
    amount: number;
    reason: string;
}

export interface Employee {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'manager' | 'cashier' | 'staff';
    is_active: boolean;
    created_at: string;
    base_salary?: number;
    tss?: number;
    infotep?: number;
    default_deduction?: number;
    default_deduction_note?: string;

    // Legacy support
    apply_afp?: boolean;
    apply_sfs?: boolean;
    apply_isr?: boolean;

    // New detailed structure
    default_deductions_details?: DeductionDetail[];
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/hooks/useUserStore';

export const useEmployees = () => {
    const { data: store } = useUserStore();
    const storeId = store?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: ['employees', storeId],
        queryFn: async () => {
            if (!storeId) return [];
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('store_id', storeId)
                .order('full_name');

            if (error) {
                console.error("Error fetching employees:", error);
                throw error;
            }

            // Map ensure array is present with robust fallback/recovery logic
            return data.map((emp: any) => {
                let details: DeductionDetail[] = [];

                // 1. Try native JSONB column
                if (Array.isArray(emp.default_deductions_details) && emp.default_deductions_details.length > 0) {
                    details = emp.default_deductions_details as DeductionDetail[];
                } else {
                    // 2. Try recovering from Note (Polyfill)
                    if (emp.default_deduction_note && emp.default_deduction_note.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(emp.default_deduction_note);
                            if (Array.isArray(parsed)) details = parsed;
                        } catch (e) {
                            // ignore parse error 
                        }
                    }
                }

                // 3. Fallback to legacy scalar if details are still empty
                if (details.length === 0 && (emp.default_deduction || 0) > 0) {
                    details = [{
                        amount: emp.default_deduction,
                        reason: (emp.default_deduction_note && !emp.default_deduction_note.startsWith('['))
                            ? emp.default_deduction_note
                            : "Deducción General"
                    }];
                }

                return {
                    ...emp,
                    default_deductions_details: details
                };
            }) as Employee[];
        },
        enabled: !!storeId,
        staleTime: 30000, // Cache for 30 seconds
    });

    return {
        data: data ?? [],
        isLoading,
        error
    };
};

// Hook for managing employee operations (create, update, toggle_status)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ManageEmployeePayload {
    action: 'create' | 'update' | 'toggle_status';
    id?: string;
    fullName?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'manager' | 'cashier' | 'staff';
    isActive?: boolean;
}

export const useManageEmployee = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (payload: ManageEmployeePayload) => {
            const { data, error } = await supabase.functions.invoke('manage-employee', {
                body: payload
            });

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });

            const messages = {
                create: 'Empleado creado exitosamente',
                update: 'Empleado actualizado exitosamente',
                toggle_status: 'Estado del empleado actualizado'
            };

            toast({
                title: 'Éxito',
                description: messages[variables.action],
            });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.message || 'Hubo un problema al gestionar el empleado',
                variant: 'destructive',
            });
        },
    });
};
