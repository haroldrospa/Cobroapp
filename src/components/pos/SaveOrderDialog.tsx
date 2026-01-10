import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/types/pos';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateTotals } from '@/utils/posCalculations';
import { useUserStore } from '@/hooks/useUserStore';

interface SaveOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onSaved: () => void;
  orderSource?: 'pos' | 'web';
  initialCustomerName?: string;
  initialNotes?: string;
  existingOrderId?: string | null;
  existingOrderNumber?: string | null;
}

const SaveOrderDialog: React.FC<SaveOrderDialogProps> = ({ 
  isOpen, 
  onClose, 
  cart, 
  onSaved, 
  orderSource = 'pos', 
  initialCustomerName = '',
  initialNotes = '',
  existingOrderId = null,
  existingOrderNumber = null
}) => {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [notes, setNotes] = useState(initialNotes);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userStore } = useUserStore();

  // Update values when initial values change
  React.useEffect(() => {
    setCustomerName(initialCustomerName);
  }, [initialCustomerName]);

  React.useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const saveOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const totals = calculateTotals(cart, { value: 0, type: 'percentage' });

      // If we have an existing order, update it
      if (existingOrderId) {
        // Update the order
        const { data: order, error: orderError } = await supabase
          .from('open_orders')
          .update({
            customer_name: customerName || 'Cliente',
            subtotal: parseFloat(totals.subtotal),
            discount_total: parseFloat(totals.discount),
            tax_total: parseFloat(totals.tax),
            total: parseFloat(totals.total),
            notes: notes || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrderId)
          .select()
          .single();

        if (orderError) throw orderError;

        // Delete existing items and insert new ones
        const { error: deleteError } = await supabase
          .from('open_order_items')
          .delete()
          .eq('order_id', existingOrderId);

        if (deleteError) throw deleteError;

        const orderItems = cart.map(item => {
          const taxRate = item.tax || 0.18;
          const subtotal = item.price * item.quantity;
          const taxAmount = subtotal * taxRate;
          const total = subtotal + taxAmount;
          
          return {
            order_id: existingOrderId,
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            tax_percentage: taxRate * 100,
            tax_amount: taxAmount,
            subtotal: subtotal,
            total: total
          };
        });

        const { error: itemsError } = await supabase
          .from('open_order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;

        return order;
      }

      // Create new order with store_id
      const { data: orderNumber, error: orderNumberError } = await supabase
        .rpc('generate_order_number', { order_source: orderSource });

      if (orderNumberError) throw orderNumberError;

      const { data: order, error: orderError } = await supabase
        .from('open_orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName || 'Cliente',
          payment_method: 'pending',
          subtotal: parseFloat(totals.subtotal),
          discount_total: parseFloat(totals.discount),
          tax_total: parseFloat(totals.tax),
          total: parseFloat(totals.total),
          notes: notes || null,
          source: orderSource,
          order_status: 'pending',
          payment_status: 'pending',
          profile_id: user?.id || null,
          store_id: userStore?.id || null
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        const taxRate = item.tax || 0.18;
        const subtotal = item.price * item.quantity;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;
        
        return {
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_percentage: taxRate * 100,
          tax_amount: taxAmount,
          subtotal: subtotal,
          total: total
        };
      });

      const { error: itemsError } = await supabase
        .from('open_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });
      toast({
        title: existingOrderId ? "Pedido actualizado" : "Pedido guardado",
        description: `Pedido ${order.order_number} ${existingOrderId ? 'actualizado' : 'guardado'} correctamente`
      });
      setCustomerName('');
      setNotes('');
      onSaved();
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el pedido"
      });
      console.error('Error saving order:', error);
    }
  });

  const handleSave = () => {
    if (cart.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El carrito está vacío"
      });
      return;
    }
    saveOrderMutation.mutate();
  };

  const isEditing = !!existingOrderId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isEditing ? 'Actualizar Pedido' : 'Guardar Pedido'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Actualizando pedido ${existingOrderNumber}` 
              : 'Guarda el pedido actual para cobrarlo después'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Nombre del cliente (opcional)</Label>
            <Input
              id="customerName"
              placeholder="Ej: Mesa 5, Juan Pérez"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Productos en el carrito</div>
            <div className="font-semibold">{cart.length} productos</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveOrderMutation.isPending || cart.length === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isEditing ? 'Actualizar' : 'Guardar'} Pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveOrderDialog;