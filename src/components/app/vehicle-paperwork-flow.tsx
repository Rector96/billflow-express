// @ts-nocheck -- generated DB types are out of date with the live schema; re-enable after regenerating types.
/**
 * Vehicle renewals — writes hub_orders via completeVehicleRenewal (staff queue).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Car, FileText, Home, Loader2, Shield } from "lucide-react";
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

type Step = "lookup" | "result" | "renew" | "done";
type RenewalChoice = "license_sticker" | "third_party_insurance";

type VehicleInfo = {
  plate: string;
  state: string;
  makeModel: string;
  color?: string;
  chassisNumber?: string;
  expiryStatus?: string;
};

const STEPS: PayStepMeta[] = [
  { key: "lookup", label: "Lookup" },
  { key: "result", label: "Vehicle" },
  { key: "renew", label: "Renew" },
  { key: "pay", label: "Pay" },
];

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
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
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
    if (step === "result") return 1;
    if (step === "renew") return 2;
    return 3;
  }, [step]);

  const onLookup = async () => {
    const cleaned = plate.replace(/\s+/g, "").toUpperCase();
    if (cleaned.length < 5) {
      toast.error("Enter a valid plate number.");
      return;
    }
    if (!authed) {
      toast.error("Please log in to continue.");
      navigate({ to: "/login" });
      return;
    }
    setLookingUp(true);
    try {
      const info = await runVerify({ data: { plate: cleaned, state } });
      setVehicle({
        plate: info.plate || cleaned,
        state: info.state || state,
        makeModel: info.makeModel || "Vehicle",
        color: info.color,
        chassisNumber: info.chassisNumber,
        expiryStatus: info.expiryStatus,
      });
      setStep("result");
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
      const serviceSlug =
        choice === "third_party_insurance"
          ? "vehicle_third_party_insurance"
          : "vehicle_license_sticker";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: fee,
        metadata: {
          channel: "hub",
          service: serviceSlug,
          service_type: serviceSlug,
          choice,
          plate: vehicle.plate,
          state: vehicle.state,
        },
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
      toast.success("Order saved for staff");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setPaying(false);
    }
  };

  const field =
    "h-10 rounded-xl border-border/70 bg-card text-sm shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 sm:h-11";

  if (step === "done" && vehicle && choice) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center lg:max-w-lg lg:px-0">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success result-pop">
            <Car className="size-7" />
          </span>
          <h1 className="text-lg font-bold lg:text-xl">Order received</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {choice === "third_party_insurance"
              ? "Insurance request is with our team. Official docs will appear under My documents."
              : "License sticker is queued. Staff will process and notify you."}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{trackId || payRef}</p>
          <Button
            className="mt-2 h-11 w-full max-w-xs rounded-xl font-semibold lg:h-12"
            onClick={() => navigate({ to: "/profile/documents" })}
          >
            My documents
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full max-w-xs rounded-xl"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Vehicle" backTo="/services" />
      <div className="hub-flow-page mx-auto w-full max-w-md space-y-3 px-4 pb-24 pt-1 lg:max-w-2xl lg:space-y-3 lg:px-0 lg:pb-10 lg:pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "lookup" ? (
          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft sm:grid-cols-2 sm:gap-x-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plate number</Label>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  className={field}
                  placeholder="e.g. ABC123XY"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">State</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} className={field} />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-11 w-full rounded-xl font-semibold lg:h-12"
                disabled={lookingUp}
                onClick={() => void onLookup()}
              >
                {lookingUp ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Looking up…
                  </>
                ) : (
                  "Look up vehicle"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "result" && vehicle ? (
          <section className="space-y-3">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft lg:mx-auto lg:max-w-lg">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Car className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{vehicle.plate}</p>
                  <p className="text-xs text-muted-foreground">{vehicle.makeModel}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-secondary/50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    State
                  </p>
                  <p className="mt-0.5 font-semibold">{vehicle.state}</p>
                </div>
                {vehicle.expiryStatus ? (
                  <div className="rounded-xl bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-0.5 font-semibold">{vehicle.expiryStatus}</p>
                  </div>
                ) : null}
                {vehicle.color ? (
                  <div className="rounded-xl bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Color
                    </p>
                    <p className="mt-0.5 font-semibold">{vehicle.color}</p>
                  </div>
                ) : null}
                {vehicle.chassisNumber ? (
                  <div className="rounded-xl bg-secondary/50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Chassis
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] font-semibold">
                      {vehicle.chassisNumber}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-11 w-full rounded-xl font-semibold lg:h-12"
                onClick={() => setStep("renew")}
              >
                Continue to renew
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "renew" ? (
          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                  choice === "license_sticker"
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border/80 bg-card hover:border-primary/30"
                }`}
                onClick={() => setChoice("license_sticker")}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">License sticker</p>
                  <p className="text-[11px] text-muted-foreground">Physical · staff process</p>
                  <p className="mt-1 text-xs font-bold text-primary">
                    {formatNaira(feeSticker, false)}
                  </p>
                </div>
              </button>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                  choice === "third_party_insurance"
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border/80 bg-card hover:border-primary/30"
                }`}
                onClick={() => setChoice("third_party_insurance")}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Shield className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">3rd-party insurance</p>
                  <p className="text-[11px] text-muted-foreground">Digital · staff attach PDF</p>
                  <p className="mt-1 text-xs font-bold text-primary">
                    {formatNaira(feeInsurance, false)}
                  </p>
                </div>
              </button>
            </div>
            <PayActionBar>
              <Button
                className="h-11 w-full rounded-xl font-semibold lg:h-12"
                disabled={!choice || paying}
                onClick={() => void onPay()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
                  </>
                ) : choice ? (
                  `Pay ${formatNaira(fee, false)}`
                ) : (
                  "Select an option"
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
