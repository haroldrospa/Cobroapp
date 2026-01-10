import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CartItem, GlobalDiscount } from '@/types/pos';
import { calculateItemTotal, calculateTotals } from '@/utils/posCalculations';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoiceTypes } from '@/hooks/useInvoiceTypes';
import { useCreateSale } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Maximize, Minimize, Menu, Home, Package, Users, FileText, BarChart, Settings as SettingsIcon, Store, LogOut, Save, ClipboardList, Receipt, RefreshCcw, HandCoins, Lock } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import CartSummary from './pos/CartSummary';
import PaymentSummary from './pos/PaymentSummary';
import PaymentDialog from './pos/PaymentDialog';
import PrintOptionsDialog from './pos/PrintOptionsDialog';
import ProductSearchList from './pos/ProductSearchList';
import WebSalesDialog from './pos/WebSalesDialog';
import OpenAccountsDialog from './pos/OpenAccountsDialog';
import SaveOrderDialog from './pos/SaveOrderDialog';
import DailySalesDialog from './pos/DailySalesDialog';
import RefundDialog from './pos/RefundDialog';
import CashMovementsDialog from './pos/CashMovementsDialog';
import CloseDayDialog from './pos/CloseDayDialog';
import OpenRegisterDialog from './pos/OpenRegisterDialog';
import { useActiveSession } from '@/hooks/useCashSession';
import { useUserProfile } from '@/hooks/useUserProfile';

import { useUserStore } from '@/hooks/useUserStore';
import { useWebOrderNotifications } from '@/hooks/useWebOrderNotifications';
import { useWebOrdersCount } from '@/hooks/useWebOrdersCount';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useSavedCart, useAutoSaveCart } from '@/hooks/useSavedCart';
import { useIsMobile } from '@/hooks/use-mobile';
import MobilePOSLayout from './pos/MobilePOSLayout';
import MobileProductSearch from './pos/MobileProductSearch';
import MobileCartView from './pos/MobileCartView';
import MobilePaymentView from './pos/MobilePaymentView';

const POS: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedInvoiceType, setSelectedInvoiceType] = useState('B02');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPrintOptionsDialog, setShowPrintOptionsDialog] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [creditDays, setCreditDays] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscount>({ value: 0, type: 'percentage' });
  const [showWebSalesDialog, setShowWebSalesDialog] = useState(false);
  const [showOpenAccountsDialog, setShowOpenAccountsDialog] = useState(false);
  const [showSaveOrderDialog, setShowSaveOrderDialog] = useState(false);
  const [currentWebOrderId, setCurrentWebOrderId] = useState<string | null>(null);
  const [currentOrderInfo, setCurrentOrderInfo] = useState<{ orderNumber: string; customerName: string; notes?: string } | null>(null);
  const [currentOrderSource, setCurrentOrderSource] = useState<'pos' | 'web'>('pos');
  const [showDailySalesDialog, setShowDailySalesDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showCashMovementsDialog, setShowCashMovementsDialog] = useState(false);
  const [showCloseDayDialog, setShowCloseDayDialog] = useState(false);

  const { data: activeSession, isLoading: isLoadingSession } = useActiveSession();
  const { profile } = useUserProfile();

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: customers = [] } = useCustomers();
  const { data: invoiceTypes = [] } = useInvoiceTypes();
  const createSale = useCreateSale();
  const { toast } = useToast();
  const { data: store } = useUserStore();
  const { settings: storeSettings } = useStoreSettings();

  // Notificaciones y conteo de pedidos web
  useWebOrderNotifications({
    storeId: store?.id,
    enabled: !!store?.id,
    soundEnabled: storeSettings?.web_order_sound_enabled ?? true,
    soundType: (storeSettings?.web_order_sound_type as any) ?? 'chime',
    soundVolume: storeSettings?.web_order_sound_volume ?? 0.7
  });
  const { data: webOrdersCount = 0 } = useWebOrdersCount();

  const { savedCart, isLoading: isLoadingSavedCart } = useSavedCart();
  useAutoSaveCart(cart);

  // Load saved cart on mount
  useEffect(() => {
    if (!cartLoaded && savedCart && savedCart.length > 0) {
      setCart(savedCart);
      setCartLoaded(true);
      toast({
        title: "Carrito restaurado",
        description: `Se cargaron ${savedCart.length} productos del carrito guardado.`,
      });
    } else if (!isLoadingSavedCart && !cartLoaded) {
      setCartLoaded(true);
    }
  }, [savedCart, cartLoaded, isLoadingSavedCart, toast]);

  // Set default invoice type
  useEffect(() => {
    if (invoiceTypes.length > 0 && !selectedInvoiceType) {
      const b02 = invoiceTypes.find(t => t.code === 'B02');
      if (b02) {
        setSelectedInvoiceType(b02.id);
      }
    }
  }, [invoiceTypes, selectedInvoiceType]);

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => item.id === product.id ? {
        ...item,
        quantity: item.quantity + 1
      } : item));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        tax: 0.18,
        cost_includes_tax: product.cost_includes_tax || false
      }]);
    }
    setSearchTerm('');
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(cart.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowPaymentDialog(true);
  };

  const queryClient = useQueryClient();

  const processPayment = async () => {
    // Recalculate totals to ensure freshness
    const currentTotals = calculateTotals(cart, globalDiscount);
    const baseTotal = parseFloat(currentTotals.total);

    // Calculate surcharge logic
    const cardMethod = storeSettings?.payment_methods?.find(m => m.id === 'card');
    const surchargePercentage = (paymentMethod === 'card' && cardMethod?.enabled) ? (cardMethod.surcharge_percentage || 0) : 0;
    const surchargeAmount = surchargePercentage > 0 ? (baseTotal * surchargePercentage / 100) : 0;
    const finalTotal = baseTotal + surchargeAmount;

    const received = parseFloat(amountReceived) || 0;
    const change = received - finalTotal;

    let dueDate = null;
    let paymentStatus = 'paid';
    if (paymentMethod === 'credit') {
      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + creditDays);
      dueDate = dueDateObj.toISOString();
      paymentStatus = 'pending';
    }

    try {
      // Prepare items including surcharge
      const saleItems = [...cart];
      if (surchargeAmount > 0) {
        saleItems.push({
          id: 'surcharge-card',
          name: `Recargo Tarjeta (${surchargePercentage}%)`,
          price: surchargeAmount,
          quantity: 1,
          tax: 0,
          cost_includes_tax: false
        } as CartItem);
      }

      const saleResult = await createSale.mutateAsync({
        customer_id: selectedCustomer || undefined,
        invoice_type_id: selectedInvoiceType,
        subtotal: parseFloat(currentTotals.subtotal) + surchargeAmount,
        discount_total: parseFloat(currentTotals.discount),
        tax_total: parseFloat(currentTotals.tax),
        total: finalTotal,
        payment_method: paymentMethod,
        amount_received: paymentMethod === 'cash' ? received : finalTotal,
        change_amount: paymentMethod === 'cash' ? change >= 0 ? change : 0 : 0,
        payment_status: paymentStatus,
        due_date: dueDate,
        items: saleItems
      });

      // If this was a web order, mark it as completed/delete it to remove from list
      if (currentWebOrderId) {
        // First delete items to ensure no FK issues (if cascade isn't set)
        const { error: itemsError } = await supabase
          .from('open_order_items')
          .delete()
          .eq('order_id', currentWebOrderId);

        if (itemsError) {
          console.error("Error deleting web order items", itemsError);
        }

        // Then delete the order itself
        const { error: deleteError } = await supabase
          .from('open_orders')
          .delete()
          .eq('id', currentWebOrderId)
          .eq('store_id', store.id);

        if (deleteError) {
          console.error("Error deleting web order", deleteError);
          // If delete fails, try to update status as fallback, though it likely failed before. 
          // We'll just warn the user.
          toast({
            variant: "destructive",
            title: "Advertencia",
            description: "La venta se procesó pero hubo un error eliminando el pedido web de la lista."
          });
        } else {
          // Success - Remove from cache INSTANTLY for better UX
          const storeId = store?.id;
          if (storeId) {
            // Update lists
            queryClient.setQueryData(['web-orders', storeId], (oldData: any[]) => {
              if (!oldData) return [];
              return oldData.filter(order => String(order.id) !== String(currentWebOrderId));
            });
            queryClient.setQueryData(['pos-open-orders', storeId], (oldData: any[]) => {
              if (!oldData) return [];
              return oldData.filter(order => String(order.id) !== String(currentWebOrderId));
            });

            // Update COUNTER instantly (red badge)
            queryClient.setQueryData(['web-orders-count', storeId], (oldCount: number | undefined) => {
              return Math.max(0, (oldCount || 0) - 1);
            });
          }

          // Invalidate to ensure sync with server
          queryClient.invalidateQueries({ queryKey: ['web-orders'] });
          queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
          queryClient.invalidateQueries({ queryKey: ['web-orders-count'] });
        }

        // Always clear local state
        setCurrentWebOrderId(null);
        setCurrentOrderInfo(null);
      }

      const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
      const selectedInvoiceTypeData = invoiceTypes.find(t => t.id === selectedInvoiceType);

      setSaleData({
        ...saleResult,
        items: saleItems.map(item => ({
          ...item,
          total: calculateItemTotal(item)
        })),
        customer: selectedCustomerData,
        invoiceType: selectedInvoiceTypeData?.code || selectedInvoiceTypeData?.name || 'B01',
        totals: {
          ...currentTotals,
          total: finalTotal.toFixed(2)
        },
        change: paymentMethod === 'cash' ? change : 0,
        paymentMethod
      });

      // Reset state
      setCart([]);
      setSelectedCustomer('');
      setAmountReceived('');
      setPaymentMethod('cash');
      setGlobalDiscount({ value: 0, type: 'percentage' });
      setShowPaymentDialog(false);
      setShowPrintOptionsDialog(true);
      setCurrentOrderInfo(null);

    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al procesar la venta. Inténtalo de nuevo.",
      });
    }
  };

  const handleLoadWebOrder = (items: CartItem[], orderId?: string, customerName?: string, orderNumber?: string, source?: 'pos' | 'web', notes?: string) => {
    // If items is an array of CartItem, use directly
    if (Array.isArray(items) && items.length > 0) {
      setCart(items);
      if (orderId) {
        setCurrentWebOrderId(orderId);
      }
      if (orderNumber && customerName) {
        setCurrentOrderInfo({ orderNumber, customerName, notes });
      }
      setCurrentOrderSource(source || 'pos');

      toast({
        title: "Pedido cargado",
        description: `${orderNumber || 'Pedido'} - ${customerName || 'Cliente'} (${items.length} productos)`,
      });
      return;
    }

    // Legacy support: if items is actually an order object
    const order = items as any;
    const cartItems: CartItem[] = order.items?.map((item: any) => ({
      id: item.product_id || item.id,
      name: item.product_name || item.name,
      price: item.unit_price || item.price,
      quantity: item.quantity,
      tax: item.tax_percentage || 0.18,
      cost_includes_tax: false
    })) || [];

    setCart(cartItems);
    setCurrentWebOrderId(order.id);
    if (order.order_number && order.customer_name) {
      setCurrentOrderInfo({ orderNumber: order.order_number, customerName: order.customer_name, notes: order.notes });
    }
    setCurrentOrderSource(order.source || 'pos');

    // Set customer if available
    if (order.customer_id) {
      setSelectedCustomer(order.customer_id);
    }

    toast({
      title: "Pedido cargado",
      description: `${order.order_number || 'Pedido'} - ${order.customer_name || 'Cliente'}`,
    });
  };

  // Save existing order directly without dialog
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const saveExistingOrderDirectly = async () => {
    if (!currentWebOrderId || cart.length === 0) return;

    setIsSavingOrder(true);
    try {
      const totals = calculateTotals(cart, globalDiscount);

      // Update the order
      const { error: orderError } = await supabase
        .from('open_orders')
        .update({
          customer_name: currentOrderInfo?.customerName || 'Cliente',
          subtotal: parseFloat(totals.subtotal),
          discount_total: parseFloat(totals.discount),
          tax_total: parseFloat(totals.tax),
          total: parseFloat(totals.total),
          notes: currentOrderInfo?.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentWebOrderId);

      if (orderError) throw orderError;

      // Delete existing items and insert new ones
      const { error: deleteError } = await supabase
        .from('open_order_items')
        .delete()
        .eq('order_id', currentWebOrderId);

      if (deleteError) throw deleteError;

      const orderItems = cart.map(item => {
        const taxRate = item.tax || 0.18;
        const subtotal = item.price * item.quantity;
        const taxAmount = subtotal * taxRate;
        const total = subtotal + taxAmount;

        return {
          order_id: currentWebOrderId,
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

      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['web-orders'] });

      toast({
        title: "Pedido actualizado",
        description: `${currentOrderInfo?.orderNumber} guardado correctamente`
      });

      // Reset state
      setCart([]);
      setGlobalDiscount({ value: 0, type: 'percentage' });
      setCurrentOrderInfo(null);
      setCurrentOrderSource('pos');
      setCurrentWebOrderId(null);
    } catch (error) {
      console.error('Error saving order:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el pedido"
      });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSaveOrder = () => {
    if (cart.length === 0) return;

    // If editing an existing order, save directly
    if (currentWebOrderId) {
      saveExistingOrderDirectly();
    } else {
      // New order - show dialog
      setShowSaveOrderDialog(true);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F8: Cuentas
      if (e.key === 'F8') {
        e.preventDefault();
        setShowOpenAccountsDialog(true);
      }
      // F9: Guardar Venta
      if (e.key === 'F9') {
        e.preventDefault();
        handleSaveOrder();
      }
      // F10: Procesar Venta
      if (e.key === 'F10') {
        e.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, currentWebOrderId]); // Dependencies for handlers

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const totals = calculateTotals(cart, globalDiscount);
  const baseTotal = parseFloat(totals.total);

  // Calculate surcharge if paying with card
  const cardMethod = storeSettings?.payment_methods?.find(m => m.id === 'card');
  const surchargePercentage = (paymentMethod === 'card' && cardMethod?.enabled) ? (cardMethod.surcharge_percentage || 0) : 0;
  const surchargeAmount = surchargePercentage > 0 ? (baseTotal * surchargePercentage / 100) : 0;
  const total = baseTotal + surchargeAmount;

  const received = parseFloat(amountReceived) || 0;
  const change = received - total;

  const navigationItems = React.useMemo(() => {
    if (profile?.role === 'staff' || profile?.role === 'cashier') {
      return [
        { name: 'Clientes', href: '/customers', icon: Users },
      ];
    }

    return [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Productos', href: '/products', icon: Package },
      { name: 'Clientes', href: '/customers', icon: Users },
      { name: 'Facturas', href: '/invoices', icon: FileText },
      { name: 'Reportes', href: '/reports', icon: BarChart },
      { name: 'Empleados', href: '/employees', icon: Users },
      { name: 'Configuración', href: '/settings', icon: SettingsIcon }
    ];
  }, [profile]);

  if (loadingProducts) {
    return (
      <div className="flex items-center justify-center h-64 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl font-medium animate-pulse text-primary">Cargando catálogo de productos...</div>
          <p className="text-sm text-muted-foreground">Preparando tu punto de venta</p>
        </div>
      </div>
    );
  }

  // Create totals object for the dialog that includes the surcharge
  const dialogTotals = {
    ...totals,
    total: total.toFixed(2)
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Limpiar todo el caché de React Query
    navigate('/auth');
  };

  const menuButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id="pos-menu-btn" variant="outline" size="icon" className="h-12 w-12 shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 bg-popover shadow-lg">
        <div className="px-2 py-1.5 text-sm font-semibold">Navegación</div>
        <DropdownMenuSeparator />
        {navigationItems.map(item => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.href} onClick={() => navigate(item.href)} className="cursor-pointer">
              <Icon className="h-4 w-4 mr-2" />
              {item.name}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowDailySalesDialog(true)} className="cursor-pointer">
          <Receipt className="h-4 w-4 mr-2" />
          Ventas del Día
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowRefundDialog(true)} className="cursor-pointer">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Devoluciones / Reembolsos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowCashMovementsDialog(true)} className="cursor-pointer">
          <HandCoins className="h-4 w-4 mr-2" />
          Movimientos de Caja (E/S)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowCloseDayDialog(true)} className="cursor-pointer">
          <Lock className="h-4 w-4 mr-2" />
          Cierre de Caja (Finalizar Día)
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const actionButtons = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleSaveOrder}
        className="h-12 gap-2"
        disabled={cart.length === 0 || isSavingOrder}
      >
        <Save className="h-5 w-5" />
        <span className="hidden sm:inline">{currentWebOrderId ? 'Actualizar' : 'Guardar'}</span>
        {!isMobile && <span className="hidden lg:inline text-[10px] opacity-70 font-normal border border-current rounded px-1">F9</span>}
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowOpenAccountsDialog(true)}
        className="h-12 gap-2"
      >
        <ClipboardList className="h-5 w-5" />
        <span className="hidden sm:inline">Cuentas</span>
        {!isMobile && <span className="hidden lg:inline text-[10px] opacity-70 font-normal border border-current rounded px-1">F8</span>}
      </Button>
      <Button
        variant="default"
        onClick={() => setShowWebSalesDialog(true)}
        className="h-12 gap-2 relative"
      >
        <Store className="h-5 w-5" />
        <span className="hidden sm:inline">Web</span>
        {webOrdersCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {webOrdersCount > 9 ? '9+' : webOrdersCount}
          </span>
        )}
      </Button>
    </div>
  );

  const fullscreenButton = (
    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 hidden md:flex">
      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
    </Button>
  );

  // Mobile Layout with bottom tab navigation
  if (isMobile) {
    return (
      <div className="h-screen w-screen flex flex-col animate-fade-in overflow-hidden">
        <MobilePOSLayout
          productSearchComponent={
            <MobileProductSearch
              products={products}
              onAddToCart={addToCart}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              menuButton={menuButton}
              actionButton={actionButtons}
              gridCols={storeSettings?.pos_layout_grid_cols || 2}
            />
          }
          cart={cart}
          cartComponent={
            <MobileCartView
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              calculateItemTotal={calculateItemTotal}
              currentOrderInfo={currentOrderInfo}
              onClearOrder={() => {
                setCurrentWebOrderId(null);
                setCurrentOrderInfo(null);
                setCart([]);
              }}
            />
          }
          paymentComponent={
            <MobilePaymentView
              totals={totals}
              selectedCustomer={selectedCustomer}
              selectedInvoiceType={selectedInvoiceType}
              cartLength={cart.length}
              customers={customers}
              invoiceTypes={invoiceTypes}
              globalDiscount={globalDiscount}
              onCustomerChange={setSelectedCustomer}
              onInvoiceTypeChange={setSelectedInvoiceType}
              onDiscountChange={setGlobalDiscount}
              onCheckout={handleCheckout}
            />
          }
          cartTotal={totals.total}
          onCheckout={handleCheckout}
        />

        {/* Dialogs - shared between mobile and desktop */}
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          totals={dialogTotals}
          paymentMethod={paymentMethod}
          amountReceived={amountReceived}
          change={change}
          received={received}
          total={total}
          surchargeAmount={surchargeAmount}
          selectedCustomer={selectedCustomer}
          creditDays={creditDays}
          onPaymentMethodChange={setPaymentMethod}
          onAmountReceivedChange={setAmountReceived}
          onCreditDaysChange={setCreditDays}
          onProcessPayment={processPayment}
          isProcessing={createSale.isPending}
          availableMethods={storeSettings?.payment_methods}
        />

        {saleData && (
          <PrintOptionsDialog
            isOpen={showPrintOptionsDialog}
            onClose={() => setShowPrintOptionsDialog(false)}
            saleData={saleData}
          />
        )}

        <WebSalesDialog
          isOpen={showWebSalesDialog}
          onClose={() => setShowWebSalesDialog(false)}
          onLoadToCart={handleLoadWebOrder}
          currentLoadedOrderId={currentWebOrderId}
        />

        <OpenAccountsDialog
          isOpen={showOpenAccountsDialog}
          onClose={() => setShowOpenAccountsDialog(false)}
          onLoadToCart={handleLoadWebOrder}
          currentLoadedOrderId={currentWebOrderId}
        />

        <SaveOrderDialog
          isOpen={showSaveOrderDialog}
          onClose={() => setShowSaveOrderDialog(false)}
          cart={cart}
          orderSource={currentOrderSource}
          initialCustomerName={currentOrderInfo?.customerName || ''}
          initialNotes={currentOrderInfo?.notes || ''}
          existingOrderId={currentWebOrderId}
          existingOrderNumber={currentOrderInfo?.orderNumber}
          onSaved={() => {
            setCart([]);
            setGlobalDiscount({ value: 0, type: 'percentage' });
            setCurrentOrderInfo(null);
            setCurrentOrderSource('pos');
            setCurrentWebOrderId(null);
          }}
        />

        <DailySalesDialog
          isOpen={showDailySalesDialog}
          onClose={() => setShowDailySalesDialog(false)}
        />
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="h-screen w-screen flex flex-col animate-fade-in overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-4 min-h-0 overflow-hidden">
        {/* Panel principal - Búsqueda y carrito */}
        <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-hidden">
          <Card className="flex-shrink-0">
            <CardContent className="pt-4 px-4 md:px-6 pb-4">
              <div id="pos-products-area">
                <ProductSearchList
                  products={products}
                  onAddToCart={addToCart}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  menuButton={menuButton}
                  actionButton={actionButtons}
                />
              </div>
            </CardContent>
          </Card>

          <div id="pos-cart-area" className="flex-1 min-h-0 overflow-hidden">
            <CartSummary
              cart={cart}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              calculateItemTotal={calculateItemTotal}
              currentOrderInfo={currentOrderInfo}
              onClearOrder={() => {
                setCurrentWebOrderId(null);
                setCurrentOrderInfo(null);
                setCart([]);
              }}
            />
          </div>
        </div>

        {/* Panel de resumen */}
        <div id="pos-payment-area" className="w-full lg:w-72 flex-shrink-0 min-h-0 overflow-hidden">
          <PaymentSummary
            totals={totals}
            selectedCustomer={selectedCustomer}
            selectedInvoiceType={selectedInvoiceType}
            cartLength={cart.length}
            customers={customers}
            invoiceTypes={invoiceTypes}
            globalDiscount={globalDiscount}
            onCustomerChange={setSelectedCustomer}
            onInvoiceTypeChange={setSelectedInvoiceType}
            onDiscountChange={setGlobalDiscount}
            onCheckout={handleCheckout}
            fullscreenButton={fullscreenButton}
          />
        </div>
      </div>

      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        totals={dialogTotals}
        paymentMethod={paymentMethod}
        amountReceived={amountReceived}
        change={change}
        received={received}
        total={total}
        surchargeAmount={surchargeAmount}
        selectedCustomer={selectedCustomer}
        creditDays={creditDays}
        onPaymentMethodChange={setPaymentMethod}
        onAmountReceivedChange={setAmountReceived}
        onCreditDaysChange={setCreditDays}
        onProcessPayment={processPayment}
        isProcessing={createSale.isPending}
        availableMethods={storeSettings?.payment_methods}
      />

      {saleData && (
        <PrintOptionsDialog
          isOpen={showPrintOptionsDialog}
          onClose={() => setShowPrintOptionsDialog(false)}
          saleData={saleData}
        />
      )}

      <WebSalesDialog
        isOpen={showWebSalesDialog}
        onClose={() => setShowWebSalesDialog(false)}
        onLoadToCart={handleLoadWebOrder}
      />

      <OpenAccountsDialog
        isOpen={showOpenAccountsDialog}
        onClose={() => setShowOpenAccountsDialog(false)}
        onLoadToCart={handleLoadWebOrder}
      />

      <SaveOrderDialog
        isOpen={showSaveOrderDialog}
        onClose={() => setShowSaveOrderDialog(false)}
        cart={cart}
        orderSource={currentOrderSource}
        initialCustomerName={currentOrderInfo?.customerName || ''}
        initialNotes={currentOrderInfo?.notes || ''}
        existingOrderId={currentWebOrderId}
        existingOrderNumber={currentOrderInfo?.orderNumber}
        onSaved={() => {
          setCart([]);
          setGlobalDiscount({ value: 0, type: 'percentage' });
          setCurrentOrderInfo(null);
          setCurrentOrderSource('pos');
          setCurrentWebOrderId(null);
        }}
      />

      <DailySalesDialog
        isOpen={showDailySalesDialog}
        onClose={() => setShowDailySalesDialog(false)}
      />

      <RefundDialog
        isOpen={showRefundDialog}
        onClose={() => setShowRefundDialog(false)}
      />

      <CashMovementsDialog
        isOpen={showCashMovementsDialog}
        onClose={() => setShowCashMovementsDialog(false)}
      />

      <CloseDayDialog
        isOpen={showCloseDayDialog}
        onClose={() => setShowCloseDayDialog(false)}
      />

      <OpenRegisterDialog
        isOpen={!activeSession && !isLoadingSession}
      />
    </div>

  );
};

export default POS;
