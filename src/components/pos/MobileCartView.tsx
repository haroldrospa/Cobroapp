import React from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Package, ClipboardList, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CartItem } from '@/types/pos';
import { usePrintSettings } from '@/hooks/usePrintSettings';
import { cn } from '@/lib/utils';

interface MobileCartViewProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveFromCart: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
  currentOrderInfo?: { orderNumber: string; customerName: string } | null;
  onClearOrder?: () => void;
}

const MobileCartView: React.FC<MobileCartViewProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveFromCart,
  calculateItemTotal,
  currentOrderInfo,
  onClearOrder,
}) => {
  const { companyInfo } = usePrintSettings();
  const companyLogo = companyInfo.logo || null;
  const logoCartSize = companyInfo.logoCartSize;

  if (cart.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 relative">
        {/* Background logo */}
        {companyLogo ? (
          <img 
            src={companyLogo} 
            alt="Logo" 
            className="absolute inset-0 m-auto w-auto object-contain opacity-10"
            style={{
              height: `${logoCartSize}px`,
              maxWidth: '80%',
              filter: 'grayscale(100%) brightness(0.3)'
            }} 
          />
        ) : (
          <ShoppingCart className="h-24 w-24 text-muted-foreground/20 mb-4" />
        )}
        <p className="text-muted-foreground text-lg relative z-10">Carrito vacío</p>
        <p className="text-muted-foreground/60 text-sm mt-1 relative z-10">
          Agrega productos desde la pestaña Productos
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Background logo */}
      {companyLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img 
            src={companyLogo} 
            alt="Logo" 
            className="w-auto object-contain opacity-5"
            style={{
              height: `${logoCartSize}px`,
              maxWidth: '80%',
              filter: 'grayscale(100%) brightness(0.3)'
            }} 
          />
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <h2 className="font-semibold">Productos en el Carrito</h2>
          <span className="text-muted-foreground">({cart.length})</span>
        </div>
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
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 min-h-0 relative z-10">
        <div className="p-3 space-y-3">
          {cart.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Product placeholder */}
                  <div className="w-16 h-16 bg-muted flex-shrink-0 flex items-center justify-center rounded-l-lg">
                    <Package className="h-6 w-6 text-muted-foreground/50" />
                  </div>

                  {/* Product details */}
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 -mt-1 -mr-1 text-destructive hover:text-destructive"
                        onClick={() => onRemoveFromCart(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <p className="font-bold text-base">
                          ${calculateItemTotal(item).toFixed(2)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground">
                            ${item.price.toFixed(2)} c/u
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MobileCartView;
