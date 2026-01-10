
import { CartItem, GlobalDiscount } from '@/types/pos';

export const calculateItemTotal = (item: CartItem): number => {
  return item.price * item.quantity;
};

export const calculateTotals = (cart: CartItem[], globalDiscount?: GlobalDiscount) => {
  // Calcular subtotal: si el costo incluye impuesto, usar precio sin impuesto
  const subtotal = cart.reduce((sum, item) => {
    const itemSubtotal = item.cost_includes_tax 
      ? (item.price * item.quantity) / 1.18  // Precio sin ITBIS
      : item.price * item.quantity;          // Precio normal
    return sum + itemSubtotal;
  }, 0);

  // Calcular descuento global
  let discountTotal = 0;
  if (globalDiscount && globalDiscount.value > 0) {
    if (globalDiscount.type === 'percentage') {
      discountTotal = subtotal * (globalDiscount.value / 100);
    } else {
      discountTotal = globalDiscount.value;
    }
  }

  const taxableAmount = subtotal - discountTotal;
  
  // Calcular el ITBIS
  const taxTotal = cart.reduce((sum, item) => {
    if (item.cost_includes_tax) {
      const itemSubtotal = (item.price * item.quantity) / 1.18;
      // Aplicar proporción del descuento a este item
      const itemProportion = itemSubtotal / subtotal;
      const itemDiscount = discountTotal * itemProportion;
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const taxAmount = itemAfterDiscount * 0.18;
      return sum + taxAmount;
    }
    return sum;
  }, 0);
  
  // El total es subtotal - descuento + ITBIS
  const total = taxableAmount + taxTotal;

  return {
    subtotal: subtotal.toFixed(2),
    discount: discountTotal.toFixed(2),
    tax: taxTotal.toFixed(2),
    total: total.toFixed(2)
  };
};
