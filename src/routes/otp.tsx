import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PageHeader } from "@/components/app/page-header";
import { BRAND } from "@/lib/brand";

type Search = { next?: string };

export const Route = createFileRoute("/otp")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    next: typeof s["next"] === "string" ? (s["next"] as string) : "signup",
  }),
  head: () => ({
    meta: [
      { title: `Verify your account — ${BRAND.name}` },
      { name: "description", content: "Enter the 6-digit code we sent to confirm it's you." },
      { property: "og:title", content: `Verify your account — ${BRAND.name}` },
      { property: "og:description", content: "One quick code and you're in." },
    ],
  }),
  component: OtpPage,
});

function OtpPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(45);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = () => {
    if (code.length < 6) {
      toast.error("Enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      if (next === "reset") {
        navigate({ to: "/forgot-password", search: { step: "password" } });
      } else {
        toast.success("Account verified 🎉");
        navigate({ to: "/login" });
      }
    }, 900);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10">
      <PageHeader title="Verify your account" />
      <div className="px-6 pt-4">
        <p className="text-sm text-muted-foreground">
          We've sent a verification code to your phone/email. Demo tip: any 6 digits work.
        </p>

        <div className="mt-8 flex justify-center">
          <InputOTP maxLength={6} value={code} onChange={setCode} aria-label="Verification code">
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="size-12 rounded-xl border bg-card text-lg font-bold"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={verify}
          disabled={loading}
          className="mt-8 h-13 w-full rounded-2xl text-base font-bold"
        >
          {loading ? "Verifying…" : "Verify"}
        </Button>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {seconds > 0 ? (
            <span>Resend code in 0:{seconds.toString().padStart(2, "0")}</span>
          ) : (
            <button
              type="button"
              className="font-bold text-primary"
              onClick={() => {
                setSeconds(45);
                toast.success("A new code has been sent");
              }}
            >
              Resend Code
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
