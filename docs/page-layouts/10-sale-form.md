# 10 · Sale form

**Purpose:** record a sale exactly as it happens at the scale: birds, crates, deduction, rate, cash received.
**Routes:** `/sales/new?batch=`, `/sales/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Sale                              │
├──────────────────────────────────────┤
│ Batch *                              │
│ [ B-001 · 4,700 live           ▾ ]   │
│ Date *              Buyer *          │
│ [ 01 Oct 2026 ]     [ Trader     ▾ ] │  buyer combobox + "New buyer" inline
│                                      │
│ BIRDS                                │
│ Male          Female       Grade     │
│ [ 1,200 ]     [ 800  ]     [A|B|C]   │
│                                      │
│ WEIGHT                               │
│ Gross weight on scale (kg) *         │
│ [ 2,843                          ]   │
│ Deduction per crate (g)              │
│ [ 1,000                          ]   │  default: last used
│                                      │
│ PRICE                                │
│ Rate per kg (net) *   Discount       │
│ [ 200        ]        [ 0       ]    │
│                                      │
│ ┌ Result ─────────────────────────┐  │  live
│ │ 2,000 birds · 143 crates        │  │
│ │ Deduction 143 kg                │  │
│ │ Net 2,700 kg · avg 1.35 kg/bird │  │
│ │ Amount        ৳5,40,000         │  │
│ └─────────────────────────────────┘  │
│                                      │
│ PAYMENT                              │
│ Received now          Method         │
│ [ 4,72,000   ]        [Cash|Bank|Mobile]
│ Due after save: ৳68,000  PARTIALLY   │
│                                      │
│ + Add note                           │
├──────────────────────────────────────┤
│              [   Save   ]            │
└──────────────────────────────────────┘
```

## Formulas (mirror DB, preview only)
`birds = male + female` · `crates = ceil(gross / 20)` · `deduction_kg = crates × ded_g / 1000` ·
`net = gross − deduction_kg` · `amount = round(net × rate − discount, 2)` · `due = amount − received`.

## Data
- New: RPC `create_sale(p_date, p_batch_id, p_buyer_id, p_male_count, p_female_count, p_grade, p_gross_weight_kg,
  p_deduction_per_crate_g, p_rate, p_discount, p_received, p_method, p_note)`.
- Edit: `update sales` (inputs only). The PAYMENT section is replaced by "Paid ৳4,72,000 · Due ৳68,000
  [Record payment]" because payments are managed separately once the sale exists.

## Validation
- Male + female > 0; birds sold ≤ live birds (block: "Only 2,700 birds are live").
- Net weight > 0 ("Crate deduction is larger than the weight").
- Received ≤ amount. Discount ≥ 0 and amount ≥ 0.
- Avg kg/bird outside 0.5–3.5: amber "Check weight: 4.1 kg per bird looks wrong".
- Mixed grades in one delivery → save one sale per grade ("Save & add another" keeps batch, date, buyer, rate).
