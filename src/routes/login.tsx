import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo, BrandMark } from "@/components/app/app-shell";

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

  return (
    <main className="auth-screen flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="auth-container mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="flex items-center justify-between">
          <BrandLogo className="h-12" />
          <span className="auth-mark grid size-10 place-items-center rounded-xl">
            <BrandMark className="size-7 rounded-lg ring-0" />
          </span>
        </header>

        <section className="auth-intro mt-9 sm:mt-12">
          <p className="text-xs font-semibold uppercase text-primary">{BRAND.tagline}</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Log in to manage your bills, anytime, anywhere.
          </p>
        </section>

        <section className="auth-panel mt-7 rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <AuthField
              id="identifier"
              label="Email address"
              icon={<Mail aria-hidden="true" />}
              error={errors.id}
            >
              <Input
                id="identifier"
                type="email"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="h-13 rounded-xl bg-background pl-11"
                placeholder="you@email.com"
                aria-invalid={Boolean(errors.id)}
                autoComplete="email"
              />
            </AuthField>

            <AuthField
              id="password"
              label="Password"
              icon={<LockKeyhole aria-hidden="true" />}
              error={errors.password}
            >
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-13 rounded-xl bg-background px-11 pr-12"
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
                className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </AuthField>

            <div className="flex justify-end pt-0.5">
              <Link
                to="/forgot-password"
                search={{ step: "request" }}
                className="min-h-11 content-center text-sm font-semibold text-primary"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-13 w-full rounded-xl text-base font-bold"
            >
              {loading ? "Logging in…" : "Log in"}
              {!loading ? <ArrowRight className="ml-1" /> : null}
            </Button>
          </form>
        </section>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" />
          <span>Protected sign in</span>
        </div>

        <p className="mt-auto pt-10 text-center text-sm text-muted-foreground">
          New to {BRAND.name}?{" "}
          <Link to="/signup" className="font-bold text-primary">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}

function AuthField({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-muted-foreground [&_svg]:size-[18px]">
          {icon}
        </span>
        {children}
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
