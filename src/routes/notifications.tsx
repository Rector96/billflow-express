import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: `Notifications — ${BRAND.name}` },
      { name: "description", content: "Your latest updates and alerts." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { notifications, markAllRead, markRead } = useApp();

  return (
    <AppShell>
      <PageHeader title="Notifications" backTo="/home" />

      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-2 lg:max-w-2xl lg:px-0">
        <p className="text-xs text-muted-foreground">
          {notifications.filter((n) => !n.read).length} unread
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-lg text-xs font-semibold"
          onClick={() => markAllRead()}
        >
          <CheckCheck className="mr-1.5 size-3.5" /> Mark all read
        </Button>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3 px-4 pt-2 pb-8 lg:max-w-2xl lg:px-0">
        {notifications.length === 0 ? (
          <EmptyState
            Icon={Bell}
            title="No notifications yet"
            body="Updates about payments, deliveries and support will show up here."
          />
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markRead(n.id)}
              className={cn(
                "w-full rounded-2xl border bg-card p-4 text-left shadow-card transition",
                !n.read && "border-primary/30 bg-primary-soft/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{n.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                </div>
                {!n.read ? <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{n.time}</p>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}
