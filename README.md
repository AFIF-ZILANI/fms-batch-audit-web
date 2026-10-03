# fms-batch-audit-web

Temporary batch audit app for a Sonali poultry farm, used until the main FMS is live.
Phone-first web app: Vite + React + TypeScript, Tailwind + shadcn/ui, Supabase, hosted on Vercel.

Product docs: [`docs/prd.md`](docs/prd.md) · [`docs/features.md`](docs/features.md) · [`docs/design.md`](docs/design.md) ·
[`docs/schema.md`](docs/schema.md) · [`docs/page-layouts/`](docs/page-layouts/README.md)

## Status

| Milestone | Scope | State |
|---|---|---|
| M1 Foundation | Login, layout, sheds/items/suppliers/buyers CRUD, batch create/edit/close/reopen, batch summary (birds + cost) | ✅ done |
| M2 Daily entry | Usage (issue/return), mortality, weight | next |
| M3 Money | Chick purchase, purchase, sale, payments, Money page | |
| M4 Insight | Home reminders, full batch summary, stock, data checks, export | |
| M5 Hardening | Polish, phone testing, deploy | |

## Set up Supabase (once)

1. **Apply the schema:** Supabase Dashboard → SQL Editor → New query → paste
   [`supabase/migrations/20261002000000_init.sql`](supabase/migrations/20261002000000_init.sql) → Run.
   Then the same with [`supabase/seed.sql`](supabase/seed.sql) (your 5 sheds). Run each once on an empty project.
2. **Create your user:** Authentication → Users → Add user → email + password (tick "Auto confirm").
3. **Turn off sign-ups:** Authentication → Sign In / Providers → Email → disable "Allow new users to sign up".
   Without this, anyone who finds the URL can register and read your data.
4. **Keys:** Project Settings → API. The app needs only the **project URL** and the **publishable (anon) key**.
   Never put the service_role key or the database password in this app, the repo or Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:5173
```

| Script | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | oxlint |
| `npm run gen:types` | Regenerate `src/lib/database.types.ts` from a database: `DATABASE_URL=postgresql://… npm run gen:types` |

## Deploy (Vercel)

1. Import the GitHub repo in Vercel (framework preset: Vite).
2. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy. `vercel.json` already rewrites all routes to `index.html`.

## Code layout

```
src/
  components/ui/       shadcn/ui components (new-york v4)
  components/layout/   AppShell, BottomNav, AddSheet, PageHeader
  components/common/   KPI tiles, status badges, empty/error states, save bar
  features/masters/    one config-driven page for sheds, items, suppliers, buyers
  pages/               login, home, batches, batch form, batch summary, more
  lib/                 supabase client, generated DB types, queries, formatting, error messages, auth
supabase/              migration + seed (single source of truth for the database)
scripts/               DB type generator
```

Rules that matter (from `docs/design.md`): totals come from database views, never recomputed in the browser;
generated columns are never sent from the UI; "delete" on records is a soft delete.
