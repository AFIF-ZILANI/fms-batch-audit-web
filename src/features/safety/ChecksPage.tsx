import { useQuery } from "@tanstack/react-query"
import { ChevronRightIcon } from "lucide-react"
import { Link } from "react-router"
import { EmptyState, ErrorNote, ListSkeleton } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

type Check = { check_name: string | null; ref_table: string | null; ref_id: number | null; ref_code: string | null; detail: string | null }

// v_bills types come through lower-cased as ref_table: chicks / purchase / sale.
const entryType: Record<string, string> = { chicks: "chick-purchases", purchase: "purchases", sale: "sales" }

/** Explanation and fix link per check_name (docs/page-layouts/20-data-checks.md). */
function describe(c: Check): { text: string; to: string; button: string } {
  const t = c.ref_table ?? ""
  const entry = `/entries/${entryType[t] ?? t.replace("_", "-")}/${c.ref_id}`
  const balance = Number(c.detail?.split("= ")[1])
  switch (c.check_name) {
    case "Closed batch: live balance not 0": {
      const n = Math.abs(balance)
      return {
        text: `${Number.isFinite(n) ? `${n} birds ${balance < 0 ? "more than placed" : "unaccounted for"}` : "Birds don't add up"}. Check mortality and sales.`,
        to: `/batches/${c.ref_id}`,
        button: "Open batch",
      }
    }
    case "Dead + sold exceeds chicks placed":
      return { text: "More birds dead/sold than placed. A chick purchase or sale count is wrong.", to: `/batches/${c.ref_id}`, button: "Open batch" }
    case "Batch has no chick purchase":
      return {
        text: "Chicks placed is 0, so mortality % and margin can't be calculated.",
        to: `/chick-purchases/new?batch=${c.ref_id}`,
        button: "Add chick purchase",
      }
    case "Entry dated outside batch":
      return { text: "Dated before the batch started or after it closed.", to: entry, button: "Open entry" }
    case "Item used more than purchased":
      return { text: "A purchase is probably missing, or a usage qty is wrong.", to: "/entries/purchases", button: "Add purchase" }
    case "Bill paid more than its amount":
      return { text: "The bill amount was reduced after payment. Fix the amount or a payment.", to: entry, button: "Open bill" }
    default:
      return { text: c.detail ?? "", to: entry, button: "Open" }
  }
}

export function ChecksPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["v_data_checks"],
    queryFn: async () => unwrap(await supabase.from("v_data_checks").select("*")) as Check[],
  })

  return (
    <>
      <PageHeader title="Data checks" back backTo="/more" />
      <div className="space-y-3 p-4">
        {isLoading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorNote error={error} />
        ) : !data?.length ? (
          <EmptyState text="✓ No problems found" />
        ) : (
          <>
            <p className="font-medium text-red-600">
              {data.length} {data.length === 1 ? "problem" : "problems"}
            </p>
            {data.map((c, i) => {
              const { text, to, button } = describe(c)
              return (
                <Card key={i} className="gap-1 p-4">
                  <div className="font-medium">{c.check_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[c.ref_code, c.detail].filter(Boolean).join(" · ")}
                  </div>
                  <p className="text-sm">{text}</p>
                  <Button asChild variant="outline" size="sm" className="mt-2 self-end">
                    <Link to={to}>
                      {button} <ChevronRightIcon />
                    </Link>
                  </Button>
                </Card>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}
