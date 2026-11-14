import { expect, it } from "vitest";
import { financeSummary } from "./finance";
import type { Bill, Expense, Payment } from "./types";
const bill: Bill = { id: "b", bill_number: 1, parent_id: "p", month: "2026-11", lines: [{ dog_id: "d", dog_name: "Dog", kind: "day", quantity: 2, rate: 600, amount: 1200, description: "", estimate: false }], subtotal: 1200, advance_applied: 200, total: 1000, paid: 1000, status: "paid", has_estimate: false, generated_at: "2026-11-01", sent_at: null };
const payment = (amount: number, date: string, status: Payment["status"] = "confirmed"): Payment => ({ id: date, bill_id: "b", amount, paid_on: date, method: "cash", upi_txn_id: null, status, note: null, created_at: date });
const expense = (id: string, amount: number, paid_on: string | null): Expense => ({ id, description: "Food", category: "food", service: "all", amount, incurred_on: "2026-11-02", paid_on, method: "cash", note: null, created_at: "2026-11-02" });
const input = { from: "2026-11-01", to: "2026-11-30", today: "2026-11-14", service: "all" as const, bills: [bill], payments: [payment(400, "2026-11-03"), payment(600, "2026-11-10"), payment(500, "2026-11-05", "to_confirm")], expenses: [expense("a", 300, "2026-11-04"), expense("b", 200, null)] };
it("shows saved total bill after advances without double counting revenue", () => { expect(financeSummary(input).billed).toBe(1000); });
it("shows confirmed payments and the date the bill became fully paid", () => {
  const result = financeSummary(input);
  expect(result.billPaid).toBe(1000);
  expect(result.billDue).toBe(0);
  expect(result.bills[0]?.settledOn).toBe("2026-11-10");
});
it("separates paid and unpaid spending", () => {
  const result = financeSummary(input);
  expect([result.expenseTotal, result.expensePaid, result.expenseUnpaid]).toEqual([500, 300, 200]);
});
it("keeps a bill partly paid until its final payment date", () => {
  const result = financeSummary({ ...input, to: "2026-11-06" });
  expect(result.bills[0]?.status).toBe("partly_paid");
  expect(result.bills[0]?.settledOn).toBeNull();
  expect(result.billDue).toBe(600);
});
import { cashInHand } from "./finance";
it("cash in hand subtracts only paid spends from money received", () => {
  expect(cashInHand(10000, 3000)).toBe(7000);
});
