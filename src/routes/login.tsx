import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/app/auth-shell";

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

  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your bills, anytime, anywhere.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">Email</Label>
          <Input
            id="identifier"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="h-13 rounded-xl bg-card"
            placeholder="you@email.com"
            aria-invalid={Boolean(errors.id)}
            autoComplete="email"
          />
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
      <p className="mt-6 pt-4 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/signup" className="font-bold text-primary">
          Sign Up
        </Link>
      </p>
    </AuthShell>
  );
}
