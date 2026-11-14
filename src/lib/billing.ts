// Monthly bill calculation. Pure functions, no database access, so the rules are easy to test.
//
// Rules (agreed with Avi):
// - Day boarding: each day marked present x the dog's day rate in force on that day.
// - Home boarding: each night is billed in the month it falls in (the night of 31 Oct is October).
//   Nights use the actual start/end dates when recorded, otherwise the tentative dates.
// - A stay that starts and ends on the same day is one same-day charge.
// - Advances are taken off the total. No GST.

import { addDays, eachDate, formatDate, monthOf, toISTDate } from "./dates";

export type RateRow = {
  dog_id: string;
  effective_from: string;
  day_rate: number | null;
  night_rate: number | null;
  same_day_rate: number | null;
};

export type DayRecord = {
  dog_id: string;
  date: string;
  status: "scheduled" | "present" | "absent";
  rate_override?: number | null;
  override_reason?: string | null;
};

export type StayStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type Stay = {
  id: string;
  dog_id: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: StayStatus;
  night_rate_override: number | null;
};

export type BillLine = {
  dog_id: string;
  dog_name: string;
  kind: "day" | "night" | "same_day";
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  estimate: boolean;
  stay_id?: string;
  special_rate?: boolean;
  dates?: string[];
};

export type BillCalculation = {
  lines: BillLine[];
  subtotal: number;
  advance_applied: number;
  total: number;
  has_estimate: boolean;
  warnings: string[];
  missingRateDogs: string[];
};

type RateField = "day_rate" | "night_rate" | "same_day_rate";

/** The rate in force on `date`: the latest row with effective_from on or before it. */
export function rateOn(
  rates: RateRow[],
  dogId: string,
  date: string,
  field: RateField,
): number | null {
  let best: RateRow | null = null;
  for (const r of rates) {
    if (r.dog_id !== dogId || r.effective_from > date || r[field] == null) continue;
    if (!best || r.effective_from > best.effective_from) best = r;
  }
  return best ? best[field] : null;
}

/** Start and end dates used for billing a stay, and whether they are still tentative. */
export function stayDates(stay: Stay): { start: string; end: string; estimate: boolean } {
  const start = stay.actual_start ? toISTDate(stay.actual_start) : stay.planned_start;
  const end = stay.actual_end ? toISTDate(stay.actual_end) : stay.planned_end;
  return { start, end, estimate: stay.status !== "completed" };
}

/** Number of nights in a stay (0 for a same-day stay). */
export function stayNights(stay: Stay): number {
  const { start, end } = stayDates(stay);
  return Math.max(0, eachDate(start, end).length - 1);
}

/** Estimated total for a whole stay, ignoring month boundaries. */
export function estimateStayAmount(stay: Stay, rates: RateRow[]): number | null {
  const { start, end } = stayDates(stay);
  if (start === end) {
    return stay.night_rate_override ?? rateOn(rates, stay.dog_id, start, "same_day_rate");
  }
  let total = 0;
  for (const night of eachDate(start, addDays(end, -1))) {
    const rate = stay.night_rate_override ?? rateOn(rates, stay.dog_id, night, "night_rate");
    if (rate == null) return null;
    total += rate;
  }
  return total;
}

function pushGrouped(
  lines: BillLine[],
  base: Omit<BillLine, "quantity" | "amount" | "rate" | "description">,
  rate: number,
  describe: (qty: number) => string,
) {
  const existing = lines.find(
    (l) =>
      l.dog_id === base.dog_id &&
      l.kind === base.kind &&
      l.rate === rate &&
      l.stay_id === base.stay_id &&
      Boolean(l.special_rate) === Boolean(base.special_rate) &&
      l.estimate === base.estimate,
  );
  if (existing) {
    existing.quantity += 1;
    existing.amount = existing.quantity * rate;
    existing.description = describe(existing.quantity);
    existing.dates = [...(existing.dates ?? []), ...(base.dates ?? [])];
    return;
  }
  lines.push({ ...base, rate, quantity: 1, amount: rate, description: describe(1) });
}

export function calculateBill(input: {
  month: string; // "YYYY-MM"
  dogs: { id: string; name: string }[];
  rates: RateRow[];
  dayRecords: DayRecord[];
  stays: Stay[];
  advanceAvailable?: number;
  from?: string;
  to?: string;
}): BillCalculation {
  const { month, dogs, rates, dayRecords, stays } = input;
  const dogName = new Map(dogs.map((d) => [d.id, d.name]));
  const lines: BillLine[] = [];
  const warnings: string[] = [];
  const missingRateDogs = new Set<string>();
  const inPeriod = (date: string) => monthOf(date) === month && (!input.from || date >= input.from) && (!input.to || date <= input.to);

  // Day boarding
  const presentDays = dayRecords
    .filter((r) => r.status === "present" && inPeriod(r.date) && dogName.has(r.dog_id))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const rec of presentDays) {
    const name = dogName.get(rec.dog_id) ?? "";
    const rate = rec.rate_override ?? rateOn(rates, rec.dog_id, rec.date, "day_rate");
    if (rate == null) {
      warnings.push(`No day-boarding rate set for ${name} on ${rec.date}.`);
      missingRateDogs.add(name);
      continue;
    }
    pushGrouped(
      lines,
      { dog_id: rec.dog_id, dog_name: name, kind: "day", estimate: false, special_rate: rec.rate_override != null, dates: [rec.date] },
      rate,
      (q) => `Day boarding: ${q} day${q === 1 ? "" : "s"}`,
    );
  }

  // Home boarding
  const activeStays = stays
    .filter((s) => s.status !== "cancelled" && dogName.has(s.dog_id))
    .sort((a, b) => stayDates(a).start.localeCompare(stayDates(b).start));
  for (const stay of activeStays) {
    const name = dogName.get(stay.dog_id) ?? "";
    const { start, end, estimate } = stayDates(stay);
    if (end < start) {
      warnings.push(`Stay for ${name} ends before it starts (${start} to ${end}).`);
      continue;
    }
    const base = { dog_id: stay.dog_id, dog_name: name, estimate, stay_id: stay.id };
    if (start === end) {
      if (!inPeriod(start)) continue;
      const rate = stay.night_rate_override ?? rateOn(rates, stay.dog_id, start, "same_day_rate");
      if (rate == null) {
        warnings.push(`No same-day rate set for ${name} on ${start}.`);
        missingRateDogs.add(name);
        continue;
      }
      pushGrouped(
        lines,
        { ...base, kind: "same_day", special_rate: stay.night_rate_override != null, dates: [start] },
        rate,
        () => `Same-day stay (${formatDate(start)})`,
      );
      continue;
    }
    for (const night of eachDate(start, addDays(end, -1))) {
      if (!inPeriod(night)) continue;
      const rate = stay.night_rate_override ?? rateOn(rates, stay.dog_id, night, "night_rate");
      if (rate == null) {
        warnings.push(`No home-boarding rate set for ${name} on ${night}.`);
        missingRateDogs.add(name);
        continue;
      }
      pushGrouped(
        lines,
        { ...base, kind: "night", special_rate: stay.night_rate_override != null, dates: [night] },
        rate,
        (q) =>
          `Home boarding ${formatDate(start)} to ${formatDate(end)}: ${q} night${q === 1 ? "" : "s"}${estimate ? " (estimate)" : ""}`,
      );
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const advance_applied = Math.min(Math.max(0, input.advanceAvailable ?? 0), subtotal);
  return {
    lines,
    subtotal,
    advance_applied,
    total: subtotal - advance_applied,
    has_estimate: lines.some((l) => l.estimate),
    warnings: [...new Set(warnings)],
    missingRateDogs: [...missingRateDogs],
  };
}

/** Bill status from the amount paid so far. */
export function billStatus(total: number, paid: number): "pending" | "partly_paid" | "paid" {
  if (paid >= total) return "paid";
  if (paid > 0) return "partly_paid";
  return "pending";
}

/** UPI deep link that opens the parent's UPI app with the amount filled in. */
export function upiLink(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note,
  });
  return `upi://pay?${params.toString()}`;
}
