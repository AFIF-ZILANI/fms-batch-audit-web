/* eslint-disable @typescript-eslint/no-explicit-any */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { PlusIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router"
import { EmptyState, ErrorNote, ListSkeleton, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { dateShortOrFull } from "@/lib/format"
import { unwrap, useBatchSummaries } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { db, deletedReason, entryConfigs, isEntryType, type EntryConfig, type FilterDef, type Row } from "./entryTypes"

const PAGE = 50
const ALL = "all"

type Filters = { batch: string; from: string; to: string; deleted: boolean; extra: Record<string, string> }

function readFilters(cfg: EntryConfig, sp: URLSearchParams): Filters {
  return {
    batch: cfg.hasBatch ? (sp.get("batch") ?? "") : "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    deleted: sp.get("deleted") === "1",
    extra: Object.fromEntries(cfg.filters.map((f) => [f.param, sp.get(f.param) ?? ""])),
  }
}

/** Applies filters to a PostgREST builder. Deleted rows are hidden unless asked for (or `withDeleted` is false). */
function applyFilters(q: any, cfg: EntryConfig, f: Filters, showDeleted: boolean, statusIds: number[] | null) {
  if (f.batch) q = q.eq("batch_id", Number(f.batch))
  if (f.from) q = q.gte("date", f.from)
  if (f.to) q = q.lte("date", f.to)
  for (const def of cfg.filters) {
    const v = f.extra[def.param]
    if (!v) continue
    q = def.param === "status" ? q.in("id", statusIds?.length ? statusIds : [0]) : q.eq(def.column, v)
  }
  return showDeleted ? q : q.eq("is_void", false)
}

export function EntryListPage() {
  const { type } = useParams()
  if (!isEntryType(type)) return <Navigate to="/more" replace />
  return <EntryList key={type} cfg={entryConfigs[type]} />
}

function EntryList({ cfg }: { cfg: EntryConfig }) {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [open, setOpen] = useState(false)
  const f = readFilters(cfg, sp)
  const batches = useBatchSummaries()
  const batchCode = batches.data?.find((b) => String(b.id) === f.batch)?.code

  // Bill status/due per bill from v_bills (one query per type; fine at single-farm size).
  // ponytail: PostgREST caps responses at 1000 rows; add paging here if one bill type ever exceeds that.
  const bills = useQuery({
    queryKey: ["entries", cfg.type, "bills"],
    enabled: !!cfg.bill,
    queryFn: async () => {
      const rows = unwrap(await db("v_bills").select("bill_id, amount, paid, due, payment_status").eq("bill_type", cfg.bill!.type)) as Row[]
      return new Map(rows.map((r) => [r.bill_id as number, r]))
    },
  })
  const billsReady = !cfg.bill || bills.isSuccess
  const statusIds =
    f.extra.status && bills.data ? [...bills.data.values()].filter((b) => b.payment_status === f.extra.status).map((b) => b.bill_id as number) : null

  const filterKey = [f.batch, f.from, f.to, f.deleted, JSON.stringify(f.extra), statusIds?.join(",")]

  const list = useInfiniteQuery({
    queryKey: ["entries", cfg.type, "list", ...filterKey],
    enabled: billsReady,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const q = applyFilters(db(cfg.table).select(cfg.select), cfg, f, f.deleted, statusIds)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam * PAGE, pageParam * PAGE + PAGE - 1)
      return unwrap(await q) as Row[]
    },
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length : undefined),
  })

  // Summary over ALL matching non-deleted rows (not just the loaded pages).
  // ponytail: capped by PostgREST max rows (1000 default); move to a SQL view/RPC if totals ever exceed that.
  const summary = useQuery({
    queryKey: ["entries", cfg.type, "summary", ...filterKey],
    enabled: billsReady,
    queryFn: async () => cfg.summary(unwrap(await applyFilters(db(cfg.table).select(cfg.summarySelect), cfg, f, false, statusIds)) as Row[], bills.data ?? new Map()),
  })

  const rows = list.data?.pages.flat() ?? []
  const groups: { date: string; rows: Row[] }[] = []
  for (const r of rows) {
    const g = groups.at(-1)
    if (g && g.date === r.date) g.rows.push(r)
    else groups.push({ date: r.date, rows: [r] })
  }

  const setParams = (next: Filters) => {
    const p = new URLSearchParams()
    if (next.batch) p.set("batch", next.batch)
    if (next.from) p.set("from", next.from)
    if (next.to) p.set("to", next.to)
    if (next.deleted) p.set("deleted", "1")
    for (const [k, v] of Object.entries(next.extra)) if (v) p.set(k, v)
    setSp(p, { replace: true })
  }

  // [+ Add] keeps the batch and any simple filter so the form opens prefilled.
  const addParams = new URLSearchParams()
  if (f.batch) addParams.set("batch", f.batch)
  for (const [k, v] of Object.entries(f.extra)) if (v && k !== "status") addParams.set(k, v)
  const addUrl = `/${cfg.type}/new${addParams.size ? `?${addParams}` : ""}`

  const filtered = !!(f.batch || f.from || f.to || Object.values(f.extra).some(Boolean))
  const emptyText = `No ${cfg.title.toLowerCase()}${batchCode ? ` for ${batchCode}` : ""}${f.from || f.to ? " in this date range" : ""}${filtered ? " with these filters" : " yet"}.`

  return (
    <>
      <PageHeader
        title={cfg.title}
        back
        backTo="/more"
        actions={
          <Button size="sm" onClick={() => navigate(addUrl)}>
            <PlusIcon /> Add
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {batchCode && <Chip label={`Batch: ${batchCode}`} onOpen={() => setOpen(true)} onClear={() => setParams({ ...f, batch: "" })} />}
          {(f.from || f.to) && (
            <Chip
              label={`${f.from ? dateShortOrFull(f.from) : "…"} – ${f.to ? dateShortOrFull(f.to) : "…"}`}
              onOpen={() => setOpen(true)}
              onClear={() => setParams({ ...f, from: "", to: "" })}
            />
          )}
          {cfg.filters.map((d) => {
            const v = f.extra[d.param]
            return v ? (
              <Chip key={d.param} label={`${d.label}: ${optionLabel(d, v)}`} onOpen={() => setOpen(true)} onClear={() => setParams({ ...f, extra: { ...f.extra, [d.param]: "" } })} />
            ) : null
          })}
          {f.deleted && <Chip label="Showing deleted" onOpen={() => setOpen(true)} onClear={() => setParams({ ...f, deleted: false })} />}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <SlidersHorizontalIcon /> Filter
          </Button>
        </div>
        {summary.data && <p className="text-sm text-muted-foreground tabular-nums">{summary.data}</p>}

        {(list.isLoading || !billsReady) && <ListSkeleton />}
        {(list.error || bills.error) && <ErrorNote error={list.error ?? bills.error} />}
        {list.isSuccess && rows.length === 0 && <EmptyState text={emptyText} action={{ label: `Add ${cfg.singular.toLowerCase()}`, onClick: () => navigate(addUrl) }} />}

        {groups.map((g) => (
          <section key={g.date} className="space-y-2">
            <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{dateShortOrFull(g.date)}</h2>
            {g.rows.map((r) => (
              <EntryCard key={r.id} cfg={cfg} row={r} bill={bills.data?.get(r.id)} onClick={() => navigate(`/entries/${cfg.type}/${r.id}`)} />
            ))}
          </section>
        ))}

        {list.hasNextPage && (
          <Button variant="outline" className="h-11 w-full" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            {list.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>

      <FilterSheet cfg={cfg} open={open} onClose={() => setOpen(false)} value={f} onApply={setParams} />
    </>
  )
}

function optionLabel(d: FilterDef, v: string) {
  return d.options?.find((o) => o.value === v)?.label ?? `#${v}`
}

function Chip({ label, onOpen, onClear }: { label: string; onOpen: () => void; onClear: () => void }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-background text-sm">
      <button type="button" className="py-1 pr-1 pl-3" onClick={onOpen}>
        {label}
      </button>
      <button type="button" aria-label={`Clear ${label}`} className="py-1 pr-2 pl-1 text-muted-foreground" onClick={onClear}>
        <XIcon className="size-3.5" />
      </button>
    </span>
  )
}

function EntryCard({ cfg, row, bill, onClick }: { cfg: EntryConfig; row: Row; bill?: Row; onClick: () => void }) {
  const void_ = row.is_void as boolean
  const reason = deletedReason(row.note)
  const badge = cfg.badge?.(row)
  return (
    <Card className={cn("cursor-pointer flex-row items-center gap-3 px-4 py-3 active:bg-accent", void_ && "bg-muted/50")} onClick={onClick}>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-2", void_ && "text-muted-foreground line-through")}>
          <span className="truncate font-medium">{cfg.line1(row)}</span>
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {cfg.line2(row)}
          {void_ && reason ? ` · "${reason}"` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {cfg.right && <span className={cn("font-medium tabular-nums", void_ && "text-muted-foreground line-through")}>{cfg.right(row)}</span>}
        {void_ ? (
          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
            DELETED
          </Badge>
        ) : (
          <>
            {badge && (
              <Badge variant="outline" className="border-amber-200 text-amber-700">
                {badge}
              </Badge>
            )}
            {bill && <StatusBadge status={bill.payment_status} />}
          </>
        )}
      </div>
    </Card>
  )
}

function useMasterOptions(table: "items" | "suppliers" | "buyers" | "sheds" | undefined) {
  return useQuery({
    queryKey: ["masterOptions", table],
    enabled: !!table,
    queryFn: async () => unwrap(await supabase.from(table!).select("id, name").order("code")) as { id: number; name: string }[],
  })
}

/** One type-specific filter: fixed options or a master table. */
function ExtraFilter({ def, value, onChange }: { def: FilterDef; value: string; onChange: (v: string) => void }) {
  const master = useMasterOptions(def.master)
  const options = def.options ?? (master.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))
  return <FilterSelect id={`f-${def.param}`} label={def.label} value={value} onChange={onChange} options={options} />
}

function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FilterSheet({ cfg, open, onClose, value, onApply }: { cfg: EntryConfig; open: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void }) {
  const batches = useBatchSummaries() // includes closed batches
  const [draft, setDraft] = useState(value)
  const [wasOpen, setWasOpen] = useState(false)
  // Start from the applied filters each time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(value)
  }
  const set = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }))

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-screen-sm overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Filter {cfg.title.toLowerCase()}</SheetTitle>
          <SheetDescription className="sr-only">Batch, dates and other filters</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          {cfg.hasBatch && (
            <FilterSelect
              id="f-batch"
              label="Batch"
              value={draft.batch}
              onChange={(v) => set({ batch: v })}
              options={(batches.data ?? []).map((b) => ({ value: String(b.id), label: `${b.code}${b.status === "CLOSED" ? " (closed)" : ""}` }))}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="f-from">From</Label>
              <Input id="f-from" type="date" className="h-11" value={draft.from} onChange={(e) => set({ from: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-to">To</Label>
              <Input id="f-to" type="date" className="h-11" value={draft.to} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </div>
          {cfg.filters.map((d) => (
            <ExtraFilter key={d.param} def={d} value={draft.extra[d.param]} onChange={(v) => set({ extra: { ...draft.extra, [d.param]: v } })} />
          ))}
          <div className="flex items-center justify-between">
            <Label htmlFor="f-deleted">Show deleted</Label>
            <Switch id="f-deleted" checked={draft.deleted} onCheckedChange={(c) => set({ deleted: c })} />
          </div>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="ghost" onClick={() => setDraft({ batch: "", from: "", to: "", deleted: false, extra: Object.fromEntries(cfg.filters.map((d) => [d.param, ""])) })}>
            Clear
          </Button>
          <Button
            className="h-11 flex-1"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
