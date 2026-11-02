// Creating and refreshing monthly bills in the database. The money rules live in billing.ts.

import { supabase } from "@/integrations/supabase/client";
import { billStatus, calculateBill, stayDates } from "./billing";
import { addDays, eachDate, firstDayOfMonth, formatMonth, lastDayOfMonth, monthOf } from "./dates";
import type { Advance, Bill, DayBoarding, Dog, Rate, StayRow } from "./types";

export type GenerateResult =
  { ok: true; bill: Bill; warnings: string[] } | { ok: false; reason: string };

/**
 * Creates or refreshes one parent's bill for a month. A bill that is already fully paid is left alone.
 * Imported history is never billed.
 */
export async function generateBill(parentId: string, month: string): Promise<GenerateResult> {
  const { data: dogsData, error: dogsErr } = await supabase
    .from("dogs")
    .select("id, name")
    .eq("owner_id", parentId);
  if (dogsErr) return { ok: false, reason: dogsErr.message };
  const dogs = (dogsData ?? []) as Pick<Dog, "id" | "name">[];
  if (dogs.length === 0) return { ok: false, reason: "This parent has no dogs." };
  const dogIds = dogs.map((d) => d.id);

  const { data: existingData } = await supabase
    .from("bills")
    .select("*")
    .eq("parent_id", parentId)
    .eq("month", month)
    .maybeSingle();
  const existing = existingData as Bill | null;
  if (existing && existing.status === "paid") {
    return {
      ok: false,
      reason: `The ${formatMonth(month)} bill is already paid, so it was not changed.`,
    };
  }

  const [ratesRes, daysRes, staysRes, advRes, otherBillsRes] = await Promise.all([
    supabase.from("rates").select("*").in("dog_id", dogIds),
    supabase
      .from("day_boarding")
      .select("*")
      .in("dog_id", dogIds)
      .eq("imported", false)
      .gte("date", firstDayOfMonth(month))
      .lte("date", lastDayOfMonth(month)),
    supabase
      .from("stays")
      .select("*")
      .in("dog_id", dogIds)
      .eq("imported", false)
      .neq("status", "cancelled"),
    supabase.from("advances").select("amount").eq("parent_id", parentId),
    supabase
      .from("bills")
      .select("id, advance_applied")
      .eq("parent_id", parentId)
      .neq("month", month),
  ]);
  const firstError =
    ratesRes.error ?? daysRes.error ?? staysRes.error ?? advRes.error ?? otherBillsRes.error;
  if (firstError) return { ok: false, reason: firstError.message };

  // Advance still available = all advances received minus what other bills have already used.
  const received = ((advRes.data ?? []) as Pick<Advance, "amount">[]).reduce(
    (s, a) => s + Number(a.amount),
    0,
  );
  const usedElsewhere = ((otherBillsRes.data ?? []) as Pick<Bill, "advance_applied">[]).reduce(
    (s, b) => s + Number(b.advance_applied),
    0,
  );
  const advanceAvailable = Math.max(0, received - usedElsewhere);

  const calc = calculateBill({
    month,
    dogs,
    rates: ((ratesRes.data ?? []) as Rate[]).map(numericRate),
    dayRecords: (daysRes.data ?? []) as DayBoarding[],
    stays: ((staysRes.data ?? []) as StayRow[]).map((s) => ({
      ...s,
      night_rate_override: s.night_rate_override == null ? null : Number(s.night_rate_override),
    })),
    advanceAvailable,
  });

  if (!existing && calc.lines.length === 0) {
    return { ok: false, reason: `No charges for ${formatMonth(month)}, so no bill was made.` };
  }

  const paid = existing ? Number(existing.paid) : 0;
  const row = {
    parent_id: parentId,
    month,
    lines: calc.lines,
    subtotal: calc.subtotal,
    advance_applied: calc.advance_applied,
    total: calc.total,
    paid,
    has_estimate: calc.has_estimate,
    status: billStatus(calc.total, paid),
    generated_at: new Date().toISOString(),
  };
  const { data: saved, error: saveErr } = await supabase
    .from("bills")
    .upsert(row, { onConflict: "parent_id,month" })
    .select("*")
    .single();
  if (saveErr) return { ok: false, reason: saveErr.message };
  const bill = saved as Bill;

  if (!existing) {
    await supabase.from("notifications").insert({
      user_id: parentId,
      title: `Your bill for ${formatMonth(month)} is ready`,
      body: `Total due: ₹${Math.round(calc.total).toLocaleString("en-IN")}`,
      link: `/bills/${bill.id}`,
    });
  }

  return { ok: true, bill, warnings: calc.warnings };
}

/** Months whose nights a stay touches. */
export function monthsOfStay(stay: StayRow): string[] {
  const { start, end } = stayDates(stay);
  if (start === end) return [monthOf(start)];
  return [...new Set(eachDate(start, addDays(end, -1)).map(monthOf))];
}

/**
 * After a home-boarding stay ends: bill the months it covers for parents who had no day boarding
 * in that month (day boarders are billed when the last day of the month is marked).
 */
export async function billAfterStayEnds(
  stay: StayRow,
  parentId: string,
): Promise<GenerateResult[]> {
  const { data: dogs } = await supabase.from("dogs").select("id").eq("owner_id", parentId);
  const dogIds = ((dogs ?? []) as { id: string }[]).map((d) => d.id);
  const results: GenerateResult[] = [];
  for (const month of monthsOfStay(stay)) {
    const { count } = await supabase
      .from("day_boarding")
      .select("id", { count: "exact", head: true })
      .in("dog_id", dogIds)
      .gte("date", firstDayOfMonth(month))
      .lte("date", lastDayOfMonth(month));
    if ((count ?? 0) === 0) results.push(await generateBill(parentId, month));
  }
  return results;
}

function numericRate(r: Rate): Rate {
  const n = (v: number | null) => (v == null ? null : Number(v));
  return {
    ...r,
    day_rate: n(r.day_rate),
    night_rate: n(r.night_rate),
    same_day_rate: n(r.same_day_rate),
  };
}

/**
 * Month-end: creates or refreshes the bill of every parent whose dog came for day boarding
 * in `month`. Returns how many bills have charges, plus any warnings.
 */
export async function closeMonth(
  month: string,
): Promise<{ made: number; warnings: string[]; error?: string }> {
  const { data, error } = await supabase
    .from("day_boarding")
    .select("dog_id, dogs!inner(owner_id)")
    .eq("status", "present")
    .gte("date", firstDayOfMonth(month))
    .lte("date", lastDayOfMonth(month));
  if (error) return { made: 0, warnings: [], error: error.message };
  const parents = new Set<string>();
  for (const row of (data ?? []) as unknown as { dogs: { owner_id: string | null } }[]) {
    if (row.dogs?.owner_id) parents.add(row.dogs.owner_id);
  }
  let made = 0;
  const warnings: string[] = [];
  for (const pid of parents) {
    const res = await generateBill(pid, month);
    if (res.ok) {
      made += 1;
      warnings.push(...res.warnings);
    }
  }
  return { made, warnings };
}
