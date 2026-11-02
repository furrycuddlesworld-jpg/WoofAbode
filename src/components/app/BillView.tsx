import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, Field, Loading, Pill } from "@/components/app/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { upiLink } from "@/lib/billing";
import { generateBill } from "@/lib/bills";
import { formatDate, formatINR, formatMonth, todayIST } from "@/lib/dates";
import { useSettings } from "@/lib/queries";
import type { Bill, BillStatus, Payment, Profile } from "@/lib/types";

const BILL_TONE = { pending: "amber", partly_paid: "brown", paid: "green" } as const;
const BILL_LABEL = { pending: "Pending", partly_paid: "Partly paid", paid: "Paid" } as const;

export function BillStatusPill({ status }: { status: BillStatus }) {
  return <Pill tone={BILL_TONE[status]}>{BILL_LABEL[status]}</Pill>;
}

export function useBill(billId: string) {
  return useQuery({
    queryKey: ["bill", billId],
    queryFn: async () => {
      const { data: bill, error } = await supabase
        .from("bills")
        .select("*")
        .eq("id", billId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!bill) return null;
      const [{ data: parent }, { data: payments }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", (bill as Bill).parent_id)
          .maybeSingle(),
        supabase.from("payments").select("*").eq("bill_id", billId).order("created_at"),
      ]);
      return {
        bill: bill as Bill,
        parent: parent as Profile | null,
        payments: (payments ?? []) as Payment[],
      };
    },
  });
}

export function BillView({ billId }: { billId: string }) {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useBill(billId);
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();

  if (isLoading) return <Loading />;
  if (!data) return <EmptyState title="Bill not found" />;
  const { bill, parent, payments } = data;
  const balance = Math.max(0, Number(bill.total) - Number(bill.paid));
  const byDog = new Map<string, typeof bill.lines>();
  for (const l of bill.lines) byDog.set(l.dog_name, [...(byDog.get(l.dog_name) ?? []), l]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["bill", billId] });
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  };

  async function regenerate() {
    const res = await generateBill(bill.parent_id, bill.month);
    if (!res.ok) return void toast.error(res.reason);
    res.warnings.forEach((w) => toast.warning(w));
    toast.success("Bill recalculated");
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <div className="text-xl font-bold">{settings?.business_name ?? "WoofAbode"}</div>
            {settings?.business_address ? (
              <div className="text-sm text-muted-foreground">{settings.business_address}</div>
            ) : null}
            {settings?.business_phone ? (
              <div className="text-sm text-muted-foreground">{settings.business_phone}</div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {bill.status === "paid" ? "Receipt" : "Bill"} #{bill.bill_number}
            </div>
            <div className="text-sm text-muted-foreground">{formatMonth(bill.month)}</div>
            <div className="mt-1">
              <BillStatusPill status={bill.status} />
            </div>
          </div>
        </div>
        <div className="py-3 text-sm">
          <div className="text-muted-foreground">Billed to</div>
          <div className="font-semibold">{parent?.full_name || parent?.email}</div>
          {parent?.phone ? <div>{parent.phone}</div> : null}
        </div>

        {[...byDog.entries()].map(([dogName, lines]) => (
          <div key={dogName} className="border-t py-3">
            <div className="mb-1 font-semibold">{dogName}</div>
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-1 text-sm">
                <span>
                  {l.description}
                  <span className="text-muted-foreground"> × {formatINR(l.rate)}</span>
                </span>
                <span className="tabular-nums">{formatINR(l.amount)}</span>
              </div>
            ))}
          </div>
        ))}
        {bill.lines.length === 0 ? (
          <p className="border-t py-3 text-sm text-muted-foreground">No charges this month.</p>
        ) : null}

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatINR(Number(bill.subtotal))}</span>
          </div>
          {Number(bill.advance_applied) > 0 ? (
            <div className="flex justify-between">
              <span>Advance used</span>
              <span className="tabular-nums">−{formatINR(Number(bill.advance_applied))}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(Number(bill.total))}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <span className="tabular-nums">{formatINR(Number(bill.paid))}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance</span>
            <span className="tabular-nums">{formatINR(balance)}</span>
          </div>
        </div>
        {bill.has_estimate ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Lines marked "estimate" use tentative dates and may change when the stay ends.
          </p>
        ) : null}
        {payments.filter((p) => p.status === "confirmed").length > 0 ? (
          <div className="mt-4 border-t pt-3 text-sm">
            <div className="mb-1 font-semibold">Payments received</div>
            {payments
              .filter((p) => p.status === "confirmed")
              .map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>
                    {formatDate(p.paid_on)} · {p.method.toUpperCase()}
                    {p.upi_txn_id ? ` · ${p.upi_txn_id}` : ""}
                  </span>
                  <span className="tabular-nums">{formatINR(Number(p.amount))}</span>
                </div>
              ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print / save as PDF
        </Button>
        {isAdmin && bill.status !== "paid" ? (
          <Button variant="outline" onClick={regenerate}>
            <RefreshCw className="size-4" /> Recalculate
          </Button>
        ) : null}
      </div>

      {!isAdmin && balance > 0 ? (
        <PayWithUpi
          bill={bill}
          balance={balance}
          upiId={settings?.upi_id ?? null}
          payee={settings?.upi_payee_name ?? settings?.business_name ?? "WoofAbode"}
          onDone={refresh}
        />
      ) : null}
      {payments.some((p) => p.status === "to_confirm") && !isAdmin ? (
        <p className="rounded-xl bg-warning/20 p-3 text-sm print:hidden">
          Your payment is waiting for WoofAbode to confirm it.
        </p>
      ) : null}
      {isAdmin ? (
        <AdminPayments bill={bill} payments={payments} balance={balance} onDone={refresh} />
      ) : null}
    </div>
  );
}

function PayWithUpi({
  bill,
  balance,
  upiId,
  payee,
  onDone,
}: {
  bill: Bill;
  balance: number;
  upiId: string | null;
  payee: string;
  onDone: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [txn, setTxn] = useState("");
  const [amount, setAmount] = useState(String(balance));
  const link = upiId
    ? upiLink({
        upiId,
        payeeName: payee,
        amount: balance,
        note: `WoofAbode bill ${bill.bill_number}`,
      })
    : null;

  useEffect(() => {
    if (link) QRCode.toDataURL(link, { width: 220, margin: 1 }).then(setQr);
  }, [link]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("payments").insert({
      bill_id: bill.id,
      amount: Number(amount),
      method: "upi",
      upi_txn_id: txn.trim(),
      status: "to_confirm",
    });
    if (error) return void toast.error(error.message);
    toast.success("Thanks! WoofAbode will confirm your payment.");
    setTxn("");
    onDone();
  }

  if (!link) {
    return (
      <p className="rounded-xl bg-muted p-3 text-sm print:hidden">
        UPI payment details haven't been set up yet. Please pay WoofAbode directly.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 print:hidden">
      <h3 className="text-lg font-semibold">Pay {formatINR(balance)} with UPI</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          <Button asChild size="lg" className="w-full">
            <a href={link}>
              <Smartphone className="size-5" /> Open my UPI app
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">
            Works with GPay, PhonePe, Paytm and others. On a computer, scan the QR code with your
            phone. UPI ID: <b>{upiId}</b>
          </p>
        </div>
        {qr ? (
          <img src={qr} alt="UPI QR code" className="size-44 rounded-xl border bg-white p-2" />
        ) : null}
      </div>
      <form
        onSubmit={submit}
        className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
      >
        <Field label="After paying, enter the UPI transaction ID">
          <Input
            required
            value={txn}
            onChange={(e) => setTxn(e.target.value)}
            placeholder="e.g. 4123 5678 9012"
          />
        </Field>
        <Field label="Amount paid">
          <Input
            type="number"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Button type="submit">I've paid</Button>
      </form>
    </div>
  );
}

function AdminPayments({
  bill,
  payments,
  balance,
  onDone,
}: {
  bill: Bill;
  payments: Payment[];
  balance: number;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<Payment["method"]>("upi");
  const [date, setDate] = useState(todayIST());
  const [ref, setRef] = useState("");

  async function setStatus(p: Payment, status: Payment["status"]) {
    const { error } = await supabase.from("payments").update({ status }).eq("id", p.id);
    if (error) return void toast.error(error.message);
    toast.success(status === "confirmed" ? "Payment confirmed" : "Payment rejected");
    onDone();
  }

  async function record(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("payments").insert({
      bill_id: bill.id,
      amount: Number(amount),
      method,
      paid_on: date,
      upi_txn_id: ref || null,
      status: "confirmed",
    });
    if (error) return void toast.error(error.message);
    toast.success("Payment recorded");
    setRef("");
    onDone();
  }

  const toConfirm = payments.filter((p) => p.status === "to_confirm");

  return (
    <div className="space-y-4 print:hidden">
      {toConfirm.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-warning bg-warning/10 p-4">
          <h3 className="font-semibold">Payments to confirm</h3>
          {toConfirm.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm"
            >
              <span>
                {formatINR(Number(p.amount))} by UPI on {formatDate(p.paid_on)} · Txn {p.upi_txn_id}
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => setStatus(p, "confirmed")}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(p, "rejected")}>
                  Reject
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {balance > 0 ? (
        <form
          onSubmit={record}
          className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5 sm:items-end"
        >
          <h3 className="font-semibold sm:col-span-5">Record a payment</h3>
          <Field label="Amount">
            <Input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Method">
            <Select value={method} onValueChange={(v) => setMethod(v as Payment["method"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reference">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" />
          </Field>
          <Button type="submit">Record</Button>
        </form>
      ) : null}
    </div>
  );
}
