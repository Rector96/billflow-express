import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Receipt, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: `Welcome to ${BRAND.name}` },
      { name: "description", content: `See how ${BRAND.name} makes paying Nigerian bills simple.` },
      { property: "og:title", content: `Welcome to ${BRAND.name}` },
      { property: "og:description", content: "Three quick steps to faster bill payments." },
    ],
  }),
  component: Onboarding,
});

const SLIDES = [
  {
    icon: Receipt,
    title: "Pay Your Bills Easily",
    body: "Electricity, cable TV, education and more — all in one place.",
  },
  {
    icon: Wallet,
    title: "One Wallet. Everything You Need.",
    body: "Fund your wallet once and use it whenever you need to pay.",
  },
  {
    icon: ShieldCheck,
    title: "Fast & Secure",
    body: "Your payments and transactions are safely recorded.",
  },
];

function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();
  const slide = SLIDES[index]!;

  const finish = () => {
    completeOnboarding();
    navigate({ to: "/signup" });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="flex justify-end">
        {index < SLIDES.length - 1 ? (
          <button
            type="button"
            onClick={finish}
            className="press rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground"
          >
            Skip
          </button>
        ) : null}
      </div>

      <div key={index} className="animate-in fade-in slide-in-from-right-4 flex flex-1 flex-col items-center justify-center gap-6 text-center duration-300">
        <span className="brand-gradient grid size-28 place-items-center rounded-[2rem] text-primary-foreground shadow-float">
          <slide.icon className="size-12" />
        </span>
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight">{slide.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
        </div>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <span
            key={s.title}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-primary" : "w-1.5 bg-border",
            )}
          />
        ))}
      </div>

      <Button
        size="lg"
        className="h-13 w-full rounded-2xl text-base font-bold"
        onClick={() => (index === SLIDES.length - 1 ? finish() : setIndex(index + 1))}
      >
        {index === SLIDES.length - 1 ? "Get Started" : "Next"}
      </Button>
      <button
        type="button"
        onClick={() => {
          completeOnboarding();
          navigate({ to: "/login" });
        }}
        className="press mt-4 text-center text-sm font-semibold text-muted-foreground"
      >
        I already have an account
      </button>
    </main>
  );
}
