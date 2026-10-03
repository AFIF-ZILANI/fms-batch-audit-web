# 22 · More

**Purpose:** everything that isn't daily: lists, stock, setup, safety, account.
**Route:** `/more`

## Wireframe
```
┌──────────────────────────────────────┐
│ More                                 │
├──────────────────────────────────────┤
│ RECORDS                              │
│  🌾 Usages                         › │  → /entries/usages
│  ✝  Mortality                      › │  → /entries/mortalities
│  ⚖  Weights                        › │  → /entries/weights
│  🐔 Sales                          › │  → /entries/sales
│  🛒 Purchases                      › │  → /entries/purchases
│  🐣 Chick purchases                › │  → /entries/chick-purchases
│  💳 Payments                       › │  → /entries/payments
│                                      │
│ STORE                                │
│  📦 Stock                          › │  → /stock
│                                      │
│ SETUP                                │
│  🏠 Sheds                          › │  → /settings/sheds
│  🏷  Items                          › │  → /settings/items
│  🚚 Suppliers                      › │  → /settings/suppliers
│  🧾 Buyers                         › │  → /settings/buyers
│                                      │
│ SAFETY                               │
│  ⛔ Data checks              (3)   › │  → /checks, count badge
│  ⬇  Export data                    › │  → /export
│                                      │
│ ACCOUNT                              │
│  you@example.com                     │
│  [ Log out ]                         │
│                                      │
│ v1.0 · Gross margin excludes labour  │
│ & electricity                        │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Notes
Plain list rows (≥ 48 px). On desktop (≥ 1024 px) these become sidebar groups and More disappears.
