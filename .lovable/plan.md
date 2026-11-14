# Show "To be billed" and "Realised" amounts on the Revenue & spends dashboard

## What you'll see
Three new numbers on the Revenue & spends dashboard, for the selected period and service filter:

- **Realised (earned)**: the value of all work actually done: green attended days plus home-boarding nights, priced at each dog's rate on that date, with special rates included. Bookings that didn't happen are left out.
- **Billed**: how much of that earned work is already on saved bills.
- **To be billed**: earned work that isn't on any bill yet (Realised minus Billed). This is the money you still need to send bills for.

A new **"To be billed"** tab lists each dog with unbilled work: dog, service, number of days or nights, dates, the rate used, and the amount. Any dog with no rate set is shown with "Set rate for <dog> first" and left out of the total, so the total is never understated without you knowing.

The "Received" and "To be paid" cards stay as they are. Together the cards read: Realised → Billed → Received → To be paid.

## Technical details
- `src/lib/finance.ts`: add `unbilledSummary({ dogs, attendance, stays, rates, bills, start, end })`. It runs the shared `calculateBill` over the period and excludes dates already covered by a saved bill for that dog and service, using the bill's period and line dates. It returns `{ realised, billed, toBeBilled, rows, missingRateDogs }`.
- `RevenueSummary.tsx`: add the stat cards and the "To be billed" tab, and reuse the existing period and service filters.
- Tests in `finance.test.ts`: (1) attended days not on a bill count as to be billed; (2) days on a saved bill don't count; (3) a rate change splits the amount correctly; (4) a dog with a missing rate shows up in missingRateDogs and is left out of the total.
- No database changes.
