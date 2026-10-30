import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.resolve(process.cwd(), "whatsapp-auth");

let sock: WASocket | null = null;
let qrCodeString: string | null = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: "connecting" | "open" | "close" | "uninitialized" = "uninitialized";
let isInitializing = false;
let qrResolvers: Array<(qr: string) => void> = [];

function clearAuthDir() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      console.log("[WhatsApp] Clearing stale auth directory:", AUTH_DIR);
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error("[WhatsApp] Error clearing auth directory:", err);
  }
}

function getPaymentQrBuffer(): Buffer | null {
  const possiblePaths = [
    path.resolve(process.cwd(), "public/payment-qr.jpg"),
    path.resolve(process.cwd(), ".output/public/payment-qr.jpg"),
    path.resolve(process.cwd(), "payment-qr.jpg"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p);
      } catch (err) {
        console.error(`[WhatsApp] Failed to read QR image from ${p}:`, err);
      }
    }
  }
  return null;
}

export async function initWhatsApp() {
  if (sock || isInitializing) return;
  isInitializing = true;
  connectionStatus = "connecting";

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const logger = pino({ level: "silent" });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeString = qr;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
          const terminalQr = await QRCode.toString(qr, { type: "terminal", small: true });
          console.log("\n================ WHATSAPP QR CODE ================");
          console.log(terminalQr);
          console.log("Scan this QR code with WhatsApp (Linked Devices) on your phone!");
          console.log("===================================================\n");

          for (const resolve of qrResolvers) {
            resolve(qrCodeDataUrl);
          }
          qrResolvers = [];
        } catch (e) {
          console.error("[WhatsApp] Failed to format QR code:", e);
        }
      }

      if (connection === "close") {
        connectionStatus = "close";
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        console.log(`[WhatsApp] Connection closed (status: ${statusCode})`);

        try {
          sock?.ev.removeAllListeners("connection.update");
          sock?.ev.removeAllListeners("creds.update");
        } catch {}
        sock = null;
        isInitializing = false;

        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden ||
          statusCode === DisconnectReason.badSession ||
          statusCode === DisconnectReason.multideviceMismatch ||
          statusCode === 401 ||
          statusCode === 403;
        const isRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515;

        if (isLoggedOut) {
          console.log("[WhatsApp] Device was logged out / unlinked from phone. Wiping session files to prevent loop.");
          clearAuthDir();
          qrCodeString = null;
          qrCodeDataUrl = null;
          connectionStatus = "close";
        } else if (isRestart) {
          console.log("[WhatsApp] Restart required (handshake completed after scan). Reconnecting immediately...");
          setTimeout(() => {
            initWhatsApp().catch(console.error);
          }, 1000);
        } else {
          console.log("[WhatsApp] Reconnecting in 3 seconds...");
          setTimeout(() => {
            initWhatsApp().catch(console.error);
          }, 3000);
        }
      } else if (connection === "open") {
        connectionStatus = "open";
        qrCodeString = null;
        qrCodeDataUrl = null;
        isInitializing = false;
        console.log("✅ [WhatsApp] WhatsApp connected successfully and ready to send messages!");
      } else if (connection === "connecting") {
        connectionStatus = "connecting";
      }
    });
  } catch (err) {
    console.error("[WhatsApp] Failed to initialize:", err);
    isInitializing = false;
    connectionStatus = "close";
  }
}

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qr: qrCodeString,
    qrDataUrl: qrCodeDataUrl,
  };
}

export async function requestFreshQr(force = false): Promise<{
  status: string;
  qr: string | null;
  qrDataUrl: string | null;
}> {
  if (connectionStatus === "open" && !force) {
    return getWhatsAppStatus();
  }

  if (qrCodeDataUrl && !force) {
    return getWhatsAppStatus();
  }

  console.log(`[WhatsApp] Requesting fresh QR (force=${force})...`);

  try {
    if (sock) {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      sock.end(undefined);
      sock = null;
    }
  } catch {}

  isInitializing = false;
  clearAuthDir();
  qrCodeString = null;
  qrCodeDataUrl = null;
  connectionStatus = "connecting";

  const qrPromise = new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => {
      resolve(qrCodeDataUrl);
    }, 6000);

    qrResolvers.push((qr) => {
      clearTimeout(timer);
      resolve(qr);
    });
  });

  initWhatsApp().catch(console.error);
  await qrPromise;

  return getWhatsAppStatus();
}

export async function disconnectWhatsApp(): Promise<{
  status: string;
  qr: string | null;
  qrDataUrl: string | null;
}> {
  console.log("[WhatsApp] Manual disconnect requested from admin panel. Logging out and wiping session...");

  try {
    if (sock) {
      try {
        await sock.logout();
      } catch (logoutErr) {
        console.log("[WhatsApp] sock.logout() notice:", logoutErr);
      }
      try {
        sock.ev.removeAllListeners("connection.update");
        sock.ev.removeAllListeners("creds.update");
        sock.end(undefined);
      } catch {}
      sock = null;
    }
  } catch (e) {
    console.error("[WhatsApp] Error during socket cleanup:", e);
  }

  isInitializing = false;
  clearAuthDir();
  qrCodeString = null;
  qrCodeDataUrl = null;
  connectionStatus = "close";

  console.log("[WhatsApp] Session wiped completely. Ready for fresh pairing.");
  return getWhatsAppStatus();
}

export interface OrderConfirmationDetails {
  name: string;
  phone1: string;
  quantity: number;
  address: string;
  orderId?: string;
  totalPrice?: number;
  lang?: "gu" | "en";
}

export async function sendOrderConfirmationMessage(details: OrderConfirmationDetails) {
  if (!sock || connectionStatus !== "open") {
    console.warn("[WhatsApp] Cannot send confirmation message - WhatsApp is not connected.");
    return false;
  }

  // Clean phone number: remove any non-digit
  let cleanPhone = details.phone1.replace(/\D/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }
  const jid = `${cleanPhone}@s.whatsapp.net`;

  const rawLang = String(details.lang || "").toLowerCase().trim();
  const lang = (rawLang === "en" || rawLang === "english") ? "en" : "gu";
  const total = details.totalPrice ?? details.quantity * 3500;

  console.log(`[WhatsApp] Preparing message for ${jid}. rawLang="${details.lang}", selected lang="${lang}"`);

  const gujaratiMessage = `🌿 *અન્વીક સીંગતેલ* 🌿

નમસ્તે *${details.name}* જી,
તમારો ઓર્ડર સફળતાપૂર્વક નોંધાઈ ગયો છે! 🙏

📦 *ઓર્ડર વિગતો:*
• જથ્થો: *${details.quantity > 1 ? `${details.quantity} ડબ્બા` : `1 ડબ્બો`} (15KG)*
• કુલ રકમ: *₹${total}*
• ડિલિવરી સરનામું: *${details.address}*
• મોબાઈલ નંબર: *${details.phone1}*

💳 *ઓનલાઇન પેમેન્ટ માટે:*
ઉપર આપેલ QR કોડ સ્કેન કરીને *₹${total}* ચૂકવણી (Google Pay / PhonePe / Paytm / UPI) કરી શકો છો.
પેમેન્ટ કર્યા પછી તેનો સ્ક્રીનશોટ આ જ નંબર પર મોકલી આપો.

✏️ *ઓર્ડરમાં કોઈ ફેરફાર (જથ્થો કે સરનામું) કરવો હોય તો આ જ નંબર પર મેસેજ અથવા કૉલ કરી શકો છો.*

તમારો ઓર્ડર ટૂંક સમયમાં તૈયાર કરીને તમારા સરનામે રવાના કરવામાં આવશે.

કોઈપણ પ્રશ્ન હોય તો આ જ નંબર પર સંપર્ક કરી શકો છો.

આભાર,
*અન્વીક ટીમ* ✨`;

  const englishMessage = `🌿 *Anveek Groundnut Oil* 🌿

Hello *${details.name}*,
Your order has been successfully placed! 🙏

📦 *Order Details:*
• Quantity: *${details.quantity > 1 ? `${details.quantity} Tins` : `1 Tin`} (15KG)*
• Total Amount: *₹${total}*
• Delivery Address: *${details.address}*
• Mobile Number: *${details.phone1}*

💳 *For Online Payment:*
Please scan the QR code above and pay *₹${total}* via UPI (Google Pay / PhonePe / Paytm).
After payment, please share the payment screenshot on this WhatsApp number.

✏️ *To modify your order (Quantity or Address), feel free to reply to this WhatsApp message or call us.*

Your order will be packed and dispatched to your address soon.

For any queries, feel free to contact us on this number.

Thank you,
*Anveek Team* ✨`;

  const message = lang === "en" ? englishMessage : gujaratiMessage;

  try {
    const qrBuffer = getPaymentQrBuffer();
    if (qrBuffer) {
      try {
        await sock.sendMessage(jid, {
          image: qrBuffer,
          caption: message,
          mimetype: "image/jpeg",
        });
        console.log(`[WhatsApp] Order confirmation message with QR image sent successfully to ${jid}`);
        return true;
      } catch (imgErr) {
        console.error(`[WhatsApp] Failed to send image message to ${jid}, falling back to text:`, imgErr);
      }
    }

    // Fallback if image not found or failed to send
    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Order confirmation message sent successfully to ${jid}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Failed to send message to ${jid}:`, err);
    return false;
  }
}

export async function sendOrderUpdatedMessage(details: OrderConfirmationDetails) {
  if (!sock || connectionStatus !== "open") {
    console.warn("[WhatsApp] Cannot send update message - WhatsApp is not connected.");
    return false;
  }

  let cleanPhone = details.phone1.replace(/\D/g, "");
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }
  const jid = `${cleanPhone}@s.whatsapp.net`;

  const rawLang = String(details.lang || "").toLowerCase().trim();
  const lang = (rawLang === "en" || rawLang === "english") ? "en" : "gu";
  const total = details.totalPrice ?? details.quantity * 3500;

  const gujaratiMessage = `🌿 *અન્વીક સીંગતેલ - ઓર્ડર અપડેટ* 🌿

નમસ્તે *${details.name}* જી,
તમારી વિનંતી મુજબ તમારો ઓર્ડર સફળતાપૂર્વક અપડેટ કરવામાં આવ્યો છે! ✅

📦 *સુધારેલી ઓર્ડર વિગતો:*
• જથ્થો: *${details.quantity > 1 ? `${details.quantity} ડબ્બા` : `1 ડબ્બો`} (15KG)*
• કુલ નવી રકમ: *₹${total}*
• ડિલિવરી સરનામું: *${details.address}*
• મોબાઈલ નંબર: *${details.phone1}*

💳 *ઓનલાઇન પેમેન્ટ:*
જો બાકી હોય તો ઉપર આપેલ QR કોડ સ્કેન કરીને *₹${total}* ચૂકવણી (Google Pay / PhonePe / Paytm / UPI) કરી શકો છો.

કોઈપણ પ્રશ્ન હોય તો આ જ નંબર પર સંપર્ક કરી શકો છો.

આભાર,
*અન્વીક ટીમ* ✨`;

  const englishMessage = `🌿 *Anveek Groundnut Oil - Order Updated* 🌿

Hello *${details.name}*,
As requested, your order has been updated successfully! ✅

📦 *Updated Order Details:*
• Quantity: *${details.quantity > 1 ? `${details.quantity} Tins` : `1 Tin`} (15KG)*
• Updated Total Amount: *₹${total}*
• Delivery Address: *${details.address}*
• Mobile Number: *${details.phone1}*

💳 *Online Payment:*
If pending, please scan the QR code and pay *₹${total}* via UPI.

For any queries, feel free to contact us on this number.

Thank you,
*Anveek Team* ✨`;

  const message = lang === "en" ? englishMessage : gujaratiMessage;

  try {
    const qrBuffer = getPaymentQrBuffer();
    if (qrBuffer) {
      try {
        await sock.sendMessage(jid, {
          image: qrBuffer,
          caption: message,
          mimetype: "image/jpeg",
        });
        console.log(`[WhatsApp] Order update message with QR image sent successfully to ${jid}`);
        return true;
      } catch (imgErr) {
        console.error(`[WhatsApp] Failed to send update image to ${jid}, falling back to text:`, imgErr);
      }
    }

    await sock.sendMessage(jid, { text: message });
    console.log(`[WhatsApp] Order update message sent successfully to ${jid}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] Failed to send update message to ${jid}:`, err);
    return false;
  }
}
