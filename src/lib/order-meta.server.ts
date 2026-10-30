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

export function saveOrderLang(orderId: string, lang: "gu" | "en") {
  if (!orderId) return;
  const meta = readMeta();
  const existing = meta[orderId] || {};
  meta[orderId] = {
    ...existing,
    lang: lang === "en" ? "en" : "gu",
    editCount: existing.editCount ?? 0,
  };
  writeMeta(meta);
}

export function recordOrderEdit(orderId: string, lang: "gu" | "en"): { editCount: number; lastEditedAt: string } {
  const now = new Date().toISOString();
  if (!orderId) return { editCount: 1, lastEditedAt: now };
  const meta = readMeta();
  const existing = meta[orderId] || {};
  const newCount = (existing.editCount || 0) + 1;
  meta[orderId] = {
    ...existing,
    lang: lang === "en" ? "en" : "gu",
    editCount: newCount,
    lastEditedAt: now,
  };
  writeMeta(meta);
  return { editCount: newCount, lastEditedAt: now };
}

export function getOrderMeta(orderId: string, name?: string, address?: string): OrderMeta {
  if (orderId) {
    const meta = readMeta();
    if (meta[orderId]) {
      return {
        lang: meta[orderId].lang === "en" ? "en" : "gu",
        editCount: meta[orderId].editCount || 0,
        lastEditedAt: meta[orderId].lastEditedAt || null,
      };
    }
  }
  // Fallback: If text has Gujarati script characters (\u0A80-\u0AFF), it is Gujarati
  const text = `${name || ""} ${address || ""}`;
  const lang: "gu" | "en" = /[\u0A80-\u0AFF]/.test(text) ? "gu" : "gu";
  return { lang, editCount: 0, lastEditedAt: null };
}

export function getOrderLang(orderId: string, name?: string, address?: string): "gu" | "en" {
  return getOrderMeta(orderId, name, address).lang;
}
