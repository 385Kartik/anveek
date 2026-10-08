import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Truck, ShieldCheck, Leaf, CheckCircle2, Phone } from "lucide-react";
import oil from "@/assets/oil.jpg";
import { t, PRICE, type Lang } from "@/lib/i18n";
import { createOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anveek શુદ્ધ સીંગતેલ — 5 લીટર, કેશ ઓન ડિલિવરી" },
      { name: "description", content: "Anveek 100% શુદ્ધ સીંગતેલ 5 લીટર બોક્સ. ઘરે ડિલિવરી, કેશ ઓન ડિલિવરી." },
      { property: "og:title", content: "Anveek શુદ્ધ સીંગતેલ" },
      { property: "og:description", content: "100% શુદ્ધ સીંગતેલ 5 લીટર બોક્સ — કેશ ઓન ડિલિવરી." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Step = "shop" | "form" | "confirm" | "done";

function Index() {
  const [lang, setLang] = useState<Lang>("gu");
  const L = t[lang];
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<Step>("shop");
  const [f, setF] = useState({ name: "", phone1: "", phone2: "", address: "" });
  const [err, setErr] = useState<Partial<Record<"name" | "phone1" | "phone2" | "address", string>>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const submit = useServerFn(createOrder);
  const total = qty * PRICE;

  const validate = () => {
    const e: Partial<Record<"name" | "phone1" | "phone2" | "address", string>> = {};
    if (f.name.trim().length < 2) e.name = L.errName;
    if (!/^[6-9]\d{9}$/.test(f.phone1)) e.phone1 = L.errPhone;
    if (f.phone2 && !/^[6-9]\d{9}$/.test(f.phone2)) e.phone2 = L.errPhone;
    if (f.address.trim().length < 5) e.address = L.errAddr;
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const confirm = async () => {
    setBusy(true);
    setFail("");
    try {
      await submit({ data: { ...f, quantity: qty } });
      setStep("done");
    } catch {
      setFail(L.fail);
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-32 font-sans">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-display text-2xl font-extrabold text-primary">Anveek</span>
        <div className="flex rounded-full bg-muted p-1 text-sm">
          {(["gu", "hi", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {l === "gu" ? "ગુજ" : l === "hi" ? "हिं" : "EN"}
            </button>
          ))}
        </div>
      </header>

      {step === "done" ? (
        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <CheckCircle2 className="h-24 w-24 text-primary" />
          <h1 className="mt-6 font-display text-4xl font-extrabold">{L.thanks}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{L.thanksSub}</p>
          <button
            onClick={() => {
              setStep("shop");
              setQty(1);
              setF({ name: "", phone1: "", phone2: "", address: "" });
            }}
            className="mt-8 rounded-2xl border-2 border-primary px-6 py-3 font-bold text-primary"
          >
            {L.again}
          </button>
        </div>
      ) : step === "shop" ? (
        <>
          <div className="relative mx-4 overflow-hidden rounded-3xl">
            <img src={oil} alt={L.title} width={1024} height={1024} className="aspect-square w-full object-cover" />
            <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
              {L.tag}
            </span>
          </div>
          <section className="px-5 pt-5">
            <h1 className="font-display text-4xl font-extrabold leading-tight">{L.title}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{L.sub}</p>
            <p className="mt-2 text-sm font-semibold text-accent">★★★★★ {L.trust}</p>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
              {[
                [Truck, L.b1],
                [ShieldCheck, L.b2],
                [Leaf, L.b3],
              ].map(([I, s], i) => {
                const Icon = I as typeof Truck;
                return (
                  <div key={i} className="rounded-2xl bg-card p-3 shadow-sm">
                    <Icon className="mx-auto h-6 w-6 text-primary" />
                    <p className="mt-1 font-medium">{s as string}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-3xl bg-gold p-5 text-secondary-foreground">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">{L.box}</span>
                <span className="font-display text-3xl font-extrabold">₹{PRICE}</span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-semibold">{L.qty}</span>
                <div className="flex items-center gap-4 rounded-full bg-card p-1">
                  <button
                    aria-label="decrease"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-11 w-11 place-items-center rounded-full bg-muted"
                  >
                    <Minus />
                  </button>
                  <span className="w-6 text-center text-2xl font-bold">{qty}</span>
                  <button
                    aria-label="increase"
                    onClick={() => setQty((q) => Math.min(50, q + 1))}
                    className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Plus />
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center font-semibold text-primary">💵 {L.cod} • {L.pay}</p>
          </section>
        </>
      ) : (
        <section className="px-5 pt-2">
          <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <img src={oil} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{L.title}</p>
              <p className="text-sm text-muted-foreground">{L.box} × {qty}</p>
            </div>
            <p className="font-display text-xl font-extrabold">₹{total}</p>
          </div>

          {step === "form" ? (
            <div className="mt-5 space-y-4">
              <Field label={L.name} error={err.name}>
                <input className={inputCls} value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </Field>
              <Field label={L.p1} error={err.phone1}>
                <PhoneInput value={f.phone1} onChange={(v) => setF({ ...f, phone1: digits(v) })} />
              </Field>
              <Field label={L.p2} error={err.phone2}>
                <PhoneInput value={f.phone2} onChange={(v) => setF({ ...f, phone2: digits(v) })} />
              </Field>
              <Field label={L.addr} error={err.address}>
                <textarea rows={3} maxLength={500} className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border-2 border-primary bg-card p-5">
              <h2 className="font-display text-2xl font-extrabold">{L.confirmQ}</h2>
              <dl className="mt-3 space-y-1 text-base">
                <p><b>{L.name}:</b> {f.name}</p>
                <p><b>{L.p1}:</b> +91 {f.phone1}</p>
                {f.phone2 && <p><b>{L.p2}:</b> +91 {f.phone2}</p>}
                <p className="break-words"><b>{L.addr}:</b> {f.address}</p>
                <p><b>{L.total}:</b> ₹{total} ({L.cod})</p>
              </dl>
              {fail && <p className="mt-3 font-semibold text-destructive">{fail}</p>}
              <button onClick={() => setStep("form")} className="mt-4 w-full rounded-2xl border-2 border-border py-3 font-bold text-muted-foreground">
                {L.no}
              </button>
            </div>
          )}
        </section>
      )}

      {step !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{L.total} ({qty} × 5L)</span>
            <span className="font-display text-xl font-extrabold">₹{total}</span>
          </div>
          <button
            disabled={busy}
            onClick={() => {
              if (step === "shop") setStep("form");
              else if (step === "form") validate() && setStep("confirm");
              else confirm();
            }}
            className={`w-full rounded-2xl bg-primary py-4 font-display text-xl font-extrabold text-primary-foreground shadow-cta disabled:opacity-60 ${step === "shop" ? "animate-pulse-soft" : ""}`}
          >
            {busy ? L.sending : step === "shop" ? `${L.order} →` : step === "form" ? L.next : L.yes}
          </button>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-input bg-card px-4 py-3 text-lg outline-none focus:border-primary";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm font-medium text-destructive">{error}</span>}
    </label>
  );
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-2xl border-2 border-input bg-card focus-within:border-primary">
      <span className="flex items-center gap-1 pl-4 text-lg font-semibold text-muted-foreground">
        <Phone className="h-4 w-4" /> +91
      </span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-3 py-3 text-lg outline-none"
      />
    </div>
  );
}
