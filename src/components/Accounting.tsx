import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, DollarSign, TrendingDown, TrendingUp, Building2, Calendar, FileText, Search, Filter, Trash2, Camera, Loader2, Check, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSales } from '@/hooks/useSalesManagement';
import { useExpenses } from '@/hooks/useExpenses';
import { useSuppliers } from '@/hooks/useSuppliers';

const CATEGORIES = [
    'Inventario',
    'Servicios Públicos',
    'Alquiler',
    'Nómina',
    'Mantenimiento',
    'Marketing',
    'Impuestos',
    'Otros'
];

type Supplier = {
    id: string;
    name: string;
    rnc?: string | null;
    contact?: string | null;
};

export default function Accounting() {
    const { toast } = useToast();
    const { data: sales = [] } = useSales();
    const { expenses, createExpense, deleteExpense, isLoading: loadingExpenses } = useExpenses();
    const { suppliers, createSupplier, isLoading: loadingSuppliers } = useSuppliers();

    const [activeTab, setActiveTab] = useState('overview');
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [newExpense, setNewExpense] = useState<{
        date: Date;
        description: string;
        amount: string | number;
        category: string;
        supplier_name: string;
        invoice_number: string;
    }>({
        date: new Date(),
        description: '',
        amount: '',
        category: 'Inventario',
        supplier_name: '',
        invoice_number: ''
    });

    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({});

    const [currentDate, setCurrentDate] = useState(new Date());

    // Month Navigation
    const nextMonth = () => {
        const next = new Date(currentDate);
        next.setMonth(next.getMonth() + 1);
        setCurrentDate(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentDate);
        prev.setMonth(prev.getMonth() - 1);
        setCurrentDate(prev);
    };

    // Filter Data by Month
    const filteredSales = sales.filter(sale => {
        const d = new Date(sale.created_at);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    const filteredExpenses = expenses.filter(expense => {
        const d = new Date(expense.created_at);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    // Calculations
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const netIncome = totalSales - totalExpenses;

    const handleAddExpense = async () => {
        if (!newExpense.amount || !newExpense.description) {
            toast({
                title: "Campos requeridos",
                description: "Por favor completa el monto y la descripción.",
                variant: "destructive"
            });
            return;
        }

        // Find supplier ID by name matcher
        const foundSupplier = suppliers.find(s => s.name.toLowerCase() === newExpense.supplier_name.trim().toLowerCase());

        try {
            await createExpense({
                date: newExpense.date || new Date(), // Keep this date as selected by user, not necessarily current month
                description: newExpense.description,
                amount: Number(newExpense.amount),
                category: newExpense.category || 'Otros',
                supplier_id: foundSupplier?.id || null,
                invoice_number: newExpense.invoice_number,
                image_url: null
            });

            setIsAddExpenseOpen(false);
            setNewExpense({
                date: new Date(),
                description: '',
                amount: '',
                category: 'Inventario',
                supplier_name: '',
                invoice_number: ''
            });

            if (newExpense.supplier_name && !foundSupplier) {
                toast({
                    title: "Nota",
                    description: `El proveedor "${newExpense.supplier_name}" no existe en el catálogo, se guardó el gasto sin vincular.`,
                });
            }

        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (confirm('¿Estás seguro de borrar este gasto?')) {
            await deleteExpense(id);
        }
    };

    const handleAddSupplier = async () => {
        if (!newSupplier.name) return;

        try {
            await createSupplier({
                name: newSupplier.name,
                rnc: newSupplier.rnc || null,
                contact: newSupplier.contact || null
            });
            setIsAddSupplierOpen(false);
            setNewSupplier({});
        } catch (error) {
            console.error(error);
        }
    };

    const preprocessImage = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(URL.createObjectURL(file));

                // Reducir tamaño para evitar errores de red (Payload too large)
                const MAX_WIDTH = 1500;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                // No necesitamos escala de grises para Gemini, él ve bien a color.
                // Usar calidad 0.7 para comprimir JPEG
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const processReceiptImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Gestión de API Key
        // Clave temporalmente en código para asegurar que funcione sin reiniciar servidor
        const HARDCODED_KEY = "AIzaSyAHZ3CoVLGRV7-ZHbfQM9seO0-9ga7Jwak";

        let apiKey = HARDCODED_KEY || import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');

        if (!apiKey) {
            apiKey = prompt("Ingresa tu API Key de Google Gemini:");
            if (apiKey && apiKey.trim().length > 0) {
                apiKey = apiKey.trim();
                localStorage.setItem('GEMINI_API_KEY', apiKey);
            } else {
                toast({ title: "Requerido", description: "Se necesita la API Key.", variant: "destructive" });
                return;
            }
        }

        setIsScanning(true);
        try {
            const optimizedImageUrl = await preprocessImage(file);
            const base64Image = optimizedImageUrl.split(',')[1];

            const genAI = new GoogleGenerativeAI(apiKey);

            // Usando modelo 2.5 disponible en 2026
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Extrae datos de esta factura en JSON: date(YYYY-MM-DD), description, amount(number), supplier_name, invoice_number, category(Inventario,Servicios,Alquiler,Mantenimiento,Marketing,Impuestos,Otros). Si dato falta, usa null.`;

            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
            ]);

            const response = await result.response;
            const text = response.text();

            // JSON Parser
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, '').trim();
            const data = JSON.parse(jsonStr);

            setNewExpense(prev => ({
                ...prev,
                date: data.date ? new Date(data.date) : prev.date,
                description: data.description || `Gasto en ${data.supplier_name || 'Desconocido'}`,
                amount: data.amount || prev.amount,
                supplier_name: data.supplier_name || prev.supplier_name,
                invoice_number: data.invoice_number || prev.invoice_number,
                category: data.category || 'Otros'
            }));

            toast({ title: "Éxito", description: `Leído: $${data.amount} - ${data.supplier_name}` });

        } catch (error: any) {
            console.error("Gemini Error:", error);
            const msg = error.message || String(error);

            // Mostrar error detallado sin bloquear con confirm()
            toast({
                title: "Error al escanear",
                description: `Detalles: ${msg.slice(0, 150)}`,
                variant: "destructive",
                duration: 10000 // Durar más para que pueda leerlo
            });

        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const resetApiKey = () => {
        if (confirm("¿Borrar la API Key guardada? Tendrás que ingresarla de nuevo la próxima vez.")) {
            localStorage.removeItem('GEMINI_API_KEY');
            toast({ title: "API Key borrada" });
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500 pb-20 md:pb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contabilidad</h1>
                    <p className="text-muted-foreground">Gestión financiera, gastos y proveedores.</p>
                </div>

                <div className="flex items-center gap-4 bg-muted/50 p-1 rounded-lg border">
                    <Button variant="ghost" size="icon" onClick={prevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-2 font-medium min-w-[140px] justify-center">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={nextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={resetApiKey} title="Resetear API Key IA">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button id="accounting-add-expense-btn" onClick={() => setIsAddExpenseOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Registrar Gasto
                    </Button>
                </div>
            </div>

            <div id="accounting-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ... existing cards ... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales (Ventas)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">${totalSales.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">+20.1% del mes pasado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos Operativos</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Incluye compras y servicios</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-primary' : 'text-red-600'}`}>
                            ${netIncome.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Margen de beneficio actual</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs id="accounting-tabs" defaultValue="expenses" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="expenses">Gastos y Compras</TabsTrigger>
                    <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
                    <TabsTrigger value="reports">Reportes Financieros</TabsTrigger>
                </TabsList>

                <TabsContent value="expenses" className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar gastos..." className="pl-8" />
                        </div>
                        <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
                    </div>

                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>No. Factura</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead className="text-center w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                            No hay gastos registrados en este mes.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExpenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>{format(expense.date, 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="font-medium">{expense.description}</TableCell>
                                            <TableCell>{expense.supplier_name || '-'}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50">
                                                    {expense.category}
                                                </span>
                                            </TableCell>
                                            <TableCell>{expense.invoice_number || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-bold text-red-600">
                                                -${expense.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDeleteExpense(expense.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="suppliers" className="space-y-4">
                    <div className="flex justify-between">
                        <h3 className="text-lg font-medium">Directorio de Proveedores</h3>
                        <Button variant="outline" size="sm" onClick={() => setIsAddSupplierOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Proveedor
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {suppliers.map((supplier) => (
                            <Card key={supplier.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-base font-medium">{supplier.name}</CardTitle>
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="mt-2 text-sm">
                                    <div className="grid gap-1">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">RNC:</span>
                                            <span>{supplier.rnc}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Contacto:</span>
                                            <span>{supplier.contact}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="reports" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Estado de Resultados</CardTitle>
                            <CardDescription>Resumen de Ganancias y Pérdidas del Periodo</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium">Ingresos por Ventas</span>
                                    <span className="text-green-600 font-bold">${totalSales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium">Costo de Ventas (Estimado)</span>
                                    <span className="text-red-900">(${(totalSales * 0.7).toLocaleString()})</span> {/* Placeholder logic */}
                                </div>
                                <div className="flex justify-between py-2 border-b bg-muted/20 px-2">
                                    <span className="font-bold">Utilidad Bruta</span>
                                    <span className="font-bold">${(totalSales * 0.3).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b">
                                    <span className="font-medium text-muted-foreground">Gastos Operativos</span>
                                    <span className="text-red-600">(${totalExpenses.toLocaleString()})</span>
                                </div>
                                <div className="flex justify-between py-4 border-t-2 border-black">
                                    <span className="text-lg font-bold">Utilidad Neta</span>
                                    <span className={`text-lg font-bold ${netIncome >= 0 ? 'text-primary' : 'text-red-600'}`}>
                                        ${(totalSales * 0.3 - totalExpenses).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog: Add Expense */}
            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                        <DialogDescription>
                            Ingresa los detalles o escanea una factura.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-center py-2">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={processReceiptImage}
                        />
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-2 h-16"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanning}
                        >
                            {isScanning ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span>Analizando con IA...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Camera className="h-5 w-5" />
                                    <span>Escanear Factura con IA</span>
                                </div>
                            )}
                        </Button>
                    </div>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                className="col-span-3"
                                value={newExpense.date ? format(newExpense.date, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value ? new Date(e.target.value) : new Date() })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">Concepto</Label>
                            <Input
                                id="description"
                                placeholder="Ej. Compra de Mercancia"
                                className="col-span-3"
                                value={newExpense.description || ''}
                                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">Monto</Label>
                            <Input
                                id="amount"
                                type="number"
                                placeholder="0.00"
                                className="col-span-3"
                                value={newExpense.amount || ''}
                                onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">Categoría</Label>
                            <Select
                                value={newExpense.category}
                                onValueChange={(val) => setNewExpense({ ...newExpense, category: val })}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="supplier" className="text-right">Proveedor</Label>
                            <div className="col-span-3">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !newExpense.supplier_name && "text-muted-foreground"
                                            )}
                                        >
                                            {newExpense.supplier_name
                                                ? newExpense.supplier_name
                                                : "Seleccionar o escribir nuevo"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput
                                                placeholder="Buscar proveedor..."
                                                onValueChange={(val) => {
                                                    // Optional: if we want real-time binding to external state, 
                                                    // but CommandInput is usually uncontrolled or local.
                                                    // We'll let Command handle filtering of children.
                                                }}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    <div className="p-2 text-sm text-center">
                                                        No encontrado. escriba para crear.
                                                    </div>
                                                </CommandEmpty>
                                                <CommandGroup heading="Proveedores Existentes">
                                                    {suppliers.map((supplier) => (
                                                        <CommandItem
                                                            key={supplier.id}
                                                            value={supplier.name}
                                                            onSelect={(currentValue) => {
                                                                setNewExpense({ ...newExpense, supplier_name: currentValue });
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    newExpense.supplier_name === supplier.name ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {supplier.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                                <CommandGroup heading="Acciones">
                                                    {/* Simple way to clear or set manual if not in list. 
                                                         Actually, Shadcn Command is tricky with custom text. 
                                                         Normally we just use an Input for free text + a list.
                                                         But effectively, the User wants to SEE the list.
                                                         Let's add a manual input option below the list or just use standard input + list?
                                                         NO, the user specifically asked for "List".
                                                         Let's just force selection from list OR typed into a separate "New" flow?
                                                         The requirement was "Create new" too.
                                                         
                                                         Compromise: Add a "Manual Entry" input inside the popover or 
                                                         Just stick to the previous Input + List but visually improved?
                                                         
                                                         Let's try: Input + Popover list below it (Autocomplete).
                                                     */}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        <div className="p-2 border-t">
                                            <Input
                                                placeholder="O escribir nombre nuevo..."
                                                value={newExpense.supplier_name}
                                                onChange={(e) => setNewExpense({ ...newExpense, supplier_name: e.target.value })}
                                                className="h-8"
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="invoice" className="text-right">No. Factura</Label>
                            <Input
                                id="invoice"
                                placeholder="NCF o Referencia"
                                className="col-span-3"
                                value={newExpense.invoice_number || ''}
                                onChange={(e) => setNewExpense({ ...newExpense, invoice_number: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddExpense} type="submit">Guardar Gasto</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Add Supplier */}
            <Dialog open={isAddSupplierOpen} onOpenChange={setIsAddSupplierOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
                        <DialogDescription>
                            Agrega un nuevo proveedor a tu directorio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-name" className="text-right">Nombre</Label>
                            <Input
                                id="sup-name"
                                placeholder="Ej. Distribuidora ABC"
                                className="col-span-3"
                                value={newSupplier.name || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-rnc" className="text-right">RNC</Label>
                            <Input
                                id="sup-rnc"
                                placeholder="000-00000-0"
                                className="col-span-3"
                                value={newSupplier.rnc || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, rnc: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sup-contact" className="text-right">Contacto</Label>
                            <Input
                                id="sup-contact"
                                placeholder="Teléfono o Email"
                                className="col-span-3"
                                value={newSupplier.contact || ''}
                                onChange={(e) => setNewSupplier({ ...newSupplier, contact: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAddSupplier} type="submit">Guardar Proveedor</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
