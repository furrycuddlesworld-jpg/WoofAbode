import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSpreadsheet, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BillStatusPill } from "@/components/app/BillView";
import { EmptyState, Field, PageHeader, Stat } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateBill } from "@/lib/bills";
import { formatDate, formatINR, formatMonth, monthOf, todayIST } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { useBills, useDogs, useProfiles } from "@/lib/queries";
import type { Advance, Payment, StayRow } from "@/lib/types";

export const Route = createFileRoute("/_authed/admin/bills")({
  head: () => pageHead("Billing administration", "Generate monthly WoofAbode bills using dated per-dog rates."),
  component: AdminBills,
});

function AdminBills() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const { data: bills = [] } = useBills();
  const { data: profiles = [] } = useProfiles();
  const { data: dogs = [] } = useDogs();
  const name = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unknown";
  };

  const { data: extra } = useQuery({
    queryKey: ["bills", "extra"],
    queryFn: async () => {
      const [pay, adv, legacy] = await Promise.all([
        supabase.from("payments").select("*").eq("status", "to_confirm"),
        supabase.from("advances").select("*").order("received_on", { ascending: false }),
        supabase.from("stays").select("*").eq("imported", true).eq("imported_paid", false),
      ]);
      return {
        toConfirm: (pay.data ?? []) as Payment[],
        advances: (adv.data ?? []) as Advance[],
        legacy: (legacy.data ?? []) as StayRow[],
      };
    },
  });

  const monthBills = bills.filter(
    (b) => b.month === month && (status === "all" || b.status === status),
  );
  const monthTotal = bills
    .filter((b) => b.month === month)
    .reduce((s, b) => s + Number(b.total), 0);
  const monthPaid = bills.filter((b) => b.month === month).reduce((s, b) => s + Number(b.paid), 0);
  const outstanding = new Map<string, number>();
  for (const b of bills) {
    const due = Number(b.total) - Number(b.paid);
    if (due > 0) outstanding.set(b.parent_id, (outstanding.get(b.parent_id) ?? 0) + due);
  }
  const parentsWithDogs = [
    ...new Set(dogs.filter((d) => d.owner_id && d.active).map((d) => d.owner_id as string)),
  ];

  async function generateAll() {
    if (
      !window.confirm(
        `Create or refresh ${formatMonth(month)} bills for all ${parentsWithDogs.length} parents? Paid bills are not changed.`,
      )
    )
      return;
    setBusy(true);
    let made = 0;
    for (const pid of parentsWithDogs) {
      const res = await generateBill(pid, month);
      if (res.ok) made += 1;
      if (res.ok) res.warnings.forEach((w) => toast.warning(w));
      else toast.error(res.reason);
    }
    setBusy(false);
    toast.success(`${made} bill${made === 1 ? "" : "s"} with charges for ${formatMonth(month)}`);
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  }

  function exportMonth() {
    downloadCsv(
      `woofabode-bills-${month}.csv`,
      [
        ["Bill", "Parent", "Dog", "Item", "Qty", "Rate", "Amount", "Bill total", "Paid", "Status"],
      ].concat(
        bills
          .filter((b) => b.month === month)
          .flatMap((b) =>
            (b.lines.length ? b.lines : [null]).map((l) => [
              String(b.bill_number),
              name(b.parent_id),
              l?.dog_name ?? "",
              l?.description ?? "",
              l ? String(l.quantity) : "",
              l ? String(l.rate) : "",
              l ? String(l.amount) : "",
              String(b.total),
              String(b.paid),
              b.status,
            ]),
          ),
      ),
    );
  }

  return (
    <>
      <PageHeader title="Bills" subtitle="Monthly bills, payments and advances. No GST." />

      {extra?.toConfirm.length ? (
        <div className="mb-5 rounded-2xl border border-warning bg-warning/10 p-4">
          <h2 className="mb-2 font-semibold">UPI payments to confirm</h2>
          {extra.toConfirm.map((p) => {
            const b = bills.find((x) => x.id === p.bill_id);
            return (
              <Link
                key={p.id}
                to="/bills/$billId"
                params={{ billId: p.bill_id }}
                className="block rounded-xl bg-card px-3 py-2 text-sm hover:underline"
              >
                {b ? name(b.parent_id) : ""} · {formatINR(Number(p.amount))} · Txn {p.upi_txn_id} ·{" "}
                {formatDate(p.paid_on)}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Month">
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-44"
          />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partly_paid">Partly paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button onClick={generateAll} disabled={busy}>
          <Wand2 className="size-4" /> {busy ? "Working…" : "Create bills for this month"}
        </Button>
        <Button variant="outline" onClick={exportMonth}>
          <FileSpreadsheet className="size-4" /> Export to Excel
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label={`Billed in ${formatMonth(month)}`} value={formatINR(monthTotal)} />
        <Stat label="Received" value={formatINR(monthPaid)} />
        <Stat label="Still due" value={formatINR(monthTotal - monthPaid)} />
      </div>

      {monthBills.length === 0 ? (
        <EmptyState title={`No bills for ${formatMonth(month)} yet`}>
          Bills are created when you mark attendance on the last day of the month, when a
          home-boarding stay ends, or with the button above.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {monthBills.map((b) => (
            <Link
              key={b.id}
              to="/bills/$billId"
              params={{ billId: b.id }}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary"
            >
              <div className="flex-1">
                <div className="font-semibold">{name(b.parent_id)}</div>
                <div className="text-sm text-muted-foreground">
                  Bill #{b.bill_number}
                  {b.has_estimate ? " · includes estimates" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{formatINR(Number(b.total))}</div>
                <BillStatusPill status={b.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Outstanding by parent</h2>
          {outstanding.size === 0 && !extra?.legacy.length ? (
            <EmptyState title="Nothing outstanding" />
          ) : null}
          <div className="space-y-1">
            {[...outstanding.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([pid, due]) => (
                <div
                  key={pid}
                  className="flex justify-between rounded-xl border bg-card px-3 py-2 text-sm"
                >
                  <span>{name(pid)}</span>
                  <span className="font-semibold">{formatINR(due)}</span>
                </div>
              ))}
          </div>
          {extra?.legacy.length ? <LegacyPending stays={extra.legacy} dogs={dogs} /> : null}
        </div>
        <Advances
          advances={extra?.advances ?? []}
          profiles={profiles.map((p) => ({ id: p.id, name: p.full_name || p.email }))}
        />
      </section>
    </>
  );
}

function LegacyPending({
  stays,
  dogs,
}: {
  stays: StayRow[];
  dogs: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  async function markPaid(id: string) {
    const { error } = await supabase.from("stays").update({ imported_paid: true }).eq("id", id);
    if (error) return void toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["bills", "extra"] });
  }
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
        Unpaid stays from the spreadsheet
      </h3>
      {stays.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm"
        >
          <span>
            {dogs.find((d) => d.id === s.dog_id)?.name} · {formatDate(s.planned_start)} →{" "}
            {formatDate(s.planned_end)} · {formatINR(Number(s.imported_amount ?? 0))}
          </span>
          <Button size="sm" variant="outline" onClick={() => markPaid(s.id)}>
            Mark paid
          </Button>
        </div>
      ))}
    </div>
  );
}

function Advances({
  advances,
  profiles,
}: {
  advances: Advance[];
  profiles: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [parent, setParent] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!parent) return void toast.error("Choose a parent");
    const { error } = await supabase
      .from("advances")
      .insert({ parent_id: parent, amount: Number(amount), note: note || null });
    if (error) return void toast.error(error.message);
    toast.success("Advance recorded. It comes off their next bill.");
    setAmount("");
    setNote("");
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">Advances</h2>
      <form onSubmit={add} className="mb-3 space-y-3 rounded-2xl border bg-card p-3">
        <Select value={parent} onValueChange={setParent}>
          <SelectTrigger>
            <SelectValue placeholder="Parent" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            required
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit">Add</Button>
        </div>
      </form>
      <div className="space-y-1">
        {advances.slice(0, 10).map((a) => (
          <div
            key={a.id}
            className="flex justify-between rounded-xl border bg-card px-3 py-2 text-sm"
          >
            <span>
              {profiles.find((p) => p.id === a.parent_id)?.name} · {formatDate(a.received_on)}
              {a.note ? ` · ${a.note}` : ""}
            </span>
            <span className="font-semibold">{formatINR(Number(a.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
