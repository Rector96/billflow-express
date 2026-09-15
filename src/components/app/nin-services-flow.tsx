/**
 * NIN Services — DEMO UI
 * Products: Retrieve NIN | Print NIN Slip
 * See docs/NIN_SERVICES.md
 * NIN_DEMO_MODE=true → no NIMC call, no wallet debit
 */
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Home,
  Info,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/mock-data";

export const NIN_DEMO_MODE = true;
export const NIN_RETRIEVE_PRICE = 300;
export const NIN_SLIP_PRICE = 500;

type Product = "retrieve" | "slip";
type Step = "choose" | "details" | "confirm" | "pay" | "success";

const STEPS: PayStepMeta[] = [
  { key: "choose", label: "Service" },
  { key: "details", label: "Details" },
  { key: "confirm", label: "Confirm" },
  { key: "pay", label: "Pay" },
];

function HelpNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="font-bold">Demo mode.</span> No real NIMC lookup and no wallet charge yet.
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-xs font-bold text-foreground">{value || "—"}</span>
    </div>
  );
}

export function NinServicesFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose");
  const [product, setProduct] = useState<Product | null>(null);
  const [paying, setPaying] = useState(false);
  const [refId, setRefId] = useState("");

  // Retrieve fields
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [trackingId, setTrackingId] = useState("");

  // Slip fields
  const [nin, setNin] = useState("");
  const [slipPhone, setSlipPhone] = useState("");

  // Demo result (fake)
  const [demoNin, setDemoNin] = useState("");

  const price = product === "retrieve" ? NIN_RETRIEVE_PRICE : NIN_SLIP_PRICE;

  const stepIndex = useMemo(() => {
    const keys = STEPS.map((s) => s.key);
    return Math.max(0, keys.indexOf(step === "success" ? "pay" : step));
  }, [step]);

  const goBack = () => {
    if (step === "choose") {
      void navigate({ to: "/services" });
      return;
    }
    if (step === "details") {
      setStep("choose");
      return;
    }
    if (step === "confirm") {
      setStep("details");
      return;
    }
    if (step === "pay") {
      setStep("confirm");
      return;
    }
    void navigate({ to: "/home" });
  };

  const validateDetails = () => {
    if (product === "retrieve") {
      if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
        toast.error("Enter the phone number registered with your NIN.");
        return false;
      }
      return true;
    }
    if (product === "slip") {
      if (nin.replace(/\D/g, "").length !== 11) {
        toast.error("NIN must be exactly 11 digits.");
        return false;
      }
      if (!slipPhone.trim() || slipPhone.replace(/\D/g, "").length < 10) {
        toast.error("Enter the phone number linked to this NIN.");
        return false;
      }
      return true;
    }
    return false;
  };

  const demoPay = useCallback(async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1100));
    const id = `NIN-DEMO-${Date.now().toString(36).toUpperCase()}`;
    setRefId(id);
    if (product === "retrieve") {
      // Deterministic demo NIN from phone digits
      const digits = phone.replace(/\D/g, "").slice(-6).padStart(6, "0");
      setDemoNin(`12345${digits}`.slice(0, 11));
    } else {
      setDemoNin(nin.replace(/\D/g, "").slice(0, 11));
    }
    setPaying(false);
    setStep("success");
    toast.success("Demo complete. No real payment or NIMC call.");
  }, [phone, nin, product]);

  return (
    <AppShell>
      <PageHeader
        title="NIN Services"
        subtitle={product === "retrieve" ? "Retrieve NIN" : product === "slip" ? "Print slip" : "Identity"}
        onBack={step === "success" ? () => void navigate({ to: "/home" }) : goBack}
      />

      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-5 pb-28">
        {step !== "success" ? <PayStepper steps={STEPS} current={stepIndex} /> : null}
        {NIN_DEMO_MODE ? <DemoBanner /> : null}

        {step === "choose" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">What do you need?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Simple identity helpers. We skipped TIN and corporate tax flows — those are heavier and fewer people need them day to day.
              </p>
            </div>
            <HelpNote>
              Official free options still exist (e.g. dial <strong>*346#</strong> for NIN retrieval). RockPay is a paid convenience layer when you want it in-app.
            </HelpNote>

            <button
              type="button"
              className="press flex w-full items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card"
              onClick={() => {
                setProduct("retrieve");
                setStep("details");
              }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                <Search className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Retrieve NIN</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Forgot your 11-digit NIN? Use the phone number you enrolled with.
                </p>
                <p className="mt-2 text-xs font-bold text-primary">{formatNaira(NIN_RETRIEVE_PRICE, false)}</p>
              </div>
            </button>

            <button
              type="button"
              className="press flex w-full items-start gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card"
              onClick={() => {
                setProduct("slip");
                setStep("details");
              }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Print NIN Slip</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Generate a digital NIN slip for banks, jobs, schools or travel.
                </p>
                <p className="mt-2 text-xs font-bold text-primary">{formatNaira(NIN_SLIP_PRICE, false)}</p>
              </div>
            </button>

            <HelpNote>
              <strong>Not included:</strong> personal/corporate TIN, plastic NIN card shipping, or NIN data correction (those need NIMC centres or partners).
            </HelpNote>
          </section>
        ) : null}

        {step === "details" && product === "retrieve" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Retrieve your NIN</h2>
              <p className="mt-1 text-xs text-muted-foreground">Use the phone number linked when you registered at NIMC.</p>
            </div>
            <HelpNote>
              Optional date of birth improves matching. Tracking ID is the code from your enrolment / modification slip if you still have it.
            </HelpNote>
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="space-y-1.5">
                <Label>Registered phone *</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0803…" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of birth (optional)</Label>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Tracking ID (optional)</Label>
                <Input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="From enrolment slip" className="h-11 rounded-xl" />
              </div>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => { if (validateDetails()) setStep("confirm"); }}>
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "details" && product === "slip" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Print NIN slip</h2>
              <p className="mt-1 text-xs text-muted-foreground">Enter your NIN and the phone number tied to it.</p>
            </div>
            <HelpNote>
              Your NIN is 11 digits. Do not share slips carelessly — use only for institutions that need them.
            </HelpNote>
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="space-y-1.5">
                <Label>NIN (11 digits) *</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  placeholder="12345678901"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Registered phone *</Label>
                <Input value={slipPhone} onChange={(e) => setSlipPhone(e.target.value)} inputMode="tel" placeholder="0803…" className="h-11 rounded-xl" />
              </div>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => { if (validateDetails()) setStep("confirm"); }}>
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "confirm" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Confirm</h2>
              <p className="mt-1 text-xs text-muted-foreground">Check details before the demo payment.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card px-4 py-1 shadow-card">
              <Row label="Service" value={product === "retrieve" ? "Retrieve NIN" : "Print NIN Slip"} />
              <Row label="Amount" value={formatNaira(price, false)} />
              {product === "retrieve" ? (
                <>
                  <Row label="Phone" value={phone} />
                  <Row label="DOB" value={dob || "—"} />
                  <Row label="Tracking ID" value={trackingId || "—"} />
                </>
              ) : (
                <>
                  <Row label="NIN" value={nin} />
                  <Row label="Phone" value={slipPhone} />
                </>
              )}
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => setStep("pay")}>
                Proceed to payment
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "pay" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Payment</h2>
              <p className="mt-1 text-xs text-muted-foreground">Demo only — wallet will not be debited.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount due</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">{formatNaira(price, false)}</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
                When live: charged only after a successful lookup or slip generation.
              </div>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" disabled={paying} onClick={() => void demoPay()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing demo…
                  </>
                ) : (
                  `Pay ${formatNaira(price, false)} (demo)`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "success" ? (
          <section className="space-y-5 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                {product === "retrieve" ? "NIN retrieved (demo)" : "Slip ready (demo)"}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {product === "retrieve"
                  ? "Demo result only — not from NIMC. When live, the real NIN will show after payment."
                  : "Demo slip placeholder. When live, you can download or share a proper PDF slip."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card">
              <Row label="Reference" value={refId} />
              <Row label="Service" value={product === "retrieve" ? "Retrieve NIN" : "Print NIN Slip"} />
              <Row label="NIN (demo)" value={demoNin} />
              <Row label="Amount" value={formatNaira(price, false)} />
              <Row label="Status" value="Demo · Awaiting connection" />
            </div>

            {product === "slip" ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-left">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <CreditCard className="size-4 text-primary" />
                  NIN slip preview
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Name: DEMO USER · NIN: {demoNin} · This is not an official document.
                </p>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(product === "retrieve" ? demoNin : refId);
                    toast.success("Copied");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
              >
                <Copy className="mr-1.5 size-4" />
                {product === "retrieve" ? "Copy NIN" : "Copy ref"}
              </Button>
              <Button className="h-11 flex-1 rounded-xl font-bold" asChild>
                <Link to="/home">
                  <Home className="mr-1.5 size-4" />
                  Home
                </Link>
              </Button>
            </div>

            <Button
              variant="ghost"
              className="h-10 w-full rounded-xl text-xs font-semibold"
              onClick={() => {
                setStep("choose");
                setProduct(null);
                setRefId("");
                setDemoNin("");
              }}
            >
              Another NIN service
            </Button>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
