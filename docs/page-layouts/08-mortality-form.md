# 08 · Mortality form

**Purpose:** record dead or culled birds quickly, with where and why.
**Routes:** `/mortalities/new?batch=`, `/mortalities/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Mortality                         │
├──────────────────────────────────────┤
│ Batch *                              │
│ [ B-001 · Day 62 · 2,700 live  ▾ ]   │
│ Date *                               │
│ [ 02 Oct 2026                    ]   │
│ Shed *                               │
│ [ S3 · Grower 1                ▾ ]   │  default: last shed used for this batch
│                                      │
│ Dead birds *                         │
│ ┌────────────────────────────────┐   │
│ │ 12                             │   │
│ └────────────────────────────────┘   │
│                                      │
│ Reason                               │
│ [ Normal | Accident | Illness ]      │  ToggleGroup, default Normal
│                                      │
│ ┌ Result ─────────────────────────┐  │
│ │ Today: 12 (0.24% of placed)     │  │
│ │ Total: 312 · 6.2%               │  │
│ │ Live after: 2,688               │  │
│ └─────────────────────────────────┘  │
│ ⚠ Unusual: 3× the 7-day average     │  (Should) amber if today > 3× recent daily average
│                                      │
│ + Add note (e.g. symptoms)           │
├──────────────────────────────────────┤
│ [Save & add another]   [   Save   ]  │
└──────────────────────────────────────┘
```

## Data
Insert `mortalities (date, batch_id, shed_id, dead_count, reason, note)`. Preview numbers from `v_batch_summary`.
Sheds: `sheds where is_active`.

## Validation
- All fields except note required; dead_count integer > 0.
- Dead count > live birds: block with "Only 2,700 birds are live in B-001".
- If reason = Illness, the note field is shown open (encourage writing symptoms).
