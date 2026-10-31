/**
 * Document generator — fee from pricing_rules; pay records hub_orders for staff.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CheckCircle2,
  FileText,
  FolderOpen,
  Home,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { recordHubPayment } from "@/lib/hub.functions";
import { feeFromMap, type HubFeeMap } from "@/lib/hub-pricing.loader";
import { formatNaira } from "@/lib/mock-data";
import { isHubDemoOnly } from "@/lib/product-mode";

type DocType = "constitution" | "tenancy";
type Step = "type" | "form" | "preview" | "success";

const STEPS: PayStepMeta[] = [
  { key: "type", label: "Type" },
  { key: "form", label: "Details" },
  { key: "preview", label: "Pay" },
  { key: "done", label: "Done" },
];

function todayLong() {
  return new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export function DocumentsFlow({ fees = {} }: { fees?: HubFeeMap }) {
  const navigate = useNavigate();
  const { profile, authed } = useApp();
  const runRecord = useServerFn(recordHubPayment);
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
  const [trackId, setTrackId] = useState("");

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

  const validateForm = () => {
    if (partyA.trim().length < 2) {
      toast.error(
        docType === "constitution"
          ? "Enter the registered business name."
          : "Enter the landlord's full name.",
      );
      return false;
    }
    if (partyB.trim().length < 2) {
      toast.error(
        docType === "constitution"
          ? "Enter the manager's full name."
          : "Enter the tenant's full name.",
      );
      return false;
    }
    if (address.trim().length < 8) {
      toast.error("Enter the complete property or business address.");
      return false;
    }
    if (
      docType === "tenancy" &&
      (!rent.trim() ||
        !Number.isFinite(Number(rent.replace(/,/g, ""))) ||
        Number(rent.replace(/,/g, "")) <= 0)
    ) {
      toast.error("Enter a valid annual rent amount.");
      return false;
    }
    return true;
  };

  const onPayNow = async () => {
    if (isHubDemoOnly("documents")) {
      toast.error("Document generation is in preview. Payments are disabled until live fulfilment is ready.");
      return;
    }
    if (!docType) return;
    if (!authed) {
      toast.error("Please log in to continue.");
      navigate({ to: "/login" });
      return;
    }
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

      // Ledger for admin + My documents
      try {
        const logged = await runRecord({
          data: {
            service: "documents",
            amount: fee,
            paymentReference: paystack.reference,
            status: "successful",
            metadata: {
              documentType: docType,
              title: json.data.title,
              documentId: json.data.documentId,
              partyA,
              partyB,
              delivery: "download",
            },
          },
        });
        setTrackId(logged.trackingReference || paystack.reference);
      } catch (ledgerErr) {
        console.warn("[documents] hub_orders", ledgerErr);
        setTrackId(paystack.reference);
      }

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

  const field = "h-11 rounded-xl";

  if (step === "success" && apiResult) {
    const title = apiResult.data.title;
    return (
      <AppShell>
        <PageHeader title="Documents" backTo="/services" />
        <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <h1 className="text-lg font-bold">Ready</h1>
          {trackId ? (
            <p className="font-mono text-[10px] text-muted-foreground">{trackId}</p>
          ) : null}
          <Button
            className="h-12 w-full max-w-xs rounded-xl font-semibold"
            onClick={() =>
              downloadDocumentHtml(title, compiledBody || draft, apiResult.data.documentId)
            }
          >
            <FileText className="mr-2 size-4" /> Download
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full max-w-xs rounded-xl font-semibold"
            onClick={() => openPrintableDocument(title, compiledBody || draft)}
          >
            <Printer className="mr-2 size-4" /> Print
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full max-w-xs rounded-xl font-semibold"
            onClick={() => navigate({ to: "/profile/documents" })}
          >
            <FolderOpen className="mr-2 size-4" /> My documents
          </Button>
          <Button
            className="h-11 w-full max-w-xs rounded-xl font-semibold"
            onClick={() => navigate({ to: "/home" })}
          >
            <Home className="mr-2 size-4" /> Home
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Documents" backTo="/services" />
      <div className="documents-workflow mx-auto w-full max-w-5xl space-y-4 px-4 pb-28 pt-2">
        <PayStepper steps={STEPS} current={stepIndex} />
        {step === "type" ? (
          <section className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="press flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-4 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              onClick={() => {
                setDocType("constitution");
                setStep("form");
              }}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Building2 className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Business constitution</p>
                <p className="text-[11px] text-muted-foreground">{formatNaira(fee, false)}</p>
              </div>
            </button>
            <button
              type="button"
              className="press flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-4 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
              onClick={() => {
                setDocType("tenancy");
                setStep("form");
              }}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <ScrollText className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Tenancy agreement</p>
                <p className="text-[11px] text-muted-foreground">{formatNaira(fee, false)}</p>
              </div>
            </button>
          </section>
        ) : null}
        {step === "form" && docType ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] lg:items-start">
            <div className="form-section-card space-y-4">
              <div>
                <h2 className="form-section-heading">
                  {docType === "constitution" ? "Business details" : "Agreement parties"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Complete every required field. Your document preview will use these details.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="document-party-a">
                    {docType === "constitution"
                      ? "Registered business name"
                      : "Landlord's full name"}
                  </Label>
                  <Input
                    id="document-party-a"
                    value={partyA}
                    onChange={(e) => setPartyA(e.target.value)}
                    className={field}
                    placeholder={
                      docType === "constitution"
                        ? "Enter registered business name"
                        : "Enter landlord's full name"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document-party-b">
                    {docType === "constitution" ? "Manager's full name" : "Tenant's full name"}
                  </Label>
                  <Input
                    id="document-party-b"
                    value={partyB}
                    onChange={(e) => setPartyB(e.target.value)}
                    className={field}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="document-address">
                    {docType === "constitution" ? "Business address" : "Property address"}
                  </Label>
                  <Input
                    id="document-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={field}
                    placeholder="Street, area, city and state"
                  />
                </div>
                {docType === "tenancy" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="document-rent">Annual rent (₦)</Label>
                      <Input
                        id="document-rent"
                        value={rent}
                        onChange={(e) => setRent(e.target.value.replace(/[^0-9,]/g, ""))}
                        className={field}
                        placeholder="e.g. 850000"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document-duration">Agreement duration</Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger id="document-duration">
                          <SelectValue placeholder="Choose duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6 Months">6 Months</SelectItem>
                          <SelectItem value="1 Year">1 Year</SelectItem>
                          <SelectItem value="2 Years">2 Years</SelectItem>
                          <SelectItem value="3 Years">3 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <aside className="document-live-preview overflow-hidden rounded-2xl border border-border/70 bg-[#eef2f8] p-3 lg:sticky lg:top-5">
              <div className="flex items-center justify-between gap-2 px-1 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Live document
                  </p>
                  <p className="mt-1 text-sm font-semibold">Preview updates as you type</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                  Draft
                </span>
              </div>
              <div className="mx-auto max-h-[min(58dvh,620px)] min-h-[390px] max-w-[390px] overflow-y-auto rounded-md border border-border/60 bg-white px-5 py-6 text-slate-800 shadow-md sm:px-7">
                <div className="border-b border-slate-200 pb-4 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    RockPay document desk
                  </p>
                  <h3 className="mt-3 text-sm font-bold">
                    {docType === "constitution" ? "Business Constitution" : "Tenancy Agreement"}
                  </h3>
                  <p className="mt-1 text-[9px] text-slate-400">Draft preview • Not yet issued</p>
                </div>
                <div className="mt-5 space-y-3 text-[10px] leading-relaxed">
                  <p>
                    <strong>{docType === "constitution" ? "Business name" : "Landlord"}:</strong>{" "}
                    {partyA.trim() || "Not provided"}
                  </p>
                  <p>
                    <strong>{docType === "constitution" ? "Manager" : "Tenant"}:</strong>{" "}
                    {partyB.trim() || "Not provided"}
                  </p>
                  <p>
                    <strong>
                      {docType === "constitution" ? "Business address" : "Property address"}:
                    </strong>{" "}
                    {address.trim() || "Not provided"}
                  </p>
                  {docType === "tenancy" ? (
                    <>
                      <p>
                        <strong>Annual rent:</strong>{" "}
                        {rent.trim()
                          ? formatNaira(Number(rent.replace(/,/g, "")), false)
                          : "Not provided"}
                      </p>
                      <p>
                        <strong>Duration:</strong> {duration}
                      </p>
                    </>
                  ) : null}
                  <div className="border-t border-slate-200 pt-4">
                    <p className="font-bold">Agreement</p>
                    <p className="mt-2 text-slate-500">
                      {docType === "tenancy"
                        ? "The parties named above agree to the terms governing the tenancy of the property stated in this document, subject to review and execution."
                        : "This constitution sets out the business details and management information supplied by the applicant, subject to review and execution."}
                    </p>
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-5 pt-5 text-[9px] text-slate-400">
                    <div className="border-t border-slate-300 pt-2">Party A signature</div>
                    <div className="border-t border-slate-300 pt-2">Party B signature</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between px-1 pt-3 text-xs">
                <span className="text-muted-foreground">Service fee</span>
                <strong className="tabular-nums">{formatNaira(fee, false)}</strong>
              </div>
            </aside>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (validateForm()) setStep("preview");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}
        {step === "preview" ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] lg:items-start">
            <div className="max-h-[min(52dvh,520px)] overflow-y-auto rounded-xl border border-border/70 bg-card p-3 text-left text-[10px] leading-relaxed whitespace-pre-wrap">
              {draft}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between rounded-2xl border border-border/80 bg-card px-4 py-4 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums text-primary">{formatNaira(fee, false)}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {isHubDemoOnly("documents")
                  ? "This is a draft preview only. RockPay is not accepting payment or issuing official documents through this flow yet."
                  : "Please review the complete draft before paying. Payment will generate the downloadable document."}
              </p>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                disabled={paying || isHubDemoOnly("documents")}
                onClick={() => void onPayNow()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
                  </>
                ) : (
                  isHubDemoOnly("documents") ? "Payments unavailable" : `Pay ${formatNaira(fee, false)}`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
