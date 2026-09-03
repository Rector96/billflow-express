import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SearchX, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ServiceTile } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { SERVICES } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: `Services — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Electricity, cable TV, education, airtime, data, internet, water, insurance and exam pins.",
      },
      { property: "og:title", content: `Services — ${BRAND.name}` },
      { property: "og:description", content: "All your everyday payments in one place." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const [query, setQuery] = useState("");
  const list = SERVICES.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <AppShell>
      <PageHeader title="Services" backTo="/home" />
      <div className="space-y-5 px-4 pt-1 pb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services"
            aria-label="Search services"
            className="h-11 rounded-2xl border-border/50 bg-card pl-10 text-sm shadow-soft"
          />
        </div>

        {list.length ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
            {list.map((s) => {
              const soon =
                s.slug === "education" ||
                s.slug === "exam-pins" ||
                s.slug === "internet" ||
                s.slug === "water" ||
                s.slug === "insurance";
              return (
                <ServiceTile
                  key={s.slug}
                  label={soon ? `${s.short} · Soon` : s.short}
                  Icon={s.icon}
                  tint={s.tint}
                  to="/pay/$slug"
                  params={{ slug: s.slug }}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            Icon={SearchX}
            title="No service found"
            body="Try a different keyword, like electricity, data or DSTV."
          />
        )}

        <div className="flex items-center gap-3 rounded-2xl bg-primary-soft/80 px-3.5 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">Easy. Reliable. Secure.</p>
            <p className="text-xs text-muted-foreground">Your payments are safe with us.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
