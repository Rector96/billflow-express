import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const preload = slides.map((item) => {
      const image = new Image();
      image.src = item.image;
      return image;
    });
    return () => preload.forEach((image) => image.src = "");
  }, [slides]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <main className="fixed inset-0 z-50 h-dvh w-full overflow-hidden bg-black">
      {slides.map((item, i) => (
        <img
          key={item.image}
          src={item.image}
          alt={item.imageAlt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-[center_30%] transition-opacity duration-700 ease-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />

      <div className="relative z-10 flex h-full min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-white drop-shadow">
            {BRAND.name}
          </span>
          {index < slides.length - 1 ? (
            <button
              type="button"
              onClick={finish}
              className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
            >
              Skip
            </button>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-5 pb-2">
          <div className="mx-auto w-full max-w-md space-y-2 text-left">
            <h1 className="text-[1.85rem] font-extrabold leading-tight tracking-tight text-white drop-shadow-md sm:text-4xl">
              {slide.title}
            </h1>
            <p className="text-[15px] leading-relaxed text-white/90 drop-shadow sm:text-lg">
              {slide.body}
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-md justify-start gap-2">
            {slides.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-8 bg-white" : "w-1.5 bg-white/40",
                )}
              />
            ))}
          </div>

          <div className="mx-auto w-full max-w-md space-y-3">
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
              className="w-full text-center text-sm font-semibold text-white/90"
            >
              I already have an account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
