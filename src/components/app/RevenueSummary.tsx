import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Field, Loading, Stat, Pill } from "@/components/app/Common";
import { ExpensesPanel } from "@/components/app/ExpensesPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDogs, useRates } from "@/lib/queries";
import { revenueSummary } from "@/lib/revenue";
import { financeSummary } from "@/lib/finance";
import { firstDayOfMonth, lastDayOfMonth, previousMonth, monthOf, todayIST, formatINR, formatDate, formatMonth } from "@/lib/dates";
import { useProfiles } from "@/lib/queries";
import type { DayBoarding, StayRow, Bill, Payment, Expense } from "@/lib/types";

export function RevenueSummary() {
  const today = todayIST();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(firstDayOfMonth(monthOf(today)));
  const [to, setTo] = useState(today);
  const [service, setService] = useState<"all" | "day" | "home">("all");
  const { data: dogs = [] } = useDogs();
  const { data: profiles = [] } = useProfiles();
  const [paymentStatus, setPaymentStatus] = useState("all");
  const { data: rates = [], isLoading: ratesLoading } = useRates(dogs.map(d => d.id));
  const { data, isLoading, error } = useQuery({ queryKey: ["revenue"], queryFn: async () => {
    const [days, stays, bills, payments, expenses] = await Promise.all([
      supabase.from("day_boarding").select("*").eq("imported", false).eq("status", "present"),
      supabase.from("stays").select("*").eq("imported", false).neq("status", "cancelled"),
      supabase.from("bills").select("*"), supabase.from("payments").select("*").eq("status", "confirmed"),
      supabase.from("expenses").select("*").order("incurred_on", { ascending: false }),
    ]);
    const error = days.error ?? stays.error ?? bills.error ?? payments.error ?? expenses.error;
    if (error) throw new Error(error.message);
    return { days: (days.data ?? []) as DayBoarding[], stays: (stays.data ?? []) as StayRow[], bills: (bills.data ?? []) as Bill[], payments: (payments.data ?? []) as Payment[], expenses: (expenses.data ?? []) as Expense[] };
  } });
  function choose(value: string) {
    setPreset(value);
    if (value === "month") { setFrom(firstDayOfMonth(monthOf(today))); setTo(today); }
    if (value === "last") { const month = previousMonth(monthOf(today)); setFrom(firstDayOfMonth(month)); setTo(lastDayOfMonth(month)); }
    if (value === "year") { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); }
    if (value === "all") {
      const dates = [...(data?.days.map(d => d.date) ?? []), ...(data?.stays.map(s => s.planned_start) ?? []), ...(data?.payments.map(p => p.paid_on) ?? []), ...(data?.expenses.map(e => e.incurred_on) ?? []), ...(data?.bills.map(b => firstDayOfMonth(b.month)) ?? []), today].sort();
      setFrom(dates[0] ?? today); setTo(today);
    }
  }
  const result = revenueSummary({ from, to, today, service, dogs, rates, days: data?.days ?? [], stays: data?.stays ?? [], bills: data?.bills ?? [], payments: data?.payments ?? [] });
  const invalid = from > to;
  const through = to < today ? to : today;
  const finance = financeSummary({ from, to, today, service, bills: data?.bills ?? [], payments: data?.payments ?? [], expenses: data?.expenses ?? [] });
  const shownBills = finance.bills.filter(b => paymentStatus === "all" || b.status === paymentStatus);
  const shownExpenses = finance.expenses.filter(e => paymentStatus === "all" || (paymentStatus === "paid" ? Boolean(e.paid_on && e.paid_on <= through) : paymentStatus === "pending" ? !e.paid_on || e.paid_on > through : false));
  return <section className="my-8 space-y-4 border-t pt-6">
    <h2 className="text-lg font-semibold">Revenue & spends</h2>
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Period"><Select value={preset} onValueChange={choose}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">This month</SelectItem><SelectItem value="last">Last month</SelectItem><SelectItem value="year">This year</SelectItem><SelectItem value="all">All time</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></Field>
      <Field label="From"><Input aria-label="Revenue from" type="date" className="w-auto" value={from} onChange={e => { if (e.target.value) { setFrom(e.target.value); setPreset("custom"); } }} /></Field>
      <Field label="To"><Input aria-label="Revenue to" type="date" className="w-auto" value={to} onChange={e => { if (e.target.value) { setTo(e.target.value); setPreset("custom"); } }} /></Field>
      <Field label="Service"><Select value={service} onValueChange={v => setService(v as typeof service)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="day">Day boarding</SelectItem><SelectItem value="home">Home boarding</SelectItem></SelectContent></Select></Field>
      <Field label="Payment status"><Select value={paymentStatus} onValueChange={setPaymentStatus}><SelectTrigger className="w-40" aria-label="Dashboard payment status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Unpaid</SelectItem><SelectItem value="partly_paid">Partly paid</SelectItem></SelectContent></Select></Field>
    </div>
    {invalid ? <p className="text-destructive">End date must be after start date.</p> : null}
    {error ? <p className="text-destructive">{error.message}</p> : null}
    {isLoading || ratesLoading ? <Loading /> : !error && !invalid ? <>
      {result.missing.length ? <div className="rounded-md bg-warning/25 p-3 text-sm text-warning-foreground">{result.missing.map(name => <p key={name}>Set rate for {name} first</p>)}</div> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Generated" value={result.missing.length ? "—" : formatINR(result.generated)} />
        <Stat label="Total Bill" value={formatINR(finance.billed)} />
        <Stat label="Received" value={formatINR(result.paid)} />
        <Stat label="To Be Paid" value={result.missing.length ? "—" : formatINR(result.due)} />
        <Stat label="Total Spends" value={formatINR(finance.expenseTotal)} />
        <Stat label="Spends Paid" value={formatINR(finance.expensePaid)} />
        <Stat label="Spends Unpaid" value={formatINR(finance.expenseUnpaid)} />
        <Stat label="Revenue − Spends" value={result.missing.length ? "—" : formatINR(result.generated - finance.expenseTotal)} />
      </div>
      <Tabs defaultValue="bills" className="space-y-4">
        <TabsList><TabsTrigger value="bills">Bills</TabsTrigger><TabsTrigger value="spends">Spends</TabsTrigger><TabsTrigger value="dogs">By dog</TabsTrigger></TabsList>
        <TabsContent value="bills" className="space-y-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Bills paid: <b>{formatINR(finance.billPaid)}</b> · Bills unpaid: <b>{formatINR(finance.billDue)}</b></span><Button asChild variant="outline" size="sm"><Link to="/admin/bills">View all bills</Link></Button></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Bill / Parent</th><th className="p-2 text-right">Total bill</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Unpaid</th><th className="p-2">Status</th><th className="p-2">Payment dates</th></tr></thead><tbody>
            {shownBills.map(b => { const parent = profiles.find(p => p.id === b.bill.parent_id); return <tr key={b.bill.id} className="border-b align-top"><td className="p-2"><Link className="font-semibold text-primary" to="/bills/$billId" params={{ billId: b.bill.id }}>Bill #{b.bill.bill_number}</Link><div>{parent?.full_name || parent?.email || "Pet parent"}</div><div className="text-xs text-muted-foreground">{formatMonth(b.bill.month)}{b.bill.has_estimate ? " · estimate" : ""}</div></td><td className="p-2 text-right tabular-nums">{formatINR(b.total)}</td><td className="p-2 text-right tabular-nums">{formatINR(b.paid)}</td><td className="p-2 text-right tabular-nums">{formatINR(b.due)}</td><td className="p-2"><Pill tone={b.status === "paid" ? "green" : "amber"}>{b.status === "paid" ? "Paid" : b.status === "partly_paid" ? "Partly paid" : "Unpaid"}</Pill></td><td className="min-w-44 p-2">{b.settledOn ? <div className="font-medium text-success">Paid on {formatDate(b.settledOn)}</div> : null}{b.payments.map(p => <div key={p.id} className="text-xs text-muted-foreground">{formatDate(p.paid_on)} · {formatINR(p.amount)} · {p.method.toUpperCase()}</div>)}{!b.payments.length ? "—" : null}</td></tr>; })}
            {!shownBills.length ? <tr><td colSpan={6} className="py-6 text-muted-foreground">No bills match this period and status.</td></tr> : null}
          </tbody></table></div>
        </TabsContent>
        <TabsContent value="spends"><ExpensesPanel expenses={shownExpenses} through={through} /></TabsContent>
        <TabsContent value="dogs">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Dog</th><th className="px-3 py-2 text-right">Generated</th><th className="px-3 py-2 text-right">Paid</th><th className="py-2 text-right">Due</th></tr></thead><tbody>
        {result.rows.map(r => <tr key={r.id} className="border-b"><td className="py-3"><Link to="/dogs/$dogId" params={{ dogId: r.id }} className="font-semibold text-primary">{r.name}</Link>{r.missing ? <span className="ml-2 text-warning-foreground">Rate missing</span> : null}</td><td className="px-3 py-3 text-right tabular-nums">{r.missing ? "—" : formatINR(r.generated)}</td><td className="px-3 py-3 text-right tabular-nums">{formatINR(r.paid)}</td><td className="py-3 text-right font-semibold tabular-nums">{r.missing ? "—" : formatINR(r.due)}</td></tr>)}
        {!result.rows.length ? <tr><td colSpan={4} className="py-6 text-muted-foreground">No charges in this period.</td></tr> : null}
      </tbody></table></div>
        </TabsContent>
      </Tabs>
    </> : null}
  </section>;
}