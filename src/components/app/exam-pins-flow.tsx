import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Minus, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

type ExamBody = {
  id: string;
  name: string;
  unitLabel: string;
};

const EXAMS: ExamBody[] = [
  { id: "waec", name: "WAEC", unitLabel: "Result checker PIN" },
  { id: "neco", name: "NECO", unitLabel: "Result checker PIN" },
  { id: "nabteb", name: "NABTEB", unitLabel: "Result checker PIN" },
  { id: "jamb", name: "JAMB", unitLabel: "e-PIN / profile" },
];

const MIN_Q = 1;
const MAX_Q = 10;

type Step = "exam" | "quantity" | "confirm";

/**
 * Exam body → quantity (typed) → review.
 * No phone step: PINs show on the receipt; a copy goes to the registered email.
 */
export function ExamPinsFlow() {
  const { profile } = useApp();
  const [step, setStep] = useState<Step>("exam");
  const [examId, setExamId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [qtyText, setQtyText] = useState("1");
  const [error, setError] = useState("");

  const exam = useMemo(() => EXAMS.find((e) => e.id === examId) ?? null, [examId]);
  const deliveryMessage = `PINs appear on your receipt. A copy is sent to ${profile?.email || "your registered email"}.`;

  const setQty = (n: number) => {
    const v = Math.min(MAX_Q, Math.max(MIN_Q, Math.round(n)));
    setQuantity(v);
    setQtyText(String(v));
    setError("");
  };

  const onQtyInput = (raw: string) => {
    if (raw === "") {
      setQtyText("");
      return;
    }
    if (!/^\d{1,2}$/.test(raw)) return;
    setQtyText(raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_Q && n <= MAX_Q) {
      setQuantity(n);
      setError("");
    }
  };

  const commitQty = () => {
    if (qtyText === "" || !Number.isFinite(Number(qtyText))) {
      setQty(1);
      return;
    }
    const n = Number(qtyText);
    if (n < MIN_Q || n > MAX_Q) {
      setError(`Enter a quantity between ${MIN_Q} and ${MAX_Q}`);
      setQty(Math.min(MAX_Q, Math.max(MIN_Q, n || 1)));
      return;
    }
    setQty(n);
  };

  return (
    <AppShell>
      <PageHeader title="Exam Pins" backTo="/services" />
      <div className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-2">
        <div className="flex items-center gap-1.5">
          {(["exam", "quantity", "confirm"] as Step[]).map((s, i) => {
            const order: Step[] = ["exam", "quantity", "confirm"];
            const active = order.indexOf(step) >= i;
            return (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted",
                )}
              />
            );
          })}
        </div>

        {step === "exam" ? (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Choose exam body</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select the exam you need result-checker or registration PINs for.
              </p>
            </div>
            <div className="grid gap-2">
              {EXAMS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setExamId(e.id);
                    setError("");
                    setStep("quantity");
                  }}
                  className={cn(
                    "press flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left shadow-soft",
                    examId === e.id
                      ? "border-primary bg-primary-soft ring-2 ring-primary/10"
                      : "border-border/70 bg-card",
                  )}
                >
                  <div>
                    <p className="text-sm font-extrabold">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{e.unitLabel}</p>
                  </div>
                  <CheckCircle2
                    className={cn(
                      "size-5",
                      examId === e.id ? "text-primary" : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === "quantity" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">How many PINs?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Type any number from {MIN_Q}–{MAX_Q}. PINs will show on your receipt.
              </p>
            </div>
            <div className="rounded-[26px] border border-border/70 bg-card p-5 shadow-soft">
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {exam.name} · quantity
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= MIN_Q}
                  onClick={() => setQty(quantity - 1)}
                  className="press grid size-11 place-items-center rounded-xl border border-border/70 bg-background disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <Input
                  inputMode="numeric"
                  value={qtyText}
                  onChange={(e) => onQtyInput(e.target.value)}
                  onBlur={commitQty}
                  className="h-14 w-20 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none focus-visible:ring-0"
                  aria-label="PIN quantity"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= MAX_Q}
                  onClick={() => setQty(quantity + 1)}
                  className="press grid size-11 place-items-center rounded-xl border border-border/70 bg-background disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                {deliveryMessage}
              </p>
              {error ? <p className="mt-2 text-center text-xs font-semibold text-destructive">{error}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl text-sm font-bold"
                onClick={() => setStep("exam")}
              >
                Back
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl text-sm font-bold"
                onClick={() => {
                  commitQty();
                  if (quantity < MIN_Q || quantity > MAX_Q) return;
                  setStep("confirm");
                }}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === "confirm" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Review</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm details before payment is enabled for exam pins.
              </p>
            </div>
            <div className="space-y-2 rounded-[26px] border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Exam</span>
                <span className="font-extrabold">{exam.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-extrabold tabular-nums">{quantity}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="shrink-0 text-muted-foreground">Delivery email</span>
                <span className="truncate text-right text-xs font-bold">
                  {profile?.email || "your registered email"}
                </span>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>{deliveryMessage}</p>
            </div>
            <div className="rounded-2xl border border-dashed border-border/70 bg-card px-4 py-4 text-center">
              <p className="text-sm font-extrabold">Live purchase coming soon</p>
              <p className="mt-1 text-xs text-muted-foreground">
                VTpass catalogue, unit pricing, and PIN delivery are being connected. Your wallet
                will not be charged yet.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl text-sm font-bold"
                onClick={() => setStep("quantity")}
              >
                Back
              </Button>
              <Button className="h-11 flex-1 rounded-xl text-sm font-bold" disabled>
                Coming soon — no charge
              </Button>
            </div>
            <Button variant="ghost" className="h-10 w-full text-xs font-semibold" asChild>
              <Link to="/services">Back to services</Link>
            </Button>
          </section>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl bg-primary-soft/60 px-3 py-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Best practice: choose exam → enter how many PINs you need → confirm delivery email → pay later. Codes appear
            on your receipt after a successful provider response.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
