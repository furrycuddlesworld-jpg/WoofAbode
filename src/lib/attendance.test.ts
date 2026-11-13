import { describe, expect, it } from "vitest";

import { checkInGroups } from "./attendance";

const dogs = [
  { id: "a", name: "Churro", active: true },
  { id: "b", name: "Tori", active: true },
  { id: "c", name: "Miso", active: true },
  { id: "d", name: "Old", active: false },
  { id: "e", name: "Home only", active: true },
];

describe("checkInGroups", () => {
  it("puts booked dogs and weekday regulars first", () => {
    const g = checkInGroups({
      date: "2026-11-09", // Monday
      dogs,
      rates: [
        {
          dog_id: "c",
          effective_from: "2026-01-01",
          day_rate: 900,
          night_rate: null,
          same_day_rate: null,
        },
      ],
      records: [
        { dog_id: "a", date: "2026-11-02", status: "present" },
        { dog_id: "a", date: "2026-10-26", status: "present" },
        { dog_id: "b", date: "2026-11-02", status: "present" }, // only once: not a regular
        { dog_id: "c", date: "2026-11-09", status: "scheduled" },
        { dog_id: "d", date: "2026-11-02", status: "present" },
        { dog_id: "d", date: "2026-10-26", status: "present" },
      ],
    });
    expect(g.expected).toEqual(["a", "c"]);
    expect(g.others).toEqual(["b"]);
  });
});

import { monthRoster } from "./attendance";

describe("monthRoster", () => {
  const ds = [
    { id: "day", name: "A", active: true, service_type: "day" as const },
    { id: "both", name: "B", active: true, service_type: "both" as const },
    { id: "home", name: "C", active: true, service_type: "home" as const },
    { id: "old", name: "D", active: false, service_type: "day" as const },
  ];
  it("excludes home dogs and inactive dogs by default", () => {
    expect(monthRoster({ dogs: ds, records: [], roster: [] })).toEqual(["day", "both"]);
  });
  it("includes home dogs when added or booked", () => {
    expect(
      monthRoster({
        dogs: ds,
        records: [{ dog_id: "old", status: "scheduled" }],
        roster: [{ dog_id: "home", hidden: false }],
      }),
    ).toEqual(["day", "both", "home", "old"]);
  });
  it("hidden removes a dog even with bookings, but not with attended days", () => {
    expect(
      monthRoster({
        dogs: ds,
        records: [
          { dog_id: "day", status: "scheduled" },
          { dog_id: "both", status: "present" },
        ],
        roster: [
          { dog_id: "day", hidden: true },
          { dog_id: "both", hidden: true },
        ],
      }),
    ).toEqual(["both"]);
  });
});
