/**
 * JTB TIN Retrieval — live server path when logged in
 * Paystack → recoverTin (verify + Dojah/fallback) → hub_orders
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Copy,
  FileDown,
  Hash,
  Home,
  Info,
  Loader2,
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
import { useApp } from "@/lib/app-store";
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import { getHubServiceFee, recoverTin } from "@/lib/hub.functions";
import type { RecoverTinSuccess } from "@/lib/hub-api.types";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Step = "input" | "preview" | "success";
type TinFormState = { identifier: string; fullName: string };

const STEPS: PayStepMeta[] = [
  { key: "input", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Result" },
];

function HelpNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

export function TinJtbFlow() {
  const navigate = useNavigate();
  const { profile, authed } = useApp();
  const runRecover = useServerFn(recoverTin);
  const runFee = useServerFn(getHubServiceFee);

  const [step, setStep] = useState<Step>("input");
  const [form, setForm] = useState<TinFormState>({ identifier: "", fullName: "" });
  const [paying, setPaying] = useState(false);
  const [payPhase, setPayPhase] = useState<"idle" | "paystack" | "api">("idle");
  const [result, setResult] = useState<RecoverTinSuccess | null>(null);
  const [fee, setFee] = useState(SERVICE_PRICES.tin_retrieve);

  useMemo(() => {
    void runFee({ data: { serviceSlug: "tin" } })
      .then((r) => {
        if (r.fee > 0) setFee(r.fee);
      })
      .catch(() => undefined);
  }, [runFee]);

  const stepIndex = useMemo(() => {
    if (step === "input") return 0;
    if (step === "preview") return 1;
    return 2;
  }, [step]);

  const blurredTin = useMemo(() => {
    const d = form.identifier.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
    return `${d.slice(0, 4)}••••-••`;
  }, [form.identifier]);

  const setField = <K extends keyof TinFormState>(key: K, value: TinFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateInput = () => {
    const id = form.identifier.replace(/\s/g, "").trim();
    if (id.length < 7) {
      toast.error("Enter your 11-digit NIN or CAC business number.");
      return false;
    }
    if (form.fullName.trim().length < 3) {
      toast.error("Enter the full name on the record.");
      return false;
    }
    return true;
  };

  const onPayNow = async () => {
    if (!validateInput()) return;
    if (!authed) {
      toast.error("Please log in to continue.");
      navigate({ to: "/login" });
      return;
    }
    setPaying(true);
    setPayPhase("paystack");
    try {
      const email = profile.email?.trim() || "customer@rockpay.app";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: fee,
        metadata: { service: "tin", identifier: form.identifier.trim() },
      });
      if (paystack.status !== "success" || !paystack.reference) {
        throw new Error("Payment was not completed.");
      }

      setPayPhase("api");
      const digits = form.identifier.replace(/\D/g, "");
      const identifierType = digits.length === 11 ? "nin" : "cac";

      const json = await runRecover({
        data: {
          identifier: form.identifier.replace(/\s/g, "").trim(),
          identifierType,
          fullName: form.fullName.trim(),
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
      setPayPhase("idle");
    }
  };

  const copyTin = async () => {
    const tin = result?.data.tin;
    if (!tin) return;
    try {
      await navigator.clipboard.writeText(tin);
      toast.success("TIN copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadReceipt = () => {
    if (!result) return;
    const body = [
      "RockPay — TIN Retrieval Receipt",
      "--------------------------------",
      `Taxpayer: ${result.data.taxpayerName}`,
      `TIN: ${result.data.tin}`,
      `Type: ${result.data.taxpayerType}`,
      `Paystack ref: ${result.meta.paymentReference}`,
      `Request ID: ${result.meta.requestId}`,
      `Fee: ₦${result.meta.fee}`,
      `Date: ${new Date().toISOString()}`,
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rockpay-tin-${result.meta.requestId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  if (step === "success" && result) {
    const { data, meta } = result;
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Your TIN is ready</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Retrieved for <span className="font-semibold text-foreground">{data.taxpayerName}</span>
          </p>
          <div className="w-full rounded-2xl border border-border/70 bg-card p-5 text-left shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tax Identification Number
            </p>
            <p className="mt-2 break-all font-mono text-2xl font-extrabold tracking-wide tabular-nums">
              {data.tin}
            </p>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <p>
                Type:{" "}
                <span className="font-semibold text-foreground">
                  {data.taxpayerType === "business" ? "Business" : "Individual"}
                </span>
              </p>
              <p className="font-mono text-[10px]">Paystack · {meta.paymentReference}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void copyTin()}>
                <Copy className="mr-1.5 size-3.5" /> Copy TIN
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={downloadReceipt}>
                <FileDown className="mr-1.5 size-3.5" /> Download receipt
              </Button>
            </div>
          </div>
          <div className="mt-2 w-full space-y-2">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
              <Home className="mr-2 size-4" /> Home
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => {
                setStep("input");
                setResult(null);
              }}
            >
              Look up another
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="TIN Retrieval" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "input" ? (
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Hash className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Find your TIN</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  NIN or CAC number plus the full name on the tax record.
                </p>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="space-y-1.5">
                <Label htmlFor="tin-id">NIN or CAC number</Label>
                <Input
                  id="tin-id"
                  inputMode="numeric"
                  value={form.identifier}
                  onChange={(e) => setField("identifier", e.target.value)}
                  placeholder="11-digit NIN or RC / BN number"
                  className="h-12 rounded-2xl"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tin-name">Full name</Label>
                <Input
                  id="tin-name"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  placeholder="Name on the tax / CAC record"
                  className="h-12 rounded-2xl"
                />
              </div>
            </div>
            <HelpNote>
              After Paystack confirms payment, we look up the TIN on the server and save the order in
              your account history.
            </HelpNote>
            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                onClick={() => {
                  if (!validateInput()) return;
                  setStep("preview");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "preview" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Preview & pay</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay with Paystack, then we fetch the TIN securely.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" /> Ready to retrieve
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-bold">{form.fullName.trim()}</p>
              <p className="mt-3 text-xs text-muted-foreground">Lookup ID</p>
              <p className="font-mono text-xs font-semibold">{form.identifier.trim()}</p>
              <p className="mt-3 text-xs text-muted-foreground">TIN (after payment)</p>
              <p className={cn("mt-1 select-none font-mono text-xl font-extrabold tracking-wide blur-[6px]")}>
                {blurredTin}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
              </div>
            </div>
            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPayNow()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />{" "}
                    {payPhase === "api" ? "Fetching TIN…" : "Opening Paystack…"}
                  </>
                ) : (
                  "Pay now"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
