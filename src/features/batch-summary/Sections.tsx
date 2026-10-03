import { ChevronDownIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"
import { ErrorNote, Row, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dateShortOrFull, grams, kg, money, num } from "@/lib/format"
import {
  useBatchChickBills,
  useBatchMortalities,
  useBatchSales,
  useBatchUsages,
  useBatchWeights,
} from "./queries"

const LATEST = 5

// ponytail: native <details> instead of the shadcn Accordion (not installed); open by default per docs.
function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details open className="group space-y-2">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
        <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      {children}
    </details>
  )
}

function Hint({ text, to, label }: { text: string; to?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
      <span>{text}</span>
      {to && (
        <Button asChild size="sm" variant="outline">
          <Link to={to}>{label}</Link>
        </Button>
      )}
    </div>
  )
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="block pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
      {label} ›
    </Link>
  )
}

/** Shared loading / error / empty handling for a section body. */
function Body<T>({
  q,
  empty,
  children,
}: {
  q: { data: T[] | undefined; error: unknown; isLoading: boolean }
  empty: ReactNode
  children: (rows: T[]) => ReactNode
}) {
  if (q.isLoading) return <Skeleton className="h-20 w-full rounded-xl" />
  if (q.error) return <ErrorNote error={q.error} />
  if (!q.data?.length) return empty
  return <>{children(q.data)}</>
}

/** Tiny SVG line chart of avg weight by age (F-68). Rows come newest first. */
function WeightCurve({ rows }: { rows: { age_days: number | null; avg_weight_g: number | null }[] }) {
  const pts = rows
    .filter((r) => r.age_days != null && r.avg_weight_g != null)
    .map((r) => [r.age_days as number, r.avg_weight_g as number])
    .sort((a, b) => a[0] - b[0])
  if (pts.length < 2) return null
  const [x0, x1] = [pts[0][0], pts[pts.length - 1][0]]
  const y1 = Math.max(...pts.map((p) => p[1]))
  const sx = (x: number) => 4 + ((x - x0) / (x1 - x0 || 1)) * 232
  const sy = (y: number) => 56 - (y / y1) * 52
  return (
    <svg viewBox="0 0 240 60" className="h-16 w-full text-sky-600" role="img" aria-label="Average weight by age">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")} />
      {pts.map((p) => (
        <circle key={p[0]} cx={sx(p[0])} cy={sy(p[1])} r="2.5" fill="currentColor" />
      ))}
    </svg>
  )
}

export function WeightSection({ id }: { id: number }) {
  const q = useBatchWeights(id)
  return (
    <Section title="Weight">
      <Body q={q} empty={<Hint text="No weight samples yet." to={`/weights/new?batch=${id}`} label="Add weight" />}>
        {(rows) => (
          <Card className="gap-2 px-4 py-2">
            <WeightCurve rows={rows} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">Gain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, LATEST).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{dateShortOrFull(r.date)}</TableCell>
                    <TableCell className="tabular-nums">
                      D{r.age_days} W{(r.age_week ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{grams(r.avg_weight_g)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.gain_g == null ? "—" : `${r.gain_g > 0 ? "+" : ""}${num(r.gain_g)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > LATEST && <SeeAll to={`/entries/weights?batch=${id}`} label="See all weights" />}
          </Card>
        )}
      </Body>
    </Section>
  )
}

export function UsageSection({ id }: { id: number }) {
  const q = useBatchUsages(id)
  // Group by item: issued / returned / net.
  const items = new Map<number, { name: string; unit: string; w: number | null; feed: boolean; issued: number; returned: number }>()
  for (const u of q.data ?? []) {
    if (!u.items) continue
    const it = items.get(u.items.id) ?? {
      name: u.items.name,
      unit: u.items.unit,
      w: u.items.unit_weight_kg,
      feed: u.items.category === "FEED",
      issued: 0,
      returned: 0,
    }
    if (u.kind === "ISSUE") it.issued += u.qty
    else it.returned += u.qty
    items.set(u.items.id, it)
  }
  return (
    <Section title="Feed & inputs">
      <Body
        q={{ ...q, data: [...items.values()] }}
        empty={<Hint text="No usage recorded yet." to={`/usages/new?batch=${id}&kind=ISSUE`} label="Add usage" />}
      >
        {(rows) => (
          <Card className="gap-0 px-4 py-2">
            {rows.map((it) => {
              const net = it.issued - it.returned
              return (
                <div key={it.name} className="py-1.5">
                  <div className="font-medium">{it.name}</div>
                  <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
                    <span>
                      issued {num(it.issued)}
                      {it.returned > 0 && ` · returned ${num(it.returned)}`}
                    </span>
                    <span>
                      net {num(net)} {it.unit}
                      {it.feed && it.w != null && ` · ${kg(net * it.w)}`}
                    </span>
                  </div>
                </div>
              )
            })}
            <SeeAll to={`/entries/usages?batch=${id}`} label="See all usages" />
          </Card>
        )}
      </Body>
    </Section>
  )
}

export function MortalitySection({ id }: { id: number }) {
  const q = useBatchMortalities(id)
  const byReason = { NORMAL: 0, ACCIDENT: 0, ILLNESS: 0 }
  for (const m of q.data ?? []) byReason[m.reason] += m.dead_count
  return (
    <Section title="Mortality">
      <Body q={q} empty={<Hint text="No deaths recorded." to={`/mortalities/new?batch=${id}`} label="Add mortality" />}>
        {(rows) => (
          <Card className="gap-0 px-4 py-2">
            <div className="flex flex-wrap gap-x-4 pb-1 text-sm font-medium tabular-nums">
              {Object.entries(byReason)
                .filter(([, n]) => n > 0)
                .map(([r, n]) => (
                  <span key={r}>
                    {r[0] + r.slice(1).toLowerCase()} {num(n)}
                  </span>
                ))}
            </div>
            {rows.slice(0, LATEST).map((m) => (
              <div key={m.id} className="flex items-baseline justify-between gap-2 py-1 text-sm">
                <span>
                  {dateShortOrFull(m.date)} <span className="text-muted-foreground">{m.sheds?.name}</span>
                </span>
                <span className="tabular-nums">
                  {num(m.dead_count)} <span className="text-xs text-muted-foreground">{m.reason}</span>
                </span>
              </div>
            ))}
            <SeeAll to={`/entries/mortalities?batch=${id}`} label="See all mortalities" />
          </Card>
        )}
      </Body>
    </Section>
  )
}

export function SalesSection({ id }: { id: number }) {
  const q = useBatchSales(id)
  return (
    <Section title="Sales">
      <Body q={q} empty={<Hint text="No sales yet." to={`/sales/new?batch=${id}`} label="Add sale" />}>
        {(rows) => (
          <Card className="gap-0 px-4 py-2">
            {rows.slice(0, LATEST).map((s) => (
              <div key={s.bill_id} className="flex items-start justify-between gap-2 py-1.5 text-sm">
                <div>
                  <div>
                    {dateShortOrFull(s.date)} · {s.buyer}
                  </div>
                  <div className="text-muted-foreground tabular-nums">
                    {num(s.birds)} birds · {kg(s.netKg)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular-nums">{money(s.amount)}</span>
                  <StatusBadge status={s.payment_status} />
                </div>
              </div>
            ))}
            <div className="my-1 border-t" />
            <Row label="Received" value={money(rows.reduce((t, s) => t + (s.paid ?? 0), 0))} />
            <Row label="Due" strong value={money(rows.reduce((t, s) => t + (s.due ?? 0), 0))} />
            <SeeAll to={`/entries/sales?batch=${id}`} label="See all sales" />
          </Card>
        )}
      </Body>
    </Section>
  )
}

export function ChicksSection({ id }: { id: number }) {
  const q = useBatchChickBills(id)
  return (
    <Section title="Chicks">
      <Body
        q={q}
        empty={<Hint text="No chick purchase yet." to={`/chick-purchases/new?batch=${id}`} label="Add chick purchase" />}
      >
        {(rows) => (
          <Card className="gap-0 px-4 py-2">
            {rows.map((c) => (
              <div key={c.bill_id} className="flex items-start justify-between gap-2 py-1.5 text-sm">
                <div>
                  <div>
                    {dateShortOrFull(c.date)} · {c.supplier}
                  </div>
                  <div className="text-muted-foreground tabular-nums">
                    {num(c.chicks)} @ {money(c.rate)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular-nums">{money(c.amount)}</span>
                  <StatusBadge status={c.payment_status} />
                </div>
              </div>
            ))}
            <SeeAll to={`/entries/chick-purchases?batch=${id}`} label="See all chick purchases" />
          </Card>
        )}
      </Body>
    </Section>
  )
}

export function QuickActions({ id }: { id: number }) {
  const links: [string, string][] = [
    ["+ Usage", `/usages/new?batch=${id}&kind=ISSUE`],
    ["+ Mortality", `/mortalities/new?batch=${id}`],
    ["+ Weight", `/weights/new?batch=${id}`],
    ["+ Sale", `/sales/new?batch=${id}`],
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {links.map(([label, to]) => (
        <Button key={to} asChild variant="outline" size="sm" className="px-1">
          <Link to={to}>{label}</Link>
        </Button>
      ))}
    </div>
  )
}
