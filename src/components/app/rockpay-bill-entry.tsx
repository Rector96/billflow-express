import { Link, useParams } from "@tanstack/react-router";
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
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <p className="text-sm font-bold">Coming soon</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This RockPay bill service is not enabled yet.
          </p>
          <Button className="mt-5 h-11 rounded-xl font-bold" asChild>
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
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          We could not find that service.
        </div>
      </AppShell>
    );
  }

  return <RockPayBillFlow />;
}
