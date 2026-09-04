import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { friendlyError, useApp } from "@/lib/app-store";
import { listExamCatalog, purchaseExamPins, type ExamVariation } from "@/lib/exam.functions";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const EXAMS = [
  { id: "waec", name: "WAEC", label: "Result checker PIN" },
  { id: "neco", name: "NECO", label: "Result checker PIN" },
  { id: "nabteb", name: "NABTEB", label: "Result checker PIN" },
  { id: "jamb", name: "JAMB", label: "e-PIN / profile" },
] as const;
const MAX_Q = 10;
type Step = "exam" | "product" | "quantity" | "confirm" | "pin";

export function ExamPinsFlow() {
  const navigate = useNavigate();
  const { refresh } = useApp();
  const loadCatalog = useServerFn(listExamCatalog);
  const purchase = useServerFn(purchaseExamPins);
  const [step, setStep] = useState<Step>("exam");
  const [examId, setExamId] = useState("");
  const [variations, setVariations] = useState<ExamVariation[]>([]);
  const [variationCode, setVariationCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [profileId, setProfileId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const exam = EXAMS.find((item) => item.id === examId);
  const variation = variations.find((item) => item.variationCode === variationCode);
  const total = variation ? variation.amount * quantity : 0;
  const steps: Step[] = ["exam", "product", "quantity", "confirm", "pin"];

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
      .catch((err) => setError(friendlyError(err, "Could not load exam PINs.")))
      .finally(() => setLoading(false));
  }, [examId, loadCatalog]);

  const submit = async () => {
    if (!variation) return;
    setLoading(true);
    setError("");
    try {
      const result = await purchase({
        data: { examId, variationCode, quantity, pin, ...(examId === "jamb" ? { profileId } : {}) },
      });
      await refresh();
      if (result.status === "successful" || result.status === "pending") {
        await navigate({ to: "/history/$txId", params: { txId: result.reference } });
      } else {
        toast.error(result.message);
        setStep("confirm");
      }
    } catch (err) {
      const message = friendlyError(err, "Could not complete this purchase.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Exam Pins" backTo="/services" />
      <div className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-2">
        <div className="flex items-center gap-1.5">
          {steps.map((item, index) => (
            <div
              key={item}
              className={cn(
                "h-1 flex-1 rounded-full",
                steps.indexOf(step) >= index ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        {step === "exam" ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Choose exam body</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Live products and prices come directly from VTpass.
              </p>
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
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-soft"
              >
                <div>
                  <p className="text-sm font-extrabold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                </div>
                {loading && examId === item.id ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5 text-muted-foreground/40" />
                )}
              </button>
            ))}
          </section>
        ) : null}
        {step === "product" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Choose a product</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select the live {exam.name} PIN denomination.
              </p>
            </div>
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
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left",
                    item.variationCode === variationCode
                      ? "border-primary bg-primary-soft"
                      : "border-border/70 bg-card",
                  )}
                >
                  <span className="text-sm font-bold">{item.name}</span>
                  <span className="font-extrabold">{formatNaira(item.amount)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {step === "quantity" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">How many PINs?</h2>
              <p className="mt-1 text-xs text-muted-foreground">Choose between 1 and 10 PINs.</p>
            </div>
            <div className="rounded-[26px] border border-border/70 bg-card p-5 shadow-soft">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {exam.name} · {variation.name}
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity === 1}
                >
                  <Minus />
                </Button>
                <span className="w-12 text-center text-3xl font-extrabold">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.min(MAX_Q, quantity + 1))}
                  disabled={quantity === MAX_Q}
                >
                  <Plus />
                </Button>
              </div>
              <p className="mt-4 text-center font-extrabold">{formatNaira(total)}</p>
            </div>
            <Button className="h-11 w-full rounded-xl font-bold" onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </section>
        ) : null}
        {step === "confirm" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Confirm purchase</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                You pay the exact VTpass face value. No surcharge.
              </p>
            </div>
            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
              <Row label="Exam" value={exam.name} />
              <Row label="Product" value={variation.name} />
              <Row label="Quantity" value={String(quantity)} />
              <Row label="Total" value={formatNaira(total)} />
            </div>
            {examId === "jamb" ? (
              <div className="space-y-2">
                <Label htmlFor="profile-id">JAMB Profile ID</Label>
                <Input
                  id="profile-id"
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  placeholder="Enter your Profile ID"
                />
              </div>
            ) : null}
            <div className="flex items-start gap-2 rounded-2xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>PINs will appear on your receipt after a successful provider response.</p>
            </div>
            <Button
              className="h-11 w-full rounded-xl font-bold"
              disabled={examId === "jamb" && !profileId.trim()}
              onClick={() => setStep("pin")}
            >
              Continue to PIN
            </Button>
          </section>
        ) : null}
        {step === "pin" && variation && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Enter transaction PIN</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm {formatNaira(total)} for {quantity} {exam.name} PIN
                {quantity === 1 ? "" : "s"}.
              </p>
            </div>
            <PinPad value={pin} onChange={setPin} />
            <Button
              className="h-12 w-full rounded-xl font-bold"
              disabled={pin.length !== 4 || loading}
              onClick={() => void submit()}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Pay and get PIN"}
            </Button>
          </section>
        ) : null}
        {error ? (
          <p className="text-center text-xs font-semibold text-destructive">{error}</p>
        ) : null}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-extrabold">{value}</span>
    </div>
  );
}
