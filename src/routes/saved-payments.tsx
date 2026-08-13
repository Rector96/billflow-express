import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-store";
import { getService, SERVICES, type ServiceSlug } from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/saved-payments")({
  head: () => ({
    meta: [
      { title: `Saved payments — ${BRAND.name}` },
      { name: "description", content: "Save your meters and smartcards to repay in one tap." },
      { property: "og:title", content: `Saved payments — ${BRAND.name}` },
      { property: "og:description", content: "Repeat bills without retyping anything." },
    ],
  }),
  component: SavedPaymentsPage,
});

function SavedPaymentsPage() {
  const { saved, addSaved, removeSaved } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [slug, setSlug] = useState<ServiceSlug>("electricity");
  const [provider, setProvider] = useState("AEDC");

  const service = getService(slug)!;

  return (
    <AppShell>
      <PageHeader title="Saved Payments" backTo="/profile" />
      <div className="space-y-3 px-4 pt-2 pb-6">
        {saved.map((item) => {
          const svc = getService(item.serviceSlug)!;
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", svc.tint)}>
                <svc.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.provider} • {item.masked}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => {
                  removeSaved(item.id);
                  toast.success("Saved payment removed");
                }}
                className="press grid size-9 place-items-center rounded-lg text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
              <Button
                size="sm"
                className="press h-9 rounded-lg px-5 font-bold"
                onClick={() =>
                  navigate({
                    to: "/pay/$slug",
                    params: { slug: item.serviceSlug },
                    search: { saved: item.id },
                  })
                }
              >
                Pay
              </Button>
            </div>
          );
        })}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-bold text-primary">
            <Plus className="size-4" /> Add New
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add saved payment</DialogTitle>
              <DialogDescription>Demo only — nothing is sent to a provider.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Nickname</Label>
                <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Home Electricity" className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.slice(0, 5).map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => {
                        setSlug(s.slug);
                        setProvider(s.providers[0] ?? "");
                      }}
                      className={cn(
                        "press h-9 rounded-full border px-3 text-xs font-bold",
                        slug === s.slug ? "border-primary bg-primary-soft text-primary" : "",
                      )}
                    >
                      {s.short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="flex flex-wrap gap-2">
                  {service.providers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className={cn(
                        "press h-9 rounded-full border px-3 text-xs font-bold",
                        provider === p ? "border-primary bg-primary-soft text-primary" : "",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ident">{service.identifierLabel}</Label>
                <Input id="ident" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={service.identifierPlaceholder} className="h-12 rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="h-12 w-full rounded-xl font-bold"
                onClick={() => {
                  if (!label.trim() || identifier.trim().length < 4) {
                    toast.error("Add a nickname and a valid number");
                    return;
                  }
                  addSaved({
                    id: `sp-${Date.now()}`,
                    label,
                    provider,
                    serviceSlug: slug,
                    masked: `••••${identifier.slice(-3)}`,
                    identifier,
                  });
                  setLabel("");
                  setIdentifier("");
                  setOpen(false);
                  toast.success("Saved payment added");
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
