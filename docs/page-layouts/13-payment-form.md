# 13 · Payment form (pay supplier / receive from buyer)

**Purpose:** settle a due later, fully or in parts, against a specific bill.
**Routes:** `/payments/new?party=SUPPLIER|BUYER&party_id=&bill=TYPE:ID`, `/payments/:id/edit`

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Pay supplier                      │  title: "Receive from buyer" for BUYER
├──────────────────────────────────────┤
│ [ Pay supplier | Receive from buyer ]│  ToggleGroup (party)
│                                      │
│ Supplier *                           │
│ [ Feed dealer · due ৳1,67,500  ▾ ]   │  only parties with due > 0 listed first
│                                      │
│ Bill *                               │
│ ┌──────────────────────────────────┐ │  unpaid bills, oldest first (radio list)
│ │ ○ 20 Aug  Grower feed × 50 bag   │ │
│ │           ৳1,65,000 · due ৳1,65,000 DUE │
│ │ ● 30 Jul  Medicine X × 10 bottle │ │
│ │           ৳5,000 · due ৳2,500 PARTIALLY │
│ └──────────────────────────────────┘ │
│                                      │
│ Date *                               │
│ [ 02 Oct 2026                    ]   │
│ Amount *                             │
│ [ 2,500                          ]   │  default = full due of selected bill
│ Method                               │
│ [ Cash | Bank | Mobile ]             │
│                                      │
│ ┌ Result ─────────────────────────┐  │
│ │ Bill after: due ৳0  → PAID      │  │
│ │ Feed dealer due after: ৳1,65,000│  │
│ └─────────────────────────────────┘  │
│ + Add note (txn id, cheque no)       │
├──────────────────────────────────────┤
│ [Save & add another]   [   Save   ]  │
└──────────────────────────────────────┘
```

## Data
- Parties: `v_supplier_balance` / `v_buyer_balance` (active first, due desc).
- Bills: `v_bills where party = :party and party_id = :id and due > 0 order by date`.
- Insert `payments (date, party, chick_purchase_id | purchase_id | sale_id, amount, method, note)`.

## Validation
- Amount > 0 and ≤ bill due (form + DB `payment_too_much` → "Payment ৳X is more than the remaining due ৳Y").
- One payment = one bill. Paying several bills at once: "Save & add another" keeps party, date and method, and moves
  to the next unpaid bill.

## Entry points
Add menu (Pay/Receive) · Party detail "Record payment" · Bill detail (sale/purchase/chick purchase) "Record payment"
(party and bill prefilled).
