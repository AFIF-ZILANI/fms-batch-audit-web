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

// Tiles without `to` are planned for later milestones (docs/prd.md §8) and render disabled.
const groups: { title: string; tiles: Tile[] }[] = [
  {
    title: "Daily",
    tiles: [
      { label: "Usage", icon: WheatIcon },
      { label: "Mortality", icon: SkullIcon },
      { label: "Weight", icon: ScaleIcon },
      { label: "Return", icon: Undo2Icon },
    ],
  },
  {
    title: "Sales & buying",
    tiles: [
      { label: "Sale", icon: BirdIcon },
      { label: "Purchase", icon: ShoppingCartIcon },
      { label: "Chicks", icon: EggIcon },
    ],
  },
  {
    title: "Money",
    tiles: [
      { label: "Pay supplier", icon: ArrowUpRightIcon },
      { label: "Receive", icon: ArrowDownLeftIcon },
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
          <SheetDescription>Daily entries arrive in the next milestone.</SheetDescription>
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
