import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Fingerprint, KeyRound, LockKeyhole, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
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
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: `Security — ${BRAND.name}` },
      { name: "description", content: "Passwords, transaction PIN, biometrics and login sessions." },
      { property: "og:title", content: `Security — ${BRAND.name}` },
      { property: "og:description", content: "Keep your wallet locked down." },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const [biometric, setBiometric] = useState(true);
  const { logout } = useApp();
  const navigate = useNavigate();

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
          label="Change Transaction PIN"
          onClick={() => toast.info("Demo PIN is 1234")}
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
