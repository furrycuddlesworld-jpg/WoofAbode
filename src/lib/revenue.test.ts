import { expect, it } from "vitest";
import { revenueSummary } from "./revenue";

it("earns dated per-dog charges, excludes future nights, and subtracts confirmed payments only", () => {
  const result = revenueSummary({ from: "2026-11-01", to: "2026-11-30", today: "2026-11-14", service: "all", dogs: [{ id: "d", name: "Dog" }], rates: [{ dog_id: "d", effective_from: "2026-11-01", day_rate: 600, night_rate: 1000, same_day_rate: null }], days: [{ dog_id: "d", date: "2026-11-02", status: "present", rate_override: 700 }, { dog_id: "d", date: "2026-11-15", status: "present" }], stays: [{ id: "s", dog_id: "d", planned_start: "2026-11-12", planned_end: "2026-11-20", actual_start: null, actual_end: null, status: "in_progress", night_rate_override: null }], bills: [{ id: "b", lines: [{ dog_id: "d", dog_name: "Dog", kind: "day", description: "", quantity: 1, rate: 700, amount: 700, estimate: false }] }], payments: [{ bill_id: "b", paid_on: "2026-11-05", amount: 500, status: "confirmed" }, { bill_id: "b", paid_on: "2026-11-05", amount: 200, status: "to_confirm" }] });
  expect(result.generated).toBe(2700);
  expect(result.paid).toBe(500);
  expect(result.due).toBe(2200);
});
const base = { from: "2026-11-01", to: "2026-11-30", today: "2026-11-30", service: "all" as const, dogs: [{ id: "d", name: "Dog" }], stays: [], payments: [] };
const rates = [{ dog_id: "d", effective_from: "2026-11-01", day_rate: 600, night_rate: 1000, same_day_rate: null }];
const days = [{ dog_id: "d", date: "2026-11-02", status: "present" }, { dog_id: "d", date: "2026-11-03", status: "present" }, { dog_id: "d", date: "2026-11-10", status: "present" }];

it("counts attended days with no saved bill as to be billed", () => {
  const r = revenueSummary({ ...base, rates, days, bills: [] });
  expect(r.toBeBilled).toBe(1800);
  expect(r.billedEarned).toBe(0);
});

it("excludes days already on a saved bill from to be billed", () => {
  const bills = [{ id: "b", month: "2026-11", lines: [{ dog_id: "d", dog_name: "Dog", kind: "day" as const, description: "", quantity: 2, rate: 600, amount: 1200, estimate: false, dates: ["2026-11-02", "2026-11-03"] }] }];
  const r = revenueSummary({ ...base, rates, days, bills });
  expect(r.toBeBilled).toBe(600);
  expect(r.billedEarned).toBe(1200);
});

it("prices unbilled days at the rate in effect on each date", () => {
  const r = revenueSummary({ ...base, rates: [...rates, { dog_id: "d", effective_from: "2026-11-05", day_rate: 700, night_rate: 1000, same_day_rate: null }], days, bills: [] });
  expect(r.toBeBilled).toBe(1900);
});

it("leaves dogs without a rate out of to be billed and flags them", () => {
  const r = revenueSummary({ ...base, rates: [], days, bills: [] });
  expect(r.toBeBilled).toBe(0);
  expect(r.missing).toEqual(["Dog"]);
});
