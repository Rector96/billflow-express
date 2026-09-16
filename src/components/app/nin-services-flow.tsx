/**
 * NIN services — compact mobile steps + live fees from loader
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
      toast.error("Enter your full delivery address.");
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
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-bold">Done</h1>
          <p className="text-sm text-muted-foreground">
            {product === "slip_pdf"
              ? "Digital slip coming shortly."
              : product === "plastic_card"
                ? "Card is being prepared for delivery."
                : "NIN lookup is processing."}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{refId}</p>
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

  return (
    <AppShell>
      <PageHeader title="NIN" backTo="/services" />
      <div className="mx-auto max-w-md space-y-3 px-4 pb-28 pt-1">
        <PayStepper steps={STEPS} current={stepIndex} />

        {step === "choose" ? (
          <section className="space-y-2">
            {(
              [
                {
                  id: "retrieve" as const,
                  Icon: Search,
                  title: "Retrieve NIN",
                  sub: "Get your 11-digit number",
                  price: priceRetrieve,
                },
                {
                  id: "slip_pdf" as const,
                  Icon: FileText,
                  title: "NIN slip (PDF)",
                  sub: "Download on your phone",
                  price: priceSlip,
                },
                {
                  id: "plastic_card" as const,
                  Icon: CreditCard,
                  title: "Plastic ID card",
                  sub: "Print + delivery",
                  price: priceCard + priceCourier,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3.5 py-3 text-left shadow-soft"
                onClick={() => {
                  setProduct(item.id);
                  setStep("details");
                }}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <item.Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                </div>
                <p className="shrink-0 text-xs font-bold tabular-nums text-primary">
                  {formatNaira(item.price, false)}
                </p>
              </button>
            ))}
          </section>
        ) : null}

        {step === "details" && product ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Details</h2>
            {product === "retrieve" ? (
              <div className="space-y-1.5">
                <Label>Phone on NIN</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl"
                  inputMode="tel"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>NIN (11 digits)</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-11 rounded-xl"
                  inputMode="numeric"
                />
              </div>
            )}
            {product === "plastic_card" ? (
              <div className="space-y-1.5">
                <Label>Delivery address</Label>
                <Input
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Street, city, state"
                  className="h-11 rounded-xl"
                />
              </div>
            ) : null}
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => setStep("confirm")}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "confirm" && product ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Pay</h2>
            <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Service</span>
                <span className="text-right font-semibold">
                  {product === "retrieve"
                    ? "Retrieve NIN"
                    : product === "slip_pdf"
                      ? "NIN slip PDF"
                      : "Plastic ID card"}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">
                  {formatNaira(checkoutTotal, false)}
                </span>
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                disabled={paying}
                onClick={() => void onPay()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
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
