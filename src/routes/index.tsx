import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { BrandLogo } from "@/components/app/app-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND.name} — Pay. Fund. Connect.` },
      {
        name: "description",
        content:
          "Pay electricity, cable TV, education, airtime and data bills from one wallet. Mobile-first and built for Nigeria.",
      },
      { property: "og:title", content: `${BRAND.name} — Pay. Fund. Connect.` },
      {
        property: "og:description",
        content: "Fund one wallet and pay every bill in seconds.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { authed, seenOnboarding, hydrated } = useApp();

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      if (authed) navigate({ to: "/home" });
      else if (seenOnboarding) navigate({ to: "/login" });
      else navigate({ to: "/onboarding" });
    }, 1600);
    return () => clearTimeout(t);
  }, [hydrated, authed, seenOnboarding, navigate]);

  return (
    <main className="brand-gradient relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-primary-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_42%)]"
      />

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="grid place-items-center rounded-[2rem] bg-white px-7 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.18)] ring-1 ring-white/40 sm:px-9 sm:py-8">
          <BrandLogo className="h-auto w-[min(76vw,304px)] max-w-none object-contain" />
        </div>
        <p className="text-xs font-bold tracking-[0.28em] text-white/90">{BRAND.tagline}</p>
      </div>

      <div className="absolute bottom-10 flex items-center gap-2 text-xs text-white/70">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Loading your experience
      </div>
    </main>
  );
}
