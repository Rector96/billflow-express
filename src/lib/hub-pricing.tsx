/**
 * Live hub fees from Supabase pricing_rules (service slug), with static fallback.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { getHubServiceFee } from "@/lib/hub.functions";
import { SERVICE_PRICES, type HubPriceKey } from "@/lib/hub-service-prices";

type FeeMap = Partial<Record<string, number>>;

type HubPricingContextValue = {
  fees: FeeMap;
  loading: boolean;
  getFee: (slugOrKey: string, fallbackKey?: HubPriceKey) => number;
  refresh: () => Promise<void>;
};

const HubPricingContext = createContext<HubPricingContextValue | null>(null);

const DEFAULT_SLUGS = ["tin", "documents", "vehicle", "cac", "nin"] as const;

export function HubPricingProvider({
  children,
  slugs = DEFAULT_SLUGS,
}: {
  children: ReactNode;
  slugs?: readonly string[];
}) {
  const fetchFee = useServerFn(getHubServiceFee);
  const [fees, setFees] = useState<FeeMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next: FeeMap = {};
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const r = await fetchFee({ data: { serviceSlug: slug } });
          next[slug] = r.fee;
        } catch {
          /* keep fallback */
        }
      }),
    );
    setFees(next);
    setLoading(false);
  }, [fetchFee, slugs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getFee = useCallback(
    (slugOrKey: string, fallbackKey?: HubPriceKey) => {
      const live = fees[slugOrKey];
      if (typeof live === "number" && live > 0) return live;
      const key = fallbackKey ?? (slugOrKey as HubPriceKey);
      if (key in SERVICE_PRICES) return SERVICE_PRICES[key as HubPriceKey];
      return SERVICE_PRICES.tin_retrieve;
    },
    [fees],
  );

  const value = useMemo(
    () => ({ fees, loading, getFee, refresh }),
    [fees, loading, getFee, refresh],
  );

  return <HubPricingContext.Provider value={value}>{children}</HubPricingContext.Provider>;
}

export function useHubPricing() {
  const ctx = useContext(HubPricingContext);
  if (!ctx) {
    return {
      fees: {} as FeeMap,
      loading: false,
      getFee: (slugOrKey: string, fallbackKey?: HubPriceKey) => {
        const key = fallbackKey ?? (slugOrKey as HubPriceKey);
        if (key in SERVICE_PRICES) return SERVICE_PRICES[key as HubPriceKey];
        return SERVICE_PRICES.tin_retrieve;
      },
      refresh: async () => {},
    } satisfies HubPricingContextValue;
  }
  return ctx;
}
