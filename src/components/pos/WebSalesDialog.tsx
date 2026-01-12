import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Store, ShoppingCart, Check, Trash2, Calendar, User, Package, Phone, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/types/pos';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { useUserStore } from '@/hooks/useUserStore';

interface WebSalesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadToCart?: (items: CartItem[], orderId: string, customerName: string, orderNumber: string, source: 'pos' | 'web', notes?: string) => void;
  currentLoadedOrderId?: string | null;
}

const WebSalesDialog: React.FC<WebSalesDialogProps> = ({ isOpen, onClose, onLoadToCart, currentLoadedOrderId }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: userStore } = useUserStore();

  const { data: orders = [], isLoading, isFetching } = useQuery({
    queryKey: ['web-orders', userStore?.id],
    queryFn: async () => {
      if (!userStore?.id) return [];

      const { data, error } = await supabase
        .from('open_orders')
        .select(`
          *,
          open_order_items(
            id,
            quantity,
            unit_price,
            total,
            product_name,
            product_id,
            tax_percentage,
            tax_amount,
            subtotal
          )
        `)
        .eq('store_id', userStore.id)
        .eq('source', 'web')
        .eq('order_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);  // Reduced from 50 to 20 for faster loading

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!userStore?.id,
    staleTime: 10000,           // Consider data fresh for 10 seconds
    gcTime: 5 * 60 * 1000,      // Keep in cache for 5 minutes  
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: true,        // Always fetch on mount for latest data
  });

  // Filter out the currently loaded order
  const filteredOrders = orders.filter((order: any) => String(order.id) !== String(currentLoadedOrderId));

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error: itemsError } = await supabase
        .from('open_order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from('open_orders')
        .delete()
        .eq('id', orderId);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      toast({
        title: "Pedido eliminado",
        description: "El pedido ha sido eliminado correctamente"
      });
      setOrderToDelete(null);
      setSelectedOrderId(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el pedido"
      });
      console.error('Error deleting order:', error);
    }
  });

  const handleLoadToCart = (order?: any) => {
    const orderToLoad = order || filteredOrders.find((o: any) => o.id === selectedOrderId);

    if (!orderToLoad) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selecciona un pedido para cargar"
      });
      return;
    }

    const cartItems: CartItem[] = orderToLoad.open_order_items.map((item: any) => ({
      id: item.product_id,
      name: item.product_name,
      price: item.unit_price,
      quantity: item.quantity,
      tax: (item.tax_percentage || 18) / 100,
      cost_includes_tax: false
    }));

    if (onLoadToCart) {
      onLoadToCart(cartItems, orderToLoad.id, orderToLoad.customer_name, orderToLoad.order_number, 'web', orderToLoad.notes);
    }

    toast({
      title: "Pedido cargado",
      description: `${cartItems.length} productos agregados al carrito`
    });

    setSelectedOrderId(null);
    onClose();
  };

  const handleRowDoubleClick = (order: any) => {
    handleLoadToCart(order);
  };

  const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setOrderToDelete(orderId);
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pendiente</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Procesando</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedOrder = filteredOrders.find((o: any) => o.id === selectedOrderId);

  const renderMobileCard = (order: any) => (
    <Card
      key={order.id}
      className={`cursor-pointer transition-all ${selectedOrderId === order.id
        ? 'ring-2 ring-primary bg-primary/5'
        : 'hover:bg-muted/50'
        } ${order.order_status === 'completed' ? 'opacity-60' : ''}`}
      onClick={() => setSelectedOrderId(order.id)}
      onDoubleClick={() => handleRowDoubleClick(order)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {selectedOrderId === order.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
            <span className="font-semibold text-primary">{order.order_number}</span>
            {getOrderStatusBadge(order.order_status)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => handleDeleteClick(e, order.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 flex-shrink-0" />
            <span className="truncate font-medium text-foreground">{order.customer_name}</span>
          </div>

          {order.customer_phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>{order.customer_phone}</span>
            </div>
          )}

          {order.customer_address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{order.customer_address}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{order.open_order_items?.length || 0} productos</span>
            </div>
            <span className="text-lg font-bold">${order.total?.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          </div>
        </div>

        {order.notes && (
          <div className="mt-3 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            📝 {order.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDesktopTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrders.map((order: any) => (
          <TableRow
            key={order.id}
            className={`cursor-pointer transition-colors ${selectedOrderId === order.id
              ? 'bg-primary/10 hover:bg-primary/15'
              : 'hover:bg-muted/50'
              } ${order.order_status === 'completed' ? 'opacity-60' : ''}`}
            onClick={() => setSelectedOrderId(order.id)}
            onDoubleClick={() => handleRowDoubleClick(order)}
          >
            <TableCell>
              {selectedOrderId === order.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </TableCell>
            <TableCell className="font-medium">{order.order_number}</TableCell>
            <TableCell>
              {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
            </TableCell>
            <TableCell>
              <div className="font-medium">{order.customer_name}</div>
              {order.customer_phone && (
                <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
              )}
              {order.customer_address && (
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{order.customer_address}</div>
              )}
            </TableCell>
            <TableCell>
              {order.open_order_items?.length || 0} productos
            </TableCell>
            <TableCell>{getOrderStatusBadge(order.order_status)}</TableCell>
            <TableCell className="text-right font-semibold">
              ${order.total?.toFixed(2)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => handleDeleteClick(e, order.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className={`${isMobile ? 'max-w-[95vw] h-[90vh]' : 'max-w-4xl h-[85vh]'} flex flex-col overflow-hidden`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Pedidos Web
            </DialogTitle>
            <DialogDescription className={isMobile ? 'text-xs' : ''}>
              {isMobile ? 'Toca para seleccionar, doble toque para cargar' : 'Selecciona un pedido para facturarlo (doble click para cargar rápido)'}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando pedidos...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mb-4" />
              <p>No hay pedidos web registrados</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="flex-1 min-h-0">
                {isMobile ? (
                  <div className="space-y-3 pr-4 pb-2">
                    {filteredOrders.map((order: any) => renderMobileCard(order))}
                  </div>
                ) : (
                  renderDesktopTable()
                )}
              </ScrollArea>

              <div className={`flex gap-2 pt-4 border-t mt-4 ${isMobile ? 'flex-col' : 'justify-end'}`}>
                {isMobile ? (
                  <>
                    <Button
                      onClick={() => handleLoadToCart()}
                      disabled={!selectedOrder}
                      className="gap-2 w-full"
                      size="lg"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Cargar al POS
                    </Button>
                    <Button variant="outline" onClick={onClose} className="w-full">
                      Cerrar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onClose}>
                      Cerrar
                    </Button>
                    <Button
                      onClick={() => handleLoadToCart()}
                      disabled={!selectedOrder}
                      className="gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Cargar al POS
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pedido será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => orderToDelete && deleteOrderMutation.mutate(orderToDelete)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WebSalesDialog;