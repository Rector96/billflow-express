/**
 * JTB TIN Retrieval — DEMO UI
 * Flow: Input → Preview & Pay → Success
 * TIN_DEMO_MODE=true → no JTB/FIRS API, no wallet debit
 * See docs/TIN_AND_DOCUMENTS.md
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Copy,
  FileDown,
  Hash,
  Home,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const TIN_DEMO_MODE = true;
export const TIN_RETRIEVE_FEE = 1500;

type Step = "input" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "input", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Result" },
];

function HelpNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="font-bold">Demo mode.</span> No real JTB/FIRS lookup and no wallet charge yet.
    </div>
  );
}

/** Deterministic demo TIN from input (not a real tax ID). */
function demoTinFromInput(id: string): string {
  const digits = id.replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
  const a = digits.slice(0, 8);
  const b = String((Number(digits.slice(-3)) % 9000) + 1000);
  return `${a}-${b}`;
}

export function TinJtbFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("input");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [paying, setPaying] = useState(false);
  const [revealedTin, setRevealedTin] = useState("");

  const stepIndex = useMemo(() => {
    if (step === "input") return 0;
    if (step === "preview") return 1;
    return 2;
  }, [step]);

  const blurredTin = useMemo(() => {
    const t = demoTinFromInput(identifier || "00000000000");
    return `${t.slice(0, 4)}••••-${t.slice(-2)}`;
  }, [identifier]);

  const validateInput = () => {
    const id = identifier.replace(/\s/g, "").trim();
    if (id.length < 7) {
      toast.error("Enter your 11-digit NIN or CAC business number.");
      return false;
    }
    if (fullName.trim().length < 3) {
      toast.error("Enter the full name on the record.");
      return false;
    }
    return true;
  };

  const onPay = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 900));
    setRevealedTin(demoTinFromInput(identifier));
    setPaying(false);
    setStep("success");
    toast.success(TIN_DEMO_MODE ? "Demo payment complete" : "Payment successful");
  };

  const copyTin = async () => {
    if (!revealedTin) return;
    try {
      await navigator.clipboard.writeText(revealedTin);
      toast.success("TIN copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadReceipt = () => {
    const body = [
      "RockPay — TIN Retrieval (Demo Receipt)",
      "--------------------------------",
      `Name: ${fullName.trim()}`,
      `Lookup ID: ${identifier.trim()}`,
      `TIN: ${revealedTin}`,
      `Fee: ${TIN_RETRIEVE_FEE}`,
      `Date: ${new Date().toISOString()}`,
      "",
      "This is a demo receipt. Live JTB retrieval is not connected yet.",
    ].join("\n");
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rockpay-tin-receipt-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  };

  if (step === "success") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Your TIN is ready</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Demo result for {fullName.trim()}. Live tax records will replace this when JTB is connected.
          </p>

          <div className="w-full rounded-2xl border border-border/70 bg-card p-5 text-left shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tax Identification Number
            </p>
            <p className="mt-2 break-all font-mono text-2xl font-extrabold tracking-wide tabular-nums">
              {revealedTin}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void copyTin()}>
                <Copy className="mr-1.5 size-3.5" /> Copy TIN
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={downloadReceipt}>
                <FileDown className="mr-1.5 size-3.5" /> Download receipt
              </Button>
            </div>
          </div>

          <div className="mt-2 w-full space-y-2">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
              <Home className="mr-2 size-4" /> Home
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => {
                setStep("input");
                setRevealedTin("");
              }}
            >
              Look up another
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="TIN Retrieval" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <DemoBanner />
        <PayStepper steps={STEPS} currentIndex={stepIndex} />

        {step === "input" ? (
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Hash className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Find your TIN</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Use the NIN or CAC number linked to the tax record, plus the full name.
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="space-y-1.5">
                <Label htmlFor="tin-id">NIN or CAC number</Label>
                <Input
                  id="tin-id"
                  inputMode="numeric"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="11-digit NIN or RC / BN number"
                  className="h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tin-name">Full name</Label>
                <Input
                  id="tin-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Name on the tax / CAC record"
                  className="h-12 rounded-2xl"
                />
              </div>
            </div>

            <HelpNote>
              Personal TIN is often linked to NIN. Business TIN may use your CAC registration number. This demo only
              simulates a match.
            </HelpNote>

            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                onClick={() => {
                  if (!validateInput()) return;
                  setStep("preview");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "preview" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Preview & pay</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                We found a matching demo record. Pay to reveal the full TIN.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" /> Match found
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-bold">{fullName.trim()}</p>
              <p className="mt-3 text-xs text-muted-foreground">TIN (hidden until paid)</p>
              <p
                className={cn(
                  "mt-1 select-none font-mono text-xl font-extrabold tracking-wide blur-[6px]",
                )}
                aria-hidden
              >
                {blurredTin}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">••••••••••••</p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Payment summary
              </p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Service</span>
                <span className="font-bold">JTB TIN retrieval</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Convenience fee</span>
                <span className="font-extrabold tabular-nums">{formatNaira(TIN_RETRIEVE_FEE, false)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(TIN_RETRIEVE_FEE, false)}</span>
              </div>
            </div>

            <HelpNote>In production this will debit wallet or open checkout. Demo only simulates payment.</HelpNote>

            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPay()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Pay {formatNaira(TIN_RETRIEVE_FEE, false)}</>
                )}
              </Button>
              <Button variant="ghost" className="mt-2 w-full text-xs font-bold" onClick={() => setStep("input")}>
                Edit details
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
