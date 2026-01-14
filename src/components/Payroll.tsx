
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePayroll, Payroll as PayrollType, PayrollItem, DeductionDetail } from '@/hooks/usePayroll';
import { useEmployees, Employee } from '@/hooks/useEmployees';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useUserStore } from '@/hooks/useUserStore';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Plus, Users, CheckCircle, Settings, Calculator, Percent, DollarSign, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DeductionsManager } from './DeductionsManager';
import { printPayrollReceipt } from '@/utils/printPayrollReceipt';
import { LoadingLogo } from '@/components/ui/loading-logo';

export default function Payroll() {
    const { payrolls, loadingPayrolls, createPayroll, deletePayroll, fetchPayrollItems, updatePayrollItem, finalizePayroll } = usePayroll();
    const { data: employees = [] } = useEmployees();
    const { settings, updateSettings } = useStoreSettings();
    const { data: userStore } = useUserStore();
    const { settings: companySettings } = useCompanySettings();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isNewOpen, setIsNewOpen] = useState(false);
    const [isSalaryConfigOpen, setIsSalaryConfigOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [selectedPayroll, setSelectedPayroll] = useState<PayrollType | null>(null);
    const [items, setItems] = useState<PayrollItem[]>([]);
    const [localEmployees, setLocalEmployees] = useState<Employee[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);

    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    // Sync employees when fetching or opening dialog
    useEffect(() => {
        if (employees.length > 0) {
            setLocalEmployees(employees);
        }
    }, [employees, isSalaryConfigOpen]);

    const showTSSGroup = localSettings.enable_afp && localSettings.enable_sfs;
    const showAFPOnly = localSettings.enable_afp && !localSettings.enable_sfs;
    const showSFSOnly = !localSettings.enable_afp && localSettings.enable_sfs;
    const showISR = localSettings.enable_isr;
    const showInfotep = localSettings.enable_infotep;

    // Label helpers
    const getLabel = (rate: number, type: string) => type === 'fixed' ? `$${rate}` : `${rate}%`;

    const afpLabel = getLabel(localSettings.afp_rate, localSettings.afp_type);
    const sfsLabel = getLabel(localSettings.sfs_rate, localSettings.sfs_type);
    const infotepLabel = getLabel(localSettings.infotep_rate, localSettings.infotep_type);

    const handleCreate = async () => {
        try {
            await createPayroll({ start: new Date(periodStart), end: new Date(periodEnd) });
            setIsNewOpen(false);
        } catch (e) {
            console.error(e);
        }
    };

    const handleViewDetails = async (payroll: PayrollType) => {
        setSelectedPayroll(payroll);
        setLoadingItems(true);
        try {
            const data = await fetchPayrollItems(payroll.id);
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingItems(false);
        }
    };

    const saveSettings = async () => {
        try {
            await updateSettings(localSettings);
            toast({ title: "Guardado", description: "Configuración actualizada." });
            setIsSettingsOpen(false);
        } catch (e: any) {
            toast({ title: "Error", description: e.message || "No se pudo guardar.", variant: "destructive" });
        }
    };

    // --- SALARY CONFIG LOGIC ---

    const updateEmployeeProfile = async (id: string, updates: Record<string, any>) => {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) {
            // Fallback for missing column - POLYFILL
            if (error.message?.includes('column') && updates.default_deductions_details) {
                const { default_deductions_details, ...safeUpdates } = updates;

                // Polyfill: Save details as JSON in the note column so they persist
                try {
                    safeUpdates.default_deduction_note = JSON.stringify(default_deductions_details);
                } catch (e) {
                    console.warn("Failed to stringify details for polyfill", e);
                }

                if (Object.keys(safeUpdates).length > 0) {
                    const { error: retryError } = await supabase.from('profiles').update(safeUpdates).eq('id', id);
                    if (retryError) throw retryError;
                    return 'partial';
                }
            }
            throw error;
        }
        return 'success';
    };

    const handleLocalEmployeeChange = (id: string, field: keyof Employee, value: any) => {
        setLocalEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const saveSalaryConfig = async () => {
        setIsSaving(true);
        let errorCount = 0;
        let partialCount = 0;

        try {
            await Promise.all(localEmployees.map(async (emp) => {
                try {
                    const details = emp.default_deductions_details || [];
                    const totalDed = details.reduce((s, d) => s + (Number(d.amount) || 0), 0);

                    // If user edited deduction legacy input (if enabled) or details, update both
                    const result = await updateEmployeeProfile(emp.id, {
                        base_salary: emp.base_salary,
                        default_deduction: totalDed,
                        default_deductions_details: details
                    });
                    if (result === 'partial') partialCount++;

                } catch (e) {
                    console.error(e);
                    errorCount++;
                }
            }));

            await queryClient.invalidateQueries({ queryKey: ['employees'] });

            if (errorCount > 0) {
                toast({ title: "Completado con errores", description: `Hubo ${errorCount} errores al guardar.`, variant: "destructive" });
            } else if (partialCount > 0) {
                toast({ title: "Guardado Parcial", description: "Algunos detalles no se guardaron por compatibilidad, pero los montos están correctos.", variant: "warning" });
            } else {
                toast({ title: "Guardado", description: "Configuración de salarios actualizada." });
                setIsSalaryConfigOpen(false);
            }

        } catch (e) {
            toast({ title: "Error Fatal", description: "No se pudo iniciar el guardado.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };


    // --- PAYROLL DETAILS LOGIC ---

    const calculateEstimates = (emp: Employee) => {
        const base = emp.base_salary || 0;
        const details = emp.default_deductions_details || [];
        const dedScalar = (details.length === 0) ? (emp.default_deduction || 0) :
            details.reduce((s, d) => s + (Number(d.amount) || 0), 0);

        let tss = 0;
        if (localSettings.enable_afp) {
            if (localSettings.afp_type === 'fixed') tss += localSettings.afp_rate;
            else tss += base * (localSettings.afp_rate / 100);
        }
        if (localSettings.enable_sfs) {
            if (localSettings.sfs_type === 'fixed') tss += localSettings.sfs_rate;
            else tss += base * (localSettings.sfs_rate / 100);
        }

        let infotep = 0;
        if (localSettings.enable_infotep) {
            if (localSettings.infotep_type === 'fixed') infotep = localSettings.infotep_rate;
            else infotep += base * (localSettings.infotep_rate / 100);
        }
        tss = Math.round(tss * 100) / 100;
        infotep = Math.round(infotep * 100) / 100;
        const net = base - tss - infotep - dedScalar;
        return { tss, infotep, net, dedScalar };
    };

    const handleItemUpdate = (item: PayrollItem, field: keyof PayrollItem, value: any) => {
        // LOCAL UPDATE ONLY
        const updatedItems = items.map(i => {
            if (i.id !== item.id) return i;

            const newItem = { ...i, [field]: value };

            if (field === 'deductions_details') {
                const details = value as DeductionDetail[];
                newItem.deductions = details.reduce((s, d) => s + (Number(d.amount) || 0), 0);
            }
            if (field === 'base_salary' || field === 'bonuses' || field === 'deductions' || field === 'deductions_details') {
                newItem.net_salary = newItem.base_salary - newItem.tss - newItem.infotep - newItem.deductions + (newItem.bonuses || 0);
            }

            return newItem;
        });
        setItems(updatedItems);
    };

    const savePayrollDetails = async () => {
        setIsSaving(true);
        try {
            await Promise.all(items.map(async (item) => {
                const payload: any = {
                    id: item.id,
                    base_salary: item.base_salary,
                    bonuses: item.bonuses,
                    deductions: item.deductions,
                    net_salary: item.net_salary
                };
                await updatePayrollItem(payload);
            }));

            toast({ title: "Nómina Actualizada", description: "Todos los cambios han sido guardados." });

        } catch (e) {
            toast({ title: "Error", description: "Fallo al guardar algunos items.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in pb-20 md:pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Nómina</h1>
                    <p className="text-muted-foreground">Gestión de Periodos de Pago.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} title="Configuración de Deducciones">
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setIsSalaryConfigOpen(true)}>
                        <Users className="mr-2 h-4 w-4" />
                        Configurar Salarios
                    </Button>
                    <Button onClick={() => setIsNewOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Nómina
                    </Button>
                </div>
            </div>

            {/* DASHBOARD SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardDescription>Empleados Activos</CardDescription>
                        <CardTitle className="text-3xl">{employees.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-primary/5 border-primary/20 md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardDescription>Nómina Mensual Estimada (Neto)</CardDescription>
                        <CardTitle className="text-3xl text-primary font-mono">
                            ${employees.reduce((sum, emp) => sum + calculateEstimates(emp).net, 0).toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 text-xs text-muted-foreground">
                        * Basado en la configuración actual de salarios y deducciones.
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingPayrolls ? (
                    <div className="md:col-span-2 lg:col-span-3 min-h-[200px] flex items-center justify-center">
                        <LoadingLogo text="Cargando nóminas..." size="sm" />
                    </div>
                ) : payrolls.map((payroll) => (
                    <Card key={payroll.id} className="hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => handleViewDetails(payroll)}>
                        <CardHeader className="flex flex-row items-start justify-between pb-2 pr-12">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-lg font-medium capitalize">
                                    {format(new Date(payroll.period_start), 'MMMM yyyy', { locale: es })}
                                </CardTitle>
                                <Badge variant={payroll.status === 'paid' ? 'default' : 'outline'} className={`w-fit ${payroll.status === 'paid' ? 'bg-green-600' : ''}`}>
                                    {payroll.status === 'paid' ? 'Pagado' : 'Borrador'}
                                </Badge>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("¿Estás seguro de eliminar esta nómina?")) deletePayroll(payroll.id);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Periodo:</span>
                                    <span>{format(new Date(payroll.period_start), 'd MMM')} - {format(new Date(payroll.period_end), 'd MMM')}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold">
                                    <span>Ver Detalles</span>
                                    <span>&rarr;</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* NEW PAYROLL DIALOG */}
            <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Nueva Nómina</DialogTitle>
                        <DialogDescription>
                            Selecciona las fechas que abarca este periodo de pago.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start" className="text-right">
                                Desde
                            </Label>
                            <Input
                                id="start"
                                type="date"
                                className="col-span-3"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end" className="text-right">
                                Hasta
                            </Label>
                            <Input
                                id="end"
                                type="date"
                                className="col-span-3"
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate}>Crear Nómina</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SETTINGS DIALOG */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configuración de Deducciones</DialogTitle>
                        <DialogDescription>Define montos fijos o porcentajes.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        {/* AFP */}
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_afp}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_afp: c }))}
                                    />
                                    <Label className="font-semibold">AFP (Pensiones)</Label>
                                </div>
                            </div>
                            {localSettings.enable_afp && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.afp_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, afp_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.afp_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, afp_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.afp_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, afp_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* SFS */}
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_sfs}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_sfs: c }))}
                                    />
                                    <Label className="font-semibold">SFS (Salud)</Label>
                                </div>
                            </div>
                            {localSettings.enable_sfs && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.sfs_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, sfs_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.sfs_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, sfs_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.sfs_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, sfs_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* INFOTEP */}
                        <div className="flex items-center justify-between space-x-2 border-t pt-4">
                            <div className="flex flex-col space-y-1">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={localSettings.enable_infotep}
                                        onCheckedChange={(c) => setLocalSettings(s => ({ ...s, enable_infotep: c }))}
                                    />
                                    <Label className="font-semibold">INFOTEP</Label>
                                </div>
                            </div>
                            {localSettings.enable_infotep && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center border rounded-md h-8">
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.infotep_type === 'percentage' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, infotep_type: 'percentage' }))}
                                        >%</button>
                                        <button
                                            className={`px-2 h-full text-xs hover:bg-muted ${localSettings.infotep_type === 'fixed' ? 'bg-primary text-primary-foreground' : ''}`}
                                            onClick={() => setLocalSettings(s => ({ ...s, infotep_type: 'fixed' }))}
                                        >$</button>
                                    </div>
                                    <Input
                                        type="number" className="w-20 text-right h-8"
                                        value={localSettings.infotep_rate}
                                        onChange={(e) => setLocalSettings(s => ({ ...s, infotep_rate: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={saveSettings}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SAlARY CONFIG DIALOG */}
            <Dialog open={isSalaryConfigOpen} onOpenChange={setIsSalaryConfigOpen}>
                <DialogContent className="max-w-[95vw] w-full">
                    <DialogHeader>
                        <DialogTitle>Configuración de Salarios</DialogTitle>
                        <DialogDescription>Define los sueldos y deducciones fijas por empleado.</DialogDescription>
                    </DialogHeader>
                    <div className="overflow-x-auto border rounded-md max-h-[60vh]">
                        <Table>
                            <TableHeader className="bg-muted sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="min-w-[150px]">Empleado</TableHead>
                                    <TableHead>Salario Base</TableHead>

                                    {showTSSGroup && <TableHead className="text-center w-[120px] font-bold text-orange-600">TSS</TableHead>}
                                    {showAFPOnly && <TableHead className="text-center w-[100px]">AFP ({afpLabel})</TableHead>}
                                    {showSFSOnly && <TableHead className="text-center w-[100px]">SFS ({sfsLabel})</TableHead>}
                                    {showISR && <TableHead className="text-center w-[100px]">ISR</TableHead>}

                                    {showInfotep && <TableHead className="text-center w-[100px]">Infotep ({infotepLabel})</TableHead>}

                                    <TableHead className="text-center">Deducciones</TableHead>
                                    <TableHead className="text-right">Neto Estimado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localEmployees.map(emp => {
                                    const { tss, infotep, net } = calculateEstimates(emp);

                                    return (
                                        <TableRow key={emp.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{emp.full_name}</span>
                                                    <span className="text-xs text-muted-foreground capitalize">{emp.role}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    key={`base-${emp.id}`}
                                                    type="number"
                                                    className="w-24"
                                                    value={emp.base_salary || 0}
                                                    onChange={(e) => handleLocalEmployeeChange(emp.id, 'base_salary', parseFloat(e.target.value) || 0)}
                                                />
                                            </TableCell>

                                            {showTSSGroup && <TableCell className="text-center font-bold text-orange-600">${tss.toLocaleString()}</TableCell>}
                                            {showAFPOnly && <TableCell className="text-center">${(localSettings.afp_type === 'fixed' ? localSettings.afp_rate : (emp.base_salary || 0) * (localSettings.afp_rate / 100)).toFixed(2)}</TableCell>}
                                            {showSFSOnly && <TableCell className="text-center">${(localSettings.sfs_type === 'fixed' ? localSettings.sfs_rate : (emp.base_salary || 0) * (localSettings.sfs_rate / 100)).toFixed(2)}</TableCell>}
                                            {showISR && <TableCell className="text-center text-xs text-muted-foreground">--</TableCell>}

                                            {showInfotep && <TableCell className="text-center">${infotep.toLocaleString()}</TableCell>}

                                            <TableCell className="text-center">
                                                <DeductionsManager
                                                    deductions={(emp.default_deductions_details as DeductionDetail[]) || (emp.default_deduction ? [{ amount: emp.default_deduction, reason: "Deducción" }] : [])}
                                                    onChange={(newDetails) => handleLocalEmployeeChange(emp.id, 'default_deductions_details', newDetails)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                ${net.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex justify-end border-t p-4 bg-muted/10">
                        <div className="mr-auto flex gap-6 items-center text-sm">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">Empleados</span>
                                <span className="font-bold text-lg">{localEmployees.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">Total Nómina Estimada</span>
                                <span className="font-bold text-lg text-primary">
                                    ${localEmployees.reduce((sum, emp) => sum + calculateEstimates(emp).net, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsSalaryConfigOpen(false)}>Cancelar</Button>
                            <Button onClick={saveSalaryConfig} disabled={isSaving}>
                                {isSaving ? "Guardando..." : "Guardar Salarios"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* DETAILS DIALOG */}
            <Dialog open={!!selectedPayroll} onOpenChange={(o) => {
                if (!o && !isSaving) setSelectedPayroll(null);
            }}>
                <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col gap-0 p-0">
                    <div className="p-6 pb-2 border-b">
                        <DialogHeader>
                            <DialogTitle className="flex justify-between items-center pr-8">
                                <span className="text-2xl">Nómina: {selectedPayroll && format(new Date(selectedPayroll.period_start), 'MMMM yyyy', { locale: es })}</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setSelectedPayroll(null)}>Cerrar</Button>
                                    <Button onClick={savePayrollDetails} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                                    </Button>
                                    {selectedPayroll?.status !== 'paid' && (
                                        <Button onClick={async () => {
                                            await finalizePayroll(selectedPayroll!.id);
                                            // Print receipt after finalizing
                                            console.log('[DEBUG] Company Settings:', companySettings);
                                            console.log('[DEBUG] Logo URL:', companySettings?.logo_url);
                                            console.log('[DEBUG] Company Name:', companySettings?.company_name);
                                            printPayrollReceipt(
                                                selectedPayroll,
                                                items,
                                                companySettings?.company_name || userStore?.store_name || 'Mi Negocio',
                                                companySettings?.logo_url || undefined
                                            );
                                        }}>
                                            <CheckCircle className="mr-2 h-4 w-4" /> Finalizar y Pagar
                                        </Button>
                                    )}
                                </div>
                            </DialogTitle>
                        </DialogHeader>
                    </div>
                    <div className="flex-1 overflow-auto bg-muted/10 p-6">
                        <Table className="border bg-background rounded-md">
                            <TableHeader className="bg-muted sticky top-0 shadow-sm z-10">
                                <TableRow>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Sala. Base</TableHead>
                                    <TableHead>Bonos</TableHead>

                                    {(showTSSGroup || showAFPOnly || showSFSOnly) && <TableHead className="text-red-600 font-bold">TSS/Ley</TableHead>}

                                    {showInfotep && <TableHead className="text-purple-600">Infotep</TableHead>}

                                    <TableHead>Otras Deducciones</TableHead>
                                    <TableHead className="text-right font-bold w-[120px]">Neto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingItems ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64">
                                            <div className="flex items-center justify-center">
                                                <LoadingLogo text="Cargando empleados..." size="sm" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium sticky left-0 bg-background/90">{item.employee_name}</TableCell>
                                        <TableCell>${item.base_salary.toLocaleString()}</TableCell>
                                        <TableCell><Input type="number" className="w-20" value={item.bonuses} onChange={(e) => handleItemUpdate(item, 'bonuses', parseFloat(e.target.value) || 0)} /></TableCell>

                                        {(showTSSGroup || showAFPOnly || showSFSOnly) && (
                                            <TableCell>
                                                <Input
                                                    type="number" className="w-20 border-red-200 font-bold text-red-700" value={item.tss} readOnly
                                                />
                                            </TableCell>
                                        )}

                                        {showInfotep && (
                                            <TableCell>
                                                <Input type="number" className="w-20 border-purple-200" value={item.infotep} readOnly />
                                            </TableCell>
                                        )}

                                        <TableCell>
                                            <DeductionsManager
                                                deductions={item.deductions ? [{ amount: item.deductions, reason: "Deducciones" }] : []}
                                                onChange={(newDetails) => handleItemUpdate(item, 'deductions_details', newDetails)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-primary bg-primary/5 text-lg">
                                            ${item.net_salary.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="p-4 border-t bg-background flex justify-between items-center shadow-lg z-20">
                        <div className="flex gap-8 items-center text-sm px-2">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Empleados</span>
                                <span className="font-bold text-xl">{items.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs uppercase tracking-wider">Total a Pagar</span>
                                <span className="font-bold text-xl text-primary font-mono">
                                    ${items.reduce((sum, item) => sum + (item.net_salary || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            * Confirmar montos antes de finalizar.
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
