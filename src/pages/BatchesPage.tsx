import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { EmptyState, ErrorNote, ListSkeleton, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dateShortOrFull, fixed2, money, moneyShort, num, pct } from "@/lib/format"
import { useBatchSummaries } from "@/lib/queries"

type Filter = "OPEN" | "CLOSED" | "ALL"

export function BatchesPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useBatchSummaries()
  const [filter, setFilter] = useState<Filter>("OPEN")

  const all = data ?? []
  const counts = { OPEN: all.filter((b) => b.status === "OPEN").length, CLOSED: all.filter((b) => b.status === "CLOSED").length }
  const rows = all
    .filter((b) => filter === "ALL" || b.status === filter)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1
      const ka = (a.status === "CLOSED" ? a.close_date : a.start_date) ?? ""
      const kb = (b.status === "CLOSED" ? b.close_date : b.start_date) ?? ""
      return kb.localeCompare(ka)
    })

  return (
    <>
      <PageHeader
        title="Batches"
        actions={
          <Button size="sm" onClick={() => navigate("/batches/new")}>
            <PlusIcon /> New
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="OPEN">Open ({counts.OPEN})</TabsTrigger>
            <TabsTrigger value="CLOSED">Closed ({counts.CLOSED})</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading && <ListSkeleton />}
        {error && <ErrorNote error={error} />}
        {data && rows.length === 0 && (
          <EmptyState
            text={filter === "CLOSED" ? "No closed batches yet." : "No batches yet."}
            action={filter === "CLOSED" ? undefined : { label: "Create batch", onClick: () => navigate("/batches/new") }}
          />
        )}

        {rows.map((b) => (
          <Card key={b.id} className="cursor-pointer gap-1 p-4 active:bg-accent" onClick={() => navigate(`/batches/${b.id}`)}>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{b.code}</span>
              <StatusBadge status={b.status} />
            </div>
            {b.status === "OPEN" ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Started {dateShortOrFull(b.start_date)} · Day {b.age_days}
                </div>
                <div className="text-sm tabular-nums">
                  {num(b.live_balance)} live · {pct(b.mortality_pct)} mort · {moneyShort(b.total_cost)} cost
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  {dateShortOrFull(b.start_date)} – {dateShortOrFull(b.close_date)} · {b.age_days} days
                </div>
                <div className="text-sm tabular-nums">
                  Mort {pct(b.mortality_pct)} · FCR {fixed2(b.fcr)} · {money(b.cost_per_kg, 2)}/kg
                </div>
                <div className="flex justify-between text-sm tabular-nums">
                  <span>Gross margin {money(b.gross_margin)}</span>
                  {b.live_balance !== 0 && <span className="font-medium text-red-600">⚠ balance {num(b.live_balance)}</span>}
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
