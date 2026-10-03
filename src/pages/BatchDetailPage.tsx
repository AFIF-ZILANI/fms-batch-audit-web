import { useMutation, useQueryClient } from "@tanstack/react-query"
import { MoreVerticalIcon } from "lucide-react"
import { useState } from "react"
import { exportBatch } from "@/features/safety/exportBatch"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, Kpi, KpiGrid, ListSkeleton, Row, SectionTitle, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ChicksSection,
  MortalitySection,
  QuickActions,
  SalesSection,
  UsageSection,
  WeightSection,
} from "@/features/batch-summary/Sections"
import { errorMessage } from "@/lib/errors"
import { age, date, dateShortOrFull, fixed2, grams, kg, money, moneyShort, num, pct, today } from "@/lib/format"
import { keys, unwrap, useBatchSummary } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

export function BatchDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: b, isLoading, error } = useBatchSummary(id)
  const [closing, setClosing] = useState(false)
  const [closeDate, setCloseDate] = useState("")
  const [ackGap, setAckGap] = useState(false)

  const setClose = useMutation({
    mutationFn: async (close_date: string | null) =>
      unwrap(await supabase.from("batches").update({ close_date }).eq("id", id)),
    onSuccess: (_d, close_date) => {
      qc.invalidateQueries({ queryKey: keys.batchSummaries })
      toast.success(close_date ? `${b?.code} closed` : `${b?.code} reopened`)
      setClosing(false)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (isLoading)
    return (
      <>
        <PageHeader title="Batch" back backTo="/batches" />
        <div className="p-4">
          <ListSkeleton rows={4} />
        </div>
      </>
    )
  if (error || !b)
    return (
      <>
        <PageHeader title="Batch" back backTo="/batches" />
        <div className="p-4">
          <ErrorNote error={error ?? { message: "Batch not found" }} />
        </div>
      </>
    )

  const isOpen = b.status === "OPEN"
  const gap = b.live_balance ?? 0

  function openCloseDialog() {
    setCloseDate(today())
    setAckGap(false)
    setClosing(true)
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {b.code} <StatusBadge status={b.status} />
          </span>
        }
        back
        backTo="/batches"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Batch actions">
                <MoreVerticalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/batches/${id}/edit`)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportBatch(id, b.code)}>Export CSV</DropdownMenuItem>
              {isOpen ? (
                <DropdownMenuItem onSelect={openCloseDialog}>Close batch</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setClose.mutate(null)}>Reopen batch</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="space-y-5 p-4">
        <p className="text-sm text-muted-foreground">
          Started {date(b.start_date)} · {age(b.age_days)}
          {b.close_date && ` · closed ${date(b.close_date)}`}
        </p>

        {b.chicks_placed === 0 && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription className="text-amber-800">
              No chicks recorded for this batch yet.{" "}
              <Link to={`/chick-purchases/new?batch=${id}`} className="font-medium underline">
                Add chick purchase
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {isOpen ? (
          <KpiGrid>
            <Kpi value={num(b.live_balance)} label="live birds" />
            <Kpi value={pct(b.mortality_pct)} label="mortality" />
            <Kpi
              value={grams(b.latest_avg_weight_g)}
              label={b.latest_weight_date ? `avg · ${dateShortOrFull(b.latest_weight_date)}` : "no weight yet"}
            />
            <Kpi value={b.fcr_estimated == null ? "—" : `${b.fcr_estimated.toFixed(2)}e`} label="FCR (est.)" />
            <Kpi value={num(b.feed_bags)} label="feed bags" />
            <Kpi value={moneyShort(b.total_cost)} label="cost so far" />
          </KpiGrid>
        ) : (
          <KpiGrid>
            <Kpi value={num(b.live_balance)} label="live (must be 0)" tone={gap !== 0 ? "danger" : undefined} />
            <Kpi value={pct(b.mortality_pct)} label="mortality" />
            <Kpi value={kg(b.avg_sale_weight_kg)} label="avg sale weight" />
            <Kpi value={fixed2(b.fcr)} label="FCR" />
            <Kpi value={money(b.cost_per_kg, 2)} label="cost / kg" />
            <Kpi value={moneyShort(b.gross_margin)} label="gross margin" tone={(b.gross_margin ?? 0) < 0 ? "danger" : undefined} />
          </KpiGrid>
        )}

        {isOpen && <QuickActions id={id} />}

        <section className="space-y-2">
          <SectionTitle>Birds</SectionTitle>
          <Card className="gap-0 px-4 py-2">
            <Row label="Placed" value={num(b.chicks_placed)} />
            <Row label="− Dead" value={num(b.dead)} />
            <Row label="− Sold" value={num(b.birds_sold)} />
            <Row
              label="= Live"
              strong
              value={
                <span className={!isOpen && gap !== 0 ? "text-red-600" : undefined}>
                  {num(b.live_balance)} {!isOpen && (gap === 0 ? "✓" : "⚠")}
                </span>
              }
            />
          </Card>
        </section>

        <section className="space-y-2">
          <SectionTitle>Cost (excl. labour &amp; electricity)</SectionTitle>
          <Card className="gap-0 px-4 py-2">
            {(
              [
                ["Chicks", b.chick_cost],
                ["Feed", b.feed_cost],
                ["Medicine", b.medicine_cost],
                ["Vaccine", b.vaccine_cost],
                ["Husk", b.husk_cost],
              ] as const
            ).map(([label, value]) => (
              <Row
                key={label}
                label={label}
                value={
                  <>
                    {money(value)}
                    <span className="ml-2 inline-block w-10 text-muted-foreground">
                      {b.total_cost ? `${Math.round(((value ?? 0) / b.total_cost) * 100)}%` : ""}
                    </span>
                  </>
                }
              />
            ))}
            <div className="my-1 border-t" />
            <Row label="Total cost" strong value={money(b.total_cost)} />
            <Row label={isOpen ? "Sales so far" : "Sales"} value={money(b.sales_amount)} />
            <Row label={isOpen ? "Margin so far" : "Gross margin"} strong value={money(b.gross_margin)} />
            {!isOpen && <Row label="Margin per chick" value={money(b.margin_per_chick, 2)} />}
          </Card>
        </section>

        <WeightSection id={id} />
        <UsageSection id={id} />
        <MortalitySection id={id} />
        <SalesSection id={id} />
        <ChicksSection id={id} />

        {b.note && (
          <section className="space-y-2">
            <SectionTitle>Note</SectionTitle>
            <p className="text-sm">{b.note}</p>
          </section>
        )}
      </div>

      <AlertDialog open={closing} onOpenChange={setClosing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {b.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing marks the batch as finished. You can reopen it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="close-date">Close date</Label>
              <Input id="close-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
            {gap !== 0 && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>
                  {gap > 0
                    ? `${num(gap)} birds are unaccounted for (not recorded as dead or sold).`
                    : `${num(-gap)} more birds recorded as dead or sold than were placed.`}
                </p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={ackGap} onChange={(e) => setAckGap(e.target.checked)} />
                  Close anyway
                </label>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!closeDate || closeDate < (b.start_date ?? "") || (gap !== 0 && !ackGap)}
              onClick={(e) => {
                e.preventDefault()
                setClose.mutate(closeDate)
              }}
            >
              Close batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
