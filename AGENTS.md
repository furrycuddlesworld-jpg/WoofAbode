<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Dog saves validate the current identity through the writing client's getUser; customer inserts use that identity and customer edits omit ownership to avoid stale-session reassignment.

Use dog_rates as the authoritative day/night pricing history: new rates append rows, admins may correct an entry in place (one display row per start date); legacy rates retain same-day pricing and mirror imports so historical dates remain billable.
Use calculateBill for earned revenue and billing, with explicit date bounds and missing-rate blocking; shared calculations prevent pricing drift.
Allocate confirmed bill payments proportionally to saved dog/service line amounts in revenue reports because existing payments belong to parent bills, not individual dogs.
Keep business expenses admin-only; paid_on is the source of paid status so expense amounts and payment dates cannot disagree.
Report saved bill totals separately from earned revenue; bill-period balances use confirmed payment history through the selected end date.
