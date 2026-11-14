import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";

import { BillStatusPill } from "@/components/app/BillView";
import { EmptyState, Loading, PageHeader } from "@/components/app/Common";
import { useAuth } from "@/lib/auth";
import { formatINR, formatMonth } from "@/lib/dates";
import { useBills } from "@/lib/queries";

export const Route = createFileRoute("/_authed/bills/")({
  head: () => pageHead("My bills", "Your monthly WoofAbode bills and receipts."),
  component: BillsPage,
});

function BillsPage() {
  const { session, isApproved } = useAuth();
  const { data: bills = [], isLoading } = useBills(session?.user.id);
  return (
    <>
      <PageHeader title="Bills" subtitle="Your monthly bills and receipts" />
      {!isApproved ? <EmptyState title="Bills appear once your account is approved" /> : null}
      {isLoading ? <Loading /> : null}
      {isApproved && !isLoading && bills.length === 0 ? (
        <EmptyState icon={<Receipt className="size-8" />} title="No bills yet">
          Your bill is made at the end of each month.
        </EmptyState>
      ) : null}
      <div className="space-y-2">
        {bills.map((b) => (
          <Link
            key={b.id}
            to="/bills/$billId"
            params={{ billId: b.id }}
            className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:border-primary"
          >
            <div className="flex-1">
              <div className="font-semibold">{formatMonth(b.month)}</div>
              <div className="text-sm text-muted-foreground">Bill #{b.bill_number}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{formatINR(Number(b.total))}</div>
              <BillStatusPill status={b.status} />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
