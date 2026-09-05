import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  ChevronRight,
  KeyRound,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
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
import { initialsOf } from "@/lib/mock-data";

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

type Item = { label: string; icon: LucideIcon; to: string };

function ProfilePage() {
  const { profile, logout } = useApp();
  const navigate = useNavigate();

  // Order matches reference mock: info → PIN → security → saved → support
  const items: Item[] = [
    { label: "Personal Information", icon: User, to: "/profile/personal" },
    { label: "Change PIN", icon: KeyRound, to: "/security" },
    { label: "Security", icon: ShieldCheck, to: "/security" },
    { label: "Saved Payments", icon: Bookmark, to: "/saved-payments" },
    { label: "Notifications", icon: Bell, to: "/notifications" },
    { label: "Support", icon: LifeBuoy, to: "/support" },
  ];

  return (
    <AppShell>
      <header className="px-4 pt-5 pb-3">
        <div className="flex flex-col items-center rounded-2xl border border-border/80 bg-card p-5 text-center shadow-card">
          <div className="relative">
            <div className="grid size-16 place-items-center rounded-full border-2 border-primary/20 bg-primary-soft text-xl font-bold text-primary shadow-sm">
              {initialsOf(profile.name || "U")}
            </div>
            <span className="absolute right-0 bottom-0 size-4 rounded-full border-2 border-card bg-emerald-500" />
          </div>
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            {profile.name || "RockPay User"}
          </h1>
          {profile.phone ? (
            <p className="text-xs text-muted-foreground">{profile.phone}</p>
          ) : profile.email ? (
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          ) : null}
        </div>
      </header>

      <div className="space-y-2 px-4 pt-1 pb-6">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-soft transition-colors hover:border-border"
          >
            <span className="grid size-8.5 shrink-0 place-items-center rounded-lg bg-secondary text-foreground">
              <item.icon className="size-4 stroke-[2]" />
            </span>
            <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}

        <AlertDialog>
          <AlertDialogTrigger className="press mt-2 flex w-full items-center gap-3 rounded-xl border border-destructive/20 bg-destructive-soft/50 px-3.5 py-3 text-left shadow-soft hover:bg-destructive-soft transition-colors">
            <span className="grid size-8.5 place-items-center rounded-lg bg-destructive text-destructive-foreground">
              <LogOut className="size-4" />
            </span>
            <span className="flex-1 text-sm font-medium text-destructive">Logout</span>
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
                  void logout().then(() => navigate({ to: "/login" }));
                }}
              >
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Link
          to="/admin"
          className="press mt-3 block rounded-xl border border-dashed border-border/80 p-2.5 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Admin Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
