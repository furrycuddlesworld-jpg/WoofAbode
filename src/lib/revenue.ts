import { calculateBill, stayDates, type RateRow, type DayRecord, type Stay, type BillLine } from "./billing";
import { eachDate, monthOf, addDays } from "./dates";

export function revenueSummary(input: {
  from: string; to: string; today: string; service: "all" | "day" | "home";
  dogs: { id: string; name: string }[]; rates: RateRow[]; days: (DayRecord & { imported?: boolean })[];
  stays: (Stay & { imported?: boolean })[];
  bills: { id: string; lines: BillLine[] }[];
  payments: { bill_id: string; paid_on: string; amount: number; status: string }[];
}) {
  const to = input.to < input.today ? input.to : input.today;
  const months = [...new Set(eachDate(input.from, to).map(monthOf))];
  const stays = input.stays.filter(s => !s.imported && s.status !== "scheduled" && stayDates(s).start <= to).map(s => {
    const dates = stayDates(s);
    // Only nights that have elapsed count as earned revenue.
    const end = dates.end < input.today ? dates.end : input.today;
    return { ...s, planned_start: dates.start, actual_start: null, planned_end: end, actual_end: null };
  });
  const rows = input.dogs.map(dog => {
    let generated = 0;
    const missing = new Set<string>();
    for (const month of months) {
      const calc = calculateBill({ month, from: input.from, to, dogs: [dog], rates: input.rates, dayRecords: input.service === "home" ? [] : input.days.filter(d => !d.imported), stays: input.service === "day" ? [] : stays });
      generated += calc.subtotal;
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
    return { ...dog, generated, paid, due: generated - paid, missing: missing.size > 0 };
  }).filter(r => r.generated || r.paid || r.missing).sort((a, b) => b.due - a.due);
  return { rows, generated: rows.reduce((s, r) => s + r.generated, 0), paid: rows.reduce((s, r) => s + r.paid, 0), due: rows.reduce((s, r) => s + r.due, 0), missing: rows.filter(r => r.missing).map(r => r.name) };
}