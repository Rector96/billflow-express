// @ts-nocheck -- generated DB types are out of date with the live schema; re-enable after regenerating types.
/**
 * CAC Business Name — demo UI (compact RockPay steps)
 * Pay writes hub_orders when server allows; otherwise local demo success.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Camera,
  CheckCircle2,
  Copy,
  Eraser,
  Home,
  IdCard,
  Loader2,
  PenLine,
  ArrowRight,
  FileCheck2,
  UploadCloud,
  Truck,
  Download,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import {
  DeliveryAddressFields,
  PayBreakdown,
} from "@/components/app/hub-delivery-ui";
import { PageHeader } from "@/components/app/page-header";
import { PayActionBar } from "@/components/app/pay-action-bar";
import { PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearContinueDraft, saveContinueDraft } from "@/lib/continue-draft";
import { simulatePaystackInline } from "@/lib/hub-api.demo";
import {
  EMPTY_DELIVERY_ADDRESS,
  formatDeliveryOneLine,
  validateDeliveryAddress,
  type DeliveryAddress,
  type DeliveryMethod,
} from "@/lib/hub-delivery";
import { submitCacApplication } from "@/lib/hub-order-submit.functions";
import { SERVICE_PRICES } from "@/lib/hub-service-prices";
import { formatNaira } from "@/lib/mock-data";

export const CAC_DEMO_PRICE = SERVICE_PRICES.cac_registration;
export const CAC_COURIER_PRICE = SERVICE_PRICES.cac_courier;
export const CAC_DEMO_MODE = true;

type Step =
  | "intro"
  | "names"
  | "business"
  | "proprietor"
  | "documents"
  | "review"
  | "delivery"
  | "address"
  | "pay"
  | "success";

const STEPS: PayStepMeta[] = [
  { key: "names", label: "Business" },
  { key: "proprietor", label: "Owner" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Review & pay" },
];

const NATURE_OPTIONS = [
  "Retail trade",
  "Fashion & clothing",
  "Food & catering",
  "ICT / software",
  "Digital marketing",
  "General contracts",
  "Education / training",
  "Transport & logistics",
  "Agriculture",
  "Other services",
];

const ID_TYPES = [
  "NIN Slip",
  "International Passport",
  "Driver's Licence",
  "Voter's Card",
] as const;

const NG_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right text-xs font-semibold">{value || "—"}</span>
    </div>
  );
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(canvasRef.current).color;
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = getComputedStyle(canvas).backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);
  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        aria-label="Draw your signature"
        className="h-36 w-full touch-none rounded-lg border border-border bg-card text-foreground"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full rounded-xl text-xs"
        onClick={clear}
      >
        <Eraser className="mr-1.5 size-3.5" /> Clear
      </Button>
    </div>
  );
}

function FilePick({ label, icon: Icon, accept, file, onPick }: {
  label: string; icon: typeof IdCard; accept: string; file: File | null;
  onPick: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file?.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <label className={`press flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 transition-colors ${file ? "border-primary/40 bg-primary-soft/50" : "border-border bg-card hover:border-primary/50"}`}>
      {preview ? <img src={preview} alt={`${label} preview`} className="size-12 rounded-lg object-cover" /> :
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-5" /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{file ? file.name : accept.includes("pdf") ? "Image or PDF" : "Clear portrait photo"}</p>
        <p className="mt-1 text-[11px] text-primary">{file ? `${(file.size / 1024).toFixed(0)} KB · Replace file` : "Choose file"}</p>
      </div>
      {file ? <CheckCircle2 className="size-5 shrink-0 text-primary" /> : <UploadCloud className="size-5 shrink-0 text-muted-foreground" />}
      <input aria-label={label} type="file" accept={accept} className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function CacRegistrationFlow() {
  const navigate = useNavigate();
  const runSubmit = useServerFn(submitCacApplication);
  const [step, setStep] = useState<Step>("intro");
  const [paying, setPaying] = useState(false);
  const [refId, setRefId] = useState("");
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [name3, setName3] = useState("");
  const [nature, setNature] = useState(NATURE_OPTIONS[0] ?? "");
  const [bizPhone, setBizPhone] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [lga, setLga] = useState("");
  const [state, setState] = useState("Lagos");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("Nigerian");
  const [occupation, setOccupation] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [nin, setNin] = useState("");
  const [idType, setIdType] = useState<(typeof ID_TYPES)[number]>("NIN Slip");
  const [idNumber, setIdNumber] = useState("");
  const [resAddress, setResAddress] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [declare, setDeclare] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod | null>(null);
  const [shipTo, setShipTo] = useState<DeliveryAddress>(EMPTY_DELIVERY_ADDRESS);

  const stepIndex = useMemo(() => {
    const keys = STEPS.map((s) => s.key);
    const key = step === "success" ? "review" : step;
    return Math.max(0, keys.indexOf(key));
  }, [step]);

  const preferredName = name1.trim() || name2.trim() || name3.trim();
  const totalPay = CAC_DEMO_PRICE + (delivery === "deliver" ? CAC_COURIER_PRICE : 0);

  useEffect(() => {
    if (step === "success") {
      clearContinueDraft("cac-registration");
      return;
    }
    if (step === "intro") return;
    const labels: Record<string, string> = {
      names: "Preferred names",
      business: "Business details",
      proprietor: "Owner details",
      documents: "Documents",
      review: "Review",
      delivery: "How to receive",
      address: "Delivery address",
      pay: "Payment",
    };
    saveContinueDraft({
      id: "cac-registration",
      serviceSlug: "cac",
      title: preferredName ? `CAC · ${preferredName}` : "CAC registration",
      stepLabel: labels[step] ?? step,
      step: stepIndex + 1,
      totalSteps: STEPS.length,
      href: "/cac",
    });
  }, [step, stepIndex, preferredName]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  const goBack = () => {
    const order: Step[] = ["intro", "names", "proprietor", "documents", "review"];
    const previous = order[order.indexOf(step) - 1];
    if (previous) setStep(previous);
    else void navigate({ to: "/services" });
  };

  const onPay = useCallback(async () => {
    if (!declare) {
      toast.error("Tick the declaration to continue.");
      return;
    }
    if (!delivery) {
      toast.error("Choose how you want to receive your certificate.");
      return;
    }
    if (delivery === "deliver") {
      const err = validateDeliveryAddress(shipTo);
      if (err) {
        toast.error(err);
        return;
      }
    }
    setPaying(true);
    try {
      const email = (ownerEmail || bizEmail || "").trim() || "customer@rockpay.app";
      const paystack = await simulatePaystackInline({
        email,
        amountNaira: totalPay,
        metadata: {
          channel: "hub",
          service: "cac",
          service_type: "cac",
          preferred_name: preferredName || name1.trim(),
          nin,
          delivery,
        },
      });
      if (paystack.status !== "success") {
        throw new Error("Payment was not completed.");
      }

      const done = await runSubmit({
        data: {
          amount: totalPay,
          delivery,
          preferredName: preferredName || name1.trim(),
          nature,
          ownerName: fullName,
          nin,
          ownerPhone,
          ownerEmail,
          businessAddress: `${street}, ${city}, ${lga}, ${state}`,
          shippingAddress: delivery === "deliver" ? formatDeliveryOneLine(shipTo) : "",
          shipping:
            delivery === "deliver"
              ? {
                  phone: shipTo.phone,
                  street: shipTo.street,
                  area: shipTo.area,
                  lga: shipTo.lga,
                  state: shipTo.state,
                }
              : {},
          paymentReference: paystack.reference,
        },
      });
      setRefId(done.trackingReference || paystack.reference);
      setStep("success");
      toast.success("Payment received — application queued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }, [
    declare,
    delivery,
    shipTo,
    runSubmit,
    totalPay,
    preferredName,
    name1,
    bizEmail,
    nature,
    fullName,
    nin,
    ownerPhone,
    ownerEmail,
    street,
    city,
    lga,
    state,
  ]);

  const field = "h-12 min-w-0 rounded-lg bg-card text-base transition-colors focus-visible:border-primary sm:text-sm";
  const card = "cac-form-section space-y-4 border-b border-border/70 pb-5";

  return (
    <AppShell>
      <PageHeader
        title="CAC registration"
        subtitle="Business Name application"
        onBack={step === "success" ? () => void navigate({ to: "/home" }) : goBack}
      />
      <div className="cac-flow payment-flow-page mx-auto w-full max-w-md space-y-5 px-5 pt-4 pb-28">
        {step !== "success" && step !== "intro" ? <PayStepper steps={STEPS} current={stepIndex} className="rounded-lg" /> : null}

        {step === "intro" ? (
          <section className="space-y-6">
            <div className="space-y-4 pt-3">
              <span className="grid size-14 place-items-center rounded-lg bg-primary-soft text-primary"><Building2 className="size-7" /></span>
              <div><p className="mb-2 text-xs font-semibold text-primary">BUSINESS NAME · SOLE PROPRIETOR</p><h2 className="text-3xl font-bold leading-tight">Your business.<br />A new beginning.</h2></div>
              <p className="text-sm leading-relaxed text-muted-foreground">Prepare your Business Name application with your business details, identification and signature.</p>
            </div>
            <div className="flex items-end justify-between border-y border-border py-5"><div><p className="text-xs text-muted-foreground">Registration package</p><p className="mt-1 text-3xl font-bold text-primary">{formatNaira(CAC_DEMO_PRICE)}</p></div><span className="text-xs text-muted-foreground">Delivery optional</span></div>
            <div className="space-y-4">{[{ Icon: Building2, title: "Business & owner details", detail: "Preferred names, contact and addresses" }, { Icon: IdCard, title: "Identification & photo", detail: "Valid ID and a clear passport photograph" }, { Icon: PenLine, title: "Your signature", detail: "Digital signature for your application" }].map(({ Icon, title, detail }) => <div key={title} className="flex items-center gap-3"><Icon className="size-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>)}</div>
            <p className="rounded-lg bg-warning-soft p-3 text-xs leading-relaxed text-warning-foreground">Demo preview — no real CAC filing. Certificates are available only after processing.</p>
            <PayActionBar><Button className="h-12 w-full rounded-lg font-semibold" onClick={() => setStep("names")}>Start application <ArrowRight className="ml-2 size-4" /></Button></PayActionBar>
          </section>
        ) : null}

        {step === "names" ? (
          <section className="space-y-4">
            <div><h2 className="text-2xl font-bold">Business identity</h2><p className="mt-1 text-sm text-muted-foreground">Choose your preferred name and add your business details.</p></div>
            <div className={card}>
              <div className="space-y-2">
                <Label htmlFor="cac-field-1">1st choice *</Label>
                <Input id="cac-field-1"
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="e.g. Brightpath Ventures"
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-2">2nd (optional)</Label>
                <Input id="cac-field-2" value={name2} onChange={(e) => setName2(e.target.value)} className={field} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-3">3rd (optional)</Label>
                <Input id="cac-field-3" value={name3} onChange={(e) => setName3(e.target.value)} className={field} />
              </div>
            </div>
            <h3 className="pt-2 text-sm font-semibold">Business address & contact</h3>
            <div className={card}>
              <div className="space-y-2">
                <Label>Nature of business</Label>
                <Select value={nature} onValueChange={(value) => setNature(value)}><SelectTrigger className={field}><SelectValue /></SelectTrigger><SelectContent>{NATURE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-4">Street *</Label>
                <Input id="cac-field-4"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="cac-field-5">City *</Label>
                  <Input id="cac-field-5" value={city} onChange={(e) => setCity(e.target.value)} className={field} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cac-field-6">LGA *</Label>
                  <Input id="cac-field-6" value={lga} onChange={(e) => setLga(e.target.value)} className={field} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select value={state} onValueChange={(value) => setState(value)}><SelectTrigger className={field}><SelectValue /></SelectTrigger><SelectContent>{NG_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-7">Phone *</Label>
                <Input id="cac-field-7"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  inputMode="tel"
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-8">Email *</Label>
                <Input id="cac-field-8"
                  type="email"
                  value={bizEmail}
                  onChange={(e) => setBizEmail(e.target.value)}
                  className={field}
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (
                    !name1.trim() ||
                    !street.trim() ||
                    !city.trim() ||
                    !lga.trim() ||
                    !bizPhone.trim() ||
                    !bizEmail.trim()
                  )
                    toast.error("Enter your preferred name, business address, phone and email.");
                  else setStep("proprietor");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "proprietor" ? (
          <section className="space-y-4">
            <div><h2 className="text-2xl font-bold">Meet the proprietor</h2><p className="mt-1 text-sm text-muted-foreground">Use the details shown on your identification.</p></div>
            <div className={card}>
              <div className="space-y-2">
                <Label htmlFor="cac-field-9">Full name *</Label>
                <Input id="cac-field-9"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={gender} onValueChange={(value) => setGender(value as "Male" | "Female" | "")}
                    className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cac-field-10">Date of birth *</Label>
                  <Input id="cac-field-10"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(value)}
                    className={field}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-11">Nationality</Label>
                <Input id="cac-field-11"
                  value={nationality}
                  onChange={(e) => setNationality(value)}
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-12">Occupation</Label>
                <Input id="cac-field-12"
                  value={occupation}
                  onChange={(e) => setOccupation(value)}
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-13">Phone *</Label>
                <Input id="cac-field-13"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(value)}
                  inputMode="tel"
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-14">Email *</Label>
                <Input id="cac-field-14"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(value)}
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="cac-nin">NIN *</Label><span className={`text-xs tabular-nums ${nin.length === 11 ? "text-primary" : "text-muted-foreground"}`}>{nin.length}/11 digits</span></div>
                <Input id="cac-nin"
                  value={nin}
                  onChange={(e) => setNin(value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-15">ID type</Label>
                <select id="cac-field-15"
                  value={idType}
                  onChange={(e) => setIdType(value as (typeof ID_TYPES)[number])}><SelectTrigger className={field}><SelectValue /></SelectTrigger><SelectContent>{ID_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cac-field-16">ID number *</Label>
                <Input id="cac-field-16"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-2">
                <Label>Residential address *</Label>
                <label className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Checkbox checked={resAddress === `${street}, ${city}, ${lga}, ${state}`} onCheckedChange={(checked) => setResAddress(checked ? `${street}, ${city}, ${lga}, ${state}` : "")} />Same as business address</label>
                <Input
                  value={resAddress}
                  onChange={(e) => setResAddress(e.target.value)}
                  className={field}
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (
                    !fullName.trim() ||
                    !gender ||
                    !dob ||
                    !ownerPhone.trim() ||
                    !ownerEmail.trim() ||
                    nin.length !== 11 ||
                    !idNumber.trim() ||
                    !resAddress.trim()
                  )
                    toast.error("Complete required owner fields (NIN must be 11 digits).");
                  else setStep("documents");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "documents" ? (
          <section className="space-y-4">
            <div><h2 className="text-2xl font-bold">Documents & signature</h2><p className="mt-1 text-sm text-muted-foreground">Add clear, readable copies for your application.</p></div>
            <div className="space-y-2">
              <FilePick
                label="Valid ID"
                icon={IdCard}
                accept="image/*,application/pdf"
                file={idFile}
                onPick={setIdFile}
              />
              <FilePick
                label="Passport photo"
                icon={Camera}
                accept="image/*"
                file={photoFile}
                onPick={setPhotoFile}
              />
              <div className={card}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <PenLine className="size-4 text-primary" /> Signature
                </p>
                <SignaturePad onChange={setSignature} />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (!idFile || !photoFile || !signature)
                    toast.error("Upload ID, photo and sign.");
                  else setStep("review");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "review" ? (
          <section className="space-y-5">
            <div><h2 className="text-2xl font-bold">Review your application</h2><p className="mt-1 text-sm text-muted-foreground">Check your details and choose how to receive your certificate.</p></div>
            <div className={card}>
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-primary" /> Business details</h3><Button variant="ghost" size="sm" onClick={() => setStep("names")}><Pencil className="mr-1 size-3" />Edit</Button></div>
              <Row label="First choice" value={name1} /><Row label="Second choice" value={name2} /><Row label="Third choice" value={name3} /><Row label="Nature of business" value={nature} /><Row label="Address" value={`${street}, ${city}, ${lga}, ${state}`} /><Row label="Phone" value={bizPhone} /><Row label="Email" value={bizEmail} />
            </div>
            <div className={card}>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Proprietor details</h3><Button variant="ghost" size="sm" onClick={() => setStep("proprietor")}><Pencil className="mr-1 size-3" />Edit</Button></div>
              <Row label="Full name" value={fullName} /><Row label="Gender" value={gender} /><Row label="Date of birth" value={dob} /><Row label="Nationality" value={nationality} /><Row label="Occupation" value={occupation} /><Row label="Phone" value={ownerPhone} /><Row label="Email" value={ownerEmail} /><Row label="NIN" value={nin} /><Row label={idType} value={idNumber} /><Row label="Residential address" value={resAddress} />
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-primary" /> Documents attached</p><p className="mt-1 truncate text-xs text-muted-foreground">{idFile?.name} · {photoFile?.name}</p><p className="text-xs text-muted-foreground">Signature included</p></div><Button variant="ghost" size="sm" onClick={() => setStep("documents")}>Edit</Button></div>
            <div className="space-y-4"><h3 className="text-sm font-semibold">Receive your certificate</h3>{[{ method: "download", Icon: Download, title: "Digital certificate", detail: "PDF in My documents when ready", price: CAC_DEMO_PRICE }, { method: "deliver", Icon: Truck, title: "Print & delivery", detail: "Printed pack sent after processing", price: CAC_DEMO_PRICE + CAC_COURIER_PRICE }].map(({ method, Icon, title, detail, price }) => <Button key={method} type="button" variant="outline" aria-pressed={delivery === method} onClick={() => setDelivery(method as DeliveryMethod)} className={`h-auto w-full justify-start gap-3 whitespace-normal rounded-lg p-3 text-left ${delivery === method ? "border-primary bg-primary-soft" : "bg-card"}`}><Icon className="size-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] font-normal text-muted-foreground">{detail}</span></span><span className="shrink-0 text-xs font-semibold text-primary">{formatNaira(price)}</span></Button>)}</div>
            {delivery === "deliver" ? <DeliveryAddressFields value={shipTo} onChange={setShipTo} /> : null}
            <PayBreakdown lines={delivery === "deliver" ? [{ label: "CAC registration", amount: CAC_DEMO_PRICE }, { label: "Print + delivery", amount: CAC_COURIER_PRICE }] : [{ label: "CAC registration", amount: CAC_DEMO_PRICE }]} total={totalPay} />
            <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><Checkbox checked={declare} onCheckedChange={(checked) => setDeclare(checked === true)} className="mt-1" /><span>I confirm that the details provided are correct. This is a demo application.</span></label>
            <PayActionBar><Button className="h-12 w-full rounded-lg font-semibold" disabled={paying} onClick={() => void onPay()}>{paying ? <><Loader2 className="mr-2 size-4 animate-spin" />Please wait…</> : `Pay ${formatNaira(totalPay)}`}</Button></PayActionBar>
          </section>
        ) : null}

        {step === "success" ? (
          <section className="flex min-h-[55dvh] flex-col items-center justify-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success result-pop">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="text-lg font-bold">Application received</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {delivery === "deliver"
                ? "We’ll process your CAC, then send the printed pack."
                : "We’ll process your CAC. Check My documents when the file is ready."}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">{refId}</p>
            <Button
              variant="outline"
              className="h-9 rounded-xl text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(refId);
                toast.success("Copied");
              }}
            >
              <Copy className="mr-1.5 size-3.5" /> Copy ref
            </Button>
            <Button
              className="mt-2 h-12 w-full max-w-xs rounded-xl font-semibold"
              onClick={() => void navigate({ to: "/home" })}
            >
              <Home className="mr-2 size-4" /> Home
            </Button>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
