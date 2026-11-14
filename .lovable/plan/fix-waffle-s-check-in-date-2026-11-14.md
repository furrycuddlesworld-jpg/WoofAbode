# Fix Waffle's check-in date

## Why it showed one night
Waffle was booked for 10–16 Nov but marked as arrived on 13 Nov, so the app only counted the nights from 13 Nov onward (1 night so far = ₹1,500). Astro also arrived on 13 Nov, so one night at its special rate (₹1,700) is correct.

## Change
- Set Waffle's arrival date on the current stay to 10 Nov (same time of day as recorded).
- Nothing else changes. Astro stays as it is.

## Result
Waffle's earned amount for this stay will cover 4 nights so far (10, 11, 12, 13 Nov) at ₹1,500 = ₹6,000, and it will keep going up each night until check-out.

## Technical details
One data update on the `stays` row for Waffle (status in_progress, planned_start 2026-11-10): `actual_start = '2026-11-10 12:36:53+00'`. No code or schema changes. Then confirm on the dashboard's "By dog" tab.
