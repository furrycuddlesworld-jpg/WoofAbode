// Runs once a day (8:00 India time) from a scheduled job. It:
// 1. sends vaccination and deworming reminders 30, 10 and 7 days before the due date and on the day
//    (in the app always; by email and WhatsApp when those are set up),
// 2. sends "your bill is ready" messages for new bills,
// 3. on the 1st of the month, tells the admin about day boarders whose bill for last month is missing.
//
// Secrets (Lovable Cloud > Secrets): RESEND_API_KEY and EMAIL_FROM for email; INTERAKT_API_KEY plus
// WHATSAPP_REMINDER_TEMPLATE and WHATSAPP_BILL_TEMPLATE for WhatsApp; APP_URL for links; CRON_SECRET (optional).

import { createClient } from "npm:@supabase/supabase-js@2";

const REMINDER_DAYS = [30, 10, 7, 0];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const env = (k: string) => Deno.env.get(k) ?? "";
const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const APP_URL = env("APP_URL").replace(/\/$/, "");

function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmt(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}
function monthName(month: string): string {
  return fmt(`${month}-01`).split(" ").slice(1).join(" ");
}

async function sendEmail(to: string, subject: string, text: string): Promise<string | null> {
  const key = env("RESEND_API_KEY");
  if (!key || !to) return "email not set up";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_FROM") || "WoofAbode <onboarding@resend.dev>", to, subject, text }),
  });
  return res.ok ? null : `email failed: ${res.status} ${await res.text()}`;
}

// WhatsApp through Interakt (an Indian WhatsApp Business API provider). Templates must be approved by Meta.
async function sendWhatsApp(phone: string, template: string, values: string[]): Promise<string | null> {
  const key = env("INTERAKT_API_KEY");
  if (!key || !template || !phone) return "whatsapp not set up";
  const digits = phone.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  const res = await fetch("https://api.interakt.ai/v1/public/message/", {
    method: "POST",
    headers: { Authorization: `Basic ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: local,
      type: "Template",
      template: { name: template, languageCode: "en", bodyValues: values },
    }),
  });
  return res.ok ? null : `whatsapp failed: ${res.status} ${await res.text()}`;
}

type Profile = { id: string; email: string; full_name: string; whatsapp: string | null; phone: string | null; whatsapp_opt_in: boolean };

async function sendReminders(today: string) {
  const dueDates = REMINDER_DAYS.map((d) => addDays(today, d));
  const { data: records, error } = await supabase
    .from("health_records")
    .select("id, dog_id, kind, name, date_given, next_due_date, created_at, dogs!inner(name, owner_id, active)")
    .in("kind", ["vaccination", "deworming"])
    .in("next_due_date", dueDates);
  if (error) throw error;

  let sent = 0;
  for (const r of records ?? []) {
    const dog = r.dogs as unknown as { name: string; owner_id: string | null; active: boolean };
    if (!dog.owner_id || !dog.active) continue;

    // Skip if a newer record of the same vaccine exists (it was already given again).
    const { count } = await supabase
      .from("health_records")
      .select("id", { count: "exact", head: true })
      .eq("dog_id", r.dog_id)
      .eq("kind", r.kind)
      .ilike("name", r.name.trim())
      .gt("date_given", r.date_given ?? "1900-01-01");
    if ((count ?? 0) > 0) continue;

    const daysBefore = REMINDER_DAYS.find((d) => addDays(today, d) === r.next_due_date) ?? 0;
    const { data: owner } = await supabase.from("profiles").select("*").eq("id", dog.owner_id).single();
    const p = owner as Profile;
    const what = `${dog.name}'s ${r.name} (${r.kind === "vaccination" ? "vaccination" : "deworming"})`;
    const when = daysBefore === 0 ? "is due today" : `is due in ${daysBefore} days, on ${fmt(r.next_due_date as string)}`;
    const message = `${what} ${when}. Please upload the new record in the WoofAbode app once it's done.`;

    const channels: [string, () => Promise<string | null>][] = [
      [
        "in_app",
        async () => {
          const { error } = await supabase
            .from("notifications")
            .insert({ user_id: p.id, title: `Reminder: ${what}`, body: message, link: `/dogs/${r.dog_id}` });
          return error ? error.message : null;
        },
      ],
      ["email", () => sendEmail(p.email, `Reminder: ${what} ${daysBefore === 0 ? "is due today" : "is coming up"}`, `Hi ${p.full_name || "there"},\n\n${message}\n\n${APP_URL}\n\nWoofAbode`)],
    ];
    if (p.whatsapp_opt_in) {
      channels.push([
        "whatsapp",
        () => sendWhatsApp(p.whatsapp || p.phone || "", env("WHATSAPP_REMINDER_TEMPLATE"), [p.full_name || "there", what, when]),
      ]);
    }

    for (const [channel, send] of channels) {
      // Claim the reminder first so it can never be sent twice.
      const { error: claimErr } = await supabase
        .from("reminder_log")
        .insert({ health_record_id: r.id, due_date: r.next_due_date, days_before: daysBefore, channel });
      if (claimErr) continue; // already sent
      const err = await send();
      if (err) {
        await supabase
          .from("reminder_log")
          .update({ status: err.includes("not set up") ? "skipped" : "failed", error: err })
          .match({ health_record_id: r.id, due_date: r.next_due_date, days_before: daysBefore, channel });
      } else sent += 1;
    }
  }
  return sent;
}

async function sendNewBills() {
  const { data: bills } = await supabase.from("bills").select("*").is("sent_at", null);
  let sent = 0;
  for (const b of bills ?? []) {
    if (Number(b.total) <= 0) {
      await supabase.from("bills").update({ sent_at: new Date().toISOString() }).eq("id", b.id);
      continue;
    }
    const { data: owner } = await supabase.from("profiles").select("*").eq("id", b.parent_id).single();
    const p = owner as Profile;
    const amount = `₹${Math.round(Number(b.total)).toLocaleString("en-IN")}`;
    const link = `${APP_URL}/bills/${b.id}`;
    await sendEmail(
      p.email,
      `Your WoofAbode bill for ${monthName(b.month)}`,
      `Hi ${p.full_name || "there"},\n\nYour bill for ${monthName(b.month)} is ready: ${amount}.\nView it and pay by UPI here: ${link}\n\nWoofAbode`,
    );
    if (p.whatsapp_opt_in) {
      await sendWhatsApp(p.whatsapp || p.phone || "", env("WHATSAPP_BILL_TEMPLATE"), [p.full_name || "there", monthName(b.month), amount, link]);
    }
    await supabase.from("bills").update({ sent_at: new Date().toISOString() }).eq("id", b.id);
    sent += 1;
  }
  return sent;
}

async function checkMissingBills(today: string) {
  if (!today.endsWith("-01")) return 0;
  const month = addDays(today, -1).slice(0, 7);
  const { data: days } = await supabase
    .from("day_boarding")
    .select("dog_id, dogs!inner(owner_id)")
    .eq("status", "present")
    .eq("imported", false)
    .gte("date", `${month}-01`)
    .lte("date", addDays(today, -1));
  const parents = new Set((days ?? []).map((d) => (d.dogs as unknown as { owner_id: string | null }).owner_id).filter(Boolean));
  const { data: bills } = await supabase.from("bills").select("parent_id").eq("month", month);
  const billed = new Set((bills ?? []).map((b) => b.parent_id));
  const missing = [...parents].filter((p) => !billed.has(p));
  if (missing.length === 0) return 0;
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  for (const a of admins ?? []) {
    await supabase.from("notifications").insert({
      user_id: a.user_id,
      title: `${missing.length} day boarder bill${missing.length === 1 ? "" : "s"} missing for ${monthName(month)}`,
      body: "The last day of the month wasn't marked for them. Open Bills and tap \"Create bills for this month\".",
      link: "/admin/bills",
    });
  }
  return missing.length;
}

Deno.serve(async (req) => {
  const secret = env("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const today = todayIST();
    const reminders = await sendReminders(today);
    const bills = await sendNewBills();
    const missing = await checkMissingBills(today);
    return Response.json({ ok: true, today, reminders, bills, missing });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
