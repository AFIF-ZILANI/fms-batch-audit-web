# 03 · Batches

**Purpose:** find any batch; see open vs closed results at a glance.
**Route:** `/batches`

## Wireframe
```
┌──────────────────────────────────────┐
│ Batches                    [+ New]   │
├──────────────────────────────────────┤
│ [ Open (2) | Closed (5) | All ]      │  Tabs
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ B-002                     OPEN   │ │
│ │ Started 15 Sep · Day 17          │ │
│ │ 2,950 live · 1.7% mort · ৳3.1L   │ │  ← cost so far
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ B-001                     OPEN   │ │
│ │ Started 01 Aug · Day 62          │ │
│ │ 2,700 live · 6.0% mort · ৳5.3L   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ (Closed tab)                         │
│ ┌──────────────────────────────────┐ │
│ │ B-000                    CLOSED  │ │
│ │ 01 May – 12 Jul · 72 days        │ │
│ │ Mort 5.2% · FCR 2.10 · ৳82.8/kg  │ │
│ │ Margin ৳7,42,600       ⚠ bal -10 │ │  ← red flag if live_balance ≠ 0
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Data
`v_batch_summary`, ordered: open by start_date desc, closed by close_date desc.

## Actions
- `[+ New]` → `/batches/new`.
- Tap card → `/batches/:id`.

## States
Empty: "No batches yet. [Create first batch]". Loading: 3 skeleton cards.
Later (F-69): "Compare" toggle on the Closed tab → table view.
