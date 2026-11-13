# Monthly roster for the Attendance grid

## What changes for you
- Each dog gets a "Usually comes for" choice on the add/edit form: Day boarding, Home boarding, or Both (default Both).
- Dogs that have only ever had home stays (no day-boarding days) are set to "Home boarding" automatically, once.
- The Attendance grid shows only this month's roster instead of every dog.
- A "+ Add dog" button next to the month picker opens a searchable list of active dogs not already shown, grouped "Day boarders" then "Home boarders". Picking one adds them for that month only.
- A small menu (⋯) by each dog's name offers "Remove from [Month]":
  - Disabled with the tooltip "Undo attended days first" if the dog has any green (attended) days that month.
  - If the dog only has booked (dashed) days, you confirm first, then those bookings are deleted.
  - Removing never deletes the dog.
- Empty month: "No day boarders this month. Add a dog to get started."
- Billing, Close Month, the Schedule page and home boarding stay exactly as they are.

## Who appears for a month
Shown = (active dogs set to Day or Both) + (dogs with any booked or attended day that month) + (dogs added for that month) − (dogs removed for that month). Dogs set to Home never appear automatically.

## Technical details
- Migration:
  - `dogs.service_type text not null default 'both'` with check `in ('day','home','both')`; backfill `'home'` where the dog has rows in `stays` and none in `day_boarding`.
  - `day_boarding_roster(id uuid pk, dog_id uuid fk dogs on delete cascade, month text check '^\d{4}-\d{2}$', added_manually boolean not null default false, hidden boolean not null default false, created_at timestamptz default now())`, unique `(dog_id, month)`; grants to authenticated/service_role; RLS: admin all, owners read (same pattern as `day_boarding`).
- Add: upsert `{dog_id, month, added_manually: true, hidden: false}`. Remove: upsert `{hidden: true}` and, after confirmation, delete that month's `scheduled` `day_boarding` rows for the dog.
- New pure function `monthRoster({ month, dogs, records, roster })` in `src/lib/attendance.ts`, with tests in `attendance.test.ts` covering: home dogs excluded unless added/booked, hidden removes even with bookings, inactive dogs excluded unless they have records/roster rows.
- Note: a hidden dog with attended days can't exist via the UI (remove is disabled), but if it does, it is still shown so green days are never invisible.
- `Dog` type, `DogForm` (new select), `attendance.tsx` (header button using Command/Popover search, row menu using DropdownMenu + AlertDialog + Tooltip, empty state). `CheckInBoard` and billing untouched.
