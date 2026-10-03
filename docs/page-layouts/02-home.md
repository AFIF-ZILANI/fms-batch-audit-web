# 02 · Home

**Purpose:** in 5 seconds: is anything missing today, how are the running batches, any problems, what money is open.
**Route:** `/`

## Wireframe
```
┌──────────────────────────────────────┐
│ Home                      Thu 02 Oct │
├──────────────────────────────────────┤
│ ┌ ⚠ To do ─────────────────────────┐ │  Reminders (hidden when empty)
│ │ B-002  No feed/usage since 30 Sep│ │  tap → /usages/new?batch=2
│ │                         [Add] ›  │ │
│ │ B-001  No weight in 7+ days      │ │  tap → /weights/new?batch=1
│ │                         [Add] ›  │ │
│ └──────────────────────────────────┘ │
│ ┌ ⛔ 2 data problems ─────────── › ┐ │  hidden when 0 → /checks
│ └──────────────────────────────────┘ │
│                                      │
│ RUNNING BATCHES                      │
│ ┌──────────────────────────────────┐ │
│ │ B-001                     OPEN   │ │  card → /batches/1
│ │ Day 62 · Wk 9                    │ │
│ │ ┌────────┬────────┬────────────┐ │ │
│ │ │ 2,700  │ 6.0%   │ 850 g      │ │ │
│ │ │ live   │ mort.  │ 01 Sep     │ │ │
│ │ ├────────┼────────┼────────────┤ │ │
│ │ │ 90 bag │ 1.85e  │ ৳5,25,400  │ │ │
│ │ │ feed   │ FCR    │ cost so far│ │ │
│ │ └────────┴────────┴────────────┘ │ │
│ │ Today: 2 entries ✓               │ │  (F-54)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ B-002                     OPEN   │ │
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│                                      │
│ MONEY                                │
│ ┌────────────────┬─────────────────┐ │
│ │ We owe         │ Owed to us      │ │  → /money?tab=suppliers / buyers
│ │ ৳3,71,500      │ ৳68,000         │ │
│ └────────────────┴─────────────────┘ │
│                                      │
│ Last export: 9 days ago  [Export ›]  │  (F-83, only if > 7 days)
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

## Sections & data
| Section | Source | Notes |
|---|---|---|
| To do | `v_reminders` | One row per reminder, action button opens prefilled form |
| Data problems | `count(*)` from `v_data_checks` | Red banner only when > 0 |
| Running batches | `v_batch_summary where status='OPEN'` order by start_date | KPIs: live_balance, mortality_pct, latest_avg_weight_g (+ date), feed_bags, fcr_estimated (suffix "e"), total_cost |
| Today | count of today's entries per batch (usages, mortalities, weights, sales) | Should |
| Money | `sum(due)` from `v_supplier_balance`, `v_buyer_balance` | |
| Last export | localStorage `lastExportAt` | Should |

## Actions
Tap reminder → form · tap batch card → batch summary · tap money tile → Money tab · (+) → Add menu.

## States
- No open batches: card "No running batch. [Create batch]".
- Loading: 2 skeleton cards. Error: inline "Couldn't load. Pull to refresh."
- Pull-to-refresh (or a refresh button in the header on desktop).
