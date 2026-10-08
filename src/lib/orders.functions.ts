import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phone = z.string().trim().regex(/^[6-9]\d{9}$/);
const orderSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone1: phone,
  phone2: z.union([phone, z.literal("")]).optional(),
  address: z.string().trim().min(5).max(500),
  quantity: z.number().int().min(1).max(50),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => orderSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").insert({
      name: data.name,
      phone1: data.phone1,
      phone2: data.phone2 || null,
      address: data.address,
      quantity: data.quantity,
    });
    if (error) throw new Error("Order failed");
    return { ok: true };
  });

function checkPw(pw: string) {
  const real = process.env["ADMIN_PASSWORD"];
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
    if (error) throw new Error("Load failed");
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
    if (error) throw new Error("Update failed");
    return { ok: true };
  });
