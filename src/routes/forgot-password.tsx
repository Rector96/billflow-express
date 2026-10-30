import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/app/auth-shell";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";

type Step = "request" | "password" | "done";
type Search = { step: Step };

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const raw = s["step"];
    const step: Step = raw === "password" || raw === "done" ? raw : "request";
    return { step };
  },
  head: () => ({
    meta: [
      { title: `Reset your password — ${BRAND.name}` },
      { name: "description", content: "Recover access to your wallet in three quick steps." },
      { property: "og:title", content: `Reset your password — ${BRAND.name}` },
      { property: "og:description", content: "Securely set a new password." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { step } = Route.useSearch();
  const navigate = useNavigate();
  const [contact, setContact] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (step === "done") {
    return (
      <AuthShell title="Password reset" subtitle="You're all set.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-10" />
          </span>
          <p className="text-sm text-muted-foreground">
            Your password has been changed. You can now log in with your new password.
          </p>
          <Button
            className="mt-2 h-13 w-full rounded-full bg-violet-600 text-base font-bold text-white hover:bg-violet-700"
            onClick={() => navigate({ to: "/login" })}
          >
            Back to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (step === "password") {
    return (
      <AuthShell title="Set new password" subtitle="Choose a strong password for your account.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length < 8) return setError("Password must be at least 8 characters");
            if (pw !== confirm) return setError("Passwords do not match");
            setError("");
            setLoading(true);
            void supabase.auth
              .updateUser({ password: pw })
              .then(({ error: err }) => {
                setLoading(false);
                if (err) {
                  setError(err.message);
                  return;
                }
                void navigate({ to: "/forgot-password", search: { step: "done" } });
              });
          }}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="pw">New Password</Label>
            <Input
              id="pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="auth-field h-13 rounded-2xl border-0 bg-white/90 shadow-sm ring-1 ring-slate-200/80"
              placeholder="Enter new password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpw">Confirm Password</Label>
            <Input
              id="cpw"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="auth-field h-13 rounded-2xl border-0 bg-white/90 shadow-sm ring-1 ring-slate-200/80"
              placeholder="Repeat new password"
            />
          </div>
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-full bg-violet-600 text-base font-bold text-white hover:bg-violet-700"
          >
            {loading ? "Saving…" : "Reset Password"}
          </Button>
          <p className="pt-2 text-center text-sm text-slate-500">
            <Link to="/login" className="font-bold text-violet-600">
              Back to login
            </Link>
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="Enter the email linked to your account and we'll send a secure reset link."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(contact.trim()))
            return setError("Enter the email address on your account");
          setError("");
          setLoading(true);
          void supabase.auth
            .resetPasswordForEmail(contact.trim().toLowerCase(), {
              redirectTo: `${window.location.origin}/forgot-password?step=password`,
            })
            .then(() => {
              setLoading(false);
              toast.success("If that email exists, a reset link is on its way.");
            });
        }}
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="contact">Email</Label>
          <Input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="auth-field h-13 rounded-2xl border-0 bg-white/90 shadow-sm ring-1 ring-slate-200/80"
            placeholder="you@email.com"
          />
        </div>
        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        <Button
          type="submit"
          disabled={loading}
          className="h-13 w-full rounded-full bg-violet-600 text-base font-bold text-white hover:bg-violet-700"
        >
          {loading ? "Sending…" : "Send Reset Link"}
        </Button>
        <p className="pt-2 text-center text-sm text-slate-500">
          Remembered it?{" "}
          <Link to="/login" className="font-bold text-violet-600">
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
