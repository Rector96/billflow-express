import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  ChevronRight,
  KeyRound,
  LifeBuoy,
  LogOut,
  ShieldAlert,
  FileText,
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
    { label: "Privacy Policy", icon: FileText, to: "/profile/privacy" },
    { label: "Support", icon: LifeBuoy, to: "/support" },
  ];

  return (
    <AppShell>
      <header className="brand-gradient rounded-b-[1.75rem] px-4 pt-7 pb-9 text-center text-primary-foreground">
        <div className="mx-auto grid size-[4.5rem] place-items-center rounded-full border-[3px] border-white/35 bg-white/20 text-xl font-extrabold shadow-soft">
          {initialsOf(profile.name || "U")}
        </div>
        <h1 className="mt-3 text-lg font-extrabold tracking-tight">
          {profile.name || "Your profile"}
        </h1>
        {profile.phone ? (
          <p className="mt-0.5 text-sm opacity-90">{profile.phone}</p>
        ) : profile.email ? (
          <p className="mt-0.5 text-sm opacity-90">{profile.email}</p>
        ) : null}
      </header>

      <div className="space-y-2 px-4 py-4">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="press flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-soft"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <item.icon className="size-4" />
            </span>
            <span className="flex-1 text-sm font-semibold">{item.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}

        <AlertDialog>
          <AlertDialogTrigger className="press mt-1 flex w-full items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-left shadow-soft">
            <span className="grid size-9 place-items-center rounded-full bg-destructive-soft text-destructive">
              <LogOut className="size-4" />
            </span>
            <span className="flex-1 text-sm font-semibold text-destructive">Logout</span>
          </AlertDialogTrigger>
          <AlertDialogContent className="gap-6 rounded-[1.5rem] p-5 sm:max-w-sm sm:p-6">
            <AlertDialogHeader className="items-center text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-destructive-soft text-destructive">
                <ShieldAlert className="size-6" />
              </span>
              <AlertDialogTitle className="pt-1 text-xl font-extrabold">Log out of {BRAND.name}?</AlertDialogTitle>
              <AlertDialogDescription className="max-w-xs leading-6">
                You&apos;ll need to log in again to access your wallet and payment history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:grid sm:grid-cols-2 sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-11 rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
          className="press mt-3 block rounded-2xl border border-dashed border-border/70 p-2.5 text-center text-[11px] font-semibold text-muted-foreground"
        >
          Admin dashboard
        </Link>
      </div>
    </AppShell>
  );
}
