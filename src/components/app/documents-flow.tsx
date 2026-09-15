/**
 * Automated Document Generator — DEMO UI
 * Business Constitution | Residential Tenancy Agreement
 * DOC_DEMO_MODE=true → no PDF engine / lawyer review / payment
 * See docs/TIN_AND_DOCUMENTS.md
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Copy,
  FileText,
  Home,
  Info,
  Loader2,
  ScrollText,
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

export const DOC_DEMO_MODE = true;
export const DOC_GENERATOR_FEE = 3000;

type DocType = "constitution" | "tenancy";
type Step = "type" | "form" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "type", label: "Type" },
  { key: "form", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Download" },
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
      <span className="font-bold">Demo mode.</span> Draft text only — not legal advice. No real PDF engine or payment yet.
    </div>
  );
}

function buildDraft(input: {
  type: DocType;
  partyA: string;
  partyB: string;
  address: string;
  rent: string;
  duration: string;
}): string {
  const today = new Date().toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (input.type === "constitution") {
    return [
      "BUSINESS CONSTITUTION (DEMO DRAFT)",
      "================================",
      `Date: ${today}`,
      "",
      `1. PARTIES`,
      `This constitution is adopted by ${input.partyA || "[Business / Proprietor]"} ("the Business").`,
      "",
      `2. PURPOSE`,
      "The Business is established to carry on lawful trade and related activities in Nigeria.",
      "",
      `3. MANAGEMENT`,
      `${input.partyB || "[Manager / Partner]"} may assist in day-to-day management as agreed in writing.`,
      "",
      `4. REGISTERED ADDRESS`,
      input.address || "[Business address]",
      "",
      `5. GENERAL`,
      "This demo document is a template outline only. Have a qualified professional review before use.",
      "",
      "— End of draft —",
    ].join("\n");
  }
  return [
    "RESIDENTIAL TENANCY AGREEMENT (DEMO DRAFT)",
    "==========================================",
    `Date: ${today}`,
    "",
    `LANDLORD: ${input.partyA || "[Landlord full name]"}`,
    `TENANT: ${input.partyB || "[Tenant full name]"}`,
    "",
    `PROPERTY`,
    input.address || "[Property address]",
    "",
    `RENT & TERM`,
    `Annual rent: ₦${input.rent || "[amount]"}`,
    `Duration: ${input.duration || "1 Year"}`,
    "",
    `The Tenant shall occupy the Property for the Duration and pay Rent as stated. The Landlord shall ensure quiet enjoyment subject to the Tenant observing this agreement.`,
    "",
    `This is a demo template for product flow testing only — not a substitute for legal advice.`,
    "",
    "— End of draft —",
  ].join("\n");
}

export function DocumentsFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("type");
  const [docType, setDocType] = useState<DocType | null>(null);
  const [partyA, setPartyA] = useState("");
  const [partyB, setPartyB] = useState("");
  const [address, setAddress] = useState("");
  const [rent, setRent] = useState("");
  const [duration, setDuration] = useState("1 Year");
  const [paying, setPaying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");

  const draft = useMemo(
    () =>
      buildDraft({
        type: docType ?? "tenancy",
        partyA,
        partyB,
        address,
        rent,
        duration,
      }),
    [docType, partyA, partyB, address, rent, duration],
  );

  const stepIndex = useMemo(() => {
    if (step === "type") return 0;
    if (step === "form") return 1;
    if (step === "preview") return 2;
    return 3;
  }, [step]);

  const validateForm = () => {
    if (!partyA.trim() || !partyB.trim()) {
      toast.error(
        docType === "constitution"
          ? "Enter business/proprietor and manager names."
          : "Enter landlord and tenant full names.",
      );
      return false;
    }
    if (!address.trim()) {
      toast.error("Enter the property or business address.");
      return false;
    }
    if (docType === "tenancy" && !rent.trim()) {
      toast.error("Enter rent amount per year.");
      return false;
    }
    return true;
  };

  const onPay = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 900));
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);
    setPaying(false);
    setStep("success");
    toast.success(DOC_DEMO_MODE ? "Demo payment complete" : "Document ready");
  };

  const downloadFile = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `rockpay-${docType ?? "document"}-${Date.now()}.txt`;
    a.click();
    toast.success("Download started (demo text file)");
  };

  const copyLink = async () => {
    const link = downloadUrl || `${window.location.origin}/documents#demo`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (step === "success") {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Document ready</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Demo draft generated. Live PDF export will replace the text download when connected.
          </p>

          <div className="w-full space-y-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={downloadFile}>
              <FileText className="mr-2 size-4" /> Download PDF
            </Button>
            <p className="text-[11px] text-muted-foreground">Demo file is plain text until a PDF engine is wired.</p>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                {downloadUrl || "blob:demo-download"}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-xl" onClick={() => void copyLink()}>
                <Copy className="size-3.5" />
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
                if (downloadUrl) URL.revokeObjectURL(downloadUrl);
                setDownloadUrl("");
                setStep("type");
                setDocType(null);
              }}
            >
              Create another
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Documents" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <DemoBanner />
        <PayStepper steps={STEPS} currentIndex={stepIndex} />

        {step === "type" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold tracking-tight">Choose document</h2>
            <p className="text-xs text-muted-foreground">Guided draft for common SME needs.</p>

            <button
              type="button"
              onClick={() => {
                setDocType("constitution");
                setStep("form");
              }}
              className="press flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-extrabold">Business Constitution</p>
                <p className="text-[11px] text-muted-foreground">Simple outline for a small business</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setDocType("tenancy");
                setStep("form");
              }}
              className="press flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-warning-soft text-warning">
                <ScrollText className="size-5" />
              </span>
              <div>
                <p className="text-sm font-extrabold">Residential Tenancy Agreement</p>
                <p className="text-[11px] text-muted-foreground">Landlord, tenant, rent & duration</p>
              </div>
            </button>

            <HelpNote>Not legal advice. Have a professional review important agreements before signing.</HelpNote>
          </section>
        ) : null}

        {step === "form" && docType ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Smart questionnaire</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {docType === "constitution" ? "Business details" : "Parties, property & rent"}
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <div className="space-y-1.5">
                <Label>{docType === "constitution" ? "Business / proprietor name" : "Landlord full name"}</Label>
                <Input
                  value={partyA}
                  onChange={(e) => setPartyA(e.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder={docType === "constitution" ? "e.g. Ada Ventures" : "Landlord name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{docType === "constitution" ? "Manager / partner name" : "Tenant full name"}</Label>
                <Input
                  value={partyB}
                  onChange={(e) => setPartyB(e.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder={docType === "constitution" ? "Optional partner" : "Tenant name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{docType === "constitution" ? "Business address" : "Property address"}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder="Street, city, state"
                />
              </div>
              {docType === "tenancy" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Rent amount per year (₦)</Label>
                    <Input
                      inputMode="numeric"
                      value={rent}
                      onChange={(e) => setRent(e.target.value.replace(/[^\d]/g, ""))}
                      className="h-12 rounded-2xl"
                      placeholder="e.g. 1200000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <Input
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="h-12 rounded-2xl"
                      placeholder="1 Year"
                    />
                  </div>
                </>
              ) : null}
            </div>

            <PayActionBar id="pay-action">
              <Button
                className="h-12 w-full rounded-2xl font-bold"
                onClick={() => {
                  if (!validateForm()) return;
                  setStep("preview");
                }}
              >
                Continue to preview
              </Button>
              <Button variant="ghost" className="mt-2 w-full text-xs font-bold" onClick={() => setStep("type")}>
                Change document type
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "preview" && docType ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Preview & pay</h2>
              <p className="mt-1 text-xs text-muted-foreground">Read-only draft. Fee unlocks download.</p>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-soft">
              <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground/90">{draft}</pre>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Document fee</span>
                <span className="font-extrabold tabular-nums">{formatNaira(DOC_GENERATOR_FEE, false)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border/60 pt-3 text-base">
                <span className="font-extrabold">Total</span>
                <span className="font-extrabold tabular-nums">{formatNaira(DOC_GENERATOR_FEE, false)}</span>
              </div>
            </div>

            <PayActionBar id="pay-action">
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPay()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Pay {formatNaira(DOC_GENERATOR_FEE, false)}</>
                )}
              </Button>
              <Button variant="ghost" className="mt-2 w-full text-xs font-bold" onClick={() => setStep("form")}>
                Edit answers
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
