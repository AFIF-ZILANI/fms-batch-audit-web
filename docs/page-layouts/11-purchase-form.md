# 11 · Purchase form (store purchase)

**Purpose:** record items bought into the store (feed, medicine, vaccine, husk). Not linked to a batch.
**Routes:** `/purchases/new`, `/purchases/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Purchase                          │
├──────────────────────────────────────┤
│ Date *                               │
│ [ 02 Oct 2026                    ]   │
│ Supplier *                           │
│ [ Feed dealer · SUP-02         ▾ ]   │  + "New supplier" inline
│ Item *                               │
│ [ Grower feed (bag)            ▾ ]   │  + "New item" inline
│                                      │
│ Quantity (bag) *     Unit price *    │
│ [ 50        ]        [ 3,300     ]   │  unit price default: last price paid
│                                      │
│ ┌ Result ─────────────────────────┐  │
│ │ Amount  ৳1,65,000               │  │
│ │ 2,500 kg feed                   │  │  FEED only
│ │ Store after: 105 bags           │  │
│ │ Last price ৳3,000 (+10%)        │  │  price change vs last purchase
│ └─────────────────────────────────┘  │
│                                      │
│ PAYMENT                              │
│ Paid now              Method         │
│ [ 0          ]        [Cash|Bank|Mobile]
│ [ Paid in full ] shortcut            │
│ Due after save: ৳1,65,000  DUE       │
│                                      │
│ + Add note (bill no, etc.)           │
├──────────────────────────────────────┤
│ [Save & add another]   [   Save   ]  │
└──────────────────────────────────────┘
```

## Data
- New: RPC `create_purchase(p_date, p_item_id, p_supplier_id, p_qty, p_unit_price, p_paid, p_method, p_note)`.
- Edit: `update purchases`; the payment section becomes "Paid … · Due … [Record payment]".
- Last price: latest non-void `purchases.unit_price` for the item.

## Validation
- Qty > 0, unit price ≥ 0, paid ≤ amount.
- Price change > 25% vs last purchase: amber "Price is 30% higher than last time. Correct?" (allowed).
- Editing qty/price after items were already issued changes the average for **future** issues only. Past usage costs
  are frozen. The edit screen says so.
