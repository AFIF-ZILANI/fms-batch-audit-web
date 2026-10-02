import { useState } from "react"
import { useNavigate } from "react-router"
import { EmptyState, ErrorNote, Kpi, KpiGrid, ListSkeleton, SectionTitle, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui/card"
import { age, dateShortOrFull, grams, moneyShort, num, pct, today } from "@/lib/format"
import { useBatchSummaries } from "@/lib/queries"

// M1 version of docs/page-layouts/02-home.md: running batches only.
// Reminders, data problems and the money strip arrive with milestone M4.
export function HomePage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useBatchSummaries()
  const open = (data ?? []).filter((b) => b.status === "OPEN")
  const [todayLabel] = useState(() => {
    const d = new Date()
    return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${dateShortOrFull(today())}`
  })

  return (
    <>
      <PageHeader title="Home" actions={<span className="pr-2 text-sm text-muted-foreground">{todayLabel}</span>} />
      <div className="space-y-4 p-4">
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
          </Card>
        ))}
      </div>
    </>
  )
}
