import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { ONBOARDING_SLIDES } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: `Welcome to ${BRAND.name}` },
      { name: "description", content: `See how ${BRAND.name} makes paying Nigerian bills simple.` },
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
    <main className="relative min-h-dvh w-full overflow-hidden bg-black">
      <img
        key={slide.image}
        src={slide.image}
        alt={slide.imageAlt}
        className="absolute inset-0 size-full object-cover"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <div className="flex items-center justify-between px-5 pt-6">
          <span className="text-sm font-extrabold tracking-tight text-white drop-shadow">
            {BRAND.name}
          </span>
          {index < slides.length - 1 ? (
            <button
              type="button"
              onClick={finish}
              className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              Skip
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col justify-end px-5 pb-8 pt-16">
          <div className="mx-auto w-full max-w-md space-y-3 text-center sm:text-left">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md sm:text-4xl">
              {slide.title}
            </h1>
            <p className="text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">{slide.body}</p>
          </div>

          <div className="mx-auto mt-8 flex w-full max-w-md justify-center gap-2 sm:justify-start">
            {slides.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-8 bg-white" : "w-1.5 bg-white/40",
                )}
              />
            ))}
          </div>

          <div className="mx-auto mt-6 w-full max-w-md space-y-3">
            <Button
              size="lg"
              className="h-13 w-full rounded-2xl bg-white text-base font-bold text-primary hover:bg-white/95"
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
              className="w-full text-center text-sm font-semibold text-white/85"
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
