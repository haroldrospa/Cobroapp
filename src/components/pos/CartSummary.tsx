import React from 'react';
import { ShoppingCart, ClipboardList, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types/pos';
import CartItemComponent from './CartItemComponent';
import { usePrintSettings } from '@/hooks/usePrintSettings';

interface CartSummaryProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveFromCart: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
  currentOrderInfo?: { orderNumber: string; customerName: string } | null;
  onClearOrder?: () => void;
}

const CartSummary: React.FC<CartSummaryProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  calculateItemTotal,
  currentOrderInfo,
  onClearOrder
}) => {
  const { companyInfo } = usePrintSettings();
  const companyLogo = companyInfo.logo || null;
  const logoCartSize = companyInfo.logoCartSize;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0 px-3 pt-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShoppingCart className="h-4 w-4" />
          <span className="truncate">Productos en el Carrito ({cart.length})</span>
        </CardTitle>
        {currentOrderInfo && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="flex items-center gap-1.5 text-xs">
              <ClipboardList className="h-3 w-3" />
              {currentOrderInfo.orderNumber} - {currentOrderInfo.customerName}
            </Badge>
            {onClearOrder && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5" 
                onClick={onClearOrder}
                title="Descartar pedido"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0 px-3 pb-2 overflow-hidden relative">
        {/* Logo de fondo - siempre visible */}
        {companyLogo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img 
              src={companyLogo} 
              alt="Logo" 
              className="w-auto object-contain opacity-10" 
              style={{
                height: `${logoCartSize}px`,
                maxWidth: '80%',
                filter: 'grayscale(100%) brightness(0.3)'
              }} 
            />
          </div>
        )}
        
        <div className="h-full overflow-y-auto space-y-2 relative z-10">
          {cart.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 flex flex-col items-center justify-center h-full">
              {!companyLogo && <ShoppingCart className="h-24 w-24 mx-auto mb-4 opacity-20" />}
            </div>
          ) : (
            cart.map(item => (
              <CartItemComponent 
                key={item.id} 
                item={item} 
                onUpdateQuantity={onUpdateQuantity} 
                onRemove={onRemoveFromCart} 
                calculateItemTotal={calculateItemTotal} 
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CartSummary;
