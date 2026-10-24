import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Truck, ShieldCheck, Leaf, CheckCircle2, Phone, Award, MapPin } from "lucide-react";
import oilCan from "@/assets/anveek-tin.webp";
import oilLabel from "@/assets/anveek-label.webp";
import brandLogo from "@/assets/anveek-brand-lockup.png";
import { t, PRICE, type Lang } from "@/lib/i18n";
import { createOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anveek®" },
      { name: "description", content: "Anveek® સીંગતેલ 15KG ડબ્બો. ઘરે ડિલિવરી." },
      { property: "og:title", content: "Anveek®" },
      { property: "og:description", content: "Anveek® સીંગતેલ 15KG ડબ્બો." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Step = "shop" | "form" | "confirm" | "done";

function Index() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("anveek_lang");
        if (saved === "en" || saved === "gu") return saved;
      } catch {}
    }
    return "gu";
  });
  const L = t[lang];
  const [activeImg, setActiveImg] = useState<"can" | "label">("can");
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<Step>("shop");
  const [f, setF] = useState({ name: "", phone1: "", phone2: "", address: "" });
  const [err, setErr] = useState<Partial<Record<"name" | "phone1" | "phone2" | "address", string>>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const submit = useServerFn(createOrder);
  const total = qty * PRICE;

  const changeLang = (l: Lang) => {
    setLang(l);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("anveek_lang", l);
      } catch {}
    }
  };

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
    const selectedLang = typeof window !== "undefined" && localStorage.getItem("anveek_lang") ? (localStorage.getItem("anveek_lang") as Lang) : lang;
    try {
      await submit({ data: { ...f, quantity: qty, lang: selectedLang } });
      setStep("done");
    } catch {
      setFail(L.fail);
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 10);

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-background pb-32 font-sans px-3 sm:px-6">
      <header className="flex items-center justify-between py-3.5 border-b border-border/50 mb-3">
        <div className="flex items-center gap-2.5">
          <img
            src={brandLogo}
            alt="Anveek"
            className="h-8 sm:h-10 w-auto object-contain cursor-pointer"
            onClick={() => setStep("shop")}
          />
          <span className="hidden sm:inline-block text-[11px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {L.headerOrigin}
          </span>
        </div>
        <div className="flex rounded-full bg-muted p-1 text-sm shadow-inner">
          {(["gu", "en"] as Lang[]).map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => changeLang(l)}
              className={`rounded-full px-3.5 py-1 font-semibold transition-all ${
                lang === l ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "gu" ? "ગુજ" : "EN"}
            </button>
          ))}
        </div>
      </header>

      {step === "done" ? (
        <div className="max-w-md mx-auto flex flex-col items-center px-6 pt-16 text-center">
          <CheckCircle2 className="h-24 w-24 text-primary" />
          <h1 className="mt-6 font-display text-4xl font-extrabold">{L.thanks}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{L.thanksSub}</p>
          <button
            onClick={() => {
              setStep("shop");
              setQty(1);
              setF({ name: "", phone1: "", phone2: "", address: "" });
            }}
            className="mt-8 rounded-2xl border-2 border-primary px-6 py-3 font-bold text-primary hover:bg-primary/5 transition-all"
          >
            {L.again}
          </button>
        </div>
      ) : step === "shop" ? (
        <div className="md:grid md:grid-cols-2 md:gap-10 md:items-start pt-2">
          {/* Left Column: Image Gallery + Nutritional Label Details */}
          <div className="space-y-4">
            {/* Main Interactive Showcase Image */}
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border/60 shadow-lg">
              <img
                src={activeImg === "can" ? oilCan : oilLabel}
                alt={L.title}
                width={900}
                height={900}
                fetchPriority="high"
                decoding="async"
                className={`aspect-square w-full transition-all duration-300 ${
                  activeImg === "can"
                    ? "object-cover"
                    : "object-contain bg-[#f9f8f4] p-3"
                }`}
              />
              <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs sm:text-sm font-bold text-accent-foreground shadow-sm">
                {L.tag}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-card/90 backdrop-blur px-2.5 py-1 text-xs font-semibold text-foreground border border-border/50">
                {activeImg === "can" ? L.badgeCan : L.badgeLabel}
              </span>
            </div>

            {/* Gallery Thumbnail Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveImg("can")}
                className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 transition-all text-left ${
                  activeImg === "can"
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                    : "border-border/60 bg-card hover:border-primary/40"
                }`}
              >
                <img
                  src={oilCan}
                  alt="Can"
                  loading="lazy"
                  decoding="async"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-xl object-cover shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">{L.galleryCan}</p>
                  <p className="text-[11px] text-muted-foreground">{L.galleryCanSub}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveImg("label")}
                className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 transition-all text-left ${
                  activeImg === "label"
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                    : "border-border/60 bg-card hover:border-primary/40"
                }`}
              >
                <img
                  src={oilLabel}
                  alt="Label"
                  loading="lazy"
                  decoding="async"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-xl object-cover bg-[#f9f8f4] p-0.5 shadow-xs shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate">{L.galleryLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{L.galleryLabelSub}</p>
                </div>
              </button>
            </div>

            {/* Quality & Origin Details Card (Extracted from 2nd Image) */}
            <div className="rounded-3xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Award className="h-5 w-5" />
                <h3>{L.specTitle}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <span className="text-muted-foreground block text-[11px]">{L.originTitle}</span>
                  <span className="font-bold text-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {L.originVal}
                  </span>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <span className="text-muted-foreground block text-[11px]">{L.fssaiTitle}</span>
                  <span className="font-bold text-foreground mt-0.5 block">{L.fssaiVal}</span>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <span className="text-muted-foreground block text-[11px]">{L.mfgTitle}</span>
                  <span className="font-bold text-foreground mt-0.5 block truncate">{L.mfgVal}</span>
                </div>
                <div className="rounded-xl bg-muted/50 p-2.5">
                  <span className="text-muted-foreground block text-[11px]">{L.unrefinedTitle}</span>
                  <span className="font-bold text-foreground mt-0.5 block truncate">{L.unrefinedVal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Trust, Benefits, Price & Buy Box */}
          <div className="space-y-5 pt-3 md:pt-0">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-foreground">
                {L.title}
              </h1>
              <p className="mt-2 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {L.sub}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-accent text-sm font-bold">★★★★★</span>
                <span className="text-xs sm:text-sm font-semibold text-accent">{L.trust}</span>
              </div>
            </div>

            {/* 3 Value Highlights */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
              {[
                [Truck, L.b1],
                [ShieldCheck, L.b2],
                [Leaf, L.b3],
              ].map(([I, s], i) => {
                const Icon = I as typeof Truck;
                return (
                  <div key={i} className="rounded-2xl bg-card border border-border/40 p-3 shadow-xs">
                    <Icon className="mx-auto h-6 w-6 text-primary" />
                    <p className="mt-1 font-medium text-foreground">{s as string}</p>
                  </div>
                );
              })}
            </div>

            {/* Price & Quantity Selector Box */}
            <div className="rounded-3xl bg-gold p-5 text-secondary-foreground shadow-md">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-base sm:text-lg font-bold block">{L.box}</span>
                  <span className="text-xs opacity-80">{L.netWeight}</span>
                </div>
                <span className="font-display text-3xl sm:text-4xl font-extrabold">₹{PRICE}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-secondary-foreground/15 pt-3">
                <span className="font-semibold text-sm sm:text-base">{L.qty}</span>
                <div className="flex items-center gap-4 rounded-full bg-card p-1 shadow-xs">
                  <button
                    type="button"
                    aria-label="decrease"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid h-10 w-10 place-items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-all"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center text-xl font-bold text-foreground">{qty}</span>
                  <button
                    type="button"
                    aria-label="increase"
                    onClick={() => setQty((q) => Math.min(50, q + 1))}
                    className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Direct Order Button (Visible on md and up) */}
            <div className="hidden md:block pt-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full rounded-2xl bg-primary py-4 font-display text-xl font-extrabold text-primary-foreground shadow-cta hover:bg-primary/95 transition-all"
              >
                {`${L.order} →`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <section className="max-w-xl mx-auto pt-2">
          <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/50 p-3 shadow-sm">
            <img src={oilCan} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">{L.title}</p>
              <p className="text-sm text-muted-foreground">{L.box} × {qty}</p>
            </div>
            <p className="font-display text-xl font-extrabold text-foreground">₹{total}</p>
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
            <div className="mt-5 rounded-3xl border-2 border-primary bg-card p-5 shadow-sm">
              <h2 className="font-display text-2xl font-extrabold text-foreground">{L.confirmQ}</h2>
              <dl className="mt-3 space-y-1.5 text-base">
                <p><b>{L.name}:</b> {f.name}</p>
                <p><b>{L.p1}:</b> +91 {f.phone1}</p>
                {f.phone2 && <p><b>{L.p2}:</b> +91 {f.phone2}</p>}
                <p className="break-words"><b>{L.addr}:</b> {f.address}</p>
                <p className="text-lg"><b>{L.total}:</b> <span className="font-bold text-primary">₹{total}</span></p>
              </dl>
              {fail && <p className="mt-3 font-semibold text-destructive">{fail}</p>}
              <button type="button" onClick={() => setStep("form")} className="mt-4 w-full rounded-2xl border-2 border-border py-3 font-bold text-muted-foreground hover:bg-muted/30 transition-all">
                {L.no}
              </button>
            </div>
          )}
        </section>
      )}

      {step !== "done" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur shadow-2xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{L.total} ({qty} × 15KG)</span>
              <span className="font-display text-2xl font-extrabold text-foreground">₹{total}</span>
            </div>
            <button
              disabled={busy}
              onClick={() => {
                if (step === "shop") setStep("form");
                else if (step === "form") validate() && setStep("confirm");
                else confirm();
              }}
              className={`flex-1 sm:max-w-xs rounded-2xl bg-primary py-3.5 px-6 font-display text-lg font-extrabold text-primary-foreground shadow-cta disabled:opacity-60 transition-all ${
                step === "shop" ? "animate-pulse-soft" : ""
              }`}
            >
              {busy ? L.sending : step === "shop" ? `${L.order} →` : step === "form" ? L.next : L.yes}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl border-2 border-input bg-card px-4 py-3 text-lg outline-none focus:border-primary";

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
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
