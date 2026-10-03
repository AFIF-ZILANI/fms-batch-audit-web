# 18 · Party detail (supplier / buyer)

**Purpose:** everything with one supplier or buyer: contact, balance, bills, payments.
**Route:** `/money/supplier/:id`, `/money/buyer/:id`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Feed dealer                   ⋮   │  ⋮ = Edit contact · Archive
├──────────────────────────────────────┤
│ SUP-02 · Rahman Feeds Ltd            │
│ 📞 01XXXXXXXXX            [Call]     │  tel: link
│                                      │
│ ┌──────────┬──────────┬───────────┐  │
│ │ Billed   │ Paid     │ Due       │  │
│ │ ৳4,70,000│ ৳3,02,500│ ৳1,67,500 │  │
│ └──────────┴──────────┴───────────┘  │
│ [      Record payment      ]         │  → /payments/new?party=SUPPLIER&party_id=2
│                                      │
│ [ Bills | Payments ]                 │  Tabs
│ (Bills, newest first)                │
│ ┌──────────────────────────────────┐ │
│ │ 20 Aug  Grower feed × 50 bag     │ │
│ │ ৳1,65,000   due ৳1,65,000   DUE  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 30 Jul  Medicine X × 10 bottle   │ │
│ │ ৳5,000      due ৳2,500  PARTIALLY│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ 30 Jul  Grower feed × 100 bag    │ │
│ │ ৳3,00,000              PAID      │ │
│ └──────────────────────────────────┘ │
│ (Payments tab)                       │
│ 30 Jul  Bank   ৳2,500   Medicine X   │
│ 30 Jul  Cash   ৳3,00,000 Grower feed │
└──────────────────────────────────────┘
```

## Data
- Header: `v_supplier_balance` / `v_buyer_balance where id`.
- Bills: `v_bills where party = … and party_id = :id`.
- Payments: `payments` joined with the bill description from `v_bills`.

## Actions
Record payment · tap bill → entry detail · tap payment → payment detail · Edit contact → master form (19).
