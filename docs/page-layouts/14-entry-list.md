# 14 · Entry list (generic)

**Purpose:** browse, filter and open any type of record. One component, configured per type.
**Route:** `/entries/:type`, where type ∈ `usages · mortalities · weights · sales · purchases · chick-purchases · payments`
(query: `?batch=&from=&to=&deleted=1`)

## Wireframe
```
┌──────────────────────────────────────┐
│ ←  Usages                    [+ Add] │
├──────────────────────────────────────┤
│ [Batch: B-001 ✕] [Sep 2026 ▾] [⚙]    │  filter chips; ⚙ opens filter Sheet
│ 34 entries · net cost ৳2,77,400      │  summary line per type (see table)
├──────────────────────────────────────┤
│ 30 SEP                               │  grouped by date
│ ┌──────────────────────────────────┐ │
│ │ ↩ Grower feed · 10 bag   RETURN  │ │
│ │ B-001                  −৳30,600  │ │
│ └──────────────────────────────────┘ │
│ 25 AUG                               │
│ ┌──────────────────────────────────┐ │
│ │ Grower feed · 60 bag             │ │
│ │ B-001                 ৳1,86,000  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │  deleted rows (only with "Show deleted")
│ │ ~~Medicine X · 2 bottle~~ DELETED│ │
│ │ B-001 · "wrong item"             │ │
│ └──────────────────────────────────┘ │
│           [ Load more ]              │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │
└──────────────────────────────────────┘
```

Filter sheet: Batch (combobox, incl. closed) · Date from/to · type-specific filter (item / buyer / supplier /
reason / status) · "Show deleted" switch.

## Per-type config (`entryTypes.ts`)
| Type | Card line 1 | Card line 2 / right | Summary line | Source |
|---|---|---|---|---|
| usages | item · qty unit (↩ if RETURN) | batch · cost | count · net cost | `usages` + items |
| mortalities | count dead · reason | batch · shed | total dead | `mortalities` + sheds |
| weights | avg g · Day N | batch · sample n | — | `v_batch_weights` |
| sales | birds · net kg · grade | batch · buyer · amount · status | birds, kg, amount, due | `sales` + `v_bills` |
| purchases | item · qty unit | supplier · amount · status | amount, due | `purchases` + `v_bills` |
| chick-purchases | chicks · @rate | batch · supplier · amount · status | chicks, amount, due | `chick_purchases` + `v_bills` |
| payments | ⬆ paid / ⬇ received · amount | party · bill · method | total paid, received | `payments` |

## Behaviour
- Newest first, 50 per page, "Load more".
- Tap card → `/entries/:type/:id`.
- Reached from: batch summary "See all", More menu ("All entries"), Money.
- Empty: "No usages for B-001 in Sep 2026." + Add button.
