import { describe, expect, it } from "vitest";

import { boardingCounts, upcoming } from "./stats";
import type { DayBoarding, StayRow } from "./types";

const day = (date: string, status: DayBoarding["status"] = "present"): DayBoarding => ({
  id: date,
  dog_id: "d",
  date,
  status,
  imported: false,
  marked_at: null,
});
const stay = (p: Partial<StayRow>): StayRow => ({
  id: "s",
  dog_id: "d",
  planned_start: "2026-10-30",
  planned_end: "2026-11-03",
  actual_start: null,
  actual_end: null,
  status: "completed",
  night_rate_override: null,
  override_reason: null,
  notes: null,
  imported: false,
  imported_amount: null,
  imported_paid: null,
  created_at: "",
  ...p,
});

describe("boardingCounts", () => {
  it("counts present days and nights, this month and all time", () => {
    const days = [
      day("2026-10-15"),
      day("2026-11-01"),
      day("2026-11-02", "absent"),
      day("2026-11-20", "scheduled"),
    ];
    const c = boardingCounts("d", days, [stay({})], "2026-11-10");
    expect(c).toEqual({ daysThisMonth: 1, daysAllTime: 2, nightsThisMonth: 2, nightsAllTime: 4 });
  });

  it("counts an ongoing stay up to today and ignores scheduled ones", () => {
    const s = [
      stay({ status: "in_progress", planned_start: "2026-11-05", planned_end: "2026-11-20" }),
      stay({ id: "x", status: "scheduled" }),
    ];
    expect(boardingCounts("d", [], s, "2026-11-08").nightsAllTime).toBe(3);
  });
});

describe("upcoming", () => {
  it("lists scheduled future days and open stays in date order", () => {
    const items = upcoming(
      [
        day("2026-11-12", "scheduled"),
        day("2026-11-01", "scheduled"),
        day("2026-11-15", "present"),
      ],
      [stay({ status: "scheduled", planned_start: "2026-11-11", planned_end: "2026-11-13" })],
      "2026-11-10",
    );
    expect(items.map((i) => (i.kind === "day" ? i.date : `stay ${i.stay.planned_start}`))).toEqual([
      "stay 2026-11-11",
      "2026-11-12",
    ]);
  });
});
