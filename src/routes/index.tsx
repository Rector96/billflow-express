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
    <main className="brand-gradient flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-primary-foreground">
      <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-5 duration-700">
        <div className="grid place-items-center rounded-3xl bg-white p-4 shadow-float sm:p-6">
          <BrandLogo className="h-[clamp(4.5rem,26vw,9rem)]" />
        </div>
        <p className="text-xs font-bold tracking-[0.28em] opacity-85">{BRAND.tagline}</p>
      </div>
      <div className="absolute bottom-10 flex items-center gap-2 text-xs opacity-70">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Loading your experience
      </div>
    </main>

  );
}
