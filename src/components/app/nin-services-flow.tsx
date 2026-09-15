/**
 * NIN services — live fees from loader + delivery choice (PDF slip vs plastic card)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CreditCard, FileText, Home, Loader2, Search } from "lucide-react";
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
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Product = "retrieve" | "slip_pdf" | "plastic_card";
type Step = "choose" | "details" | "confirm" | "success";

const STEPS: PayStepMeta[] = [
  { key: "choose", label: "Service" },
  { key: "details", label: "Details" },
  { key: "confirm", label: "Pay" },
];

export function NinServicesFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile, authed } = useApp();

  const priceRetrieve = feeFromMap(fees, "nin_retrieve");
  const priceSlip = feeFromMap(fees, "nin_slip");
  const priceCard = feeFromMap(fees, "nin_card_print") || feeFromMap(fees, "nin_plastic_card");
  const priceCourier = feeFromMap(fees, "nin_courier");

  const [step, setStep] = useState<Step>("choose");
  const [product, setProduct] = useState<Product | null>(null);
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [paying, setPaying] = useState(false);
  const [refId, setRefId] = useState("");

  const checkoutTotal = useMemo(() => {
    if (product === "retrieve") return priceRetrieve;
    if (product === "slip_pdf") return priceSlip;
    if (product === "plastic_card") return priceCard + priceCourier;
    return 0;
  }, [product, priceRetrieve, priceSlip, priceCard, priceCourier]);

  const stepIndex = useMemo(() => {
    if (step === "choose") return 0;
    if (step === "details") return 1;
    return 2;
  }, [step]);

  const onPay = async () => {
    if (!product || checkoutTotal <= 0) return;
    if (product === "plastic_card" && shippingAddress.trim().length < 10) {
      toast.error("Enter a full delivery address for the plastic card.");
      return;
    }
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
        amountNaira: checkoutTotal,
        metadata: {
          service: product,
          nin: nin || phone,
          shipping_address: shippingAddress,
        },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");
      setRefId(paystack.reference);
      setStep("success");
      toast.success("Payment confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (step === "success") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
          <h1 className="text-xl font-extrabold">Payment confirmed</h1>
          <p className="text-sm text-muted-foreground">
            {product === "slip_pdf"
              ? "Your digital NIN slip will be available shortly."
              : product === "plastic_card"
                ? "Your plastic ID card is being prepared for delivery."
                : "Your NIN retrieval is processing."}
          </p>
          <p className="font-mono text-[10px]">Ref · {refId}</p>
          <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="NIN Services" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "choose" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">What do you need?</h2>

            <button
              type="button"
              className="flex w-full gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left"
              onClick={() => {
                setProduct("retrieve");
                setStep("details");
              }}
            >
              <Search className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-extrabold">Retrieve NIN</p>
                <p className="text-[11px] text-muted-foreground">Look up your 11-digit number</p>
                <p className="mt-1 text-xs font-bold text-primary">{formatNaira(priceRetrieve, false)}</p>
              </div>
            </button>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery format</p>

            <button
              type="button"
              className={cn(
                "flex w-full gap-3 rounded-2xl border p-4 text-left",
                product === "slip_pdf" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
              )}
              onClick={() => {
                setProduct("slip_pdf");
                setStep("details");
              }}
            >
              <FileText className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-extrabold">Download digital NIN slip (PDF)</p>
                <p className="text-[11px] text-muted-foreground">Instant file on your phone</p>
                <p className="mt-1 text-xs font-bold text-primary">{formatNaira(priceSlip, false)}</p>
              </div>
            </button>

            <button
              type="button"
              className={cn(
                "flex w-full gap-3 rounded-2xl border p-4 text-left",
                product === "plastic_card" ? "border-primary bg-primary/5" : "border-border/80 bg-card",
              )}
              onClick={() => {
                setProduct("plastic_card");
                setStep("details");
              }}
            >
              <CreditCard className="size-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-extrabold">Print & deliver premium plastic ID card</p>
                <p className="text-[11px] text-muted-foreground">Card print + courier to your address</p>
                <p className="mt-1 text-xs font-bold text-primary">
                  {formatNaira(priceCard + priceCourier, false)}
                </p>
              </div>
            </button>
          </section>
        ) : null}

        {step === "details" && product ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold">Your details</h2>
            {product === "retrieve" ? (
              <div className="space-y-1.5">
                <Label>Registered phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>NIN (11 digits)</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-12 rounded-2xl"
                />
              </div>
            )}

            {product === "plastic_card" ? (
              <div className="space-y-1.5">
                <Label>Shipping address *</Label>
                <Input
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Street, area, city, state"
                  className="h-12 rounded-2xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Card {formatNaira(priceCard, false)} + courier {formatNaira(priceCourier, false)}
                </p>
              </div>
            ) : null}

            <PayActionBar>
              <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => setStep("confirm")}>
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "confirm" && product ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold">Confirm & pay</h2>
            <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-bold">
                  {product === "retrieve"
                    ? "Retrieve NIN"
                    : product === "slip_pdf"
                      ? "Digital NIN slip"
                      : "Plastic ID card"}
                </span>
              </div>
              {product === "plastic_card" ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span>Card print</span>
                    <span>{formatNaira(priceCard, false)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Courier</span>
                    <span>{formatNaira(priceCourier, false)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between border-t border-border/60 pt-2 text-base font-extrabold">
                <span>Total</span>
                <span className="tabular-nums">{formatNaira(checkoutTotal, false)}</span>
              </div>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPay()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Opening Paystack…
                  </>
                ) : (
                  `Pay ${formatNaira(checkoutTotal, false)}`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
