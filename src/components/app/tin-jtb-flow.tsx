/**
 * JTB TIN — compact mobile steps; fee from pricing_rules.tin
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Home, Loader2, ShieldCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-store";
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import { recoverTin } from "@/lib/hub.functions";
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import type { RecoverTinSuccess } from "@/lib/hub-api.types";
import { formatNaira } from "@/lib/mock-data";

type Step = "input" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "input", label: "Details" },
  { key: "preview", label: "Pay" },
  { key: "result", label: "Result" },
];

export function TinJtbFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile, authed } = useApp();
  const runRecover = useServerFn(recoverTin);
  const fee = feeFromMap(fees, "tin");

  const [step, setStep] = useState<Step>("input");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<RecoverTinSuccess | null>(null);

  const stepIndex = useMemo(() => (step === "input" ? 0 : step === "preview" ? 1 : 2), [step]);
  const blurredTin = useMemo(() => {
    const d = identifier.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
    return `${d.slice(0, 4)}••••-••`;
  }, [identifier]);

  const validate = () => {
    const normalized = identifier.replace(/\s/g, "").trim().toUpperCase();
    const validNin = /^\d{11}$/.test(normalized);
    const validCac = /^(RC|BN|IT)\d{5,8}$/.test(normalized) || /^\d{7,8}$/.test(normalized);
    if (!validNin && !validCac) {
      toast.error("Enter an 11-digit NIN or a valid CAC registration number.");
      return false;
    }
    if (fullName.trim().length < 3) {
      toast.error("Enter full name.");
      return false;
    }
    return true;
  };

  const onPayNow = async () => {
    if (!validate()) return;
    if (!authed) {
      toast.error("Please log in.");
      navigate({ to: "/login" });
      return;
    }
    setPaying(true);
    try {
      const email = profile.email?.trim() || "customer@rockpay.app";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: fee,
        metadata: { service: "tin", identifier: identifier.trim() },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");

      const digits = identifier.replace(/\D/g, "");
      const json = await runRecover({
        data: {
          identifier: identifier.replace(/\s/g, "").trim(),
          identifierType: digits.length === 11 ? "nin" : "cac",
          fullName: fullName.trim(),
          paymentReference: paystack.reference,
          amount: fee,
        },
      });
      setResult(json);
      setStep("success");
      toast.success("TIN retrieved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete TIN retrieval.");
    } finally {
      setPaying(false);
    }
  };

  if (step === "success" && result) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-lg font-bold">Your TIN</h1>
          <p className="font-mono text-xl font-bold tracking-wide">{result.data.tin}</p>
          <Button
            variant="outline"
            className="h-9 rounded-xl text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(result.data.tin);
              toast.success("Copied");
            }}
          >
            <Copy className="mr-1.5 size-3.5" /> Copy
          </Button>
          <Button
            className="mt-2 h-12 w-full max-w-xs rounded-xl font-semibold"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  const field = "h-11 rounded-xl";
  const card = "space-y-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft";

  return (
    <AppShell>
      <PageHeader title="TIN" backTo="/services" />
      <div className="tin-workflow mx-auto w-full max-w-5xl space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />
        {step === "input" ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-start">
            <div className="form-section-card space-y-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Search className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight">
                    Find your Tax Identification Number
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Enter the identity details used when your TIN was registered. Check them
                    carefully before continuing.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tin-identifier">NIN or CAC number</Label>
                  <Input
                    id="tin-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                    className={field}
                    placeholder="e.g. 12345678901 or RC123456"
                    autoComplete="off"
                  />
                  <p className="form-field-hint">
                    Use the NIN or registered CAC number linked to the tax record.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tin-full-name">Full registered name</Label>
                  <Input
                    id="tin-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={field}
                    placeholder="Enter name as registered"
                    autoComplete="name"
                  />
                  <p className="form-field-hint">
                    Enter the name exactly as it appears on the registration record.
                  </p>
                </div>
              </div>
            </div>
            <aside className="tin-id-preview rounded-[26px] border border-border/70 bg-[#eef3fa] p-4 lg:sticky lg:top-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Identity preview</p>
                  <p className="mt-1 text-sm font-semibold">Your verification details</p>
                </div>
                <ShieldCheck className="size-5 text-primary" />
              </div>
              <div className="relative mt-4 min-h-[230px] overflow-hidden rounded-[20px] border border-white/70 bg-gradient-to-br from-[#172b42] via-[#243e58] to-[#101d30] p-4 text-white shadow-lg">
                <div className="absolute -right-12 -top-12 size-44 rounded-full border border-white/10" />
                <div className="absolute -right-5 -top-5 size-28 rounded-full border border-white/10" />
                <div className="relative flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/65">RockPay • Secure ID</span>
                  <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[9px] text-emerald-200">Preview</span>
                </div>
                <div className="relative mt-7 grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/10">
                  <ShieldCheck className="size-7 text-white/75" />
                </div>
                <p className="relative mt-5 text-[9px] uppercase tracking-[0.16em] text-white/55">Registered name</p>
                <p className="relative mt-1 truncate text-base font-semibold">{fullName.trim() || "Your full name"}</p>
                <p className="relative mt-4 text-[9px] uppercase tracking-[0.16em] text-white/55">Identity number</p>
                <p className="relative mt-1 font-mono text-sm tracking-[0.14em]">{identifier.trim() ? identifier.replace(/.(?=.{4})/g, "•") : "•••• •••• ••••"}</p>
              </div>
              <div className="mt-4 rounded-xl bg-white/75 p-3">
                <p className="text-xs font-semibold">Before submitting</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Make sure your name and identity number match the official record. We use these details to retrieve the correct TIN.</p>
              </div>
            </aside>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (validate()) setStep("preview");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}
        {step === "preview" ? (
          <section className="space-y-3">
            <div className={card}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Confirm your details
              </p>
              <p className="text-sm font-semibold">{fullName}</p>
              <p className="font-mono text-xs text-muted-foreground">{identifier}</p>
              <p className="mt-3 font-mono text-lg font-bold blur-[5px]">{blurredTin}</p>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatNaira(fee, false)}</span>
              </div>
            </div>
            <aside className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="size-4 text-primary" /> Payment summary
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Your request will be submitted after payment is confirmed. Make sure the details are
                correct.
              </p>
            </aside>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                disabled={paying}
                onClick={() => void onPayNow()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
                  </>
                ) : (
                  `Pay ${formatNaira(fee, false)}`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
