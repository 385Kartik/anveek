import fs from "node:fs";
import path from "node:path";

const META_DIR = path.resolve(process.cwd(), "data");
const META_FILE = path.join(META_DIR, "order-meta.json");

function ensureDir() {
  if (!fs.existsSync(META_DIR)) {
    try {
      fs.mkdirSync(META_DIR, { recursive: true });
    } catch (e) {
      console.error("[order-meta] Error creating data directory:", e);
    }
  }
}

export interface OrderMeta {
  lang: "gu" | "en";
  editCount: number;
  lastEditedAt?: string | null;
  unitPrice: number;      // Locked rate per 15KG tin at order placement time
  totalPrice?: number;    // Total locked amount for this order
  productName?: string;   // Product name at order placement time
}

function readMeta(): Record<string, Partial<OrderMeta>> {
  try {
    if (fs.existsSync(META_FILE)) {
      const content = fs.readFileSync(META_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("[order-meta] Read error:", e);
  }
  return {};
}

function writeMeta(data: Record<string, Partial<OrderMeta>>) {
  try {
    ensureDir();
    fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[order-meta] Write error:", e);
  }
}

export function saveOrderCreationMeta(
  orderId: string,
  options: {
    lang: "gu" | "en";
    unitPrice: number;
    quantity: number;
    productName?: string;
  }
) {
  if (!orderId) return;
  const meta = readMeta();
  const existing = meta[orderId] || {};
  const unitPrice = options.unitPrice > 0 ? options.unitPrice : 3500;
  meta[orderId] = {
    ...existing,
    lang: options.lang === "en" ? "en" : "gu",
    editCount: existing.editCount ?? 0,
    unitPrice,
    totalPrice: options.quantity * unitPrice,
    productName: options.productName,
  };
  writeMeta(meta);
}

export function saveOrderLang(orderId: string, lang: "gu" | "en") {
  if (!orderId) return;
  const meta = readMeta();
  const existing = meta[orderId] || {};
  meta[orderId] = {
    ...existing,
    lang: lang === "en" ? "en" : "gu",
    editCount: existing.editCount ?? 0,
    unitPrice: existing.unitPrice && existing.unitPrice > 0 ? existing.unitPrice : 3500,
  };
  writeMeta(meta);
}

export function recordOrderEdit(
  orderId: string,
  options: {
    lang: "gu" | "en";
    quantity: number;
    unitPrice?: number;
  }
): { editCount: number; lastEditedAt: string; unitPrice: number; totalPrice: number } {
  const now = new Date().toISOString();
  const meta = readMeta();
  const existing = meta[orderId] || {};
  const newCount = (existing.editCount || 0) + 1;

  // Preserve previously locked unit price of this specific order unless explicitly changed
  const unitPrice =
    options.unitPrice && options.unitPrice > 0
      ? options.unitPrice
      : (existing.unitPrice && existing.unitPrice > 0 ? existing.unitPrice : 3500);
  const totalPrice = options.quantity * unitPrice;

  meta[orderId] = {
    ...existing,
    lang: options.lang === "en" ? "en" : "gu",
    editCount: newCount,
    lastEditedAt: now,
    unitPrice,
    totalPrice,
  };
  writeMeta(meta);
  return { editCount: newCount, lastEditedAt: now, unitPrice, totalPrice };
}

export function getOrderMeta(orderId: string, name?: string, address?: string): OrderMeta {
  if (orderId) {
    const meta = readMeta();
    if (meta[orderId]) {
      const entry = meta[orderId];
      // All past orders placed before dynamic pricing default strictly to 3500
      const unitPrice = typeof entry.unitPrice === "number" && entry.unitPrice > 0 ? entry.unitPrice : 3500;
      return {
        lang: entry.lang === "en" ? "en" : "gu",
        editCount: entry.editCount || 0,
        lastEditedAt: entry.lastEditedAt || null,
        unitPrice,
        totalPrice: typeof entry.totalPrice === "number" && entry.totalPrice > 0 ? entry.totalPrice : undefined,
        productName: entry.productName,
      };
    }
  }
  // Fallback for orders not yet in metadata: always default to historical rate of 3500
  return { lang: "gu", editCount: 0, lastEditedAt: null, unitPrice: 3500 };
}

export function getOrderLang(orderId: string, name?: string, address?: string): "gu" | "en" {
  return getOrderMeta(orderId, name, address).lang;
}
