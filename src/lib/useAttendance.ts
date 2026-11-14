import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { closeMonth, generateBill } from "./bills";
import { formatMonth, isLastDayOfMonth, monthOf, todayIST } from "./dates";
import type { Dog } from "./types";

/** Marks day boarders in or out. On the last day of the month this also creates the parent's bill. */
export function useAttendance() {
  const queryClient = useQueryClient();

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-day"] });
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["day-boarding"] });
  }

  // Bills follow attendance on the last day of a month, and for fixes to a month that is over.
  async function billIfMonthEnd(dogs: Dog[], date: string) {
    if (!isLastDayOfMonth(date) && monthOf(date) >= monthOf(todayIST())) return;
    const parents = [...new Set(dogs.map((d) => d.owner_id).filter(Boolean))] as string[];
    for (const pid of parents) {
      const res = await generateBill(pid, monthOf(date));
      if (res.ok) res.warnings.forEach((w) => toast.warning(w));
      else toast.error(res.reason);
    }
    if (parents.length) {
      toast.success(`${formatMonth(monthOf(date))} bill${parents.length === 1 ? "" : "s"} updated`);
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    }
  }

  /** present = true marks the dogs in; false takes the mark off (they are not billed for the day). */
  async function setPresent(dogs: Dog[], date: string, present: boolean) {
    if (dogs.length === 0) return;
    const ids = dogs.map((d) => d.id);
    const { error } = present
      ? await supabase.from("day_boarding").upsert(
          ids.map((dog_id) => ({
            dog_id,
            date,
            status: "present" as const,
            marked_at: new Date().toISOString(),
          })),
          { onConflict: "dog_id,date" },
        )
      : await supabase.from("day_boarding").delete().eq("date", date).in("dog_id", ids);
    if (error) return void toast.error(error.message);
    refresh();
    await billIfMonthEnd(dogs, date);
  }

  async function finishMonth(month: string) {
    const res = await closeMonth(month);
    if (res.error) return void toast.error(res.error);
    res.warnings.forEach((w) => toast.warning(w));
    toast.success(
      `${res.made} ${formatMonth(month)} bill${res.made === 1 ? "" : "s"} ready. Paid bills were not changed.`,
    );
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  }

  return { setPresent, finishMonth };
}
