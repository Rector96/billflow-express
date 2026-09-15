/**
 * Document generator — fee from route loader (pricing_rules.documents)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, FileText, Home, Loader2, Printer, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-store";
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
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";

type DocType = "constitution" | "tenancy";
type Step = "type" | "form" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "type", label: "Type" },
  { key: "form", label: "Details" },
  { key: "preview", label: "Preview" },
  { key: "pay", label: "Download" },
];

function todayLong() {
  return new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export function DocumentsFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile } = useApp();
  const fee = feeFromMap(fees, "documents");

  const [step, setStep] = useState<Step>("type");
  const [docType, setDocType] = useState<DocType | null>(null);
  const [partyA, setPartyA] = useState("");
  const [partyB, setPartyB] = useState("");
  const [address, setAddress] = useState("");
  const [rent, setRent] = useState("");
  const [duration, setDuration] = useState("1 Year");
  const [paying, setPaying] = useState(false);
  const [apiResult, setApiResult] = useState<GenerateDocumentSuccess | null>(null);
  const [compiledBody, setCompiledBody] = useState("");

  const agreementDate = todayLong();
  const draft = useMemo(() => {
    if (docType === "tenancy") {
      return compileResidentialTenancyAgreement({
        landlordName: partyA,
        tenantName: partyB,
        propertyAddress: address,
        duration,
        rentAmount: rent,
        agreementDate,
        startDate: agreementDate,
      });
    }
    if (docType === "constitution") {
      return compileBusinessConstitution({
        businessName: partyA,
        managerName: partyB,
        businessAddress: address,
        agreementDate,
      });
    }
    return "";
  }, [docType, partyA, partyB, address, rent, duration, agreementDate]);

  const stepIndex = useMemo(() => {
    if (step === "type") return 0;
    if (step === "form") return 1;
    if (step === "preview") return 2;
    return 3;
  }, [step]);

  const onPayNow = async () => {
    if (!docType) return;
    setPaying(true);
    try {
      const email = profile.email?.trim() || "customer@rockpay.app";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: fee,
        metadata: { service: "documents", documentType: docType },
      });
      if (paystack.status !== "success") throw new Error("Payment was not completed.");
      const payload = buildGenerateDocumentPayload({
        documentType: docType === "constitution" ? "business_constitution" : "residential_tenancy",
        partyA,
        partyB,
        address,
        rent,
        duration,
        paymentReference: paystack.reference,
        fee,
      });
      const json = await postGenerateDocumentDemo(payload, draft);
      setCompiledBody(draft);
      setApiResult(json);
      setStep("success");
      toast.success("Document ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate document.");
    } finally {
      setPaying(false);
    }
  };

  if (step === "success" && apiResult) {
    const title = apiResult.data.title;
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h1 className="text-xl font-extrabold">Document ready</h1>
          <Button
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => downloadDocumentHtml(title, compiledBody || draft, apiResult.data.documentId)}
          >
            <FileText className="mr-2 size-4" /> Download
          </Button>
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl font-bold"
            onClick={() => openPrintableDocument(title, compiledBody || draft)}
          >
            <Printer className="mr-2 size-4" /> Print / PDF
          </Button>
          <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => navigate({ to: "/home" })}>
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Documents" backTo="/services" />
      <div className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />
        {step === "type" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold">Choose document</h2>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left"
              onClick={() => {
                setDocType("constitution");
                setStep("form");
              }}
            >
              <Building2 className="size-5 text-primary" />
              <div>
                <p className="font-extrabold">Business Constitution</p>
                <p className="text-xs text-muted-foreground">{formatNaira(fee, false)}</p>
              </div>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left"
              onClick={() => {
                setDocType("tenancy");
                setStep("form");
              }}
            >
              <ScrollText className="size-5 text-primary" />
              <div>
                <p className="font-extrabold">Residential Tenancy</p>
                <p className="text-xs text-muted-foreground">{formatNaira(fee, false)}</p>
              </div>
            </button>
          </section>
        ) : null}
        {step === "form" && docType ? (
          <section className="space-y-3">
            <div className="space-y-1.5">
              <Label>{docType === "constitution" ? "Business name" : "Landlord"}</Label>
              <Input value={partyA} onChange={(e) => setPartyA(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label>{docType === "constitution" ? "Manager" : "Tenant"}</Label>
              <Input value={partyB} onChange={(e) => setPartyB(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            {docType === "tenancy" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Rent / year (₦)</Label>
                  <Input value={rent} onChange={(e) => setRent(e.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration</Label>
                  <Input value={duration} onChange={(e) => setDuration(e.target.value)} className="h-12 rounded-2xl" />
                </div>
              </>
            ) : null}
            <PayActionBar>
              <Button className="h-12 w-full rounded-2xl font-bold" onClick={() => setStep("preview")}>
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}
        {step === "preview" ? (
          <section className="space-y-4">
            <div className="max-h-48 overflow-y-auto rounded-2xl border border-border/70 bg-card p-3 text-left text-[11px] whitespace-pre-wrap">
              {draft}
            </div>
            <div className="flex justify-between rounded-2xl border border-border/70 bg-card p-4 font-extrabold">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(fee, false)}</span>
            </div>
            <PayActionBar>
              <Button className="h-12 w-full rounded-2xl font-bold" disabled={paying} onClick={() => void onPayNow()}>
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Opening Paystack…
                  </>
                ) : (
                  `Pay ${formatNaira(fee, false)}`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
