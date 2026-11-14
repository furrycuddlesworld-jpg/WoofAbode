import { pageHead } from "@/lib/page-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";

import { EmptyState, Loading, PageHeader } from "@/components/app/Common";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/dates";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/notifications")({
  head: () => pageHead("Notifications", "Your WoofAbode boarding and payment updates."),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data as Notification[];
    },
  });

  // Opening the page marks everything as read.
  useEffect(() => {
    if (data.some((n) => !n.read)) {
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .then(() => queryClient.invalidateQueries({ queryKey: ["notifications-unread"] }));
    }
  }, [data, queryClient]);

  return (
    <>
      <PageHeader title="Notifications" />
      {isLoading ? <Loading /> : null}
      {!isLoading && data.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" />} title="Nothing yet" />
      ) : null}
      <div className="space-y-2">
        {data.map((n) => {
          const body = (
            <div className={cn("rounded-xl border bg-card px-4 py-3", !n.read && "border-primary")}>
              <div className="font-medium">{n.title}</div>
              {n.body ? <div className="text-sm text-muted-foreground">{n.body}</div> : null}
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDate(n.created_at.slice(0, 10))}
              </div>
            </div>
          );
          return n.link ? (
            <Link key={n.id} to={n.link} className="block">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
