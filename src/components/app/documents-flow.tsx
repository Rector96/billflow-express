/**
 * Automated Document Generator — DEMO UI + state / API payload shapes
 * DOC_DEMO_MODE=true → simulated Paystack + POST /api/v1/generate-document
 * See docs/TIN_AND_DOCUMENTS.md · src/lib/hub-api.types.ts
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
import {
  buildGenerateDocumentPayload,
  postGenerateDocumentDemo,
  simulatePaystackInline,
} from "@/lib/hub-api.demo";
import type { GenerateDocumentSuccess } from "@/lib/hub-api.types";
import { formatNaira } from "@/lib/mock-data";

export const DOC_DEMO_MODE = true;
export const DOC_GENERATOR_FEE = 3000;

type DocType = "constitution" | "tenancy";
type Step = "type" | "form" | "preview" | "success";

type DocFormState = {
  partyA: string;
  partyB: string;
  address: string;
  rent: string;
  duration: string;
};

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
      <span className="font-bold">Demo mode.</span> Paystack and generate-document API are simulated. Not legal
      advice.
    </div>
  );
}

function buildDraft(input: {
  type: DocType;
  form: DocFormState;
}): string {
  const today = new Date().toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const { form } = input;
  if (input.type === "constitution") {
    return [
      "BUSINESS CONSTITUTION (DEMO DRAFT)",
      "================================",
      `Date: ${today}`,
      "",
      `1. PARTIES`,
      `This constitution is adopted by ${form.partyA || "[Business / Proprietor]"} ("the Business").`,
      "",
      `2. PURPOSE`,
      "The Business is established to carry on lawful trade and related activities in Nigeria.",
      "",
      `3. MANAGEMENT`,
      `${form.partyB || "[Manager / Partner]"} may assist in day-to-day management as agreed in writing.`,
      "",
      `4. REGISTERED ADDRESS`,
      form.address || "[Business address]",
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
    `LANDLORD: ${form.partyA || "[Landlord full name]"}`,
    `TENANT: ${form.partyB || "[Tenant full name]"}`,
    "",
    `PROPERTY`,
    form.address || "[Property address]",
    "",
    `RENT & TERM`,
    `Annual rent: ₦${form.rent || "[amount]"}`,
    `Duration: ${form.duration || "1 Year"}`,
    "",
    `The Tenant shall occupy the Property for the Duration and pay Rent as stated.`,
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
  const [form, setForm] = useState<DocFormState>({
    partyA: "",
    partyB: "",
    address: "",
    rent: "",
    duration: "1 Year",
  });
  const [paying, setPaying] = useState(false);
  const [payPhase, setPayPhase] = useState<"idle" | "paystack" | "api">("idle");
  const [apiResult, setApiResult] = useState<GenerateDocumentSuccess | null>(null);
  const [localBlobUrl, setLocalBlobUrl] = useState("");

  const draft = useMemo(
    () => buildDraft({ type: docType ?? "tenancy", form }),
    [docType, form],
  );

  const stepIndex = useMemo(() => {
    if (step === "type") return 0;
    if (step === "form") return 1;
    if (step === "preview") return 2;
    return 3;
  }, [step]);

  const setField = <K extends keyof DocFormState>(key: K, value: DocFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = () => {
    if (!form.partyA.trim() || !form.partyB.trim()) {
      toast.error(
        docType === "constitution"
          ? "Enter business/proprietor and manager names."
          : "Enter landlord and tenant full names.",
      );
      return false;
    }
    if (!form.address.trim()) {
      toast.error("Enter the property or business address.");
      return false;
    }
    if (docType === "tenancy" && !form.rent.trim()) {
      toast.error("Enter rent amount per year.");
      return false;
    }
    return true;
  };

  const onPayNow = async () => {
    if (!docType || !validateForm()) return;
    setPaying(true);
    setPayPhase("paystack");
    try {
      const paystack = await simulatePaystackInline({
        email: "customer@rockpay.app",
        amountNaira: DOC_GENERATOR_FEE,
        metadata: { service: "generate_document", documentType: docType },
      });
      if (paystack.status !== "success" || !paystack.reference) {
        throw new Error("Payment was not completed.");
      }

      setPayPhase("api");
      const payload = buildGenerateDocumentPayload({
        documentType:
          docType === "constitution" ? "business_constitution" : "residential_tenancy",
        partyA: form.partyA,
        partyB: form.partyB,
        address: form.address,
        rent: form.rent,
        duration: form.duration,
        paymentReference: paystack.reference,
        fee: DOC_GENERATOR_FEE,
      });

      // Production:
      // await fetch("/api/v1/generate-document", { method: "POST", body: JSON.stringify(payload) })
      const json = await postGenerateDocumentDemo(payload, draft);

      const blob = new Blob([json.data.previewText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      setLocalBlobUrl(url);
      setApiResult(json);
      setStep("success");
      toast.success(`Paid · ref ${paystack.reference.slice(0, 12)}…`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate document.");
    } finally {
      setPaying(false);
      setPayPhase("idle");
    }
  };

  const downloadFile = () => {
    if (!localBlobUrl || !apiResult) return;
    const a = document.createElement("a");
    a.href = localBlobUrl;
    a.download = `rockpay-${apiResult.data.documentId}.txt`;
    a.click();
    toast.success("Download started (demo file)");
  };

  const copyLink = async () => {
    const link = apiResult?.data.downloadUrl || localBlobUrl;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (step === "success" && apiResult) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-8" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Document ready</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{apiResult.data.title}</p>

          <div className="w-full space-y-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={downloadFile}>
              <FileText className="mr-2 size-4" /> Download PDF
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Demo delivers text until a PDF engine is connected. API download URL is shown below.
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
              <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                {apiResult.data.downloadUrl}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 rounded-xl" onClick={() => void copyLink()}>
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Paystack · {apiResult.meta.paymentReference}
            </p>
          </div>

          <div className="mt-2 w-full space-y-2">
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
              <Home className="mr-2 size-4" /> Home
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl font-bold"
              onClick={() => {
                if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
                setLocalBlobUrl("");
                setApiResult(null);
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
                  value={form.partyA}
                  onChange={(e) => setField("partyA", e.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder={docType === "constitution" ? "e.g. Ada Ventures" : "Landlord name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{docType === "constitution" ? "Manager / partner name" : "Tenant full name"}</Label>
                <Input
                  value={form.partyB}
                  onChange={(e) => setField("partyB", e.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder={docType === "constitution" ? "Optional partner" : "Tenant name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{docType === "constitution" ? "Business address" : "Property address"}</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
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
                      value={form.rent}
                      onChange={(e) => setField("rent", e.target.value.replace(/[^\d]/g, ""))}
                      className="h-12 rounded-2xl"
                      placeholder="e.g. 1200000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <Input
                      value={form.duration}
                      onChange={(e) => setField("duration", e.target.value)}
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
              <p className="mt-1 text-xs text-muted-foreground">
                Paystack charge, then <code className="text-[10px]">POST /api/v1/generate-document</code>.
              </p>
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
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPayNow()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {payPhase === "paystack" ? "Opening Paystack…" : "Generating…"}
                  </>
                ) : (
                  <>Pay Now · {formatNaira(DOC_GENERATOR_FEE, false)}</>
                )}
              </Button>
              <Button variant="ghost" className="mt-2 w-full text-xs font-bold" disabled={paying} onClick={() => setStep("form")}>
                Edit answers
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
