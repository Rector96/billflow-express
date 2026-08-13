import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError, useApp } from "@/lib/app-store";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/profile/personal")({
  head: () => ({
    meta: [
      { title: `Personal information — ${BRAND.name}` },
      { name: "description", content: "Update your name, phone number and email address." },
      { property: "og:title", content: `Personal information — ${BRAND.name}` },
      { property: "og:description", content: "Keep your account details up to date." },
    ],
  }),
  component: PersonalInfo,
});

function PersonalInfo() {
  const { profile, updateProfile } = useApp();
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);

  return (
    <AppShell>
      <PageHeader title="Personal Information" backTo="/profile" />
      <form
        className="space-y-5 px-4 pt-2 pb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          void updateProfile({ name: form.name, phone: form.phone, email: form.email })
            .then(() => toast.success("Changes saved"))
            .catch((err) => toast.error(friendlyError(err, "Couldn't save your changes.")))
            .finally(() => setSaving(false));
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-13 rounded-xl bg-card" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-13 rounded-xl bg-card" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-13 rounded-xl bg-card" />
        </div>
        <Button type="submit" disabled={saving} className="h-13 w-full rounded-2xl text-base font-bold">
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </AppShell>
  );
}
