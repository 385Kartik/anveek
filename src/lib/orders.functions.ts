import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PRICE } from "@/lib/i18n";

const phone = z.string().trim().regex(/^[6-9]\d{9}$/);
const orderSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone1: phone,
  phone2: z.union([phone, z.literal("")]).optional(),
  address: z.string().trim().min(5).max(500),
  quantity: z.number().int().min(1).max(50),
  lang: z.string().optional().default("gu"),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => orderSchema.parse(i))
  .handler(async ({ data }) => {
    console.log("[createOrder] Received payload from client:", JSON.stringify(data));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: insertedOrder, error } = await supabaseAdmin
      .from("orders")
      .insert({
        name: data.name,
        phone1: data.phone1,
        phone2: data.phone2 || null,
        address: data.address,
        quantity: data.quantity,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createOrder] Supabase error:", error);
      throw new Error("Order failed: " + error.message);
    }

    const orderLang = String(data.lang || "").toLowerCase().trim() === "en" ? "en" : "gu";
    console.log(`[createOrder] Triggering WhatsApp confirmation for order ${insertedOrder?.id} with lang="${orderLang}"`);

    // Trigger WhatsApp Order Confirmation Message via Baileys
    try {
      const { sendOrderConfirmationMessage } = await import("@/lib/whatsapp.server");
      await sendOrderConfirmationMessage({
        name: data.name,
        phone1: data.phone1,
        quantity: data.quantity,
        address: data.address,
        orderId: insertedOrder?.id,
        totalPrice: data.quantity * PRICE,
        lang: orderLang,
      });
    } catch (waError) {
      console.error("[createOrder] WhatsApp confirmation message failed:", waError);
      // We don't fail the order if WhatsApp message fails so the customer order is still safely stored in DB
    }

    return { ok: true };
  });

function checkPw(pw: string) {
  const real = process.env["ADMIN_PASSWORD"] || "admin";
  if (!real || pw !== real) throw new Error("Wrong password");
}

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((i: { password: string }) => z.object({ password: z.string().max(200) }).parse(i))
  .handler(async ({ data }) => {
    checkPw(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[listOrders] Supabase error:", error);
      throw new Error("Load failed: " + error.message);
    }
    return rows;
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        password: z.string().max(200),
        id: z.string().uuid(),
        status: z.enum(["pending", "delivered"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    checkPw(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) {
      console.error("[setOrderStatus] Supabase error:", error);
      throw new Error("Update failed: " + error.message);
    }
    return { ok: true };
  });

export const setPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        password: z.string().max(200),
        id: z.string().uuid(),
        payment_status: z.enum(["unpaid", "paid"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    checkPw(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: data.payment_status })
      .eq("id", data.id);
    if (error) {
      console.error("[setPaymentStatus] Supabase error:", error);
      throw new Error("Update failed: " + error.message);
    }
    return { ok: true };
  });

export const getWhatsAppStatusFn = createServerFn({ method: "POST" })
  .inputValidator((i: { password: string }) => z.object({ password: z.string().max(200) }).parse(i))
  .handler(async ({ data }) => {
    checkPw(data.password);
    const { getWhatsAppStatus, initWhatsApp } = await import("@/lib/whatsapp.server");
    const status = getWhatsAppStatus();
    if (status.status === "uninitialized") {
      initWhatsApp().catch(console.error);
    }
    return getWhatsAppStatus();
  });

export const reconnectWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator((i: { password: string; force?: boolean }) =>
    z.object({ password: z.string().max(200), force: z.boolean().optional() }).parse(i)
  )
  .handler(async ({ data }) => {
    checkPw(data.password);
    const { requestFreshQr } = await import("@/lib/whatsapp.server");
    return await requestFreshQr(data.force ?? true);
  });
