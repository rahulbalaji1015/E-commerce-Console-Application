import { promises as fs } from "node:fs";
import path from "node:path";
import { Order, Product, ShopError } from "./models.js";

export interface StoreData {
  products: Product[];
  orders: Order[];
}

/** Persists shop data to a JSON file using async file APIs. */
export class FileStorage {
  constructor(private filePath: string = path.join(process.cwd(), "data", "store.json")) {}

  /** Returns saved data, or null if no save file exists yet. */
  async load(): Promise<StoreData | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; // first run
      throw new ShopError(`Could not read ${this.filePath}: ${(err as Error).message}`);
    }

    try {
      const data = JSON.parse(raw) as StoreData;
      // JSON turns Dates into strings, so convert them back.
      data.orders = data.orders.map((o) => ({ ...o, createdAt: new Date(o.createdAt) }));
      return data;
    } catch {
      throw new ShopError(`Save file ${this.filePath} is corrupted. Delete it to start fresh.`);
    }
  }

  /** Writes to a temp file first, then renames, so a crash never leaves a half-written save. */
  async save(data: StoreData): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = this.filePath + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tmp, this.filePath);
    } catch (err) {
      throw new ShopError(`Could not save data: ${(err as Error).message}`);
    }
  }
}