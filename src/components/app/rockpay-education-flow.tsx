import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Home,
  Loader2,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper } from "@/components/app/pay-step";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { friendlyError, useApp } from "@/lib/app-store";
import {
  listExamCatalog,
  purchaseExamPins,
  requeryExamPins,
  type ExamVariation,
} from "@/lib/exam.functions";
import { verifyVtpassCustomer } from "@/lib/bills.functions";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const EXAMS = [
  { id: "waec", name: "WAEC", label: "Result checking and registration PINs" },
  { id: "neco", name: "NECO", label: "Result checking PINs" },
  { id: "nabteb", name: "NABTEB", label: "Result checking PINs" },
  { id: "jamb", name: "JAMB", label: "UTME / Direct Entry e-PINs" },
] as const;

type Step =
  "exam" | "profile" | "product" | "quantity" | "confirm" | "pin" | "processing" | "result";
const MAX_Q = 10;

export function RockPayEducationFlow({ entryTitle = "Education" }: { entryTitle?: string }) {
  const navigate = useNavigate();
  const { refresh } = useApp();
  const loadCatalog = useServerFn(listExamCatalog);
  const verifyCandidate = useServerFn(verifyVtpassCustomer);
  const purchase = useServerFn(purchaseExamPins);
  const requery = useServerFn(requeryExamPins);

  const [step, setStep] = useState<Step>("exam");
  const [examId, setExamId] = useState("");
  const [variations, setVariations] = useState<ExamVariation[]>([]);
  const [variationCode, setVariationCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [profileId, setProfileId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState("");
  const [resultPins, setResultPins] = useState<string[]>([]);
  const [resultRef, setResultRef] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [resultStatus, setResultStatus] = useState<"successful" | "pending" | "failed">("pending");

  const exam = EXAMS.find((item) => item.id === examId);
  const variation = variations.find((item) => item.variationCode === variationCode);
  const total = variation ? variation.amount * quantity : 0;
  const progress = [
    "exam",
    ...(examId === "jamb" ? ["profile"] : []),
    "product",
    "quantity",
    "confirm",
    "pin",
  ] as Step[];
  const current = Math.max(
    0,
    progress.indexOf(step === "processing" || step === "result" ? "pin" : step),
  );

  const loadProducts = async (selectedExam: string) => {
    setLoading(true);
    setError("");
    try {
      const items = await loadCatalog({ data: { examId: selectedExam } });
      setVariations(items);
      setVariationCode(items[0]?.variationCode ?? "");
      setStep("product");
    } catch (err) {
      setVariations([]);
      setVariationCode("");
      setError(friendlyError(err, "Could not load the available education products."));
      setStep("exam");
    } finally {
      setLoading(false);
    }
  };

  const selectExam = (id: string) => {
    setExamId(id);
    setVariations([]);
    setVariationCode("");
    setQuantity(1);
    setCandidateName("");
    setError("");
    if (id === "jamb") setStep("profile");
    else void loadProducts(id);
  };

  const verifyJamb = async () => {
    const code = profileId.trim();
    if (!code || code.length < 5) {
      setError("Enter your JAMB Profile ID.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyCandidate({ data: { serviceID: "jamb", billersCode: code } });
      const name = String(result.customerName ?? "").trim();
      if (!name)
        throw new Error(
          "JAMB did not return a candidate name. Check the Profile ID and try again.",
        );
      setCandidateName(name);
      await loadProducts("jamb");
    } catch (err) {
      setError(friendlyError(err, "Could not verify this JAMB Profile ID."));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!variation || loading) return;
    setLoading(true);
    setError("");
    setStep("processing");
    try {
      const result = await purchase({
        data: { examId, variationCode, quantity, pin, ...(examId === "jamb" ? { profileId } : {}) },
      });
      await refresh();
      setResultRef(result.reference);
      setResultMsg(result.message);
      setResultPins(result.pins ?? []);
      setResultStatus(result.status);
      setPin("");
      setStep("result");
    } catch (err) {
      const message = friendlyError(err, "Could not complete this education payment.");
      setError(message);
      toast.error(message);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!resultRef || checkingStatus) return;
    setCheckingStatus(true);
    setError("");
    try {
      const result = await requery({ data: { reference: resultRef } });
      await refresh();
      setResultMsg(result.message);
      setResultPins(result.pins ?? []);
      setResultStatus(result.status);
      toast.success(
        result.status === "successful"
          ? "Payment confirmed"
          : result.status === "failed"
            ? "Payment failed"
            : "Still processing",
      );
    } catch (err) {
      const message = friendlyError(err, "Could not check the payment status.");
      setError(message);
      toast.error(message);
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyPins = async () => {
    if (!resultPins.length) return;
    try {
      await navigator.clipboard.writeText(resultPins.join("\n"));
      toast.success("PIN(s) copied");
    } catch {
      toast.error("Could not copy the PIN(s)");
    }
  };

  if (step === "processing") {
    return (
      <AppShell>
        <div className="flex min-h-[70dvh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-[28px] border bg-card p-7 text-center shadow-soft">
            <Loader2 className="mx-auto size-12 animate-spin text-primary" />
            <h1 className="mt-5 text-xl font-black">Processing education payment</h1>
            <p className="mt-2 text-xs text-muted-foreground">
              RockPay is confirming the order with the provider.
            </p>
            <p className="mt-5 text-2xl font-black">{formatNaira(total, false)}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "result") {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
          <div className="rounded-[28px] border bg-card p-6 text-center shadow-soft">
            <span
              className={cn(
                "mx-auto grid size-16 place-items-center rounded-full",
                resultStatus === "successful"
                  ? "bg-success-soft text-success"
                  : resultStatus === "failed"
                    ? "bg-destructive-soft text-destructive"
                    : "bg-warning-soft text-warning",
              )}
            >
              {resultStatus === "successful" ? (
                <CheckCircle2 className="size-8" />
              ) : resultStatus === "failed" ? (
                <AlertCircle className="size-8" />
              ) : (
                <Loader2 className="size-8 animate-spin" />
              )}
            </span>
            <h1 className="mt-4 text-2xl font-black">
              {resultStatus === "successful"
                ? "PIN ready"
                : resultStatus === "pending"
                  ? "Payment processing"
                  : "Payment failed"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{resultMsg}</p>
            {candidateName ? (
              <p className="mt-2 text-xs font-bold">JAMB candidate: {candidateName}</p>
            ) : null}
            {resultPins.length ? (
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary-soft p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your PIN{resultPins.length > 1 ? "s" : ""}
                </p>
                <div className="mt-2 space-y-2">
                  {resultPins.map((item) => (
                    <p key={item} className="break-all font-mono text-lg font-black">
                      {item}
                    </p>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-3 rounded-xl"
                  onClick={() => void copyPins()}
                >
                  <Copy className="mr-2 size-4" />
                  Copy PIN(s)
                </Button>
              </div>
            ) : null}
            {resultRef ? (
              <p className="mt-4 font-mono text-[11px] text-muted-foreground">{resultRef}</p>
            ) : null}
          </div>

          {resultStatus === "pending" ? (
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              disabled={checkingStatus}
              onClick={() => void checkStatus()}
            >
              {checkingStatus ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {checkingStatus ? "Checking status…" : "Check status"}
            </Button>
          ) : null}
          {error ? (
            <p className="rounded-2xl bg-destructive-soft p-3 text-xs font-semibold text-destructive">
              {error}
            </p>
          ) : null}
          {resultStatus === "failed" ? (
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => setStep("confirm")}
            >
              Try again
            </Button>
          ) : null}
          {resultRef ? (
            <Button variant="outline" className="h-11 w-full rounded-2xl font-bold" asChild>
              <Link to="/history/$txId" params={{ txId: resultRef }}>
                View receipt
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-11 w-full rounded-2xl font-bold"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" />
            Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={entryTitle} backTo="/services" />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
        <PayStepper
          steps={progress.map((key) => ({
            key,
            label:
              key === "exam"
                ? "Exam"
                : key === "profile"
                  ? "Verify"
                  : key === "product"
                    ? "Product"
                    : key === "quantity"
                      ? "Quantity"
                      : key === "confirm"
                        ? "Review"
                        : "PIN",
          }))}
          current={current}
        />

        {step === "exam" ? (
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-warning-soft text-warning">
                <Ticket className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">Choose exam body</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select the examination service you want to pay for.
                </p>
              </div>
            </div>
            {EXAMS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={loading}
                onClick={() => selectExam(item.id)}
                className="press flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-3.5 text-left shadow-soft"
              >
                <div>
                  <p className="text-sm font-black">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
                {loading && examId === item.id ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <ChevronRight className="size-5 text-muted-foreground" />
                )}
              </button>
            ))}
            {error ? (
              <p className="rounded-2xl bg-destructive-soft p-3 text-xs font-semibold text-destructive">
                {error}
              </p>
            ) : null}
          </section>
        ) : null}

        {step === "profile" && examId === "jamb" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-black">Verify JAMB candidate</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the Profile ID before selecting the JAMB e-PIN product.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jamb-profile">JAMB Profile ID</Label>
              <Input
                id="jamb-profile"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="Enter Profile ID"
                className="h-12 rounded-xl"
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              className="h-12 w-full rounded-xl font-bold"
              disabled={loading}
              onClick={() => void verifyJamb()}
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Verify & continue
            </Button>
          </section>
        ) : null}

        {step === "product" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-black">Choose {exam.name} product</h2>
              {candidateName ? (
                <p className="mt-1 text-xs font-semibold text-success">
                  Verified candidate: {candidateName}
                </p>
              ) : null}
            </div>
            {variations.length ? (
              <div className="space-y-2">
                {variations.map((item) => (
                  <button
                    key={item.variationCode}
                    type="button"
                    onClick={() => {
                      setVariationCode(item.variationCode);
                      setStep("quantity");
                    }}
                    className={cn(
                      "press flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left shadow-soft",
                      variationCode === item.variationCode
                        ? "border-primary bg-primary-soft"
                        : "bg-card",
                    )}
                  >
                    <span className="text-sm font-black">{item.name}</span>
                    <span className="font-black">{formatNaira(item.amount, false)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No products are currently available.
              </p>
            )}
          </section>
        ) : null}

        {step === "quantity" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-black">How many PINs?</h2>
              <p className="mt-1 text-xs text-muted-foreground">Choose between 1 and {MAX_Q}.</p>
            </div>
            <div className="rounded-[26px] border bg-card p-5 text-center shadow-soft">
              <p className="text-xs font-bold text-muted-foreground">
                {exam.name} · {variation.name}
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  disabled={quantity === 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-12 text-3xl font-black">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  disabled={quantity === MAX_Q}
                  onClick={() => setQuantity(Math.min(MAX_Q, quantity + 1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <p className="mt-4 text-xl font-black">{formatNaira(total, false)}</p>
            </div>
            <Button className="h-12 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </section>
        ) : null}

        {step === "confirm" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-black">Review education payment</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm the product and quantity before entering your transaction PIN.
              </p>
            </div>
            <div className="divide-y rounded-2xl border bg-card px-3 shadow-soft">
              <Info label="Exam" value={exam.name} />
              <Info label="Product" value={variation.name} />
              <Info label="Quantity" value={String(quantity)} />
              {candidateName ? <Info label="Candidate" value={candidateName} /> : null}
              <Info label="Payment method" value="RockPay Wallet" />
              <Info label="Total" value={formatNaira(total)} />
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  setPin("");
                  setStep("pin");
                }}
              >
                Confirm & Pay
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "pin" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-black">Enter transaction PIN</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Authorize {formatNaira(total, false)} from your RockPay Wallet.
              </p>
            </div>
            <PinPad value={pin} onChange={setPin} />
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                disabled={pin.length < 4 || loading}
                onClick={() => void submit()}
              >
                Confirm payment
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {error && step !== "exam" && step !== "profile" ? (
          <p className="rounded-2xl bg-destructive-soft p-3 text-xs font-semibold text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-bold">{value}</span>
    </div>
  );
}
