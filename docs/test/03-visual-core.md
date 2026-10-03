# Visual QA - core pages (Phase 2, part 1)

Tester: Claude (Playwright MCP, Chromium). Local stack only: app http://localhost:5199, API 127.0.0.1:56321. No supabase.co request was ever seen.
Viewports: 390x844 (all pages), 768x1024 and 1280x800 (Home, Batch detail, Items), 844x390 landscape (Batch detail), 195x422 as a 200% zoom stand-in (Home, Batch detail). Chromium only.
Dev server (unbundled Vite), so page weight and timing figures are not production numbers.
Cleanup: every record I created was deleted again (4 test batches, 3 sheds, 2 items, 1 supplier); batch B-2026-09-05-01 was temporarily closed and edited and then restored. ID sequences moved on (batches 221 to 225 were burned).
An earlier run was blocked because the local DB role `authenticated` had no table grants. The coordinator applied grants, and the report below is the full run after that.

## Summary

| ID | Severity | Finding |
|---|---|---|
| VIS-01 | High | Migration contains no table/view GRANTs. Works on prod only through legacy default privileges; a fresh or local stack returns 403 on every query |
| VIS-02 | High | A batch code of only spaces is accepted and saved as an empty code (toast says "created"); an empty-code batch then shows in lists with a blank title |
| VIS-03 | High | Batch edit form can set a close date directly, bypassing the F-22 "birds unaccounted" confirmation (batch with 2,861 live birds closed with one tap) |
| A11Y-01 | High | Batch cards on Home, rows on Batches list and master-data cards are `div onClick`: not focusable, not reachable by keyboard, no role |
| VIS-04 | Medium | Raw database errors shown to the user: `/batches/abc` -> `invalid input syntax for type bigint: "NaN"`, `/batches/9999` -> `Cannot coerce the result to a single JSON object`, items with kg 1e9 -> `numeric field overflow`, kg 0.0001 -> check-constraint name, whitespace master name -> `null value in column "name"... violates not-null constraint` |
| VIS-05 | Medium | Unknown URL shows the dev placeholder "Page arrives in milestone a later (see docs/prd.md §8)" and not a 404 page. `/settings/unknown` and `/entries/foo` silently redirect to More |
| VIS-06 | Medium | No length limits: 300-char batch code and 500-char master name are accepted; the long code pushes the status badge off the card and makes the Batches "All" list scroll horizontally (scrollWidth 3103 vs 390) |
| VIS-07 | Medium | Offline in-app navigation to a not-yet-loaded route shows React Router's raw "Unexpected Application Error! Failed to fetch dynamically imported module". No errorElement; same crash after a new deploy if chunk names change |
| VIS-08 | Medium | Duplicate master names allowed (a second "Brooder 1" shed and a second "Starter feed" item were created). Batch codes are case-sensitive unique ("b-2026-09-05-01" accepted next to "B-2026-09-05-01") |
| VIS-09 | Medium | Logout does not clear the React Query cache, so a second user logging in on the same tab can briefly see the previous user's cached data |
| VIS-10 | Medium | CSV export has no spreadsheet-formula guard: cells beginning `= + - @` are written raw (csv.ts `cell()` only quotes `",\r\n`). A note or name like `=HYPERLINK(...)` runs in Excel |
| UX-01 | Medium | Tap targets below 44px: reminder "Add" 52x32, batch quick actions 84x32, Add-sheet close button 16px, header back / actions 36x36, "See all ›" links 24px tall |
| UX-02 | Low | Close-batch dialog: with a close date before the start date the confirm button is silently disabled, no message. Future close dates (2030) accepted |
| UX-03 | Low | Editing a batch and pressing Back discards changes with no "unsaved changes" prompt. Browser/Android back with a master sheet open leaves the page instead of closing the sheet |
| UX-04 | Low | Items: switching category to Medicine/Vaccine/Husk does not change the unit (stays "bag"). The kg-per-unit field correctly hides and shows |
| UX-05 | Low | F-12: supplier/buyer phone numbers are plain text in the list and in the edit sheet. No `tel:` link ("tap phone to call") |
| UX-06 | Low | Master search with no matches shows an empty list with no "No results" text. Whitespace-only name shows a raw DB error (see VIS-04) |
| UX-07 | Low | Date formats are mixed: reminder says "since 2026-10-01" (ISO), the rest says "26 Sep" / "03 Oct 2026". A future start date shows "Day -1" |
| UX-08 | Low | Forgot password with malformed email says "Couldn't save: Unable to validate email address: invalid format" (wrong prefix, raw text). Unknown email -> "Check your email for a reset link." (good, but local SMTP error for a real address differs - verify no enumeration on prod) |
| UX-09 | Low | FCR label "5.33e" ("e" = estimated) is cryptic. The weight chart has no axis labels or title. Batch 5 closed KPI shows "-58 live (must be 0)" correctly in red |
| UX-10 | Low | Add (+) sheet opened from a batch page does not pre-select that batch. Bottom nav has no highlighted tab on /settings/*, /stock, /entries (More is not shown active) |
| UX-11 | Polish | On 768 and 1280 the app is a 640px column but the bottom nav spans the full window width. No dark-mode support (prefers-color-scheme ignored) |
| SEC-01 | Info | Session token in localStorage (Supabase default). XSS payloads (`<img onerror>`, `<script>`) were rendered as plain text everywhere I checked (batch code, note, shed and item names, dialogs, toasts): pass |
| SEC-02 | Info | `/reset-password` with no or a bad token shows "invalid or expired" correctly |
| VIS-11 | Polish | Console warnings on every page: React Router "No HydrateFallback element provided" and deprecated `apple-mobile-web-app-capable` meta. Home shows reminders by batch id, the "5 data problems" count matches /checks |

## Details

**VIS-01 - no GRANTs in migration.** `supabase/migrations/20261002000000_init.sql` only has `grant execute on function ...` (line 368). On a stack without legacy default privileges, role `authenticated` has only TRIGGER/TRUNCATE/REFERENCES, so every page showed "permission denied for view v_batch_summary" (403 x18 on Home). Fix: add `grant usage on schema public to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated;` plus `alter default privileges ...`, and keep RLS policies as the access control.

**VIS-02 - blank batch code.** /batches/new -> code "   " -> Save. Expected "Code is required". Actual: batch created with code "" (toast "created"), Data checks then lists it ("Batch has no chick purchase" with blank code). `required` passes on whitespace and the value is only trimmed afterwards. Fix: `validate: v => v.trim() !== "" || "Code is required"` and a DB `check (btrim(code) <> '')`. Same pattern for master names (VIS-04).

**VIS-03 - close bypass.** /batches/6/edit -> Close date 2026-10-03 -> Save: batch closed with 2,861 unaccounted birds. The Close dialog (batch menu) correctly shows "2,861 birds are unaccounted for" with a "Close anyway" checkbox. Fix: remove the close date from the edit form (use the menu actions) or run the same check.

**A11Y-01 - keyboard.** Home Tab order: export banner, reminder Add, data problems, money x2, nav; the three batch cards are skipped. Same on /batches and master lists. Fix: render cards as `<Link>` or `<button>` (or `role="button" tabIndex=0` plus Enter/Space handlers). The reminder "Add" button has no visible focus outline (outline none, no ring).

**VIS-04 - raw errors.** See summary. Fix: validate ids (`Number.isInteger(id) && id > 0`) and show "Batch not found"; map DB errors (22003, 23514, 23502) to friendly text; trim and validate names; cap number inputs.

**VIS-05 - 404.** /nonexistent -> "Page / Page arrives in milestone a later". Fix: a real not-found page with a Home link; show a not-found message for unknown master or entry type instead of a silent redirect.

**VIS-06 - lengths.** Add `maxLength` (code 30, names 80, note 500) plus DB checks, and `break-words` or `truncate` on cards. Screenshots: screens/core/05-longcode-detail-390.png, screens/core/06-batches-all-xss-390.png.

**VIS-07 - offline.** Home loaded, then offline, tap Batches -> screens/core/25-offline-lazy-route-390.png. Fix: an `errorElement` on the root route with a "Check connection / Reload" action. Also, an edit save made while offline stayed on "Saving..." for more than 5 s with no error toast, and the value later appeared to have been saved after reconnecting; add a request timeout.

**VIS-10 - CSV.** Downloaded B-2026-09-05-01-audit.csv (UTF-8 BOM, 65 lines): one wide sheet with 55+ columns and a `record` column, mostly empty cells per row (usability: one table per record type would be easier to read). Formula guard missing (see summary). Fix: prefix a `'` to values starting with `= + - @ \t \r`.

## Cross-checks (numbers vs data) - all matched
- Home cards vs `v_batch_summary` and batch detail: live 1,494 / 2,861, mortality 0.4% / 4.6%, cost ৳96,356 / ৳9.44L (943,643.77) / ৳0, feed bags 2 / 250, weight 820 g (26 Sep): match.
- Batch 6 cost split 1,74,000 + 7,65,483 + 1,369 + 960 + 1,832 = 9,43,644 (18% / 81%): match. Weight gains (+258.3 / +346.5) match `v_batch_weights`.
- Batch 5 (closed): placed 2,000 - dead 178 - sold 1,880 = -58 (red warning), sales ৳7,28,102, received ৳6,05,000, due ৳1,23,102, margin ৳1,81,002: match. Home "Owed to us ৳1,23,102" matches.
- Money: 15,93,050 + 2,23,000 + 11,100 = ৳18,27,150 = Home "We owe": match. Lakh grouping and ৳ used consistently.
- Batch with no chick purchase (B-2026-10-03-01): empty states shown, banner "No chicks recorded" plus a second "Add chick purchase" in the Chicks section (redundant); shown in Data checks.
- Reminder "B-2026-10-01-01: No feed/usage since 2026-10-01" links to `/usages/new?batch=7`: correct prefill.

## Verified working checklist

| Feature | Result |
|---|---|
| F-01 login | Pass. Wrong password/email: "Email or password is wrong." (same text, no enumeration), empty/long/whitespace input handled, double click = 1 request, Enter submits, show/hide works, protected URLs redirect to /login and return after login, /login while logged in -> /, session persists on reload, password paste allowed, autocomplete set. Stale data after logout/back: not shown (VIS-09 is about the cache) |
| F-02 logout | Pass. Session cleared, back button shows /login with no data |
| F-10 sheds | Pass with issues (duplicates allowed, VIS-08; whitespace name raw error). No code field shown; saved row works |
| F-11 items | Partial. Category switch toggles kg-per-unit (FEED requires it, default 50, 0/negative/abc blocked) but unit does not follow category (UX-04); 1e9 and 0.0001 give raw DB errors |
| F-12 suppliers | Partial. List/add/edit and phone validation (letters rejected) work; no tap-to-call link (UX-05) |
| F-13 buyers | Pass (same behaviour as suppliers; used buyer -> archive prompt) |
| F-14 delete/archive | Pass. Unused deleted; used shows "X is in use ... Archive instead?"; archived hidden from the mortality shed dropdown; unarchive works |
| F-15 search | Pass (name only; no empty-result text, UX-06) |
| F-20 create batch | Partial. Suggested code B-YYYY-MM-DD-NN follows the start date (next free NN), typed code stops suggestion, duplicate -> "This code is already used."; blank code bug (VIS-02), far past/future dates accepted without warning. "Add chick purchase now" offer exists on the new batch page |
| F-21 edit batch | Pass with VIS-03; close date before start blocked with message |
| F-22 close | Partial. Menu close with unaccounted birds requires "Close anyway"; bypass via edit form (VIS-03); silent disabled button for bad date (UX-02) |
| F-23 reopen | Pass (immediate, no confirmation) |
| F-24 delete batch | Pass. With entries: "This batch has entries, so it can't be deleted. Close it instead."; without entries deleted |
| F-25 batch list | Pass. Tabs Open (3) / Closed (1) / All, closed rows show margin, FCR and "balance -58" warning. Closed grouping is by tab, not sections |
| F-50 home cards | Pass (numbers match; cards not keyboard accessible A11Y-01) |
| F-51 reminders | Pass (link with ?batch= prefill) |
| F-52 problems badge | Pass ("5 data problems" -> /checks, count matches) |
| F-53 money strip | Pass (links to /money?tab=...) |
| F-54 today counts | Pass ("Today: 0 entries" per batch; with today's entries not tested here) |
| F-60 KPIs | Pass |
| F-61 reconciliation | Pass (red warning on closed batch -58) |
| F-62 cost breakdown | Pass, labelled "excl. labour & electricity" |
| F-63 weight history | Pass |
| F-64 mortality | Pass (reason totals and last 5, "See all" link) |
| F-65 feed & usage | Pass (issued / returned / net, bags and kg) |
| F-66 sales | Pass (3 sales, received/due totals match) |
| F-67 quick actions | Pass (+Usage/+Mortality/+Weight/+Sale link with ?batch=); target size 32px (UX-01) |
| F-68 weight chart | Pass visually; no axis labels (UX-09) |
| Export CSV (batch menu, F-82) | Partial: file downloads, content correct, no formula guard (VIS-10) |
| Nav: bottom nav, Add sheet, More | Pass. All 10 Add tiles navigate correctly; Esc closes the sheet; every More link works |
| 404 / bad IDs | Fail (VIS-04, VIS-05) |
| XSS / injection | Pass (rendered as text everywhere checked) |
| Tablet / desktop / landscape / zoom 200% | Pass, no horizontal overflow, last list item scrolls clear of the bottom nav (pb-24); desktop shows a centred column (UX-11) |

## Cross-cutting
- Console on all normal pages: 0 errors, 1-2 warnings (VIS-11). Failed network: none after the grants fix.
- Requests per page (dev server): Home 9 API calls (1 per card data set plus 5 "today" counts, all parallel), Batches 1, Batch detail 8, More 0, Items 1, Money 2. No N+1. Home fires 5 separate "today" count queries; could be one view.
- Load: about 0.6 s per page on localhost in dev mode; lazy route chunks per page; loading skeletons shown for lists.
- Muted text colour #737373-ish on white is about 4.7:1 (OK). Status is always text plus colour (OPEN/CLOSED/PARTIALLY badges).
- Query params: `?batch=abc` is ignored gracefully (batch dropdown falls back); `?batch=5` (closed batch) preselects it and shows it as "Closed".
- Not tested: payments/sales/purchase form submissions, entries and stock detail pages, data-checks links, full export zip, safe-area on a real device, VoiceOver/TalkBack.

Screenshots (in screens/core/): 01-login-390, 03-home-390, 04-batches-390, 05-longcode-detail-390, 06-batches-all-xss-390, 07-batch6-detail-390, 08-batch5-390, 08-batch8-390, 09-close-batch-dialog-390, 10-closed-before-start-390 (not captured; the date was blocked), 11-sheds-390, 12-shed-add-sheet-390, 13-sheds-after-adds-390, 14-shed-archive-prompt-390, 15-sheds-archived-390, 16-items-390, 17-item-add-sheet-390, 18-suppliers-390, 19-more-390, 20-add-sheet-390, 21-home/batch5/items at 768 and 1280, 22/23 landscape, 24 zoom 200, 25 offline.
