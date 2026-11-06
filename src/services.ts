import { CartLine, Coupon, Order, Product, ShopError } from "./models.js";

export const TAX_RATE = 0.18;

export const COUPONS: Coupon[] = [
  { code: "SAVE10", type: "percent", value: 10, minSubtotal: 0, description: "10% off your order" },
  { code: "WELCOME5", type: "fixed", value: 500, minSubtotal: 2500, description: "$5 off orders over $25" },
];

export class Catalog {
  private products = new Map<number, Product>();

  constructor(initial: Product[]) {
    initial.forEach((p) => this.products.set(p.id, p));
  }

  all(): Product[] {
    return [...this.products.values()];
  }

  get(id: number): Product | undefined {
    return this.products.get(id);
  }

  search(query: string): Product[] {
    const q = query.trim().toLowerCase();
    return this.all().filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }
}

export class Cart {
  private quantities = new Map<number, number>();

  constructor(private catalog: Catalog) {}

  add(productId: number, quantity: number): void {
    const product = this.catalog.get(productId);
    if (!product) throw new ShopError(`Product #${productId} does not exist.`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new ShopError("Quantity must be a positive whole number.");

    const newQty = (this.quantities.get(productId) ?? 0) + quantity;
    if (newQty > product.stock) {
      throw new ShopError(`Only ${product.stock} of "${product.name}" in stock.`);
    }
    this.quantities.set(productId, newQty);
  }

  remove(productId: number): void {
    if (!this.quantities.delete(productId)) throw new ShopError("That item is not in your cart.");
  }

  clear(): void {
    this.quantities.clear();
  }

  isEmpty(): boolean {
    return this.quantities.size === 0;
  }

  lines(): CartLine[] {
    const result: CartLine[] = [];
    for (const [id, quantity] of this.quantities) {
      const product = this.catalog.get(id);
      if (product) result.push({ product, quantity });
    }
    return result;
  }

  subtotal(): number {
    return this.lines().reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  }
}

export function findCoupon(code: string): Coupon | undefined {
  return COUPONS.find((c) => c.code === code.trim().toUpperCase());
}

export function calculateTotals(subtotal: number, coupon?: Coupon) {
  let discount = 0;
  if (coupon) {
    if (subtotal < coupon.minSubtotal) {
      throw new ShopError(`Coupon ${coupon.code} requires a subtotal of at least the minimum amount.`);
    }
    discount =
      coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
  }
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * TAX_RATE);
  return { subtotal, discount, tax, total: taxable + tax };
}

export class OrderService {
  private orders: Order[];
  private nextId: number;

  constructor(private catalog: Catalog, existingOrders: Order[] = []) {
    this.orders = [...existingOrders];
    this.nextId = Math.max(1000, ...existingOrders.map((o) => o.id)) + 1;
  }

  checkout(cart: Cart, coupon?: Coupon): Order {
    if (cart.isEmpty()) throw new ShopError("Your cart is empty.");

    const lines = cart.lines();
    // Re-validate stock before committing anything.
    for (const { product, quantity } of lines) {
      if (quantity > product.stock) {
        throw new ShopError(`"${product.name}" no longer has enough stock (${product.stock} left).`);
      }
    }

    const totals = calculateTotals(cart.subtotal(), coupon);

    lines.forEach(({ product, quantity }) => (product.stock -= quantity));

    const order: Order = {
      id: this.nextId++,
      items: lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        unitPrice: l.product.price,
        quantity: l.quantity,
      })),
      ...totals,
      couponCode: coupon?.code,
      createdAt: new Date(),
    };
    this.orders.push(order);
    cart.clear();
    return order;
  }

  history(): Order[] {
    return [...this.orders];
  }
}