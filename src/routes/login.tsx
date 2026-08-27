import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/app/app-shell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Log in — ${BRAND.name}` },
      { name: "description", content: `Log in to your ${BRAND.name} wallet to pay bills fast.` },
      { property: "og:title", content: `Log in — ${BRAND.name}` },
      { property: "og:description", content: "Welcome back. Your bills are one tap away." },
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
    <main className="flex min-h-dvh items-center justify-center bg-muted/35 px-4 py-8 sm:px-6">
      <div className="w-full max-w-md rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-card sm:p-8">
        <BrandLogo className="h-[clamp(3.25rem,16vw,5.5rem)] self-start" />
        <h1 className="mt-7 text-2xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Log in to continue paying your bills with {BRAND.name}.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="identifier">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="identifier"
                type="email"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="h-13 rounded-xl bg-background pl-10"
                placeholder="you@email.com"
                aria-invalid={Boolean(errors.id)}
                aria-describedby={errors.id ? "identifier-error" : undefined}
              />
            </div>
            {errors.id ? (
              <p id="identifier-error" className="text-xs font-medium text-destructive">
                {errors.id}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-13 rounded-xl bg-background pl-10 pr-12"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
                className="absolute inset-y-0 right-3 grid size-8 place-items-center self-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="text-xs font-medium text-destructive">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              search={{ step: "request" }}
              className="text-sm font-semibold text-primary"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-2xl text-base font-bold"
          >
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs font-medium text-muted-foreground">
          <LockKeyhole className="mr-1 inline size-3.5 align-[-2px] text-success" />
          Your details are protected with secure sign-in.
        </p>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-bold text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
