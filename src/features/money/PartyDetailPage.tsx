import { PhoneIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { EmptyState, ErrorNote, Kpi, KpiGrid, ListSkeleton, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dateShortOrFull, money } from "@/lib/format"
import { billRoute, useBalance, useBills, usePartyPayments, type Party } from "./queries"

export function PartyDetailPage() {
  const navigate = useNavigate()
  const { party: p, id: idParam } = useParams()
  const party: Party = p === "buyer" ? "buyer" : "supplier"
  const id = Number(idParam)
  const [tab, setTab] = useState("bills")
  const bal = useBalance(party, id)
  const bills = useBills({ party: party === "buyer" ? "BUYER" : "SUPPLIER", partyId: id })
  const payments = usePartyPayments(party)

  const billList = bills.data ?? []
  const byKey = new Map(billList.map((b) => [`${b.bill_type}:${b.bill_id}`, b]))
  const payKey = (x: NonNullable<typeof payments.data>[number]) =>
    x.sale_id ? `SALE:${x.sale_id}` : x.purchase_id ? `PURCHASE:${x.purchase_id}` : `CHICKS:${x.chick_purchase_id}`
  // ponytail: fetches all payments of this party type and filters here; add a server filter if volume grows.
  const myPayments = (payments.data ?? []).filter((x) => byKey.has(payKey(x)))
  const b = bal.data
  const firstDue = [...billList].reverse().find((x) => (x.due ?? 0) > 0) // oldest unpaid
  const payUrl = `/payments/new?party=${party.toUpperCase()}${firstDue ? `&bill=${firstDue.bill_type}:${firstDue.bill_id}` : ""}`

  return (
    <>
      <PageHeader title={b?.name ?? (party === "buyer" ? "Buyer" : "Supplier")} back backTo="/money" />
      <div className="space-y-3 p-4">
        {(bal.isLoading || bills.isLoading) && <ListSkeleton />}
        {bal.error && <ErrorNote error={bal.error} />}
        {bal.isSuccess && !b && <EmptyState text="Not found." />}
        {b && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm text-muted-foreground">
                {b.code}
                {b.company ? ` · ${b.company}` : ""}
              </div>
              {b.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${b.phone}`}>
                    <PhoneIcon /> {b.phone}
                  </a>
                </Button>
              )}
            </div>
            <KpiGrid>
              <Kpi value={money(b.billed)} label="Billed" />
              <Kpi value={money(b.paid)} label={party === "buyer" ? "Received" : "Paid"} />
              <Kpi value={money(b.due)} label="Due" tone={b.due > 0 ? "danger" : undefined} />
            </KpiGrid>
            <Button className="w-full" onClick={() => navigate(payUrl)}>
              Record payment
            </Button>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="bills">Bills ({billList.length})</TabsTrigger>
                <TabsTrigger value="payments">Payments ({myPayments.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === "bills" ? (
              <>
                {bills.error && <ErrorNote error={bills.error} />}
                {bills.data && billList.length === 0 && <EmptyState text="No bills yet." />}
                {billList.map((x) => (
                  <Card
                    key={`${x.bill_type}${x.bill_id}`}
                    className="cursor-pointer gap-1 p-4 active:bg-accent"
                    onClick={() => navigate(`/entries/${billRoute[x.bill_type ?? ""]}/${x.bill_id}`)}
                  >
                    <div className="text-sm">
                      {dateShortOrFull(x.date)} · {x.description}
                    </div>
                    <div className="flex items-center justify-between text-sm tabular-nums">
                      <span className="font-medium">{money(x.amount)}</span>
                      {(x.due ?? 0) > 0 && <span className="text-muted-foreground">due {money(x.due)}</span>}
                      <StatusBadge status={x.payment_status} />
                    </div>
                  </Card>
                ))}
              </>
            ) : (
              <>
                {payments.isLoading && <ListSkeleton />}
                {payments.error && <ErrorNote error={payments.error} />}
                {payments.data && myPayments.length === 0 && <EmptyState text="No payments yet." />}
                {myPayments.map((x) => (
                  <Card key={x.id} className="gap-1 p-4">
                    <div className="flex justify-between text-sm">
                      <span>
                        {dateShortOrFull(x.date)} · {x.method}
                      </span>
                      <span className="font-medium tabular-nums">{money(x.amount)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">for {byKey.get(payKey(x))?.description}</div>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
