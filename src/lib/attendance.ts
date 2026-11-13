// Who to show on the day-boarding check-in board, and in what order.

import { addDays } from "./dates";
import type { DayRecord, RateRow } from "./billing";

/** Dogs that came on the same weekday at least this many times in the last four weeks are "regulars". */
const REGULAR_MIN_VISITS = 2;

/**
 * Splits day boarders into the ones expected on `date` (booked, or regulars on that weekday)
 * and everyone else who does day boarding.
 */
export function checkInGroups(input: {
  date: string;
  dogs: { id: string; name: string; active: boolean }[];
  records: DayRecord[]; // records for `date` and the 4 weeks before it
  rates: RateRow[];
}): { expected: string[]; others: string[] } {
  const { date, dogs, records, rates } = input;
  const sameWeekday = new Set([1, 2, 3, 4].map((w) => addDays(date, -7 * w)));
  const visits = new Map<string, number>();
  for (const r of records) {
    if (r.status === "present" && sameWeekday.has(r.date)) {
      visits.set(r.dog_id, (visits.get(r.dog_id) ?? 0) + 1);
    }
  }
  const today = new Map(records.filter((r) => r.date === date).map((r) => [r.dog_id, r.status]));
  const doesDayBoarding = (id: string) =>
    today.has(id) ||
    records.some((r) => r.dog_id === id) ||
    rates.some((r) => r.dog_id === id && r.day_rate != null);

  const expected: string[] = [];
  const others: string[] = [];
  for (const dog of [...dogs].sort((a, b) => a.name.localeCompare(b.name))) {
    const status = today.get(dog.id);
    if (!dog.active && !status) continue;
    if (status === "scheduled" || (visits.get(dog.id) ?? 0) >= REGULAR_MIN_VISITS) {
      expected.push(dog.id);
    } else if (doesDayBoarding(dog.id)) {
      others.push(dog.id);
    }
  }
  return { expected, others };
}

/**
 * Dogs shown on the month attendance grid: active day/both dogs, dogs with any record that month,
 * and dogs added for the month — minus dogs removed for the month (unless they have attended days).
 */
export function monthRoster(input: {
  dogs: { id: string; name: string; active: boolean; service_type: "day" | "home" | "both" }[];
  records: { dog_id: string; status: string }[]; // records within the month
  roster: { dog_id: string; hidden: boolean }[]; // roster rows for the month
}): string[] {
  const { dogs, records, roster } = input;
  const hidden = new Set(roster.filter((r) => r.hidden).map((r) => r.dog_id));
  const added = new Set(roster.filter((r) => !r.hidden).map((r) => r.dog_id));
  const withRecords = new Set(records.map((r) => r.dog_id));
  const attended = new Set(records.filter((r) => r.status === "present").map((r) => r.dog_id));
  return [...dogs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((d) => {
      if (attended.has(d.id)) return true;
      if (hidden.has(d.id)) return false;
      return (
        (d.active && d.service_type !== "home") || withRecords.has(d.id) || added.has(d.id)
      );
    })
    .map((d) => d.id);
}
