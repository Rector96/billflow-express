import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SearchX, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ServiceTile } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { SERVICES, type ServiceConfig } from "@/lib/mock-data";
import { isServiceVisible, serviceAvailabilityLabel } from "@/lib/product-mode";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/services")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Services — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Electricity, cable, education, airtime, data, CAC, NIN, TIN, documents and vehicle services.",
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
  if (slug === "vehicle") return { to: "/vehicle" };
  return { to: "/pay/$slug", params: { slug } };
}

const GROUPS: Array<{ id: string; title: string; slugs: string[] }> = [
  {
    id: "bills",
    title: "Everyday bills",
    slugs: ["airtime", "data", "electricity", "cable", "internet", "water", "insurance"],
  },
  {
    id: "gov",
    title: "Government & business",
    slugs: ["cac", "tin"],
  },
  {
    id: "identity",
    title: "Identity",
    slugs: ["nin"],
  },
  {
    id: "docs",
    title: "Documents",
    slugs: ["documents"],
  },
  {
    id: "vehicle",
    title: "Vehicle",
    slugs: ["vehicle"],
  },
  {
    id: "edu",
    title: "Education",
    slugs: ["education", "exam-pins"],
  },
];

function ServicesPage() {
  const { q: qFromSearch } = Route.useSearch();
  const [query, setQuery] = useState(qFromSearch ?? "");

  const visible = useMemo(
    () =>
      SERVICES.filter(
        (s) =>
          isServiceVisible(s.slug) && s.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  const grouped = useMemo(() => {
    const bySlug = new Map(visible.map((s) => [s.slug, s]));
    return GROUPS.map((g) => ({
      ...g,
      items: g.slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ServiceConfig[],
    })).filter((g) => g.items.length > 0);
  }, [visible]);

  return (
    <AppShell>
      <PageHeader title="All Services" backTo="/home" />
      <div className="space-y-4 px-4 pt-1 pb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search airtime, NIN, TIN, CAC, vehicle..."
            aria-label="Search services"
            className="h-10.5 rounded-xl border-border/80 bg-card pl-10 text-sm shadow-soft"
          />
        </div>

        {grouped.length ? (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.id}>
                <p className="mb-2 px-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {g.title}
                </p>
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-card">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
                    {g.items.map((s) => {
                      const path = servicePath(s.slug);
                      return (
                        <ServiceTile
                          key={s.slug}
                          label={serviceAvailabilityLabel(s.slug, s.short)}
                          Icon={s.icon}
                          tint={s.tint}
                          to={path.to}
                          params={path.params}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
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
