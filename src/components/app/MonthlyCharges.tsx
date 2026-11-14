import { formatDate, formatINR, formatMonth, monthOf, todayIST } from "@/lib/dates";
import { useDayBoarding, useRates, useStays } from "@/lib/queries";
import { revenueByService } from "@/lib/revenue";
import type { Dog } from "@/lib/types";

/** Running earned charges, not a saved bill or a payment balance. */
export function MonthlyCharges({ dog, compact = false }: { dog: Dog; compact?: boolean }) {
  const ids = [dog.id];
  const days = useDayBoarding(ids);
  const stays = useStays(ids);
  const rates = useRates(ids);
  const today = todayIST();
  const month = monthOf(today);

  if (days.isError || stays.isError || rates.isError) {
    return <p className="mt-3 text-sm text-destructive">Monthly charges could not be loaded.</p>;
  }
  if (days.isPending || stays.isPending || rates.isPending) {
    return <p className="mt-3 text-sm text-muted-foreground">Loading monthly charges…</p>;
  }
  const charges = revenueByService({
    from: `${month}-01`, to: today, today, dogs: [dog],
    rates: rates.data, days: days.data, stays: stays.data, bills: [], payments: [],
  });
  const amount = (category: typeof charges.total) =>
    category.missing.length ? "Rate pending" : formatINR(category.generated);

  return (
    <section aria-label={`${dog.name} monthly charges`} className={compact ? "mt-3 border-t pt-3" : "border-y py-4"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">So far this month</h3>
        <span className="text-lg font-bold tabular-nums">{amount(charges.total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{formatMonth(month)} · through {formatDate(today)}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3"><dt>Day boarding</dt><dd className="tabular-nums">{amount(charges.day)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Full boarding</dt><dd className="tabular-nums">{amount(charges.home)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Charges to date, not a final bill. Payments and advances are not deducted.</p>
    </section>
  );
}