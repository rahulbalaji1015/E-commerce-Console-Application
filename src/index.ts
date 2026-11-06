import * as readline from "node:readline/promises";
import { stdin as input, stdout as output, exit } from "node:process";
import { Coupon, Order, Product, ShopError } from "./models.js";
import { Cart, Catalog, OrderService, calculateTotals, findCoupon, COUPONS } from "./services.js";
import { seedProducts } from "./data.js";
import { FileStorage } from "./storage.js";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const storage = new FileStorage();
let catalog!: Catalog;
let cart!: Cart;
let orders!: OrderService;
let activeCoupon: Coupon | undefined;

function printProducts(products: Product[]): void {
  if (products.length === 0) return console.log("  No products found.");
  console.log(`\n  ${"ID".padEnd(4)}${"Name".padEnd(24)}${"Category".padEnd(14)}${"Price".padStart(9)}${"Stock".padStart(7)}`);
  console.log("  " + "-".repeat(58));
  for (const p of products) {
    console.log(
      `  ${String(p.id).padEnd(4)}${p.name.padEnd(24)}${p.category.padEnd(14)}${money(p.price).padStart(9)}${String(p.stock).padStart(7)}`
    );
  }
}

function printCart(): void {
  if (cart.isEmpty()) return console.log("\n  Your cart is empty.");
  console.log(`\n  ${"ID".padEnd(4)}${"Item".padEnd(24)}${"Qty".padStart(4)}${"Line total".padStart(13)}`);
  console.log("  " + "-".repeat(45));
  for (const { product, quantity } of cart.lines()) {
    console.log(
      `  ${String(product.id).padEnd(4)}${product.name.padEnd(24)}${String(quantity).padStart(4)}${money(product.price * quantity).padStart(13)}`
    );
  }
  let totals;
  try {
    totals = calculateTotals(cart.subtotal(), activeCoupon);
  } catch {
    // Coupon no longer valid for the current subtotal.
    console.log(`  (Coupon ${activeCoupon?.code} removed: minimum not met)`);
    activeCoupon = undefined;
    totals = calculateTotals(cart.subtotal());
  }
  printTotals(totals, activeCoupon?.code);
}

function printTotals(t: { subtotal: number; discount: number; tax: number; total: number }, code?: string): void {
  console.log("  " + "-".repeat(45));
  console.log(`  ${"Subtotal".padEnd(32)}${money(t.subtotal).padStart(13)}`);
  if (t.discount > 0) console.log(`  ${`Discount (${code})`.padEnd(32)}${("-" + money(t.discount)).padStart(13)}`);
  console.log(`  ${"Tax (8%)".padEnd(32)}${money(t.tax).padStart(13)}`);
  console.log(`  ${"TOTAL".padEnd(32)}${money(t.total).padStart(13)}`);
}

function printOrder(o: Order): void {
  console.log(`\n  Order #${o.id} — ${o.createdAt.toLocaleString()}`);
  for (const i of o.items) {
    console.log(`    ${i.quantity} x ${i.name.padEnd(22)} ${money(i.unitPrice * i.quantity).padStart(10)}`);
  }
  printTotals(o, o.couponCode);
}

const MENU = `
=== TS Shop ===
 1) Browse products
 2) Search products
 3) Add item to cart
 4) View cart
 5) Remove item from cart
 6) Apply coupon
 7) Checkout
 8) Order history
 0) Exit`;

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const ask = async (q: string) => (await rl.question(q)).trim();
  const askInt = async (q: string) => {
    const raw = await ask(q);
    const n = Number(raw);
    if (!raw || !Number.isInteger(n)) throw new ShopError("Please enter a whole number.");
    return n;
  };

  try {
    const saved = await storage.load();
    catalog = new Catalog(saved?.products ?? seedProducts());
    orders = new OrderService(catalog, saved?.orders ?? []);
    console.log(saved ? "Welcome back! Saved data loaded." : "Welcome to TS Shop!");
  } catch (err) {
    if (!(err instanceof ShopError)) throw err;
    console.log(`  ⚠ ${err.message}\n  Starting with fresh data.`);
    catalog = new Catalog(seedProducts());
    orders = new OrderService(catalog);
  }
  cart = new Cart(catalog);

  let running = true;
  while (running) {
    console.log(MENU);
    let choice: string;
    try {
      choice = await ask("> ");
    } catch {
      break; // input stream closed
    }

    try {
      switch (choice) {
        case "1":
          printProducts(catalog.all());
          break;
        case "2": {
          const q = await ask("Search term: ");
          printProducts(catalog.search(q));
          break;
        }
        case "3": {
          printProducts(catalog.all());
          const id = await askInt("\nProduct ID: ");
          const qty = await askInt("Quantity: ");
          cart.add(id, qty);
          console.log(`  Added to cart.`);
          break;
        }
        case "4":
          printCart();
          break;
        case "5": {
          printCart();
          if (!cart.isEmpty()) {
            cart.remove(await askInt("\nProduct ID to remove: "));
            console.log("  Removed.");
          }
          break;
        }
        case "6": {
          console.log("\n  Available coupons:");
          COUPONS.forEach((c) => console.log(`    ${c.code.padEnd(10)} ${c.description}`));
          const code = await ask("\nCoupon code: ");
          const coupon = findCoupon(code);
          if (!coupon) throw new ShopError("Invalid coupon code.");
          calculateTotals(cart.subtotal(), coupon); // validates minimum
          activeCoupon = coupon;
          console.log(`  Coupon ${coupon.code} applied.`);
          break;
        }
        case "7": {
          printCart();
          if (cart.isEmpty()) break;
          const confirm = (await ask("\nPlace order? (y/n): ")).toLowerCase();
          if (confirm === "y") {
            const order = orders.checkout(cart, activeCoupon);
            activeCoupon = undefined;
            console.log("\n  Order placed! Thank you.");
            printOrder(order);
            await storage.save({ products: catalog.all(), orders: orders.history() });
          } else {
            console.log("  Checkout cancelled.");
          }
          break;
        }
        case "8": {
          const history = orders.history();
          if (history.length === 0) console.log("\n  No orders yet.");
          history.forEach(printOrder);
          break;
        }
        case "0":
          running = false;
          console.log("Goodbye!");
          break;
        default:
          console.log("  Invalid option, try again.");
      }
    } catch (err) {
      if (err instanceof ShopError) console.log(`  ⚠ ${err.message}`);
      else throw err;
    }
  }
  rl.close();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  exit(1);
});