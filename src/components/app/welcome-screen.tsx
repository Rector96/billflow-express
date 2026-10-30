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
    <main className="welcome-screen fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden">
      {/* Full-bleed photo with soft smile / ken-burns motion */}
      <div className="welcome-media-wrap absolute inset-0 overflow-hidden">
        <img
          src={welcomePhoto}
          alt="A woman smiling while using her phone"
          width={768}
          height={1376}
          fetchPriority="high"
          className="welcome-media welcome-media-motion absolute inset-0 h-full w-full object-cover"
        />
        <div className="welcome-shade pointer-events-none absolute inset-0" />
      </div>

      <header className="welcome-header relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="text-xl font-bold font-display tracking-tight">
          {BRAND.name}
          <span className="welcome-brand-dot">.</span>
        </span>
      </header>

      {/* Desktop: centered portrait focus; Mobile: content at bottom */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end lg:justify-center">
        <section className="welcome-content welcome-content-enter mx-auto w-full max-w-lg px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center lg:pb-0 lg:pt-[28vh]">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
            {BRAND.tagline}
          </p>
          <h1 className="text-[2.35rem] font-bold leading-[1.08] sm:text-5xl lg:text-5xl">
            RockPay.
            <br />
            Your everyday app.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed opacity-85 sm:mt-5">
            Bills, data and essential services.
            <br />
            All in one place.
          </p>
          <Button
            className="welcome-start mt-6 h-13 w-full rounded-full text-base font-bold sm:mt-7"
            onClick={() => start("/signup")}
          >
            Get started <ArrowUpRight className="ml-2 size-5" />
          </Button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-sm sm:mt-5">
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
      </div>
    </main>
  );
}
