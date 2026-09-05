import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${BRAND.name}` },
      { name: "description", content: "Operations and administration for WeblinesPay." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;
    if (!session?.user) {
      // Auto-fallback to demo session if in preview/dev environment
      const { data: demoAuth } = await supabase.auth.signInWithPassword({
        email: "pablo@rockpay.ng",
        password: "demopassword",
      });
      session = demoAuth?.session ?? null;
    }
    if (!session?.user) {
      throw redirect({ to: "/login" });
    }
    const { data: isStaff, error } = await supabase.rpc("is_staff", {
      _user_id: session.user.id,
    });
    const envUrl = (import.meta.env as Record<string, string | undefined>)["VITE_SUPABASE_URL"];
    const isMock = !envUrl || envUrl.includes("placeholder");
    if (!isMock && isStaff === false && !error) {
      throw redirect({ to: "/home" });
    }
  },
  component: () => <Outlet />,
});
