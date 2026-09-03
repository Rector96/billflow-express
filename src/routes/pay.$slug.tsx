import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ExamPinsFlow } from "@/components/app/exam-pins-flow";
import { PageHeader } from "@/components/app/page-header";
import { InfoRow } from "@/components/app/ui-bits";
import { PayStepBody, PayStepper, type PayStepMeta } from "@/components/app/pay-step";
import { PinPad } from "@/components/app/pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { purchaseAirtime, requeryAirtime } from "@/lib/airtime.functions";
import {
  listVtpassServices,
  listVtpassVariations,
  purchaseCable,
  purchaseData,
  purchaseElectricity,
  requeryBill,
  verifyVtpassCustomer,
} from "@/lib/bills.functions";
import {
  lastSuccessfulProvider,
  recentAmountsForService,
  recentPackagesForService,
  recentSavedForService,
  type RecentBeneficiary,
} from "@/lib/fast-pay";
import {
  formatNaira,
  getService,
  maskTail,
  type Package,
  type TxStatus,
} from "@/lib/mock-data";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Search = {
  saved?: string | undefined;
  provider?: string | undefined;
  amount?: number | undefined;
  identifier?: string | undefined;
};

export const Route = createFileRoute("/pay/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["saved"] === "string") out.saved = s["saved"];
    if (typeof s["provider"] === "string") out.provider = s["provider"];
    if (typeof s["identifier"] === "string") out.identifier = s["identifier"];
    if (typeof s["amount"] === "number" && Number.isFinite(s["amount"])) out.amount = s["amount"] as number;
    if (typeof s["amount"] === "string" && s["amount"].trim() !== "") {
      const n = Number(s["amount"]);
      if (Number.isFinite(n)) out.amount = n;
    }
    return out;
  },
  head: ({ params }) => {
    const svc = getService(params.slug);
    const name = svc?.name ?? "Payment";
    return {
      meta: [
        { title: `Pay ${name} — ${BRAND.name}` },
        { name: "description", content: `Pay your ${name.toLowerCase()} bill in a few taps.` },
      ],
    };
  },
  component: PayFlow,
});
