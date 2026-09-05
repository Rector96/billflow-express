import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/otp")({
  head: () => ({
    meta: [
      { title: `Verify — ${BRAND.name}` },
      { name: "description", content: "Enter the verification code we sent you." },
    ],
  }),
  component: OtpPage,
});

function OtpPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Link to="/login" className="mb-8 inline-flex w-fit" aria-label={BRAND.name}>
        <BrandLogo className="h-12" />
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Verify your account</h1>
        <p className="text-sm text-muted-foreground">
          We've sent a verification code to your email. Enter the 6-digit code to continue.
        </p>
      </div>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.replace(/\D/g, "").length < 6) {
            toast.error("Enter the 6-digit code");
            return;
          }
          setLoading(true);
          toast.success("Verified");
          navigate({ to: "/home" });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="h-12 tracking-[0.3em] text-center text-lg font-bold"
            autoComplete="one-time-code"
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={loading}>
          {loading ? "Verifying…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-bold text-primary">
          Back to login
        </Link>
      </p>
    </main>
  );
}
