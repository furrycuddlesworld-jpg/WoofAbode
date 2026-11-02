import { stayDates } from "./billing";
import { addDays, eachDate, monthOf, todayIST } from "./dates";
import type { DayBoarding, StayRow } from "./types";

export type BoardingCounts = {
  daysThisMonth: number;
  daysAllTime: number;
  nightsThisMonth: number;
  nightsAllTime: number;
};

/** Days and nights a dog has actually boarded (not future bookings). */
export function boardingCounts(
  dogId: string,
  days: DayBoarding[],
  stays: StayRow[],
  today: string = todayIST(),
): BoardingCounts {
  const month = monthOf(today);
  const present = days.filter(
    (d) => d.dog_id === dogId && d.status === "present" && d.date <= today,
  );
  const nights: string[] = [];
  for (const s of stays) {
    if (s.dog_id !== dogId || s.status === "cancelled" || s.status === "scheduled") continue;
    const { start, end } = stayDates(s);
    const last = s.status === "in_progress" ? (today < end ? today : end) : end;
    if (last <= start) continue;
    nights.push(...eachDate(start, addDays(last, -1)));
  }
  return {
    daysThisMonth: present.filter((d) => monthOf(d.date) === month).length,
    daysAllTime: present.length,
    nightsThisMonth: nights.filter((n) => monthOf(n) === month).length,
    nightsAllTime: nights.length,
  };
}

export type UpcomingItem =
  { kind: "day"; dogId: string; date: string } | { kind: "stay"; dogId: string; stay: StayRow };

/** Future day-boarding dates and stays not yet finished, soonest first. */
export function upcoming(
  days: DayBoarding[],
  stays: StayRow[],
  today: string = todayIST(),
): UpcomingItem[] {
  const items: (UpcomingItem & { sort: string })[] = [];
  for (const d of days) {
    if (d.date >= today && d.status === "scheduled")
      items.push({ kind: "day", dogId: d.dog_id, date: d.date, sort: d.date });
  }
  for (const s of stays) {
    if (s.status === "scheduled" || s.status === "in_progress") {
      items.push({ kind: "stay", dogId: s.dog_id, stay: s, sort: stayDates(s).start });
    }
  }
  return items
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .map(({ sort: _sort, ...rest }) => rest as UpcomingItem);
}
