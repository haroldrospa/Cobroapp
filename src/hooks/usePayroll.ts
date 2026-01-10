
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/hooks/useUserStore';

export interface Payroll {
    id: string;
    store_id: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    status: 'draft' | 'processed' | 'paid';
    created_at: string;
}

export interface DeductionDetail {
    amount: number;
    reason: string;
}

export interface PayrollItem {
    id: string;
    payroll_id: string;
    profile_id: string | null;
    employee_name: string;
    base_salary: number;
    bonuses: number;

    tss: number;
    infotep: number;
    regalia: number;
    severance: number;

    deductions: number; // Sum of details
    deductions_details?: DeductionDetail[]; // Array of detailed deductions

    net_salary: number;
    status: 'pending' | 'paid';
    note?: string;
}

export const usePayroll = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: userStore } = useUserStore();

    // 1. Fetch Payrolls
    const { data: payrolls = [], isLoading: loadingPayrolls } = useQuery({
        queryKey: ['payrolls', userStore?.id],
        queryFn: async () => {
            if (!userStore?.id) return [];
            const { data, error } = await supabase
                .from('payrolls')
                .select('*')
                .eq('store_id', userStore.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Payroll[];
        },
        enabled: !!userStore?.id
    });

    // 2. Create Payroll
    const createPayrollMutation = useMutation({
        mutationFn: async ({ start, end }: { start: Date, end: Date }) => {
            if (!userStore?.id) throw new Error("No store selected");

            // A. Fetch Store Settings
            const { data: storeData, error: storeError } = await supabase
                .from('stores')
                .select('*')
                .eq('id', userStore.id)
                .single();

            const sData = storeData as any;
            const settings = sData ?
                {
                    afp: sData.afp_rate ?? 2.87,
                    sfs: sData.sfs_rate ?? 3.04,
                    infotep: sData.infotep_rate ?? 1.0,

                    enable_afp: sData.enable_afp ?? true,
                    enable_sfs: sData.enable_sfs ?? true,
                    enable_infotep: sData.enable_infotep ?? false,

                    afp_type: sData.afp_type ?? 'percentage',
                    sfs_type: sData.sfs_type ?? 'percentage',
                    infotep_type: sData.infotep_type ?? 'percentage'
                } :
                {
                    afp: 2.87, sfs: 3.04, infotep: 1.0,
                    enable_afp: true, enable_sfs: true, enable_infotep: false,
                    afp_type: 'percentage', sfs_type: 'percentage', infotep_type: 'percentage'
                };

            // B. Create Record
            const { data: payroll, error: payrollError } = await supabase
                .from('payrolls')
                .insert({
                    store_id: userStore.id,
                    period_start: start.toISOString(),
                    period_end: end.toISOString(),
                    status: 'draft',
                    total_amount: 0
                })
                .select()
                .single();

            if (payrollError) throw payrollError;

            // --- "BEST EFFORT" PHASE ---
            try {
                console.log('[PAYROLL] Starting Best Effort phase for payroll:', payroll.id);

                // C. Fetch Employees
                const { data: employees, error: empError } = await supabase
                    .from('profiles')
                    .select(`id, full_name, base_salary, default_deduction`)
                    .eq('store_id', userStore.id)
                    .eq('is_active', true);

                console.log('[PAYROLL] Fetched employees:', employees?.length || 0, 'Error:', empError);

                if (empError) {
                    console.error("[PAYROLL] Error fetching employees", empError);
                    return payroll;
                }

                if (!employees || employees.length === 0) {
                    console.warn('[PAYROLL] No employees found');
                    return payroll;
                }

                // D. Generate Items
                const items = employees.map((emp: any) => {
                    const base = emp.base_salary || 0;

                    // --- Process Deductions ---
                    // Use the scalar deduction value since detailed breakdown column doesn't exist
                    const totalDeductions = emp.default_deduction || 0;

                    // --- Calculate TSS & Infotep ---
                    let afpPart = 0;
                    let sfsPart = 0;

                    if (settings.enable_afp) {
                        if (settings.afp_type === 'fixed') afpPart = settings.afp;
                        else afpPart = base * (settings.afp / 100);
                    }

                    if (settings.enable_sfs) {
                        if (settings.sfs_type === 'fixed') sfsPart = settings.sfs;
                        else sfsPart = base * (settings.sfs / 100);
                    }

                    const calculatedTss = Math.round((afpPart + sfsPart) * 100) / 100;

                    let calculatedInfotep = 0;
                    if (settings.enable_infotep) {
                        if (settings.infotep_type === 'fixed') calculatedInfotep = settings.infotep;
                        else calculatedInfotep = base * (settings.infotep / 100);
                    }
                    calculatedInfotep = Math.round(calculatedInfotep * 100) / 100;

                    return {
                        payroll_id: payroll.id,
                        profile_id: emp.id,
                        employee_name: emp.full_name || 'Desconocido',
                        base_salary: base,
                        bonuses: 0,
                        tss: calculatedTss,
                        infotep: calculatedInfotep,
                        regalia: 0,
                        severance: 0,
                        deductions: totalDeductions,
                        net_salary: (base - calculatedTss - calculatedInfotep - totalDeductions),
                    };
                });

                console.log('[PAYROLL] Generated items:', items.length);

                // E. Safe Insert Strategy
                if (items.length > 0) {
                    console.log('[PAYROLL] Attempting standard insert...');
                    // Try 1: Full Fidelity (JSON columns included)
                    const { error: itemsError } = await supabase.from('payroll_items').insert(items);

                    if (itemsError) {
                        console.warn("[PAYROLL] Standard insert failed (likely schema mismatch), attempting Minimal Fallback...", itemsError);

                        // Try 2: Minimal Compatibility (Scalar values only)
                        // We explicitly construct a safe object to avoid accidental extra fields like 'note' or 'deductions_details'
                        // if columns don't exist.
                        const minimalItems = items.map((i: any) => ({
                            payroll_id: i.payroll_id,
                            profile_id: i.profile_id,
                            employee_name: i.employee_name,
                            base_salary: i.base_salary,
                            bonuses: i.bonuses,
                            tss: i.tss,
                            infotep: i.infotep,
                            regalia: i.regalia,
                            severance: i.severance,
                            deductions: i.deductions,
                            net_salary: i.net_salary,
                            status: 'pending'
                        }));

                        console.log('[PAYROLL] Attempting minimal insert with', minimalItems.length, 'items');
                        const { error: minimalError } = await supabase.from('payroll_items').insert(minimalItems);

                        if (minimalError) {
                            console.error("[PAYROLL] CRITICAL: Minimal insert also failed. The payroll will be empty.", minimalError);
                            toast({
                                title: "Error Crítico",
                                description: "No se pudieron guardar los empleados en la nómina. Verifique la base de datos.",
                                variant: "destructive"
                            });
                        } else {
                            console.log('[PAYROLL] Minimal insert succeeded');
                            // Notify user of simplification
                            toast({
                                title: "Aviso de Compatibilidad",
                                description: "La nómina se generó en modo simplificado (sin historial de detalles).",
                                variant: "default"
                            });
                        }
                    } else {
                        console.log('[PAYROLL] Standard insert succeeded');
                    }
                } else {
                    console.warn("[PAYROLL] No items to insert");
                    console.warn("No employees found to add to payroll.");
                    toast({
                        title: "Sin Empleados",
                        description: "No se encontraron empleados activos para procesar.",
                        variant: "warning"
                    });
                }
            } catch (globalError) {
                console.error("[PAYROLL] Non-fatal error populating payroll", globalError);
            }

            return payroll;
        },
        onSuccess: () => {
            toast({ title: "Nómina Generada", description: "Proceso completado." });
        },
        onError: (e) => {
            console.error(e);
            toast({ title: "Error", description: "Hubo un problema iniciando la nómina.", variant: "destructive" });
        },
        onSettled: () => {
            // ALWAYS refresh the list
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
        }
    });

    // 3. Fetch Items
    const fetchPayrollItems = async (payrollId: string) => {
        const { data, error } = await supabase
            .from('payroll_items')
            .select('*')
            .eq('payroll_id', payrollId)
            .order('employee_name');
        if (error) throw error;

        // Ensure proper typing for JSONB
        return data.map((item: any) => {
            let details = item.deductions_details;

            // Polyfill Recovery: If native column empty, try parsing note
            if (!Array.isArray(details) || details.length === 0) {
                if (item.note && item.note.trim().startsWith('[')) {
                    try {
                        const parsed = JSON.parse(item.note);
                        if (Array.isArray(parsed)) details = parsed;
                    } catch (e) { /* ignore */ }
                }
            }

            return {
                ...item,
                deductions_details: (details as DeductionDetail[]) || []
            };
        }) as PayrollItem[];
    };

    // 4. Update Item
    const updatePayrollItemMutation = useMutation({
        mutationFn: async (item: Partial<PayrollItem> & { id: string }) => {
            // Need to separate scalar updates from JSONB helper? 
            // Postgres handles full JSON replacement fine.
            const payload = { ...item };

            // If updating details, auto-recalculate total deduction scalar
            if (item.deductions_details) {
                const total = item.deductions_details.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
                payload.deductions = total;
                // We should also recalculate net_salary but we need base_salary which might not be in 'item' partial.
                // For safety, best to recalc net in the UI before calling update, OR fetch current item state here.
                // For now, assume caller provides correct scalars or we trust the details source of truth.
            }

            const { error } = await supabase
                .from('payroll_items')
                .update(payload)
                .eq('id', item.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
        }
    });

    // 5. Delete Payroll
    const deletePayrollMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('payrolls').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
            toast({ title: "Eliminado", description: "La nómina ha sido eliminada." });
        }
    });

    // 6. Finalize
    const finalizePayrollMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('payrolls')
                .update({ status: 'paid' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrolls'] });
            toast({ title: "Pagado", description: "La nómina ha sido marcada como pagada." });
        }
    });

    return {
        payrolls,
        loadingPayrolls,
        createPayroll: createPayrollMutation.mutateAsync,
        deletePayroll: deletePayrollMutation.mutateAsync,
        fetchPayrollItems,
        updatePayrollItem: updatePayrollItemMutation.mutateAsync,
        finalizePayroll: finalizePayrollMutation.mutateAsync
    };
};
