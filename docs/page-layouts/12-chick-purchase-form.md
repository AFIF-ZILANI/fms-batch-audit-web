# 12 · Chick purchase form

**Purpose:** record the chicks placed into a batch and what they cost. This sets the batch's "chicks placed".
**Routes:** `/chick-purchases/new?batch=`, `/chick-purchases/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Chick purchase                    │
├──────────────────────────────────────┤
│ Batch *                              │
│ [ B-003 · started 02 Oct       ▾ ]   │
│ Date *              Supplier *       │
│ [ 02 Oct 2026 ]     [ Hatchery   ▾ ] │
│                                      │
│ Chicks placed *                      │
│ [ 3,000                          ]   │
│ Rate per chick *      Discount       │
│ [ 52         ]        [ 0       ]    │
│                                      │
│ ┌ Result ─────────────────────────┐  │
│ │ Total     ৳1,56,000             │  │
│ │ Net       ৳1,56,000             │  │
│ └─────────────────────────────────┘  │
│                                      │
│ PAYMENT                              │
│ Paid now              Method         │
│ [ 1,00,000   ]        [Cash|Bank|Mobile]
│ Due after save: ৳56,000  PARTIALLY   │
│                                      │
│ + Add note (e.g. extra/free chicks)  │
├──────────────────────────────────────┤
│              [   Save   ]            │
└──────────────────────────────────────┘
```

## Data
- New: RPC `create_chick_purchase(p_date, p_batch_id, p_supplier_id, p_chicks_placed, p_rate, p_discount, p_paid,
  p_method, p_note)`.
- Edit: `update chick_purchases`; payments handled separately.

## Validation
- Chicks > 0, rate > 0, discount ≤ total, paid ≤ net.
- Date before batch start: amber "Before batch start (01 Aug). It will show in data checks."
- Second chick purchase for the same batch: info "B-003 already has 3,000 chicks. This adds more." (allowed: split
  deliveries).
- Free extra chicks (hatchery bonus): enter them in the count. The rate is per *paid* chick, so put the value of the
  free chicks in Discount. The note field hint says this.
