import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BRAND } from "@/lib/brand";
import { BrandMark } from "@/components/app/app-shell";
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

type Fields = { name: string; phone: string; email: string; password: string };

function SignupPage() {
  const navigate = useNavigate();
  const [f, setF] = useState<Fields>({
    name: "",
    phone: "",
    email: "",
    password: "",
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
    const phoneDigits = f.phone.replace(/\D/g, "");
    if (f.name.trim().length < 3) next.name = "Enter your full name";
    if (!(phoneDigits.length === 10 || phoneDigits.length === 11)) {
      next.phone = "Enter a valid Nigerian phone number";
    }
    if (!/^\S+@\S+\.\S+$/.test(f.email)) next.email = "Enter a valid email address";
    if (f.password.length < 6) next.password = "Use at least 6 characters";
    if (!agree) next.agree = "Please accept the terms to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    const normalizedPhone =
      phoneDigits.length === 10
        ? `0${phoneDigits}`
        : phoneDigits.startsWith("0")
          ? phoneDigits
          : `0${phoneDigits.slice(-10)}`;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/setup-pin`,
        data: { full_name: f.name.trim(), phone: normalizedPhone },
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
    <main className="auth-screen relative flex min-h-dvh flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="auth-blob auth-blob--a" aria-hidden="true" />
      <div className="auth-blob auth-blob--b" aria-hidden="true" />

      <div className="auth-container relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="relative flex items-center justify-center">
          <Link
            to="/"
            aria-label="Back to welcome"
            className="absolute left-0 grid size-10 place-items-center rounded-full text-slate-600 transition-colors hover:bg-white/60"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <BrandMark className="size-8 rounded-xl" />
            <span className="font-display text-lg font-bold tracking-tight text-[#1e1b4b]">
              RockPay
            </span>
          </div>
        </header>

        <section className="mt-8 sm:mt-10">
          <h1 className="font-display text-[1.85rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[2rem]">
            Create your account
          </h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">
            Your bills, all in one place.
          </p>
        </section>

        <form onSubmit={(e) => void submit(e)} className="mt-7 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[0.8rem] font-semibold text-slate-700">
              Full name
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400 [&_svg]:size-[18px]">
                <UserRound aria-hidden="true" />
              </span>
              <Input
                id="name"
                value={f.name}
                onChange={set("name")}
                className="auth-field h-13 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                placeholder="e.g. Adaora Nwankwo"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
              />
            </div>
            {errors.name ? (
              <p className="text-xs font-medium text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[0.8rem] font-semibold text-slate-700">
              Phone number
            </Label>
            <div className="flex gap-2">
              <div className="flex h-13 shrink-0 items-center gap-1.5 rounded-2xl bg-white/90 px-3 shadow-sm ring-1 ring-slate-200/80">
                <span className="text-base leading-none" aria-hidden="true">
                  🇳🇬
                </span>
                <span className="text-sm font-semibold text-slate-700">+234</span>
              </div>
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400 [&_svg]:size-[18px]">
                  <Phone aria-hidden="true" />
                </span>
                <Input
                  id="phone"
                  value={f.phone}
                  onChange={set("phone")}
                  className="auth-field h-13 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                  placeholder="801 234 5678"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  aria-invalid={Boolean(errors.phone)}
                />
              </div>
            </div>
            {errors.phone ? (
              <p className="text-xs font-medium text-destructive">{errors.phone}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[0.8rem] font-semibold text-slate-700">
              Email address
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400 [&_svg]:size-[18px]">
                <Mail aria-hidden="true" />
              </span>
              <Input
                id="email"
                type="email"
                value={f.email}
                onChange={set("email")}
                className="auth-field h-13 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
              />
            </div>
            {errors.email ? (
              <p className="text-xs font-medium text-destructive">{errors.email}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[0.8rem] font-semibold text-slate-700">
              Password
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400 [&_svg]:size-[18px]">
                <LockKeyhole aria-hidden="true" />
              </span>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={f.password}
                onChange={set("password")}
                className="auth-field h-13 rounded-2xl border-0 bg-white/90 px-11 pr-12 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                placeholder="Create a password"
                autoComplete="new-password"
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
            {errors.password ? (
              <p className="text-xs font-medium text-destructive">{errors.password}</p>
            ) : null}
          </div>

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="agree"
              checked={agree}
              onCheckedChange={(v) => setAgree(v === true)}
              className="mt-0.5 border-slate-300 data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600"
            />
            <Label htmlFor="agree" className="text-xs leading-relaxed font-medium text-slate-500">
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
          {errors.agree ? (
            <p className="text-xs font-medium text-destructive">{errors.agree}</p>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-13 w-full rounded-full bg-violet-600 text-base font-bold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700"
          >
            {loading ? "Creating account…" : "Create account"}
            {!loading ? <ArrowRight className="ml-1 size-5" /> : null}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-violet-600">
            Log in
          </Link>
        </p>

        <p className="mt-auto pt-8 text-center text-xs leading-relaxed text-slate-400">
          Simple bills
          <br />a brighter you.
        </p>
      </div>
    </main>
  );
}
