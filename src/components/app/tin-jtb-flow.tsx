/**
 * JTB TIN — fee from route loader (pricing_rules.tin)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, FileDown, Hash, Home, Loader2, ShieldCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Step = "input" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "input", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Result" },
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
    if (identifier.replace(/\s/g, "").trim().length < 7) {
      toast.error("Enter your 11-digit NIN or CAC number.");
      return false;
    }
    if (fullName.trim().length < 3) {
      toast.error("Enter the full name on the record.");
      return false;
    }
    return true;
  };

  const onPayNow = async () => {
    if (!validate()) return;
    if (!authed) {
      toast.error("Please log in to continue.");
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
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold">Your TIN is ready</h1>
          <p className="font-mono text-2xl font-extrabold">{result.data.tin}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void navigator.clipboard.writeText(result.data.tin)}
            >
              <Copy className="mr-1.5 size-3.5" /> Copy
            </Button>
          </div>
          <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
            <Home className="mr-2 size-4" /> Home
          </Button>
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
            <h2 className="text-lg font-extrabold">Find your TIN</h2>
            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
              <div className="space-y-1.5">
                <Label>NIN or CAC number</Label>
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 rounded-2xl" />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-2xl font-bold"
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
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold">Preview & pay</h2>
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <p className="text-sm font-bold">{fullName}</p>
              <p className="font-mono text-xs">{identifier}</p>
              <p className={cn("mt-3 font-mono text-xl font-extrabold blur-[6px]")}>{blurredTin}</p>
              <div className="mt-4 flex justify-between text-base font-extrabold">
                <span>Total</span>
                <span className="tabular-nums">{formatNaira(fee, false)}</span>
              </div>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPayNow()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Opening Paystack…
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
