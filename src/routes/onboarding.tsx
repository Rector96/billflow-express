import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { ONBOARDING_SLIDES } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/app/app-shell";

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

function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();
  const slides = ONBOARDING_SLIDES;
  const slide = slides[index]!;

  const finish = () => {
    completeOnboarding();
    navigate({ to: "/signup" });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-background px-5 pb-8 pt-6">
      <div className="flex items-center justify-between gap-3">
        <BrandLogo className="h-[clamp(2.5rem,11vw,3.75rem)]" />
        {index < slides.length - 1 ? (
          <button
            type="button"
            onClick={finish}
            className="press rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground"
          >
            Skip
          </button>
        ) : null}
      </div>

      <div key={slide.title} className="page-fade flex flex-1 flex-col justify-center gap-6 py-6">
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-card">
          <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
            <img
              src={slide.image}
              alt={slide.imageAlt}
              className="size-full object-cover"
              loading="eager"
              decoding="async"
            />
          </div>
          <div className="space-y-2 px-5 py-5 text-center">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{slide.title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-7 bg-primary" : "w-1.5 bg-border",
            )}
          />
        ))}
      </div>

      <Button
        size="lg"
        className="h-13 w-full rounded-2xl text-base font-bold"
        onClick={() => (index === slides.length - 1 ? finish() : setIndex(index + 1))}
      >
        {index === slides.length - 1 ? "Get Started" : "Next"}
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
