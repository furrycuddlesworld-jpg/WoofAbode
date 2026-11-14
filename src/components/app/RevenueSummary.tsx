import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Field, Loading, Stat } from "@/components/app/Common";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDogs, useRates } from "@/lib/queries";
import { revenueSummary } from "@/lib/revenue";
import { firstDayOfMonth, lastDayOfMonth, previousMonth, monthOf, todayIST, formatINR } from "@/lib/dates";
import type { DayBoarding, StayRow, Bill, Payment } from "@/lib/types";

export function RevenueSummary() {
  const today = todayIST();
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(firstDayOfMonth(monthOf(today)));
  const [to, setTo] = useState(today);
  const [service, setService] = useState<"all" | "day" | "home">("all");
  const { data: dogs = [] } = useDogs();
  const { data: rates = [], isLoading: ratesLoading } = useRates(dogs.map(d => d.id));
  const { data, isLoading, error } = useQuery({ queryKey: ["revenue"], queryFn: async () => {
    const [days, stays, bills, payments] = await Promise.all([
      supabase.from("day_boarding").select("*").eq("imported", false).eq("status", "present"),
      supabase.from("stays").select("*").eq("imported", false).neq("status", "cancelled"),
      supabase.from("bills").select("*"), supabase.from("payments").select("*").eq("status", "confirmed"),
    ]);
    const error = days.error ?? stays.error ?? bills.error ?? payments.error;
    if (error) throw new Error(error.message);
    return { days: (days.data ?? []) as DayBoarding[], stays: (stays.data ?? []) as StayRow[], bills: (bills.data ?? []) as Bill[], payments: (payments.data ?? []) as Payment[] };
  } });
  function choose(value: string) {
    setPreset(value);
    if (value === "month") { setFrom(firstDayOfMonth(monthOf(today))); setTo(today); }
    if (value === "last") { const month = previousMonth(monthOf(today)); setFrom(firstDayOfMonth(month)); setTo(lastDayOfMonth(month)); }
    if (value === "year") { setFrom(`${today.slice(0, 4)}-01-01`); setTo(today); }
    if (value === "all") {
      const dates = [...(data?.days.map(d => d.date) ?? []), ...(data?.stays.map(s => s.planned_start) ?? []), ...(data?.payments.map(p => p.paid_on) ?? []), today].sort();
      setFrom(dates[0] ?? today); setTo(today);
    }
  }
  const result = revenueSummary({ from, to, today, service, dogs, rates, days: data?.days ?? [], stays: data?.stays ?? [], bills: data?.bills ?? [], payments: data?.payments ?? [] });
  const invalid = from > to;
  return <section className="my-8 space-y-4 border-t pt-6">
    <h2 className="text-lg font-semibold">Revenue</h2>
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Period"><Select value={preset} onValueChange={choose}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month">This month</SelectItem><SelectItem value="last">Last month</SelectItem><SelectItem value="year">This year</SelectItem><SelectItem value="all">All time</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></Field>
      <Field label="From"><Input aria-label="Revenue from" type="date" className="w-auto" value={from} onChange={e => { if (e.target.value) { setFrom(e.target.value); setPreset("custom"); } }} /></Field>
      <Field label="To"><Input aria-label="Revenue to" type="date" className="w-auto" value={to} onChange={e => { if (e.target.value) { setTo(e.target.value); setPreset("custom"); } }} /></Field>
      <Field label="Service"><Select value={service} onValueChange={v => setService(v as typeof service)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="day">Day boarding</SelectItem><SelectItem value="home">Home boarding</SelectItem></SelectContent></Select></Field>
    </div>
    {invalid ? <p className="text-destructive">End date must be after start date.</p> : null}
    {error ? <p className="text-destructive">{error.message}</p> : null}
    {isLoading || ratesLoading ? <Loading /> : !error && !invalid ? <>
      {result.missing.length ? <div className="rounded-md bg-warning/25 p-3 text-sm text-warning-foreground">{result.missing.map(name => <p key={name}>Set rate for {name} first</p>)}</div> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Generated" value={result.missing.length ? "—" : formatINR(result.generated)} />
        <Stat label="Paid" value={formatINR(result.paid)} />
        <Stat label="To Be Paid" value={result.missing.length ? "—" : formatINR(result.due)} />
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Dog</th><th className="px-3 py-2 text-right">Generated</th><th className="px-3 py-2 text-right">Paid</th><th className="py-2 text-right">Due</th></tr></thead><tbody>
        {result.rows.map(r => <tr key={r.id} className="border-b"><td className="py-3"><Link to="/dogs/$dogId" params={{ dogId: r.id }} className="font-semibold text-primary">{r.name}</Link>{r.missing ? <span className="ml-2 text-warning-foreground">Rate missing</span> : null}</td><td className="px-3 py-3 text-right tabular-nums">{r.missing ? "—" : formatINR(r.generated)}</td><td className="px-3 py-3 text-right tabular-nums">{formatINR(r.paid)}</td><td className="py-3 text-right font-semibold tabular-nums">{r.missing ? "—" : formatINR(r.due)}</td></tr>)}
        {!result.rows.length ? <tr><td colSpan={4} className="py-6 text-muted-foreground">No charges in this period.</td></tr> : null}
      </tbody></table></div>
    </> : null}
  </section>;
}