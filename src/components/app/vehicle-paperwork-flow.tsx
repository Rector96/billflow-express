/**
 * Vehicle Paperwork & Renewals — multi-step wizard
 * Plate + state → simulated registry pre-fetch → Pay Now → success receipt
 * Price from SERVICE_PRICES.vehicle_renewal (admin-overridable later)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Car,
  CheckCircle2,
  Copy,
  FileDown,
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
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STEPS: PayStepMeta[] = [
  { key: "input", label: "Plate" },
  { key: "preview", label: "Verify" },
  { key: "success", label: "Done" },
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

type Step = "input" | "preview" | "success";

type VehicleLookup = {
  plate: string;
  state: string;
  makeModel: string;
  chassisMasked: string;
  chassisFull: string;
  color: string;
  expiryStatus: "valid" | "expiring_soon" | "expired";
  expiryLabel: string;
};

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
      <span className="font-bold">Registry lookup simulated.</span> Paystack test path only. Wire Dojah
      vehicle nodes when credentials are ready.
    </div>
  );
}

/** Deterministic demo lookup from plate + state (stands in for Dojah Vehicle Registry). */
function simulateVehicleRegistry(plate: string, state: string): VehicleLookup {
  const clean = plate.replace(/\s+/g, "").toUpperCase();
  const seed = [...clean].reduce((a, c) => a + c.charCodeAt(0), 0);
  const makes = ["Toyota Corolla", "Honda Accord", "Lexus RX 350", "Mercedes C300", "Kia Rio"];
  const colors = ["Silver", "Black", "White", "Grey", "Blue"];
  const statusRoll = seed % 3;
  const expiryStatus: VehicleLookup["expiryStatus"] =
    statusRoll === 0 ? "valid" : statusRoll === 1 ? "expiring_soon" : "expired";
  const expiryLabel =
    expiryStatus === "valid"
      ? "Valid — renews in 8 months"
      : expiryStatus === "expiring_soon"
        ? "Expiring soon — within 45 days"
        : "Expired — renewal required";
  const chassisCore = `${(seed % 900) + 100}XYZ${(seed % 9000) + 1000}`;
  return {
    plate: clean,
    state,
    makeModel: makes[seed % makes.length]!,
    chassisMasked: `••••••••${chassisCore.slice(-4)}`,
    chassisFull: `JTD${chassisCore}KN`,
    color: colors[seed % colors.length]!,
    expiryStatus,
    expiryLabel,
  };
}

function trackingRef(plate: string): string {
  return `VR-${Date.now().toString(36).toUpperCase()}-${plate.replace(/\W/g, "").slice(0, 6)}`;
}

export function VehiclePaperworkFlow() {
  const navigate = useNavigate();
  const fee = SERVICE_PRICES.vehicle_renewal;

  const [step, setStep] = useState<Step>("input");
  const [plate, setPlate] = useState("");
  const [state, setState] = useState<string>("Lagos");
  const [lookingUp, setLookingUp] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleLookup | null>(null);
  const [paying, setPaying] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [trackId, setTrackId] = useState("");

  const stepIndex = useMemo(() => {
    if (step === "input") return 0;
    if (step === "preview") return 1;
    return 2;
  }, [step]);

  const validateInput = () => {
    const p = plate.replace(/\s+/g, "").trim();
    if (p.length < 5) {
      toast.error("Enter a valid license plate number.");
      return false;
    }
    if (!state) {
      toast.error("Select the state of registration.");
      return false;
    }
    return true;
  };

  const onContinueLookup = async () => {
    if (!validateInput()) return;
    setLookingUp(true);
    try {
      await new Promise((r) => setTimeout(r, 900));
      const data = simulateVehicleRegistry(plate, state);
      setVehicle(data);
      setStep("preview");
    } finally {
      setLookingUp(false);
    }
  };

  const onPayNow = async () => {
    if (!vehicle) return;
    setPaying(true);
    try {
      const paystack = await simulatePaystackInline({
        email: "customer@rockpay.app",
        amountNaira: fee,
        metadata: { service: "vehicle_renewal", plate: vehicle.plate, state: vehicle.state },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");
      const tid = trackingRef(vehicle.plate);
      setPayRef(paystack.reference);
      setTrackId(tid);
      setStep("success");
      toast.success(`Paid · ${paystack.reference.slice(0, 12)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const copyTrack = async () => {
    if (!trackId) return;
    try {
      await navigator.clipboard.writeText(trackId);
      toast.success("Tracking reference copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadSheet = () => {
    if (!vehicle || !trackId) return;
    const body = [
      "RockPay — Vehicle Registration Sync Confirmation",
      "================================================",
      `Tracking: ${trackId}`,
      `Paystack: ${payRef}`,
      `Plate: ${vehicle.plate}`,
      `State: ${vehicle.state}`,
      `Make/Model: ${vehicle.makeModel}`,
      `Color: ${vehicle.color}`,
      `Chassis: ${vehicle.chassisFull}`,
      `Status: ${vehicle.expiryLabel}`,
      `Fee: ₦${fee}`,
      `Date: ${new Date().toISOString()}`,
      "",
      "Simulated registry sync — connect Dojah for production data.",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rockpay-vehicle-${trackId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Confirmation sheet downloaded");
  };

  if (step === "success" && vehicle) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Records synchronized</h1>
          <p className="max-w-sm text-sm font-medium text-foreground">
            Vehicle Registration Records Successfully Synchronized!
          </p>

          <div className="w-full rounded-2xl border border-border/70 bg-card p-5 text-left shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tracking reference
            </p>
            <p className="mt-2 break-all font-mono text-lg font-extrabold tracking-wide">{trackId}</p>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>
                Plate: <span className="font-semibold text-foreground">{vehicle.plate}</span>
              </p>
              <p>
                {vehicle.makeModel} · {vehicle.state}
              </p>
              <p className="font-mono text-[10px]">Paystack · {payRef}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void copyTrack()}>
                <Copy className="mr-1.5 size-3.5" /> Copy reference
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={downloadSheet}>
                <FileDown className="mr-1.5 size-3.5" /> Download sheet
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
                setVehicle(null);
                setPayRef("");
                setTrackId("");
              }}
            >
              Look up another vehicle
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle papers" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <DemoBanner />
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "input" ? (
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Car className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">License plate</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Enter plate number and registration state to pre-fetch records.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="space-y-1.5">
                <Label htmlFor="plate">License plate number</Label>
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
                <Label htmlFor="vstate">State of registration</Label>
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

            <HelpNote>
              Next step simulates a Dojah-style vehicle registry lookup. Production will call your
              compliance provider with the same fields.
            </HelpNote>

            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={lookingUp} onClick={() => void onContinueLookup()}>
                {lookingUp ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Looking up…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "preview" && vehicle ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Confirm vehicle</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Review registry preview, then pay the renewal / sync fee.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" /> Registry match
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Plate · State</p>
              <p className="font-mono text-sm font-bold">
                {vehicle.plate} · {vehicle.state}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Make / model</p>
              <p className="text-sm font-bold">{vehicle.makeModel}</p>
              <p className="mt-3 text-xs text-muted-foreground">Chassis number</p>
              <p className={cn("mt-1 select-none font-mono text-base font-extrabold tracking-wide blur-[5px]")}>
                {vehicle.chassisFull}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{vehicle.chassisMasked}</p>
              <p className="mt-3 text-xs text-muted-foreground">Expiration</p>
              <p
                className={cn(
                  "text-sm font-bold",
                  vehicle.expiryStatus === "valid" && "text-success",
                  vehicle.expiryStatus === "expiring_soon" && "text-warning",
                  vehicle.expiryStatus === "expired" && "text-destructive",
                )}
              >
                {vehicle.expiryLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Payment summary
              </p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Vehicle paperwork / renewal</span>
                <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Price key: <code className="font-mono">vehicle_renewal</code> · {" "}
                from SERVICE_PRICES (admin override later)
              </p>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(fee, false)}</span>
              </div>
            </div>

            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPayNow()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Paystack (test)…
                  </>
                ) : (
                  <>Pay Now · {formatNaira(fee, false)}</>
                )}
              </Button>
              <Button
                variant="ghost"
                className="mt-2 w-full text-xs font-bold"
                disabled={paying}
                onClick={() => {
                  setStep("input");
                  setVehicle(null);
                }}
              >
                Edit plate
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
