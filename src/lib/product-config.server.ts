import fs from "node:fs";
import path from "node:path";

export interface ProductConfig {
  nameGu: string;
  nameEn: string;
  tagGu: string;
  tagEn: string;
  subGu: string;
  subEn: string;
  price: number;
  photoUrl: string;
  updatedAt: string;
}

export const DEFAULT_PRODUCT_CONFIG: ProductConfig = {
  nameGu: "સીંગતેલ",
  nameEn: "Groundnut Oil",
  tagGu: "ઘાણીનું સીંગતેલ",
  tagEn: "Unrefined",
  subGu: "ગામડાની મગફળીમાંથી, સીધું તમારા રસોડે",
  subEn: "From village peanuts, straight to your kitchen",
  price: 3500,
  photoUrl: "",
  updatedAt: new Date().toISOString(),
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "product-config.json");

let cachedConfig: ProductConfig | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.error("[product-config] Error creating data directory:", e);
    }
  }
}

export function getProductConfig(): ProductConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    ensureDataDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(content);
      cachedConfig = {
        ...DEFAULT_PRODUCT_CONFIG,
        ...parsed,
        price: Number(parsed.price) > 0 ? Number(parsed.price) : DEFAULT_PRODUCT_CONFIG.price,
      };
      return cachedConfig as ProductConfig;
    }
  } catch (err) {
    console.error("[product-config] Error reading config file:", err);
  }

  cachedConfig = { ...DEFAULT_PRODUCT_CONFIG };
  return cachedConfig;
}

export function saveProductConfig(updates: Partial<ProductConfig>): ProductConfig {
  ensureDataDir();
  const current = getProductConfig();
  const next: ProductConfig = {
    ...current,
    ...updates,
    price: updates.price && Number(updates.price) > 0 ? Number(updates.price) : current.price,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), "utf-8");
    cachedConfig = next;
    console.log("[product-config] Updated successfully:", next);
  } catch (err) {
    console.error("[product-config] Error writing config file:", err);
    throw new Error("Failed to save product config to disk");
  }

  return next;
}

const SUPPORTED_MIME_EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function saveUploadedProductImage(fileBase64: string, mimeType?: string): string {
  ensureDataDir();

  let cleanBase64 = fileBase64;
  let detectedMime = mimeType || "image/jpeg";

  // Check if string contains data URI prefix
  const match = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    detectedMime = match[1] || detectedMime;
    cleanBase64 = match[2];
  }

  const ext = SUPPORTED_MIME_EXT_MAP[detectedMime] || "jpg";
  const buffer = Buffer.from(cleanBase64, "base64");

  // Remove previous image files from data dir
  const exts = ["jpg", "jpeg", "png", "webp", "gif"];
  for (const x of exts) {
    const oldPath = path.join(DATA_DIR, `product-photo.${x}`);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (e) {
        console.warn("[product-config] Could not remove old image:", e);
      }
    }
  }

  // Save new file
  const destPath = path.join(DATA_DIR, `product-photo.${ext}`);
  fs.writeFileSync(destPath, buffer);
  console.log(`[product-config] Saved new product image to ${destPath} (${buffer.length} bytes)`);

  // Optionally copy to public/uploads/ and .output/public/uploads/ if available
  const publicUploads = path.resolve(process.cwd(), "public/uploads");
  const outputUploads = path.resolve(process.cwd(), ".output/public/uploads");
  for (const dir of [publicUploads, outputUploads]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, `product-photo.${ext}`), buffer);
    } catch {
      // ignore
    }
  }

  const timestamp = Date.now();
  return `/api/product-image?v=${timestamp}`;
}

export function getProductImageResponse(): Response | null {
  ensureDataDir();
  const exts = ["webp", "jpg", "jpeg", "png", "gif"];

  for (const ext of exts) {
    const candidate = path.join(DATA_DIR, `product-photo.${ext}`);
    if (fs.existsSync(candidate)) {
      try {
        const data = fs.readFileSync(candidate);
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      } catch (err) {
        console.error("[product-config] Error reading image candidate:", err);
      }
    }
  }

  return null;
}
