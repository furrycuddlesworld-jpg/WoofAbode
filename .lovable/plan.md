# Edit a rate entry in place, as one row

## What you'll see on a dog's Rates tab
- The extra Edit button I just added, and the way it refilled the "Set new rates" form, are removed.
- The history list shows **one row per start date** with Day, Night and Same day side by side, the way your published site shows it. It no longer splits into separate lines per service.
- Each row gets an **Edit** button. Tapping it turns that row's date and three rates into boxes right in the row, with **Save** and **Cancel**.
- Saving changes that same entry. It does not delete it or add a new line. Clearing a box removes just that one rate from the entry.
- Bills you've already created keep their amounts. Any charges not yet billed are worked out again with the edited rate and date. That includes the dashboard's "To be billed" amount.
- "Set new rates" at the top still adds a new entry, for when a rate genuinely changes from a date onwards.

## Technical details
- Remove the `editing`/`startEdit` form-prefill code from `RatesPanel.tsx`.
- Add a `groupRateRows()` helper in `dog-rates.ts` that merges the day, home and legacy same-day rows into one row per dog and date, keeping the newest value per service. A test covers it.
- Database change: allow admins to UPDATE and DELETE `dog_rates` rows. This relaxes the "append-only" rule for corrections only, so adding a new rate still means adding a new row. Record this in `AGENTS.md`.
- Inline save:
  1. Update the newest `dog_rates` row for each service at that date: its rate, and its `effective_from` if the date changed.
  2. Remove any older duplicate rows at that date.
  3. Insert a row if a rate was blank before.
  4. Update the legacy `rates` row's same-day rate and date.
  - The `sync_dog_rate_cache` trigger currently runs only on INSERT. Extend it to UPDATE and DELETE so the dog's current rate stays correct.
- If the new date clashes with another entry, the save is blocked with "An entry already exists for this date".
