export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  tax: number;
  cost_includes_tax?: boolean;
}

export interface GlobalDiscount {
  value: number;
  type: 'percentage' | 'amount';
}

export interface InvoiceType {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  barcode: string;
  category: string;
}

export interface Customer {
  id: string;
  name: string;
  rnc: string;
  type: string;
}
