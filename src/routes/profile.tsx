import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  ChevronRight,
  FileText,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { BillPayIdCard } from "@/components/app/billpay-id-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";
import { DEMO_USER } from "@/lib/mock-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: `Profile — ${BRAND.name}` },
      { name: "description", content: "Manage your details, security settings and support." },
      { property: "og:title", content: `Profile — ${BRAND.name}` },
      { property: "og:description", content: "Your account, your controls." },
    ],
  }),
  component: ProfileLayout,
});

function ProfileLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/profile") return <Outlet />;
  return <ProfilePage />;
}

type Item = { label: string; icon: LucideIcon; to?: string; onClick?: () => void };

function ProfilePage() {
  const { profile, logout } = useApp();
  const navigate = useNavigate();

  const items: Item[] = [
    { label: "Personal Information", icon: User, to: "/profile/personal" },
    { label: "Change Password", icon: LockKeyhole, to: "/security" },
    { label: "Transaction PIN", icon: KeyRound, to: "/security" },
    { label: "Security", icon: ShieldCheck, to: "/security" },
    { label: "Saved Payments", icon: Bookmark, to: "/saved-payments" },
    { label: "Notifications", icon: Bell, to: "/notifications" },
    { label: "Support", icon: LifeBuoy, to: "/support" },
    {
      label: "Terms & Conditions",
      icon: FileText,
      onClick: () => toast.info("Terms & Conditions coming soon"),
    },
    {
      label: "Privacy Policy",
      icon: FileText,
      onClick: () => toast.info("Privacy Policy coming soon"),
    },
  ];

  return (
    <AppShell>
      <header className="brand-gradient rounded-b-[2rem] px-4 pt-8 pb-10 text-center text-primary-foreground">
        <div className="mx-auto grid size-20 place-items-center rounded-full border-2 border-white/30 bg-white/15 text-2xl font-extrabold">
          {DEMO_USER.initials}
        </div>
        <h1 className="mt-3 text-xl font-extrabold">{profile.name}</h1>
        <p className="text-sm opacity-85">{profile.phone}</p>
      </header>

      <div className="space-y-2 px-4 py-5">
        <div className="pb-2">
          <BillPayIdCard />
        </div>
        {items.map((item) =>
          item.to ? (
            <Link
              key={item.label}
              to={item.to}
              className="press flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card"
            >
              <ItemInner item={item} />
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-card"
            >
              <ItemInner item={item} />
            </button>
          ),
        )}

        <AlertDialog>
          <AlertDialogTrigger className="press mt-2 flex w-full items-center gap-3 rounded-2xl border border-destructive/30 bg-card p-3.5 text-left font-bold text-destructive shadow-card">
            <span className="grid size-9 place-items-center rounded-xl bg-destructive-soft">
              <LogOut className="size-4" />
            </span>
            <span className="flex-1 text-sm">Logout</span>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Log out of {BRAND.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll need to log in again to access your wallet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl"
                onClick={() => {
                  logout();
                  navigate({ to: "/login" });
                }}
              >
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link
          to="/admin"
          className="press mt-4 block rounded-2xl border border-dashed p-3 text-center text-xs font-semibold text-muted-foreground"
        >
          Preview the desktop admin dashboard (demo)
        </Link>
      </div>
    </AppShell>
  );
}

function ItemInner({ item }: { item: Item }) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <item.icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-semibold">{item.label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </>
  );
}
