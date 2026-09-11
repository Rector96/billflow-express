import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  ChevronRight,
  KeyRound,
  FileText,
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

  const items: Item[] = [
    { label: "Personal Information", icon: User, to: "/profile/personal" },
    { label: "Change PIN", icon: KeyRound, to: "/security" },
    { label: "Security", icon: ShieldCheck, to: "/security" },
    { label: "Saved Payments", icon: Bookmark, to: "/saved-payments" },
    { label: "Notifications", icon: Bell, to: "/notifications" },
    { label: "Support", icon: LifeBuoy, to: "/support" },
    { label: "Privacy Policy", icon: FileText, to: "/profile/privacy" },
    { label: "Terms of Service", icon: FileText, to: "/terms" },
  ];

  return (
    <AppShell>
      {/* Gradient hero header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600" />
        <div className="absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -left-8 size-56 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <div className="absolute top-6 left-10 size-20 rounded-full bg-violet-300/20 blur-xl" />

        <div className="relative flex flex-col items-center px-4 pt-8 pb-14 text-center">
          <div className="relative">
            <div className="grid size-20 place-items-center overflow-hidden rounded-full bg-white/25 p-1 shadow-lg ring-2 ring-white/50 backdrop-blur">
              <img
                src="/brand/default-avatar.png"
                alt={`${profile.name || "Your"} avatar`}
                width={512}
                height={512}
                className="size-full rounded-full object-cover"
              />
            </div>
            <span className="absolute right-1 bottom-1 size-4 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          <p className="mt-3 text-lg font-bold tracking-tight text-white">
            {profile.name || "Your account"}
          </p>
          {profile.email ? (
            <p className="text-xs text-white/75">{profile.email}</p>
          ) : null}
        </div>
      </header>

      {/* Menu card overlapping the gradient */}
      <div className="relative -mt-8 space-y-2 rounded-t-3xl bg-gradient-to-b from-violet-50 via-background to-background px-4 pt-6 pb-6">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-soft transition-colors hover:border-primary/30 hover:bg-primary-soft/40"
          >
            <span className="grid size-8.5 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-fuchsia-500/15 text-primary">
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
