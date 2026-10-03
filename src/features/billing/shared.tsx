// Small pieces shared by the four billing forms (sale, purchase, chick purchase, payment).
import { useQuery, type QueryClient } from "@tanstack/react-query"
import { useEffect, useState, type ReactNode, type RefObject } from "react"
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form"
import { Link } from "react-router"
import { SaveBar, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { money } from "@/lib/format"
import { keys, unwrap, useBatchSummaries } from "@/lib/queries"
import type { Tables } from "@/lib/database.types"
import { supabase } from "@/lib/supabase"

/** Numeric keypad inputs. Values stay strings in the form; `n()` parses them. */
export const decimalInput = { type: "text", inputMode: "decimal", className: "h-11" } as const
export const intInput = { type: "text", inputMode: "numeric", className: "h-11" } as const

/** "1,200" → 1200; empty / junk → 0. */
export const n = (s: string | undefined) => {
  const v = Number((s ?? "").replace(/,/g, ""))
  return Number.isFinite(v) ? v : 0
}
/** Round like Postgres round(x, 2). */
export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
export const orNull = (s: string) => s.trim() || null
/** Positive number rule for react-hook-form string inputs. */
export const positive = (v: string) => n(v) > 0 || "Must be more than 0"
export const notNegative = (v: string) => !v || n(v) >= 0 || "Can't be negative"

export type Method = "CASH" | "BANK" | "MOBILE"

export function payStatus(amount: number, paid: number) {
  return paid >= amount && amount > 0 ? "PAID" : paid > 0 ? "PARTIALLY" : "DUE"
}

// localStorage can throw (private mode), so every access is wrapped.
export const lastUsed = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

/** Refresh everything a bill or payment can change. `type` is the entries ledger that was written. */
export function invalidateBilling(qc: QueryClient, type: "sales" | "purchases" | "chick_purchases" | "payments") {
  const all = [
    ["entries", type],
    ["entries", "payments"],
    keys.batchSummaries,
    ["v_item_stock"],
    ["v_bills"],
    ["v_reminders"],
    ["v_data_checks"],
    ["balances"],
  ]
  for (const queryKey of all) qc.invalidateQueries({ queryKey })
}

/** One bill from v_bills (paid / due for the edit screens). */
export function useBill(billType: "SALE" | "PURCHASE" | "CHICKS", id: number | null) {
  return useQuery({
    queryKey: ["v_bills", billType, id],
    enabled: id != null,
    queryFn: async () =>
      unwrap(await supabase.from("v_bills").select("*").eq("bill_type", billType).eq("bill_id", id!).single()),
  })
}

/** Master rows (suppliers, buyers, items) share the MasterPage cache key. */
export function useMasterRows<T extends "suppliers" | "buyers" | "items">(table: T) {
  return useQuery({
    queryKey: keys.master(table),
    queryFn: async () => unwrap(await supabase.from(table).select("*").order("code")) as unknown as Tables<T>[],
  })
}

/** Picks the default batch for a new entry: ?batch= → last used (if still open) → the only open batch. */
export function useDefaultBatch(
  enabled: boolean,
  current: string,
  set: (id: string) => void,
  fromParam: string | null,
) {
  const { data } = useBatchSummaries()
  useEffect(() => {
    if (!enabled || current || !data) return
    const open = data.filter((b) => b.status === "OPEN")
    const last = lastUsed.get("lastBatchId")
    const pick =
      (fromParam && data.find((b) => String(b.id) === fromParam)) ||
      open.find((b) => String(b.id) === last) ||
      (open.length === 1 ? open[0] : null)
    if (pick) set(String(pick.id))
  }, [enabled, current, data, fromParam, set])
  return data
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function ResultCard({ children }: { children: ReactNode }) {
  return <div className="space-y-1 rounded-xl bg-muted p-4 tabular-nums">{children}</div>
}

export function Warn({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{children}</p>
}

export type Option = { value: string; label: string }

export function PickField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  action,
  onPick,
}: {
  control: Control<T>
  name: Path<T>
  label: string
  options: Option[]
  placeholder?: string
  action?: ReactNode
  onPick?: (v: string) => void
}) {
  const { field, fieldState } = useController({ control, name, rules: { required: `${label} is required` } })
  return (
    <Field label={`${label} *`} error={fieldState.error?.message}>
      <Select
        value={String(field.value ?? "")}
        onValueChange={(v) => {
          field.onChange(v)
          onPick?.(v)
        }}
      >
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder={placeholder ?? `Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {action}
    </Field>
  )
}

type BatchRow = {
  id: number | null
  code: string | null
  status: string | null
  live_balance: number | null
  start_date: string | null
}

/** Batch picker: open batches only, "Show closed" reveals the rest. */
export function BatchField<T extends FieldValues>({
  control,
  name,
  batches,
  label = (b) => b.code ?? "",
  onPick,
}: {
  control: Control<T>
  name: Path<T>
  batches: BatchRow[]
  label?: (b: BatchRow) => string
  onPick?: (v: string) => void
}) {
  const [showClosed, setShowClosed] = useState(false)
  const { field } = useController({ control, name })
  const cur = String(field.value ?? "")
  const options = batches
    .filter((b) => b.status === "OPEN" || showClosed || String(b.id) === cur)
    .map((b) => ({ value: String(b.id), label: label(b) + (b.status === "CLOSED" ? " (closed)" : "") }))
  return (
    <PickField
      control={control}
      name={name}
      label="Batch"
      options={options}
      onPick={onPick}
      action={
        <button type="button" className="text-xs text-muted-foreground" onClick={() => setShowClosed((s) => !s)}>
          {showClosed ? "Hide closed batches" : "Show closed batches"}
        </button>
      }
    />
  )
}

export function MethodToggle<T extends FieldValues>({ control, name }: { control: Control<T>; name: Path<T> }) {
  const { field } = useController({ control, name })
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={String(field.value ?? "")}
      onValueChange={(v) => v && field.onChange(v)}
      className="h-11"
    >
      {(["CASH", "BANK", "MOBILE"] as const).map((m) => (
        <ToggleGroupItem key={m} value={m} className="h-11">
          {m[0] + m.slice(1).toLowerCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** "Paid now / Received now" block of the new-bill forms. */
export function PayNow<T extends FieldValues>({
  control,
  register,
  setValue,
  paidName,
  methodName,
  label,
  amount,
  paid,
}: {
  control: Control<T>
  register: UseFormRegister<T>
  setValue: UseFormSetValue<T>
  paidName: Path<T>
  methodName: Path<T>
  label: string
  amount: number
  paid: number
}) {
  const over = paid > amount
  return (
    <Section title="Payment">
      <div className="grid grid-cols-2 gap-3">
        <Field label={label} error={over ? `More than the bill amount (${money(amount, 2)})` : undefined}>
          <Input {...decimalInput} {...register(paidName, { validate: (v: string) => n(v) <= amount || "More than the bill amount" })} />
        </Field>
        <Field label="Method">
          <MethodToggle control={control} name={methodName} />
        </Field>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={amount <= 0}
        onClick={() => setValue(paidName, String(amount) as never, { shouldValidate: true })}
      >
        Paid in full
      </Button>
      <p className="flex items-center gap-2 text-sm">
        Due after save: <span className="font-medium tabular-nums">{money(Math.max(amount - paid, 0), 2)}</span>
        {amount > 0 && <StatusBadge status={payStatus(amount, paid)} />}
      </p>
    </Section>
  )
}

/** Edit mode: payments are managed separately once the bill exists. */
export function PaidSummary({
  bill,
}: {
  bill:
    | { bill_type: string | null; bill_id: number | null; party: string | null; paid: number | null; due: number | null }
    | undefined
}) {
  if (!bill) return null
  return (
    <Section title="Payment">
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <span className="tabular-nums">
          Paid {money(bill.paid, 2)} · Due {money(bill.due, 2)}
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to={`/payments/new?party=${bill.party}&bill=${bill.bill_type}:${bill.bill_id}`}>Record payment</Link>
        </Button>
      </div>
    </Section>
  )
}

/** Edit rule (F-38): a bill can't be edited below what was already paid. Returns the message or null. */
export const belowPaid = (amount: number, paid: number | null | undefined) =>
  paid != null && amount < paid
    ? `Bill amount ${money(amount, 2)} would be below the ${money(paid, 2)} already paid. Edit or delete the payments first.`
    : null

export function FormBar({
  formId,
  pending,
  isEdit,
  again,
}: {
  formId: string
  pending: boolean
  isEdit: boolean
  again: RefObject<boolean>
}) {
  return (
    <SaveBar>
      {!isEdit && (
        <Button
          type="submit"
          form={formId}
          variant="outline"
          className="h-11 flex-1"
          disabled={pending}
          onClick={() => (again.current = true)}
        >
          Save & add another
        </Button>
      )}
      <Button type="submit" form={formId} className="h-11 flex-1" disabled={pending} onClick={() => (again.current = false)}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </SaveBar>
  )
}

/** Active masters, plus the currently selected one even if archived. */
export const activeOrSelected = <T extends { is_active: boolean; id: number }>(rows: T[] | undefined, selected: string) =>
  (rows ?? []).filter((r) => r.is_active || String(r.id) === selected)
