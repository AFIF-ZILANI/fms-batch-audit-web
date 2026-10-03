# QA summary: Sonali Batch Audit (2026-10-03)

Combined result of four test passes. Read this first; the detail (reproduction steps, evidence, screenshots) is in the four reports.

| # | Report | Method | Findings |
|---|---|---|---|
| 01 | [programmatic-db-api](01-programmatic-db-api.md) | ~265 SQL/REST attacks against the schema, RLS, auth, views, concurrency, load | 1 Critical, 5 High, 9 Medium, 5 Low, 3 Info |
| 02 | [static-review](02-static-review.md) | Full read of `src/`, migration, docs; `npm audit`; bundle and git-history secret scan; reproductions in a scratch Postgres | 3 High, 18 Medium, 19 Low, 3 Info |
| 03 | [visual-core](03-visual-core.md) | Real browser, phone/tablet/desktop: login, home, batches, master data, nav | 4 High, 7 Medium, 9 Low, 2 Polish |
| 04 | [visual-forms-money](04-visual-forms-money.md) | Real browser: all 7 entry forms, entries, money, stock, checks, export, PWA; DB-verified calculations | 5 High, 9 Medium, 12 Low, 2 Polish |

Findings overlap between reports (the same problem seen from code, DB and UI). The list below de-duplicates them.

## How it was tested (and what that means)

- **Nothing was run against your live project.** A throwaway local Supabase (Docker, port 56321) was built from `supabase/migrations/…_init.sql`, loaded with `mock-data.sql`, and the app was pointed at it. The only live-project checks were read-only: auth settings (`/auth/v1/settings`) and the table grants.
- The local grants were set to **mirror the live project** (verified), so RLS was the only barrier, exactly as in production.
- Mock data: 4 batches (closed+sold, running, new, no-chicks), 9 items, 3 suppliers, 3 buyers, usage/mortality/weights, 3 sales with payments, and deliberately dirty rows for the Data checks page. Re-create it any time with `docs/test/mock-data.sql`.
- Everything the testers created was deleted again; table counts were back to baseline.
- **Not covered:** a real phone (safe-area insets, native keyboards, Bangla keyboard), screen readers, the deployed Vercel headers, email delivery (local mailer is off), the `redirect_to` allow-list, and >1000-row volumes in the UI.

## Fix first (in this order)

### P0: do today, no code needed
1. **Turn off public sign-up.** Supabase Dashboard → Authentication → Sign In / Providers → Email → disable "Allow new users to sign up". It is currently **on** (`disable_signup: false`, checked live). Because every table policy is `using (true)`, anyone who signs up gets full read, write and delete of all farm data (AUTH-01/SEC-01, reproduced). Also raise the minimum password length (6 is accepted, `123456` worked) and consider disabling anonymous sign-ins.
2. After that, change your login password (it was shared in chat).

### P1: close the data-integrity holes (database)
New migration (and keep `supabase/migrations/` as the source of truth):

| Fix | Why | Reports |
|---|---|---|
| Owner-only RLS (allow-list by email / `app_metadata`), not `using (true)` | Defence in depth; makes P0 safe even if the toggle is flipped | 01 AUTH-01, 02 SEC-01 |
| Explicit `GRANT`s (authenticated only), `REVOKE` everything from `anon` | The migration has none, so it only works on this project through legacy defaults; `anon` currently holds TRUNCATE | 01 DB-01/02, 03 VIS-01 |
| CHECKs reject `NaN`; sane date bounds | `'NaN'` passes every `> 0` check and turns a batch's cost/FCR into NaN; `0001-01-01`/`-infinity` accepted | 01 BIZ-01/09, 04 FRM-06 |
| Usage trigger: also fire on `is_void`, re-validate returns vs issues on every change, restore re-validates (F-40) | Voiding an issue under a return or restoring a return leaves negative stock with no warning | 02 BIZ-01, 04 FRM-04, 01 BIZ-07 |
| Payment/bill rules in the DB: no edit of a bill below its paid amount, voiding a bill voids/blocks its payments in one transaction (RPC), lock to stop concurrent overpay/over-return | Today these are UI-only or racy (reproduced: 1,600 paid on a 1,000 bill) | 01 BIZ-02..06, 02 BIZ-04..06 |
| Moving-average (or FIFO) issue costing; make `unit_cost` immutable | Batch costs under-allocate (৳50,000 of ৳5,00,000 unassigned in test); `unit_cost` is writable | 02 BIZ-02/03, 01 BIZ-06, MATH-01 |
| Replace the `OR` join in `v_bills` (union of three joins) | 20k bills = 58 s, API timeout is 8 s; five views cascade | 01 PERF-01 |
| Audit trail + no hard deletes on ledger tables (revoke DELETE, `updated_at`, audit table) | Any client can erase a payment with no trace | 01 AUD-01, 02 SEC-02 |
| Business rules in triggers: dead ≤ live, sold ≤ live, no entries on a closed batch, entry date within batch dates | Today only the browser stops these | 01 BIZ-08, 02 BIZ-08 |
| Use Asia/Dhaka for "today" in DB views | UTC `current_date` is off by a day 00:00–06:00 local | 01 MATH-02, 02 BIZ-10 |

### P2: bugs in the app that can corrupt or lose data (frontend)
1. **Payment form saves to the wrong bill** in ~3 of 8 loads (prefilled bill overwritten by the oldest unpaid) (04 FRM-01). Money-affecting.
2. **Edit forms open with blank dropdowns**, then Save fails or wipes the field (04 FRM-02). Blocks fixing a data check from its own link.
3. **Silent number mis-parsing**: `1,5` becomes 15, Bangla digits save a sale with *no* payment, `abc` becomes ৳0, `1.5` chicks becomes 1 (04 FRM-03, 02 FE-04). One shared `parseNumber` with Bangla-digit support and strict errors fixes all forms.
4. **Stale numbers after saving**: query keys not invalidated (`batch-summary`, `today-counts`, `money-strip`, `payments`; `chick_purchases` vs `chick-purchases`) (02 FE-01/02, 04 FRM-07).
5. **UI preview ≠ DB** when extra decimals are typed (rate 100.456 × 20 kg: UI ৳2,009.12, DB ৳2,009.20) and 1 paisa off in ~1.7 % of sales (04 DATA-01, 02 BIZ-07). Round inputs to the column scale before computing.
6. **Batch form**: a spaces-only code saves as empty; the edit form can set a close date and bypass the "birds unaccounted for" confirmation (03 VIS-02/03).
7. **Enter key** in billing forms triggers "Save & add another" (04 FRM-08); updates matching 0 rows say "Saved" (02 FE-03).
8. **CSV formula injection** in all exports: prefix `=`, `+`, `-`, `@` cells with `'` (02 SEC-03, 03 VIS-10, 04 SEC-01).
9. Add a per-submit idempotency guard (duplicate submit makes a duplicate row via the API; double-click was OK in the UI).

### P3: usability, accessibility, polish
- Only the Usages list is reachable from the UI; no type switcher, no route to Payments/Sales/Mortality/Weights/Purchases lists (04 FRM-05, 02 UX-01; F-41 is "Must").
- Whole cards are `div onClick`: not keyboard-focusable; billing inputs have no accessible names (12 unlabeled controls on the sale form); tap targets 29–36 px (03/04 A11Y).
- Real 404 page; validate route ids (`/batches/abc` shows `invalid input syntax for type bigint`); map raw DB errors to plain messages; remove the "arrives in milestone a later" placeholder.
- Input length limits (a 300-char code makes the batches list 3,103 px wide); duplicate master names; items: unit does not change with category; no `tel:` link on suppliers/buyers (F-12).
- Logout should clear the query cache; offline navigation shows React Router's raw error page.
- Security headers (CSP, frame-ancestors, Referrer-Policy) in `vercel.json`; maskable PWA icon is identical to the plain one.
- Date format consistency (native `10/03/2026` vs `03 Oct 2026` vs ISO in reminders), hide raw ids ("Sale #20030").
- `supabase/.temp/` should be gitignored; `.env` keeps the service-role key and DB password beside the `VITE_` keys (not leaked, but keep it out of any shared folder).

## Verified working (good news)

- Anonymous access is fully blocked by RLS; JWT tampering (alg none, edited role, wrong secret) is rejected; all views are `security_invoker`; no `SECURITY DEFINER` functions; RPCs are not callable by `anon`.
- `npm audit`: 0 vulnerabilities. Only the publishable key is in the production bundle; no secrets in git history. All React output is escaped: XSS payloads rendered as plain text everywhere.
- Calculations (crates, deduction, net kg, amount, due, average weight, chick net price, KPIs, stock, supplier/buyer balances) matched independent SQL and hand calculation for all 4 mock batches, with no join fan-out (apart from the decimal cases above).
- Sequential overpay, returns above issued, un-voiding a payment under a voided bill, FK deletes, zero rates and discounts above total are all correctly blocked.
- Login redirect-back, logout, session persistence, wrong-password messaging (no enumeration in the login form), delete-with-reason + Undo + restore-with-payments, "Save & add another", double-click safety, full CSV/zip export (15 CSVs, UTF-8 BOM, row counts match the DB), Data checks counts match Home badge, no horizontal overflow at 768/1280/landscape/200 % zoom.

## Feature coverage

| Feature | Result |
|---|---|
| F-01 login, F-02 logout | Pass (token not cleared from cache on logout, VIS-09) |
| F-03 install to home screen | Partial: manifest + icons load; maskable icon not padded |
| F-10..F-15 master data | Partial: works; unit not tied to category, no `tel:` link, duplicate names allowed |
| F-20..F-25 batches | Partial: spaces-only code, close-date bypass |
| F-30..F-33 usage, return, mortality, weight | Partial: edit-form blank selects, comma/Bangla parsing |
| F-34..F-37 chick purchase, purchase, sale, payment | Partial: wrong-bill prefill race, parsing, decimal preview mismatch |
| F-38..F-40 edit / delete / restore | Partial: restore of a return not re-validated |
| F-41 browse entries | Partial: only usages reachable from the UI |
| F-50..F-54 home | Pass with stale numbers after saving |
| F-60..F-68 batch summary | Pass (numbers verified); chart has no axis labels |
| F-70..F-73 stock, money, party | Pass |
| F-80..F-83 checks, export, reminders | Pass; CSV formula injection |

## Re-running the tests

```bash
# local stack (needs Docker; uses ports 56321-56329, separate from other Supabase projects)
cd <scratch>/fms-local && supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,storage-api,postgres-meta,realtime
psql postgresql://postgres:postgres@127.0.0.1:56322/postgres -f docs/test/mock-data.sql
psql ... -c "grant all on all tables in schema public to anon, authenticated, service_role"   # mirror live grants
VITE_SUPABASE_URL=http://127.0.0.1:56321 VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key> npx vite --port 5199
```

Suggested next step: work through P0 → P1 → P2 in that order, one branch per group, re-running the relevant test report after each.
