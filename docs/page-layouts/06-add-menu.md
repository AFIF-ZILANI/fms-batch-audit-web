# 06 · Add menu (+)

**Purpose:** the single entry point for every record. Most-used entries first.
**Route:** none. A bottom `Sheet` opened by the (+) nav button, available on every page.

## Wireframe
```
┌──────────────────────────────────────┐
│               ───                    │  drag handle
│ Add for batch: [ B-001 ▾ ]           │  default last used; passed to the form
│                                      │
│ DAILY                                │
│ ┌──────────┐┌──────────┐┌──────────┐ │
│ │   🌾     ││   ✝     ││   ⚖     │ │
│ │  Usage   ││Mortality ││  Weight  │ │
│ └──────────┘└──────────┘└──────────┘ │
│ ┌──────────┐                         │
│ │   ↩     │                         │
│ │ Return   │  (usage form, kind=RETURN)
│ └──────────┘                         │
│                                      │
│ SALES & BUYING                       │
│ ┌──────────┐┌──────────┐┌──────────┐ │
│ │   🐔     ││   🛒     ││   🐣     │ │
│ │  Sale    ││ Purchase ││  Chicks  │ │
│ └──────────┘└──────────┘└──────────┘ │
│                                      │
│ MONEY                                │
│ ┌──────────┐┌──────────┐             │
│ │   ⬆     ││   ⬇     │             │
│ │Pay supp. ││Receive   │             │
│ └──────────┘└──────────┘             │
│                                      │
│ ┌──────────┐                         │
│ │ + Batch  │                         │
│ └──────────┘                         │
└──────────────────────────────────────┘
```
(Icons from lucide-react; emoji here are placeholders.)

## Behaviour
| Tile | Goes to |
|---|---|
| Usage | `/usages/new?batch=<id>&kind=ISSUE` |
| Return | `/usages/new?batch=<id>&kind=RETURN` |
| Mortality | `/mortalities/new?batch=<id>` |
| Weight | `/weights/new?batch=<id>` |
| Sale | `/sales/new?batch=<id>` |
| Purchase | `/purchases/new` (no batch, store purchase) |
| Chicks | `/chick-purchases/new?batch=<id>` |
| Pay supplier | `/payments/new?party=SUPPLIER` |
| Receive | `/payments/new?party=BUYER` |
| + Batch | `/batches/new` |

- The batch selector lists OPEN batches only. If there's exactly one open batch it's preselected and fixed.
- On a batch summary page, (+) preselects that batch.
- Tiles are ≥ 88 px tall (easy thumb targets).
