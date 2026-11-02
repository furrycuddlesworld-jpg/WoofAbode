import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { billAfterStayEnds } from "@/lib/bills";
import { formatMonth } from "@/lib/dates";
import type { Dog, StayRow } from "@/lib/types";

/** "Start boarding" / "End boarding" buttons for a home-boarding stay. */
export function StayActions({ stay, dog }: { stay: StayRow; dog: Dog | undefined }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stays"] });
    queryClient.invalidateQueries({ queryKey: ["admin-day"] });
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  };

  async function start() {
    const { error } = await supabase
      .from("stays")
      .update({ status: "in_progress", actual_start: new Date().toISOString() })
      .eq("id", stay.id);
    if (error) return void toast.error(error.message);
    toast.success(`${dog?.name ?? "Dog"} checked in`);
    refresh();
  }

  async function end() {
    const { data, error } = await supabase
      .from("stays")
      .update({
        status: "completed",
        actual_end: new Date().toISOString(),
        actual_start: stay.actual_start ?? new Date().toISOString(),
      })
      .eq("id", stay.id)
      .select("*")
      .single();
    if (error) return void toast.error(error.message);
    toast.success(`${dog?.name ?? "Dog"} checked out`);
    if (dog?.owner_id) {
      const results = await billAfterStayEnds(data as StayRow, dog.owner_id);
      for (const r of results) {
        if (r.ok) toast.success(`Bill for ${formatMonth(r.bill.month)} is ready`);
        else toast.warning(r.reason);
      }
    }
    refresh();
  }

  if (stay.status === "scheduled") {
    return (
      <Button size="sm" onClick={start}>
        <LogIn className="size-4" /> Start boarding
      </Button>
    );
  }
  if (stay.status === "in_progress") {
    return (
      <Button size="sm" variant="secondary" onClick={end}>
        <LogOut className="size-4" /> End boarding
      </Button>
    );
  }
  return null;
}
