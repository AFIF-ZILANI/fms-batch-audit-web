# Phase 1: Programmatic DB / API break-test

Target: local throwaway Supabase stack (API :56321, Postgres :56322), schema `20261002000000_init.sql`, mock data (4 batches). Tester: hostile QA. SQL-level destructive tests ran inside `begin; ... rollback;` (a helper ran each case in a sub-transaction and reported ALLOWED / BLOCKED). Persisted rows (REST writes, race test, second user) were deleted afterwards (see Cleanup).

Environment notes
- The local stack initially had no table grants for `anon/authenticated/service_role` (new Supabase CLI default). The coordinator then mirrored the live grants (`grant all` to all three roles). After that, RLS is the only barrier, as in production. All REST results below are from after that.
- Local auth config (`enable_signup=true`, `minimum_password_length=6`, autoconfirm) may differ from live. Items marked (local) must be re-checked against the live project.

## Summary (sorted by severity)

| ID | Severity | Title |
|----|----------|-------|
| AUTH-01 | Critical | RLS is `using (true)` for every authenticated user; any self-signed-up user has full read/write/delete (and sign-up is open) |
| AUD-01 | High | No audit trail: hard DELETE of payments/usages/sales works, `created_at` is client-forgeable, history can be rewritten |
| BIZ-01 | High | `NaN` passes every `> 0` / `>= 0` CHECK (also via REST as the string "NaN"); one row blanks a batch's totals |
| AUTH-02 | High | Weak password policy: `123456` accepted, 1 char rejected only by the 6-char minimum, auto-confirmed, no email verification (local) |
| DB-01 | High | Migration has no GRANTs: on stacks with the new Supabase default privileges the app gets `permission denied` on every table |
| PERF-01 | High | `v_bills` joins with `OR`: nested loop, quadratic. 20k bills = 58 s; REST statement timeout is 8 s. Cascades into 5 other views |
| BIZ-02 | Medium | Race: two concurrent payments both pass the guard and overpay a bill |
| BIZ-03 | Medium | Race: two concurrent RETURNs both pass and drive net issued qty negative |
| BIZ-04 | Medium | Voiding a bill with live payments makes the payment vanish from every balance (supplier/buyer/batch) |
| BIZ-05 | Medium | Bills/purchases editable after payment/consumption with no re-validation (only caught after the fact by v_data_checks) |
| BIZ-06 | Medium | `usages.unit_cost` is directly writable via REST; the trigger does not fire on `is_void` flips or on unit_cost updates; stale costs |
| BIZ-07 | Medium | RETURN logic gaps (cut ISSUE below returns, void ISSUEs with a RETURN outstanding, move RETURN across batch, RETURN before ISSUE) |
| BIZ-08 | Medium | No cross-entity business rules: mortality/sales exceed live birds, closed batch accepts everything, any shed, unlimited usage vs stock, absurd weights |
| BIZ-09 | Medium | Extreme/infinite dates accepted; `-infinity` batch start makes `v_reminders` throw |
| AUTH-03 | Medium | No throttling on `/auth/v1/token`: 40 consecutive wrong logins all answered 400, never 429 (local) |
| DB-02 | Medium | `anon` holds full DML + TRUNCATE on every table/view (live and local-mirror). RLS blocks DML, but TRUNCATE is not subject to RLS; one policy mistake = public data |
| BIZ-10 | Low | Master data hygiene: duplicate codes by case/space/zero-width, empty codes, 10 MB text, `is_active` and item `unit_weight_kg`/`category` not protected |
| MATH-01 | Low | Costing is as-of-date average, stock value uses lifetime average: purchases != usage cost + stock value (up to 3.4k per item in mock data) |
| AUTH-04 | Low | Email enumeration: signup returns `user_already_exists`; recover differs between known/unknown email (500 vs 200 locally, SMTP artifact) |
| API-01 | Low | OpenAPI (`/rest/v1/`) readable with the public anon key: leaks all table/view/column names |
| MATH-02 | Low (suspected) | `current_date` is UTC; farm timezone ahead, reminders/age off by up to a day around midnight |
| API-02 | Info | Local JWT secret is the well-known CLI demo secret; forged HS256 token accepted (local only; confirm live differs) |
| API-03 | Info | PostgREST `max_rows=1000` and 8 s statement timeout on `authenticator`; lists silently truncate over 1000 rows (not reproduced, only 52 rows) |
| AUTH-05 | Info | recover `redirect_to` allow-list not testable (mailer errors locally) |

Counts: Critical 1, High 5, Medium 9, Low 5 (incl. 1 suspected), Info 3.

---

## AUTH-01 (Critical): any signed-up user is a full admin

Reproduce:
```
curl -s $API/auth/v1/signup -H "apikey: $ANON" -H 'Content-Type: application/json' -d '{"email":"attacker.qa@test.local","password":"123456"}'   # 200, access_token returned immediately
curl "$API/rest/v1/payments?select=*&limit=2" -H "apikey: $ANON" -H "Authorization: Bearer $T2"       # 200, real payments
curl "$API/rest/v1/v_supplier_balance" ...   # 200
curl -X POST $API/rest/v1/sheds -H "Authorization: Bearer $T2" ... -d '{"code":"QA-U2",...,"created_at":"2001-01-01T00:00:00Z"}'   # 201
curl -X POST $API/rest/v1/rpc/create_purchase ... -d '{...,"p_paid":10}'     # 200, bill + payment created
curl -X POST "$API/rest/v1/sheds?on_conflict=code" -H "Prefer: resolution=merge-duplicates,return=representation" -d '{"code":"S1","name":"HIJACKED","type":"GROWER"}'   # 200, existing shed renamed
```
Observed: second user (never invited) read all 12 tables and 8 views, inserted, updated (including overwriting an existing master row via upsert) and called RPCs. Policies are `for all to authenticated using (true) with check (true)` on all 12 tables. (Restored S1 afterwards.)
Matters: public sign-up is enabled on live, so anyone on the internet gets the farm's financial data and write access in two requests.
Fix: disable sign-ups (dashboard Auth > Providers > Email > "Allow new users to sign up" off, and `enable_signup=false` in config.toml); also restrict in the DB so it is safe even if sign-up is re-enabled:
```sql
create table app_users(user_id uuid primary key references auth.users on delete cascade);
insert into app_users select id from auth.users;           -- the one owner
create function is_app_user() returns boolean language sql stable security definer set search_path='' as
  $$ select exists(select 1 from public.app_users where user_id = (select auth.uid())) $$;
-- per table:
drop policy sheds_authenticated_all on sheds;
create policy sheds_app_user on sheds for all to authenticated using (is_app_user()) with check (is_app_user());
```
(and `revoke all on all tables in schema public from anon;`).

## AUD-01 (High): no audit trail, history is deletable/rewritable

Reproduce (SQL, same capability via REST DELETE/PATCH for any authenticated user):
- `delete from payments where id=3;` ALLOWED (buyer due jumps back to 389500). `delete from usages where id=1;` ALLOWED. `delete from payments where sale_id=1; delete from sales where id=1;` ALLOWED. The "void, never delete" model is only a UI convention. FK blocks deleting bills that still have payments, and deleting referenced masters/batches (verified OK below).
- `update payments set created_at='2001-01-01'` ALLOWED; REST insert with `"created_at":"2001-01-01T00:00:00Z"` accepted (201). `is_void` can be set true on insert (mortalities test, 201).
- `update batches set code='HACKED'` on a batch with history ALLOWED; `update items set unit_weight_kg=1` rewrote batch 5 feed_kg 7200 -> 6122 and FCR 1.98 -> 1.68; `update items set category='HUSK'` moved batch 5 feed cost out of feed_cost.
Matters: this is an audit app; nothing can later prove what the books said yesterday.
Fix: `revoke delete on all tables in schema public from authenticated;` (drop to soft-delete only), add `before update/delete` trigger rejecting changes to `created_at`/`id`, and an `audit_log` table fed by a generic `after insert/update/delete` trigger (`to_jsonb(old)/to_jsonb(new)`, `auth.uid()`, `now()`). Make `items.unit_weight_kg`/`category` immutable once any usage exists.

## BIZ-01 (High): NaN bypasses all CHECK constraints

Reproduce:
```
curl -X POST $API/rest/v1/usages -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"date":"2026-10-03","batch_id":7,"item_id":12,"qty":"NaN"}'
-> 201 {"qty":"NaN","signed_qty":"NaN","cost":"NaN"}
```
SQL (rolled back): purchases `qty='NaN'` and `unit_price='NaN'`, usages `qty='NaN'`, chick_purchases `rate='NaN'`, sales `rate='NaN'`, weights `total_weight_kg='NaN'`, items `unit_weight_kg='NaN'` all ALLOWED because `NaN > 0` is true in Postgres. Effects observed: `v_batch_summary.feed_cost = NaN`, `total_cost = NaN`, `chick_cost = NaN`, `v_item_stock.balance_qty/stock_value = NaN`, usage `unit_cost = NaN` (an issue made after a NaN-price purchase), `fcr_estimated = NaN`. `Infinity`, `1e30`, over-wide values are rejected (numeric field overflow), `NaN` gross_weight/`sales` crates cast errors (blocked, not silent).
Matters: a single typo/hostile row silently blanks batch totals and margin; PostgREST accepts the string form.
Fix: add `check (qty > 0 and qty <> 'NaN')` style constraints, or a domain: `create domain pos_num as numeric check (value > 0 and value <> 'NaN');` and use it for every numeric money/qty column; also forbid in the payments guard.

## AUTH-02 (High): weak passwords (local)

`signup {"password":"123456"}` -> 200 with session. `{"password":"a"}` -> 422 weak_password (only length < 6). `/auth/v1/settings`: `disable_signup:false`, `mailer_autoconfirm:true` (no email verification). `password_requirements=""`.
Fix: disable sign-up (AUTH-01), raise `minimum_password_length` to 12, enable leaked-password protection (Pro), require email confirmation.

## DB-01 (High): migration has no GRANT statements

Reproduce: fresh `supabase start` (CLI 2.109.1) then apply migration: `curl $API/rest/v1/sheds -H "Authorization: Bearer <valid user jwt>"` -> 403 `permission denied for table sheds` (`relacl` shows `authenticated=Dxtm` only; `service_role` equally locked out). Only the three RPCs get an explicit `grant execute`.
Matters: a new project/branch/fresh local stack is unusable until someone hand-grants; the repo's "source of truth" does not reproduce the live permissions.
Fix: add to the migration explicit least-privilege grants, e.g.
```sql
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;   -- no delete (see AUD-01)
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public revoke all on tables from anon;
```

## PERF-01 (High): v_bills quadratic join

`v_bills` ends with `left join paid pd on (bill_type='CHICKS' and ...) or (... ) or (...)`. The OR prevents hash/merge join. Generated load (rolled back): 20,000 sales + 20,000 payments, 50,000 usages, 50,000 mortalities, 5,000 weights, 200 batches.

| Query | Time |
|---|---|
| `select * from v_bills` | 57.8 s (`Nested Loop Left Join ... rows=20018`) |
| `select * from v_batch_summary` | 59.3 s |
| `v_batch_summary where id=6` | 56.4 s (no predicate pushdown through `money_in`) |
| `v_buyer_balance` | 57.0 s |
| `v_data_checks` | 57.4 s |
| `v_bills where party='BUYER' and party_id=4 limit 50` | 19.4 s |
| `v_supplier_balance` / `v_item_stock` / `v_reminders` / `v_batch_weights` | 62 ms / 16 ms / 24 ms / 5 ms |

Inserting 20k payments also took 18.4 s because `fn_payment_guard` uses `x is not distinct from y` (cannot use the per-bill indexes): quadratic as well (DB-04, folded here). Supabase `authenticator` role has `statement_timeout=8s`, so at this scale the dashboard just errors. A single farm will not hit 20k bills quickly, but cost grows with the square of bills: expect seconds at a few thousand.
Fix: pre-aggregate with a per-type key and `union all` instead of OR:
```sql
paid as (
  select 'CHICKS'::text t, chick_purchase_id id, sum(amount) paid, max(date) lpd from payments where not is_void and chick_purchase_id is not null group by 2
  union all select 'PURCHASE', purchase_id, sum(amount), max(date) from payments where not is_void and purchase_id is not null group by 2
  union all select 'SALE', sale_id, sum(amount), max(date) from payments where not is_void and sale_id is not null group by 2)
... left join paid pd on pd.t = b.bill_type and pd.id = b.bill_id
```
and in the guard use `where (new.sale_id is not null and sale_id = new.sale_id) or ...` branches per type (partial indexes `on payments(sale_id) where not is_void`).

## BIZ-02 (Medium): concurrent overpay race

Reproduce: created committed bill (purchase 1000.00, note QA-RACE), then two `psql` sessions: A `begin; insert payment 800; select pg_sleep(3); commit;` and B (1 s later) `begin; insert payment 800; commit;`.
Observed: both succeed; `bill amount 1000.00 paid 1600.00 due -600.00`; only `v_data_checks` ("Bill paid more than its amount") flags it. Cause: the guard `select sum(amount)` takes no lock.
Fix: lock the bill row in the guard: `perform 1 from purchases where id = new.purchase_id for update;` (equivalent for sales / chick_purchases) before summing. (Sequential overpay, raising amount and moving payments are correctly blocked.)

## BIZ-03 (Medium): concurrent over-return race

Same method on usages: committed ISSUE qty 10, two sessions each RETURN 8 -> both commit; net signed qty = -6.000. Fix: in `fn_usage_unit_cost` `perform pg_advisory_xact_lock(hashtext(new.batch_id||':'||new.item_id));` for RETURN (and edits of ISSUE).

## BIZ-04 (Medium): void a bill that has live payments

`update sales set is_void=true where id=3` ALLOWED while payment 5 (25,000) is live. Result: `v_buyer_balance` for that buyer = 0/0/0, `v_bills` hides it, 1 live payment attached to a voided sale; payments table has no view. Same for supplier: voiding purchase 4 (100,000 paid) -> supplier balance `paid` loses 100,000 and `due` rises by the full bill. Money out/in disappears from the books. (Un-voiding such a payment is correctly blocked.)
Fix: trigger on `is_void` true for the three bill tables that raises if a non-void payment exists (or voids them in the same statement), and add a `v_data_checks` row "Live payment on voided bill".

## BIZ-05 (Medium): bills editable after payment/consumption

No triggers on bills/purchases UPDATE. ALLOWED: `update sales set rate=1` after 380,000 received (due = -378,100); chick_purchases rate 55 -> 1 after 50,000 paid; purchases `qty` 60 -> 1 after 90 bags consumed (item balance only flagged by data checks); `price` change leaves usage `unit_cost` stale (usage 1 stays 3100.0000 while store avg becomes 2144.78); purchase `date` moved to 2026-12-31 after usages (not flagged: no check "usage before first purchase"); void purchase 1 while usages depend (flagged only if balance < 0). Also change batch_id of a sale/chick purchase (sale moved to the empty batch 8 ALLOWED).
Fix: `before update` trigger on bills: reject if `new.amount < paid` ; reject qty/price/date changes when non-void usages exist (or recompute and re-run unit_cost trigger for dependents); add a data check "usage dated before first purchase".

## BIZ-06 (Medium): unit_cost writable, trigger gaps

- REST `PATCH /usages?note=eq.X {"unit_cost":1}` -> 200, cost changed to 1.00 (trigger lists only `item_id,batch_id,date,kind,qty`). SQL: `update usages set unit_cost=0.0001` ALLOWED -> batch 5 cost silently changes. Insert with `unit_cost` supplied is correctly overwritten.
- `is_void` flips do not fire the trigger: void all purchases of an item, void a usage and un-void it -> ALLOWED (usage with no supporting purchase). Restoring a void RETURN after its ISSUEs are void ALLOWED (net -3.000, feed_bags in summary 19 for batch with all issues voided).
Fix: make `unit_cost` non-updatable (`revoke update (unit_cost) on usages from authenticated` plus trigger raising when `new.unit_cost is distinct from old.unit_cost` and none of the key columns changed) and extend the trigger to `before insert or update` (all columns) with an is_void un-void path.

## BIZ-07 (Medium): RETURN rule holes

ALLOWED: reduce ISSUE qty 17 -> 1 while a RETURN of 3 exists (net 106 vs. intended); void all ISSUEs with RETURN outstanding (net -3.000); `update usages set batch_id=6 where id=18` (move RETURN to another batch); flip RETURN->ISSUE and ISSUE->RETURN on existing rows (kind change on id 5 gave cost -51,000); RETURN dated 2000-01-01 before its ISSUE. Correctly BLOCKED: insert/raise RETURN above net issued, return item never issued, return after full return (0.001 extra).
Fix: re-validate on any UPDATE touching ISSUE rows (sum of returns <= sum of issues for the (batch,item)) and forbid changing `kind`/`batch_id`/`item_id` after insert.

## BIZ-08 (Medium): missing cross-entity rules

All ALLOWED: mortality 1,000,000 on a 1,500-bird batch (mortality_pct = 666.67 shown); mortality for batch with no chicks (pct NULL, live -5); mortality in archived/inactive shed or any shed (no shed-batch link); sale of 100,000 birds against live 1,494 (live_balance -98,506); sale/mortality/usage/chick purchase on a CLOSED batch (dated after close, or before start); sale of 1 bird at 1,000,000 kg; sale rate NaN; weight sample 1,000,000 on a 1,500 flock; avg weight 0.0 g; second chick purchase of 1,000,000,000 chicks to a batch; usage of 1,000,000 bags with stock 100 (stock_value -2.9 billion); usage on batch with no chicks; purchases with unit_price 0; usage on inactive item/supplier/shed (`is_active` unenforced); duplicate weights same date. Only partially surfaced later by `v_data_checks` (negative live balance, dated outside batch, stock < 0). Correctly blocked: sale discount > total, rate 0, discount > chick total, net weight <= 0, int overflows.
Fix: BEFORE INSERT triggers: reject dated outside `[start_date, close_date]`, reject on closed batch, require `birds <= live_balance`, reject inactive masters, add plausibility checks (`gross_weight_kg / total_birds between 0.05 and 8`, `avg_weight_g between 20 and 8000`).

## BIZ-09 (Medium): extreme dates

ALLOWED: `date '0001-01-01'`, `'9999-12-31'`, `'infinity'`, `'-infinity'` on batches, usages, purchases, sales, payments, mortalities. `insert into batches(code,start_date) values ('NINF','-infinity')` then `select * from v_reminders` -> ERROR 22008 `cannot subtract infinite dates` (suspected the same for `v_batch_summary.age_days`, not directly shown because my count(*) pruned the column). Start 0001-01-01 gives `age_days = 739,891`.
Fix: `check (date between '2020-01-01' and current_date + 30)` on every date column; batch check likewise.

## AUTH-03 (Medium, local): no login throttling

40 sequential wrong-password POSTs to `/auth/v1/token?grant_type=password` for the same email: all HTTP 400 `invalid_credentials`, none 429; correct password still 200 afterwards. Confirm live rate limits (dashboard Auth > Rate Limits); with one owner account, add CAPTCHA/lockout and a strong password.

## DB-02 (Medium): anon over-grant

`anon` holds SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES on every public table and view (live = local mirror). With RLS on, anon reads return `[]` and writes return 401 RLS violation (verified), but any future table without RLS (or `create view` without security_invoker) is instantly public; TRUNCATE is not subject to RLS. Same TRUNCATE privilege on `authenticated` (not reachable via PostgREST, reachable for any direct DB connection with that role).
Fix: `revoke all on all tables in schema public from anon; revoke truncate, trigger, references on all tables in schema public from authenticated; alter default privileges in schema public revoke all on tables from anon, authenticated;`.

## BIZ-10 (Low): master data hygiene

ALLOWED: `s1`, `'S1 '`, `'S1'+U+200B` beside `S1`; empty and whitespace-only code/name; U+202E (RTL override) + emoji code; 1 MB note, 10 MB name (K10: ~1 MB code blocked by btree 8191 limit); `<script>`/`<img onerror>` stored in names/notes (batch rows from another tester contain them: the UI must escape); item `unit_weight_kg='NaN'`. Blocked: NUL byte, FEED without weight, bad enum.
Fix: `check (code = upper(btrim(code)) and code ~ '^[A-Z0-9_-]{1,32}$')`, `unique(lower(code))`, `check (length(name) <= 200)`, `check (length(note) <= 2000)`.

## MATH-01 (Low): costing inconsistency

Usage `unit_cost` = average of purchases dated on/before the issue; `v_item_stock.avg_unit_cost` = lifetime average. Reconciliation `purchased - usage_cost - stock_value` per item: FD-01 3,073.02, FD-02 3,388.88, MED-02 -229.09, HSK-01 42.86 (others 0). Not an error in formula, but total cost + inventory does not equal spend.

## AUTH-04 (Low): enumeration

signup existing email -> 422 `user_already_exists`; new -> 200. login wrong password for existing vs non-existing email -> identical 400 (good). recover: existing -> 500 (SMTP failure, local artifact), unknown -> `{}` 200; on live with SMTP this should be identical, retest. Fix: with sign-up disabled this goes away.

## API-01 (Low): schema leak
`GET /rest/v1/` with only the anon key returns the Swagger doc: 21 paths, 20 definitions with column names. GraphQL: `pg_graphql extension is not enabled`. pg_catalog via REST: 404/406 (not exposed).

## MATH-02 (Low, suspected)
DB timezone is UTC; views use `current_date`. For a farm east of UTC the "today" boundary in reminders and `age_days` lags up to hours. Not reproduced with time travel.

## API-02 (Info)
Tokens re-signed with HS256 and the public CLI demo secret `super-secret-jwt-token-with-at-least-32-characters-long` were accepted by `/auth/v1/user` (and as `service_role` by REST). Local only; verify the live JWT secret/signing keys are not defaults and are rotated if ever exposed.

## API-03 (Info)
`max_rows=1000`; `Prefer: count=exact` returns `Content-Range: 0-51/52` correctly. Lists over 1000 rows would silently truncate unless paginated (`Range`). `authenticator` has `statement_timeout=8s`, `lock_timeout=8s`.

## AUTH-05 (Info)
`/auth/v1/recover?redirect_to=https://evil.example.com/steal` (and localhost, javascript:) all return 500 (no SMTP locally). The allow-list behaviour (`additional_redirect_urls=["https://127.0.0.1:3000"]`) could not be observed; re-test on a stack with a mailer.

---

## Verified OK (correctly blocked / correct)

- Unauthenticated (anon key) SELECT on all 12 tables and 8 views: `[]` (RLS); INSERT: 401 RLS violation; PATCH/DELETE: 0 rows affected; `create_purchase` as anon: 401 permission denied (EXECUTE revoked); trigger functions not exposed as RPC; `pg_catalog` schema and tables not exposed; GraphQL disabled.
- JWT: `alg none`, role claim tampered with original signature, wrong HS256 secret, expired claim with original signature all rejected (403 bad_jwt / PGRST301).
- Views are `security_invoker=true`; no `security definer` functions; `public` schema has no CREATE for anon/authenticated; extensions: plpgsql, uuid-ossp, pgcrypto, pg_stat_statements, supabase_vault, pg_net (nothing risky exposed).
- Mass assignment: inserting `id`, generated columns (`cost`, `amount`, `status`), updating `id`/`status` all rejected (428C9); supplied `unit_cost` on INSERT overwritten by trigger.
- Payments: single overpay, sequential overpay, raising amount, moving payment onto fully paid bill, party/bill mismatch (`payments_party`), two bills (`payments_one_bill`), amount 0.004, NaN payment amount, un-void after bill voided, payment to voided/nonexistent bill, RPC `p_paid` > net, negative `p_paid` (silently ignored, no payment created: Info).
- RETURN > net issued (insert and update), return of never-issued item, ISSUE before first purchase (insert and date update), item change to no-purchase item.
- Overflows (`1e30`, `Infinity`, qty*price overflow, integer overflow in counts), negative numbers, zero rates, discount > total, FK violations, delete of referenced masters/batches/sheds/bills with payments, duplicate exact codes, `close_date < start_date`, NUL byte, 1 MB code (index limit), invalid enum.
- v_batch_summary, v_item_stock, v_bills, v_supplier_balance, v_buyer_balance math matched independent recomputation for all 4 batches (placed, dead, sold, live, mortality, kg, sales, bags, feed kg, cost, margin, FCR, cost/kg, received/due) and all 18 bills, 3 suppliers, 3 buyers, 9 items. No fan-out with several payments on one bill (28,000 paid on bill with 2 live + 1 void payment, 1 row); void rows excluded; divide-by-zero guarded by `nullif` (batch 8 returns NULLs).

## Test coverage

| Area | Tests run | Findings |
|---|---|---|
| A. Auth/RLS/API (REST, auth endpoints, JWT) | ~85 requests (20 anon reads, 8 anon writes/RPC, 12 authed-user2 writes, 6 JWT variants, 9 auth-endpoint/rate/enumeration, openapi/graphql/catalog) | 9 (AUTH-01..05, API-01..03, DB-02) |
| B. Business rules (SQL, rolled back) | 154 cases + 2 concurrent race scenarios | 12 (AUD-01, BIZ-01..10) |
| C. View math | 6 recomputation groups, ~110 value comparisons, 1 fan-out probe | 2 (MATH-01, MATH-02 suspected) |
| D. Performance | 10 EXPLAIN ANALYZE on 200 batches / 50k usages / 20k sales+payments / 50k mortalities | 1 (PERF-01) |
| E. Other (grants, defaults, extensions, functions) | ~8 catalog checks | 1 (DB-01) |

Total about 265 tests, 24 findings (some tests covered multiple findings; "blocked" cases listed above).

## Cleanup

Persisted writes and their removal: race test rows (purchase, 2 payments, 3 usages, note QA-RACE-DELETE-ME) deleted; user2 REST rows (shed QA-U2, purchase + payment, 3 usages, mortality) deleted; existing shed S1 name changed by upsert-hijack test restored to 'Brooder 1'/BROODER. Second user `attacker.qa@test.local` deleted from `auth.users`. Everything else was rolled back (perf load, destructive SQL). Counts verified against baseline: purchases 13, usages 50, payments 6, sales 3, mortalities 74, weights 9, chick_purchases 3. Extra batches 221, 223-225 in `batches` and the 4 extra `v_data_checks` rows come from the other tester's UI session, not from this test. Sequences advanced (identity ids jumped) as a side effect. qa@test.local and the mock rows untouched.
