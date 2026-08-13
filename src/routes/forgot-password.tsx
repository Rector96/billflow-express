import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-10" />
        </span>
        <h1 className="text-2xl font-extrabold">Password Reset</h1>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. You can now log in with your new password.
        </p>
        <Button
          className="mt-4 h-13 w-full rounded-2xl text-base font-bold"
          onClick={() => navigate({ to: "/login" })}
        >
          Back to Login
        </Button>
      </main>
    );
  }

  if (step === "password") {
    return (
      <main className="mx-auto min-h-dvh max-w-md pb-10">
        <PageHeader title="Set new password" />
        <form
          className="space-y-5 px-6 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length < 6) return setError("Use at least 6 characters");
            if (pw !== confirm) return setError("Passwords do not match");
            setError("");
            setLoading(true);
            void supabase.auth.updateUser({ password: pw }).then(({ error: err }) => {
              setLoading(false);
              if (err) {
                setError("We couldn't update your password. Open the reset link again.");
                return;
              }
              navigate({ to: "/forgot-password", search: { step: "done" } });
            });
          }}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="pw">New Password</Label>
            <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-13 rounded-xl bg-card" placeholder="Enter new password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpw">Confirm Password</Label>
            <Input id="cpw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-13 rounded-xl bg-card" placeholder="Repeat new password" />
          </div>
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading} className="h-13 w-full rounded-2xl text-base font-bold">
            {loading ? "Saving…" : "Reset Password"}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10">
      <PageHeader title="Forgot Password" />
      <form
        className="space-y-5 px-6 pt-4"
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
        <p className="text-sm text-muted-foreground">
          Enter the email linked to your account and we'll send you a secure reset link.
        </p>
        <div className="space-y-2">
          <Label htmlFor="contact">Email</Label>
          <Input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="h-13 rounded-xl bg-card"
            placeholder="you@email.com"
          />
        </div>
        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="h-13 w-full rounded-2xl text-base font-bold">
          {loading ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>
    </main>
  );
}
