import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Mail, Printer, DollarSign, Calendar, User, FileText } from 'lucide-react';
import { useSales } from '@/hooks/useSalesManagement';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useInvoiceActions } from '@/hooks/useInvoiceActions';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { SaleData, CompanyInfo } from '@/utils/invoicePdfGenerator';
import { useEmployees } from '@/hooks/useEmployees';
import { useCashMovements } from '@/hooks/useCashMovements';
import { useActiveSession } from '@/hooks/useCashSession';

interface DailySalesDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const DailySalesDialog: React.FC<DailySalesDialogProps> = ({ isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('all');
    const { data: sales = [], isLoading } = useSales();
    const { data: employees = [] } = useEmployees();
    const { toast } = useToast();
    const { handleDownloadPDF, handleSendEmail, isEmailLoading } = useInvoiceActions();
    const { companyInfo: dbCompanyInfo } = usePrintSettings();
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

    const { data: activeSession } = useActiveSession();

    // Filter sales for current session or today
    const sessionSales = useMemo(() => {
        if (activeSession) {
            const startTime = new Date(activeSession.opened_at);
            return sales.filter(sale => {
                const saleDate = new Date(sale.created_at);
                return saleDate >= startTime;
            });
        }

        // Fallback to "Today" if no session active
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return sales.filter(sale => {
            const saleDate = new Date(sale.created_at);
            saleDate.setHours(0, 0, 0, 0);
            return saleDate.getTime() === today.getTime();
        });
    }, [sales, activeSession]);

    // Apply filters
    const filteredSales = useMemo(() => {
        return sessionSales.filter(sale => {
            const matchesSearch = searchTerm === '' ||
                sale.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());

            // Check against both user_id (old schema compatible) and profile_id (new schema)
            const saleUserId = sale.profile_id || sale.user_id;
            const matchesUser = userFilter === 'all' || saleUserId === userFilter;

            // Optional: Filter by payment method?

            return matchesSearch && matchesUser;
        });
    }, [sessionSales, searchTerm, userFilter]);

    const { data: movements = [] } = useCashMovements();

    // Filter movements for session or today
    const sessionMovements = useMemo(() => {
        if (activeSession) {
            const startTime = new Date(activeSession.opened_at);
            return movements.filter(m => {
                const mDate = new Date(m.created_at);
                return mDate >= startTime;
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return movements.filter(m => {
            const mDate = new Date(m.created_at);
            mDate.setHours(0, 0, 0, 0);
            return mDate.getTime() === today.getTime();
        });
    }, [movements, activeSession]);

    // Calculate totals
    const totals = useMemo(() => {
        const salesTotal = filteredSales.reduce((acc, sale) => acc + (sale.total || 0), 0);
        const salesCount = filteredSales.length;

        const deposits = sessionMovements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + Number(m.amount), 0);
        const withdrawals = sessionMovements.filter(m => m.type === 'withdrawal').reduce((acc, m) => acc + Number(m.amount), 0);

        // Include initial cash in "Net Balance" if active session
        const initialCash = activeSession?.initial_cash || 0;

        return {
            salesTotal,
            salesCount,
            deposits,
            withdrawals,
            initialCash,
            netTotal: initialCash + salesTotal + deposits - withdrawals
        };
    }, [filteredSales, sessionMovements, activeSession]);

    // Get unique users
    const users = useMemo(() => {
        const uniqueUsers = new Map();
        sessionSales.forEach(sale => {
            const userId = sale.profile_id || sale.user_id;
            if (userId && !uniqueUsers.has(userId)) {
                uniqueUsers.set(userId, userId);
            }
        });
        return Array.from(uniqueUsers.values());
    }, [sessionSales]);

    const handlePrint = (sale: any) => {
        handleDownloadPDF(dbCompanyInfo as CompanyInfo, sale as SaleData, sale.invoice_number);
    };

    const handleEmail = async (sale: any) => {
        const email = prompt("Ingrese el correo electrónico del cliente:", sale.customer?.email || "");

        if (email) {
            setSendingEmailId(sale.id);
            await handleSendEmail(
                dbCompanyInfo as CompanyInfo,
                sale as SaleData,
                sale.invoice_number,
                email,
                () => setSendingEmailId(null)
            );
            setSendingEmailId(null);
        }
    };

    const handleDownload = (sale: any) => {
        handleDownloadPDF(dbCompanyInfo as CompanyInfo, sale as SaleData, sale.invoice_number);
    };

    const handleExportAll = () => {
        toast({
            title: "Exportando ventas",
            description: `Exportando ${filteredSales.length} ventas`,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {activeSession ? 'Ventas de la Sesión Actual' : `Ventas del Día - ${format(new Date(), "d 'de' MMMM", { locale: es })}`}
                    </DialogTitle>
                    <DialogDescription>
                        {activeSession
                            ? `Sesión iniciada el ${format(new Date(activeSession.opened_at), "dd/MM hh:mm a")}`
                            : 'Historial completo de ventas realizadas hoy'}
                    </DialogDescription>
                </DialogHeader>

                {/* Filters and Stats */}
                <div className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-primary/10 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <FileText className="h-4 w-4" />
                                Total Facturas
                            </div>
                            <div className="text-2xl font-bold">{totals.salesCount}</div>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <DollarSign className="h-4 w-4" />
                                Total Vendido
                            </div>
                            <div className="text-2xl font-bold text-green-600">
                                RD$ {totals.salesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </div>
                        </div>

                        {/* New Card for Net Balance (Cash in Drawer) */}
                        <div className="bg-blue-500/10 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <DollarSign className="h-4 w-4" />
                                En Caja (Balance Total)
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                                RD$ {totals.netTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                                <span>Ini: {totals.initialCash.toLocaleString()}</span>
                                <span className="text-green-600">+{totals.deposits.toLocaleString()}</span>
                                <span className="text-red-600">-{totals.withdrawals.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por NCF o cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Filtrar por usuario" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los usuarios</SelectItem>
                                {users.map(userId => {
                                    const employee = employees.find(e => e.id === userId);
                                    return (
                                        <SelectItem key={userId} value={userId}>
                                            {employee?.full_name || `Usuario ${userId.slice(0, 8)}`}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleExportAll} variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="flex-1 overflow-auto border rounded-lg">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground">Cargando ventas...</p>
                        </div>
                    ) : filteredSales.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-muted-foreground">No se encontraron ventas en este periodo</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>NCF</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Atendido por</TableHead>
                                    <TableHead>Método de Pago</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSales.map((sale) => (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(sale.created_at), 'HH:mm:ss')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{sale.invoice_number}</Badge>
                                        </TableCell>
                                        <TableCell>{sale.customer?.name || 'Cliente General'}</TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">
                                                {sale.profile?.full_name || 'Sistema'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={sale.payment_method === 'cash' ? 'default' : 'secondary'}>
                                                {sale.total < 0 ? 'Reembolso' : (sale.payment_method === 'cash' ? 'Efectivo' :
                                                    sale.payment_method === 'card' ? 'Tarjeta' :
                                                        sale.payment_method === 'transfer' ? 'Transferencia' :
                                                            sale.payment_method === 'credit' ? 'Crédito' : sale.payment_method)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${sale.total < 0 ? 'text-destructive' : ''}`}>
                                            RD$ {(sale.total || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handlePrint(sale)}
                                                    title="Imprimir"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEmail(sale)}
                                                    title="Enviar por correo"
                                                >
                                                    <Mail className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDownload(sale)}
                                                    title="Descargar PDF"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        Mostrando {filteredSales.length} de {sessionSales.length} ventas
                    </p>
                    <Button onClick={onClose} variant="outline">
                        Cerrar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DailySalesDialog;
