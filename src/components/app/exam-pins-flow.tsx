import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Step = "exam" | "quantity" | "phone" | "confirm";

function isValidNgMobile(input: string): boolean {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  return /^0[789][01]\d{8}$/.test(d);
}

function displayNgPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("234") && d.length === 13) d = `0${d.slice(3)}`;
  if (d.length === 10 && /^[789]/.test(d)) d = `0${d}`;
  return d;
}

/**
 * Modern exam-pin purchase UX (industry-standard for NG VTU):
 * Exam body → quantity (typed, not package presets) → phone → review.
 * Payment remains disabled until live VTpass exam settlement is enabled.
 */
export function ExamPinsFlow() {
  const [step, setStep] = useState<Step>("exam");
  const [examId, setExamId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [qtyText, setQtyText] = useState("1");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const exam = useMemo(() => EXAMS.find((e) => e.id === examId) ?? null, [examId]);

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
          {(["exam", "quantity", "phone", "confirm"] as Step[]).map((s, i) => {
            const order: Step[] = ["exam", "quantity", "phone", "confirm"];
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
            <div className="grid grid-cols-2 gap-2.5">
              {EXAMS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setExamId(e.id);
                    setStep("quantity");
                  }}
                  className={cn(
                    "rounded-2xl border bg-card px-3 py-4 text-left shadow-soft transition-colors press",
                    examId === e.id
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-border/80 hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-extrabold">{e.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{e.unitLabel}</p>
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
                Type any number from {MIN_Q}–{MAX_Q}. Ideal for single students or bulk for schools.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {exam.name} · quantity
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= MIN_Q}
                  onClick={() => setQty(quantity - 1)}
                  className="grid size-12 place-items-center rounded-2xl border border-border/80 bg-background text-foreground shadow-soft disabled:opacity-40 press"
                >
                  <Minus className="size-5" />
                </button>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={qtyText}
                  onChange={(e) => onQtyInput(e.target.value)}
                  onBlur={commitQty}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitQty();
                    }
                  }}
                  className="h-14 w-24 rounded-2xl border-border/80 text-center text-2xl font-extrabold tabular-nums shadow-soft"
                  aria-label="Number of pins"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= MAX_Q}
                  onClick={() => setQty(quantity + 1)}
                  className="grid size-12 place-items-center rounded-2xl border border-border/80 bg-background text-foreground shadow-soft disabled:opacity-40 press"
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                You can also type the number directly
              </p>
              {error ? <p className="mt-2 text-center text-xs font-semibold text-destructive">{error}</p> : null}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={() => setStep("exam")}
              >
                Back
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={() => {
                  commitQty();
                  if (quantity < MIN_Q || quantity > MAX_Q) return;
                  setStep("phone");
                }}
              >
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {step === "phone" && exam ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Delivery phone</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                PINs will be shown on your receipt. Phone is used for provider delivery records.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-phone">Phone number</Label>
              <Input
                id="exam-phone"
                inputMode="tel"
                placeholder="080 0000 0000"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError("");
                }}
                className="h-12 rounded-2xl text-base shadow-soft"
              />
              {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={() => setStep("quantity")}
              >
                Back
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={() => {
                  if (!isValidNgMobile(phone)) {
                    setError("Enter a valid Nigerian mobile number");
                    return;
                  }
                  setPhone(displayNgPhone(phone));
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
              <h2 className="text-lg font-extrabold tracking-tight">Review order</h2>
              <p className="mt-1 text-xs text-muted-foreground">Confirm details before payment goes live.</p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/80 bg-card p-4 shadow-card text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Exam</span>
                <span className="font-bold">{exam.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Product</span>
                <span className="font-bold text-right">{exam.unitLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-extrabold tabular-nums">{quantity}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-mono text-xs font-bold">{displayNgPhone(phone)}</span>
              </div>
            </div>

            <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft/50 px-3.5 py-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">Payment not enabled yet</p>
                <p className="mt-1">
                  Live VTpass catalogue, unit pricing, and PIN delivery are being connected. Your wallet will not be
                  charged. Quantity and phone are ready for the launch flow.
                </p>
              </div>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-xl text-sm font-bold"
              onClick={() => {
                toast.message("Exam pins are coming soon — wallet not charged.");
              }}
            >
              Coming soon — no charge
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl font-bold"
              onClick={() => setStep("phone")}
            >
              Edit details
            </Button>
            <Button type="button" variant="ghost" className="h-10 w-full rounded-xl text-xs font-bold" asChild>
              <Link to="/services">Back to services</Link>
            </Button>
          </section>
        ) : null}

        <div className="flex items-start gap-2 rounded-2xl bg-primary-soft/60 px-3 py-3 text-[11px] text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Best practice: choose exam → enter how many PINs you need → confirm phone → pay. Codes appear on your
            receipt after a successful provider response.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
