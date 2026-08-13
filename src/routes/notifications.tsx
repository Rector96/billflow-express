import { createFileRoute } from "@tanstack/react-router";
import { BellOff, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/ui-bits";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: `Notifications — ${BRAND.name}` },
      { name: "description", content: "Payment alerts, wallet updates and account news." },
      { property: "og:title", content: `Notifications — ${BRAND.name}` },
      { property: "og:description", content: "Stay on top of every payment." },
    ],
  }),
  component: NotificationsPage,
});

const STYLES = {
  success: { Icon: CheckCircle2, cls: "bg-success-soft text-success" },
  warning: { Icon: TriangleAlert, cls: "bg-warning-soft text-warning-foreground" },
  info: { Icon: Info, cls: "bg-primary-soft text-primary" },
} as const;

function NotificationsPage() {
  const { notifications } = useApp();

  return (
    <AppShell>
      <PageHeader title="Notifications" backTo="/home" />
      <div className="space-y-3 px-4 pt-2 pb-6">
        {notifications.length ? (
          notifications.map((n) => {
            const s = STYLES[n.type];
            return (
              <article key={n.id} className="flex gap-3 rounded-2xl border bg-card p-3.5 shadow-card">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", s.cls)}>
                  <s.Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{n.time}</p>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState Icon={BellOff} title="No notifications" body="You're all caught up." />
        )}
      </div>
    </AppShell>
  );
}
