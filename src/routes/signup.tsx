import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, Phone, UserRound } from "lucide-react";
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
      { property: "og:title", content: `Create your account — ${BRAND.name}` },
      { property: "og:description", content: "It takes less than a minute to get started." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [showPassword, setShowPassword] = useState(false);
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
      const msg = error.message.toLowerCase();
      toast.error(
        msg.includes("already")
          ? "An account with that email already exists."
          : msg.includes("pwned") || msg.includes("weak") || msg.includes("password")
            ? "That password is too weak or has appeared in a data breach. Try a stronger one."
            : "We couldn't create your account. Please try again.",
      );
      return;
    }
    if (data.session) {
      toast.success("Account created — set your payment PIN next");
      navigate({ to: "/setup-pin" });
    } else {
      toast.success("Account created. Check your email to confirm it.");
      navigate({ to: "/login" });
    }
  };

  return (
    <main className="auth-screen flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="auth-container mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            aria-label="Back to welcome"
            className="grid size-10 place-items-center rounded-xl border border-border/70 bg-card text-foreground shadow-soft transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <BrandLogo className="h-12" />
          <span className="size-10" aria-hidden="true" />
        </header>

        <section className="auth-intro mt-6 sm:mt-8">
          <p className="text-xs font-semibold uppercase text-primary">{BRAND.tagline}</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your bills, all in one place.
          </p>
        </section>

        <form
          onSubmit={(e) => void submit(e)}
          className="auth-panel mt-5 space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6"
          noValidate
        >
          <Field
            label="Full name"
            id="name"
            icon={<UserRound aria-hidden="true" />}
            value={f.name}
            onChange={set("name")}
            error={errors.name}
            placeholder="Your full name"
            autoComplete="name"
          />
          <Field
            label="Phone number"
            id="phone"
            icon={<Phone aria-hidden="true" />}
            value={f.phone}
            onChange={set("phone")}
            error={errors.phone}
            placeholder="080 0000 0000"
            inputMode="numeric"
            autoComplete="tel-national"
          />
          <Field
            label="Email address"
            id="email"
            icon={<Mail aria-hidden="true" />}
            value={f.email}
            onChange={set("email")}
            error={errors.email}
            placeholder="you@email.com"
            type="email"
            autoComplete="email"
          />
          <Field
            label="Password"
            id="password"
            value={f.password}
            onChange={set("password")}
            error={errors.password}
            placeholder="Create a password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            }
          />
          <Field
            label="Confirm password"
            id="confirm"
            value={f.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
            placeholder="Repeat your password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
          />

          <div className="flex items-start gap-3 rounded-xl bg-muted/70 p-3">
            <Checkbox
              id="agree"
              checked={agree}
              onCheckedChange={(v) => setAgree(v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="agree"
              className="text-xs leading-relaxed font-medium text-muted-foreground"
            >
              I agree to the{" "}
              <Link
                to="/terms"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
          {errors.agree ? (
            <p className="text-xs font-medium text-destructive">{errors.agree}</p>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-xl text-base font-bold"
          >
            {loading ? "Creating account…" : "Create account"}
            {!loading ? <ArrowRight className="ml-1" /> : null}
          </Button>
        </form>

        <p className="mt-auto pt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  id,
  error,
  icon,
  trailing,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  id: string;
  error?: string | undefined;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 z-10 grid place-items-center text-muted-foreground [&_svg]:size-[18px]">
            {icon}
          </span>
        ) : null}
        <Input
          id={id}
          className={
            icon
              ? "h-13 rounded-xl bg-background pl-11 pr-12"
              : "h-13 rounded-xl bg-background pr-12"
          }
          aria-invalid={Boolean(error)}
          {...props}
        />
        {trailing}
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
