# 20 · Data checks

**Purpose:** list every inconsistency in plain words, with a link to fix it. Goal: this page is empty.
**Route:** `/checks`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Data checks                       │
├──────────────────────────────────────┤
│ ⛔ 3 problems                         │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Closed batch: birds don't add up │ │
│ │ B-000 · live balance −10         │ │
│ │ 10 more birds dead/sold than     │ │  plain explanation
│ │ placed. Check mortality & sales. │ │
│ │                    [Open B-000 ›]│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Entry dated outside batch        │ │
│ │ Weight on 01 Dec · B-001 closed  │ │
│ │ 01 Oct                           │ │
│ │                  [Open entry ›]  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Item used more than purchased    │ │
│ │ Starter feed · balance −2 bag    │ │
│ │ A purchase is probably missing.  │ │
│ │                [Add purchase ›]  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ (when empty)                         │
│        ✓ No problems found           │
└──────────────────────────────────────┘
```

## Data
`v_data_checks` (check_name, ref_table, ref_id, ref_code, detail).

## Check → explanation → fix link
| check_name | Explanation shown | Button |
|---|---|---|
| Closed batch: live balance not 0 | "N birds unaccounted for / N more than placed. Check mortality and sales." | Open batch |
| Dead + sold exceeds chicks placed | "More birds dead/sold than placed. A chick purchase or sale count is wrong." | Open batch |
| Batch has no chick purchase | "Chicks placed is 0, so mortality % and margin can't be calculated." | Add chick purchase |
| Entry dated outside batch | "Dated before the batch started or after it closed." | Open entry |
| Item used more than purchased | "A purchase is probably missing, or a usage qty is wrong." | Add purchase |
| Bill paid more than its amount | "The bill amount was reduced after payment. Fix the amount or a payment." | Open bill |
