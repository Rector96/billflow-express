import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { useApp } from "@/lib/app-store";
import { BrandMark } from "@/components/app/app-shell";
import { ShieldCheck } from "lucide-react";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    <main className="splash-surface relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-primary-foreground">
      <div className="splash-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="splash-orbit pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/10" />

      <div className="page-fade relative flex flex-col items-center">
        <div className="relative grid size-24 place-items-center rounded-3xl border border-primary-foreground/20 bg-primary-foreground/95 shadow-float backdrop-blur sm:size-28">
          <BrandMark className="size-16 rounded-2xl ring-0 sm:size-20" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-primary-foreground">{BRAND.name}</h1>
        <p className="mt-2 text-[10px] font-bold tracking-[0.24em] text-primary-foreground/75">
          {BRAND.tagline}
        </p>
        <div className="mt-7 flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold text-primary-foreground/80 backdrop-blur">
          <ShieldCheck className="size-3.5" /> Secure payments, made simple
        </div>
      </div>

      <div className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3 text-primary-foreground/65">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-primary-foreground/15">
          <span className="splash-loader block h-full w-1/2 rounded-full bg-primary-foreground/80" />
        </div>
        <p className="text-[10px] font-medium">Preparing your wallet</p>
      </div>
    </main>
  );
}
