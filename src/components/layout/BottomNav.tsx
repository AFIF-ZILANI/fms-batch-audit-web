import { HomeIcon, LayersIcon, MenuIcon, PlusIcon, WalletIcon } from "lucide-react"
import type { ComponentType } from "react"
import { NavLink } from "react-router"
import { cn } from "@/lib/utils"

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean }

const left: Item[] = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/batches", label: "Batches", icon: LayersIcon },
]
const right: Item[] = [
  { to: "/money", label: "Money", icon: WalletIcon },
  { to: "/more", label: "More", icon: MenuIcon },
]

function Tab({ to, label, icon: Icon, end }: Item) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs",
          isActive ? "text-foreground font-medium" : "text-muted-foreground",
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  )
}

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-screen-sm items-center">
        {left.map((i) => (
          <Tab key={i.to} {...i} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add entry"
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
          >
            <PlusIcon className="size-6" />
          </button>
        </div>
        {right.map((i) => (
          <Tab key={i.to} {...i} />
        ))}
      </div>
    </nav>
  )
}
