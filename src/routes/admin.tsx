import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, setOrderStatus, setPaymentStatus } from "@/lib/orders.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Anveek Orders — Admin" },
      { name: "description", content: "Anveek order management." },
      { property: "og:title", content: "Anveek Orders — Admin" },
      { property: "og:description", content: "Anveek order management." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Order = Awaited<ReturnType<typeof listOrders>>[number];
type Filter = "all" | "pending" | "delivered";
type Confirm =
  | { kind: "status"; order: Order; next: "pending" | "delivered" }
  | { kind: "payment"; order: Order; next: "unpaid" | "paid" }
  | null;

function Admin() {
  const [pw, setPw] = useState("");
  const [rows, setRows] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const load = useServerFn(listOrders);
  const update = useServerFn(setOrderStatus);
  const updatePayment = useServerFn(setPaymentStatus);

  const refresh = async () => {
    setErr("");
    try {
      setRows(await load({ data: { password: pw } }));
    } catch {
      setErr("Wrong password");
    }
  };

  const applyConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "status") {
        await update({ data: { password: pw, id: confirm.order.id, status: confirm.next } });
        setRows((r) => r?.map((x) => (x.id === confirm.order.id ? { ...x, status: confirm.next } : x)) ?? null);
      } else {
        await updatePayment({ data: { password: pw, id: confirm.order.id, payment_status: confirm.next } });
        setRows((r) => r?.map((x) => (x.id === confirm.order.id ? { ...x, payment_status: confirm.next } : x)) ?? null);
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const download = async () => {
    if (!rows) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      rows.map((o) => ({
        Name: o.name,
        "Date of Order": new Date(o.created_at).toLocaleString("en-IN"),
        "Phone Number 1": o.phone1,
        "Phone Number 2": o.phone2 ?? "",
        Address: o.address,
        "Quantity (5L boxes)": o.quantity,
        Status: o.status,
        Payment: o.payment_status,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `anveek-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!rows)
    return (
      <div className="mx-auto max-w-sm p-6 pt-24 font-sans">
        <h1 className="font-display text-3xl font-extrabold text-primary">Anveek Admin</h1>
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          className="mt-6 w-full rounded-2xl border-2 border-input bg-card px-4 py-3"
        />
        {err && <p className="mt-2 text-destructive">{err}</p>}
        <button onClick={refresh} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-foreground">
          Login
        </button>
      </div>
    );

  const visible = filter === "all" ? rows : rows.filter((o) => o.status === filter);
  const counts = {
    all: rows.length,
    pending: rows.filter((o) => o.status === "pending").length,
    delivered: rows.filter((o) => o.status === "delivered").length,
  };

  return (
    <div className="p-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-extrabold">Orders ({visible.length})</h1>
        <div className="flex gap-2">
          <button onClick={refresh} className="rounded-xl border-2 border-border px-4 py-2 font-semibold">Refresh</button>
          <button onClick={download} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">
            Download Excel
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {(["all", "pending", "delivered"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {["Name", "Date of Order", "Phone 1", "Phone 2", "Address", "Qty", "Status", "Payment"].map((h) => (
                <th key={h} className="whitespace-nowrap p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="p-3 font-semibold">{o.name}</td>
                <td className="whitespace-nowrap p-3">{new Date(o.created_at).toLocaleString("en-IN")}</td>
                <td className="p-3"><a href={`tel:+91${o.phone1}`} className="text-primary">{o.phone1}</a></td>
                <td className="p-3">{o.phone2}</td>
                <td className="min-w-48 p-3">{o.address}</td>
                <td className="p-3">{o.quantity}</td>
                <td className="p-3">
                  <button
                    onClick={() =>
                      setConfirm({ kind: "status", order: o, next: o.status === "delivered" ? "pending" : "delivered" })
                    }
                    className={`rounded-full px-3 py-1 font-bold ${o.status === "delivered" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {o.status === "delivered" ? "Delivered" : "Pending"}
                  </button>
                </td>
                <td className="p-3">
                  <button
                    onClick={() =>
                      setConfirm({ kind: "payment", order: o, next: o.payment_status === "paid" ? "unpaid" : "paid" })
                    }
                    className={`rounded-full px-3 py-1 font-bold ${o.payment_status === "paid" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {o.payment_status === "paid" ? "Paid" : "Unpaid"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="font-display text-xl font-extrabold">Confirm change</h2>
            <p className="mt-2 text-muted-foreground">
              {confirm.kind === "status" ? (
                <>
                  Mark <b>{confirm.order.name}</b>'s order as <b className="capitalize">{confirm.next}</b>?
                </>
              ) : (
                <>
                  Mark <b>{confirm.order.name}</b>'s payment as <b className="capitalize">{confirm.next}</b>?
                </>
              )}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                disabled={busy}
                className="flex-1 rounded-xl border-2 border-border py-3 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={applyConfirm}
                disabled={busy}
                className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving..." : "Yes, confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
