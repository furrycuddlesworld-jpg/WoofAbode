import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { BillView } from "@/components/app/BillView";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authed/bills/$billId")({
  head: () => pageHead("Bill details", "Review your WoofAbode charges, dated rates and payments."),
  component: BillPage,
});

function BillPage() {
  const { billId } = Route.useParams();
  const { isAdmin } = useAuth();
  return (
    <>
      <Link
        to={isAdmin ? "/admin/bills" : "/bills"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground print:hidden"
      >
        <ArrowLeft className="size-4" /> Back to bills
      </Link>
      <BillView billId={billId} />
    </>
  );
}
