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

  if (step === "done" && vehicle && choice) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-bold">Order received</h1>
          <p className="text-sm text-muted-foreground">
            {choice === "third_party_insurance"
              ? "Insurance request is with our team. Official docs will appear under My documents."
              : "License sticker is queued. Staff will process and notify you."}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{trackId || payRef}</p>
          <Button
            className="mt-2 h-12 w-full max-w-xs rounded-xl font-semibold"
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
      <div className="mx-auto max-w-md space-y-3 px-4 pb-28 pt-1">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "lookup" ? (
          <section className="space-y-3">
            <div className="space-y-1">
              <Label>Plate number</Label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="h-11 rounded-xl"
                placeholder="e.g. ABC123XY"
              />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
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
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Car className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{vehicle.plate}</p>
                  <p className="text-xs text-muted-foreground">{vehicle.makeModel}</p>
                </div>
              </div>
              {vehicle.expiryStatus ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Status: {vehicle.expiryStatus}
                </p>
              ) : null}
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => setStep("renew")}
              >
                Continue to renew
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "renew" ? (
          <section className="space-y-3">
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                choice === "license_sticker"
                  ? "border-primary bg-primary/5"
                  : "border-border/80 bg-card"
              }`}
              onClick={() => setChoice("license_sticker")}
            >
              <FileText className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">License sticker</p>
                <p className="text-[11px] text-muted-foreground">Physical · staff process</p>
              </div>
              <p className="text-xs font-bold text-primary">{formatNaira(feeSticker, false)}</p>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left ${
                choice === "third_party_insurance"
                  ? "border-primary bg-primary/5"
                  : "border-border/80 bg-card"
              }`}
              onClick={() => setChoice("third_party_insurance")}
            >
              <Shield className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">3rd-party insurance</p>
                <p className="text-[11px] text-muted-foreground">Digital · staff attach PDF</p>
              </div>
              <p className="text-xs font-bold text-primary">{formatNaira(feeInsurance, false)}</p>
            </button>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
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
