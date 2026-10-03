import { ChevronRightIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { EmptyState, ErrorNote, Kpi, ListSkeleton, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dateShortOrFull, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { billRoute, type Balance, useBalances, useBills, type Party } from "./queries"

type Tab = "suppliers" | "buyers" | "bills"

function PartyList({ party }: { party: Party }) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useBalances(party)
  if (isLoading) return <ListSkeleton />
  if (error) return <ErrorNote error={error} />
  const all = data ?? []
  const open = all.filter((b) => b.due > 0).sort((a, b) => b.due - a.due)
  const settled = all.filter((b) => b.due <= 0)
  const row = (b: Balance) => (
    <Card key={b.id} className="cursor-pointer gap-1 p-4 active:bg-accent" onClick={() => navigate(`/money/${party}/${b.id}`)}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {b.name}
        </span>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex justify-between text-sm tabular-nums text-muted-foreground">
        <span>Billed {money(b.billed)}</span>
        <span>
          {party === "buyer" ? "Received" : "Paid"} {money(b.paid)}
        </span>
      </div>
      <div className={cn("text-right font-semibold tabular-nums", b.due > 0 && "text-red-600")}>Due {money(b.due)}</div>
    </Card>
  )
  return (
    <div className="space-y-3">
      {open.length === 0 && <EmptyState text="All settled ✓" />}
      {open.map(row)}
      {settled.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Settled (due ৳0) — {settled.length}</summary>
          <div className="mt-3 space-y-3">{settled.map(row)}</div>
        </details>
      )}
    </div>
  )
}

function UnpaidBills() {
  const navigate = useNavigate()
  const [who, setWho] = useState<"ALL" | "SUPPLIER" | "BUYER">("ALL")
  const bills = useBills({ unpaidOnly: true })
  const sup = useBalances("supplier").data
  const buy = useBalances("buyer").data
  if (bills.isLoading) return <ListSkeleton />
  if (bills.error) return <ErrorNote error={bills.error} />
  const rows = (bills.data ?? []).filter((b) => who === "ALL" || b.party === who)
  const name = (p: string | null, id: number | null) => (p === "SUPPLIER" ? sup : buy)?.find((x) => x.id === id)?.name ?? ""
  return (
    <div className="space-y-3">
      <Tabs value={who} onValueChange={(v) => setWho(v as typeof who)}>
        <TabsList className="w-full">
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="SUPPLIER">Supplier</TabsTrigger>
          <TabsTrigger value="BUYER">Buyer</TabsTrigger>
        </TabsList>
      </Tabs>
      {rows.length === 0 && <EmptyState text="All settled ✓" />}
      {rows.map((b) => (
        <Card
          key={`${b.bill_type}${b.bill_id}`}
          className="cursor-pointer gap-1 p-4 active:bg-accent"
          onClick={() => navigate(`/entries/${billRoute[b.bill_type ?? ""]}/${b.bill_id}`)}
        >
          <div className="flex items-center justify-between text-sm">
            <span>
              {dateShortOrFull(b.date)} · {b.bill_type} · {name(b.party, b.party_id)}
            </span>
            <StatusBadge status={b.payment_status} />
          </div>
          <div className="flex justify-between text-sm tabular-nums">
            <span className="text-muted-foreground">{b.description}</span>
            <span className="font-medium">due {money(b.due)}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function MoneyPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get("tab") as Tab) || "suppliers"
  const sup = useBalances("supplier")
  const buy = useBalances("buyer")
  const total = (d?: { due: number }[]) => (d ?? []).reduce((s, b) => s + b.due, 0)

  return (
    <>
      <PageHeader
        title="Money"
        actions={
          <Button size="sm" onClick={() => navigate("/payments/new")}>
            Record payment
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
          <Kpi value={sup.data ? money(total(sup.data)) : "…"} label="We owe" tone="danger" />
          <Kpi value={buy.data ? money(total(buy.data)) : "…"} label="Owed to us" />
        </div>
        {(sup.error || buy.error) && <ErrorNote error={sup.error ?? buy.error} />}
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList className="w-full">
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="buyers">Buyers</TabsTrigger>
            <TabsTrigger value="bills">Unpaid bills</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "bills" ? <UnpaidBills /> : <PartyList party={tab === "buyers" ? "buyer" : "supplier"} />}
      </div>
    </>
  )
}
