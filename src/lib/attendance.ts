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
