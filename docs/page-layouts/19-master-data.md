# 19 · Master data (sheds, items, suppliers, buyers)

**Purpose:** full CRUD for the lists everything else picks from. One page component, four configs.
**Route:** `/settings/sheds`, `/settings/items`, `/settings/suppliers`, `/settings/buyers`

## Wireframe: list
```
┌──────────────────────────────────────┐
│ ←  Items                     [+ Add] │
├──────────────────────────────────────┤
│ 🔍 Search name or code               │
├──────────────────────────────────────┤
│ FEED                                 │
│ ┌──────────────────────────────────┐ │
│ │ Grower feed          FD-01    ›  │ │
│ │ bag · 50 kg                      │ │
│ └──────────────────────────────────┘ │
│ MEDICINE                             │
│ ┌──────────────────────────────────┐ │
│ │ Medicine X           MED-01   ›  │ │
│ │ bottle                           │ │
│ └──────────────────────────────────┘ │
│ ▸ Archived (2)                       │
└──────────────────────────────────────┘
```

## Wireframe: add / edit (bottom Sheet on phone, dialog on desktop)
```
┌──────────────────────────────────────┐
│ Edit item                        ✕   │
│ Code *         [ FD-01            ]  │
│ Name *         [ Grower feed      ]  │
│ Category *     [ Feed           ▾ ]  │
│ Unit *         [ bag            ▾ ]  │  common units + free text
│ Kg per unit *  [ 50               ]  │  FEED only, default 50
│ Note           [                  ]  │
│                                      │
│ [Delete]                  [ Save ]   │
└──────────────────────────────────────┘
```

## Fields per master (`masterTypes.ts`)
| Master | Fields | List line | Code suggestion |
|---|---|---|---|
| Sheds | code, name, type (Brooder/Grower), note | name · type | `S#` |
| Items | code, name, category, unit, unit_weight_kg (FEED), note | name · unit (· kg) grouped by category | `FD-##`, `MED-##`, `VAC-##`, `HSK-##` |
| Suppliers | code, name, company, phone, note | name · company · phone | `SUP-##` |
| Buyers | code, name, company, phone, note | name · company · phone | `BUY-##` |

## Delete / archive
1. Delete → `AlertDialog` "Delete Grower feed?" → hard delete.
2. If the DB returns FK error `23503`: "Grower feed is used in 42 entries and can't be deleted. Archive it instead?
   It will disappear from pickers but stay in history." → `is_active = false`.
3. Archived section → open → "Unarchive".

## Validation
Code unique (`23505` → "This code is already used"). Name required. FEED requires kg per unit. Phone: digits,
spaces and + only. Changing a code shows a warning: "Codes are used for the FMS migration. Change only if it's a typo."
