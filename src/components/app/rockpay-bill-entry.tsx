// @ts-nocheck -- generated DB types are out of date with the live schema; re-enable after regenerating types.
import { Link, useParams } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getService } from "@/lib/mock-data";
import { RockPayEducationFlow } from "@/components/app/rockpay-education-flow";
import { RockPayBillFlow } from "@/components/app/rockpay-bill-flow";

export function RockPayBillEntry() {
  const { slug } = useParams({ from: "/pay/$slug" });
  const service = getService(slug);

  if (slug === "education") return <RockPayEducationFlow entryTitle="Education" />;
  if (slug === "exam-pins") return <RockPayEducationFlow entryTitle="Exam Pins" />;

  if (slug === "internet" || slug === "water" || slug === "insurance") {
    return (
      <AppShell>
        <PageHeader title={service?.name ?? "Coming soon"} backTo="/services" />
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-12 text-center lg:max-w-lg lg:px-0 lg:py-16">
          <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="size-7" strokeWidth={1.8} />
          </span>
          <p className="mt-4 text-lg font-extrabold tracking-tight">Coming soon</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            This bill service is not enabled yet. We will open it when the provider path is verified.
          </p>
          <Button className="mt-6 h-11 rounded-xl font-semibold" asChild>
            <Link to="/services">Back to services</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!service) {
    return (
      <AppShell>
        <PageHeader title="Service unavailable" backTo="/services" />
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-12 text-center lg:max-w-lg lg:px-0">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldCheck className="size-7" strokeWidth={1.8} />
          </span>
          <p className="mt-4 text-lg font-extrabold tracking-tight">Service unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">We could not find that service.</p>
          <Button className="mt-6 h-11 rounded-xl font-semibold" asChild>
            <Link to="/services">Back to services</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <RockPayBillFlow />;
}
