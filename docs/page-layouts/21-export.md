# 21 · Export

**Purpose:** a backup the user owns (the Supabase free plan has no backups) and the migration path to the FMS.
**Route:** `/export`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Export data                       │
├──────────────────────────────────────┤
│ Download all records as CSV files    │
│ (opens in Excel / Google Sheets).    │
│                                      │
│ Last export: 24 Sep 2026 (8 days ago)│
│                                      │
│ ┌──────────────────────────────────┐ │
│ │  ⬇  Download all data (.zip)     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Includes:                            │
│ ✓ 12 tables (incl. deleted rows)     │
│ ✓ Batch summary                      │
│ ✓ Bills with paid / due              │
│ ✓ Stock                              │
│                                      │
│ ℹ Do this every week and keep the    │
│   file in Google Drive or email it   │
│   to yourself.                       │
└──────────────────────────────────────┘
```

## Behaviour
- Fetches every table (all rows including `is_void`, paged 1,000 at a time) and the views `v_batch_summary`,
  `v_bills`, `v_item_stock`. Converts each to CSV (`papaparse`) and zips (`jszip`).
- File name: `batch-audit-export-2026-10-02.zip`; one CSV per table/view with headers = column names.
- Dates as `YYYY-MM-DD`, numbers unformatted (no ৳, no commas) so they import cleanly.
- Saves `lastExportAt` in localStorage (drives the Home reminder).
- Progress text while running: "Exporting sales… 7/15".

## Per-batch export (F-82)
From batch summary ⋮ → one CSV: summary row + its usages, mortalities, weights, sales, chick purchases.
