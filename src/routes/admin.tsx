import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Admin — ${BRAND.name}` },
      { name: "description", content: `Operations and administration for ${BRAND.name}.` },
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
    // Fail closed: a failed role lookup must never grant access to the admin workspace.
    if (error || isStaff !== true) {
      throw redirect({ to: "/home" });
    }
  },
  component: () => <Outlet />,
});
