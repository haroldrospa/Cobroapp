import React from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types/pos';

interface CartItemComponentProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  calculateItemTotal: (item: CartItem) => number;
}

const CartItemComponent: React.FC<CartItemComponentProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
  calculateItemTotal
}) => {
  return (
    <div className="border border-border rounded-md p-3 md:p-2">
      <div className="flex justify-between items-center gap-3">
        {/* Nombre del producto - Izquierda */}
        <div className="flex-1 flex items-center">
          <h4 className="font-semibold text-lg md:text-base leading-tight">{item.name}</h4>
        </div>
        
        {/* Precio, botones y controles - Derecha */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Precio y botón eliminar */}
          <div className="flex items-center gap-2">
            <span className="text-base md:text-sm font-bold">
              ${calculateItemTotal(item).toFixed(2)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)} className="h-7 w-7 p-0">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          {/* Controles de cantidad */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 p-0">
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <Button variant="outline" size="sm" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItemComponent;
