// Safe in-memory and localStorage fallback client for AI Studio preview mode
// when external Supabase credentials have not yet been configured in .env.
// This guarantees that the preview, login, wallet, and bill flow work out of the box.

import type { Session, User } from "@supabase/supabase-js";

const DEMO_USER_ID = "demo-user-rockpay-001";

export const DEMO_USER: User = {
  id: DEMO_USER_ID,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {
    full_name: "Pablo Emmanuel",
    phone: "0803 123 4567",
  },
  aud: "authenticated",
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  email: "pablo@rockpay.ng",
  email_confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  phone: "0803 123 4567",
  role: "authenticated",
  updated_at: new Date().toISOString(),
};

export const DEMO_SESSION: Session = {
  access_token: "demo-jwt-preview-token-access",
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
  expires_in: 3600 * 24 * 7,
  refresh_token: "demo-jwt-preview-token-refresh",
  token_type: "bearer",
  user: DEMO_USER,
};

const STORAGE_KEY_SESSION = "rockpay_preview_session";
const STORAGE_KEY_STORE = "rockpay_preview_store_v1";

interface PreviewDataStore {
  profile: {
    user_id: string;
    full_name: string;
    phone: string;
    email: string;
    billpay_id: string;
    avatar_url: string;
    account_status: string;
  };
  wallet: {
    user_id: string;
    balance: number;
  };
  profiles: Array<{
    user_id: string;
    full_name: string;
    phone: string;
    email: string;
    billpay_id: string;
    avatar_url: string;
    account_status: string;
    created_at: string;
  }>;
  wallets: Array<{
    user_id: string;
    balance: number;
  }>;
  transactions: Array<{
    id: string;
    reference: string;
    user_id?: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    provider?: string;
    provider_reference?: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  care_tickets: Array<{
    id: string;
    ticket_number: string;
    user_id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
  user_roles: Array<{
    id: string;
    user_id: string;
    role: string;
  }>;
  saved_payments: Array<{
    id: string;
    user_id: string;
    service: string;
    provider: string;
    nickname: string;
    customer_identifier: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
  }>;
}

function getInitialStore(): PreviewDataStore {
  const pabloProfile = {
    user_id: DEMO_USER_ID,
    full_name: "Pablo Emmanuel",
    phone: "0803 123 4567",
    email: "pablo@rockpay.ng",
    billpay_id: "RP-829104",
    avatar_url: "",
    account_status: "active",
    created_at: new Date(Date.now() - 3600 * 1000 * 24 * 60).toISOString(),
  };

  const extraProfiles = [
    {
      user_id: "usr-2",
      full_name: "Amina Yusuf",
      phone: "0814 892 1092",
      email: "amina.y@gmail.com",
      billpay_id: "RP-194029",
      avatar_url: "",
      account_status: "active",
      created_at: new Date(Date.now() - 3600 * 1000 * 24 * 14).toISOString(),
    },
    {
      user_id: "usr-3",
      full_name: "Chukwudi Okafor",
      phone: "0902 441 8920",
      email: "chuks.okafor@yahoo.com",
      billpay_id: "RP-449102",
      avatar_url: "",
      account_status: "active",
      created_at: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
    },
    {
      user_id: "usr-4",
      full_name: "Folashade Adeleke",
      phone: "0708 312 9044",
      email: "fola.adeleke@outlook.com",
      billpay_id: "RP-602914",
      avatar_url: "",
      account_status: "active",
      created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    },
    {
      user_id: "usr-5",
      full_name: "Ibrahim Danjuma",
      phone: "0805 210 3948",
      email: "ibro.d@rockpay.ng",
      billpay_id: "RP-774019",
      avatar_url: "",
      account_status: "active",
      created_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
    },
  ];

  return {
    profile: pabloProfile,
    profiles: [pabloProfile, ...extraProfiles],
    wallet: {
      user_id: DEMO_USER_ID,
      balance: 45500,
    },
    wallets: [
      { user_id: DEMO_USER_ID, balance: 45500 },
      { user_id: "usr-2", balance: 18200 },
      { user_id: "usr-3", balance: 64000 },
      { user_id: "usr-4", balance: 8500 },
      { user_id: "usr-5", balance: 124000 },
    ],
    user_roles: [
      { id: "ur-1", user_id: DEMO_USER_ID, role: "super_admin" },
      { id: "ur-2", user_id: "usr-5", role: "admin" },
    ],
    care_tickets: [
      {
        id: "tkt-1",
        ticket_number: "CARE-82910",
        user_id: DEMO_USER_ID,
        subject: "STS Meter Token Generation Confirmation",
        status: "resolved",
        priority: "medium",
        created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      },
      {
        id: "tkt-2",
        ticket_number: "CARE-91044",
        user_id: "usr-3",
        subject: "DStv Compact Package Reconnect Delay",
        status: "open",
        priority: "high",
        created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      },
    ],
    transactions: [
      {
        id: "tx-1",
        user_id: DEMO_USER_ID,
        reference: "RP-ELEC-849102",
        type: "bill",
        amount: 5000,
        status: "successful",
        description: "IKEDC Electricity Token",
        provider: "IKEDC",
        provider_reference: "IK-9840219",
        metadata: {
          title: "IKEDC Prepaid Token",
          service_slug: "electricity",
          service_label: "IKEDC Electricity",
          customer: "Chukwuemeka O. Adebayo",
          masked: "••••4910",
          token: "4819-2048-1920-4820-1928",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      },
      {
        id: "tx-2",
        user_id: DEMO_USER_ID,
        reference: "RP-DATA-749102",
        type: "bill",
        amount: 3000,
        status: "successful",
        description: "MTN 10GB Monthly Data",
        provider: "MTN",
        provider_reference: "MTN-449102",
        metadata: {
          title: "MTN Data",
          service_slug: "data",
          service_label: "MTN Nigeria",
          masked: "••••4567",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 26).toISOString(),
      },
      {
        id: "tx-3",
        user_id: DEMO_USER_ID,
        reference: "RP-FUND-649102",
        type: "deposit",
        amount: 50000,
        status: "successful",
        description: "Wallet Funded via Paystack",
        metadata: {
          title: "Wallet Top-up",
          channel: "paystack",
          service_slug: "wallet",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      },
      {
        id: "tx-4",
        user_id: DEMO_USER_ID,
        reference: "RP-CAB-549102",
        type: "bill",
        amount: 12000,
        status: "successful",
        description: "DStv Compact Renewal",
        provider: "DStv",
        provider_reference: "DSTV-09148",
        metadata: {
          title: "DStv Compact",
          service_slug: "cable",
          service_label: "DStv Nigeria",
          customer: "Pablo Emmanuel",
          masked: "••••8291",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
      },
      {
        id: "tx-5",
        user_id: "usr-2",
        reference: "RP-AIR-39104",
        type: "bill",
        amount: 2500,
        status: "successful",
        description: "Airtel VTU Airtime Recharge",
        provider: "Airtel",
        metadata: {
          title: "Airtel Airtime",
          service_slug: "airtime",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
      },
      {
        id: "tx-6",
        user_id: "usr-3",
        reference: "RP-ELEC-44019",
        type: "bill",
        amount: 15000,
        status: "successful",
        description: "EKEDC Electricity Token",
        provider: "EKEDC",
        metadata: {
          title: "EKEDC Prepaid Token",
          service_slug: "electricity",
          token: "8912-3019-4819-2041-9481",
        },
        created_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
      },
    ],
    saved_payments: [
      {
        id: "sp-1",
        user_id: DEMO_USER_ID,
        service: "electricity",
        provider: "IKEDC",
        nickname: "Home Meter",
        customer_identifier: "04281920491",
        created_at: new Date().toISOString(),
      },
      {
        id: "sp-2",
        user_id: DEMO_USER_ID,
        service: "data",
        provider: "MTN",
        nickname: "My MTN Line",
        customer_identifier: "08031234567",
        created_at: new Date().toISOString(),
      },
      {
        id: "sp-3",
        user_id: DEMO_USER_ID,
        service: "cable",
        provider: "DSTV",
        nickname: "Living Room TV",
        customer_identifier: "1029384756",
        created_at: new Date().toISOString(),
      },
    ],
    notifications: [
      {
        id: "notif-1",
        user_id: DEMO_USER_ID,
        title: "Electricity Token Ready",
        message: "Your ₦5,000 IKEDC token is: 4819-2048-1920-4820-1928",
        type: "success",
        read: false,
        created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      },
      {
        id: "notif-2",
        user_id: DEMO_USER_ID,
        title: "Wallet Top-up Successful",
        message: "₦50,000.00 was added to your RockPay wallet.",
        type: "success",
        read: true,
        created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
      },
    ],
  };
}

function loadStore(): PreviewDataStore {
  if (typeof window === "undefined") return getInitialStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORE);
    if (!raw) {
      const initial = getInitialStore();
      localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as PreviewDataStore;
  } catch {
    return getInitialStore();
  }
}

function saveStore(data: PreviewDataStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(data));
  } catch {
    // ignore
  }
}

let authListeners: Array<(event: string, session: Session | null) => void> = [];

export function getStoredPreviewSession(): Session | null {
  if (typeof window === "undefined") return DEMO_SESSION;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    if (raw === "none") return null;
    return DEMO_SESSION; // default to active demo session in preview mode
  } catch {
    return DEMO_SESSION;
  }
}

export function setStoredPreviewSession(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY_SESSION, "demo");
    } else {
      localStorage.setItem(STORAGE_KEY_SESSION, "none");
    }
  } catch {
    // ignore
  }
  authListeners.forEach((cb) => cb(session ? "SIGNED_IN" : "SIGNED_OUT", session));
}

// Chainable mock query builder
class MockQueryBuilder {
  private table: string;
  private filters: Array<{ field: string; value: unknown }> = [];
  private orderConfig?: { field: string; ascending: boolean };
  private limitCount?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = "*", _options?: unknown) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderConfig = { field, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private getRows(): unknown[] {
    const store = loadStore();
    let rows: unknown[] = [];
    if (this.table === "profiles") rows = [...(store.profiles || [store.profile])];
    else if (this.table === "wallets") rows = [...(store.wallets || [store.wallet])];
    else if (this.table === "wallet_transactions") rows = [...store.transactions];
    else if (this.table === "saved_payments") rows = [...store.saved_payments];
    else if (this.table === "notifications") rows = [...store.notifications];
    else if (this.table === "care_tickets") rows = [...(store.care_tickets || [])];
    else if (this.table === "user_roles") rows = [...(store.user_roles || [])];
    else rows = [];

    // Filter
    if (this.filters.length > 0) {
      rows = rows.filter((r) =>
        this.filters.every((f) => {
          const rec = r as Record<string, unknown>;
          return rec[f.field] === f.value;
        }),
      );
    }

    // Order
    if (this.orderConfig) {
      const { field, ascending } = this.orderConfig;
      rows.sort((a, b) => {
        const valA = (a as Record<string, unknown>)[field];
        const valB = (b as Record<string, unknown>)[field];
        if (typeof valA === "string" && typeof valB === "string") {
          return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }

    if (this.limitCount) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows;
  }

  async maybeSingle() {
    const rows = this.getRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.getRows();
    if (!rows[0]) return { data: null, error: new Error("Row not found") };
    return { data: rows[0], error: null };
  }

  // Thenable to allow direct `await supabase.from(...).select(...)`
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          count?: number;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const rows = this.getRows();
    const result = { data: rows, count: rows.length, error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  async insert(recordOrArray: Record<string, unknown> | Array<Record<string, unknown>>) {
    const store = loadStore();
    const records = Array.isArray(recordOrArray) ? recordOrArray : [recordOrArray];
    const newItems = records.map((r) => ({
      id: (r["id"] as string) || `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      ...r,
    }));

    if (this.table === "saved_payments") {
      store.saved_payments.unshift(...(newItems as unknown as PreviewDataStore["saved_payments"]));
    } else if (this.table === "wallet_transactions") {
      store.transactions.unshift(...(newItems as unknown as PreviewDataStore["transactions"]));
    } else if (this.table === "notifications") {
      store.notifications.unshift(...(newItems as unknown as PreviewDataStore["notifications"]));
    }

    saveStore(store);
    return { data: newItems, error: null };
  }

  async update(updates: Record<string, unknown>) {
    const store = loadStore();
    if (this.table === "profiles") {
      Object.assign(store.profile, updates);
    } else if (this.table === "wallets") {
      Object.assign(store.wallet, updates);
    } else if (this.table === "notifications") {
      store.notifications = store.notifications.map((n) => {
        const match = this.filters.every(
          (f) => (n as unknown as Record<string, unknown>)[f.field] === f.value,
        );
        return match ? { ...n, ...updates } : n;
      });
    } else if (this.table === "saved_payments") {
      store.saved_payments = store.saved_payments.map((sp) => {
        const match = this.filters.every(
          (f) => (sp as unknown as Record<string, unknown>)[f.field] === f.value,
        );
        return match ? { ...sp, ...updates } : sp;
      });
    }

    saveStore(store);
    return { data: null, error: null };
  }

  async delete() {
    const store = loadStore();
    if (this.table === "saved_payments") {
      store.saved_payments = store.saved_payments.filter(
        (sp) =>
          !this.filters.every(
            (f) => (sp as unknown as Record<string, unknown>)[f.field] === f.value,
          ),
      );
    }
    saveStore(store);
    return { data: null, error: null };
  }
}

export function createMockSupabaseClient() {
  return {
    auth: {
      async getSession() {
        const session = getStoredPreviewSession();
        return { data: { session }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        authListeners.push(callback);
        // Dispatch current state immediately
        const current = getStoredPreviewSession();
        setTimeout(() => callback(current ? "SIGNED_IN" : "SIGNED_OUT", current), 10);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners = authListeners.filter((cb) => cb !== callback);
              },
            },
          },
        };
      },
      async signInWithPassword({ email }: { email: string; password?: string }) {
        const session = {
          ...DEMO_SESSION,
          user: { ...DEMO_USER, email },
        };
        setStoredPreviewSession(session);
        return { data: { session, user: session.user }, error: null };
      },
      async signUp({
        email,
        options,
      }: {
        email: string;
        password?: string;
        options?: { data?: Record<string, unknown> };
      }) {
        const session = {
          ...DEMO_SESSION,
          user: {
            ...DEMO_USER,
            email,
            user_metadata: {
              ...DEMO_USER.user_metadata,
              ...(options?.data ?? {}),
            },
          },
        };
        setStoredPreviewSession(session);
        return { data: { session, user: session.user }, error: null };
      },
      async signOut() {
        setStoredPreviewSession(null);
        return { error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
    },

    from(table: string) {
      return new MockQueryBuilder(table);
    },

    async rpc(fn: string, args?: Record<string, unknown>) {
      const store = loadStore();

      if (fn === "is_staff") {
        return { data: true, error: null };
      }

      if (fn === "bootstrap_current_user") {
        return { data: null, error: null };
      }

      if (fn === "admin_ops_stats" || fn === "admin_dashboard_stats") {
        return {
          data: {
            total_users: 1420,
            active_users: 890,
            suspended_users: 2,
            new_users_today: 42,
            new_users_yesterday: 35,
            new_users_week: 215,
            new_users_prev_week: 190,
            wallet_balance_total: 48500000,
            wallet_count: 1420,
            funding_total: 128400000,
            funding_today: 3450000,
            funding_yesterday: 2980000,
            funding_count: 89,
            funding_avg: 38764,
            funding_max: 500000,
            debits_total: 112000000,
            refunds_total: 45000,
            tx_successful_today: 184,
            tx_failed_today: 3,
            tx_pending: 2,
            tx_successful: 12480,
            tx_failed: 88,
            tx_volume_successful: 8740000,
            bill_successful: 11950,
            bill_pending: 2,
            bill_failed: 85,
            bill_volume: 78500000,
            revenue_fees: 142000,
            generated_at: new Date().toISOString(),
          },
          error: null,
        };
      }

      if (fn === "admin_tx_volume_series") {
        const days = Number(args?.["_days"] ?? 30);
        const points = [];
        const now = Date.now();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now - i * 86400 * 1000);
          const dateStr = d.toISOString().split("T")[0];
          // realistic volume curve
          const base = 250000 + Math.sin(i / 3) * 80000 + Math.random() * 40000;
          points.push({
            day: dateStr,
            volume: Math.round(base),
            successful: Math.floor(15 + Math.random() * 20),
            pending: Math.random() > 0.7 ? 1 : 0,
            failed: Math.random() > 0.85 ? 1 : 0,
          });
        }
        return { data: points, error: null };
      }

      if (fn === "admin_service_breakdown") {
        return {
          data: [
            { service: "Electricity", count: 480, volume: 4800000 },
            { service: "Data", count: 350, volume: 1200000 },
            { service: "Airtime", count: 310, volume: 450000 },
            { service: "Cable TV", count: 180, volume: 1650000 },
            { service: "Education", count: 90, volume: 540000 },
          ],
          error: null,
        };
      }

      if (fn === "secure_bill_payment") {
        const amount = Number(args?.["_amount"] ?? 0);
        const meta = (args?.["_metadata"] ?? {}) as Record<string, unknown>;
        const ref = `RP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Deduct from wallet
        store.wallet.balance = Math.max(0, store.wallet.balance - amount);

        // Add transaction
        store.transactions.unshift({
          id: `tx-${Date.now()}`,
          reference: ref,
          type: "bill",
          amount,
          status: "successful",
          description: (args?.["_provider"] as string) || "Bill Payment",
          metadata: {
            ...meta,
            bill_reference: ref,
          },
          created_at: new Date().toISOString(),
        });

        saveStore(store);
        return { data: [{ internal_reference: ref, status: "successful" }], error: null };
      }

      if (fn === "create_care_ticket") {
        return {
          data: {
            id: `ticket-${Date.now()}`,
            ticket_number: `CARE-${Math.floor(10000 + Math.random() * 90000)}`,
          },
          error: null,
        };
      }

      return { data: null, error: null };
    },
  };
}
