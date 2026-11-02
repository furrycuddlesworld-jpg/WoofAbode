import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { useState } from "react";

import { Loading, PageHeader } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { checkInGroups } from "@/lib/attendance";
import {
  eachDate,
  firstDayOfMonth,
  formatMonth,
  lastDayOfMonth,
  monthOf,
  todayIST,
} from "@/lib/dates";
import { useDogs, useRates } from "@/lib/queries";
import type { DayBoarding, Dog } from "@/lib/types";
import { useAttendance } from "@/lib/useAttendance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/admin/attendance")({
  component: AttendancePage,
});

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Spreadsheet-style month view: tap a square to mark a dog present for that day. */
function AttendancePage() {
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [busy, setBusy] = useState<string | null>(null);
  const { setPresent, finishMonth } = useAttendance();
  const { data: dogs = [] } = useDogs();
  const { data: rates = [] } = useRates(dogs.map((d) => d.id));
  const from = firstDayOfMonth(month);
  const to = lastDayOfMonth(month);
  const days = eachDate(from, to);
  const today = todayIST();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", "month", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_boarding")
        .select("*")
        .gte("date", from)
        .lte("date", to);
      if (error) throw new Error(error.message);
      return (data ?? []) as DayBoarding[];
    },
  });

  const status = new Map(records.map((r) => [`${r.dog_id}|${r.date}`, r.status]));
  // Dogs with visits this month first, then the other day boarders.
  const { expected, others } = checkInGroups({ date: to, dogs, records, rates });
  const withVisits = new Set(records.map((r) => r.dog_id));
  const dogById = new Map(dogs.map((d) => [d.id, d]));
  const rows = [...new Set([...expected, ...others, ...withVisits])]
    .map((id) => dogById.get(id))
    .filter((d): d is Dog => Boolean(d))
    .sort(
      (a, b) =>
        Number(withVisits.has(b.id)) - Number(withVisits.has(a.id)) || a.name.localeCompare(b.name),
    );

  async function toggle(dog: Dog, date: string) {
    const key = `${dog.id}|${date}`;
    if (busy) return;
    setBusy(key);
    try {
      await setPresent([dog], date, status.get(key) !== "present");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Tap a square to mark a dog present. Tap again to undo. Only green days are billed."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="w-44"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          disabled={Boolean(busy) || to > today}
          title={to > today ? "Available on the last day of the month" : undefined}
          onClick={async () => {
            setBusy("month");
            try {
              await finishMonth(month);
            } finally {
              setBusy(null);
            }
          }}
        >
          <Receipt className="size-4" /> Close {formatMonth(month)}
        </Button>
      </div>

      {isLoading ? <Loading /> : null}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">Dog</th>
              {days.map((d) => {
                const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
                return (
                  <th
                    key={d}
                    className={cn(
                      "w-9 min-w-9 px-0 py-1 text-center text-xs font-normal",
                      wd === 0 && "text-muted-foreground",
                      d === today && "font-bold text-primary",
                    )}
                  >
                    <div>{WEEKDAY[wd]}</div>
                    <div>{Number(d.slice(8))}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right">Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((dog) => {
              const count = days.filter((d) => status.get(`${dog.id}|${d}`) === "present").length;
              return (
                <tr key={dog.id} className="border-t">
                  <td className="sticky left-0 z-10 max-w-32 truncate bg-card px-3 py-1 font-semibold">
                    {dog.name}
                  </td>
                  {days.map((d) => {
                    const s = status.get(`${dog.id}|${d}`);
                    const key = `${dog.id}|${d}`;
                    return (
                      <td key={d} className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(dog, d)}
                          disabled={busy === key}
                          aria-label={`${dog.name} ${d}: ${s === "present" ? "present" : "not marked"}`}
                          className={cn(
                            "grid size-8 place-items-center rounded-md border transition",
                            s === "present"
                              ? "border-success bg-success text-white"
                              : s === "scheduled"
                                ? "border-dashed border-primary bg-primary/5"
                                : "border-border hover:border-primary",
                            busy === key && "opacity-50",
                          )}
                        >
                          {s === "present" ? <Check className="size-4" /> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right font-semibold">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Dashed squares are days booked from the Schedule page. Changing a day in a month that is
        over updates that month's bill, unless it is already paid.
      </p>
    </>
  );
}
