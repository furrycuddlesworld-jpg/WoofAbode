import { expect, it } from "vitest";
import { pricingRows } from "./dog-rates";
import { rateOn } from "./billing";

it("retains history and resolves appended corrections on the same effective date", () => {
  const rates = pricingRows([
    { id: "a", dog_id: "dog", service: "day", rate: 600, effective_from: "2026-11-01", created_at: "2026-11-01T00:00:00Z" },
    { id: "b", dog_id: "dog", service: "day", rate: 700, effective_from: "2026-11-04", created_at: "2026-11-04T00:00:00Z" },
    { id: "c", dog_id: "dog", service: "day", rate: 750, effective_from: "2026-11-04", created_at: "2026-11-04T01:00:00Z" },
  ], []);
  expect(rateOn(rates, "dog", "2026-11-03", "day_rate")).toBe(600);
  expect(rateOn(rates, "dog", "2026-11-04", "day_rate")).toBe(750);
});
import { groupRateRows } from "./dog-rates";
it("shows one row per date with the newest day, night and same-day rates", () => {
  const h = [
    { id: "1", dog_id: "d", service: "day" as const, rate: 600, effective_from: "2026-11-10", created_at: "2026-11-10T01" },
    { id: "2", dog_id: "d", service: "day" as const, rate: 750, effective_from: "2026-11-10", created_at: "2026-11-10T02" },
    { id: "3", dog_id: "d", service: "home" as const, rate: 1500, effective_from: "2026-11-10", created_at: "2026-11-10T01" },
  ];
  const rows = groupRateRows(h, [{ id: "L", dog_id: "d", effective_from: "2026-11-10", day_rate: 750, night_rate: 1500, same_day_rate: 750 }]);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.day?.rate).toBe(750);
  expect(rows[0]!.dayIds).toEqual(["2", "1"]);
  expect(rows[0]!.home?.rate).toBe(1500);
  expect(rows[0]!.legacy?.same_day_rate).toBe(750);
});
