import type { Product } from "./models.js";

export const seedProducts = (): Product[] => [
  { id: 1, name: "Wireless Mouse", category: "Electronics", price: 2499, stock: 25 },
  { id: 2, name: "Mechanical Keyboard", category: "Electronics", price: 8999, stock: 10 },
  { id: 3, name: "USB-C Hub", category: "Electronics", price: 3999, stock: 15 },
  { id: 4, name: "Notebook (A5)", category: "Stationery", price: 599, stock: 100 },
  { id: 5, name: "Gel Pen Set", category: "Stationery", price: 899, stock: 60 },
  { id: 6, name: "Water Bottle", category: "Home", price: 1599, stock: 40 },
  { id: 7, name: "Desk Lamp", category: "Home", price: 2999, stock: 8 },
  { id: 8, name: "Backpack", category: "Accessories", price: 4999, stock: 12 },
  { id: 9, name: "Phone Stand", category: "Accessories", price: 1299, stock: 30 },
];