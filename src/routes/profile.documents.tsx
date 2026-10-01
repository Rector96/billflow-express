/**
 * Profile → My documents — download hub certificates / slips when staff attaches a link.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { listMyHubDocuments, type MyHubDocument } from "@/lib/hub-documents.functions";
import { formatNaira } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile/documents")({
  head: () => ({
    meta: [
      { title: `My documents — ${BRAND.name}` },
      { name: "description", content: "Download certificates and files from your applications." },
    ],
  }),
  component: MyDocumentsPage,
});

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "successful") return "bg-emerald-500/15 text-emerald-700";
  if (s === "in_progress" || s === "pending") return "bg-amber-500/15 text-amber-800";
  if (s === "failed") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
}

function MyDocumentsPage() {
  const runList = useServerFn(listMyHubDocuments);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<MyHubDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runList();
      setDocs(res.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [runList]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <PageHeader title="My documents" backTo="/profile" />
      <div className="mx-auto max-w-md space-y-3 px-4 pb-8 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">CAC, NIN, vehicle & more</p>
          <button
            type="button"
            onClick={() => void load()}
            className="press flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
          </button>
        </div>

        {error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading && docs.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : null}

        {!loading && docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card px-4 py-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No applications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paid CAC, NIN and related services will show here.
            </p>
            <Button
              asChild
              className="mt-4 h-10 rounded-xl text-xs font-semibold"
              variant="outline"
            >
              <Link to="/services">Browse services</Link>
            </Button>
          </div>
        ) : null}

        {docs.map((d) => (
          <article
            key={d.id}
            className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold capitalize">{d.service.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleString("en-NG")} · {formatNaira(d.amount, false)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  statusTone(d.status),
                )}
              >
                {d.status.replace(/_/g, " ")}
              </span>
            </div>
            {d.shipping_address ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Deliver: {d.shipping_address}
              </p>
            ) : null}
            {d.fulfillment_status ? (
              <p className="mt-1 text-[11px] font-medium text-primary">
                Dispatch: {d.fulfillment_status.replace(/_/g, " ")}
              </p>
            ) : null}
            <div className="mt-3">
              {d.document_url ? (
                <a
                  href={d.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground"
                >
                  <Download className="size-3.5" /> Download
                </a>
              ) : (
                <p className="rounded-xl bg-muted/50 px-3 py-2 text-center text-[11px] text-muted-foreground">
                  {d.status === "successful"
                    ? "File not attached yet — contact Support if this is delayed."
                    : "We’ll notify you when the file is ready."}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
