import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { WelcomeScreen } from "@/components/app/welcome-screen";

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
  component: WelcomeScreen,
});
