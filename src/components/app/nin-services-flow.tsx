/**
 * NIN — retrieve / slip (download) / plastic card (deliver + address).
 * On pay: writes hub_orders (pending) for admin queue.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, FileText, Home, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { DeliveryAddressFields, PayBreakdown } from "@/components/app/hub-delivery-ui";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-store";
import {
  EMPTY_DELIVERY_ADDRESS,
  formatDeliveryOneLine,
  validateDeliveryAddress,
  type DeliveryAddress,
} from "@/lib/hub-delivery";
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import { submitNinOrder } from "@/lib/hub-order-submit.functions";
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";

type Product = "retrieve" | "slip_pdf" | "plastic_card";
type Step = "choose" | "details" | "address" | "confirm" | "success";

const STEPS_DOWNLOAD: PayStepMeta[] = [
  { key: "choose", label: "Service" },
  { key: "details", label: "Details" },
  { key: "pay", label: "Pay" },
];

const STEPS_DELIVER: PayStepMeta[] = [
  { key: "choose", label: "Service" },
  { key: "details", label: "Details" },
  { key: "address", label: "Address" },
  { key: "pay", label: "Pay" },
];

export function NinServicesFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile, authed } = useApp();
  const runSubmit = useServerFn(submitNinOrder);

  const priceRetrieve = feeFromMap(fees, "nin_retrieve");
  const priceSlip = feeFromMap(fees, "nin_slip");
  const priceCard = feeFromMap(fees, "nin_card_print") || feeFromMap(fees, "nin_plastic_card");
  const priceCourier = feeFromMap(fees, "nin_courier");

  const [step, setStep] = useState<Step>("choose");
  const [product, setProduct] = useState<Product | null>(null);
  const [phone, setPhone] = useState("");
  const [nin, setNin] = useState("");
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_DELIVERY_ADDRESS);
  const [paying, setPaying] = useState(false);
  const [refId, setRefId] = useState("");

  const needsAddress = product === "plastic_card";
  const checkoutTotal = useMemo(() => {
    if (product === "retrieve") return priceRetrieve;
    if (product === "slip_pdf") return priceSlip;
    if (product === "plastic_card") return priceCard + priceCourier;
    return 0;
  }, [product, priceRetrieve, priceSlip, priceCard, priceCourier]);

  const steps = needsAddress ? STEPS_DELIVER : STEPS_DOWNLOAD;
  const stepIndex = useMemo(() => {
    if (step === "choose") return 0;
    if (step === "details") return 1;
    if (step === "address") return 2;
    if (step === "confirm") return needsAddress ? 3 : 2;
    return needsAddress ? 3 : 2;
  }, [step, needsAddress]);

  const onPay = async () => {
    if (!product || checkoutTotal <= 0) return;
    if (needsAddress) {
      const err = validateDeliveryAddress(address);
      if (err) {
        toast.error(err);
        return;
      }
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
          delivery: needsAddress ? "deliver" : "download",
          shipping_address: needsAddress ? formatDeliveryOneLine(address) : "",
        },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");

      const done = await runSubmit({
        data: {
          product,
          amount: checkoutTotal,
          phone,
          nin,
          shippingAddress: needsAddress ? formatDeliveryOneLine(address) : "",
          shipping: needsAddress
            ? {
                phone: address.phone,
                street: address.street,
                area: address.area,
                lga: address.lga,
                state: address.state,
              }
            : {},
          paymentReference: paystack.reference,
        },
      });

      setRefId(done.trackingReference || paystack.reference);
      setStep("success");
      toast.success("Order saved — staff will process it");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (step === "success") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-lg font-bold">Order received</h1>
          <p className="text-sm text-muted-foreground">
            {product === "slip_pdf"
              ? "Digital slip will appear under Profile → My documents when ready."
              : product === "plastic_card"
                ? "Card is queued for print & delivery. Track updates in Notifications."
                : "NIN lookup is with our team. Check notifications when ready."}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">{refId}</p>
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
      <PageHeader title="NIN" backTo="/services" />
      <div className="mx-auto max-w-md space-y-3 px-4 pb-28 pt-1">
        <PayStepper steps={steps} current={Math.min(stepIndex, steps.length - 1)} />

        {step === "choose" ? (
          <section className="space-y-2">
            {(
              [
                {
                  id: "retrieve" as const,
                  Icon: Search,
                  title: "Retrieve NIN",
                  sub: "11-digit number · digital",
                  price: priceRetrieve,
                },
                {
                  id: "slip_pdf" as const,
                  Icon: FileText,
                  title: "NIN slip (PDF)",
                  sub: "Download when ready",
                  price: priceSlip,
                },
                {
                  id: "plastic_card" as const,
                  Icon: CreditCard,
                  title: "Plastic ID card",
                  sub: "Print + home delivery",
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
            {product === "retrieve" ? (
              <div className="space-y-1">
                <Label>Phone on NIN</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl"
                  inputMode="tel"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>NIN (11 digits)</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-11 rounded-xl"
                  inputMode="numeric"
                />
              </div>
            )}
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (product === "retrieve" && phone.replace(/\D/g, "").length < 10) {
                    toast.error("Enter the phone linked to your NIN.");
                    return;
                  }
                  if (product !== "retrieve" && nin.length !== 11) {
                    toast.error("Enter a valid 11-digit NIN.");
                    return;
                  }
                  setStep(needsAddress ? "address" : "confirm");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "address" && product === "plastic_card" ? (
          <section className="space-y-3">
            <DeliveryAddressFields value={address} onChange={setAddress} />
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  const err = validateDeliveryAddress(address);
                  if (err) toast.error(err);
                  else setStep("confirm");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "confirm" && product ? (
          <section className="space-y-3">
            <PayBreakdown
              lines={
                product === "plastic_card"
                  ? [
                      { label: "Plastic ID card", amount: priceCard },
                      { label: "Delivery", amount: priceCourier },
                    ]
                  : [
                      {
                        label: product === "retrieve" ? "Retrieve NIN" : "NIN slip (PDF)",
                        amount: checkoutTotal,
                      },
                    ]
              }
              total={checkoutTotal}
            />
            {needsAddress ? (
              <p className="text-[11px] text-muted-foreground">
                Deliver to: {formatDeliveryOneLine(address)}
              </p>
            ) : null}
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
