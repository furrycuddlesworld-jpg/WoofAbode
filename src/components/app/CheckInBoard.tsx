import { useQuery } from "@tanstack/react-query";
import { Check, CheckCheck, Receipt } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/app/Common";
import { DogAvatar } from "@/components/app/DogAvatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkInGroups } from "@/lib/attendance";
import { addDays, formatMonth, isLastDayOfMonth, monthOf } from "@/lib/dates";
import { useRates } from "@/lib/queries";
import type { DayBoarding, Dog } from "@/lib/types";
import { useAttendance } from "@/lib/useAttendance";
import { cn } from "@/lib/utils";

/** One-tap day-boarding check-in: tap a dog's photo when it arrives, tap again to undo. */
export function CheckInBoard({ date, dogs }: { date: string; dogs: Dog[] }) {
  const { setPresent, finishMonth } = useAttendance();
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const dogById = new Map(dogs.map((d) => [d.id, d]));
  const { data: rates = [] } = useRates(dogs.map((d) => d.id));
  const { data: records = [] } = useQuery({
    queryKey: ["attendance", "board", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_boarding")
        .select("*")
        .gte("date", addDays(date, -28))
        .lte("date", date);
      if (error) throw new Error(error.message);
      return (data ?? []) as DayBoarding[];
    },
  });

  const here = new Set(
    records.filter((r) => r.date === date && r.status === "present").map((r) => r.dog_id),
  );
  const { expected, others } = checkInGroups({ date, dogs, records, rates });
  const waiting = expected.filter((id) => !here.has(id));
  // Walk-ins that are already marked stay visible even when the rest of the list is folded away.
  const shownOthers = showAll ? others : others.filter((id) => here.has(id));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  function toggle(id: string) {
    const dog = dogById.get(id);
    if (!dog || busy) return;
    void run(id, () => setPresent([dog], date, !here.has(id)));
  }

  function tiles(ids: string[]) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {ids.map((id) => {
          const dog = dogById.get(id);
          const on = here.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              disabled={busy === id}
              aria-pressed={on}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border-2 bg-card p-3 transition active:scale-95",
                on ? "border-success bg-success/10" : "border-border hover:border-primary",
                busy === id && "opacity-60",
              )}
            >
              <DogAvatar
                path={dog?.photo_path ?? null}
                name={dog?.name ?? ""}
                className={cn("size-16", !on && "opacity-70")}
              />
              <span className="w-full truncate text-center text-sm font-semibold">{dog?.name}</span>
              <span
                className={cn(
                  "text-xs",
                  on ? "font-semibold text-success" : "text-muted-foreground",
                )}
              >
                {on ? "Here" : "Tap when here"}
              </span>
              {on ? (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-success text-white">
                  <Check className="size-4" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {here.size} here{expected.length ? ` · ${waiting.length} expected still to come` : ""}
        </span>
        <div className="flex-1" />
        {waiting.length ? (
          <Button
            size="sm"
            disabled={Boolean(busy)}
            onClick={() =>
              run("all", () =>
                setPresent(
                  waiting.map((id) => dogById.get(id)).filter(Boolean) as Dog[],
                  date,
                  true,
                ),
              )
            }
          >
            <CheckCheck className="size-4" /> All expected are here
          </Button>
        ) : null}
        {isLastDayOfMonth(date) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => run("month", () => finishMonth(monthOf(date)))}
          >
            <Receipt className="size-4" /> Close {formatMonth(monthOf(date))}
          </Button>
        ) : null}
      </div>

      {expected.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Expected</h3>
          {tiles(expected)}
        </div>
      ) : null}

      {shownOthers.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            {showAll ? "Other dogs" : "Walk-ins"}
          </h3>
          {tiles(shownOthers)}
        </div>
      ) : null}

      {expected.length === 0 && others.length === 0 ? (
        <EmptyState title="No day boarders yet">
          Dogs show up here once they have a day-boarding rate or past visits.
        </EmptyState>
      ) : null}

      {others.length > shownOthers.length || showAll ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? "Show fewer dogs"
            : `Someone else came? Show all day boarders (${others.length})`}
        </Button>
      ) : null}
    </div>
  );
}
