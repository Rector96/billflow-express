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
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={field}
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
                      <Input
                        id="document-duration"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className={field}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <aside className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <FileText className="size-4 text-primary" /> Document checklist
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li>• Names must be spelt correctly.</li>
                <li>• Provide a complete address.</li>
                {docType === "tenancy" ? (
                  <li>• Enter the agreed annual rent and duration.</li>
                ) : (
                  <li>• Use the registered business name.</li>
                )}
              </ul>
              <p className="mt-4 border-t border-primary/10 pt-3 text-xs font-semibold text-foreground">
                Service fee: {formatNaira(fee, false)}
              </p>
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
                Please review the complete draft before paying. Payment will generate the
                downloadable document.
              </p>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                disabled={paying}
                onClick={() => void onPayNow()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
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
