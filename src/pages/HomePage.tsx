import { useState } from "react"
import { ChevronRightIcon } from "lucide-react"
import { Link, useNavigate } from "react-router"
import { EmptyState, ErrorNote, Kpi, KpiGrid, ListSkeleton, SectionTitle, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDataCheckCount, useMoneyStrip, useReminders, useTodayCounts } from "@/features/home/queries"
import { lastExportDaysAgo } from "@/features/safety/lastExport"
import { age, dateShortOrFull, grams, money, moneyShort, num, pct, today } from "@/lib/format"
import { useBatchSummaries } from "@/lib/queries"

export function HomePage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useBatchSummaries()
  const reminders = useReminders().data ?? []
  const problems = useDataCheckCount().data ?? 0
  const moneyStrip = useMoneyStrip().data
  const todayCounts = useTodayCounts().data
  const exportAge = lastExportDaysAgo()
  const open = (data ?? []).filter((b) => b.status === "OPEN")
  const [todayLabel] = useState(() => {
    const d = new Date()
    return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${dateShortOrFull(today())}`
  })

  return (
    <>
      <PageHeader title="Home" actions={<span className="pr-2 text-sm text-muted-foreground">{todayLabel}</span>} />
      <div className="space-y-4 p-4">
        {(exportAge === null || exportAge > 7) && (
          <Link to="/export" className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {exportAge === null ? "No backup yet — export your data" : `Last export: ${exportAge} days ago — export again`}
          </Link>
        )}
        {reminders.length > 0 && (
          <Card className="gap-1 border-amber-200 bg-amber-50 p-3 text-amber-800">
            <div className="text-sm font-medium">To do</div>
            {reminders.map((r) => (
              <div key={`${r.kind}-${r.batch_id}`} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <b>{r.batch_code}</b> {r.message}
                </span>
                <Button asChild size="sm" variant="outline" className="shrink-0 bg-background">
                  <Link to={`${r.kind === "NO_WEIGHT" ? "/weights/new" : "/usages/new"}?batch=${r.batch_id}`}>Add</Link>
                </Button>
              </div>
            ))}
          </Card>
        )}
        {problems > 0 && (
          <Link
            to="/checks"
            className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
          >
            {problems} data {problems === 1 ? "problem" : "problems"}
            <ChevronRightIcon className="size-4" />
          </Link>
        )}
        <SectionTitle>Running batches</SectionTitle>
        {isLoading && <ListSkeleton rows={2} />}
        {error && <ErrorNote error={error} />}
        {data && open.length === 0 && (
          <EmptyState text="No running batch." action={{ label: "Create batch", onClick: () => navigate("/batches/new") }} />
        )}
        {open.map((b) => (
          <Card key={b.id} className="cursor-pointer gap-3 p-4 active:bg-accent" onClick={() => navigate(`/batches/${b.id}`)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{b.code}</div>
                <div className="text-sm text-muted-foreground">{age(b.age_days)}</div>
              </div>
              <StatusBadge status={b.status} />
            </div>
            <KpiGrid>
              <Kpi value={num(b.live_balance)} label="live birds" />
              <Kpi value={pct(b.mortality_pct)} label="mortality" />
              <Kpi
                value={grams(b.latest_avg_weight_g)}
                label={b.latest_weight_date ? dateShortOrFull(b.latest_weight_date) : "no weight yet"}
              />
              <Kpi value={num(b.feed_bags)} label="feed bags" />
              <Kpi value={b.fcr_estimated == null ? "—" : `${b.fcr_estimated.toFixed(2)}e`} label="FCR (est.)" />
              <Kpi value={moneyShort(b.total_cost)} label="cost so far" />
            </KpiGrid>
            <div className="text-sm text-muted-foreground">
              Today: {todayCounts?.[b.id ?? -1] ?? 0} entries {(todayCounts?.[b.id ?? -1] ?? 0) > 0 && "✓"}
            </div>
          </Card>
        ))}

        {moneyStrip && (
          <>
            <SectionTitle>Money</SectionTitle>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
              <Link to="/money?tab=suppliers">
                <Kpi value={money(moneyStrip.weOwe)} label="We owe" />
              </Link>
              <Link to="/money?tab=buyers">
                <Kpi value={money(moneyStrip.owedToUs)} label="Owed to us" />
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}
