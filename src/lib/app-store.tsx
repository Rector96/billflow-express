import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEMO_USER,
  INITIAL_BALANCE,
  INITIAL_NOTIFICATIONS,
  INITIAL_SAVED,
  INITIAL_TRANSACTIONS,
  type AppNotification,
  type SavedPayment,
  type Transaction,
} from "./mock-data";

type Profile = { name: string; phone: string; email: string };

type AppState = {
  authed: boolean;
  hydrated: boolean;
  login: () => void;
  logout: () => void;
  seenOnboarding: boolean;
  completeOnboarding: () => void;
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => void;
  balance: number;
  hideBalance: boolean;
  toggleBalance: () => void;
  fundWallet: (amount: number) => void;
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  saved: SavedPayment[];
  addSaved: (s: SavedPayment) => void;
  removeSaved: (id: string) => void;
  notifications: AppNotification[];
  pushNotification: (n: AppNotification) => void;
};

const Ctx = createContext<AppState | null>(null);

const KEY = "billpay-demo-state-v1";

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    name: DEMO_USER.name,
    phone: DEMO_USER.phone,
    email: DEMO_USER.email,
  });
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [hideBalance, setHideBalance] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [saved, setSaved] = useState<SavedPayment[]>(INITIAL_SAVED);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { authed?: boolean; seenOnboarding?: boolean };
        setAuthed(Boolean(parsed.authed));
        setSeenOnboarding(Boolean(parsed.seenOnboarding));
      }
    } catch {
      /* demo only */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ authed, seenOnboarding }));
    } catch {
      /* demo only */
    }
  }, [authed, seenOnboarding, hydrated]);

  const value = useMemo<AppState>(
    () => ({
      authed,
      hydrated,
      login: () => setAuthed(true),
      logout: () => setAuthed(false),
      seenOnboarding,
      completeOnboarding: () => setSeenOnboarding(true),
      profile,
      updateProfile: (p) => setProfile((prev) => ({ ...prev, ...p })),
      balance,
      hideBalance,
      toggleBalance: () => setHideBalance((v) => !v),
      fundWallet: (amount) => setBalance((b) => b + amount),
      transactions,
      addTransaction: (tx) => {
        setTransactions((list) => [tx, ...list]);
        if (tx.status !== "failed") {
          setBalance((b) => (tx.direction === "in" ? b + tx.amount : b - tx.amount));
        }
      },
      saved,
      addSaved: (s) => setSaved((list) => [...list, s]),
      removeSaved: (id) => setSaved((list) => list.filter((s) => s.id !== id)),
      notifications,
      pushNotification: (n) => setNotifications((list) => [n, ...list]),
    }),
    [authed, hydrated, seenOnboarding, profile, balance, hideBalance, transactions, saved, notifications],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useRequireAuth() {
  const { authed, hydrated } = useApp();
  return { ready: hydrated, authed };
}

export function useNewTxId() {
  return useCallback(() => `TXN-${Math.floor(100000 + Math.random() * 899999)}`, []);
}
