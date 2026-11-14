import { pageHead } from "@/lib/page-head";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field, Loading, PageHeader } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatMonth } from "@/lib/dates";
import { useBills, useSettings } from "@/lib/queries";

export const Route = createFileRoute("/_authed/admin/settings")({
  head: () => pageHead("Business settings", "Manage WoofAbode business details and payment settings."),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: bills = [] } = useBills();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name,
        business_address: settings.business_address ?? "",
        business_phone: settings.business_phone ?? "",
        upi_id: settings.upi_id ?? "",
        upi_payee_name: settings.upi_payee_name ?? "",
        capacity_limit: String(settings.capacity_limit),
      });
    }
  }, [settings]);

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const get = (k: string) => form[k] ?? "";

  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("settings")
      .update({
        business_name: get("business_name") || "WoofAbode",
        business_address: get("business_address") || null,
        business_phone: get("business_phone") || null,
        upi_id: get("upi_id").trim() || null,
        upi_payee_name: get("upi_payee_name") || null,
        capacity_limit: Number(get("capacity_limit")) || 0,
      })
      .eq("id", 1);
    if (error) return void toast.error(error.message);
    toast.success("Settings saved");
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  // Income by month, from the bills.
  const byMonth = new Map<string, { day: number; home: number; paid: number }>();
  for (const b of bills) {
    const m = byMonth.get(b.month) ?? { day: 0, home: 0, paid: 0 };
    for (const l of b.lines) {
      if (l.kind === "day") m.day += l.amount;
      else m.home += l.amount;
    }
    m.paid += Number(b.paid);
    byMonth.set(b.month, m);
  }

  if (isLoading) return <Loading />;
  return (
    <>
      <PageHeader title="Settings" />
      <form onSubmit={save} className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Business details (shown on bills)</h2>
        <Field label="Business name">
          <Input value={get("business_name")} onChange={set("business_name")} />
        </Field>
        <Field label="Phone">
          <Input value={get("business_phone")} onChange={set("business_phone")} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input value={get("business_address")} onChange={set("business_address")} />
        </Field>
        <h2 className="pt-2 font-semibold sm:col-span-2">UPI payments</h2>
        <Field label="UPI ID" hint="e.g. woofabode@okicici. Parents pay to this.">
          <Input value={get("upi_id")} onChange={set("upi_id")} />
        </Field>
        <Field label="Name shown in the UPI app">
          <Input value={get("upi_payee_name")} onChange={set("upi_payee_name")} />
        </Field>
        <h2 className="pt-2 font-semibold sm:col-span-2">Capacity</h2>
        <Field
          label="Most dogs you can take on one day"
          hint="You'll see a warning when a booking goes over this"
        >
          <Input
            type="number"
            min="0"
            value={get("capacity_limit")}
            onChange={set("capacity_limit")}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit">Save settings</Button>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Income by month</h2>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Month</th>
                <th className="p-3 text-right">Day boarding</th>
                <th className="p-3 text-right">Home boarding</th>
                <th className="p-3 text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {[...byMonth.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([m, v]) => (
                  <tr key={m} className="border-b last:border-0">
                    <td className="p-3">{formatMonth(m)}</td>
                    <td className="p-3 text-right tabular-nums">{formatINR(v.day)}</td>
                    <td className="p-3 text-right tabular-nums">{formatINR(v.home)}</td>
                    <td className="p-3 text-right tabular-nums">{formatINR(v.paid)}</td>
                  </tr>
                ))}
              {byMonth.size === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-muted-foreground">
                    No bills yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
