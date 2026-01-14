
import React from 'react';
import { Eye, Edit, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { LoadingLogo } from '@/components/ui/loading-logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sale } from '@/hooks/useSalesManagement';

interface InvoiceTableProps {
  sales: Sale[];
  onViewDetails: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  isLoading?: boolean;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({
  sales,
  onViewDetails,
  onEditSale,
  onDeleteSale,
  isLoading = false,
}) => {
  const getStatusBadge = (sale: Sale) => {
    // Para pagos a crédito, mostrar el payment_status
    const status = sale.payment_method === 'credit' ? sale.payment_status : sale.status;

    switch (status) {
      case 'completed':
      case 'paid':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Pagada</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Vencida</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 h-64">
          <LoadingLogo text="Cargando facturas..." size="sm" />
        </CardContent>
      </Card>
    );
  }

  if (sales.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-lg text-muted-foreground">No se encontraron facturas</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas ({sales.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Facturado por</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.invoice_number}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{sale.customer?.name || 'Cliente General'}</div>
                    {sale.customer?.rnc && (
                      <div className="text-sm text-muted-foreground">RNC: {sale.customer.rnc}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {sale.profile?.full_name || 'Sistema'}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {sale.invoice_type?.code || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(sale.created_at)}</TableCell>
                <TableCell className="font-semibold">${sale.total.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={
                    sale.payment_method === 'cash' ? 'default' :
                      sale.payment_method === 'credit' ? 'secondary' : 'outline'
                  }>
                    {sale.payment_method === 'cash' ? 'Efectivo' :
                      sale.payment_method === 'credit' ? 'Crédito' :
                        sale.payment_method === 'card' ? 'Tarjeta' :
                          sale.payment_method}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(sale)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(sale)}
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditSale(sale)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteSale(sale.id)}
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default InvoiceTable;
