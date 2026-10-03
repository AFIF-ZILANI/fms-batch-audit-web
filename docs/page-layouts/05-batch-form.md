# 05 · Batch form (create / edit)

**Purpose:** start a new batch in seconds; correct its details later.
**Routes:** `/batches/new`, `/batches/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  New batch                         │
├──────────────────────────────────────┤
│ Batch code *                         │
│ ┌────────────────────────────────┐   │
│ │ B-003                          │   │  suggested: next B-### (editable)
│ └────────────────────────────────┘   │
│ Start date (placement) *             │
│ ┌────────────────────────────────┐   │
│ │ 02 Oct 2026                    │   │  default today
│ └────────────────────────────────┘   │
│ Note                                 │
│ ┌────────────────────────────────┐   │
│ │ e.g. Brooder 1, chicks from X  │   │
│ └────────────────────────────────┘   │
│                                      │
│ (edit mode only)                     │
│ Close date                           │
│ ┌────────────────────────────────┐   │
│ │ —                              │   │  empty = open
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│              [   Save   ]            │
└──────────────────────────────────────┘

After creating:
┌ ✓ B-003 created ───────────────────┐
│ Next: record the chicks placed.    │
│ [Later]        [Add chick purchase]│  → /chick-purchases/new?batch=<id>
└────────────────────────────────────┘
```

## Data
Insert/update `batches (code, start_date, close_date, note)`. Next code: highest `B-###` + 1.

## Validation
- Code required and unique ("This code is already used").
- Start date required. Close date ≥ start date.
- Changing the start date in edit mode: warn if existing entries would fall before the new date (they'll appear in
  Data checks).

## Actions
Save. In edit mode, header ⋮ → Delete (only if the batch has no entries; otherwise a dialog explains:
"B-001 has 34 entries. Close it instead.").
