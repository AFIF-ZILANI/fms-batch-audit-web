# 16 · Stock

**Purpose:** what's in the store right now, per item, and what it's worth.
**Route:** `/stock`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Stock                  [+ Purchase]│
├──────────────────────────────────────┤
│ Store value  ৳1,73,500               │
│ [All | Feed | Medicine | Vaccine | Husk]  Tabs/chips
├──────────────────────────────────────┤
│ FEED                                 │
│ ┌──────────────────────────────────┐ │
│ │ Grower feed              55 bag  │ │  balance big, right
│ │ 2,750 kg · avg ৳3,100 · ৳1,70,500│ │
│ │ in 150 · out 105 · back 10       │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Starter feed              −2 bag │ │  red: negative (data problem)
│ │ used more than purchased         │ │
│ └──────────────────────────────────┘ │
│ MEDICINE                             │
│ ┌──────────────────────────────────┐ │
│ │ Medicine X             6 bottle  │ │
│ │ avg ৳500 · ৳3,000                │ │
│ │ in 10 · out 4 · back 0           │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Data
`v_item_stock` (active items; archived items with balance ≠ 0 still shown, greyed). kg = balance × unit_weight_kg
for FEED.

## Actions
- Tap item → entry list filtered: purchases and usages for that item (two tabs).
- `[+ Purchase]` → `/purchases/new`.

## Notes
- No physical count in v1. If the shed count differs from the screen, it means an entry is missing. Find it rather
  than "adjusting".
- Avg price = all purchases of the item (simple weighted average). Usage costs are frozen per entry, so this number
  is for stock value only.
