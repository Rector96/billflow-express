/**
 * Vehicle renewals — compact mobile steps; prices from pricing_rules
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCircle2, Circle, FileDown, Home, Loader2, Shield, Sticker } from "lucide-react";
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
import { completeVehicleRenewal, verifyVehicle } from "@/lib/hub.functions";
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STEPS: PayStepMeta[] = [
  { key: "lookup", label: "Find" },
  { key: "renew", label: "Renew" },
  { key: "done", label: "Done" },
];

const NG_STATES = [
  "Lagos",
  "Abuja (FCT)",
  "Rivers",
  "Kano",
  "Oyo",
  "Ogun",
  "Kaduna",
  "Delta",
  "Anambra",
  "Enugu",
  "Other",
] as const;

type Step = "lookup" | "renew" | "done";
type RenewalChoice = "license_sticker" | "third_party_insurance";

type VehicleLookup = {
  plate: string;
  state: string;
  makeModel: string;
  color: string;
  papersStatus: "active" | "expired";
};

function DeliveryTracker() {
  const items: { label: string; state: "done" | "active" | "todo" }[] = [
    { label: "Payment received", state: "done" },
    { label: "Printing", state: "active" },
    { label: "With rider", state: "todo" },
    { label: "Delivered", state: "todo" },
  ];
  return (
    <ol className="w-full space-y-0 rounded-2xl border border-border/70 bg-card p-3.5 text-left">
      {items.map((item, i) => (
        <li key={item.label} className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border",
                item.state === "done" && "border-success bg-success-soft text-success",
                item.state === "active" && "border-primary bg-primary/10 text-primary",
                item.state === "todo" && "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              {item.state === "done" ? (
                <Check className="size-3.5" strokeWidth={2.5} />
              ) : item.state === "active" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Circle className="size-3 opacity-50" />
              )}
            </span>
            {i < items.length - 1 ? (
              <span className={cn("my-0.5 min-h-3 w-0.5 flex-1 rounded-full", item.state === "done" ? "bg-success/40" : "bg-border")} />
            ) : null}
          </div>
          <p className={cn("pb-3 text-sm font-medium", item.state === "todo" && "text-muted-foreground", i === items.length - 1 && "pb-0")}>
            {item.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function VehiclePaperworkFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile, authed } = useApp();
  const runVerify = useServerFn(verifyVehicle);
  const runComplete = useServerFn(completeVehicleRenewal);

  const feeSticker = feeFromMap(fees, "vehicle_license_sticker");
  const feeInsurance = feeFromMap(fees, "vehicle_third_party_insurance");

  const [step, setStep] = useState<Step>("lookup");
  const [plate, setPlate] = useState("");
  const [state, setState] = useState("Lagos");
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleLookup | null>(null);
  const [choice, setChoice] = useState<RenewalChoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [trackId, setTrackId] = useState("");

  const fee =
    choice === "license_sticker" ? feeSticker : choice === "third_party_insurance" ? feeInsurance : 0;

  const stepIndex = useMemo(() => {
    if (step === "lookup") return 0;
    if (step === "renew") return 1;
    return 2;
  }, [step]);

  const onLookup = async () => {
    if (!authed) {
      toast.error("Please log in.");
      navigate({ to: "/login" });
      return;
    }
    const p = plate.replace(/\s+/g, "").trim();
    if (p.length < 5) {
      toast.error("Enter plate number.");
      return;
    }
    setLookingUp(true);
    try {
      const data = await runVerify({ data: { plate: p, state } });
      setVehicle({
        plate: data.plate,
        state: data.state,
        makeModel: data.makeModel,
        color: data.color,
        papersStatus: data.expiryStatus === "valid" ? "active" : "expired",
      });
      setChoice(null);
      setStep("renew");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vehicle not found.");
    } finally {
      setLookingUp(false);
    }
  };

  const onPay = async () => {
    if (!vehicle || !choice) {
      toast.error("Choose a renewal option.");
      return;
    }
    setPaying(true);
    try {
      const email = profile.email?.trim() || "customer@rockpay.app";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: fee,
        metadata: { service: choice, plate: vehicle.plate, state: vehicle.state },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");

      const done = await runComplete({
        data: {
          plate: vehicle.plate,
          state: vehicle.state,
          makeModel: vehicle.makeModel,
          choice,
          paymentReference: paystack.reference,
          amount: fee,
        },
      });

      setPayRef(done.paymentReference);
      setTrackId(done.trackingReference);
      setStep("done");
      toast.success("Payment confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  const downloadInsurancePdf = () => {
    if (!vehicle || !trackId) return;
    const body = [
      "RockPay — Motor 3rd-Party Insurance",
      `Reference: ${trackId}`,
      `Payment: ${payRef}`,
      `Plate: ${vehicle.plate}`,
      `Vehicle: ${vehicle.makeModel}`,
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rockpay-insurance-${vehicle.plate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File ready");
  };

  const field = "h-11 rounded-xl";

  if (step === "done" && vehicle && choice) {
    const isInsurance = choice === "third_party_insurance";
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center gap-3 px-4 py-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-lg font-bold">Payment confirmed</h1>
          <p className="text-xs text-muted-foreground">
            {vehicle.plate} · {vehicle.makeModel}
          </p>
          {isInsurance ? (
            <Button className="h-12 w-full max-w-xs rounded-xl font-semibold" onClick={downloadInsurancePdf}>
              <FileDown className="mr-2 size-4" /> Download insurance
            </Button>
          ) : (
            <DeliveryTracker />
          )}
          <p className="font-mono text-[10px] text-muted-foreground">{trackId}</p>
          <Button className="h-12 w-full max-w-xs rounded-xl font-semibold" onClick={() => navigate({ to: "/home" })}>
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle" backTo="/services" />
      <div className="mx-auto max-w-md space-y-3 px-4 pb-28 pt-1">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "lookup" ? (
          <section className="space-y-3">
            <div className="space-y-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft">
              <div className="space-y-1">
                <Label htmlFor="plate">Plate number</Label>
                <Input
                  id="plate"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC-123XY"
                  className={`${field} font-mono uppercase`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vstate">State</Label>
                <select
                  id="vstate"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                >
                  {NG_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-xl font-semibold" disabled={lookingUp} onClick={() => void onLookup()}>
                {lookingUp ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Checking…
                  </>
                ) : (
                  "Check vehicle"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "renew" && vehicle ? (
          <section className="space-y-2.5">
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{vehicle.makeModel}</p>
                  <p className="font-mono text-xs font-semibold">{vehicle.plate}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {vehicle.color} · {vehicle.state}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    vehicle.papersStatus === "expired"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-success-soft text-success",
                  )}
                >
                  {vehicle.papersStatus === "expired" ? "Expired" : "Active"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setChoice("license_sticker")}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left",
                choice === "license_sticker" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
              )}
            >
              <Sticker className="size-4.5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">License sticker</p>
                <p className="text-xs font-bold tabular-nums text-primary">{formatNaira(feeSticker, false)}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setChoice("third_party_insurance")}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left",
                choice === "third_party_insurance" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
              )}
            >
              <Shield className="size-4.5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">3rd-party insurance</p>
                <p className="text-xs font-bold tabular-nums text-primary">{formatNaira(feeInsurance, false)}</p>
              </div>
            </button>

            {choice ? (
              <div className="flex justify-between rounded-2xl border border-border/80 bg-card px-3.5 py-3 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatNaira(fee, false)}</span>
              </div>
            ) : null}

            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-xl font-semibold" disabled={!choice || paying} onClick={() => void onPay()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
                  </>
                ) : (
                  choice ? `Pay ${formatNaira(fee, false)}` : "Select option"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
