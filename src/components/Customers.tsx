
import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Search, Edit, CreditCard, Phone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useAllCustomersBalances } from '@/hooks/useCustomerBalance';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EditCustomerDialog from '@/components/customers/EditCustomerDialog';
import CustomerCreditDialog from '@/components/customers/CustomerCreditDialog';
import AddCustomerDialog from '@/components/pos/AddCustomerDialog';

const Customers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useCustomers();
  const { data: creditData } = useAllCustomersBalances();
  const balances = creditData?.balances || {};
  const overdueSet = creditData?.overdueCustomers || new Set();

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.rnc && customer.rnc.includes(searchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customers, searchTerm]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;

    // Calculate totals only for the customers currently available in the list
    // This ensures consistency between the list view and the summary cards.
    let totalCredit = 0;
    let totalOverdue = 0;

    customers.forEach(c => {
      const debt = balances[c.id] || 0;
      totalCredit += debt;
      if (overdueSet.has(c.id)) {
        totalOverdue++;
      }
    });

    return { totalCustomers, totalCredit, totalOverdue };
  }, [customers, balances, overdueSet]);

  // Real-time updates subscription
  useEffect(() => {
    const channel = supabase
      .channel('customers-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['allCustomersBalances'] });
          // Invalidate customers too as they might have aggregated fields
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditDialogOpen(true);
  };

  const handleCredit = (customer: Customer) => {
    setCreditCustomer(customer);
    setCreditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
          <p className="text-muted-foreground">Administra tu cartera de clientes</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">{stats.totalCustomers}</p>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">${stats.totalCredit.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Crédito Utilizado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{stats.totalOverdue}</p>
              <p className="text-sm text-muted-foreground">Clientes con Mora</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes por nombre, RNC o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      <div className="grid gap-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {searchTerm ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => {
            const creditLimit = customer.credit_limit || 0;
            // Use real-time balance if available, otherwise 0.
            const creditUsed = balances[customer.id] || 0;
            const creditPercentage = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

            return (
              <Card key={customer.id}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{customer.name}</h3>
                          {creditPercentage >= 80 && (
                            <Badge variant="destructive">Crédito Alto</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>RNC:</strong> {customer.rnc || 'N/A'}</p>
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone || 'N/A'}
                            </p>
                            <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
                          </div>
                          <div>
                            <p><strong>Dirección:</strong> {customer.address || 'N/A'}</p>
                            <p><strong>Última compra:</strong> {customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Total compras:</strong> ${(customer.total_purchases || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Barra de crédito */}
                        {creditLimit > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Crédito utilizado:</span>
                              <span>${creditUsed.toLocaleString()} / ${creditLimit.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${creditPercentage >= 80
                                  ? 'bg-red-500'
                                  : creditPercentage >= 60
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                  }`}
                                style={{ width: `${Math.min(creditPercentage, 100)}%` }}
                              />
                            </div>
                            {customer.credit_due_date && (
                              <p className="text-xs text-muted-foreground">
                                <strong>Vencimiento de crédito:</strong> {new Date(customer.credit_due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCredit(customer)}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Crédito
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <EditCustomerDialog
        customer={editingCustomer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      <CustomerCreditDialog
        customer={creditCustomer}
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
      />

      <AddCustomerDialog
        isOpen={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onCustomerAdded={() => { }}
      />
    </div>
  );
};

export default Customers;
