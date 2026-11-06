/** All money values are stored as integer cents to avoid floating-point errors. */

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number; // cents
  stock: number;
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface Coupon {
  code: string;
  type: "percent" | "fixed";
  value: number; // percent (0-100) or cents
  minSubtotal: number; // cents
  description: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: number;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  couponCode?: string;
  createdAt: Date;
}

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopError";
  }
}