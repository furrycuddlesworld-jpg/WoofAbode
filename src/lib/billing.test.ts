import { describe, expect, it } from "vitest";

import {
  billStatus,
  calculateBill,
  estimateStayAmount,
  rateOn,
  upiLink,
  type RateRow,
  type Stay,
} from "./billing";
import { formatAge, isLastDayOfMonth, lastDayOfMonth, toISTDate } from "./dates";

const dogs = [
  { id: "miso", name: "Miso" },
  { id: "churro", name: "Churro" },
  { id: "astro", name: "Astro" },
  { id: "eva", name: "Eva" },
];

const rates: RateRow[] = [
  {
    dog_id: "miso",
    effective_from: "2025-09-01",
    day_rate: 900,
    night_rate: 1200,
    same_day_rate: 750,
  },
  {
    dog_id: "miso",
    effective_from: "2026-08-04",
    day_rate: 750,
    night_rate: null,
    same_day_rate: null,
  },
  {
    dog_id: "miso",
    effective_from: "2026-10-01",
    day_rate: null,
    night_rate: 1500,
    same_day_rate: null,
  },
  {
    dog_id: "churro",
    effective_from: "2025-09-01",
    day_rate: 650,
    night_rate: 1000,
    same_day_rate: 750,
  },
  {
    dog_id: "astro",
    effective_from: "2026-01-01",
    day_rate: null,
    night_rate: 1700,
    same_day_rate: 750,
  },
  {
    dog_id: "eva",
    effective_from: "2026-01-01",
    day_rate: null,
    night_rate: 1500,
    same_day_rate: 750,
  },
];

function stay(
  partial: Partial<Stay> & Pick<Stay, "dog_id" | "planned_start" | "planned_end">,
): Stay {
  return {
    id: `${partial.dog_id}-${partial.planned_start}`,
    actual_start: null,
    actual_end: null,
    status: "completed",
    night_rate_override: null,
    ...partial,
  };
}

const present = (dog_id: string, dates: string[]) =>
  dates.map((date) => ({ dog_id, date, status: "present" as const }));

describe("rateOn", () => {
  it("uses the latest rate in force on the date", () => {
    expect(rateOn(rates, "miso", "2026-08-03", "day_rate")).toBe(900);
    expect(rateOn(rates, "miso", "2026-08-04", "day_rate")).toBe(750);
    // a later row without a night rate does not hide the earlier night rate
    expect(rateOn(rates, "miso", "2026-09-01", "night_rate")).toBe(1200);
    expect(rateOn(rates, "miso", "2026-10-25", "night_rate")).toBe(1500);
    expect(rateOn(rates, "astro", "2025-12-31", "night_rate")).toBeNull();
  });
});

describe("calculateBill", () => {
  it("splits three days at ₹600 and five at ₹700", () => {
    const bill = calculateBill({ month: "2026-11", dogs: [{ id: "d", name: "Dog" }], rates: [
      { dog_id: "d", effective_from: "2026-11-01", day_rate: 600, night_rate: null, same_day_rate: null },
      { dog_id: "d", effective_from: "2026-11-04", day_rate: 700, night_rate: null, same_day_rate: null },
    ], dayRecords: present("d", Array.from({ length: 8 }, (_, i) => `2026-11-0${i + 1}`)), stays: [] });
    expect(bill.lines.map(l => [l.quantity, l.rate, l.amount])).toEqual([[3, 600, 1800], [5, 700, 3500]]);
  });
  it("keeps an attendance override separate even when it equals the standard rate", () => {
    const bill = calculateBill({ month: "2026-11", dogs, rates, dayRecords: [{ dog_id: "churro", date: "2026-11-01", status: "present", rate_override: 650 }, ...present("churro", ["2026-11-02"])], stays: [] });
    expect(bill.lines.map(l => [l.quantity, l.rate, l.special_rate])).toEqual([[1, 650, true], [1, 650, false]]);
  });
  it("identifies a dog with any unpriced date even if other dates have charges", () => {
    const bill = calculateBill({ month: "2026-01", dogs, rates, dayRecords: present("miso", ["2026-01-01"]), stays: [stay({ dog_id: "astro", planned_start: "2025-12-31", planned_end: "2026-01-02" })] });
    expect(bill.missingRateDogs).toEqual([]);
    const missing = calculateBill({ month: "2025-12", dogs, rates, dayRecords: present("churro", ["2025-12-01"]), stays: [stay({ dog_id: "astro", planned_start: "2025-12-31", planned_end: "2026-01-02" })] });
    expect(missing.missingRateDogs).toEqual(["Astro"]);
    expect(missing.subtotal).toBe(650);
  });
  it("uses each night's effective rate within one stay", () => {
    const bill = calculateBill({ month: "2026-10", dogs, rates, dayRecords: [], stays: [stay({ dog_id: "miso", planned_start: "2026-09-30", planned_end: "2026-10-03" })] });
    expect(bill.lines.map(l => [l.quantity, l.rate])).toEqual([[2, 1500]]);
    const september = calculateBill({ month: "2026-09", dogs, rates, dayRecords: [], stays: [stay({ dog_id: "miso", planned_start: "2026-09-30", planned_end: "2026-10-03" })] });
    expect(september.subtotal).toBe(1200);
  });
  it("matches the spreadsheet: Churro, 14 days at ₹650 = ₹9,100", () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    const bill = calculateBill({
      month: "2026-08",
      dogs,
      rates,
      dayRecords: present("churro", days),
      stays: [],
    });
    expect(bill.total).toBe(9100);
  });

  it("handles a mid-month rate change: Miso, 2 days at ₹900 + 11 at ₹750 = ₹10,050", () => {
    const days = [
      "2026-08-01",
      "2026-08-03",
      ...Array.from({ length: 11 }, (_, i) => `2026-08-${10 + i}`),
    ];
    const stays = [
      stay({ dog_id: "miso", planned_start: "2026-08-29", planned_end: "2026-08-30" }),
    ];
    const bill = calculateBill({
      month: "2026-08",
      dogs,
      rates,
      dayRecords: present("miso", days),
      stays,
    });
    const dayLines = bill.lines.filter((l) => l.kind === "day");
    expect(dayLines.map((l) => [l.quantity, l.rate])).toEqual([
      [2, 900],
      [11, 750],
    ]);
    expect(bill.total).toBe(10050 + 1200);
  });

  it("bills each night in the month it falls in (Astro, 31 Oct to 1 Nov)", () => {
    const stays = [
      stay({ dog_id: "astro", planned_start: "2026-10-31", planned_end: "2026-11-01" }),
    ];
    const oct = calculateBill({ month: "2026-10", dogs, rates, dayRecords: [], stays });
    const nov = calculateBill({ month: "2026-11", dogs, rates, dayRecords: [], stays });
    expect(oct.total).toBe(1700);
    expect(nov.total).toBe(0);
  });

  it("splits a long stay across months", () => {
    // Maui-style stay: 19 Jun to 20 Jul = 12 nights in June, 19 in July
    const stays = [
      stay({ dog_id: "churro", planned_start: "2026-06-19", planned_end: "2026-07-20" }),
    ];
    const june = calculateBill({ month: "2026-06", dogs, rates, dayRecords: [], stays });
    const july = calculateBill({ month: "2026-07", dogs, rates, dayRecords: [], stays });
    expect(june.lines[0]?.quantity).toBe(12);
    expect(july.lines[0]?.quantity).toBe(19);
    expect(june.total + july.total).toBe(31 * 1000);
  });

  it("charges a same-day stay once (Eva, 1 Aug, ₹750)", () => {
    const stays = [stay({ dog_id: "eva", planned_start: "2026-08-01", planned_end: "2026-08-01" })];
    const bill = calculateBill({ month: "2026-08", dogs, rates, dayRecords: [], stays });
    expect(bill.total).toBe(750);
    expect(bill.lines[0]?.kind).toBe("same_day");
  });

  it("uses actual dates over tentative ones and flags unfinished stays as estimates", () => {
    const planned = stay({
      dog_id: "churro",
      planned_start: "2026-11-10",
      planned_end: "2026-11-15",
      status: "scheduled",
    });
    expect(
      calculateBill({ month: "2026-11", dogs, rates, dayRecords: [], stays: [planned] }),
    ).toMatchObject({
      total: 5000,
      has_estimate: true,
    });
    const ended = {
      ...planned,
      status: "completed" as const,
      actual_start: "2026-11-10T09:00:00+05:30",
      actual_end: "2026-11-13T18:00:00+05:30",
    };
    expect(
      calculateBill({ month: "2026-11", dogs, rates, dayRecords: [], stays: [ended] }),
    ).toMatchObject({
      total: 3000,
      has_estimate: false,
    });
  });

  it("ignores cancelled stays, absences and other dogs", () => {
    const bill = calculateBill({
      month: "2026-11",
      dogs: [{ id: "churro", name: "Churro" }],
      rates,
      dayRecords: [
        { dog_id: "churro", date: "2026-11-02", status: "absent" },
        { dog_id: "churro", date: "2026-11-03", status: "scheduled" },
        { dog_id: "miso", date: "2026-11-03", status: "present" },
      ],
      stays: [
        stay({
          dog_id: "churro",
          planned_start: "2026-11-05",
          planned_end: "2026-11-07",
          status: "cancelled",
        }),
      ],
    });
    expect(bill.total).toBe(0);
    expect(bill.lines).toHaveLength(0);
  });

  it("applies an advance, never more than the bill", () => {
    const days = present("churro", ["2026-11-02", "2026-11-03"]);
    expect(
      calculateBill({
        month: "2026-11",
        dogs,
        rates,
        dayRecords: days,
        stays: [],
        advanceAvailable: 1000,
      }),
    ).toMatchObject({
      subtotal: 1300,
      advance_applied: 1000,
      total: 300,
    });
    expect(
      calculateBill({
        month: "2026-11",
        dogs,
        rates,
        dayRecords: days,
        stays: [],
        advanceAvailable: 10000,
      }).advance_applied,
    ).toBe(1300);
  });

  it("warns instead of charging ₹0 when a rate is missing", () => {
    const bill = calculateBill({
      month: "2025-12",
      dogs,
      rates,
      dayRecords: [],
      stays: [stay({ dog_id: "astro", planned_start: "2025-12-01", planned_end: "2025-12-02" })],
    });
    expect(bill.total).toBe(0);
    expect(bill.warnings[0]).toMatch(/No home-boarding rate set for Astro/);
  });

  it("applies a night-rate override", () => {
    const s = stay({
      dog_id: "churro",
      planned_start: "2026-11-01",
      planned_end: "2026-11-03",
      night_rate_override: 800,
    });
    expect(calculateBill({ month: "2026-11", dogs, rates, dayRecords: [], stays: [s] }).total).toBe(
      1600,
    );
    expect(estimateStayAmount(s, rates)).toBe(1600);
  });
});

describe("helpers", () => {
  it("billStatus", () => {
    expect(billStatus(1000, 0)).toBe("pending");
    expect(billStatus(1000, 400)).toBe("partly_paid");
    expect(billStatus(1000, 1000)).toBe("paid");
    expect(billStatus(0, 0)).toBe("paid");
  });

  it("upiLink fills in amount and note", () => {
    const link = upiLink({
      upiId: "woof@upi",
      payeeName: "WoofAbode",
      amount: 9100,
      note: "Bill WA-12",
    });
    expect(link).toBe("upi://pay?pa=woof%40upi&pn=WoofAbode&am=9100.00&cu=INR&tn=Bill+WA-12");
  });

  it("dates", () => {
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(isLastDayOfMonth("2026-10-31")).toBe(true);
    expect(isLastDayOfMonth("2026-10-30")).toBe(false);
    expect(toISTDate("2026-10-31T20:00:00Z")).toBe("2026-11-01");
    expect(formatAge("2023-09-15", "2026-11-02")).toBe("3 yrs 1 mo");
    expect(formatAge("2026-08-01", "2026-11-02")).toBe("3 mos");
  });
});
