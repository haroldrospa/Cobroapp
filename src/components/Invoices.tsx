
import React, { useState } from 'react';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSales, useDeleteSale, Sale, SalesFilters } from '@/hooks/useSalesManagement';
import { useCustomers } from '@/hooks/useCustomers';
import { useEmployees } from '@/hooks/useEmployees';
import InvoiceSearch from './invoices/InvoiceSearch';
import InvoiceTable from './invoices/InvoiceTable';
import InvoiceDetailsDialog from './invoices/InvoiceDetailsDialog';
import EditInvoiceDialog from './invoices/EditInvoiceDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Invoices: React.FC = () => {
  const [filters, setFilters] = useState<SalesFilters>({
    searchTerm: '',
    status: 'all',
    paymentMethod: 'all',
    customerId: 'all',
    userId: 'all',
    invoiceTypeId: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    minAmount: undefined,
    maxAmount: undefined,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

  const { data: sales = [], isLoading, refetch } = useSales(filters);
  const { data: customers = [] } = useCustomers();
  const { data: employees = [] } = useEmployees();
  const deleteSale = useDeleteSale();
  const { toast } = useToast();

  const handleViewDetails = (sale: Sale) => {
    console.log('Viewing details for sale:', sale);
    setSelectedSale(sale);
    setShowDetailsDialog(true);
  };

  const handleEditSale = (sale: Sale) => {
    console.log('Editing sale:', sale);
    setSelectedSale(sale);
    setShowEditDialog(true);
  };

  const handleDeleteSale = (saleId: string) => {
    console.log('Deleting sale ID:', saleId);
    setSaleToDelete(saleId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;

    try {
      await deleteSale.mutateAsync(saleToDelete);
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada correctamente.",
      });
      setShowDeleteDialog(false);
      setSaleToDelete(null);
    } catch (error) {
      console.error('Error eliminando factura:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la factura.",
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Actualizado",
      description: "La lista de facturas se ha actualizado.",
    });
  };

  const handleClearFilters = () => {
    setFilters({
      searchTerm: '',
      status: 'all',
      paymentMethod: 'all',
      customerId: 'all',
      userId: 'all',
      invoiceTypeId: 'all',
      dateFrom: undefined,
      dateTo: undefined,
      minAmount: undefined,
      maxAmount: undefined,
    });
  };

  // Estadísticas filtradas - Para facturas a crédito usar payment_status, para otras usar status
  const completedSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'completed' || status === 'paid';
  });
  const pendingSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'pending';
  });
  const cancelledSales = sales.filter(s => {
    const status = s.payment_method === 'credit' ? s.payment_status : s.status;
    return status === 'cancelled';
  });
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total, 0);



  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestión de Facturas</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => window.location.href = '/pos'}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <InvoiceSearch
        searchTerm={filters.searchTerm || ''}
        onSearchChange={(value) => setFilters(prev => ({ ...prev, searchTerm: value }))}
        statusFilter={filters.status || 'all'}
        onStatusChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        paymentMethodFilter={filters.paymentMethod || 'all'}
        onPaymentMethodChange={(value) => setFilters(prev => ({ ...prev, paymentMethod: value }))}
        customerFilter={filters.customerId || 'all'}
        onCustomerChange={(value) => setFilters(prev => ({ ...prev, customerId: value }))}
        userIdFilter={filters.userId || 'all'}
        onUserIdChange={(value) => setFilters(prev => ({ ...prev, userId: value }))}
        invoiceTypeFilter={filters.invoiceTypeId || 'all'}
        onInvoiceTypeChange={(value) => setFilters(prev => ({ ...prev, invoiceTypeId: value }))}
        dateFrom={filters.dateFrom}
        onDateFromChange={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
        dateTo={filters.dateTo}
        onDateToChange={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
        minAmount={filters.minAmount?.toString() || ''}
        onMinAmountChange={(value) => setFilters(prev => ({ ...prev, minAmount: value ? parseFloat(value) : undefined }))}
        maxAmount={filters.maxAmount?.toString() || ''}
        onMaxAmountChange={(value) => setFilters(prev => ({ ...prev, maxAmount: value ? parseFloat(value) : undefined }))}
        onClearFilters={handleClearFilters}
        customers={customers}
        employees={employees}
      />

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">Total Facturas</div>
          <div className="text-2xl font-bold">{sales.length}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">Pagadas</div>
          <div className="text-2xl font-bold text-green-600">
            {completedSales.length}
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">Pendientes</div>
          <div className="text-2xl font-bold text-yellow-600">
            {pendingSales.length}
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">Canceladas</div>
          <div className="text-2xl font-bold text-red-600">
            {cancelledSales.length}
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border">
          <div className="text-sm text-muted-foreground">Total Vendido</div>
          <div className="text-2xl font-bold text-blue-600">
            ${totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tabla de facturas */}
      <InvoiceTable
        sales={sales}
        onViewDetails={handleViewDetails}
        onEditSale={handleEditSale}
        onDeleteSale={handleDeleteSale}
        isLoading={isLoading}
      />

      {/* Diálogos */}
      {selectedSale && showDetailsDialog && (
        <InvoiceDetailsDialog
          isOpen={showDetailsDialog}
          onClose={() => {
            console.log('Closing details dialog');
            setShowDetailsDialog(false);
            setSelectedSale(null);
          }}
          saleId={selectedSale.id}
        />
      )}

      {selectedSale && showEditDialog && (
        <EditInvoiceDialog
          isOpen={showEditDialog}
          onClose={() => {
            console.log('Closing edit dialog');
            setShowEditDialog(false);
            setSelectedSale(null);
          }}
          sale={selectedSale}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La factura y todos sus items serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Invoices;
