import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CreditCard, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/app/app-shell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Log in — ${BRAND.name}` },
      { name: "description", content: `Log in to your ${BRAND.name} wallet to pay bills fast.` },
      { property: "og:title", content: `Log in — ${BRAND.name}` },
      { property: "og:description", content: "Welcome back. Your bills are one tap away." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useApp();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(id.trim())) next.id = "Enter the email address on your account";
    if (password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: id.trim().toLowerCase(),
      password,
    });
    if (error) {
      setLoading(false);
      toast.error(
        error.message.toLowerCase().includes("confirm")
          ? "Please confirm your email address first."
          : "Email or password is incorrect.",
      );
      return;
    }
    await refresh();
    toast.success("Welcome back!");
    navigate({ to: "/home" });
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/home`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error("Google sign-in is not available right now. Use email instead.");
    }
  };

  return (
    <main className="auth-screen relative flex min-h-dvh flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="auth-blob auth-blob--a" aria-hidden="true" />
      <div className="auth-blob auth-blob--b" aria-hidden="true" />

      <div className="auth-container relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center gap-2.5">
          <BrandMark className="size-9 rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-[#1e1b4b]">
            RockPay
          </span>
        </header>

        <section className="relative mt-8 sm:mt-10">
          <h1 className="font-display text-[1.85rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[2rem]">
            Welcome back
          </h1>
          <p className="mt-2 max-w-[16rem] text-[0.95rem] leading-relaxed text-slate-500">
            Log in to manage your bills, anytime, anywhere.
          </p>

          <div className="auth-card-float absolute -right-1 top-0 sm:right-2" aria-hidden="true">
            <div className="relative">
              <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] shadow-lg shadow-violet-500/30 sm:size-[4.5rem]">
                <CreditCard className="size-8 text-white sm:size-9" strokeWidth={1.75} />
              </div>
              <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-[3px] border-[#f5f3ff] bg-emerald-500 text-white shadow-md">
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </section>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="identifier" className="text-[0.8rem] font-semibold text-slate-700">
              Email address
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-slate-400 [&_svg]:size-[18px]">
                <Mail aria-hidden="true" />
              </span>
              <Input
                id="identifier"
                type="email"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="auth-field h-13 rounded-2xl border-0 bg-white/90 pl-11 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.id)}
                autoComplete="email"
              />
            </div>
            {errors.id ? <p className="text-xs font-medium text-destructive">{errors.id}</p> : null}
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
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-field h-13 rounded-2xl border-0 bg-white/90 px-11 pr-12 shadow-sm ring-1 ring-slate-200/80 focus-visible:ring-2 focus-visible:ring-violet-500"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                autoComplete="current-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {errors.password ? (
              <p className="text-xs font-medium text-destructive">{errors.password}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              search={{ step: "request" }}
              className="min-h-10 content-center text-sm font-semibold text-violet-600"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-full bg-violet-600 text-base font-bold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700"
          >
            {loading ? "Logging in…" : "Log in"}
            {!loading ? <ArrowRight className="ml-1 size-5" /> : null}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">or continue with</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={googleLoading}
          onClick={() => void continueWithGoogle()}
          className="mt-4 h-13 w-full rounded-full border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <GoogleIcon />
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </Button>

        <p className="mt-8 text-center text-sm text-slate-500">
          New to RockPay?{" "}
          <Link to="/signup" className="font-bold text-violet-600">
            Create account
          </Link>
        </p>

        <p className="mt-auto pt-10 text-center text-xs leading-relaxed text-slate-400">
          Everyday payments
          <br />
          for a brighter tomorrow.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
