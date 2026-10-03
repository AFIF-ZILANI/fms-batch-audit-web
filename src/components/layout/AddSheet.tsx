import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BirdIcon,
  EggIcon,
  LayersIcon,
  ScaleIcon,
  ShoppingCartIcon,
  SkullIcon,
  Undo2Icon,
  WheatIcon,
} from "lucide-react"
import type { ComponentType } from "react"
import { useNavigate } from "react-router"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type Tile = { label: string; icon: ComponentType<{ className?: string }>; to?: string }

const groups: { title: string; tiles: Tile[] }[] = [
  {
    title: "Daily",
    tiles: [
      { label: "Usage", icon: WheatIcon, to: "/usages/new?kind=ISSUE" },
      { label: "Mortality", icon: SkullIcon, to: "/mortalities/new" },
      { label: "Weight", icon: ScaleIcon, to: "/weights/new" },
      { label: "Return", icon: Undo2Icon, to: "/usages/new?kind=RETURN" },
    ],
  },
  {
    title: "Sales & buying",
    tiles: [
      { label: "Sale", icon: BirdIcon, to: "/sales/new" },
      { label: "Purchase", icon: ShoppingCartIcon, to: "/purchases/new" },
      { label: "Chicks", icon: EggIcon, to: "/chick-purchases/new" },
    ],
  },
  {
    title: "Money",
    tiles: [
      { label: "Pay supplier", icon: ArrowUpRightIcon, to: "/payments/new?party=SUPPLIER" },
      { label: "Receive", icon: ArrowDownLeftIcon, to: "/payments/new?party=BUYER" },
    ],
  },
  { title: "Setup", tiles: [{ label: "New batch", icon: LayersIcon, to: "/batches/new" }] },
]

export function AddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-screen-sm rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SheetHeader>
          <SheetTitle>Add</SheetTitle>
          <SheetDescription>What do you want to record?</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <div className="grid grid-cols-3 gap-2">
                {g.tiles.map(({ label, icon: Icon, to }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!to}
                    onClick={() => {
                      if (!to) return
                      onOpenChange(false)
                      navigate(to)
                    }}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-sm",
                      to ? "active:bg-accent" : "text-muted-foreground opacity-50",
                    )}
                  >
                    <Icon className="size-6" />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
