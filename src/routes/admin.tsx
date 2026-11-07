import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listOrders,
  setOrderStatus,
  setPaymentStatus,
  updateOrder,
  deleteOrder,
  getWhatsAppStatusFn,
  reconnectWhatsAppFn,
  disconnectWhatsAppFn,
  getProductConfigFn,
  updateProductConfigFn,
} from "@/lib/orders.functions";
import defaultOilCan from "@/assets/anveek-tin.webp";

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
  | { kind: "delete"; order: Order }
  | null;

function Admin() {
  const [pw, setPw] = useState("");
  const [rows, setRows] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  // Edit Order state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    phone1: string;
    phone2: string;
    address: string;
    quantity: number;
    unitPrice: number;
    lang: "gu" | "en";
    notifyCustomer: boolean;
  }>({
    name: "",
    phone1: "",
    phone2: "",
    address: "",
    quantity: 1,
    unitPrice: 3500,
    lang: "gu",
    notifyCustomer: true,
  });
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<{
    status: string;
    qr: string | null;
    qrDataUrl: string | null;
  } | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [waLoading, setWaLoading] = useState(false);

  // Product Settings state
  const [productConfig, setProductConfig] = useState<{
    nameGu: string;
    nameEn: string;
    tagGu: string;
    tagEn: string;
    subGu?: string;
    subEn?: string;
    price: number;
    photoUrl: string;
  } | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState<{
    nameGu: string;
    nameEn: string;
    tagGu: string;
    tagEn: string;
    price: number;
    photoUrl: string;
    photoBase64?: string;
    photoPreview?: string;
  }>({
    nameGu: "સીંગતેલ",
    nameEn: "Groundnut Oil",
    tagGu: "ઘાણીનું સીંગતેલ",
    tagEn: "Unrefined",
    price: 3500,
    photoUrl: "",
    photoPreview: "",
  });
  const [productSaving, setProductSaving] = useState(false);
  const [productMsg, setProductMsg] = useState("");
  const [productError, setProductError] = useState("");

  const load = useServerFn(listOrders);
  const update = useServerFn(setOrderStatus);
  const updatePayment = useServerFn(setPaymentStatus);
  const triggerUpdateOrder = useServerFn(updateOrder);
  const triggerDeleteOrder = useServerFn(deleteOrder);
  const fetchWaStatus = useServerFn(getWhatsAppStatusFn);
  const triggerReconnectWa = useServerFn(reconnectWhatsAppFn);
  const triggerDisconnectWa = useServerFn(disconnectWhatsAppFn);
  const fetchProductConfig = useServerFn(getProductConfigFn);
  const saveProductConfigAction = useServerFn(updateProductConfigFn);

  const checkWa = async () => {
    try {
      const res = await fetchWaStatus({ data: { password: pw } });
      setWaStatus(res);
    } catch {
      // ignore
    }
  };

  const loadProduct = async () => {
    try {
      const cfg = await fetchProductConfig();
      if (cfg) {
        setProductConfig(cfg);
        setProductForm({
          nameGu: cfg.nameGu || "સીંગતેલ",
          nameEn: cfg.nameEn || "Groundnut Oil",
          tagGu: cfg.tagGu || "ઘાણીનું સીંગતેલ",
          tagEn: cfg.tagEn || "Unrefined",
          price: cfg.price || 3500,
          photoUrl: cfg.photoUrl || "",
          photoPreview: cfg.photoUrl || "",
        });
      }
    } catch (e) {
      console.error("[admin] load product config error:", e);
    }
  };

  const refresh = async () => {
    setErr("");
    try {
      setRows(await load({ data: { password: pw } }));
      await checkWa();
      await loadProduct();
    } catch {
      setErr("Wrong password");
    }
  };

  const handleOpenProductModal = () => {
    if (productConfig) {
      setProductForm({
        nameGu: productConfig.nameGu || "સીંગતેલ",
        nameEn: productConfig.nameEn || "Groundnut Oil",
        tagGu: productConfig.tagGu || "ઘાણીનું સીંગતેલ",
        tagEn: productConfig.tagEn || "Unrefined",
        price: productConfig.price || 3500,
        photoUrl: productConfig.photoUrl || "",
        photoPreview: productConfig.photoUrl || "",
        photoBase64: undefined,
      });
    }
    setProductMsg("");
    setProductError("");
    setShowProductModal(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setProductError("Image file size should be less than 8MB");
      return;
    }
    setProductError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProductForm((prev) => ({
        ...prev,
        photoBase64: result,
        photoPreview: result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async () => {
    if (!productForm.nameGu.trim() || !productForm.nameEn.trim()) {
      setProductError("Both Gujarati and English product names are required.");
      return;
    }
    if (!productForm.price || productForm.price <= 0) {
      setProductError("Price must be greater than ₹0.");
      return;
    }

    setProductSaving(true);
    setProductError("");
    setProductMsg("");

    try {
      const updated = await saveProductConfigAction({
        data: {
          password: pw,
          nameGu: productForm.nameGu.trim(),
          nameEn: productForm.nameEn.trim(),
          tagGu: productForm.tagGu.trim(),
          tagEn: productForm.tagEn.trim(),
          price: Number(productForm.price),
          photoUrl: productForm.photoUrl.trim(),
          photoBase64: productForm.photoBase64,
        },
      });

      setProductConfig(updated);
      setProductForm((prev) => ({
        ...prev,
        photoUrl: updated.photoUrl || "",
        photoPreview: updated.photoUrl || "",
        photoBase64: undefined,
      }));
      setProductMsg("Product details updated successfully! Live on website. ✅");
      setTimeout(() => {
        setShowProductModal(false);
        setProductMsg("");
      }, 1200);
    } catch (e: any) {
      setProductError(e?.message || "Failed to update product details.");
    } finally {
      setProductSaving(false);
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

  const handleDisconnectWa = async () => {
    if (typeof window !== "undefined" && !window.confirm("Are you sure you want to disconnect WhatsApp and wipe session files?")) {
      return;
    }
    setWaLoading(true);
    try {
      const res = await triggerDisconnectWa({ data: { password: pw } });
      setWaStatus(res);
      setShowQrModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setWaLoading(false);
    }
  };

  const applyConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "status") {
        await update({ data: { password: pw, id: confirm.order.id, status: confirm.next } });
        setRows((r) => r?.map((x) => (x.id === confirm.order.id ? { ...x, status: confirm.next } : x)) ?? null);
      } else if (confirm.kind === "payment") {
        await updatePayment({ data: { password: pw, id: confirm.order.id, payment_status: confirm.next } });
        setRows((r) => r?.map((x) => (x.id === confirm.order.id ? { ...x, payment_status: confirm.next } : x)) ?? null);
      } else if (confirm.kind === "delete") {
        await triggerDeleteOrder({ data: { password: pw, id: confirm.order.id } });
        setRows((r) => r?.filter((x) => x.id !== confirm.order.id) ?? null);
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const handleOpenEdit = (o: Order) => {
    const initialLang = (o.lang === "en" ? "en" : "gu") as "gu" | "en";
    setEditingOrder(o);
    setEditError("");
    setEditForm({
      name: o.name,
      phone1: o.phone1,
      phone2: o.phone2 ?? "",
      address: o.address,
      quantity: o.quantity,
      unitPrice: o.unitPrice || 3500,
      lang: initialLang,
      notifyCustomer: isWaConnected,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    const nameClean = editForm.name.trim();
    if (nameClean.length < 2) {
      setEditError("Name must be at least 2 characters.");
      return;
    }
    const phoneClean = editForm.phone1.trim();
    if (!/^[6-9]\d{9}$/.test(phoneClean)) {
      setEditError("Phone 1 must be a valid 10-digit Indian mobile number.");
      return;
    }
    const phone2Clean = editForm.phone2.trim();
    if (phone2Clean && !/^[6-9]\d{9}$/.test(phone2Clean)) {
      setEditError("Phone 2 must be a valid 10-digit Indian mobile number or left blank.");
      return;
    }
    const addressClean = editForm.address.trim();
    if (addressClean.length < 5) {
      setEditError("Delivery address must be at least 5 characters.");
      return;
    }
    if (editForm.quantity < 1 || editForm.quantity > 50) {
      setEditError("Quantity must be between 1 and 50.");
      return;
    }

    setEditBusy(true);
    setEditError("");
    try {
      const res = await triggerUpdateOrder({
        data: {
          password: pw,
          id: editingOrder.id,
          name: nameClean,
          phone1: phoneClean,
          phone2: phone2Clean || undefined,
          address: addressClean,
          quantity: editForm.quantity,
          unitPrice: editForm.unitPrice,
          lang: editForm.lang,
          notifyCustomer: editForm.notifyCustomer,
        },
      });

      const nextEditCount =
        res && typeof (res as any).editCount === "number"
          ? (res as any).editCount
          : (editingOrder.editCount || 0) + 1;
      const nextLastEditedAt = (res as any)?.lastEditedAt || new Date().toISOString();
      const updatedUnitPrice = (res as any)?.unitPrice || editForm.unitPrice;
      const updatedTotalPrice = (res as any)?.totalPrice || (editForm.quantity * updatedUnitPrice);

      setRows(
        (r) =>
          r?.map((x) =>
            x.id === editingOrder.id
              ? {
                  ...x,
                  name: nameClean,
                  phone1: phoneClean,
                  phone2: phone2Clean || null,
                  address: addressClean,
                  quantity: editForm.quantity,
                  unitPrice: updatedUnitPrice,
                  totalPrice: updatedTotalPrice,
                  lang: editForm.lang,
                  editCount: nextEditCount,
                  lastEditedAt: nextLastEditedAt,
                }
              : x,
          ) ?? null,
      );
      setEditingOrder(null);
    } catch (e: any) {
      setEditError(e?.message || "Failed to update order.");
    } finally {
      setEditBusy(false);
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
        "Rate / Unit Price (₹)": o.unitPrice || 3500,
        "Total Amount (₹)": o.totalPrice || (o.quantity * (o.unitPrice || 3500)),
        Payment: o.payment_status,
        Status: o.status,
        Language: o.lang === "en" ? "English" : "Gujarati",
        "Edited Times": o.editCount || 0,
        "Last Edited": o.lastEditedAt ? new Date(o.lastEditedAt).toLocaleString("en-IN") : "Never",
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
    <div className="p-4 font-sans max-w-7xl mx-auto">
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
                ? "Automatic WhatsApp message is sent whenever an order is placed or updated."
                : "Link WhatsApp to enable auto-messaging on new orders."}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {!isWaConnected ? (
            <button
              onClick={handleOpenQr}
              disabled={waLoading}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {waLoading ? "Opening..." : "Scan WhatsApp QR"}
            </button>
          ) : (
            <button
              onClick={handleDisconnectWa}
              disabled={waLoading}
              className="rounded-xl border border-destructive/40 bg-destructive/10 text-destructive px-3 py-1.5 text-xs font-bold hover:bg-destructive/20 transition-all disabled:opacity-50"
            >
              {waLoading ? "Disconnecting..." : "Disconnect WhatsApp"}
            </button>
          )}
          <button
            onClick={handleReconnectWa}
            disabled={waLoading}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {waLoading ? "Restarting..." : "Restart WhatsApp"}
          </button>
        </div>
      </div>

      {/* Product Details Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src={productConfig?.photoUrl || defaultOilCan}
            alt="Product"
            className="h-12 w-12 rounded-xl object-cover border border-border bg-[#f9f8f4]"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base text-foreground">
                {productConfig?.nameGu || "સીંગતેલ"} / {productConfig?.nameEn || "Groundnut Oil"}
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                ₹{productConfig?.price || 3500} / 15KG
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {productConfig?.tagGu || "ઘાણીનું સીંગતેલ"} • {productConfig?.tagEn || "Unrefined"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live product details on <a href="https://anveek.com" target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline">anveek.com</a> (changes reflect live on storefront, WhatsApp & orders)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenProductModal}
          className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 shadow-sm flex items-center gap-1.5 transition-all"
        >
          <span>✏️ Edit Product Details & Price</span>
        </button>
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
              {["Name", "Date of Order", "Phone 1", "Phone 2", "Address", "Qty", "Total", "Payment", "Status", "Actions"].map((h) => (
                <th key={h} className="whitespace-nowrap p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id} className="border-t border-border align-top">
                <td className="p-3 font-semibold">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{o.name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        o.lang === "en"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                      title={`Notification language: ${o.lang === "en" ? "English" : "Gujarati"}`}
                    >
                      {o.lang === "en" ? "EN" : "GU"}
                    </span>
                    {Boolean(o.editCount && o.editCount > 0) && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-800 px-2 py-0.5 text-[10px] font-bold shadow-xs cursor-default"
                        title={`Order was edited ${o.editCount} time${o.editCount > 1 ? "s" : ""}${
                          o.lastEditedAt ? ` · Last: ${new Date(o.lastEditedAt).toLocaleString("en-IN")}` : ""
                        }`}
                      >
                        <span>✏️</span>
                        <span>Edited ({o.editCount})</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap p-3">{new Date(o.created_at).toLocaleString("en-IN")}</td>
                <td className="p-3"><a href={`tel:+91${o.phone1}`} className="text-primary font-medium">{o.phone1}</a></td>
                <td className="p-3">{o.phone2 || "-"}</td>
                <td className="min-w-48 p-3 text-xs leading-relaxed">{o.address}</td>
                <td className="p-3 font-bold">{o.quantity} <span className="text-[11px] font-normal text-muted-foreground">(15KG)</span></td>
                <td className="whitespace-nowrap p-3 font-bold text-primary">
                  <div>₹{(o.totalPrice || o.quantity * (o.unitPrice || 3500)).toLocaleString("en-IN")}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">(@ ₹{o.unitPrice || 3500}/tin)</div>
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
                <td className="whitespace-nowrap p-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(o)}
                      className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                      title="Edit order details"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirm({ kind: "delete", order: o })}
                      className="rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive hover:bg-destructive/20 transition-all"
                      title="Delete order"
                    >
                      Delete
                    </button>
                  </div>
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
                <div className="h-60 w-60 rounded-xl border border-border flex flex-col items-center justify-center bg-green-50 text-green-700 p-4">
                  <span className="text-4xl">✅</span>
                  <p className="font-bold mt-2">Connected Successfully!</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ready to send order alerts</p>
                  <button
                    onClick={handleDisconnectWa}
                    disabled={waLoading}
                    className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive px-3.5 py-1.5 text-xs font-bold hover:bg-destructive/20"
                  >
                    Disconnect Session
                  </button>
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

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-extrabold text-foreground">Edit Order</h2>
                  {Boolean(editingOrder.editCount && editingOrder.editCount > 0) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-200 border border-orange-300 dark:border-orange-800 px-2.5 py-0.5 text-[11px] font-bold">
                      ✏️ Edited ({editingOrder.editCount}x)
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      Original Order
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Order ID: #{editingOrder.id.slice(0, 8)}
                  {editingOrder.lastEditedAt && (
                    <span> · Last edited: {new Date(editingOrder.lastEditedAt).toLocaleString("en-IN")}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Customer Name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Phone 1 (Required) *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editForm.phone1}
                    onChange={(e) => setEditForm({ ...editForm, phone1: e.target.value.replace(/\D/g, "") })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="10-digit mobile"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Phone 2 (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={editForm.phone2}
                    onChange={(e) => setEditForm({ ...editForm, phone2: e.target.value.replace(/\D/g, "") })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Alternate mobile"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Delivery Address *
                </label>
                <textarea
                  rows={3}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                  placeholder="Full delivery address"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Quantity (15KG Tins) *
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, quantity: Math.max(1, editForm.quantity - 1) })}
                    className="h-10 w-10 rounded-xl border border-border bg-muted flex items-center justify-center font-bold text-lg hover:bg-muted/80"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editForm.quantity}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        quantity: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="h-10 w-20 text-center rounded-xl border border-input bg-background font-bold text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, quantity: Math.min(50, editForm.quantity + 1) })}
                    className="h-10 w-10 rounded-xl border border-border bg-muted flex items-center justify-center font-bold text-lg hover:bg-muted/80"
                  >
                    +
                  </button>
                  <div className="ml-auto rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2 text-right">
                    <span className="text-[11px] text-muted-foreground block">Total Amount</span>
                    <span className="text-base font-extrabold text-primary">
                      ₹{(editForm.quantity * (editForm.unitPrice || 3500)).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Rate / Unit Price */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Rate per 15KG Tin (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={editForm.unitPrice || 3500}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        unitPrice: Math.max(1, parseInt(e.target.value) || 3500),
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background pl-7 pr-3 py-2 text-sm font-bold"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Rate locked at order time (all previous orders stay ₹3500; new orders use new rate).
                </p>
              </div>

              {/* WhatsApp Notification Language */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Notification Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, lang: "gu" })}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition-all ${
                      editForm.lang === "gu"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    ગુજરાતી (Gujarati)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, lang: "en" })}
                    className={`rounded-xl py-2 px-3 text-xs font-bold border transition-all ${
                      editForm.lang === "en"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    English
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {editForm.lang === "en"
                    ? "English selected. WhatsApp message will be sent in English."
                    : "Gujarati selected. WhatsApp message will be sent in Gujarati."}
                </p>
              </div>

              {/* WhatsApp Notification Toggle */}
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.notifyCustomer}
                    onChange={(e) => setEditForm({ ...editForm, notifyCustomer: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold block">
                      Send updated confirmation to customer via WhatsApp
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {isWaConnected
                        ? "Customer will receive an instant WhatsApp alert with the new details & amount."
                        : "WhatsApp is currently offline; connect it first to send automatic alerts."}
                    </span>
                  </div>
                </label>
              </div>

              {editError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive font-semibold">
                  ⚠️ {editError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                disabled={editBusy}
                className="flex-1 rounded-xl border-2 border-border py-2.5 font-semibold text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editBusy}
                className="flex-1 rounded-xl bg-primary py-2.5 font-bold text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {editBusy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Status / Payment / Delete Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="font-display text-xl font-extrabold">Confirm change</h2>
            <p className="mt-2 text-muted-foreground">
              {confirm.kind === "status" ? (
                <>
                  Mark <b>{confirm.order.name}</b>'s order as <b className="capitalize">{confirm.next}</b>?
                </>
              ) : confirm.kind === "payment" ? (
                <>
                  Mark <b>{confirm.order.name}</b>'s payment as <b className="capitalize">{confirm.next}</b>?
                </>
              ) : (
                <>
                  Delete order #{confirm.order.id.slice(0, 8)} for <b>{confirm.order.name}</b> ({confirm.order.quantity} tin{confirm.order.quantity > 1 ? "s" : ""})?
                  <span className="block mt-2 text-xs text-destructive font-semibold">
                    ⚠️ This action will permanently remove the order from database.
                  </span>
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
                className={`flex-1 rounded-xl py-3 font-bold text-primary-foreground disabled:opacity-50 ${
                  confirm.kind === "delete" ? "bg-destructive hover:bg-destructive/90" : "bg-primary"
                }`}
              >
                {busy ? "Saving..." : confirm.kind === "delete" ? "Yes, Delete" : "Yes, confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Product Details Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-display text-xl font-extrabold text-foreground">
                  Product Settings & Pricing
                </h3>
                <p className="text-xs text-muted-foreground">પ્રોડક્ટનું નામ, ફોટો અને ભાવ અપડેટ કરો</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Image Preview & Upload */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-muted/40 border border-border/60">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
                  <img
                    src={productForm.photoPreview || defaultOilCan}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <span className="block text-xs font-bold text-foreground">Product Photo (Tin Image)</span>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition-all border border-primary/20">
                      <span>📁 Upload New Photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handlePhotoFileChange}
                      />
                    </label>
                    {(productForm.photoPreview || productForm.photoUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          setProductForm((prev) => ({
                            ...prev,
                            photoUrl: "",
                            photoBase64: undefined,
                            photoPreview: "",
                          }))
                        }
                        className="rounded-xl border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Upload PNG, JPG, or WEBP (up to 8MB).
                  </p>
                </div>
              </div>

              {/* Optional Custom Image URL */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Or Image URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/tin-photo.jpg"
                  value={productForm.photoUrl}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      photoUrl: e.target.value,
                      photoPreview: e.target.value || prev.photoPreview,
                    }))
                  }
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Price per 15KG Tin (₹) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-base font-bold text-muted-foreground">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={productForm.price || ""}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: Number(e.target.value) }))
                    }
                    className="w-full rounded-xl border border-input bg-background pl-8 pr-3 py-2 text-base font-extrabold outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Product Name (Gujarati) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.nameGu}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, nameGu: e.target.value }))
                    }
                    placeholder="સીંગતેલ"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Product Name (English) <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.nameEn}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, nameEn: e.target.value }))
                    }
                    placeholder="Groundnut Oil"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Tags / Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Tag / Badge (Gujarati)
                  </label>
                  <input
                    type="text"
                    value={productForm.tagGu}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, tagGu: e.target.value }))
                    }
                    placeholder="ઘાણીનું સીંગતેલ"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Tag / Badge (English)
                  </label>
                  <input
                    type="text"
                    value={productForm.tagEn}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, tagEn: e.target.value }))
                    }
                    placeholder="Unrefined"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              {productError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs font-semibold text-destructive">
                  {productError}
                </div>
              )}

              {productMsg && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-2.5 text-xs font-semibold text-green-600 dark:text-green-400">
                  {productMsg}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                disabled={productSaving}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={productSaving}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {productSaving ? "Saving..." : "Save Product Details"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
