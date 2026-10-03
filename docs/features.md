# Features — Sonali Batch Audit v1

Priority: **Must** = v1 is not usable without it · **Should** = in v1 if time allows · **Later** = after v1 / FMS.
Page references point to `page-layouts/`. Data references point to `schema.md`.

---

## A. Access

| ID | User can… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-01 | Log in with email + password | Wrong password shows "Email or password is wrong". Session survives closing the browser. Every other route redirects to /login when logged out. | Must | 01 | Supabase Auth |
| F-02 | Log out | Clears the session and returns to /login | Must | 22 | Auth |
| F-03 | Install to phone home screen | Web manifest + icon; opens full-screen | Should | — | — |

## B. Master data (full CRUD)

| ID | User can… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-10 | List, add, edit **sheds** | Code unique; type BROODER/GROWER | Must | 19 | `sheds` |
| F-11 | List, add, edit **items** | Category FEED/MEDICINE/VACCINE/HUSK; unit; FEED requires kg per unit (prefilled 50) | Must | 19 | `items` |
| F-12 | List, add, edit **suppliers** | Name required; company, phone optional; tap phone to call | Must | 19 | `suppliers` |
| F-13 | List, add, edit **buyers** | Same as suppliers | Must | 19 | `buyers` |
| F-14 | Delete / archive a master | If never used → deleted. If used → "Used in N entries — archive instead?" Archived records vanish from dropdowns but remain in history. Can unarchive. | Must | 19 | `is_active`, FK 23503 |
| F-15 | Search masters by name/code | Filters as you type | Should | 19 | — |

## C. Batches

| ID | User can… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-20 | Create a batch | Code suggested as next `B-###`; start date defaults to today; then offers "Add chick purchase now" | Must | 05 | `batches` |
| F-21 | Edit a batch | Code, start date, note editable | Must | 05 | `batches` |
| F-22 | Close a batch | Sets close date (default today). If live balance ≠ 0, shows the gap and requires confirmation. | Must | 04 | `close_date` |
| F-23 | Reopen a batch | Clears the close date | Must | 04 | — |
| F-24 | Delete a batch | Only if it has no entries; otherwise blocked with the reason | Should | 05 | FK |
| F-25 | See batch list | Open first, then closed (newest first); each row shows age, live birds, mortality %, margin (closed) | Must | 03 | `v_batch_summary` |

## D. Daily operations (ledgers: create, edit, delete/restore)

All entry forms: date defaults to today · batch defaults to the last batch used · only OPEN batches in the batch picker
(closed batches available via "show closed") · numeric keypad · "Save" and "Save & add another" · after saving, a toast
shows the computed result.

| ID | User can… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-30 | Record **usage: issue** to a batch | Item picker shows store balance per item. Qty in item unit. Toast shows cost (qty × avg price). Error if the item was never purchased. Warning (not a block) if qty > store balance. | Must | 07 | `usages` kind ISSUE |
| F-31 | Record **usage: return** to store | Toggle Issue/Return on the same form. Picker shows how much is still issued to the batch. Error if returning more than issued. | Must | 07 | `usages` kind RETURN |
| F-32 | Record **mortality** | Batch, shed, count, reason (default NORMAL). Shed defaults to last used for that batch. | Must | 08 | `mortalities` |
| F-33 | Record **weight sample** | Sample size + total kg → shows avg g and age live while typing. Warns if sample < 30. | Must | 09 | `weights` |
| F-34 | Record **chick purchase** | Batch, supplier, chicks, rate, discount, paid now → shows net price and due live | Must | 12 | `create_chick_purchase` |
| F-35 | Record **item purchase** | Item, supplier, qty, unit price, paid now → shows amount and due live | Must | 11 | `create_purchase` |
| F-36 | Record **sale** | Batch, buyer, male, female, grade, gross kg, deduction g/crate, rate, discount, received now → shows birds, crates, deduction kg, net kg, amount and due live | Must | 10 | `create_sale` |
| F-37 | Record **payment** (pay supplier / receive from buyer) | Pick party → pick an unpaid bill (shows due) → amount defaults to full due → method. Error if more than the due. | Must | 13 | `payments` |
| F-38 | Edit any entry | Same form, prefilled. Bill amount can't go below what's already paid (shown as a data check if it does). | Must | 15 | update |
| F-39 | Delete an entry (soft) | Asks for a reason; entry hidden from lists and totals; voiding a bill also voids its payments (after confirmation) | Must | 15 | `is_void` |
| F-40 | Restore a deleted entry | "Show deleted" filter on lists → Restore. Triggers re-validate (e.g. a return can't exceed issued). | Should | 14, 15 | `is_void` |
| F-41 | Browse entries per type | Lists for usages, mortality, weights, chick purchases, purchases, sales, payments; filter by batch and date range; newest first; 50 per page | Must | 14 | tables |

## E. See: operational overview

| ID | User can see… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-50 | **Home: open batch cards** | Per open batch: code, age (days + week), live birds, mortality % today/total, latest avg weight + its date, feed bags used, cost so far. Tap → batch summary. | Must | 02 | `v_batch_summary` |
| F-51 | **Home: reminders** | "B-002: no feed/usage entered since 30 Sep", "B-001: no weight sample in 7 days". Tap → the right form, prefilled with the batch. | Must | 02 | `v_reminders` |
| F-52 | **Home: problems badge** | "3 data problems" when `v_data_checks` isn't empty → Data checks page | Must | 02, 20 | `v_data_checks` |
| F-53 | **Home: money strip** | We owe (suppliers), owed to us (buyers) → Money page | Must | 02 | balances |
| F-54 | **Home: today's entries** | Count of entries made today per batch (confidence that today is done) | Should | 02 | tables |

## F. See: batch summary

| ID | User can see… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-60 | KPI header | Live birds, mortality %, latest weight, FCR (est. while running, final when sold), cost/kg, gross margin (closed) or cost so far (open) | Must | 04 | `v_batch_summary` |
| F-61 | Bird reconciliation | Placed − dead − sold = live; turns red on a closed batch if ≠ 0 | Must | 04 | `v_batch_summary` |
| F-62 | Cost breakdown | Chicks, feed, medicine, vaccine, husk with % of total; labelled "excl. labour & electricity" | Must | 04 | `v_batch_summary` |
| F-63 | Weight history | Table: date, age (day/week), avg g, gain since previous | Must | 04 | `v_batch_weights` |
| F-64 | Mortality summary | Total by reason, and the list by date with shed | Must | 04 | `mortalities` |
| F-65 | Feed & usage | Issued, returned, net per item; feed bags and kg | Must | 04 | `usages` |
| F-66 | Sales & collections | Each sale: birds, net kg, amount, status; totals received and due | Must | 04 | `v_bills` |
| F-67 | Quick actions | Add usage / mortality / weight / sale with this batch preselected; close / reopen | Must | 04 | — |
| F-68 | Weight curve chart | Simple line of avg g by age | Later | 04 | `v_batch_weights` |
| F-69 | Compare closed batches | Table of closed batches side by side | Later | 03 | `v_batch_summary` |

## G. See: stock and money

| ID | User can see… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-70 | Stock per item | Purchased, issued, returned, balance, avg price, value; negative balance in red | Must | 16 | `v_item_stock` |
| F-71 | Money overview | Tabs: Suppliers (we owe) / Buyers (owe us); each party with billed, paid, due; sorted by due | Must | 17 | balances |
| F-72 | Party detail | Contact, totals, list of bills with status, payment history, "Record payment" | Must | 18 | `v_bills`, `payments` |
| F-73 | Unpaid bills list | All bills with due > 0, oldest first | Should | 17 | `v_bills` |

## H. Data safety

| ID | User can… | Acceptance criteria | Priority | Page | Data |
|---|---|---|---|---|---|
| F-80 | See data checks | List of problems with plain explanation and a link to the record | Must | 20 | `v_data_checks` |
| F-81 | Export all data to CSV | One tap → zip with one CSV per table (including voided rows) + views summary; filename has the date | Must | 21 | all |
| F-82 | Export one batch | CSV of the batch summary + its entries | Should | 04 | — |
| F-83 | Last export reminder | Home shows "Last export: 9 days ago" if more than 7 days | Should | 02 | localStorage |

## I. Explicitly Later (not v1)

Labour/payroll · electricity/transport/repairs · shed transfers · stock counts & store losses · batch-to-batch transfer
(use return + issue) · multi-user · offline · Bangla UI · charts beyond F-68 · notifications/SMS.
