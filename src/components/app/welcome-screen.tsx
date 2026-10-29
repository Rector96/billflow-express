import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import welcomePhoto from "@/assets/rockpay-welcome.jpg";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const { authed, hydrated, completeOnboarding } = useApp();

  useEffect(() => {
    if (hydrated && authed) void navigate({ to: "/home" });
  }, [hydrated, authed, navigate]);


  function start(to: "/signup" | "/login") {
    completeOnboarding();
    void navigate({ to });
  }

  return (
    <main className="welcome-screen relative isolate flex min-h-dvh flex-col overflow-hidden">
      <img
        src={welcomePhoto}
        alt="A woman smiling while using her phone"
        width={768}
        height={1376}
        fetchPriority="high"
        className="welcome-media absolute inset-0 h-full w-full object-cover"
      />
      <div className="welcome-shade pointer-events-none absolute inset-0" />
      <header className="welcome-header relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6">
        <span className="text-xl font-bold font-display">
          {BRAND.name}
          <span className="welcome-brand-dot">.</span>
        </span>
      </header>
      <section className="welcome-content relative z-10 mx-auto mt-auto w-full max-w-lg px-6 text-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
          {BRAND.tagline}
        </p>
        <h1 className="text-[42px] font-bold leading-[1.08] sm:text-5xl">
          RockPay.
          <br />
          Your everyday app.
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed opacity-85">
          Bills, data and essential services.
          <br />
          All in one place.
        </p>
        <Button
          className="welcome-start mt-7 h-13 w-full rounded-full text-base font-bold"
          onClick={() => start("/signup")}
        >
          Get started <ArrowUpRight className="ml-2 size-5" />
        </Button>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1 text-sm">
          <span className="opacity-80">Already have an account?</span>
          <Button
            variant="link"
            className="welcome-login h-auto px-1 py-1 text-sm font-semibold underline underline-offset-4"
            onClick={() => start("/login")}
          >
            Log in
          </Button>
        </div>
      </section>
    </main>
  );
}
