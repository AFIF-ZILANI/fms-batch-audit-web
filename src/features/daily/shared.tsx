import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { age } from "@/lib/format"
import { errorMessage } from "@/lib/errors"
import { keys, unwrap, useBatchSummaries } from "@/lib/queries"
import type { Database } from "@/lib/database.types"
import { supabase } from "@/lib/supabase"

// Last-used defaults (docs/design.md principle 3). localStorage can throw, so never rely on it.
export function lastUsed(key: string): string {
  try {
    return localStorage.getItem(`last:${key}`) ?? ""
  } catch {
    return ""
  }
}
export function rememberLast(key: string, value: string) {
  try {
    localStorage.setItem(`last:${key}`, value)
  } catch {
    /* ignore */
  }
}

/** Refresh every cache a daily-entry write can change. */
export function useInvalidateDaily() {
  const qc = useQueryClient()
  return (type: string) => {
    for (const k of [
      keys.batchSummaries,
      ["entries", type],
      ["v_item_stock"],
      ["v_bills"],
      ["v_reminders"],
      ["v_data_checks"],
      ["balances"],
      ["v_batch_weights"],
    ])
      qc.invalidateQueries({ queryKey: k })
  }
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
      <AlertDescription className="text-amber-800">⚠ {children}</AlertDescription>
    </Alert>
  )
}

export function ResultCard({ children }: { children: ReactNode }) {
  return <div className="space-y-1 rounded-xl bg-muted p-4 text-sm tabular-nums">{children}</div>
}

/** Open batches only (closed via "show closed"); the selected batch is always listed. */
export function BatchPicker({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const { data } = useBatchSummaries()
  const [showClosed, setShowClosed] = useState(false)
  const list = (data ?? []).filter((b) => showClosed || b.status === "OPEN" || String(b.id) === value)
  return (
    <Field label="Batch *" error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder="Select batch" />
        </SelectTrigger>
        <SelectContent>
          {list.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>
              {b.code} · {b.status === "OPEN" ? age(b.age_days) : "Closed"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button type="button" className="text-xs text-muted-foreground" onClick={() => setShowClosed((s) => !s)}>
        {showClosed ? "Hide closed batches" : "Show closed batches"}
      </button>
    </Field>
  )
}

type Table = "usages" | "mortalities" | "weights"

/** Load one row for edit mode. */
export function useEntryRow<T extends Table>(table: T, id: number | null) {
  return useQuery({
    queryKey: ["entries", table, "row", id],
    enabled: id != null,
    queryFn: async () =>
      unwrap(await supabase.from(table).select("*").eq("id" as never, id!).single()) as unknown as Database["public"]["Tables"][T]["Row"],
  })
}

/** Delete = soft delete (is_void) with a reason appended to the note (design.md §4.3). */
export function DeleteEntry({ table, id, note }: { table: Table; id: number; note: string | null }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const navigate = useNavigate()
  const invalidate = useInvalidateDaily()
  const del = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase
          .from(table)
          .update({ is_void: true, note: `${note ? note + " " : ""}[deleted: ${reason.trim()}]` })
          .eq("id", id),
      ),
    onSuccess: () => {
      invalidate(table)
      toast.success("Entry deleted")
      navigate(-1)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => setOpen(true)}>
        <Trash2Icon className="size-5 text-red-600" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>It is hidden from lists and totals. A reason is required.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input className="h-11" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={!reason.trim()} onClick={() => del.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** "1,5" → number, NaN when empty or invalid. */
export const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")))
