import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ShieldCheck, WalletCards, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/app-shell";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

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
      <div className="welcome-media-wrap absolute inset-0 overflow-hidden bg-[#120b25]">
        <div className="absolute -right-20 top-10 size-[30rem] rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[34rem] rounded-full bg-fuchsia-700/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,0.2),transparent_52%)]" />
        <div className="welcome-shade pointer-events-none absolute inset-0" />
      </div>
      <header className="welcome-header relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <BrandLogo className="h-10 brightness-0 invert" />
        <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/75 sm:inline-flex">
          <ShieldCheck className="size-3.5" /> Secure payments
        </span>
      </header>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end lg:justify-center">
        <section className="welcome-content welcome-content-enter mx-auto w-full max-w-lg px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center lg:pb-0 lg:pt-[20vh]">
          <div className="mb-5 flex items-center justify-center gap-2">
            <span className="grid size-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-violet-200"><WalletCards className="size-5" /></span>
            <span className="grid size-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-violet-200"><Zap className="size-5" /></span>
          </div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">{BRAND.tagline}</p>
          <h1 className="text-[2.35rem] font-bold leading-[1.08] sm:text-5xl lg:text-5xl">RockPay.<br />Your everyday app.</h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed opacity-85 sm:mt-5">Bills and essential services.<br />All in one secure wallet.</p>
          <Button className="welcome-start mt-6 h-13 w-full rounded-full text-base font-bold sm:mt-7" onClick={() => start("/signup")}>
            Get started <ArrowUpRight className="ml-2 size-5" />
          </Button>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1 text-sm sm:mt-5">
            <span className="opacity-80">Already have an account?</span>
            <Button variant="link" className="welcome-login h-auto px-1 py-1 text-sm font-semibold underline underline-offset-4" onClick={() => start("/login")}>Log in</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
