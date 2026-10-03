# Visual QA - forms, entries, money, stock, safety (Phase 2, part 2)

Tester: Claude (Playwright MCP, Chromium, device TZ Asia/Dhaka). App http://localhost:5199, local Supabase 127.0.0.1:56321 only (no supabase.co or any external host seen in the network log). Main viewport 390x844; spot checks at 768x1024 and 1280x800 (the app is a 640px centred column there, nothing broke; the bottom nav is hidden on form pages so it never overlaps the Save bar).
Known issues from reports 01-03 are not repeated except where I **verified them in the UI** (marked "verifies BIZ-xx/FE-xx/VIS-xx"). Screenshots: `screens/forms/` (relative to this file).
Method: every form got a happy path (row checked in psql), then an attack matrix driven through the real UI (typed values, real clicks), with toast text, inline errors and the DB row recorded.
Note on test harness: a few "toast missing" readings early on were my artefact (full page loads before `navigate(-1)` reload the document and kill the toast); all toast results below were re-checked in SPA flow.

## Summary (sorted by severity)

| ID | Sev | Page | Finding |
|---|---|---|---|
| FRM-01 | High | /payments/new?bill=TYPE:ID | **Race: the prefilled bill is overwritten by the oldest unpaid bill** in ~3 of 8 loads, amount switches to that bill's due. A payment was saved on purchase 1 instead of purchase 12 (DB proof). Same code path serves the "Record payment" links |
| FRM-02 | High | /purchases/:id/edit (always), /usages/:id/edit, /mortalities/:id/edit, /chick-purchases/:id/edit, /sales/:id/edit (intermittent) | **Edit forms open with blank Select fields** (supplier/item/batch/shed show the placeholder). Save then says "Supplier is required / Choose a batch / Choose a shed". Purchase edit was blank 8 of 8 times; on the mortality edit form picking a value did not recover it (Save sent no request). Reload sometimes fixes it. Blocks fixing a data check from its own link |
| FRM-03 | High | all money/count inputs | **Silent mis-parsing** (verifies FE-04): `1,5` becomes 15 (dead birds, purchase qty, chicks, rate `4,5` = 45); Bangla digits in an optional money field are dropped (sale "Received now" `২০০০` saved the sale with **no payment**, toast "due ৳2,000"); `abc` / `-5` in "Received now" or "Paid now" is ignored with no error; purchase unit price `abc` saved a ৳0 purchase; chicks `1.5` saved as 1 chick (preview showed ৳67.50, saved ৳45) |
| FRM-04 | High | /entries/usages/:id Restore | **Restoring a RETURN does not re-validate** (F-40, verifies BIZ-01/07): I voided a RETURN and the ISSUEs it returned, restored the RETURN, toast "restored", net issued is now -1 bag. /checks does not flag it either (still 5 problems) |
| DATA-01 | Medium | sale, purchase, chick forms | UI preview and DB disagree when more decimals are typed than the column holds: sale rate 100.456 x 20 kg UI ৳2,009.12, DB ৳2,009.20 (rate stored 100.46); purchase qty 1.0005 x 100 UI ৳100.05, DB ৳100.10; chick rate 45.456 x 10 UI ৳454.56, DB ৳454.60; unit price 100.456 UI ৳1,004.56, DB ৳1,004.60. No `maxlength`/decimal limit on any input |
| FRM-05 | Medium | /entries/* navigation | Only usages is reachable ("More > All entries"). There is **no type switcher** on the list page; mortality/weights/sales/chick lists only via "See all ..." on a batch, purchases only from one data-check card, **payments list not reachable at all** (only single payments from a bill/party). Stock item tap does nothing (doc 16 says it opens purchases/usages) |
| FRM-06 | Medium | all forms | No sanity guard rails (verifies BIZ-08/09 in UI): dates `0001-01-01`, `2099-12-31`, 3 days before batch start accepted silently (payment dated before its bill, also 1901/2099); usage on batch closed a month ago accepted with no warning; purchase price `0` and `1e9` accepted (one ৳1,000,000,000 unit price made Gumboro avg cost ৳11.7 crore and the Money strip ৳10,00,18,77,234, text truncated "৳10,00,18,76,..."); 100000 birds weighed in a 1,373-bird flock; 300 g average at day 2; 1 bird = 100 kg sale (warning only); chick purchase with net ৳0 |
| FRM-07 | Medium | Home | **Stale numbers** (verifies FE-01): after recording a payment, Home "We owe" stayed ৳10,00,18,77,234 while DB was ...76,234; "Today: 0 entries" did not move after saving a mortality. Live birds / mortality % did refresh |
| SEC-01 | Medium | /export | **CSV formula injection** (verifies VIS-10/SEC-03): note `=HYPERLINK("http://x","y")` and `+cmd\|calc!A0` are written raw into mortalities.csv |
| FRM-08 | Medium | billing forms | Enter inside any field of Sale/Purchase/Chick/Payment fires **"Save & add another"** (verifies FE-12; daily forms Enter = plain Save). After "Save & add another" the payment form auto-selects the oldest bill and prefills its **full due** (e.g. ৳1,86,000), one tap from a wrong big payment |
| FRM-09 | Medium | all forms with a date | Clearing the date and pressing Save does nothing visible (no message, no toast; only focus jumps to the date field) on usage/mortality/weight. Payment/purchase forms do show "Date is required" |
| FRM-10 | Low | sale form | Wrong message: crate deduction larger than the weight shows toast "Discount is larger than the sale amount." (the inline warning says the right thing) |
| FRM-11 | Low | many | Raw DB text still leaks: `invalid input syntax for type integer: "1.5"` (male birds), `numeric field overflow`, `new row for relation "usages" violates check constraint "usages_qty_check"` (qty 0.0004), `payments_amount_check` (0.001), `value "2147483648" is out of range for type integer`, `null value in column "qty"... ` (qty Infinity), list filters `Couldn't load: invalid input syntax for type bigint: "NaN"` / `date/time field value out of range` / `invalid input value for enum usage_kind` |
| FRM-12 | Low | /entries/*/:id | Deleted-reason banner has no word wrap: a 50-char reason without spaces widens the page to 486px (scrollWidth 486 vs 390), header clipped, horizontal scroll |
| FRM-13 | Low | /entries/x/:id, /edit | Unknown id: detail shows an empty page titled "Usage #999999" (no "not found"); `/usages/999999/edit` shows raw `Cannot coerce the result to a single JSON object`; `/payments/new?bill=SALE:20031` (voided) shows raw "Couldn't load: Cannot coerce..." |
| FRM-14 | Low | edit forms | Last write wins: two tabs editing mortality 50092 (A saves 8, B saves 9) ends at 9 with no warning (verifies AUD/BIZ concerns) |
| FRM-15 | Low | edit forms | Edit forms show a blank/"Choose" flash for 0.5-2 s before prefill (no skeleton); billing edit forms have no Delete action (daily edit forms have the red bin) - delete only from the detail menu |
| UX-01 | Low | /mortalities/new | Over-live error is printed twice (field error + red line under the result card). In a closed batch the message is "Only -58 birds are live" |
| UX-02 | Low | payment form | Bill list rounds to whole taka: bill ৳100.10 shows "৳100 · due ৳100", ৳1,004.60 shows "৳1,005", so due displayed differs from the amount defaulted into the field (100.1) |
| UX-03 | Low | dates | Native date inputs show `10/03/2026` (browser locale) while the app prints `03 Oct 2026`; ISO dates in data-check cards; year 0001 prints as "01 Jan 1901" (list, detail, party payments) |
| UX-04 | Low | sale form | "Method" toggle (Cash/Bank/Mobile) overflows the right gutter (ends at x=387 of 390); deduction field defaults to 0 while others are blank |
| UX-05 | Polish | many | "1 chicks", bill description `× 30.000 sack`, sale "Sale #20030" exposes raw ids, stock shows no kg for feed (doc 16 wants "2,750 kg"), "still issued: -2.999" preview on an over-return, Stock "Store value ৳0" when search finds nothing, batch CSV is one 63-column sparse sheet mixing record types, zip entries all dated 1 Jan 2026 |
| UX-06 | Polish | home | Reminder says "since 2026-10-01" (ISO) - already known, still present |
| A11Y-01 | High | sale/purchase/chick/payment forms | **Inputs have no accessible name** (verifies FE-09): Sale form 12 unlabeled controls, 8 with no name at all; Purchase 8/4; Chick 9/5; Payment 4/2. Only the visible text is not associated (`<label>` has no `for`). Screen readers announce "edit text" |
| A11Y-02 | Medium | /entries/*, /money, /money/:party | List cards and bill rows are `div onClick` with `cursor-pointer`: no role, not focusable (verifies A11Y-01 for these pages). Only the "Back/Add/Filter" controls are tab stops |
| A11Y-03 | Medium | all | Tap targets under 44px: back 36x36, "Show closed batches" 120x16, "+ Add note" 71x20, chips/"Paid in full" 32px, money tabs 29px, "Open entry" buttons 32px, tel link 32px, filter/Add 32px. Inline errors have no `role=alert` / aria-live, focus stays on the Save button after a failed submit |
| SEC-02 | Low | auth | Two `POST /auth/v1/token` on every full page load (2 refreshes) |
| PWA-01 | Low | manifest | `icon-maskable-512.png` is byte-identical to `icon-512.png` (no safe-zone padding, Android will crop). `/sw.js` returns the SPA html with 200 (no service worker, expected); no `favicon.ico` (emoji data-URI icon only); deprecated `apple-mobile-web-app-capable` warning |

Counts: Critical 0, High 5 (FRM-01..04, A11Y-01), Medium 9 (DATA-01, FRM-05..09, SEC-01, A11Y-02, A11Y-03), Low 12 (FRM-10..15, UX-01..04, SEC-02, PWA-01), Polish 2 (UX-05, UX-06).

## Details of the major findings

### FRM-01 Payment prefill race (money safety)
Steps: open `/payments/new?bill=PURCHASE:12` repeatedly (full load or from a "Record payment" link).
Expected: Rice husk bill (purchase 12, Karim Traders) selected, amount = its due.
Actual: 3 of 8 loads (and 4 of the 12 I did overall) show "18 Jul Starter feed x 60 bag" (purchase 1) selected with amount 185990. Typing an amount and saving then pays the wrong bill. DB: `payments 20035 -> purchase 12 (ok)`, `20036 -> purchase 1 (wrong, I had asked for 12)`, `20037 -> purchase 12`. Screenshot: `screens/forms/payment-prefill-race.png`.
Cause (PaymentFormPage.tsx): the "keep a valid bill selected (first unpaid)" effect runs when the party's bills arrive before the `?bill=` value has been applied/validated, and the amount effect then follows the first bill.
Fix: apply the `?bill` value once as the initial `bill` (only fall back to the first bill if it is absent from the list), and do not run the default effect until the target query settled. Consider requiring the user to confirm bill + amount (the card already shows them) or pre-validating amount against the bill.

### FRM-02 Edit forms with blank selects
Repro: open "⋮ > Edit" on a purchase (`screens/forms/purchase-edit-blank-selects.png`), or deep-link `/usages/50083/edit`, `/mortalities/50089/edit`, `/chick-purchases/11/edit`, `/sales/20030/edit`. Text fields are filled, the Radix Selects show "Choose supplier / Choose item / Select batch". Save: "Supplier is required", "Item is required", "Choose a batch" or "Choose a shed" (`usage-edit-blank-selects.png`, `mortality-edit-blank-shed.png`). Purchase edit: 8/8 broken; usage 2/4; mortality 1/3; chick and sale about 1/2. Once the shed select was blank on the mortality edit page, choosing "Brooder 1" showed it but Save still sent no request (`mortality-edit-stuck.png`). Re-picking both selects on the purchase edit form works (saved ৳32,010).
Likely cause: `reset({...})` runs before the options exist, Radix Select keeps a placeholder, RHF value and displayed value diverge. Fix: render the form only after the row AND the option queries loaded (or key the form on `existing.data.id`), and add skeleton.

### FRM-03 Number parsing
Verified table (value typed -> what happened):
| Form | Typed | Result |
|---|---|---|
| Mortality | `1,5` | saved 15 dead; `1e2` saved 100 |
| Usage | `1,5` (Finisher) | saved 15 bags (cost ৳44,250) |
| Purchase qty | `1,5` | saved 15 vial |
| Chick | `1,0` x `4,5` | saved 10 chicks at ৳45 |
| Chick | `1.5` chicks | preview ৳45.00 total... saved 1 chick (toast "1 chicks") |
| Sale received | `২০০০` | sale saved, **no payment row**, status DUE |
| Sale received / purchase paid now | `abc`, `-5` | ignored, saved with no payment, no message |
| Purchase unit price | `abc` | saved purchase of ৳0.00 (while `-5` gives "Enter the price") |
| Sale male birds | `1.5` | blocked by DB: `invalid input syntax for type integer: "1.5"` |
| Payment amount | `1,000` | saved ৳1,000 (fine); Bangla `১০০০` -> "Must be more than 0" (confusing) |
Fix: one shared parser that maps Bangla digits to ASCII, treats `,` as a thousands separator only when followed by exactly 3 digits (else reject), rejects non-numeric text with an inline error, never silently turns invalid input into 0, and uses `inputMode="decimal"` pattern or `type="text"` + `maxLength`.

### FRM-04 Restore does not re-validate
Steps: Usage ISSUEs 50077/50079/50080 (17.001 bag Finisher) + RETURN 50082 (1 bag) on batch 6. Delete the RETURN, delete the three ISSUEs (UI allows it, no warning that no issue is left), open the RETURN, Restore -> "Usage #50082 restored". DB: signed sum for item 12 on batch 6 = -1.000; `v_data_checks` unchanged. Screenshot: `restore-return-exceeds.png`. Fix in DB trigger (fire on `is_void` flips) and add a data check "Return exceeds issued".

### SEC-01 Export
`unzip -t` OK; 15 CSVs (12 tables + batch_summary, bills, item_stock), every one starts with the UTF-8 BOM, row counts equal psql counts for all 12 tables (including voided rows: usages 56, mortalities 81, payments 16...), Bangla text and `৳` survive, notes quoted correctly. But `50092,...,"=HYPERLINK(""http://x"",""y"")"` and `+cmd|calc!A0` are unneutralised. Fix in `csv.ts cell()`: prefix `'` (or a tab) when the first char is `= + - @ \t \r`.

## Calculation verification

| Form | Inputs | UI result | Independent result (DB / hand) | Match |
|---|---|---|---|---|
| Usage issue | 2.5 bag Starter, avg 3177.7778 | ≈ ৳7,944, toast ৳7,944 | DB cost 7944.44 | yes (rounded) |
| Usage return | 1 bag Finisher avg 2950 | -৳2,950 | cost -2950 | yes |
| Sale | 100 M + 50 F, 300 kg, 100 g/crate, ৳150 | 150 birds, 15 crates, ded 1.5 kg, net 298.5 kg, ৳44,775.00, due ৳24,775 (paid 20,000) | ceil(300/20)=15; 15x0.1=1.5; 298.5x150=44,775; DB identical | yes |
| Sale | 20 kg vs 20.001 kg | 1 crate vs 2 crates | DB crates 1 / 2 | yes |
| Sale | 10 birds, 20 kg, rate 100.456 | ৳2,009.12 | DB rate 100.46 -> ৳2,009.20 | **no** (DATA-01) |
| Weight | 50 birds, 3.333 kg | "67 g" | DB avg 66.7 | yes (display rounding) |
| Weight | 50 birds, 15 kg (typed `1,5`) | "300 g" | DB 300.0 | yes (but wrong input) |
| Purchase | 10 x 3200, paid 10,000 | ৳32,000, due ৳22,000 | DB 32000, due 22000 | yes |
| Purchase | 3 x 33.33 | ৳99.99 | 99.99 | yes |
| Purchase | 1.0005 x 100 | ৳100.05 | DB qty 1.001 -> 100.10 | **no** |
| Purchase | 10 x 100.456 | ৳1,004.56 (toast ৳1,005) | DB 100.46 -> 1004.60 | **no** |
| Chick | 1000 x 45 - 500, paid 20,000 | total 45,000, net 44,500, due 24,500 | DB 45000 / 44500 | yes |
| Chick | 10 x 45.456 | ৳454.56 | DB rate 45.46 -> 454.60 | **no** |
| Chick | 10 x 45 - 450 | net ৳0 | DB 0 (allowed) | yes |
| Payment | ৳1,000 on bill ৳3,750 | toast "bill due ৳2,750" | 3750-1000 | yes |
| Payment edit | 1000 -> 500 on that bill | saved | DB 500 | yes |
| Entries summaries | usages 56 / ৳12,69,697; mortalities 80 / 451 dead; sales ৳7,98,986; purchases 22; chicks 7,531 / ৳4,18,450; payments paid ৳2,81,530 + received ৳6,26,100 | as shown | psql sums identical (1,269,696.72; 451; 798,986.30; 418,449.60; 907,630) | yes |
| Money | Local Market due | ৳38,452 -> after delete+restore ৳39,452 | v_buyer_balance 38452 / 39452 | yes |
| Stock | Starter 87.5, Amoxicillin 7, Finisher 101 | as shown | v_item_stock | yes |
| Home live birds | batch 7 after dead 3 | 1,363 -> 1,360 | matches | yes |

## Verified working (feature table)

| Feature | Result | Note |
|---|---|---|
| F-30 usage issue | pass | picker shows "store N", cost toast `Saved - 1 bottle Amoxicillin -> B-... · ৳450`, warning (not block) when qty > store (Grower -36 saved), "no purchase on or before this date" plain message, `?batch=&kind=` prefill works; Infinity/1e9/0.0004 give raw DB errors (FRM-11) |
| F-31 usage return | partial | picker lists only items issued with "issued to ..." amounts, blocks over-return inline; restore path bypasses it (FRM-04) |
| F-32 mortality | pass | shed defaults to last used for the batch, reason default Normal, blocks dead > live; dates unchecked (FRM-06) |
| F-33 weight | pass | live avg g and flock estimate, small-sample warning, "Check units" guard (20-5000 g); no age sanity (FRM-06) |
| F-34 chick purchase | partial | live total/net/due correct, "already has 1,000 chicks" and discount warnings good; decimal mismatches, `1.5` truncation (DATA-01, FRM-03) |
| F-35 item purchase | partial | amount/due/last price (+%) correct; price `abc`/0/1e9 accepted; edit form broken (FRM-02) |
| F-36 sale | partial | crates, deduction, net, amount, due, over-live block, overpay block ("More than the bill amount"), edit-below-paid block all work; rate precision and received parsing issues |
| F-37 payment | partial | party list sorted by due, bill list with status, amount defaults to due, over-payment blocked, `?party_id=`/`?bill=` prefill works but races (FRM-01); voided bill cannot be selected |
| F-38 edit | partial | prefilled for text fields, bill-below-paid blocked (sale and purchase), saves OK; blank selects (FRM-02) |
| F-39 delete | pass | reason required (whitespace rejected), cascade dialog for a bill with payments, DB `is_void` + `[deleted: reason]`, payment tagged `bill deleted: ...`, Undo toast works, HTML in reason rendered as text; long reason overflows (FRM-12) |
| F-40 restore | partial | bill restore asks "with payments / sale only", restores both; return restore not re-validated (FRM-04) |
| F-41 browse | partial | filters (batch/date/type fields/deleted), grouping by day, summary lines equal DB, 50 per page + Load more (usages 56 -> 50 + 6, mortalities 80), empty states ("0 entries"); not all lists reachable (FRM-05); tampered params give raw errors |
| F-70 stock | pass | search, category tabs, red `-36 bag "used more than purchased"`, no kg shown, tap does nothing, archived zero-balance item hidden |
| F-71 money | pass | Suppliers/Buyers sorted by due, totals equal DB (settled-collapse not exercisable, nobody is settled) |
| F-72 party detail | pass | contact + `tel:` link (32px), totals, Bills/Payments tabs, Record payment prefills; unknown id/type -> "Not found" |
| F-73 unpaid bills | pass | oldest first, supplier/buyer filter |
| F-80 data checks | pass | every row explained, links go to the right record, count 5 = v_data_checks = Home badge; fixing a mortality date removed its card (6 -> 5); adding a chick purchase removed "no chick purchase". Blind to future dates, return > issued, absurd values |
| F-81 export all | pass with SEC-01 | see above; last export saved, Home reminder gone; after 9 days "Last export: 9 days ago", corrupt value -> "No backup yet" |
| F-82 export batch | pass | menu "Export CSV" -> `B-2026-09-05-01-audit.csv` (sparse wide CSV) |
| F-83 reminder | pass | per-browser localStorage only |
| F-03 PWA | partial | manifest 200 `application/manifest+json`, icons 192/512/180 correct sizes, theme-color, apple-touch-icon; maskable icon identical to normal (PWA-01) |
| F-68 chart | n/a | not part of this part |

## Other checks done
- Date default: `today()` uses the device clock (verified with the clock at 20:30 UTC = 02:30 BD, default became 2026-10-04, correct for the farm). The risk is the DB side (`current_date` UTC in views, known MATH-02).
- Archived items and sheds are hidden from pickers (also in mortality shed list); "Show closed batches" is an opt-in 16px link.
- Double click / triple click on Save: one row only. Back after save returns to the previous page; reload mid-form loses input without a prompt.
- Keyboard: tab order is logical, Save bar reachable, Enter = Save on daily forms (see FRM-08 for billing).
- Request counts per page 3-11 REST calls, no duplicate data queries except two token refreshes (SEC-02); console errors only from tampered URLs (400/406).
- XSS strings (`<b>`, quotes) in delete reasons and stock search render as text.

## Not tested / limits
Offline behaviour, Safari/real phone keyboards (inputmode only read from DOM: counts `numeric`, money `decimal`), landscape forms, settled-party collapse (no settled party), archived item with non-zero stock, concurrent payment race (covered in report 01), pull-to-refresh, 1000+ row paging, and editing a purchase after its stock was consumed (the edit form could not be used reliably, FRM-02).

## Cleanup
All rows I created were deleted by id in one transaction: payments 11, sales 11, purchases 11, chick purchases 5, usages 8, mortalities 9, weights 5 (counts back to baseline 50/74/9/3/13/3/6 and `v_data_checks` back to its original 5 rows). No mock row was edited. Identity sequences advanced (not reset). Temp files only in the scratchpad and `.playwright-mcp/` (downloaded export zip/csv). Browser localStorage `lastExportAt` removed; `last:*` keys remain. No source edits, no commits.

## Screenshots (docs/test/screens/forms/)
add-menu, usage-batch-picker, usage-filled, usage-return-over, usage-edit-blank-selects, mortality-over-live, mortality-closed-batch, mortality-edit-blank-shed, mortality-edit-stuck, weight-empty-date-silent, sale-filled, sale-payment-section, sale-edit, detail-sale, delete-dialog-bill-with-payments, after-restore-sale (restore dialog), restore-return-exceeds, undo-toast, purchase-empty, purchase-edit-blank-selects, purchase-edit-below-paid, chick-purchase-filled, payment-empty, payment-bill-picked, payment-prefill-race, payment-edit, entries-*.png (7 types), entries-filter-sheet, money-suppliers, money-buyers, money-unpaid, party-detail-supplier, party-detail-payments, stock, stock-feed-tab, checks, export-page, more-page, sales-new-/entries-sales-/payments-new- at 768 and 1280.
