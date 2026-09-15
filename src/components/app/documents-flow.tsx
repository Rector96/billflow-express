/**
 * Automated Document Generator
 * Tenancy: live template compiler (Nigerian-style layout) + print/HTML download
 * Payment: simulated / sandbox Paystack via hub-api.demo (test keys when you wire real Pop)
 * See docs/TIN_AND_DOCUMENTS.md · src/lib/document-templates.ts
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
  Printer,
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
import {
  compileBusinessConstitution,
  compileResidentialTenancyAgreement,
  downloadDocumentHtml,
  openPrintableDocument,
} from "@/lib/document-templates";
import { formatNaira } from "@/lib/mock-data";

/** Payment still uses Paystack simulation / your demo account path — not a live charge until Pop is wired. */
export const DOC_PAYSTACK_DEMO = true;
export const DOC_GENERATOR_FEE = 3000;

type DocType = "constitution" | "tenancy";
type Step = "type" | "form" | "preview" | "success";

type DocFormState = {
  partyA: string;
  partyB: string;
  address: string;
  rent: string;
  duration: string;
  startDate: string;
};

const STEPS: PayStepMeta[] = [
  { key: "type", label: "Type" },
  { key: "form", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Download" },
];

function todayLong(): string {
  return new Date().toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function HelpNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div>{children}</div>
    </div>
  );
}

function StatusBanner() {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
      <span className="font-bold">Document compiler active.</span> Tenancy text is generated from your
      inputs. Payment uses your <span className="font-semibold">Paystack test/demo</span> path — not a
      production charge. Not legal advice.
    </div>
  );
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
    startDate: todayLong(),
  });
  const [paying, setPaying] = useState(false);
  const [payPhase, setPayPhase] = useState<"idle" | "paystack" | "api">("idle");
  const [apiResult, setApiResult] = useState<GenerateDocumentSuccess | null>(null);
  const [compiledBody, setCompiledBody] = useState("");

  const agreementDate = todayLong();

  const draft = useMemo(() => {
    if (docType === "tenancy") {
      return compileResidentialTenancyAgreement({
        landlordName: form.partyA,
        tenantName: form.partyB,
        propertyAddress: form.address,
        duration: form.duration,
        rentAmount: form.rent,
        agreementDate,
        startDate: form.startDate.trim() || agreementDate,
      });
    }
    if (docType === "constitution") {
      return compileBusinessConstitution({
        businessName: form.partyA,
        managerName: form.partyB,
        businessAddress: form.address,
        agreementDate,
      });
    }
    return "";
  }, [docType, form, agreementDate]);

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

  const docTitle =
    docType === "constitution" ? "Business Constitution" : "Tenancy Agreement";

  const onPayNow = async () => {
    if (!docType || !validateForm()) return;
    setPaying(true);
    setPayPhase("paystack");
    try {
      // Demo / test Paystack account path — replace simulate with real PaystackPop when keys are live
      const paystack = await simulatePaystackInline({
        email: "customer@rockpay.app",
        amountNaira: DOC_GENERATOR_FEE,
        metadata: { service: "generate_document", documentType: docType },
      });
      if (paystack.status !== "success" || !paystack.reference) {
        throw new Error("Payment was not completed.");
      }

      setPayPhase("api");
      const body = draft;
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

      const json = await postGenerateDocumentDemo(payload, body);
      setCompiledBody(body);
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

  const onPrint = () => {
    try {
      openPrintableDocument(docTitle, compiledBody || draft);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open print view");
    }
  };

  const onDownload = () => {
    const id = apiResult?.data.documentId ?? `doc-${Date.now()}`;
    downloadDocumentHtml(docTitle, compiledBody || draft, `rockpay-${id}`);
    toast.success("HTML document downloaded — open and print to PDF if needed");
  };

  const copyLink = async () => {
    const link = apiResult?.data.downloadUrl;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("API link copied");
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
            <Button className="h-12 w-full rounded-2xl font-bold" onClick={onDownload}>
              <FileText className="mr-2 size-4" /> Download document
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-2xl font-bold" onClick={onPrint}>
              <Printer className="mr-2 size-4" /> Print / Save as PDF
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Print opens a clean legal layout. Use your browser’s “Save as PDF” if you need a PDF file.
            </p>
            {apiResult.data.downloadUrl ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                  {apiResult.data.downloadUrl}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-xl"
                  onClick={() => void copyLink()}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            ) : null}
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
                setApiResult(null);
                setCompiledBody("");
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
        <StatusBanner />
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
                <p className="text-[11px] text-muted-foreground">Live template · landlord, tenant, rent</p>
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
                  <div className="space-y-1.5">
                    <Label>Commencement date</Label>
                    <Input
                      value={form.startDate}
                      onChange={(e) => setField("startDate", e.target.value)}
                      className="h-12 rounded-2xl"
                      placeholder={agreementDate}
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
                Live compiled text. Pay with your Paystack test account, then download or print.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-soft">
              <pre className="whitespace-pre-wrap font-serif text-[11px] leading-relaxed text-foreground/90">
                {draft}
              </pre>
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
                    {payPhase === "paystack" ? "Paystack (test)…" : "Compiling…"}
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
