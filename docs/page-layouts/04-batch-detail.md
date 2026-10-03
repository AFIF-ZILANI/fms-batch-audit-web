# 04 · Batch summary

**Purpose:** everything about one batch on one page: is it on track, what did it cost, what's left to do.
**Route:** `/batches/:id`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  B-001          OPEN           ⋮   │  ⋮ = Edit · Close/Reopen · Export CSV · Delete
├──────────────────────────────────────┤
│ Started 01 Aug 2026 · Day 62 · Wk 9  │
│                                      │
│ ┌────────┬────────┬────────────────┐ │  KPI grid (F-60)
│ │ 2,700  │ 6.0%   │ 850 g          │ │
│ │ live   │ mortal.│ avg wt · 01 Sep│ │
│ ├────────┼────────┼────────────────┤ │
│ │ 1.85 e │ 90     │ ৳5,25,400      │ │
│ │ FCR    │ bags   │ cost so far    │ │
│ └────────┴────────┴────────────────┘ │
│                                      │
│ [+Usage] [+Mortality] [+Weight] [+Sale]  quick actions (F-67), batch preselected
│                                      │
│ ▼ BIRDS                              │  Accordion sections (all open by default)
│   Placed            5,000            │
│   − Dead              300            │
│   − Sold            2,000            │
│   = Live            2,700            │  red if ≠ 0 on closed batch (F-61)
│                                      │
│ ▼ COST (excl. labour & electricity)  │  (F-62)
│   Chicks        ৳2,48,000   47%      │
│   Feed          ৳2,75,400   52%      │
│   Medicine          ৳2,000   0%      │
│   Vaccine               ৳0           │
│   Husk                  ৳0           │
│   ─────────────────────────────      │
│   Total         ৳5,25,400            │
│   Sales so far  ৳5,40,000            │
│   Margin so far   ৳14,600            │  (closed: Gross margin, per chick, cost/kg)
│                                      │
│ ▼ WEIGHT                             │  (F-63) v_batch_weights
│   Date    Age      Avg g   Gain      │
│   01 Sep  D31 W5   850    +350       │
│   22 Aug  D21 W4   500     —         │
│                                      │
│ ▼ FEED & INPUTS                      │  (F-65)
│   Grower feed  issued 100 · ret 10   │
│                net 90 bags · 4,500kg │
│   Medicine X   issued 4 bottles      │
│   [See all usages ›]                 │
│                                      │
│ ▼ MORTALITY                          │  (F-64)
│   Normal 200 · Illness 100           │
│   10 Sep  S3 Grower 1  100  ILLNESS  │
│   03 Aug  S1 Brooder 1 200  NORMAL   │
│   [See all ›]                        │
│                                      │
│ ▼ SALES                              │  (F-66)
│   01 Oct  Trader  2,000 · 2,700 kg   │
│           ৳5,40,000       PARTIALLY  │
│   Received ৳4,72,000 · Due ৳68,000   │
│   [See all ›]                        │
│                                      │
│ ▼ CHICKS                             │
│   01 Aug  Hatchery  5,000 @ ৳50      │
│           ৳2,48,000       PARTIALLY  │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Data
| Section | Source |
|---|---|
| Header, KPIs, birds, cost | `v_batch_summary where id = :id` |
| Weight | `v_batch_weights where batch_id = :id order by date desc` |
| Feed & inputs | `usages` (non-void) grouped by item and kind, joined `items` |
| Mortality | `mortalities` (non-void) + sum by reason, joined `sheds` |
| Sales | `v_bills where bill_type='SALE' and batch_id=:id` joined `sales` for birds/kg |
| Chicks | `v_bills where bill_type='CHICKS' and batch_id=:id` |

Lists inside sections show the latest 5; "See all" → `/entries/:type?batch=:id`.

## Actions
- **Close batch** → `AlertDialog`: close date (default today) + bird balance. If balance ≠ 0: "5 birds are unaccounted
  for. Close anyway?" (requires checking a box).
- **Reopen** → confirm → clears close_date.
- **KPI grid differs by status.** OPEN: live, mortality %, latest avg weight, FCR (est.), feed bags, cost so far.
  CLOSED: live (must be 0), mortality %, avg sale weight, final FCR, cost/kg, gross margin.
- **Edit** → `/batches/:id/edit`. **Export CSV** (F-82). **Delete** only if there are no entries.
- KPI labels: FCR shows "e" + tooltip "Estimated: feed ÷ (live birds × latest weight + sold kg)" while open.

## States
- No chick purchase yet: top `Alert` "No chicks recorded for this batch. [Add chick purchase]".
- Empty sections show a one-line hint + add button.
