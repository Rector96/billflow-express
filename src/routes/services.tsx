import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SearchX, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ServiceTile } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { SERVICES } from "@/lib/mock-data";
import { isBillLive, isServiceVisible } from "@/lib/product-mode";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: `Services — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Electricity, cable, education, airtime, data, CAC, NIN, TIN and document services.",
      },
      { property: "og:title", content: `Services — ${BRAND.name}` },
      { property: "og:description", content: "All your everyday payments in one place." },
    ],
  }),
  component: ServicesPage,
});

function servicePath(slug: string): { to: string; params?: { slug: string } } {
  if (slug === "cac") return { to: "/cac" };
  if (slug === "nin") return { to: "/nin" };
  if (slug === "tin") return { to: "/tin" };
  if (slug === "documents") return { to: "/documents" };
  return { to: "/pay/$slug", params: { slug } };
}

function ServicesPage() {
  const [query, setQuery] = useState("");
  const list = SERVICES.filter(
    (s) => isServiceVisible(s.slug) && s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader title="All Services" backTo="/home" />
      <div className="space-y-4 px-4 pt-1 pb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search airtime, NIN, TIN, CAC..."
            aria-label="Search services"
            className="h-10.5 rounded-xl border-border/80 bg-card pl-10 text-sm shadow-soft"
          />
        </div>

        {list.length ? (
          <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-card">
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
              {list.map((s) => {
                const live = isBillLive(s.slug);
                const path = servicePath(s.slug);
                return (
                  <ServiceTile
                    key={s.slug}
                    label={live ? s.short : `${s.short} · Soon`}
                    Icon={s.icon}
                    tint={s.tint}
                    to={path.to}
                    params={path.params}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            Icon={SearchX}
            title="No service found"
            body="Try a different keyword, like electricity, NIN or CAC."
          />
        )}

        <div className="pt-2 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Protected by bank-grade encryption
          </p>
        </div>
      </div>
    </AppShell>
  );
}
