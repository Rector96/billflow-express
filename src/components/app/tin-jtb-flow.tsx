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
        <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center lg:max-w-lg lg:px-0">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success result-pop">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-lg font-bold lg:text-xl">Your TIN</h1>
          <p className="font-mono text-xl font-bold tracking-wide lg:text-2xl">{result.data.tin}</p>
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
            className="mt-2 h-11 w-full max-w-xs rounded-xl font-semibold lg:h-12"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  const field =
    "h-10 rounded-xl border-border/70 bg-card text-sm shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 sm:h-11";
  const card =
    "grid grid-cols-1 gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2.5";

  return (
    <AppShell>
      <PageHeader title="TIN" backTo="/services" />
      <div className="hub-flow-page mx-auto w-full max-w-md space-y-3 px-4 pb-24 pt-1 lg:max-w-2xl lg:space-y-3 lg:px-0 lg:pb-10 lg:pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />
        {step === "input" ? (
          <section className="space-y-3">
            <div className={card}>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">NIN or CAC number</Label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="11-digit NIN or CAC number"
                  className={field}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="As it appears on your ID"
                  className={field}
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-11 w-full rounded-xl font-semibold lg:h-12"
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
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft lg:mx-auto lg:max-w-lg">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Full name
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{fullName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Identifier
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold">{identifier}</p>
                </div>
              </div>
              <p className="mt-4 text-center font-mono text-lg font-bold blur-[5px]">
                {blurredTin}
              </p>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatNaira(fee, false)}</span>
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-11 w-full rounded-xl font-semibold lg:h-12"
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
