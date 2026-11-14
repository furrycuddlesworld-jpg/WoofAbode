import { firstDayOfMonth, lastDayOfMonth } from "./dates";
import type { Bill, Expense, Payment } from "./types";

export function financeSummary(input: { from: string; to: string; today: string; service: "all" | "day" | "home"; bills: Bill[]; payments: Payment[]; expenses: Expense[] }) {
  const end = input.to < input.today ? input.to : input.today;
  const bills = input.bills.filter(b => firstDayOfMonth(b.month) <= end && lastDayOfMonth(b.month) >= input.from).flatMap(b => {
    const subtotal = b.lines.reduce((s, l) => s + Number(l.amount), 0);
    const selected = b.lines.filter(l => input.service === "all" || (input.service === "day" ? l.kind === "day" : l.kind !== "day")).reduce((s, l) => s + Number(l.amount), 0);
    if (input.service !== "all" && selected === 0) return [];
    const share = input.service === "all" ? 1 : subtotal > 0 ? selected / subtotal : 0;
    const total = Number(b.total) * share;
    const confirmed = input.payments.filter(p => p.bill_id === b.id && p.status === "confirmed" && p.paid_on <= end).sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at));
    const paid = confirmed.reduce((s, p) => s + Number(p.amount), 0) * share;
    let cumulative = 0;
    let settledOn: string | null = null;
    for (const p of confirmed) { cumulative += Number(p.amount); if (settledOn == null && cumulative >= Number(b.total)) settledOn = p.paid_on; }
    return [{ bill: b, total, paid, due: Math.max(0, total - paid), status: paid >= total ? "paid" : paid > 0 ? "partly_paid" : "pending", settledOn, payments: confirmed.map(p => ({ ...p, amount: Number(p.amount) * share })) }];
  });
  const expenses = input.expenses.filter(e => e.incurred_on >= input.from && e.incurred_on <= end && (input.service === "all" || e.service === input.service));
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expensePaid = expenses.filter(e => e.paid_on && e.paid_on <= end).reduce((s, e) => s + Number(e.amount), 0);
  return { bills, expenses, billed: bills.reduce((s, b) => s + b.total, 0), billPaid: bills.reduce((s, b) => s + b.paid, 0), billDue: bills.reduce((s, b) => s + b.due, 0), expenseTotal, expensePaid, expenseUnpaid: expenseTotal - expensePaid };
}

/** Actual cash position: money received minus spends already paid (unpaid spends ignored). */
export function cashInHand(received: number, expensePaid: number) {
  return received - expensePaid;
}