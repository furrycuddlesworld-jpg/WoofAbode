import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Field, Pill } from "@/components/app/Common";
import { formatDate, formatINR, todayIST } from "@/lib/dates";
import { supabase } from "@/integrations/supabase/client";
import type { Expense } from "@/lib/types";

export function ExpensesPanel({ expenses, through }: { expenses: Expense[]; through: string }) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Spends</h3><Button variant="outline" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Add spend</Button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Expense</th><th className="p-2">Date</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th><th className="p-2">Paid on</th><th className="p-2" /></tr></thead><tbody>
      {expenses.map(e => <tr key={e.id} className="border-b"><td className="p-2"><div className="font-medium">{e.description}</div><div className="text-xs text-muted-foreground">{e.category} · {e.service === "all" ? "Shared" : e.service === "day" ? "Day boarding" : "Home boarding"}</div></td><td className="whitespace-nowrap p-2">{formatDate(e.incurred_on)}</td><td className="p-2 text-right tabular-nums">{formatINR(Number(e.amount))}</td><td className="p-2"><Pill tone={e.paid_on && e.paid_on <= through ? "green" : "amber"}>{e.paid_on && e.paid_on <= through ? "Paid" : "Unpaid"}</Pill></td><td className="whitespace-nowrap p-2">{e.paid_on && e.paid_on <= through ? `${formatDate(e.paid_on)} · ${e.method.toUpperCase()}` : "—"}</td><td className="p-2"><Button variant="ghost" size="icon" aria-label={`Edit ${e.description}`} onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="size-4" /></Button></td></tr>)}
      {!expenses.length ? <tr><td colSpan={6} className="py-6 text-muted-foreground">No spends recorded for this period.</td></tr> : null}
    </tbody></table></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit spend" : "Add spend"}</DialogTitle></DialogHeader>{open ? <ExpenseForm key={editing?.id ?? "new"} expense={editing} onSaved={() => setOpen(false)} /> : null}</DialogContent></Dialog>
  </div>;
}

function ExpenseForm({ expense, onSaved }: { expense: Expense | null; onSaved: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.incurred_on ?? todayIST());
  const [paid, setPaid] = useState(expense?.paid_on ? "paid" : "unpaid");
  const [paidOn, setPaidOn] = useState(expense?.paid_on ?? todayIST());
  const [category, setCategory] = useState(expense?.category ?? "other");
  const [service, setService] = useState<Expense["service"]>(expense?.service ?? "all");
  const [method, setMethod] = useState<Expense["method"]>(expense?.method ?? "cash");
  const [note, setNote] = useState(expense?.note ?? "");
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || Number(amount) <= 0) return;
    setBusy(true);
    try {
      const row = { description: description.trim(), amount: Number(amount), incurred_on: date, paid_on: paid === "paid" ? paidOn : null, category, service, method, note: note || null };
      const { error } = expense ? await supabase.from("expenses").update(row).eq("id", expense.id) : await supabase.from("expenses").insert(row);
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ["revenue"] });
      toast.success("Spend saved"); onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save spend"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
    <Field label="Expense"><Input aria-label="Expense description" required value={description} onChange={e => setDescription(e.target.value)} /></Field>
    <Field label="Amount (₹)"><Input aria-label="Expense amount" required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
    <Field label="Expense date"><Input aria-label="Expense date" required type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
    <Field label="Category"><Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Expense category"><SelectValue /></SelectTrigger><SelectContent>{["food", "supplies", "staff", "rent", "utilities", "vet", "transport", "other"].map(v => <SelectItem key={v} value={v}>{v[0]?.toUpperCase()}{v.slice(1)}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Service"><Select value={service} onValueChange={v => setService(v as Expense["service"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Shared / All</SelectItem><SelectItem value="day">Day boarding</SelectItem><SelectItem value="home">Home boarding</SelectItem></SelectContent></Select></Field>
    <Field label="Payment status"><Select value={paid} onValueChange={setPaid}><SelectTrigger aria-label="Expense payment status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent></Select></Field>
    {paid === "paid" ? <><Field label="Paid on"><Input aria-label="Expense paid on" required type="date" max={todayIST()} value={paidOn} onChange={e => setPaidOn(e.target.value)} /></Field><Field label="Method"><Select value={method} onValueChange={v => setMethod(v as Expense["method"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["cash", "upi", "bank", "other"].map(v => <SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>)}</SelectContent></Select></Field></> : null}
    <Field label="Note"><Input value={note} onChange={e => setNote(e.target.value)} /></Field>
    <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save spend"}</Button></div>
  </form>;
}