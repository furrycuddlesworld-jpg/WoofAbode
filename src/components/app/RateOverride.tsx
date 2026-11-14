import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeIndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { generateBill } from "@/lib/bills";
import { monthOf } from "@/lib/dates";

export function DayRateOverride({ dogId, parentId, date, value }: { dogId: string; parentId: string | null; date: string; value: number | null }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(value == null ? "" : String(value));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function save() {
    setBusy(true);
    try {
      const { error } = await supabase.from("day_boarding").update({ rate_override: amount === "" ? null : Number(amount), override_reason: reason || null }).eq("dog_id", dogId).eq("date", date);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["attendance"] });
      await qc.invalidateQueries({ queryKey: ["revenue"] });
      if (parentId) {
        const { data: bill } = await supabase.from("bills").select("id").eq("parent_id", parentId).eq("month", monthOf(date)).maybeSingle();
        if (bill) { const res = await generateBill(parentId, monthOf(date)); if (!res.ok) toast.warning(res.reason); }
      }
      await qc.invalidateQueries({ queryKey: ["bills"] });
      toast.success("Special rate saved"); setOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save special rate"); }
    finally { setBusy(false); }
  }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-5" aria-label={`Special rate ${date}`} title="Special rate"><BadgeIndianRupee className="size-3" /></Button></PopoverTrigger>
    <PopoverContent className="w-64 space-y-3">
      <h3 className="font-semibold">Special rate · {date}</h3>
      <Input aria-label="Special day rate" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Standard rate" />
      <Input aria-label="Special rate reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" />
      <Button disabled={busy} onClick={save}>Save</Button>
    </PopoverContent>
  </Popover>;
}