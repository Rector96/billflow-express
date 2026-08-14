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
    const session = sessionData.session;
    if (!session?.user) {
      throw redirect({ to: "/login" });
    }
    const { data: isStaff, error } = await supabase.rpc("is_staff", {
      _user_id: session.user.id,
    });
    if (error || !isStaff) {
      throw redirect({ to: "/home" });
    }
  },
  component: () => <Outlet />,
});
