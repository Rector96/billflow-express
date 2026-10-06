import { createFileRoute } from "@tanstack/react-router";
import { WelcomeScreen } from "@/components/app/welcome-screen";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: `Welcome to ${BRAND.name} — Get started` },
      { name: "description", content: "Get started with RockPay for Nigerian bills, data and essential services." },
      { property: "og:title", content: "Welcome to RockPay — Get started" },
      { property: "og:description", content: "Your everyday bills, data and essential services in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomeScreen,
});
