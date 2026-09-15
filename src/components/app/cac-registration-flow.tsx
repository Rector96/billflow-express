/**
 * CAC Business Name registration — DEMO UI
 * See docs/CAC_BUSINESS_NAME.md
 * CAC_DEMO_MODE=true → no wallet debit, no CAC API
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Camera,
  CheckCircle2,
  Copy,
  Eraser,
  Home,
  IdCard,
  Info,
  Loader2,
  PenLine,
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

export const CAC_DEMO_PRICE = 27_500;
export const CAC_DEMO_MODE = true;

type Step =
  "intro" | "names" | "business" | "proprietor" | "documents" | "review" | "pay" | "success";

const STEPS: PayStepMeta[] = [
  { key: "intro", label: "Package" },
  { key: "names", label: "Names" },
  { key: "business", label: "Business" },
  { key: "proprietor", label: "Owner" },
  { key: "documents", label: "Documents" },
  { key: "review", label: "Review" },
  { key: "pay", label: "Pay" },
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
      <span className="font-bold">Demo mode.</span> No real CAC filing and no wallet charge yet.
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-xs font-bold text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
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
    ctx.strokeStyle = "#0f172a";
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);
  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        className="h-36 w-full touch-none rounded-2xl border border-border/80 bg-white shadow-soft"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Button
        type="button"
        variant="outline"
        className="h-9 rounded-xl text-xs font-bold"
        onClick={clear}
      >
        <Eraser className="mr-1.5 size-3.5" /> Clear signature
      </Button>
    </div>
  );
}

function FilePick({
  label,
  hint,
  icon: Icon,
  accept,
  valueName,
  onPick,
}: {
  label: string;
  hint: string;
  icon: typeof IdCard;
  accept: string;
  valueName: string | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="press flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed border-border/80 bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">{label}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <span className="text-xs font-semibold text-primary">
        {valueName ? `Selected: ${valueName}` : "Tap to choose file"}
      </span>
    </label>
  );
}

export function CacRegistrationFlow() {
  const navigate = useNavigate();
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
  const [startDate, setStartDate] = useState("");
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

  const stepIndex = useMemo(() => {
    const keys = STEPS.map((s) => s.key);
    return Math.max(0, keys.indexOf(step === "success" ? "pay" : step));
  }, [step]);

  const preferredName = name1.trim() || name2.trim() || name3.trim();

  const goBack = () => {
    const order: Step[] = [
      "intro",
      "names",
      "business",
      "proprietor",
      "documents",
      "review",
      "pay",
    ];
    const i = order.indexOf(step);
    if (i <= 0) {
      void navigate({ to: "/services" });
      return;
    }
    setStep(order[i - 1]!);
  };

  const demoPay = useCallback(async () => {
    if (!declare) {
      toast.error("Confirm the declaration before continuing.");
      return;
    }
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1200));
    setRefId(`CAC-DEMO-${Date.now().toString(36).toUpperCase()}`);
    setPaying(false);
    setStep("success");
    toast.success("Demo application recorded. No real payment was taken.");
  }, [declare]);

  return (
    <AppShell>
      <PageHeader
        title="CAC Registration"
        subtitle="Business Name"
        onBack={step === "success" ? () => void navigate({ to: "/home" }) : goBack}
      />
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-5 pb-28">
        {step !== "success" ? <PayStepper steps={STEPS} current={stepIndex} /> : null}
        {CAC_DEMO_MODE ? <DemoBanner /> : null}

        {step === "intro" ? (
          <section className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Start Business</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Register a <strong>CAC Business Name</strong> (sole proprietor style) — simpler
                  than a Limited Company.
                </p>
              </div>
            </div>
            <HelpNote>
              <strong>Business Name vs Ltd:</strong> A Business Name is faster and cheaper. Ltd
              needs share capital and more documents — that package comes later.
            </HelpNote>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Package
              </p>
              <p className="mt-1 text-base font-extrabold">Business Name registration</p>
              <p className="mt-3 text-2xl font-black tabular-nums text-primary">
                {formatNaira(CAC_DEMO_PRICE, false)}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li>• Guided form with review</li>
                <li>• ID, passport photo & signature</li>
                <li>• Track status & download certificate after go-live</li>
              </ul>
            </div>
            <HelpNote>
              You need your <strong>NIN</strong>, a clear <strong>ID photo</strong>, a{" "}
              <strong>passport photograph</strong>, and a signature. Final approval is by CAC.
            </HelpNote>
            <PayActionBar>
              <Button className="h-12 w-full rounded-xl font-bold" onClick={() => setStep("names")}>
                Start application
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "names" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Preferred names</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Up to three options. CAC may reject names that are taken or too similar.
              </p>
            </div>
            <HelpNote>
              Tip: e.g. <em>Brightpath Ventures</em>. Avoid government-sounding words.
            </HelpNote>
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="space-y-1.5">
                <Label>1st choice *</Label>
                <Input
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="e.g. Brightpath Ventures"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>2nd choice</Label>
                <Input
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  placeholder="Optional"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>3rd choice</Label>
                <Input
                  value={name3}
                  onChange={(e) => setName3(e.target.value)}
                  placeholder="Optional"
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (!name1.trim()) toast.error("Enter at least your first preferred name.");
                  else setStep("business");
                }}
              >
                Confirm names
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "business" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Business details</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Principal place of business and contacts.
              </p>
            </div>
            <HelpNote>
              Use a real Nigerian street address (not only a PO Box). Use phone/email you can
              answer.
            </HelpNote>
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="space-y-1.5">
                <Label>Nature of business</Label>
                <select
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {NATURE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Street *</Label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>City *</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>LGA *</Label>
                  <Input
                    value={lga}
                    onChange={(e) => setLga(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>State *</Label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {NG_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Business phone *</Label>
                <Input
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  inputMode="tel"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Business email *</Label>
                <Input
                  type="email"
                  value={bizEmail}
                  onChange={(e) => setBizEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Start date (optional)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (
                    !street.trim() ||
                    !city.trim() ||
                    !lga.trim() ||
                    !bizPhone.trim() ||
                    !bizEmail.trim()
                  )
                    toast.error("Complete address, phone and email.");
                  else setStep("proprietor");
                }}
              >
                Confirm business
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "proprietor" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Proprietor (owner)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Usually you — the person who owns the Business Name.
              </p>
            </div>
            <HelpNote>
              <strong>Name and DOB must match your NIN</strong> exactly. NIN is 11 digits.
            </HelpNote>
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="space-y-1.5">
                <Label>Full name (as on NIN) *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Gender *</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "Male" | "Female" | "")}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date of birth *</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nationality</Label>
                <Input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Occupation</Label>
                <Input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>NIN (11 digits) *</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>ID type</Label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as (typeof ID_TYPES)[number])}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {ID_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>ID number</Label>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  inputMode="tel"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Residential address *</Label>
                <Input
                  value={resAddress}
                  onChange={(e) => setResAddress(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (
                    !fullName.trim() ||
                    !gender ||
                    !dob ||
                    nin.length !== 11 ||
                    !ownerPhone.trim() ||
                    !ownerEmail.trim() ||
                    !resAddress.trim()
                  )
                    toast.error("Complete owner details. NIN must be 11 digits.");
                  else setStep("documents");
                }}
              >
                Confirm owner
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "documents" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Documents & signature</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear images only — blurry photos cause delays.
              </p>
            </div>
            <HelpNote>In demo mode, files stay on this device only.</HelpNote>
            <FilePick
              label="Means of identification"
              hint="NIN slip, passport, licence or voter card"
              icon={IdCard}
              accept="image/*"
              valueName={idFile?.name ?? null}
              onPick={setIdFile}
            />
            <FilePick
              label="Passport photograph"
              hint="Recent face photo, plain background"
              icon={Camera}
              accept="image/*"
              valueName={photoFile?.name ?? null}
              onPick={setPhotoFile}
            />
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <PenLine className="size-4 text-primary" />
                <p className="text-sm font-extrabold">Signature pad</p>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Sign with your finger or stylus.
              </p>
              <SignaturePad onChange={setSignature} />
              {signature ? (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> Signature captured
                </p>
              ) : null}
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (!idFile || !photoFile || !signature)
                    toast.error("Upload ID, photo, and sign.");
                  else setStep("review");
                }}
              >
                Continue to review
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "review" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Review application</h2>
              <p className="mt-1 text-xs text-muted-foreground">Use back to edit any section.</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card px-4 py-1 shadow-card">
              <Row
                label="Package"
                value={`Business Name · ${formatNaira(CAC_DEMO_PRICE, false)}`}
              />
              <Row label="1st name" value={name1} />
              <Row label="2nd name" value={name2} />
              <Row label="3rd name" value={name3} />
              <Row label="Nature" value={nature} />
              <Row label="Address" value={`${street}, ${city}, ${lga}, ${state}`} />
              <Row label="Business phone" value={bizPhone} />
              <Row label="Proprietor" value={fullName} />
              <Row label="NIN" value={nin} />
              <Row label="ID file" value={idFile?.name ?? ""} />
              <Row label="Photo" value={photoFile?.name ?? ""} />
              <Row label="Signature" value={signature ? "Captured" : "Missing"} />
            </div>
            <label className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border"
                checked={declare}
                onChange={(e) => setDeclare(e.target.checked)}
              />
              <span>
                I confirm the information is true. RockPay facilitates the application; final
                approval is by CAC. <strong>Demo mode — no real filing or charge.</strong>
              </span>
            </label>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (!declare) toast.error("Please accept the declaration.");
                  else setStep("pay");
                }}
              >
                Proceed to payment
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "pay" ? (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Payment</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Demo only — wallet will not be debited.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Amount due
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">
                {formatNaira(CAC_DEMO_PRICE, false)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                For <span className="font-bold text-foreground">{preferredName}</span>
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" /> When live: pay from
                wallet or dedicated transfer.
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                disabled={paying}
                onClick={() => void demoPay()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing demo…
                  </>
                ) : (
                  `Pay ${formatNaira(CAC_DEMO_PRICE, false)} (demo)`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "success" ? (
          <section className="space-y-5 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">Demo application saved</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No real CAC filing or payment happened. When live, users get email updates and
                download their certificate after approval.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 text-left shadow-card">
              <Row label="Reference" value={refId} />
              <Row label="Preferred name" value={preferredName} />
              <Row label="Amount" value={formatNaira(CAC_DEMO_PRICE, false)} />
              <Row label="Status" value="Demo · Awaiting connection" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl font-bold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(refId);
                    toast.success("Copied");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
              >
                <Copy className="mr-1.5 size-4" /> Copy ref
              </Button>
              <Button className="h-11 flex-1 rounded-xl font-bold" asChild>
                <Link to="/home">
                  <Home className="mr-1.5 size-4" /> Home
                </Link>
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
