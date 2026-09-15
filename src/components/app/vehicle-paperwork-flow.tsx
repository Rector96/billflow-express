/**
 * Vehicle renewals — simple 3-step flow for everyday car owners
 * 1 Lookup → 2 Choose renewal + pay → 3 Success (PDF or dispatch tracker)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
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
  /** Active = papers still valid; Expired = needs renewal */
  papersStatus: "active" | "expired";
};

function simulateVehicleRegistry(plate: string, state: string): VehicleLookup {
  const clean = plate.replace(/\s+/g, "").toUpperCase();
  const seed = [...clean].reduce((a, c) => a + c.charCodeAt(0), 0);
  const makes = ["Toyota Corolla", "Honda Accord", "Lexus RX 350", "Mercedes C300", "Kia Rio"];
  const colors = ["Silver", "Black", "White", "Grey", "Blue"];
  return {
    plate: clean,
    state,
    makeModel: makes[seed % makes.length]!,
    color: colors[seed % colors.length]!,
    papersStatus: seed % 2 === 0 ? "active" : "expired",
  };
}

function feeFor(choice: RenewalChoice): number {
  return choice === "license_sticker"
    ? SERVICE_PRICES.vehicle_license_sticker
    : SERVICE_PRICES.vehicle_third_party_insurance;
}

function trackingRef(plate: string): string {
  return `VR-${Date.now().toString(36).toUpperCase()}-${plate.replace(/\W/g, "").slice(0, 6)}`;
}

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
                  "my-1 w-0.5 flex-1 min-h-4 rounded-full",
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
            {item.state === "active" ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">Usually 1–2 working days</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function VehiclePaperworkFlow() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("lookup");
  const [plate, setPlate] = useState("");
  const [state, setState] = useState<string>("Lagos");
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleLookup | null>(null);
  const [choice, setChoice] = useState<RenewalChoice | null>(null);
  const [paying, setPaying] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [trackId, setTrackId] = useState("");

  const fee = choice ? feeFor(choice) : 0;

  const stepIndex = useMemo(() => {
    if (step === "lookup") return 0;
    if (step === "renew") return 1;
    return 2;
  }, [step]);

  const onLookup = async () => {
    const p = plate.replace(/\s+/g, "").trim();
    if (p.length < 5) {
      toast.error("Please enter your plate number (e.g. ABC-123XY).");
      return;
    }
    if (!state) {
      toast.error("Select the state where the car is registered.");
      return;
    }
    setLookingUp(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setVehicle(simulateVehicleRegistry(plate, state));
      setChoice(null);
      setStep("renew");
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
      const paystack = await simulatePaystackInline({
        email: "customer@rockpay.app",
        amountNaira: fee,
        metadata: {
          service: choice,
          plate: vehicle.plate,
          state: vehicle.state,
        },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");
      setPayRef(paystack.reference);
      setTrackId(trackingRef(vehicle.plate));
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
      "RockPay — Motor 3rd-Party Insurance (Demo Certificate)",
      "=====================================================",
      `Reference: ${trackId}`,
      `Payment: ${payRef}`,
      `Plate: ${vehicle.plate}`,
      `Vehicle: ${vehicle.makeModel}`,
      `State: ${vehicle.state}`,
      `Cover: Third-party only`,
      `Issued: ${new Date().toLocaleDateString("en-NG")}`,
      "",
      "This is a demo document for UI testing. Live certificates come from your insurer partner.",
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

  /* ─── STEP 3: Success ─── */
  if (step === "done" && vehicle && choice) {
    const isInsurance = choice === "third_party_insurance";
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold tracking-tight leading-snug">
              Payment confirmed! Your renewal is processing.
            </h1>
            <p className="text-sm text-muted-foreground">
              {vehicle.plate} · {vehicle.makeModel}
            </p>
          </div>

          {isInsurance ? (
            <div className="w-full space-y-3">
              <p className="text-sm text-muted-foreground">
                Your third-party cover is ready. Save the document on your phone.
              </p>
              <Button
                className="h-14 w-full rounded-2xl text-base font-bold"
                onClick={downloadInsurancePdf}
              >
                <FileDown className="mr-2 size-5" />
                Download official insurance PDF
              </Button>
            </div>
          ) : (
            <div className="w-full space-y-3 text-left">
              <p className="text-center text-sm text-muted-foreground">
                Your license sticker is being prepared. Track progress below.
              </p>
              <DeliveryTracker />
            </div>
          )}

          <p className="font-mono text-[10px] text-muted-foreground">Ref · {trackId}</p>

          <div className="mt-2 w-full space-y-2">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
              <Home className="mr-2 size-4" /> Back to home
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => {
                setStep("lookup");
                setVehicle(null);
                setChoice(null);
                setPayRef("");
                setTrackId("");
              }}
            >
              Check another vehicle
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle renewal" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />

        {/* ─── STEP 1: Lookup ─── */}
        {step === "lookup" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Car className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Verify your vehicle</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Enter your plate number to check your official record instantly.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plate">Plate number</Label>
                  <Input
                    id="plate"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC-123XY"
                    className="h-12 rounded-2xl font-mono uppercase"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vstate">Registration state</Label>
                  <select
                    id="vstate"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="flex h-12 w-full rounded-2xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        {/* ─── STEP 2: Preview + choice + pay ─── */}
        {step === "renew" && vehicle ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">We found your vehicle details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm the car, then pick what you want to renew.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="text-base font-extrabold">{vehicle.makeModel}</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{vehicle.plate}</p>
                  <p className="text-xs text-muted-foreground">
                    {vehicle.color} · {vehicle.state}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                    vehicle.papersStatus === "expired"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-success-soft text-success",
                  )}
                >
                  {vehicle.papersStatus === "expired" ? "Expired" : "Active"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What do you want to renew?
              </p>

              <button
                type="button"
                onClick={() => setChoice("license_sticker")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                  choice === "license_sticker"
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border/70 bg-card hover:border-primary/40",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sticker className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Renew vehicle license sticker</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Physical sticker printed and sent to you
                  </p>
                  <p className="mt-1 text-sm font-extrabold tabular-nums">
                    {formatNaira(SERVICE_PRICES.vehicle_license_sticker, false)}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 size-5 shrink-0 rounded-full border-2",
                    choice === "license_sticker" ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )}
                />
              </button>

              <button
                type="button"
                onClick={() => setChoice("third_party_insurance")}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                  choice === "third_party_insurance"
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border/70 bg-card hover:border-primary/40",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Renew 3rd-party insurance</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Digital certificate you can download after payment
                  </p>
                  <p className="mt-1 text-sm font-extrabold tabular-nums">
                    {formatNaira(SERVICE_PRICES.vehicle_third_party_insurance, false)}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 size-5 shrink-0 rounded-full border-2",
                    choice === "third_party_insurance"
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40",
                  )}
                />
              </button>
            </div>

            {choice ? (
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Payment summary
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {choice === "license_sticker" ? "License sticker" : "3rd-party insurance"}
                  </span>
                  <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-base">
                  <span className="font-extrabold">Total</span>
                  <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
                </div>
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
              <Button
                variant="ghost"
                className="mt-2 w-full text-xs font-bold"
                disabled={paying}
                onClick={() => {
                  setStep("lookup");
                  setVehicle(null);
                  setChoice(null);
                }}
              >
                Change plate number
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
