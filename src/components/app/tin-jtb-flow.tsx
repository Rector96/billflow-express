/**
 * JTB TIN — compact mobile steps; fee from pricing_rules.tin
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Home, Loader2 } from "lucide-react";
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
    if (identifier.replace(/\s/g, "").trim().length < 7) {
      toast.error("Enter NIN (11 digits) or CAC number.");
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
      <div className="mx-auto max-w-md space-y-3 px-4 pb-28 pt-1">
        <PayStepper steps={STEPS} current={stepIndex} />
        {step === "input" ? (
          <section className="space-y-3">
            <div className={card}>
              <div className="space-y-1">
                <Label>NIN or CAC number</Label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={field}
                />
              </div>
            </div>
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
              <p className="text-sm font-semibold">{fullName}</p>
              <p className="font-mono text-xs text-muted-foreground">{identifier}</p>
              <p className="mt-3 font-mono text-lg font-bold blur-[5px]">{blurredTin}</p>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatNaira(fee, false)}</span>
              </div>
            </div>
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
