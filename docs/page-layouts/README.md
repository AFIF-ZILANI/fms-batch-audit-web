# Page layout blueprints

One file per page. Each blueprint has: **purpose · route · wireframe (phone, 390 px) · sections · data · actions ·
validation · states**. Wireframes are structural, not visual. Styling rules are in `../design.md`.

| # | Page | Route | Features |
|---|---|---|---|
| 01 | [Login](01-login.md) | `/login` | F-01 |
| 02 | [Home](02-home.md) | `/` | F-50–F-54, F-83 |
| 03 | [Batches](03-batches.md) | `/batches` | F-25 |
| 04 | [Batch summary](04-batch-detail.md) | `/batches/:id` | F-22, F-23, F-60–F-67, F-82 |
| 05 | [Batch form](05-batch-form.md) | `/batches/new`, `/batches/:id/edit` | F-20, F-21, F-24 |
| 06 | [Add menu](06-add-menu.md) | `(+)` sheet | entry points |
| 07 | [Usage form](07-usage-form.md) | `/usages/new` | F-30, F-31 |
| 08 | [Mortality form](08-mortality-form.md) | `/mortalities/new` | F-32 |
| 09 | [Weight form](09-weight-form.md) | `/weights/new` | F-33 |
| 10 | [Sale form](10-sale-form.md) | `/sales/new` | F-36 |
| 11 | [Purchase form](11-purchase-form.md) | `/purchases/new` | F-35 |
| 12 | [Chick purchase form](12-chick-purchase-form.md) | `/chick-purchases/new` | F-34 |
| 13 | [Payment form](13-payment-form.md) | `/payments/new` | F-37 |
| 14 | [Entry list](14-entry-list.md) | `/entries/:type` | F-40, F-41 |
| 15 | [Entry detail](15-entry-detail.md) | `/entries/:type/:id` | F-38–F-40 |
| 16 | [Stock](16-stock.md) | `/stock` | F-70 |
| 17 | [Money](17-money.md) | `/money` | F-71, F-73 |
| 18 | [Party detail](18-party-detail.md) | `/money/:party/:id` | F-72 |
| 19 | [Master data](19-master-data.md) | `/settings/:master` | F-10–F-15 |
| 20 | [Data checks](20-data-checks.md) | `/checks` | F-52, F-80 |
| 21 | [Export](21-export.md) | `/export` | F-81 |
| 22 | [More](22-more.md) | `/more` | F-02, navigation |

Shared shell (every page except Login):
```
┌──────────────────────────────────────┐
│ ←  Page title                    ⋮   │  PageHeader (back only on sub-pages)
├──────────────────────────────────────┤
│                                      │
│             page content             │
│                                      │
├──────────────────────────────────────┤
│  Home   Batches   (+)   Money   More │  BottomNav (hidden on forms: sticky Save bar instead)
└──────────────────────────────────────┘
```
