import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { BrandMark } from "@/components/app/app-shell";

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
  const { login } = useApp();
  const [id, setId] = useState("pablo@example.com");
  const [password, setPassword] = useState("password");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!id.trim()) next.id = "Enter your phone number or email";
    if (password.length < 4) next.password = "Password must be at least 4 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setTimeout(() => {
      login();
      toast.success("Welcome back!");
      navigate({ to: "/home" });
    }, 900);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <BrandMark className="size-12 rounded-2xl text-xl" />
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Welcome Back 👋</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Log in to continue paying your bills with {BRAND.name}.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">Phone or Email</Label>
          <Input
            id="identifier"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="h-13 rounded-xl bg-card"
            placeholder="080 0000 0000 or you@email.com"
            aria-invalid={Boolean(errors.id)}
          />
          {errors.id ? <p className="text-xs font-medium text-destructive">{errors.id}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-13 rounded-xl bg-card pr-12"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-3 grid place-items-center text-muted-foreground"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs font-medium text-destructive">{errors.password}</p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" search={{ step: "request" }} className="text-sm font-semibold text-primary">
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-13 w-full rounded-2xl text-base font-bold"
        >
          {loading ? "Logging in…" : "Login"}
        </Button>
      </form>

      <p className="mt-auto pt-10 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/signup" className="font-bold text-primary">
          Sign Up
        </Link>
      </p>
    </main>
  );
}
