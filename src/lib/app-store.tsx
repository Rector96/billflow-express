import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppNotification, SavedPayment, ServiceSlug, Transaction, TxStatus } from "./mock-data";

export type Profile = {
  name: string;
  phone: string;
  email: string;
  billpayId: string;
  avatarUrl: string;
  accountStatus: string;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  phone: "",
  email: "",
  billpayId: "",
  avatarUrl: "",
  accountStatus: "active",
};

export type DemoBillInput = {
  service: string;
  serviceSlug: ServiceSlug | string;
  provider: string;
  product?: string | undefined;
  amount: number;
  identifier: string;
  status: TxStatus;
  title: string;
  customer?: string | undefined;
  token?: string | undefined;
};

type AppState = {
  authed: boolean;
  hydrated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  seenOnboarding: boolean;
  completeOnboarding: () => void;
  profile: Profile;
  updateProfile: (p: Partial<Pick<Profile, "name" | "phone" | "email">>) => Promise<void>;
  balance: number;
  hideBalance: boolean;
  toggleBalance: () => void;
  fundWallet: (amount: number) => Promise<string>;
  payBill: (input: DemoBillInput) => Promise<string>;
  transactions: Transaction[];
  saved: SavedPayment[];
  addSaved: (s: Omit<SavedPayment, "id" | "masked">) => Promise<void>;
  updateSaved: (id: string, s: Partial<Omit<SavedPayment, "id" | "masked">>) => Promise<void>;
  removeSaved: (id: string) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  createSupportTicket: (input: {
    reference?: string | undefined;
    category: string;
    description: string;
  }) => Promise<string>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

const PREFS_KEY = "billpay-prefs-v1";

/** Never surface raw backend errors to users. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  console.error("[billpay]", message);
  if (message.includes("insufficient_funds")) return "Your wallet balance is too low for this payment.";
  if (message.includes("not authenticated") || message.includes("JWT"))
    return "Your session has expired. Please log in again.";
  return fallback;
}

const money = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}
function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(iso);
}

type Meta = Record<string, unknown>;
const str = (m: Meta, k: string) => (typeof m[k] === "string" ? (m[k] as string) : undefined);

type LedgerRow = {
  reference: string;
  type: string;
  amount: number | string;
  status: string;
  description: string | null;
  metadata: Meta | null;
  created_at: string;
};

function toTransaction(row: LedgerRow): Transaction {
  const meta = row.metadata ?? {};
  const isIn = row.type === "deposit" || row.type === "refund";
  const status: TxStatus =
    row.status === "successful" ? "successful" : row.status === "pending" ? "pending" : "failed";
  const token = str(meta, "token");
  const customer = str(meta, "customer");
  const reference = str(meta, "masked");
  return {
    id: str(meta, "bill_reference") ?? row.reference,
    title: str(meta, "title") ?? (isIn ? "Wallet Funded" : (row.description ?? "Payment")),
    service:
      str(meta, "service_label") ??
      (isIn
        ? str(meta, "channel") === "paystack"
          ? "Paystack Top-up"
          : "Wallet Top-up"
        : (row.description ?? "")),
    serviceSlug: str(meta, "service_slug") ?? "wallet",
    amount: money(row.amount),
    direction: isIn ? "in" : "out",
    status,
    date: fmtDate(row.created_at),
    time: fmtTime(row.created_at),
    method: isIn ? "Demo Funding" : "Wallet",
    ...(customer ? { customer } : {}),
    ...(reference ? { reference } : {}),
    ...(token ? { token } : {}),
  };
}

const NOTIF_TYPE: Record<string, AppNotification["type"]> = {
  success: "success",
  warning: "warning",
  pending: "warning",
  information: "info",
  security: "info",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [saved, setSaved] = useState<SavedPayment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const bootstrapped = useRef(false);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { seenOnboarding?: boolean; hideBalance?: boolean };
        setSeenOnboarding(Boolean(parsed.seenOnboarding));
        setHideBalance(Boolean(parsed.hideBalance));
      }
    } catch {
      /* preferences are optional */
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        bootstrapped.current = false;
        setProfile(EMPTY_PROFILE);
        setBalance(0);
        setTransactions([]);
        setSaved([]);
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setHydrated(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ seenOnboarding, hideBalance }));
    } catch {
      /* preferences are optional */
    }
  }, [seenOnboarding, hideBalance, hydrated]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        const meta = (session?.user.user_metadata ?? {}) as Record<string, unknown>;
        await supabase.rpc("bootstrap_current_user", {
          ...(typeof meta["full_name"] === "string" ? { _full_name: meta["full_name"] } : {}),
          ...(typeof meta["phone"] === "string" ? { _phone: meta["phone"] } : {}),
        });
      }

      const [p, w, ledger, sp, notif, unread] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone, email, billpay_id, avatar_url, account_status")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
        supabase
          .from("wallet_transactions")
          .select("reference, type, amount, status, description, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("saved_payments")
          .select("id, service, provider, nickname, customer_identifier")
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("id, title, message, type, read, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("read", false),
      ]);

      if (p.data) {
        setProfile({
          name: p.data.full_name ?? "",
          phone: p.data.phone ?? "",
          email: p.data.email ?? "",
          billpayId: p.data.billpay_id ?? "",
          avatarUrl: p.data.avatar_url ?? "",
          accountStatus: p.data.account_status ?? "active",
        });
      }
      if (w.data) setBalance(money(w.data.balance));
      if (ledger.data) setTransactions(ledger.data.map((r) => toTransaction(r as LedgerRow)));
      if (sp.data) {
        setSaved(
          sp.data.map((r) => ({
            id: r.id,
            label: r.nickname ?? "Saved payment",
            provider: r.provider,
            serviceSlug: r.service as ServiceSlug,
            masked: `••••${r.customer_identifier.slice(-3)}`,
            identifier: r.customer_identifier,
          })),
        );
      }
      if (notif.data) {
        setNotifications(
          notif.data.map((n) => ({
            id: n.id,
            type: NOTIF_TYPE[n.type] ?? "info",
            title: n.title,
            body: n.message,
            time: relative(n.created_at),
            read: n.read,
          })),
        );
      }
      setUnreadCount(unread.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [userId, session]);

  useEffect(() => {
    if (userId) void loadAll();
  }, [userId, loadAll]);

  const value = useMemo<AppState>(
    () => ({
      authed: Boolean(userId),
      hydrated,
      loading,
      logout: async () => {
        await supabase.auth.signOut();
      },
      seenOnboarding,
      completeOnboarding: () => setSeenOnboarding(true),
      profile,
      updateProfile: async (p) => {
        if (!userId) throw new Error("not authenticated");
        const { error } = await supabase
          .from("profiles")
          .update({
            ...(p.name !== undefined ? { full_name: p.name } : {}),
            ...(p.phone !== undefined ? { phone: p.phone } : {}),
            ...(p.email !== undefined ? { email: p.email } : {}),
          })
          .eq("user_id", userId);
        if (error) throw error;
        setProfile((prev) => ({ ...prev, ...p }));
      },
      balance,
      hideBalance,
      toggleBalance: () => setHideBalance((v) => !v),
      fundWallet: async (amount) => {
        const { data, error } = await supabase.rpc("demo_fund_wallet", {
          _amount: amount,
          _description: "Demo wallet funding",
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        await loadAll();
        return row?.reference ?? "";
      },
      payBill: async (input) => {
        const { data, error } = await supabase.rpc("demo_bill_payment", {
          _service: input.service,
          _provider: input.provider,
          _product: input.product ?? "",
          _amount: input.amount,
          _customer_identifier: input.identifier,
          _status: input.status,
          _metadata: {
            demo: true,
            title: input.title,
            service_slug: input.serviceSlug,
            service_label: `${input.provider} ${input.service}`,
            masked: `••••${input.identifier.slice(-4)}`,
            ...(input.customer ? { customer: input.customer } : {}),
            ...(input.token ? { token: input.token } : {}),
          },
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : null;
        await loadAll();
        return row?.internal_reference ?? "";
      },
      transactions,
      saved,
      addSaved: async (s) => {
        if (!userId) throw new Error("not authenticated");
        const { error } = await supabase.from("saved_payments").insert({
          user_id: userId,
          service: s.serviceSlug,
          provider: s.provider,
          nickname: s.label,
          customer_identifier: s.identifier,
        });
        if (error) throw error;
        await loadAll();
      },
      updateSaved: async (id, s) => {
        const { error } = await supabase
          .from("saved_payments")
          .update({
            ...(s.label !== undefined ? { nickname: s.label } : {}),
            ...(s.provider !== undefined ? { provider: s.provider } : {}),
            ...(s.serviceSlug !== undefined ? { service: s.serviceSlug } : {}),
            ...(s.identifier !== undefined ? { customer_identifier: s.identifier } : {}),
          })
          .eq("id", id);
        if (error) throw error;
        await loadAll();
      },
      removeSaved: async (id) => {
        const { error } = await supabase.from("saved_payments").delete().eq("id", id);
        if (error) throw error;
        setSaved((list) => list.filter((s) => s.id !== id));
      },
      notifications,
      unreadCount,
      markNotificationRead: async (id) => {
        const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
        if (error) throw error;
        setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setUnreadCount((c) => Math.max(0, c - 1));
      },
      markAllNotificationsRead: async () => {
        if (!userId) return;
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", userId)
          .eq("read", false);
        if (error) throw error;
        setNotifications((list) => list.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      },
      createSupportTicket: async ({ reference, category, description }) => {
        if (!userId) throw new Error("not authenticated");
        let transactionId: string | null = null;
        if (reference) {
          const { data } = await supabase
            .from("bill_transactions")
            .select("id")
            .eq("internal_reference", reference)
            .maybeSingle();
          transactionId = data?.id ?? null;
        }
        const { data, error } = await supabase
          .from("support_tickets")
          .insert({
            user_id: userId,
            transaction_id: transactionId,
            category: category as never,
            description,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      },
      refresh: loadAll,
    }),
    [
      userId,
      hydrated,
      loading,
      seenOnboarding,
      profile,
      balance,
      hideBalance,
      transactions,
      saved,
      notifications,
      unreadCount,
      loadAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
