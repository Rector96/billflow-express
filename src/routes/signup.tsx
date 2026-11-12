import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BRAND } from "@/lib/brand";
import { AuthShell } from "@/components/app/auth-shell";
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

type Fields = {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
};

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof Fields | "agree", string>>
  >({});
  const [loading, setLoading] = useState(false);

  const set =
    (key: keyof Fields) => (event: ChangeEvent<HTMLInputElement>) => {
      setF((previous) => ({
        ...previous,
        [key]: event.target.value,
      }));
    };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const next: typeof errors = {};
    const phoneDigits = f.phone.replace(/\D/g, "");

    if (f.name.trim().length < 3) {
      next.name = "Enter your full name";
    }

    if (!(phoneDigits.length === 10 || phoneDigits.length === 11)) {
      next.phone = "Enter a valid Nigerian phone number";
    }

    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) {
      next.email = "Enter a valid email address";
    }

    if (f.password.length < 6) {
      next.password = "Use at least 6 characters";
    }

    if (!f.confirm) {
      next.confirm = "Please confirm your password";
    } else if (f.password !== f.confirm) {
      next.confirm = "Passwords do not match";
    }

    if (!agree) {
      next.agree = "Please accept the terms to continue";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    const normalizedPhone =
      phoneDigits.length === 10
        ? `0${phoneDigits}`
        : phoneDigits.startsWith("0")
          ? phoneDigits
          : `0${phoneDigits.slice(-10)}`;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim().toLowerCase(),
        password: f.password,
        options: {
          emailRedirectTo: `${window.location.origin}/setup-pin`,
          data: {
            full_name: f.name.trim(),
            phone: normalizedPhone,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();

        toast.error(
          msg.includes("already")
            ? "An account with that email already exists."
            : msg.includes("pwned") ||
                msg.includes("weak") ||
                msg.includes("password")
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
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your bills, all in one place."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
            Full name
          </Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              id="name"
              value={f.name}
              onChange={set("name")}
              placeholder="Your full name"
              autoComplete="name"
              className="auth-field h-12 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-invalid={Boolean(errors.name)}
            />
          </div>
          {errors.name && (
            <p className="text-xs font-medium text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
            Phone number
          </Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={f.phone}
              onChange={set("phone")}
              placeholder="080 0000 0000"
              autoComplete="tel"
              className="auth-field h-12 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-invalid={Boolean(errors.phone)}
            />
          </div>
          {errors.phone && (
            <p className="text-xs font-medium text-destructive">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
            Email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              value={f.email}
              onChange={set("email")}
              placeholder="you@example.com"
              autoComplete="email"
              className="auth-field h-12 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-invalid={Boolean(errors.email)}
            />
          </div>
          {errors.email && (
            <p className="text-xs font-medium text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
            Password
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={f.password}
              onChange={set("password")}
              placeholder="Create a password"
              autoComplete="new-password"
              className="auth-field h-12 rounded-2xl border-0 bg-white/90 pl-11 pr-12 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-invalid={Boolean(errors.password)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-xs font-medium text-destructive">{errors.password}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-semibold text-slate-700">
            Confirm password
          </Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={f.confirm}
              onChange={set("confirm")}
              placeholder="Repeat your password"
              autoComplete="new-password"
              className="auth-field h-12 rounded-2xl border-0 bg-white/90 pl-11 pr-12 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-invalid={Boolean(errors.confirm)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showConfirm ? "Hide password" : "Show password"}
              onClick={() => setShowConfirm((visible) => !visible)}
              className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {errors.confirm && (
            <p className="text-xs font-medium text-destructive">{errors.confirm}</p>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-start gap-3">
            <Checkbox
              id="agree"
              checked={agree}
              onCheckedChange={(value) => setAgree(value === true)}
              className="mt-0.5 border-slate-300 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
            />
            <Label
              htmlFor="agree"
              className="text-xs font-medium leading-relaxed text-slate-500"
            >
              I agree to the{" "}
              <Link
                to="/terms"
                className="font-semibold text-violet-600 underline-offset-2 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="font-semibold text-violet-600 underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
            </Label>
          </div>
          {errors.agree && (
            <p className="text-xs font-medium text-destructive">{errors.agree}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-12 w-full rounded-full bg-violet-600 text-base font-bold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700"
        >
          {loading ? "Creating account…" : "Create account"}
          {!loading && <ArrowRight className="ml-1 size-5" />}
        </Button>
      </form>
    </AuthShell>
  );
}
