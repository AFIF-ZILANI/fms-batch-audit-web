import { PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { EmptyState, ErrorNote, ListSkeleton, SectionTitle } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { money, num } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useItemStock } from "./queries"

const CATS = ["ALL", "FEED", "MEDICINE", "VACCINE", "HUSK"] as const

export function StockPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useItemStock()
  const [cat, setCat] = useState<string>("ALL")
  const [search, setSearch] = useState("")

  // Active items, plus archived ones only while they still hold stock.
  const rows = (data ?? [])
    .filter((i) => i.is_active || i.balance_qty !== 0)
    .filter((i) => cat === "ALL" || i.category === cat)
    .filter((i) => !search || `${i.name} ${i.code}`.toLowerCase().includes(search.toLowerCase()))
  const value = rows.reduce((s, i) => s + (i.stock_value ?? 0), 0)
  const groups = [...new Set(rows.map((i) => i.category))]

  return (
    <>
      <PageHeader
        title="Stock"
        actions={
          <Button size="sm" onClick={() => navigate("/purchases/new")}>
            <PlusIcon /> Purchase
          </Button>
        }
      />
      <div className="space-y-3 p-4">
        <div>
          <div className="text-xs text-muted-foreground">Store value</div>
          <div className="text-2xl font-semibold tabular-nums">{money(value)}</div>
        </div>
        <div className="relative">
          <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search item" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={cat} onValueChange={setCat}>
          <TabsList className="w-full">
            {CATS.map((c) => (
              <TabsTrigger key={c} value={c} className="px-1 text-xs capitalize">
                {c.toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && <ListSkeleton />}
        {error && <ErrorNote error={error} />}
        {data && rows.length === 0 && <EmptyState text="No items found." />}

        {groups.map((g) => (
          <div key={g} className="space-y-2">
            <SectionTitle>{g}</SectionTitle>
            {rows
              .filter((i) => i.category === g)
              .map((i) => {
                const neg = (i.balance_qty ?? 0) < 0
                return (
                  <Card key={i.id} className={cn("gap-1 p-4", !i.is_active && "opacity-60")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{i.name}</span>
                      <span className={cn("text-lg font-semibold tabular-nums", neg && "text-red-600")}>
                        {num(i.balance_qty)} {i.unit}
                      </span>
                    </div>
                    {neg ? (
                      <div className="text-sm text-red-600">used more than purchased</div>
                    ) : (
                      <div className="text-sm tabular-nums text-muted-foreground">
                        avg {money(i.avg_unit_cost, 2)} · {money(i.stock_value)}
                      </div>
                    )}
                    <div className="text-sm tabular-nums text-muted-foreground">
                      in {num(i.purchased_qty)} · out {num(i.issued_qty)} · back {num(i.returned_qty)}
                    </div>
                  </Card>
                )
              })}
          </div>
        ))}
      </div>
    </>
  )
}
