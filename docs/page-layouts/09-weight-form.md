# 09 · Weight form

**Purpose:** record the weekly sample weighing and immediately see growth.
**Routes:** `/weights/new?batch=`, `/weights/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Weight sample                     │
├──────────────────────────────────────┤
│ Batch *                              │
│ [ B-001 · Day 62               ▾ ]   │
│ Date *                               │
│ [ 02 Oct 2026                    ]   │
│                                      │
│ Birds weighed *                      │
│ ┌────────────────────────────────┐   │
│ │ 50                             │   │
│ └────────────────────────────────┘   │
│ Total weight (kg) *                  │
│ ┌────────────────────────────────┐   │
│ │ 52.5                           │   │
│ └────────────────────────────────┘   │
│                                      │
│ ┌ Result ─────────────────────────┐  │
│ │ Avg 1,050 g  · Day 62 · Wk 9    │  │
│ │ +200 g since 01 Sep (850 g)     │  │
│ │ Flock est. 2,835 kg (2,700 live)│  │
│ └─────────────────────────────────┘  │
│ ⚠ Small sample (< 30 birds) —       │  amber when sample_size < 30
│   result may be misleading          │
│                                      │
│ + Add note                           │
├──────────────────────────────────────┤
│              [   Save   ]            │
└──────────────────────────────────────┘
```

## Data
Insert `weights (date, batch_id, sample_size, total_weight_kg, note)`. Previous sample from `v_batch_weights`
(latest before this date). Live birds from `v_batch_summary`.

## Validation
- Sample size integer > 0; total kg > 0.
- Avg weight below the previous sample: amber "Lower than last sample (850 g). Check the numbers." (allowed).
- Avg > 5,000 g or < 20 g: block, "Check units: total weight is in kg".
