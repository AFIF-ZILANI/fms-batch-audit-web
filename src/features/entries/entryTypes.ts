/* eslint-disable @typescript-eslint/no-explicit-any */
// Config for the seven ledgers shared by EntryListPage and EntryDetailPage (docs/design.md §5.3).
// Tables are read untyped (like masterTypes.ts); the database is the judge of column names.
import type { QueryClient } from "@tanstack/react-query"
import { age, date, grams, kg, money, num } from "@/lib/format"
import { supabase } from "@/lib/supabase"

export type Row = Record<string, any>
export type EntryType = "usages" | "mortalities" | "weights" | "sales" | "purchases" | "chick-purchases" | "payments"
export type BillType = "CHICKS" | "PURCHASE" | "SALE"

export type FilterDef = {
  param: string
  label: string
  column: string
  /** Fixed options, or a master table to load options from. */
  options?: { value: string; label: string }[]
  master?: "items" | "suppliers" | "buyers" | "sheds"
}

export type EntryConfig = {
  type: EntryType
  title: string
  singular: string
  table: string
  /** PostgREST select with the joins the cards and detail need. */
  select: string
  hasBatch: boolean
  filters: FilterDef[]
  /** Bills only: how the bill appears in v_bills / payments. */
  bill?: { type: BillType; payCol: string; amountCol: string; party: "SUPPLIER" | "BUYER" }
  line1: (r: Row) => string
  line2: (r: Row) => string
  /** Right-hand text on the card (amount). */
  right?: (r: Row) => string
  /** Small outline badge next to line 1 (e.g. RETURN). */
  badge?: (r: Row) => string | undefined
  /** Columns the summary line needs (all matching non-deleted rows). */
  summarySelect: string
  summary: (rows: Row[], bills: Map<number, Row>) => string
  subtitle: (r: Row) => string
  entered: (r: Row) => [string, string][]
  calculated: (r: Row, extra?: Row | null) => [string, string][]
}

const sum = (rows: Row[], k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0)
const dueOf = (rows: Row[], bills: Map<number, Row>) => rows.reduce((s, r) => s + Number(bills.get(r.id)?.due ?? 0), 0)
const count = (rows: Row[]) => `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`
const batchCode = (r: Row) => r.batches?.code ?? "—"
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5)
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

const statusFilter: FilterDef = {
  param: "status",
  label: "Payment status",
  column: "status",
  options: [
    { value: "DUE", label: "Due" },
    { value: "PARTIALLY", label: "Partially paid" },
    { value: "PAID", label: "Paid" },
  ],
}

/** Which bill a payment belongs to, with party/batch names (from the payments select below). */
export function paymentBill(r: Row) {
  if (r.sale_id)
    return { route: "sales", id: r.sale_id as number, label: `Sale #${r.sale_id}`, party: r.sales?.buyers?.name, batch: r.sales?.batches?.code }
  if (r.purchase_id)
    return { route: "purchases", id: r.purchase_id as number, label: `Purchase #${r.purchase_id}`, party: r.purchases?.suppliers?.name, batch: undefined }
  return {
    route: "chick-purchases",
    id: r.chick_purchase_id as number,
    label: `Chick purchase #${r.chick_purchase_id}`,
    party: r.chick_purchases?.suppliers?.name,
    batch: r.chick_purchases?.batches?.code,
  }
}

export const entryConfigs: Record<EntryType, EntryConfig> = {
  usages: {
    type: "usages",
    title: "Usages",
    singular: "Usage",
    table: "usages",
    select: "*, batches(code), items(name, unit, category, unit_weight_kg)",
    hasBatch: true,
    filters: [
      { param: "item", label: "Item", column: "item_id", master: "items" },
      {
        param: "kind",
        label: "Kind",
        column: "kind",
        options: [
          { value: "ISSUE", label: "Issue" },
          { value: "RETURN", label: "Return" },
        ],
      },
    ],
    line1: (r) => `${r.kind === "RETURN" ? "↩ " : ""}${r.items?.name} · ${num(r.qty)} ${r.items?.unit}`,
    line2: (r) => batchCode(r),
    right: (r) => money(r.cost),
    badge: (r) => (r.kind === "RETURN" ? "RETURN" : undefined),
    summarySelect: "id, cost",
    summary: (rows) => `${count(rows)} · net cost ${money(sum(rows, "cost"))}`,
    subtitle: (r) => `${date(r.date)} · ${batchCode(r)}`,
    entered: (r) => [
      ["Kind", cap(r.kind)],
      ["Item", r.items?.name],
      ["Qty", `${num(r.qty)} ${r.items?.unit}`],
      ["Date", date(r.date)],
      ["Batch", batchCode(r)],
    ],
    calculated: (r) => [
      ["Unit cost", money(r.unit_cost, 2)],
      ["Cost", money(r.cost, 2)],
      ...(r.items?.category === "FEED" && r.items?.unit_weight_kg
        ? ([["Feed weight", kg(r.signed_qty * r.items.unit_weight_kg)]] as [string, string][])
        : []),
    ],
  },
  mortalities: {
    type: "mortalities",
    title: "Mortalities",
    singular: "Mortality",
    table: "mortalities",
    select: "*, batches(code), sheds(name)",
    hasBatch: true,
    filters: [
      { param: "shed", label: "Shed", column: "shed_id", master: "sheds" },
      {
        param: "reason",
        label: "Reason",
        column: "reason",
        options: [
          { value: "NORMAL", label: "Normal" },
          { value: "ACCIDENT", label: "Accident" },
          { value: "ILLNESS", label: "Illness" },
        ],
      },
    ],
    line1: (r) => `${num(r.dead_count)} dead · ${r.reason.toLowerCase()}`,
    line2: (r) => `${batchCode(r)} · ${r.sheds?.name}`,
    summarySelect: "id, dead_count",
    summary: (rows) => `${count(rows)} · ${num(sum(rows, "dead_count"))} dead`,
    subtitle: (r) => `${date(r.date)} · ${batchCode(r)}`,
    entered: (r) => [
      ["Date", date(r.date)],
      ["Batch", batchCode(r)],
      ["Shed", r.sheds?.name],
      ["Dead", num(r.dead_count)],
      ["Reason", cap(r.reason)],
    ],
    calculated: () => [],
  },
  weights: {
    type: "weights",
    title: "Weights",
    singular: "Weight",
    table: "weights",
    // weights table (not v_batch_weights) so deleted rows can be listed; age is date − batch start.
    select: "*, batches(code, start_date)",
    hasBatch: true,
    filters: [],
    line1: (r) => `${grams(r.avg_weight_g)} · Day ${dayDiff(r.date, r.batches?.start_date)}`,
    line2: (r) => `${batchCode(r)} · sample ${num(r.sample_size)}`,
    summarySelect: "id",
    summary: (rows) => count(rows),
    subtitle: (r) => `${date(r.date)} · ${batchCode(r)}`,
    entered: (r) => [
      ["Date", date(r.date)],
      ["Batch", batchCode(r)],
      ["Sample size", num(r.sample_size)],
      ["Total weight", kg(r.total_weight_kg)],
    ],
    calculated: (r, x) => [
      ["Average", grams(r.avg_weight_g)],
      ["Age", age(dayDiff(r.date, r.batches?.start_date))],
      ...(x?.gain_g != null ? ([["Gain vs previous", grams(x.gain_g)]] as [string, string][]) : []),
    ],
  },
  sales: {
    type: "sales",
    title: "Sales",
    singular: "Sale",
    table: "sales",
    select: "*, batches(code), buyers(name)",
    hasBatch: true,
    bill: { type: "SALE", payCol: "sale_id", amountCol: "amount", party: "BUYER" },
    filters: [
      { param: "buyer", label: "Buyer", column: "buyer_id", master: "buyers" },
      {
        param: "grade",
        label: "Grade",
        column: "grade",
        options: [
          { value: "A", label: "A" },
          { value: "B", label: "B" },
          { value: "C", label: "C" },
        ],
      },
      statusFilter,
    ],
    line1: (r) => `${num(r.total_birds)} birds · ${kg(r.net_weight_kg)} · ${r.grade}`,
    line2: (r) => `${batchCode(r)} · ${r.buyers?.name}`,
    right: (r) => money(r.amount),
    summarySelect: "id, total_birds, net_weight_kg, amount",
    summary: (rows, bills) =>
      `${num(sum(rows, "total_birds"))} birds · ${kg(sum(rows, "net_weight_kg"))} · ${money(sum(rows, "amount"))} · due ${money(dueOf(rows, bills))}`,
    subtitle: (r) => `${date(r.date)} · ${batchCode(r)} · ${r.buyers?.name}`,
    entered: (r) => [
      ["Male / Female", `${num(r.male_count)} / ${num(r.female_count)}`],
      ["Grade", r.grade],
      ["Gross weight", kg(r.gross_weight_kg)],
      ["Deduction / crate", grams(r.deduction_per_crate_g)],
      ["Rate", `${money(r.rate, 2)} / kg`],
      ["Discount", money(r.discount, 2)],
    ],
    calculated: (r) => [
      ["Birds", num(r.total_birds)],
      ["Crates", num(r.crates)],
      ["Deduction", kg(r.deduction_kg)],
      ["Net weight", kg(r.net_weight_kg)],
      ["Amount", money(r.amount, 2)],
    ],
  },
  purchases: {
    type: "purchases",
    title: "Purchases",
    singular: "Purchase",
    table: "purchases",
    select: "*, items(name, unit), suppliers(name)",
    hasBatch: false,
    bill: { type: "PURCHASE", payCol: "purchase_id", amountCol: "amount", party: "SUPPLIER" },
    filters: [
      { param: "item", label: "Item", column: "item_id", master: "items" },
      { param: "supplier", label: "Supplier", column: "supplier_id", master: "suppliers" },
      statusFilter,
    ],
    line1: (r) => `${r.items?.name} · ${num(r.qty)} ${r.items?.unit}`,
    line2: (r) => r.suppliers?.name,
    right: (r) => money(r.amount),
    summarySelect: "id, amount",
    summary: (rows, bills) => `${count(rows)} · ${money(sum(rows, "amount"))} · due ${money(dueOf(rows, bills))}`,
    subtitle: (r) => `${date(r.date)} · ${r.suppliers?.name}`,
    entered: (r) => [
      ["Item", r.items?.name],
      ["Supplier", r.suppliers?.name],
      ["Qty", `${num(r.qty)} ${r.items?.unit}`],
      ["Unit price", money(r.unit_price, 2)],
    ],
    calculated: (r) => [["Amount", money(r.amount, 2)]],
  },
  "chick-purchases": {
    type: "chick-purchases",
    title: "Chick purchases",
    singular: "Chick purchase",
    table: "chick_purchases",
    select: "*, batches(code), suppliers(name)",
    hasBatch: true,
    bill: { type: "CHICKS", payCol: "chick_purchase_id", amountCol: "net_price", party: "SUPPLIER" },
    filters: [{ param: "supplier", label: "Supplier", column: "supplier_id", master: "suppliers" }, statusFilter],
    line1: (r) => `${num(r.chicks_placed)} chicks · @${money(r.rate, 2)}`,
    line2: (r) => `${batchCode(r)} · ${r.suppliers?.name}`,
    right: (r) => money(r.net_price),
    summarySelect: "id, chicks_placed, net_price",
    summary: (rows, bills) =>
      `${num(sum(rows, "chicks_placed"))} chicks · ${money(sum(rows, "net_price"))} · due ${money(dueOf(rows, bills))}`,
    subtitle: (r) => `${date(r.date)} · ${batchCode(r)} · ${r.suppliers?.name}`,
    entered: (r) => [
      ["Supplier", r.suppliers?.name],
      ["Batch", batchCode(r)],
      ["Chicks", num(r.chicks_placed)],
      ["Rate", `${money(r.rate, 2)} / chick`],
      ["Discount", money(r.discount, 2)],
    ],
    calculated: (r) => [
      ["Total price", money(r.total_price, 2)],
      ["Amount (net)", money(r.net_price, 2)],
    ],
  },
  payments: {
    type: "payments",
    title: "Payments",
    singular: "Payment",
    table: "payments",
    select:
      "*, chick_purchases(batches(code), suppliers(name)), purchases(suppliers(name)), sales(batches(code), buyers(name))",
    hasBatch: false,
    filters: [
      {
        param: "party",
        label: "Party",
        column: "party",
        options: [
          { value: "SUPPLIER", label: "Paid to supplier" },
          { value: "BUYER", label: "Received from buyer" },
        ],
      },
      {
        param: "method",
        label: "Method",
        column: "method",
        options: [
          { value: "CASH", label: "Cash" },
          { value: "BANK", label: "Bank" },
          { value: "MOBILE", label: "Mobile" },
        ],
      },
    ],
    line1: (r) => (r.party === "SUPPLIER" ? "⬆ Paid" : "⬇ Received"),
    line2: (r) => {
      const b = paymentBill(r)
      return `${b.party ?? "—"} · ${b.label} · ${cap(r.method)}`
    },
    right: (r) => money(r.amount),
    summarySelect: "id, party, amount",
    summary: (rows) =>
      `${count(rows)} · paid ${money(sum(rows.filter((r) => r.party === "SUPPLIER"), "amount"))} · received ${money(sum(rows.filter((r) => r.party === "BUYER"), "amount"))}`,
    subtitle: (r) => `${date(r.date)} · ${paymentBill(r).party ?? "—"}`,
    entered: (r) => [
      ["Date", date(r.date)],
      ["Party", r.party === "SUPPLIER" ? "Supplier (paid)" : "Buyer (received)"],
      ["Amount", money(r.amount, 2)],
      ["Method", cap(r.method)],
    ],
    calculated: () => [],
  },
}

export const isEntryType = (t: string | undefined): t is EntryType => !!t && t in entryConfigs

// --- soft delete helpers (docs/design.md §4.3) ---
export const deletedReason = (note: string | null | undefined) =>
  [...(note ?? "").matchAll(/\[deleted: ([^\]]*)\]/g)].at(-1)?.[1]
export const stripDeleted = (note: string | null | undefined) =>
  (note ?? "").replace(/\s*\[deleted: [^\]]*\]/g, "").trim() || null
export const withDeleted = (note: string | null | undefined, reason: string) =>
  [note?.trim(), `[deleted: ${reason.replace(/\]/g, ")").trim()}]`].filter(Boolean).join(" ")

/** Marker on payments voided together with their bill, so restoring the bill restores only those. */
export const BILL_DELETED = "bill deleted"

/** Everything a delete/restore can change. */
export function invalidateLedgers(qc: QueryClient) {
  for (const k of ["entries", "v_batch_summary", "v_item_stock", "v_bills", "balances", "v_reminders", "v_data_checks"])
    qc.invalidateQueries({ queryKey: [k] })
}

/** Untyped table access: the config picks the table at runtime. */
export const db = (t: string): any => (supabase as any).from(t)
