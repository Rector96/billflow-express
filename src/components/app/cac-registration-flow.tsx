/**
 * CAC Business Name — demo UI (compact mobile steps)
 * CAC_DEMO_MODE: no wallet / no real filing
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  { key: "documents", label: "Docs" },
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
        height={180}
        className="h-28 w-full touch-none rounded-xl border border-border/80 bg-white"
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

function FilePick({
  label,
  icon: Icon,
  accept,
  valueName,
  onPick,
}: {
  label: string;
  icon: typeof IdCard;
  accept: string;
  valueName: string | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="press flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border/80 bg-card px-3 py-3">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {valueName ? valueName : "Tap to upload"}
        </p>
      </div>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
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
      toast.error("Tick the declaration to continue.");
      return;
    }
    setPaying(true);
    await new Promise((r) => setTimeout(r, 900));
    setRefId(`CAC-DEMO-${Date.now().toString(36).toUpperCase()}`);
    setPaying(false);
    setStep("success");
    toast.success("Demo only — no real payment.");
  }, [declare]);

  const field = "h-11 rounded-xl";
  const card = "space-y-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft";

  return (
    <AppShell>
      <PageHeader
        title="CAC"
        subtitle="Business Name"
        onBack={step === "success" ? () => void navigate({ to: "/home" }) : goBack}
      />
      <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-1 pb-28">
        {step !== "success" ? <PayStepper steps={STEPS} current={stepIndex} /> : null}

        {step === "intro" ? (
          <section className="space-y-3">
            <div className={card}>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold">Business Name</h2>
                  <p className="text-xs text-muted-foreground">Sole proprietor</p>
                </div>
              </div>
              <p className="pt-1 text-2xl font-bold tabular-nums text-primary">
                {formatNaira(CAC_DEMO_PRICE)}
              </p>
              <p className="text-[11px] text-muted-foreground">Form · ID · photo · signature</p>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => setStep("names")}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "names" ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Preferred names</h2>
            <div className={card}>
              <div className="space-y-1">
                <Label>1st choice *</Label>
                <Input
                  value={name1}
                  onChange={(e) => setName1(e.target.value)}
                  placeholder="e.g. Brightpath Ventures"
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>2nd (optional)</Label>
                <Input value={name2} onChange={(e) => setName2(e.target.value)} className={field} />
              </div>
              <div className="space-y-1">
                <Label>3rd (optional)</Label>
                <Input value={name3} onChange={(e) => setName3(e.target.value)} className={field} />
              </div>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => {
                  if (!name1.trim()) toast.error("Enter your first name choice.");
                  else setStep("business");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "business" ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Business</h2>
            <div className={card}>
              <div className="space-y-1">
                <Label>Nature of business</Label>
                <select
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                  className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                >
                  {NATURE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Street *</Label>
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>City *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className={field} />
                </div>
                <div className="space-y-1">
                  <Label>LGA *</Label>
                  <Input value={lga} onChange={(e) => setLga(e.target.value)} className={field} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                >
                  {NG_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Phone *</Label>
                <Input
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  inputMode="tel"
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input
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
                    !street.trim() ||
                    !city.trim() ||
                    !lga.trim() ||
                    !bizPhone.trim() ||
                    !bizEmail.trim()
                  )
                    toast.error("Fill address, phone and email.");
                  else setStep("proprietor");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "proprietor" ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Owner</h2>
            <div className={card}>
              <div className="space-y-1">
                <Label>Full name *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={field}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Gender *</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "Male" | "Female" | "")}
                    className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Date of birth *</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className={field}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nationality</Label>
                <Input
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Occupation</Label>
                <Input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Phone *</Label>
                <Input
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  inputMode="tel"
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>NIN *</Label>
                <Input
                  value={nin}
                  onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  inputMode="numeric"
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>ID type</Label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as (typeof ID_TYPES)[number])}
                  className={`w-full border border-input bg-background px-3 text-sm ${field}`}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>ID number *</Label>
                <Input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className={field}
                />
              </div>
              <div className="space-y-1">
                <Label>Residential address *</Label>
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
                    toast.error("Complete owner details (NIN must be 11 digits).");
                  else setStep("documents");
                }}
              >
                Continue
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "documents" ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Documents</h2>
            <FilePick
              label="ID document"
              icon={IdCard}
              accept="image/*,.pdf"
              valueName={idFile?.name ?? null}
              onPick={setIdFile}
            />
            <FilePick
              label="Passport photo"
              icon={Camera}
              accept="image/*"
              valueName={photoFile?.name ?? null}
              onPick={setPhotoFile}
            />
            <div className={card}>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <PenLine className="size-4 text-primary" /> Signature
              </p>
              <SignaturePad onChange={setSignature} />
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
          <section className="space-y-3">
            <h2 className="text-base font-bold">Review</h2>
            <div className={card}>
              <Row label="Name" value={preferredName} />
              <Row label="Nature" value={nature} />
              <Row label="Address" value={`${street}, ${city}, ${lga}, ${state}`} />
              <Row label="Owner" value={fullName} />
              <Row label="NIN" value={nin} />
              <Row label="Fee" value={formatNaira(CAC_DEMO_PRICE)} />
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                onClick={() => setStep("pay")}
              >
                Continue to pay
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "pay" ? (
          <section className="space-y-3">
            <h2 className="text-base font-bold">Pay</h2>
            <div className={card}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Business Name</span>
                <span className="font-semibold tabular-nums">{formatNaira(CAC_DEMO_PRICE)}</span>
              </div>
              <label className="mt-2 flex items-start gap-2 text-xs leading-snug">
                <input
                  type="checkbox"
                  checked={declare}
                  onChange={(e) => setDeclare(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I confirm details are correct (demo — no real CAC filing).</span>
              </label>
            </div>
            <PayActionBar>
              <Button
                className="h-12 w-full rounded-xl font-semibold"
                disabled={paying}
                onClick={() => void demoPay()}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Please wait…
                  </>
                ) : (
                  `Pay ${formatNaira(CAC_DEMO_PRICE)}`
                )}
              </Button>
            </PayActionBar>
          </section>
        ) : null}

        {step === "success" ? (
          <section className="flex min-h-[55dvh] flex-col items-center justify-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-7" />
            </span>
            <h2 className="text-lg font-bold">Demo complete</h2>
            <p className="text-sm text-muted-foreground">No real payment or CAC filing.</p>
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
