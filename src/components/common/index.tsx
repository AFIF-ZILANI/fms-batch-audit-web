import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Status colours from docs/design.md §3.2. */
const statusStyles: Record<string, string> = {
  OPEN: "border-sky-200 bg-sky-50 text-sky-700",
  CLOSED: "border-transparent bg-muted text-muted-foreground",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PARTIALLY: "border-amber-200 bg-amber-50 text-amber-700",
  DUE: "border-red-200 bg-red-50 text-red-700",
  ARCHIVED: "border-transparent bg-muted text-muted-foreground",
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  return (
    <Badge variant="outline" className={cn("font-medium", statusStyles[status])}>
      {status}
    </Badge>
  )
}

export function Kpi({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="min-w-0 bg-background p-3">
      <div
        className={cn(
          "truncate text-xl font-semibold tabular-nums",
          tone === "danger" && "text-red-600",
          tone === "warning" && "text-amber-600",
        )}
      >
        {value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}

export function EmptyState({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      <p>{text}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const message = (error as { message?: string })?.message ?? "Unknown error"
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Couldn't load: {message}
    </div>
  )
}

/** Sticky bottom bar used by full-page forms (docs/design.md §4.1). */
export function SaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-screen-sm gap-2 p-3">{children}</div>
    </div>
  )
}
