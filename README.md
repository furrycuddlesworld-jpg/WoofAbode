# WoofAbode

The WoofAbode app for day boarding and home boarding. Pet parents keep their dog's profile, vet and
emergency contacts, and health records here, and see days boarded, upcoming boarding and monthly bills.
The admin console handles roles, scheduling, attendance, rates, bills, UPI payments and the history import.

## First-time setup

1. **Backend:** enable Lovable Cloud, then ask Lovable to run
   `supabase/migrations/20261102090000_woofabode_schema.sql`.
2. **Admin account:** the first account to sign up becomes the admin, so the owner signs up first.
3. **Settings:** in Admin > Settings, enter the UPI ID, business details and daily capacity.
4. **History:** in Admin > Import, upload `dogs.csv`, `day_boarding_attendance.csv` and
   `home_boarding_stays.csv`. Parents who later sign up with the email in `dogs.csv` get their dogs
   and are approved automatically.
5. **Rates:** check each dog's Rates tab (imported rates start on 1 Sep 2025).
6. **Reminders and bill messages:** add the secrets below, then run `supabase/schedule-daily-jobs.sql`
   (with the project URL and anon key filled in) to run `daily-jobs` every morning at 8:00 IST.

| Secret | What it's for |
| --- | --- |
| `APP_URL` | The app's web address, for links in messages |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email reminders and bills ([Resend](https://resend.com)) |
| `INTERAKT_API_KEY`, `WHATSAPP_REMINDER_TEMPLATE`, `WHATSAPP_BILL_TEMPLATE` | WhatsApp messages through Interakt, with Meta-approved templates |
| `CRON_SECRET` | Optional; if set, the scheduled call must send it in an `x-cron-secret` header |

## Billing rules

- Day boarding: days marked present × the dog's day rate on that day.
- Home boarding: nights × night rate. Each night is billed in the month it falls in. Tentative dates
  give an estimate; the actual start and end dates recorded by the admin give the final amount.
- Same-day stay: one flat same-day charge. Advances come off the bill. No GST.
- A day boarder's monthly bill is made when the admin marks attendance on the last day of the month.
  A parent with only home boarding that month is billed when the stay ends.

The rules live in `src/lib/billing.ts`, with tests in `src/lib/billing.test.ts`.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2d2e3e68-ca16-4c24-b43d-791cf2294f91).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
