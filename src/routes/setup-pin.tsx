import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PinPad } from "@/components/app/pin-pad";
import { BrandLogo } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { setTransactionPin } from "@/lib/pin.functions";

export const Route = createFileRoute("/setup-pin")({
  head: () => ({
    meta: [
      { title: `Create transaction PIN — ${BRAND.name}` },
      {
        name: "description",
        content: "Create a 4-digit PIN to authorize payments securely.",
      },
    ],
  }),
  component: SetupPinPage,
});

/**
 * Mandatory post-signup / post-login step when no transaction PIN exists.
 * Real bill platforms never let you pay without a PIN.
 */
function SetupPinPage() {
  const navigate = useNavigate();
  const setPinFn = useServerFn(setTransactionPin);
  const [step, setStep] = useState<"new" | "confirm">("new");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const value = step === "new" ? pin : confirm;
  const onChange = step === "new" ? setPin : setConfirm;

  const continuePad = async () => {
    if (step === "new") {
      if (pin.length !== 4) return;
      // Soft ban trivial PINs
      if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "0000") {
        toast.error("Choose a stronger PIN — avoid 0000, 1234 or repeated digits.");
        setPin("");
        return;
      }
      setStep("confirm");
      return;
    }
    if (confirm !== pin) {
      toast.error("PINs do not match. Try again.");
      setConfirm("");
      return;
    }
    setBusy(true);
    try {
      await setPinFn({ data: { pin } });
      toast.success("Transaction PIN created");
      void navigate({ to: "/home", replace: true });
    } catch (err) {
      const msg = friendlyError(err, "Could not save PIN");
      if (msg.toLowerCase().includes("already set")) {
        void navigate({ to: "/home", replace: true });
        return;
      }
      toast.error(msg);
      setStep("new");
      setPin("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <BrandLogo className="h-12" />

      <div className="mt-8 flex flex-1 flex-col">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <KeyRound className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          {step === "new" ? "Create your payment PIN" : "Confirm your PIN"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step === "new"
            ? "This 4-digit PIN authorizes every payment. Keep it secret — even RockPay staff will never ask for it."
            : "Enter the same PIN again to confirm."}
        </p>

        <div className="mt-8">
          <PinPad value={value} onChange={onChange} />
        </div>

        <Button
          className="mt-8 h-13 w-full rounded-2xl text-base font-bold"
          disabled={value.length < 4 || busy}
          onClick={() => void continuePad()}
        >
          {busy ? "Saving…" : step === "confirm" ? "Save PIN & continue" : "Continue"}
        </Button>

        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Your PIN is stored as a secure hash. You can change or reset it anytime from Profile →
            Security.
          </p>
        </div>
      </div>
    </main>
  );
}
