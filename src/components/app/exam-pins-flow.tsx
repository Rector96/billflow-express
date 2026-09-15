import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Home,
  Loader2,
  Mail,
  Minus,
  Plus,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PinPad } from "@/components/app/pin-pad";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { scrollForNewStep, scrollIntoAction } from "@/lib/scroll-into-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { friendlyError, useApp } from "@/lib/app-store";
import { listExamCatalog, purchaseExamPins, type ExamVariation } from "@/lib/exam.functions";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const EXAMS = [
  { id: "waec", name: "WAEC", label: "Result checker & registration PINs" },
  { id: "neco", name: "NECO", label: "Result checker PIN" },
  { id: "nabteb", name: "NABTEB", label: "Result checker PIN" },
  { id: "jamb", name: "JAMB", label: "e-PIN — needs Profile ID" },
] as const;

const MAX_Q = 10;
type Step = "exam" | "product" | "quantity" | "confirm" | "pin" | "result";

export function ExamPinsFlow({
  entryTitle = "Exam Pins",
}: {
  /** "Education" or "Exam Pins" depending on route */
  entryTitle?: string;
}) {
  const navigate = useNavigate();
  const { refresh, profile } = useApp();
  const loadCatalog = useServerFn(listExamCatalog);
  const purchase = useServerFn(purchaseExamPins);
  const [step, setStep] = useState<Step>("exam");

  useEffect(() => {
    scrollForNewStep("pay-action");
  }, [step]);
  const [examId, setExamId] = useState("");
  const [variations, setVariations] = useState<ExamVariation[]>([]);
  const [variationCode, setVariationCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [profileId, setProfileId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultPins, setResultPins] = useState<string[]>([]);
  const [resultRef, setResultRef] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [resultStatus, setResultStatus] = useState<"successful" | "pending" | "failed">("failed");
  const deliveryEmail = (profile?.email ?? "").trim();

  const exam = EXAMS.find((item) => item.id === examId);
  const variation = variations.find((item) => item.variationCode === variationCode);
  const total = variation ? variation.amount * quantity : 0;
  const progressSteps: Step[] = ["exam", "product", "quantity", "confirm", "pin"];
  const progressIndex = Math.max(0, progressSteps.indexOf(step === "result" ? "pin" : step));

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    setError("");
    void loadCatalog({ data: { examId } })
      .then((items) => {
        setVariations(items);
        setVariationCode(items[0]?.variationCode ?? "");
        setStep("product");
      })
      .catch((err) => {
        setError(friendlyError(err, "Could not load exam PINs from the provider."));
        setVariations([]);
        setStep("exam");
      })
      .finally(() => setLoading(false));
  }, [examId, loadCatalog]);

  const copyPins = async () => {
    if (!resultPins.length) return;
    try {
      await navigator.clipboard.writeText(resultPins.join("\n"));
      toast.success("PIN(s) copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const submit = async () => {
    if (!variation) return;
    setLoading(true);
    setError("");
    try {
      const result = await purchase({
        data: {
          examId,
          variationCode,
          quantity,
          pin,
          ...(examId === "jamb" ? { profileId } : {}),
        },
      });
      await refresh();
      setResultRef(result.reference);
      setResultMsg(result.message);
      setResultPins(result.pins ?? []);
      setResultStatus(result.status);
      setStep("result");
      setPin("");
    } catch (err) {
      const message = friendlyError(err, "Could not complete this purchase.");
      setError(message);
      toast.error(message);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  };

  if (step === "result") {
    const isOk = resultStatus === "successful";
    const isPending = resultStatus === "pending";
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span
            className={cn(
              "grid size-16 place-items-center rounded-full",
              isOk
                ? "bg-success-soft text-success"
                : isPending
                  ? "bg-warning-soft text-warning"
                  : "bg-destructive-soft text-destructive",
            )}
          >
            {isOk ? (
              <CheckCircle2 className="size-8" />
            ) : isPending ? (
              <Clock3 className="size-8" />
            ) : (
              <AlertCircle className="size-8" />
            )}
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">
            {isOk ? "PIN ready" : isPending ? "Confirming with provider" : "Could not complete"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">{resultMsg}</p>

          {resultPins.length > 0 ? (
            <div className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Your PIN{resultPins.length > 1 ? "s" : ""} · {resultPins.length} code
                  {resultPins.length > 1 ? "s" : ""}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl text-xs font-bold"
                  onClick={() => void copyPins()}
                >
                  <Copy className="mr-1 size-3.5" /> Copy all
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {resultPins.map((p, index) => (
                  <li
                    key={`${p}-${index}`}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5"
                  >
                    <span className="break-all font-mono text-[15px] font-extrabold tracking-wide">
                      {p}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Copy PIN ${index + 1}`}
                      onClick={() => {
                        void navigator.clipboard.writeText(p).then(
                          () => toast.success("Copied"),
                          () => toast.error("Could not copy"),
                        );
                      }}
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {deliveryEmail ? (
                <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <Mail className="mt-0.5 size-3.5 shrink-0" />
                  Keep this screen or open History. A copy may also go to{" "}
                  <span className="font-semibold text-foreground">{deliveryEmail}</span> when email
                  delivery is enabled on your account.
                </p>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Save or copy your PIN(s) now. You can also open the receipt from History.
                </p>
              )}
            </div>
          ) : isOk || isPending ? (
            <div className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 text-left text-xs text-muted-foreground shadow-soft">
              {isPending
                ? "Provider has not returned the PIN yet. Open History and refresh status shortly — do not pay again."
                : "PIN not shown here yet. Open History with your reference, or check your email if delivery is on."}
            </div>
          ) : null}

          {resultRef ? (
            <p className="font-mono text-[11px] text-muted-foreground">{resultRef}</p>
          ) : null}

          <div className="mt-2 w-full space-y-2">
            <Button
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => navigate({ to: "/home" })}
            >
              <Home className="mr-2 size-4" /> Home
            </Button>
            {resultRef ? (
              <Button
                variant="outline"
                className="h-12 w-full rounded-2xl font-bold"
                onClick={() => navigate({ to: "/history/$txId", params: { txId: resultRef } })}
              >
                View receipt
              </Button>
            ) : null}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title={entryTitle} backTo="/services" />
      <div className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-2">
        <div className="flex items-center gap-1.5">
          {progressSteps.map((item, index) => (
            <div
              key={item}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                progressIndex >= index ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === "exam" ? (
          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning">
                <Ticket className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Choose exam body</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  WAEC, NECO, NABTEB and JAMB — prices load live from the provider. Perfect for
                  students.
                </p>
              </div>
            </div>
            {EXAMS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  setExamId(item.id);
                  setVariations([]);
                  setVariationCode("");
                  setError("");
                }}
                className="press flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-soft"
              >
                <div>
                  <p className="text-sm font-extrabold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
                {loading && examId === item.id ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="size-5 text-muted-foreground/35" />
                )}
              </button>
            ))}
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive-soft/40 px-3 py-3 text-xs text-destructive">
                {error}
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "product" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Choose a product</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Live {exam.name} options from the provider.
              </p>
            </div>
            {variations.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No products available right now.
              </p>
            ) : (
              <div className="grid gap-2">
                {variations.map((item) => (
                  <button
                    key={item.variationCode}
                    type="button"
                    onClick={() => {
                      setVariationCode(item.variationCode);
                      setStep("quantity");
                    }}
                    className={cn(
                      "press flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left shadow-soft",
                      item.variationCode === variationCode
                        ? "border-primary bg-primary-soft"
                        : "border-border/70 bg-card",
                    )}
                  >
                    <span className="text-sm font-bold">{item.name}</span>
                    <span className="font-extrabold tabular-nums">
                      {formatNaira(item.amount, false)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full text-xs font-bold"
              onClick={() => setStep("exam")}
            >
              Change exam body
            </Button>
          </section>
        ) : null}

        {step === "quantity" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">How many PINs?</h2>
              <p className="mt-1 text-xs text-muted-foreground">Between 1 and {MAX_Q}.</p>
            </div>
            <div className="rounded-[26px] border border-border/70 bg-card p-5 shadow-soft">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {exam.name} · {variation.name}
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity === 1}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-14 text-center text-3xl font-extrabold tabular-nums">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-full"
                  onClick={() => setQuantity(Math.min(MAX_Q, quantity + 1))}
                  disabled={quantity === MAX_Q}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {formatNaira(variation.amount, false)} × {quantity}
              </p>
              <p className="mt-1 text-center text-xl font-extrabold tabular-nums">
                {formatNaira(total, false)}
              </p>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                Total before PIN — this is what you pay
              </p>
            </div>
            {examId === "jamb" ? (
              <div className="space-y-2">
                <Label htmlFor="jamb-profile">JAMB Profile ID</Label>
                <Input
                  id="jamb-profile"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="Enter JAMB Profile ID"
                  className="h-12 rounded-2xl"
                />
              </div>
            ) : null}
            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                disabled={examId === "jamb" && !profileId.trim()}
                onClick={() => {
                  setStep("confirm");
                  scrollIntoAction("pay-action");
                }}
              >
                Continue · {formatNaira(total, false)}
              </Button>
            </PayActionBar>
            <Button
              variant="ghost"
              className="w-full text-xs font-bold"
              onClick={() => setStep("product")}
            >
              Change product
            </Button>
          </section>
        ) : null}

        {step === "confirm" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Confirm purchase</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Check quantity and total before entering your transaction PIN.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exam</span>
                <span className="font-bold">{exam.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="max-w-[60%] text-right font-bold">{variation.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-bold tabular-nums">{quantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unit price</span>
                <span className="font-bold tabular-nums">
                  {formatNaira(variation.amount, false)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(total, false)}</span>
              </div>
            </div>
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive-soft/40 px-3 py-3 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => setStep("pin")}>
                Enter PIN to pay {formatNaira(total, false)}
              </Button>
            </PayActionBar>
            <Button
              variant="ghost"
              className="w-full text-xs font-bold"
              onClick={() => setStep("quantity")}
            >
              Change quantity
            </Button>
          </section>
        ) : null}

        {step === "pin" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Transaction PIN</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Authorise {formatNaira(total, false)} for {quantity} PIN{quantity > 1 ? "s" : ""}.
              </p>
            </div>
            <PinPad value={pin} onChange={setPin} maxLength={4} />
            {error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive-soft/40 px-3 py-3 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                disabled={pin.length !== 4 || loading}
                onClick={() => void submit()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Pay {formatNaira(total, false)}</>
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
