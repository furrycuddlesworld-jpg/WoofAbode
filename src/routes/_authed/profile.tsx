import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field, Loading, PageHeader } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export const Route = createFileRoute("/_authed/profile")({
  component: ProfilePage,
});

const FIELDS = [
  "full_name",
  "phone",
  "whatsapp",
  "address",
  "emergency1_name",
  "emergency1_relation",
  "emergency1_phone",
  "emergency2_name",
  "emergency2_relation",
  "emergency2_phone",
] as const;

function ProfilePage() {
  const { profile, refresh } = useAuth();
  if (!profile) return <Loading />;
  return <ProfileForm profile={profile} onSaved={refresh} />;
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((k) => [k, (profile[k] as string | null) ?? ""])),
  );
  const [optIn, setOptIn] = useState(profile.whatsapp_opt_in);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const get = (k: string) => form[k] ?? "";

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const row: TablesUpdate<"profiles"> = { whatsapp_opt_in: optIn };
    for (const k of FIELDS) row[k] = get(k).trim() || null;
    row["full_name"] = get("full_name").trim();
    const { error } = await supabase.from("profiles").update(row).eq("id", profile.id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("Profile saved");
    await onSaved();
  }

  return (
    <>
      <PageHeader title="My profile" subtitle={profile.email} />
      <form onSubmit={save} className="space-y-6">
        <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Your details</h2>
          <Field label="Full name">
            <Input required value={get("full_name")} onChange={set("full_name")} />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={get("phone")} onChange={set("phone")} placeholder="+91" />
          </Field>
          <Field label="Address / area" className="sm:col-span-2">
            <Input value={get("address")} onChange={set("address")} />
          </Field>
          <Field label="WhatsApp number" hint="With +91">
            <Input
              type="tel"
              value={get("whatsapp")}
              onChange={set("whatsapp")}
              placeholder="+91"
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox checked={optIn} onCheckedChange={(v) => setOptIn(v === true)} />
            Send me reminders and bills on WhatsApp
          </label>
        </section>

        {[1, 2].map((n) => (
          <section key={n} className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3">
            <h2 className="font-semibold sm:col-span-3">Emergency contact {n}</h2>
            <Field label="Name">
              <Input
                required={n === 1}
                value={get(`emergency${n}_name`)}
                onChange={set(`emergency${n}_name`)}
              />
            </Field>
            <Field label="Relation">
              <Input
                value={get(`emergency${n}_relation`)}
                onChange={set(`emergency${n}_relation`)}
                placeholder="e.g. Spouse, friend"
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                required={n === 1}
                value={get(`emergency${n}_phone`)}
                onChange={set(`emergency${n}_phone`)}
              />
            </Field>
          </section>
        ))}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </form>
    </>
  );
}
