# 15 · Entry detail (view / edit / delete / restore)

**Purpose:** see one record fully, including computed values, then fix or delete it safely.
**Route:** `/entries/:type/:id` (Edit opens the type's form route in edit mode)

## Wireframe (example: a sale)
```
┌──────────────────────────────────────┐
│ ←  Sale #12                      ⋮   │  ⋮ = Edit · Delete (or Restore if deleted)
├──────────────────────────────────────┤
│ 01 Oct 2026 · B-001 · Trader         │
│                         PARTIALLY    │
│                                      │
│ ENTERED                              │
│ Male / Female        1,200 / 800     │
│ Grade                A               │
│ Gross weight         2,843 kg        │
│ Deduction / crate    1,000 g         │
│ Rate                 ৳200 / kg       │
│ Discount             ৳0              │
│                                      │
│ CALCULATED                           │
│ Birds                2,000           │
│ Crates               143             │
│ Deduction            143 kg          │
│ Net weight           2,700 kg        │
│ Amount               ৳5,40,000       │
│                                      │
│ PAYMENTS                             │  bills only
│ 01 Oct  Cash    ৳4,72,000      ›     │  → payment detail
│ Due                ৳68,000           │
│ [ Record payment ]                   │
│                                      │
│ Note: —                              │
│ Created 01 Oct 2026, 18:42           │
└──────────────────────────────────────┘
```

Deleted record: grey banner at the top "Deleted · reason: wrong buyer · [Restore]". All values struck through.

## Sections by type
| Type | Entered | Calculated | Extra |
|---|---|---|---|
| usage | kind, item, qty, date, batch | unit cost, cost (kg for feed) | — |
| mortality | date, batch, shed, count, reason | — | — |
| weight | date, batch, sample, total kg | avg g, age, gain | — |
| sale / purchase / chick purchase | inputs | generated amounts | Payments list, due, Record payment |
| payment | date, party, bill, amount, method | — | link to the bill |

## Actions
- **Edit** → form in edit mode (e.g. `/sales/12/edit`).
- **Delete** → `AlertDialog`: required reason. Bills with payments: "This sale has 1 payment (৳4,72,000). Deleting
  the sale also deletes its payments." → sets `is_void = true` on the bill and its payments, appends
  `[deleted: reason]` to note. Toast with Undo.
- **Restore** → `is_void = false` (bill restore asks whether to restore its payments too). DB triggers re-validate;
  e.g. restoring a return that now exceeds what's issued fails with the DB message.
