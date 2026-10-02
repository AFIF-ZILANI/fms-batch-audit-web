# 07 · Usage form (issue / return)

**Purpose:** record items taken from the store for a batch (ISSUE), or unused items brought back (RETURN). This is the
most frequent entry, so it has to be the fastest.
**Routes:** `/usages/new?batch=&kind=`, `/usages/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Usage                             │
├──────────────────────────────────────┤
│ [  Issue to batch  |  Return to store ] │  ToggleGroup (kind)
│                                      │
│ Batch *                              │
│ [ B-001 · Day 62               ▾ ]   │  open batches; last used default
│ Date *                               │
│ [ 02 Oct 2026                    ]   │
│                                      │
│ Item *                               │
│ ┌────────────────────────────────┐   │  combobox, grouped by category
│ │ Grower feed (bag)    store 55  │   │  ISSUE: shows store balance
│ └────────────────────────────────┘   │  RETURN: shows "issued to B-001: 90"
│ Recent: [Grower feed] [Starter feed] │  chips: last 3 items used for this batch
│                                      │
│ Quantity * (bag)                     │
│ ┌────────────────────────────────┐   │
│ │ 5                              │   │  numeric keypad
│ └────────────────────────────────┘   │
│                                      │
│ ┌ Result ─────────────────────────┐  │  live, muted card
│ │ ≈ ৳15,500  (avg ৳3,100 / bag)   │  │
│ │ 250 kg feed                     │  │  FEED only
│ │ Store after: 50 bags            │  │
│ └─────────────────────────────────┘  │
│ ⚠ Store shows 3 bags; you're issuing 5 │  amber warning (allowed, flagged in checks)
│                                      │
│ + Add note                           │
├──────────────────────────────────────┤
│ [Save & add another]   [   Save   ]  │
└──────────────────────────────────────┘
```

## Data
- Item list + store balance: `v_item_stock where is_active`.
- Issued-to-batch per item (RETURN mode): `sum(signed_qty) from usages where batch_id and not is_void group by item_id`.
- Preview price: ISSUE → `v_item_stock.avg_unit_cost` (approximation; the trigger uses purchases up to the date);
  RETURN → batch average issued cost. The saved row's `cost` from the DB is shown in the toast.
- Insert `usages (date, batch_id, item_id, kind, qty, note)`. Never send unit_cost or cost.

## Validation
| Rule | Where |
|---|---|
| Batch, date, item, qty > 0 required | form |
| ISSUE: item never purchased up to date | DB → "This item has no purchase on or before this date…" |
| ISSUE: qty > store balance | warning only |
| RETURN: qty > issued to batch | form check + DB `usage_return_too_much` |
| RETURN: item never issued to batch | item hidden from the list in RETURN mode; DB as backup |

## After save
Toast "Saved — 5 bags Grower feed → B-001 · ৳15,500". "Save & add another" keeps batch, date and kind, and clears
item and qty.
