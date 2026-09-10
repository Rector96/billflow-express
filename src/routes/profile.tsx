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
import { UserAvatar } from "@/components/app/user-avatar";
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
      <header className="px-4 pt-5 pb-4">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card">
          <div className="h-20 bg-gradient-to-br from-primary-soft via-card to-secondary" />
          <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
            <div className="rounded-full bg-card p-1.5 shadow-lg">
              <UserAvatar name={profile.name} src={(profile as { avatar_url?: string | null }).avatar_url ?? null} size="lg" />
            </div>
            <p className="mt-3 text-lg font-extrabold tracking-tight text-foreground">
              {profile.name || "Your account"}
            </p>
            {profile.email ? <p className="mt-0.5 text-xs text-muted-foreground">{profile.email}</p> : null}
            <p className="mt-3 rounded-full bg-success-soft px-3 py-1 text-[11px] font-bold text-success">
              Account active
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-2 px-4 pt-1 pb-6">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="press flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3.5 shadow-soft transition-colors hover:border-border hover:bg-muted/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
              <item.icon className="size-4 stroke-[2]" />
            </span>
            <span className="flex-1 text-sm font-semibold text-foreground">{item.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}

        <AlertDialog>
          <AlertDialogTrigger className="press mt-2 flex w-full items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive-soft/50 px-3.5 py-3.5 text-left shadow-soft hover:bg-destructive-soft transition-colors">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground">
              <LogOut className="size-4" />
            </span>
            <span className="flex-1 text-sm font-semibold text-destructive">Logout</span>
            <ChevronRight className="size-4 text-destructive/60" />
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
          className="press mt-3 block rounded-2xl border border-dashed border-border/80 p-3 text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          Admin Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
