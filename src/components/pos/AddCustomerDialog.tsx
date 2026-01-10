import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { Loader2 } from 'lucide-react';

interface AddCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customerId: string) => void;
}

const AddCustomerDialog: React.FC<AddCustomerDialogProps> = ({
  isOpen,
  onClose,
  onCustomerAdded,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    rnc: '',
    phone: '',
    email: '',
    address: '',
    customer_type: 'final' as 'final' | 'business'
  });

  const { toast } = useToast();
  const createCustomer = useCreateCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre del cliente es requerido.",
      });
      return;
    }

    createCustomer.mutate({
      ...formData,
      credit_limit: 0,
      credit_used: 0,
      total_purchases: 0
    }, {
      onSuccess: (data) => {
        toast({
          title: "Cliente creado exitosamente",
          description: `Cliente ${data.name} ha sido agregado.`,
        });
        onCustomerAdded(data.id);
        handleClose();
      },
      onError: (error) => {
        console.error('Error creating customer:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo crear el cliente. Inténtalo de nuevo.",
        });
      }
    });
  };

  const handleClose = () => {
    setFormData({
      name: '',
      rnc: '',
      phone: '',
      email: '',
      address: '',
      customer_type: 'final'
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-type">Tipo de Cliente</Label>
            <Select
              value={formData.customer_type}
              onValueChange={(value: 'final' | 'business') =>
                setFormData({ ...formData, customer_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="final">Cliente Final</SelectItem>
                <SelectItem value="business">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rnc">RNC/Cédula</Label>
            <Input
              id="rnc"
              value={formData.rnc}
              onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
              placeholder="RNC o cédula"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Número de teléfono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Correo electrónico"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Dirección del cliente"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={createCustomer.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {createCustomer.isPending ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;