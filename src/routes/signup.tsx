import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/app/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: `Create your account — ${BRAND.name}` },
      {
        name: "description",
        content: `Open a free ${BRAND.name} account and pay Nigerian bills from one wallet.`,
      },
    ],
  }),
  component: SignupPage,
});

type Fields = { name: string; phone: string; email: string; password: string; confirm: string };

function SignupPage() {
  const navigate = useNavigate();
  const [f, setF] = useState<Fields>({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields | "agree", string>>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (f.name.trim().length < 3) next.name = "Enter your full name";
    if (!/^0\d{10}$/.test(f.phone.replace(/\s/g, ""))) next.phone = "Enter a valid 11-digit number";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) next.email = "Enter a valid email address";
    if (f.password.length < 6) next.password = "Use at least 6 characters";
    if (f.confirm !== f.password) next.confirm = "Passwords do not match";
    if (!agree) next.agree = "Please accept the terms to continue";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/setup-pin`,
        data: { full_name: f.name.trim(), phone: f.phone.replace(/\s/g, "") },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created — set your payment PIN");
      navigate({ to: "/setup-pin" });
    } else {
      toast.success("Check your email to confirm, then log in and set your PIN");
      navigate({ to: "/login" });
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <BrandLogo className="h-12" />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">You will set a 4-digit payment PIN next.</p>
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
        <Field label="Full name" id="name" value={f.name} onChange={set("name")} error={errors.name} placeholder="Your full name" />
        <Field label="Phone" id="phone" value={f.phone} onChange={set("phone")} error={errors.phone} placeholder="08012345678" inputMode="tel" />
        <Field label="Email" id="email" value={f.email} onChange={set("email")} error={errors.email} placeholder="you@email.com" type="email" />
        <Field label="Password" id="password" value={f.password} onChange={set("password")} error={errors.password} placeholder="Create a password" type="password" />
        <Field label="Confirm password" id="confirm" value={f.confirm} onChange={set("confirm")} error={errors.confirm} placeholder="Repeat password" type="password" />
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-3">
          <Checkbox id="agree" checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
          <Label htmlFor="agree" className="text-xs leading-relaxed font-medium text-muted-foreground">
            I agree to the{" "}
            <Link to="/terms" className="font-bold text-primary">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="font-bold text-primary">
              Privacy Policy
            </Link>
            .
          </Label>
        </div>
        {errors.agree ? <p className="text-xs font-medium text-destructive">{errors.agree}</p> : null}
        <Button type="submit" disabled={loading} className="h-13 w-full rounded-2xl text-base font-bold">
          {loading ? "Creating account…" : "Create Account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary">
            Login
          </Link>
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  id,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; id: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-13 rounded-xl bg-card" aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
