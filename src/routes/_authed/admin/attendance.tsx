import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { EmptyState, Loading, PageHeader } from "@/components/app/Common";
import { DayRateOverride } from "@/components/app/RateOverride";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { monthRoster } from "@/lib/attendance";
import {
  eachDate,
  firstDayOfMonth,
  formatMonth,
  lastDayOfMonth,
  monthOf,
  todayIST,
} from "@/lib/dates";
import { useDogs } from "@/lib/queries";
import type { DayBoarding, Dog, RosterRow } from "@/lib/types";
import { useAttendance } from "@/lib/useAttendance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/admin/attendance")({
  head: () => pageHead("Attendance", "Monthly WoofAbode attendance and individual special rates."),
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
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDog, setConfirmDog] = useState<Dog | null>(null);
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

  const { data: roster = [] } = useQuery({
    queryKey: ["attendance", "roster", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("day_boarding_roster")
        .select("*")
        .eq("month", month);
      if (error) throw new Error(error.message);
      return (data ?? []) as RosterRow[];
    },
  });

  const status = new Map(records.map((r) => [`${r.dog_id}|${r.date}`, r.status]));
  const dogById = new Map(dogs.map((d) => [d.id, d]));
  const rows = monthRoster({ dogs, records, roster })
    .map((id) => dogById.get(id))
    .filter((d): d is Dog => Boolean(d));
  const onGrid = new Set(rows.map((d) => d.id));
  const addable = dogs
    .filter((d) => d.active && !onGrid.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const addDay = addable.filter((d) => d.service_type !== "home");
  const addHome = addable.filter((d) => d.service_type === "home");

  function refreshRoster() {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }

  async function addDog(dog: Dog) {
    setAddOpen(false);
    const { error } = await supabase
      .from("day_boarding_roster")
      .upsert(
        { dog_id: dog.id, month, added_manually: true, hidden: false },
        { onConflict: "dog_id,month" },
      );
    if (error) return void toast.error(error.message);
    toast.success(`${dog.name} added to ${formatMonth(month)}`);
    refreshRoster();
  }

  async function removeDog(dog: Dog) {
    const { error } = await supabase
      .from("day_boarding_roster")
      .upsert({ dog_id: dog.id, month, hidden: true }, { onConflict: "dog_id,month" });
    if (error) return void toast.error(error.message);
    const booked = records.some((r) => r.dog_id === dog.id && r.status === "scheduled");
    if (booked) {
      const del = await supabase
        .from("day_boarding")
        .delete()
        .eq("dog_id", dog.id)
        .eq("status", "scheduled")
        .gte("date", from)
        .lte("date", to);
      if (del.error) return void toast.error(del.error.message);
    }
    toast.success(`${dog.name} removed from ${formatMonth(month)}`);
    refreshRoster();
  }

  function askRemove(dog: Dog) {
    const booked = records.some((r) => r.dog_id === dog.id && r.status === "scheduled");
    if (booked) setConfirmDog(dog);
    else void removeDog(dog);
  }

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
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Plus className="size-4" /> Add dog
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search dogs…" />
              <CommandList>
                <CommandEmpty>No dogs to add.</CommandEmpty>
                {addDay.length ? (
                  <CommandGroup heading="Day boarders">
                    {addDay.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={`${d.name} ${d.id}`}
                        onSelect={() => addDog(d)}
                      >
                        {d.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {addHome.length ? (
                  <CommandGroup heading="Home boarders">
                    {addHome.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={`${d.name} ${d.id}`}
                        onSelect={() => addDog(d)}
                      >
                        {d.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No day boarders this month. Add a dog to get started." />
      ) : (
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
                    <td className="sticky left-0 z-10 bg-card px-3 py-1 font-semibold">
                      <div className="flex max-w-40 items-center gap-1">
                        <span className="truncate">{dog.name}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 shrink-0"
                              aria-label={`Options for ${dog.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {count > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <DropdownMenuItem disabled>
                                        Remove from {formatMonth(month)}
                                      </DropdownMenuItem>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Undo attended days first</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <DropdownMenuItem onSelect={() => askRemove(dog)}>
                                Remove from {formatMonth(month)}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                    {days.map((d) => {
                      const s = status.get(`${dog.id}|${d}`);
                      const key = `${dog.id}|${d}`;
                      const record = records.find(r => r.dog_id === dog.id && r.date === d);
                      return (
                        <td key={d} className="p-0.5 text-center">
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => toggle(dog, d)}
                            disabled={busy === key}
                            aria-label={`${dog.name} ${d}: ${s === "present" ? "present" : "not marked"}`}
                            className={cn(
                              "grid size-8 place-items-center rounded-md border transition",
                              s === "present"
                                ? "border-success bg-success text-success-foreground hover:bg-success/90"
                                : s === "scheduled"
                                  ? "border-dashed border-primary bg-primary/5"
                                  : "border-border hover:border-primary",
                              busy === key && "opacity-50",
                            )}
                          >
                            {s === "present" ? <Check className="size-4" /> : null}
                          </Button>
                          {s === "present" ? <DayRateOverride dogId={dog.id} parentId={dog.owner_id} date={d} value={record?.rate_override ?? null} /> : <div className="h-5" />}
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
      )}
      <AlertDialog open={Boolean(confirmDog)} onOpenChange={(o) => !o && setConfirmDog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {confirmDog?.name} from {formatMonth(month)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their booked days this month will be deleted. The dog itself is not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDog) void removeDog(confirmDog);
                setConfirmDog(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="mt-2 text-xs text-muted-foreground">
        Dashed squares are days booked from the Schedule page. Changing a day in a month that is
        over updates that month's bill, unless it is already paid.
      </p>
    </>
  );
}
