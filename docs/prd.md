# PRD — Sonali Batch Audit (temporary, pre-FMS)

| | |
|---|---|
| Status | Draft v1 |
| Owner | Farm owner (single user) |
| Related | `features.md`, `design.md`, `schema.md`, `page-layouts/` |

## 1. Problem

The farm runs Sonali chicken batches across 5 sheds (2 brooder, 3 grower), up to 2 batches at a time. The full
Farm Management System (FMS) is at least 6 months away. Without a record system in the meantime:

- Batch cost and profit are guesses: feed, medicine, vaccine and husk are bought in bulk and used across batches.
- Bird counts aren't reconciled, so missing birds (death, theft, unrecorded sales) go unnoticed.
- Money owed to suppliers and by buyers lives in memory and notebooks.
- Six months of history will be missing when the FMS launches.

## 2. Goal

A **phone-first web app** that one person can use at the farm, in under a minute per entry, to record every batch
event and money movement, and that shows **per-batch numbers that are correct**.

### Success criteria
| # | Criterion | How we know |
|---|---|---|
| S1 | Every daily entry (usage, mortality) takes ≤ 30 seconds and ≤ 3 taps to open | Timed on a phone |
| S2 | Batch numbers match a manual calculation | Spot-check one closed batch by hand |
| S3 | Every closed batch's bird balance = 0, or the gap is visible | `v_data_checks` empty or explained |
| S4 | Supplier and buyer dues are known at any time, with payment history | Money page matches the real ledger |
| S5 | All data can be exported to CSV at any time | Export opens in Excel |
| S6 | Data is migratable to the FMS without retyping | Stable codes, no hard deletes, CSV export |

## 3. User

One person: the owner/manager. Enters data on a phone at the farm, checks numbers on the phone or a laptop.
Comfortable with numbers, not with complex software. Internet is usually fine.

## 4. Scope v1

### The user can DO
- Create, edit, archive/delete: **sheds, items, suppliers, buyers**
- Create, edit, close, reopen: **batches**
- Record, edit, delete/restore: **chick purchases, item purchases, usages (issue + return to store),
  mortality, weight samples, sales, payments**
- Pay a supplier due or receive a buyer due, later and in parts
- Export all data to CSV

### The user can SEE
- **Home**: open batches at a glance, reminders (missed entries), data problems, total dues
- **Batch summary**: birds, mortality, weight growth, feed and FCR, cost breakdown, sales, gross margin, every entry
- **Stock**: what's in the store per item
- **Money**: who we owe, who owes us, bill by bill
- **Data checks**: inconsistencies to fix

Full list with acceptance criteria: `features.md`.

## 5. Non-goals (v1)

| Not doing | Why |
|---|---|
| Labour, payroll, electricity, transport | Explicitly deferred. Gross margin will overstate profit, and the app says so. |
| Shed-to-shed bird transfers | Deferred for simplicity |
| Stock counts, store losses, batch-to-batch transfers | Deferred (a transfer = return + issue) |
| Multi-user, roles, multi-farm | Single owner, single farm |
| Offline mode | Internet is usually fine; big complexity |
| Charts-heavy dashboard | Operational numbers, not analytics |
| Bangla UI | English v1; labels are kept in one file so translation is easy later |
| Native mobile app | Responsive web app, installable to home screen |

## 6. Constraints

- Stack: Vite + React + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth), hosted on Vercel.
- Supabase free plan: no automatic backups, hence CSV export is a Must.
- Data rules live in the database (constraints, triggers, generated columns), not only in the UI.
- Temporary tool: the build should take days, not weeks.

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Entries not made daily | Wrong batch numbers | Home reminders: "no usage since…", "no weight in 7 days" |
| Scope creep into a second FMS | FMS delayed | Non-goals above; anything new goes to "Later" in `features.md` |
| Data loss (free plan, wrong delete) | 6 months gone | Soft delete only, weekly CSV export habit |
| Secrets leaked | Anyone can read/write finances | Only the publishable key in the frontend; sign-ups disabled; rotate any key ever shared |
| Gross margin read as profit | Bad decisions | Label it "Gross margin (excl. labour & electricity)" everywhere |

## 8. Release plan

1. **M1 Foundation**: auth, layout, master data CRUD, batch CRUD
2. **M2 Daily entry**: usage (issue/return), mortality, weight
3. **M3 Money**: chick purchase, purchase, sale, payments, Money page
4. **M4 Insight**: Home, Batch summary, Stock, Data checks, Export
5. **M5 Hardening**: error messages, empty states, phone testing, deploy to Vercel
