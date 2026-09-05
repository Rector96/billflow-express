import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Fingerprint, KeyRound, LockKeyhole, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { friendlyError, useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { changeTransactionPin, hasTransactionPin, setTransactionPin } from "@/lib/pin.functions";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: `Security — ${BRAND.name}` },
      {
        name: "description",
        content: "Passwords, transaction PIN, biometrics and login sessions.",
      },
      { property: "og:title", content: `Security — ${BRAND.name}` },
      { property: "og:description", content: "Keep your wallet locked down." },
    ],
  }),
  component: SecurityPage,
});

type PinMode = "set" | "change" | null;

function SecurityPage() {
  const [biometric, setBiometric] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [step, setStep] = useState<"current" | "new" | "confirm">("new");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const { logout } = useApp();
  const navigate = useNavigate();
  const checkPin = useServerFn(hasTransactionPin);
  const setPinFn = useServerFn(setTransactionPin);
  const changePinFn = useServerFn(changeTransactionPin);

  useEffect(() => {
    void checkPin()
      .then((r) => setHasPin(r.hasPin))
      .catch(() => setHasPin(false));
  }, [checkPin]);

  const openPinDialog = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    if (hasPin) {
      setPinMode("change");
      setStep("current");
    } else {
      setPinMode("set");
      setStep("new");
    }
  };

  const closePinDialog = () => {
    setPinMode(null);
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const submitPin = async () => {
    if (step === "current") {
      if (currentPin.length !== 4) return;
      setStep("new");
      return;
    }
    if (step === "new") {
      if (newPin.length !== 4) return;
      setStep("confirm");
      return;
    }
    if (confirmPin !== newPin) {
      setConfirmPin("");
      toast.error("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      if (pinMode === "set") {
        await setPinFn({ data: { pin: newPin } });
        setHasPin(true);
        toast.success("Transaction PIN set");
      } else {
        await changePinFn({ data: { currentPin, newPin } });
        toast.success("Transaction PIN updated");
      }
      closePinDialog();
    } catch (err) {
      toast.error(friendlyError(err, "Could not update PIN"));
      if (pinMode === "change") {
        setStep("current");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  const padValue = step === "current" ? currentPin : step === "new" ? newPin : confirmPin;
  const onPadChange =
    step === "current" ? setCurrentPin : step === "new" ? setNewPin : setConfirmPin;
  const padTitle =
    step === "current"
      ? "Enter current PIN"
      : step === "new"
        ? "Enter new 4-digit PIN"
        : "Confirm new PIN";

  return (
    <AppShell>
      <PageHeader title="Security" backTo="/profile" />
      <div className="space-y-3 px-4 pt-2 pb-6">
        <Action
          Icon={LockKeyhole}
          label="Change Password"
          onClick={() => toast.info("Password change flow is coming soon")}
        />
        <Action
          Icon={KeyRound}
          label={hasPin ? "Change Transaction PIN" : "Set Transaction PIN"}
          onClick={openPinDialog}
        />

        <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Fingerprint className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Biometric Login</p>
            <p className="text-xs text-muted-foreground">Use fingerprint or face to log in</p>
          </div>
          <Switch
            checked={biometric}
            onCheckedChange={(v) => {
              setBiometric(v);
              toast.success(v ? "Biometric login enabled" : "Biometric login disabled");
            }}
            aria-label="Toggle biometric login"
          />
        </div>

        <Action
          Icon={MonitorSmartphone}
          label="Login Sessions"
          onClick={() => toast.info("1 active session • iPhone 14, Lagos")}
        />

        <AlertDialog>
          <AlertDialogTrigger className="press w-full rounded-2xl border border-destructive/30 bg-card p-3.5 text-left text-sm font-bold text-destructive shadow-card">
            Logout From All Devices
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Log out everywhere?</AlertDialogTitle>
              <AlertDialogDescription>
                All active sessions will be signed out immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                onClick={() => {
                  void logout();
                  navigate({ to: "/login" });
                }}
              >
                Log out all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={pinMode !== null} onOpenChange={(open) => !open && closePinDialog()}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{hasPin && pinMode === "change" ? "Change PIN" : "Set PIN"}</DialogTitle>
            <DialogDescription>{padTitle}. PIN is stored as a secure hash.</DialogDescription>
          </DialogHeader>
          <PinPad value={padValue} onChange={onPadChange} />
          <Button
            className="h-12 w-full rounded-xl font-bold"
            disabled={padValue.length < 4 || busy}
            onClick={() => void submitPin()}
          >
            {busy ? "Please wait…" : step === "confirm" ? "Save PIN" : "Continue"}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Action({
  Icon,
  label,
  onClick,
}: {
  Icon: typeof LockKeyhole;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-card"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
