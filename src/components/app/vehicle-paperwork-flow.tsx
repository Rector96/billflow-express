/**
 * Vehicle renewals — prices from route loader (pricing_rules)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Car,
  Check,
  CheckCircle2,
  Circle,
  FileDown,
  Home,
  Loader2,
  Shield,
  Sticker,
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
import { completeVehicleRenewal, verifyVehicle } from "@/lib/hub.functions";
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STEPS: PayStepMeta[] = [
  { key: "lookup", label: "Find car" },
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
    { label: "Printing at Motor Licensing Office", state: "active" },
    { label: "Assigned to dispatch rider", state: "todo" },
    { label: "Delivered to your address", state: "todo" },
  ];
  return (
    <ol className="w-full space-y-0 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft">
      {items.map((item, i) => (
        <li key={item.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border",
                item.state === "done" && "border-success bg-success-soft text-success",
                item.state === "active" && "border-primary bg-primary/10 text-primary",
                item.state === "todo" && "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              {item.state === "done" ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : item.state === "active" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Circle className="size-3.5 opacity-50" />
              )}
            </span>
            {i < items.length - 1 ? (
              <span
                className={cn(
                  "my-1 min-h-4 w-0.5 flex-1 rounded-full",
                  item.state === "done" ? "bg-success/40" : "bg-border",
                )}
              />
            ) : null}
          </div>
          <div className={cn("pb-4", i === items.length - 1 && "pb-0")}>
            <p
              className={cn(
                "text-sm font-semibold leading-snug",
                item.state === "todo" && "text-muted-foreground",
              )}
            >
              {item.label}
            </p>
          </div>
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
    choice === "license_sticker"
      ? feeSticker
      : choice === "third_party_insurance"
        ? feeInsurance
        : 0;

  const stepIndex = useMemo(() => {
    if (step === "lookup") return 0;
    if (step === "renew") return 1;
    return 2;
  }, [step]);

  const onLookup = async () => {
    if (!authed) {
      toast.error("Please log in to check your vehicle.");
      navigate({ to: "/login" });
      return;
    }
    const p = plate.replace(/\s+/g, "").trim();
    if (p.length < 5) {
      toast.error("Please enter your plate number (e.g. ABC-123XY).");
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
      toast.error(e instanceof Error ? e.message : "Could not find this vehicle. Try again.");
    } finally {
      setLookingUp(false);
    }
  };

  const onPay = async () => {
    if (!vehicle || !choice) {
      toast.error("Choose what you want to renew first.");
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
      toast.error(e instanceof Error ? e.message : "Payment could not be completed. Try again.");
    } finally {
      setPaying(false);
    }
  };

  const downloadInsurancePdf = () => {
    if (!vehicle || !trackId) return;
    const body = [
      "RockPay — Motor 3rd-Party Insurance Certificate",
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
    toast.success("Insurance file ready");
  };

  if (step === "done" && vehicle && choice) {
    const isInsurance = choice === "third_party_insurance";
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold leading-snug tracking-tight">
            Payment confirmed! Your renewal is processing.
          </h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.plate} · {vehicle.makeModel}
          </p>
          {isInsurance ? (
            <Button
              className="h-14 w-full rounded-2xl text-base font-bold"
              onClick={downloadInsurancePdf}
            >
              <FileDown className="mr-2 size-5" /> Download official insurance PDF
            </Button>
          ) : (
            <DeliveryTracker />
          )}
          <p className="font-mono text-[10px] text-muted-foreground">Ref · {trackId}</p>
          <Button
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" /> Back to home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle renewal" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "lookup" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-extrabold tracking-tight">Verify your vehicle</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your plate number to check your official record instantly.
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plate">Plate number</Label>
                  <Input
                    id="plate"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC-123XY"
                    className="h-12 rounded-2xl font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vstate">Registration state</Label>
                  <select
                    id="vstate"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="flex h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm"
                  >
                    {NG_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                disabled={lookingUp}
                onClick={() => void onLookup()}
              >
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
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold tracking-tight">We found your vehicle details</h2>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold">{vehicle.makeModel}</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{vehicle.plate}</p>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.color} · {vehicle.state}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
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
                "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left",
                choice === "license_sticker"
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-card",
              )}
            >
              <Sticker className="mt-0.5 size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-bold">Renew vehicle license sticker</p>
                <p className="mt-1 text-sm font-extrabold tabular-nums">
                  {formatNaira(feeSticker, false)}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setChoice("third_party_insurance")}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left",
                choice === "third_party_insurance"
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-card",
              )}
            >
              <Shield className="mt-0.5 size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-bold">Renew 3rd-party insurance</p>
                <p className="mt-1 text-sm font-extrabold tabular-nums">
                  {formatNaira(feeInsurance, false)}
                </p>
              </div>
            </button>

            {choice ? (
              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-4">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
              </div>
            ) : null}

            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                disabled={!choice || paying}
                onClick={() => void onPay()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Opening Paystack…
                  </>
                ) : (
                  "Proceed to secure Paystack payment"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
