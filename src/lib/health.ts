import { daysBetween, todayIST } from "./dates";
import type { HealthRecord } from "./types";

export type DueState = "overdue" | "due_soon" | "ok" | "none";

/** Status of a vaccination or deworming by its next due date. "Due soon" = within 30 days. */
export function dueState(nextDue: string | null, today: string = todayIST()): DueState {
  if (!nextDue) return "none";
  const days = daysBetween(today, nextDue);
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "ok";
}

export function dueLabel(nextDue: string | null, today: string = todayIST()): string {
  if (!nextDue) return "No due date";
  const days = daysBetween(today, nextDue);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  return `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export const DUE_TONE = { overdue: "red", due_soon: "amber", ok: "green", none: "gray" } as const;

/** Latest record per (kind, name), so an older vaccine entry doesn't raise a false alarm. */
export function latestRecords(records: HealthRecord[]): HealthRecord[] {
  const byKey = new Map<string, HealthRecord>();
  for (const r of records) {
    if (r.kind === "health_report") continue;
    const key = `${r.dog_id}|${r.kind}|${r.name.trim().toLowerCase()}`;
    const prev = byKey.get(key);
    const rDate = r.date_given ?? r.created_at;
    const pDate = prev ? (prev.date_given ?? prev.created_at) : "";
    if (!prev || rDate > pDate) byKey.set(key, r);
  }
  return [...byKey.values()];
}

/** Reminder days before the due date, as Avi asked: 30, 10, 7 and on the day. */
export const REMINDER_DAYS = [30, 10, 7, 0] as const;

export const KIND_LABEL = {
  vaccination: "Vaccination",
  deworming: "Deworming",
  health_report: "Health report",
} as const;
