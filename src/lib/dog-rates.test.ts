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