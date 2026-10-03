# Design — Sonali Batch Audit v1

Covers UX principles, information architecture, the visual system (Tailwind + shadcn/ui), reusable patterns and the
technical design. Page-by-page blueprints are in `page-layouts/`.

---

## 1. UX principles

1. **Operational first.** The app exists to get today's numbers in quickly and see whether a batch is on track.
   Every screen answers "what do I need to enter or check now?"
2. **≤ 3 taps to any daily entry.** `+` → entry type → form. Reminders on Home open the form already prefilled.
3. **Smart defaults.** Date = today, batch = last used, shed = last used for that batch, payment method = last used,
   feed unit weight = 50 kg. The user types only what changed.
4. **Show the result while typing.** Sale form shows crates, net kg, amount and due live. Weight form shows avg g.
   Usage form shows cost and store balance. No surprises after saving.
5. **Not a spreadsheet, not a showcase.** Cards and short lists on phone, tables only for a few columns. No decorative
   charts in v1: numbers, labels, status colours.
6. **Never lose data, never hide mistakes.** Delete = soft delete with reason; problems surface on Home.
7. **One thumb.** Primary actions sit at the bottom; touch targets ≥ 44 px; inputs 16 px+ (prevents iOS zoom).
8. **Honest numbers.** "Gross margin" is always labelled "excl. labour & electricity". FCR is marked "est." while a
   batch is running.

---

## 2. Information architecture

```
Bottom nav (always visible on phone; left sidebar on ≥ 1024 px)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   Home   │ Batches  │   (+)    │  Money   │   More   │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

| Route | Page | Blueprint |
|---|---|---|
| `/login` | Login | 01 |
| `/` | Home | 02 |
| `/batches` | Batch list | 03 |
| `/batches/:id` | Batch summary | 04 |
| `/batches/new`, `/batches/:id/edit` | Batch form | 05 |
| `(+)` sheet | Add menu | 06 |
| `/usages/new`, `/usages/:id/edit` | Usage form (issue / return) | 07 |
| `/mortalities/new`, `/mortalities/:id/edit` | Mortality form | 08 |
| `/weights/new`, `/weights/:id/edit` | Weight form | 09 |
| `/sales/new`, `/sales/:id/edit` | Sale form | 10 |
| `/purchases/new`, `/purchases/:id/edit` | Purchase form | 11 |
| `/chick-purchases/new`, `/chick-purchases/:id/edit` | Chick purchase form | 12 |
| `/payments/new`, `/payments/:id/edit` | Payment form | 13 |
| `/entries/:type` | Entry list (any ledger) | 14 |
| `/entries/:type/:id` | Entry detail (view / edit / delete / restore) | 15 |
| `/stock` | Stock | 16 |
| `/money` | Money (dues overview) | 17 |
| `/money/:party/:id` | Supplier / buyer detail | 18 |
| `/settings/:master` | Master data (sheds, items, suppliers, buyers) | 19 |
| `/checks` | Data checks | 20 |
| `/export` | Export | 21 |
| `/more` | More menu | 22 |

Query params prefill forms: `/usages/new?batch=3&kind=ISSUE`, `/payments/new?party=SUPPLIER&bill=PURCHASE:12`.

---

## 3. Visual system

### 3.1 shadcn/ui components used (and only these)

| Need | Component |
|---|---|
| Buttons, icon buttons | `Button` (default, secondary, outline, ghost, destructive) |
| Text / number / date inputs | `Input` (`type="date"`, `inputMode="decimal"`), `Label`, `Textarea` (note) |
| Pickers | `Select` for short enums; `Command` inside `Popover` (combobox) for batches, items, suppliers, buyers |
| Toggles | `ToggleGroup` (Issue / Return, grade A/B/C, reason, method) |
| Containers | `Card`, `Separator`, `Accordion` (collapsible sections on batch summary) |
| Navigation | `Tabs` (Money, Batch summary sections), `Sheet` (bottom sheet: Add menu, filters) |
| Lists / small tables | `Table` (≤ 5 columns), card lists for wider data |
| Status | `Badge` |
| Feedback | `Sonner` toast, `Alert` (warnings), `AlertDialog` (confirm delete / close batch), `Skeleton` |
| Forms | `Form` (react-hook-form + zod) |

No other UI kits. Icons: `lucide-react` (ships with shadcn).

### 3.2 Colour tokens (shadcn CSS variables, neutral base)

Base theme: shadcn **neutral**, light mode by default, dark mode supported by shadcn tokens.
Semantic colours used **only** for meaning:

| Token | Use | Tailwind |
|---|---|---|
| `success` | PAID, balance OK, good checks | `emerald-600` text / `emerald-50` bg |
| `warning` | PARTIALLY, reminders, sample < 30 | `amber-600` / `amber-50` |
| `danger` | DUE, data problems, negative stock, balance ≠ 0 on closed batch | `red-600` / `red-50` |
| `info` | OPEN batch, estimates | `sky-600` / `sky-50` |
| `muted` | CLOSED batch, voided rows | `muted-foreground` |
| `primary` | Main actions, (+) button | shadcn `primary` (near black) |

Badges:

| Badge | Style |
|---|---|
| `OPEN` | info outline |
| `CLOSED` | muted |
| `PAID` | success |
| `PARTIALLY` | warning |
| `DUE` | danger |
| `ISSUE` / `RETURN` | outline / warning outline |
| `DELETED` | muted, line-through row |

### 3.3 Typography & spacing
- Font: system UI stack (`font-sans`), no web fonts (faster on rural mobile data).
- Sizes: page title `text-xl font-semibold`; section title `text-sm font-medium text-muted-foreground uppercase`;
  body `text-base`; KPI value `text-2xl font-semibold tabular-nums`; KPI label `text-xs text-muted-foreground`.
- All numbers use `tabular-nums` so columns line up.
- Page padding `px-4`, section gap `space-y-4`, card padding `p-4`, max content width `max-w-screen-sm` on phone
  layouts (forms), `max-w-screen-lg` for lists on desktop.

### 3.4 Number & date formats (`src/lib/format.ts`)

| Kind | Format | Example |
|---|---|---|
| Money | `৳` + lakh grouping, no decimals in lists, 2 in detail | ৳12,68,000 |
| Weight kg | up to 3 decimals, trimmed | 6,345 kg · 42.5 kg |
| Avg weight | grams, no decimals | 850 g |
| Percent | 1 decimal | 6.0% |
| FCR | 2 decimals | 1.85 |
| Qty | item unit, trimmed decimals | 40 bags · 2.5 bottles |
| Date | `02 Oct 2026`; in lists `02 Oct` (current year) | |
| Age | `Day 45 · Wk 7` | |

---

## 4. Patterns

### 4.1 Entry form pattern
```
┌ Header: ← Back      Title            ┐
│ [Batch combobox]   (default last used)│
│ [Date]             (default today)    │
│ …fields (one column, large inputs)…   │
│ ┌ Live result card (muted bg) ──────┐ │
│ │ Net 6,345 kg · ৳12,68,000 · Due … │ │
│ └───────────────────────────────────┘ │
│ [Note] (collapsed "Add note")         │
├───────────────────────────────────────┤
│ [Save & add another]  [   Save    ]   │  ← sticky bottom bar
└───────────────────────────────────────┘
```
- Validation: zod schema mirrors DB rules (required, > 0, etc.). The DB is the final judge; its errors are mapped to
  plain text and shown under the relevant field or as a toast.
- On save failure, the form stays filled.
- Edit mode: same form, title "Edit …", extra "Delete" (destructive ghost) in the header menu.

### 4.2 List pattern (entries, masters)
- Card rows on phone: line 1 = main fact (e.g. "40 bags · Grower feed"), line 2 = batch · date · amount, right side
  = badge/amount. Tap → detail.
- Filter bar: batch chip + date range chip → bottom `Sheet` with filters. "Show deleted" toggle.
- Pagination: "Load more" (50 at a time). Newest first.
- Empty state: one sentence + primary button ("No sales yet. Add sale").

### 4.3 Delete / archive pattern
- Ledger/bill: `AlertDialog` "Delete this entry?" + required reason → `is_void = true`, note appended
  `[deleted: reason]`. Toast with **Undo** (5 s). Bills: "This also deletes 2 payments (৳2,00,000)."
- Master: try delete → on FK error offer "Archive". Archived items show in a collapsed "Archived" section.

### 4.4 Feedback & states
| State | Pattern |
|---|---|
| Loading | `Skeleton` blocks matching the layout (no spinners on full pages) |
| Saved | Toast "Saved — ৳1,20,000 feed cost" |
| Error (network) | Toast "No connection — not saved. Try again." Form keeps values. |
| Error (rule) | Inline under field, e.g. "Only 90 bags are still issued to B-001" |
| Warning (allowed) | Amber `Alert` above Save, e.g. "Store shows 12 bags, you're issuing 20" |
| Empty | Short sentence + action button |

### 4.5 Error mapping (`src/lib/errors.ts`)
| DB signal | Message |
|---|---|
| hint `usage_no_purchase` | "This item has no purchase on or before this date. Record the purchase first." |
| hint `usage_return_too_much` | DB message as-is (it includes the numbers) |
| hint `usage_return_not_issued` | "This item was never issued to this batch." |
| hint `payment_too_much` | DB message as-is |
| hint `payment_no_bill` | "That bill was deleted." |
| code `23505` unique | "This code is already used." |
| code `23503` FK on delete | "Used in other records — archive instead." |
| code `23514` check `sales_net` | "Crate deduction is larger than the weight." |
| code `23514` check `items_feed_needs_weight` | "Feed needs kg per bag." |
| code `23514` check `batches_dates` | "Close date can't be before start date." |
| code `23514` check `chick_purchases_discount` | "Discount is more than the total price." |
| other | "Couldn't save: <db message>" |

---

## 5. Technical design

### 5.1 Stack
| Concern | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Routing | React Router |
| Server state | TanStack Query (cache, refetch after mutations) |
| Forms | react-hook-form + zod |
| Backend | Supabase: Postgres (schema in `schema.md`), Auth (email/password), PostgREST via `@supabase/supabase-js` |
| Types | `npm run gen:types` (scripts/gen-db-types.mjs, same output shape as `supabase gen types`) → `src/lib/database.types.ts` |
| CSV export | `papaparse` + `jszip` (client-side) |
| Hosting | Vercel (static SPA, rewrite all routes to `index.html`) |

### 5.2 Folder structure
```
src/
  main.tsx, App.tsx                # providers, router, auth gate
  lib/
    supabase.ts                    # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
    database.types.ts              # generated
    format.ts                      # money, kg, g, %, dates
    errors.ts                      # DB error → message
    defaults.ts                    # last-used batch/shed/method (localStorage)
    queries/                       # one file per resource: hooks useBatches(), useBatchSummary(id), …
  components/
    ui/                            # shadcn generated
    layout/ AppShell.tsx, BottomNav.tsx, PageHeader.tsx
    pickers/ BatchPicker.tsx, ItemPicker.tsx, PartyPicker.tsx, BillPicker.tsx, ShedPicker.tsx
    common/ Kpi.tsx, StatusBadge.tsx, LiveResult.tsx, EmptyState.tsx, ConfirmDelete.tsx, Money.tsx
  features/
    batches/ BatchListPage, BatchSummaryPage, BatchFormPage
    usages/ UsageFormPage
    mortalities/ …  weights/ …  sales/ …  purchases/ …  chick-purchases/ …  payments/ …
    entries/ EntryListPage, EntryDetailPage, entryTypes.ts   # config per ledger: columns, labels, form route
    masters/ MasterPage, masterTypes.ts                      # config per master
    money/ MoneyPage, PartyDetailPage
    stock/ StockPage
    checks/ DataChecksPage
    export/ ExportPage
    home/ HomePage
```

### 5.3 Config over repetition
- **Masters** (4 tables) share one `MasterPage` driven by `masterTypes.ts` (fields, labels, list line).
- **Entry lists/details** (7 ledgers) share `EntryListPage`/`EntryDetailPage` driven by `entryTypes.ts`.
- **Entry forms** are hand-written (7), because each has its own live calculation and pickers, but they share
  `PageHeader`, `LiveResult`, pickers and the sticky save bar.

### 5.4 Data access rules
- Reads of totals come from **views** (`v_batch_summary`, `v_bills`, …), never recomputed in the browser, except
  *live previews* in forms, which mirror the SQL formulas and are replaced by DB values after save.
- Bills with "paid now" are created via RPC (`create_purchase`, `create_chick_purchase`, `create_sale`).
- Every list query filters `is_void = false` unless "Show deleted" is on.
- Mutations invalidate related queries (e.g. saving a usage invalidates `batch-summary`, `item-stock`, `reminders`).

### 5.5 Auth & security
- `AuthGate` checks `supabase.auth.getSession()`; listens to `onAuthStateChange`.
- Env vars (Vercel + `.env.local`, never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Never** in the frontend or repo: service role key, DB password, connection string.
- Supabase: sign-ups disabled, one user, RLS on all tables (see `schema.md` §5).

### 5.6 Performance budget
- First load < 250 KB gzipped JS; routes lazy-loaded.
- Home makes ≤ 4 queries (`v_batch_summary` open, `v_reminders`, `v_data_checks` count, balances).
