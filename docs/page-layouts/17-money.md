# 17 · Money (dues overview)

**Purpose:** who we owe, who owes us, and which bills are open.
**Route:** `/money?tab=suppliers|buyers|bills`

## Wireframe
```
┌──────────────────────────────────────┐
│ Money                                │
├──────────────────────────────────────┤
│ ┌────────────────┬─────────────────┐ │
│ │ We owe         │ Owed to us      │ │
│ │ ৳3,71,500      │ ৳68,000         │ │
│ └────────────────┴─────────────────┘ │
│ [ Suppliers | Buyers | Unpaid bills ]│  Tabs
├──────────────────────────────────────┤
│ (Suppliers tab, sorted by due desc)  │
│ ┌──────────────────────────────────┐ │
│ │ Hatchery · SUP-01                │ │
│ │ Billed ৳4,04,000  Paid ৳2,00,000 │ │
│ │                  Due ৳2,04,000 › │ │  → /money/supplier/1
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Feed dealer · SUP-02             │ │
│ │ Billed ৳4,70,000  Paid ৳3,02,500 │ │
│ │                  Due ৳1,67,500 › │ │
│ └──────────────────────────────────┘ │
│ ▸ Settled (due ৳0) — 3               │  collapsed
│                                      │
│ (Unpaid bills tab, oldest first)     │
│ ┌──────────────────────────────────┐ │
│ │ 01 Aug  CHICKS  Hatchery         │ │
│ │ 5,000 chicks   due ৳48,000 PART. │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Data
- Totals: `sum(due)` of `v_supplier_balance` / `v_buyer_balance`.
- Suppliers / Buyers tabs: those views, `due > 0` first, settled collapsed.
- Unpaid bills: `v_bills where due > 0 order by date`, with party name; filter chip SUPPLIER/BUYER.

## Actions
Tap party → Party detail (18). Tap bill → Entry detail (15). FAB-style button "Record payment" →
`/payments/new?party=…`.

## States
Nothing owed: "All settled ✓" in the tab.
