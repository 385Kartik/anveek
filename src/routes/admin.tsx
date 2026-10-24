import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listOrders,
  setOrderStatus,
  setPaymentStatus,
  getWhatsAppStatusFn,
  reconnectWhatsAppFn,
} from "@/lib/orders.functions";

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

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<{
    status: string;
    qr: string | null;
    qrDataUrl: string | null;
  } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [waLoading, setWaLoading] = useState(false);

  const load = useServerFn(listOrders);
  const update = useServerFn(setOrderStatus);
  const updatePayment = useServerFn(setPaymentStatus);
  const fetchWaStatus = useServerFn(getWhatsAppStatusFn);
  const triggerReconnectWa = useServerFn(reconnectWhatsAppFn);

  const checkWa = async () => {
    try {
      const res = await fetchWaStatus({ data: { password: pw } });
      setWaStatus(res);
    } catch {
      // ignore
    }
  };

  const refresh = async () => {
    setErr("");
    try {
      setRows(await load({ data: { password: pw } }));
      await checkWa();
    } catch {
      setErr("Wrong password");
    }
  };

  // Poll WhatsApp status if QR modal is open
  useEffect(() => {
    if (!showQrModal || !rows) return;
    checkWa();
    const interval = setInterval(() => {
      checkWa();
    }, 1500);
    return () => clearInterval(interval);
  }, [showQrModal, rows]);

  const handleReconnectWa = async () => {
    setWaLoading(true);
    try {
      const res = await triggerReconnectWa({ data: { password: pw, force: true } });
      setWaStatus(res);
      setShowQrModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setWaLoading(false);
    }
  };

  const handleOpenQr = async () => {
    setShowQrModal(true);
    checkWa();
    if (!waStatus?.qrDataUrl && !isWaConnected) {
      await handleReconnectWa();
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
        "Quantity (15KG Tins)": o.quantity,
        Payment: o.payment_status,
        Status: o.status,
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

  const isWaConnected = waStatus?.status === "open";

  return (
    <div className="p-4 font-sans max-w-6xl mx-auto">
      {/* WhatsApp Status Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full ${
              isWaConnected ? "bg-green-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <div>
            <span className="font-bold text-sm">
              WhatsApp Status:{" "}
              {isWaConnected ? (
                <span className="text-green-600 dark:text-green-400">Connected (Auto-confirmation On)</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  {waStatus?.status === "connecting" ? "Connecting..." : "Not Linked / Disconnected"}
                </span>
              )}
            </span>
            <p className="text-xs text-muted-foreground">
              {isWaConnected
                ? "Automatic WhatsApp message is sent whenever an order is placed."
                : "Link WhatsApp to enable auto-messaging on new orders."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isWaConnected && (
            <button
              onClick={handleOpenQr}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
            >
              Scan WhatsApp QR
            </button>
          )}
          <button
            onClick={handleReconnectWa}
            disabled={waLoading}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {waLoading ? "Restarting..." : "Restart WhatsApp"}
          </button>
        </div>
      </div>

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
              {["Name", "Date of Order", "Phone 1", "Phone 2", "Address", "Qty", "Payment", "Status"].map((h) => (
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
                      setConfirm({ kind: "payment", order: o, next: o.payment_status === "paid" ? "unpaid" : "paid" })
                    }
                    className={`rounded-full px-3 py-1 font-bold ${o.payment_status === "paid" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                  >
                    {o.payment_status === "paid" ? "Paid" : "Unpaid"}
                  </button>
                </td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* WhatsApp QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl text-center">
            <h2 className="font-display text-xl font-extrabold text-primary">Link WhatsApp Device</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device, and scan this code:
            </p>

            <div className="my-5 flex justify-center">
              {waStatus?.qrDataUrl ? (
                <img
                  src={waStatus.qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="h-60 w-60 rounded-xl border border-border p-2 bg-white"
                />
              ) : isWaConnected ? (
                <div className="h-60 w-60 rounded-xl border border-border flex flex-col items-center justify-center bg-green-50 text-green-700">
                  <span className="text-4xl">✅</span>
                  <p className="font-bold mt-2">Connected Successfully!</p>
                </div>
              ) : (
                <div className="h-60 w-60 rounded-xl border border-border flex flex-col items-center justify-center bg-muted text-muted-foreground">
                  <span className="animate-spin text-2xl">⏳</span>
                  <p className="text-xs mt-2">Generating QR code...</p>
                  <p className="text-[10px] text-muted-foreground mt-1">If taking too long, click Restart below</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 rounded-xl border-2 border-border py-2.5 font-semibold text-sm"
              >
                Close
              </button>
              <button
                onClick={handleReconnectWa}
                disabled={waLoading}
                className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-sm text-primary-foreground disabled:opacity-50"
              >
                {waLoading ? "Generating..." : "Generate New QR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Status / Payment Confirm Modal */}
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
