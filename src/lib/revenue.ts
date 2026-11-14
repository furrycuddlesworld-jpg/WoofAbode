import { calculateBill, stayDates, type RateRow, type DayRecord, type Stay, type BillLine } from "./billing";
import { eachDate, monthOf } from "./dates";

/** Service columns share the same dated pricing and payment allocation as the detail views. */
export function revenueByService(input: Omit<Parameters<typeof revenueSummary>[0], "service">) {
  return {
    day: revenueSummary({ ...input, service: "day" }),
    home: revenueSummary({ ...input, service: "home" }),
    total: revenueSummary({ ...input, service: "all" }),
  };
}

export function revenueSummary(input: {
  from: string; to: string; today: string; service: "all" | "day" | "home";
  dogs: { id: string; name: string }[]; rates: RateRow[]; days: (DayRecord & { imported?: boolean })[];
  stays: (Stay & { imported?: boolean })[];
  bills: { id: string; month?: string; lines: BillLine[] }[];
  payments: { bill_id: string; paid_on: string; amount: number; status: string }[];
}) {
  const to = input.to < input.today ? input.to : input.today;
  const months = [...new Set(eachDate(input.from, to).map(monthOf))];
  const stays = input.stays.filter(s => !s.imported && s.status !== "scheduled" && (stayDates(s).start < input.today || (s.status === "completed" && stayDates(s).start <= to))).map(s => {
    const dates = stayDates(s);
    // Only nights that have elapsed count as earned revenue.
    const end = dates.end < input.today ? dates.end : input.today;
    return { ...s, planned_start: dates.start, actual_start: null, planned_end: end, actual_end: null };
  });
  const rows = input.dogs.map(dog => {
    let generated = 0;
    let toBeBilled = 0;
    const unbilled: { kind: BillLine["kind"]; description: string; rate: number; dates: string[]; quantity: number; amount: number; special: boolean }[] = [];
    const missing = new Set<string>();
    for (const month of months) {
      const calc = calculateBill({ month, from: input.from, to, dogs: [dog], rates: input.rates, dayRecords: input.service === "home" ? [] : input.days.filter(d => !d.imported), stays: input.service === "day" ? [] : stays });
      generated += calc.subtotal;
      for (const line of calc.lines) {
        const open = unbilledPart(line, month, input.bills);
        if (open.amount > 0) { toBeBilled += open.amount; unbilled.push({ kind: line.kind, description: line.description, rate: Number(line.rate), dates: open.dates, quantity: open.quantity, amount: open.amount, special: Boolean(line.special_rate) }); }
      }
      calc.missingRateDogs.forEach(n => missing.add(n));
    }
    let paid = 0;
    for (const p of input.payments) {
      if (p.status !== "confirmed" || p.paid_on < input.from || p.paid_on > to) continue;
      const bill = input.bills.find(b => b.id === p.bill_id);
      const total = bill?.lines.reduce((s, l) => s + Number(l.amount), 0) ?? 0;
      const dogAmount = bill?.lines.filter(l => l.dog_id === dog.id && (input.service === "all" || (input.service === "day" ? l.kind === "day" : l.kind !== "day"))).reduce((s, l) => s + Number(l.amount), 0) ?? 0;
      if (total > 0) paid += Number(p.amount) * dogAmount / total;
    }
    return { ...dog, generated, toBeBilled, unbilled, paid, due: generated - paid, missing: missing.size > 0 };
  }).filter(r => r.generated || r.paid || r.missing).sort((a, b) => b.due - a.due);
  const toBeBilled = rows.reduce((s, r) => s + r.toBeBilled, 0);
  return { rows, toBeBilled, billedEarned: rows.reduce((s, r) => s + r.generated, 0) - toBeBilled, generated: rows.reduce((s, r) => s + r.generated, 0), paid: rows.reduce((s, r) => s + r.paid, 0), due: rows.reduce((s, r) => s + r.due, 0), missing: rows.filter(r => r.missing).map(r => r.name) };
}

const group = (k: BillLine["kind"]) => (k === "day" ? "day" : "home");

/** Portion of an earned line not yet on any saved bill (matched by dog, service and date). */
export function unbilledPart(line: BillLine, month: string, bills: { month?: string; lines: BillLine[] }[]) {
  const same = bills.flatMap(b => b.lines.filter(l => l.dog_id === line.dog_id && group(l.kind) === group(line.kind)).map(l => ({ l, month: b.month })));
  const qty = Number(line.quantity) || 0;
  if (!line.dates?.length) {
    const covered = same.some(x => x.month === month);
    return covered ? { amount: 0, quantity: 0, dates: [] as string[] } : { amount: Number(line.amount), quantity: qty, dates: [] as string[] };
  }
  const billedDates = new Set(same.flatMap(x => x.l.dates ?? []));
  const monthCovered = same.some(x => x.month === month && !x.l.dates?.length);
  const open = monthCovered ? [] : line.dates.filter(d => !billedDates.has(d));
  const per = line.dates.length ? Number(line.amount) / line.dates.length : 0;
  return { amount: per * open.length, quantity: open.length, dates: open };
}
