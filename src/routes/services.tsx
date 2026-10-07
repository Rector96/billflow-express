// @ts-nocheck -- generated DB types are out of date with the live schema; re-enable after regenerating types.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Search, SearchX, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, ServiceTile } from "@/components/app/ui-bits";
import { Input } from "@/components/ui/input";
import { SERVICES, type ServiceConfig } from "@/lib/mock-data";
import {
  isBillLive,
  isHubDemoOnly,
  isServiceVisible,
  serviceAvailabilityLabel,
  HUB_PREVIEW_FLOWS,
} from "@/lib/product-mode";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/services")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Services — ${BRAND.name}` },
      {
        name: "description",
        content: "Electricity, cable, education, exam pins, CAC, NIN, TIN, documents and vehicle.",
      },
      { property: "og:title", content: `Services — ${BRAND.name}` },
      { property: "og:description", content: "Bills and official services in one place." },
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

type Category = { id: string; label: string; slugs: string[] };

const CATEGORIES: Category[] = [
  { id: "all", label: "All", slugs: [] },
  { id: "bills", label: "Bills", slugs: ["electricity", "cable"] },
  { id: "education", label: "Education", slugs: ["education", "exam-pins"] },
  { id: "government", label: "Government", slugs: ["cac", "tin"] },
  { id: "identity", label: "Identity", slugs: ["nin"] },
  { id: "documents", label: "Documents", slugs: ["documents"] },
  { id: "vehicle", label: "Vehicle", slugs: ["vehicle"] },
];

const FEATURED_SLUGS = ["electricity", "cable"] as const;
const BANNER_SLUGS = ["education", "exam-pins"] as const;

const GRID_GROUPS: Array<{ id: string; title: string; slugs: string[] }> = [
  { id: "gov", title: "Government & business", slugs: ["cac", "tin"] },
  { id: "identity", title: "Identity", slugs: ["nin"] },
  { id: "docs", title: "Documents", slugs: ["documents"] },
  { id: "vehicle", title: "Vehicle", slugs: ["vehicle"] },
];

function statusChip(slug: string): { label: string; cls: string } | null {
  if (isBillLive(slug)) {
    return {
      label: "Live",
      cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25",
    };
  }
  if (isHubDemoOnly(slug) && HUB_PREVIEW_FLOWS) {
    return {
      label: "Demo",
      cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25",
    };
  }
  return null;
}

/** Large gradient bento card for the high-frequency bill services. */
function FeaturedCard({ service }: { service: ServiceConfig }) {
  const path = servicePath(service.slug);
  const chip = statusChip(service.slug);
  const Icon = service.icon;
  return (
    <Link
      to={path.to}
      {...(path.params ? { params: path.params } : {})}
      className="press group relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-3xl brand-gradient p-4 text-primary-foreground shadow-float"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/10 blur-xl transition-transform duration-300 group-hover:scale-125"
      />
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-white/15 shadow-sm backdrop-blur-sm">
          <Icon className="size-5" strokeWidth={1.9} />
        </span>
        {chip ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              "border border-white/25 bg-white/15 text-primary-foreground",
            )}
          >
            {chip.label}
          </span>
        ) : null}
      </div>
      <div className="relative">
        <p className="text-sm font-extrabold tracking-tight">{service.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium opacity-85">
          Pay instantly
          <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </p>
      </div>
    </Link>
  );
}

/** Full-width banner card for education & exam pins. */
function EducationBanner({ services }: { services: ServiceConfig[] }) {
  const primary = services[0];
  if (!primary) return null;
  const path = servicePath(primary.slug);
  const Icon = primary.icon;
  return (
    <Link
      to={path.to}
      {...(path.params ? { params: path.params } : {})}
      className="press group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-card"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
        <Icon className="size-6" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold tracking-tight text-foreground">
          Education & exam pins
        </p>
        <p className="truncate text-xs text-muted-foreground">
          WAEC, NECO, JAMB pins delivered instantly
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
        <Zap className="size-3" />
        Instant
      </span>
    </Link>
  );
}

function ServicesPage() {
  const { q: qFromSearch } = Route.useSearch();
  const [query, setQuery] = useState(qFromSearch ?? "");
  const [category, setCategory] = useState("all");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const active = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
    return SERVICES.filter((s) => {
      if (!isServiceVisible(s.slug)) return false;
      if (active.slugs.length > 0 && !active.slugs.includes(s.slug)) return false;
      if (term && !s.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [query, category]);

  const bySlug = useMemo(() => new Map(visible.map((s) => [s.slug, s])), [visible]);

  const featured = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(
    Boolean,
  ) as ServiceConfig[];
  const banner = BANNER_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean) as ServiceConfig[];
  const groups = GRID_GROUPS.map((g) => ({
    ...g,
    items: g.slugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ServiceConfig[],
  })).filter((g) => g.items.length > 0);

  const searching = query.trim().length > 0;
  const hasResults = featured.length > 0 || banner.length > 0 || groups.length > 0;

  return (
    <AppShell>
      <PageHeader title="All Services" backTo="/home" />
      <div className="space-y-4 px-4 pt-2 pb-6">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bills, exam pins, NIN, CAC..."
            aria-label="Search services"
            className="h-11 rounded-2xl border-border/80 bg-card pl-10 text-sm shadow-soft"
          />
        </div>

        {/* Category chips */}
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Service categories"
        >
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "press shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/80 bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {hasResults ? (
          <div className="space-y-4">
            {/* Featured bento cards */}
            {featured.length > 0 ? (
              <section aria-label="Everyday bills">
                <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <Sparkles className="size-3" />
                  Everyday bills
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {featured.map((s) => (
                    <FeaturedCard key={s.slug} service={s} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Education banner */}
            {banner.length > 0 && !searching ? <EducationBanner services={banner} /> : null}
            {banner.length > 0 && searching ? (
              <section aria-label="Education and exam pins">
                <div className="rounded-3xl border border-border/80 bg-card p-3.5 shadow-card">
                  <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
                    {banner.map((s) => {
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
              </section>
            ) : null}

            {/* Remaining groups */}
            {groups.map((g) => (
              <section key={g.id} aria-label={g.title}>
                <p className="mb-2 px-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {g.title}
                </p>
                <div className="rounded-3xl border border-border/80 bg-card p-3.5 shadow-card">
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
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={SearchX}
            title="No service found"
            body="Try education, exam pins, electricity, NIN or CAC."
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
