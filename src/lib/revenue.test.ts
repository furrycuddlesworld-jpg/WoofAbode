import { expect, it } from "vitest";
import { revenueSummary } from "./revenue";

it("earns dated per-dog charges, excludes future nights, and subtracts confirmed payments only", () => {
  const result = revenueSummary({ from: "2026-11-01", to: "2026-11-30", today: "2026-11-14", service: "all", dogs: [{ id: "d", name: "Dog" }], rates: [{ dog_id: "d", effective_from: "2026-11-01", day_rate: 600, night_rate: 1000, same_day_rate: null }], days: [{ dog_id: "d", date: "2026-11-02", status: "present", rate_override: 700 }, { dog_id: "d", date: "2026-11-15", status: "present" }], stays: [{ id: "s", dog_id: "d", planned_start: "2026-11-12", planned_end: "2026-11-20", actual_start: null, actual_end: null, status: "in_progress", night_rate_override: null }], bills: [{ id: "b", lines: [{ dog_id: "d", dog_name: "Dog", kind: "day", description: "", quantity: 1, rate: 700, amount: 700, estimate: false }] }], payments: [{ bill_id: "b", paid_on: "2026-11-05", amount: 500, status: "confirmed" }, { bill_id: "b", paid_on: "2026-11-05", amount: 200, status: "to_confirm" }] });
  expect(result.generated).toBe(2700);
  expect(result.paid).toBe(500);
  expect(result.due).toBe(2200);
});