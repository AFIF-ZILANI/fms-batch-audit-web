// Number and date formats from docs/design.md §3.4.

const lakh0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const lakh2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const trim3 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 })

type Num = number | null | undefined

/** ৳12,68,000 (lists) or ৳12,68,000.00 (detail). */
export function money(v: Num, decimals: 0 | 2 = 0): string {
  if (v == null) return "—"
  const s = (decimals === 2 ? lakh2 : lakh0).format(Math.abs(v))
  return `${v < 0 ? "−" : ""}৳${s}`
}

/**
 * Compact money for small tiles: ৳5.25L (lakh), ৳1.2Cr (crore); below 1 lakh as full amount.
 * Full amounts are always shown in breakdowns; this is only for space-limited KPIs.
 */
export function moneyShort(v: Num): string {
  if (v == null) return "—"
  const a = Math.abs(v)
  const sign = v < 0 ? "−" : ""
  if (a >= 1e7) return `${sign}৳${+(a / 1e7).toFixed(2)}Cr`
  if (a >= 1e5) return `${sign}৳${+(a / 1e5).toFixed(2)}L`
  return money(v)
}

export function num(v: Num): string {
  return v == null ? "—" : trim3.format(v)
}

export function kg(v: Num): string {
  return v == null ? "—" : `${trim3.format(v)} kg`
}

export function grams(v: Num): string {
  return v == null ? "—" : `${lakh0.format(v)} g`
}

/** 0.06 → "6.0%" */
export function pct(v: Num): string {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`
}

export function fixed2(v: Num): string {
  return v == null ? "—" : v.toFixed(2)
}

// Fixed month names: browsers differ ("Sep" vs "Sept") and design.md specifies "Sep".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const dd = (d: Date) => String(d.getDate()).padStart(2, "0")

function parse(d: string): Date {
  // Postgres dates are YYYY-MM-DD; parse as local date, not UTC.
  const [y, m, day] = d.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, day)
}

/** "02 Oct 2026" */
export function date(d: string | null | undefined): string {
  if (!d) return "—"
  const dt = parse(d)
  return `${dd(dt)} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

/** "02 Oct" in the current year, full date otherwise. */
export function dateShortOrFull(d: string | null | undefined): string {
  if (!d) return "—"
  const dt = parse(d)
  return dt.getFullYear() === new Date().getFullYear() ? `${dd(dt)} ${MONTHS[dt.getMonth()]}` : date(d)
}

/** "Day 45 · Wk 7" */
export function age(days: Num): string {
  if (days == null) return "—"
  return `Day ${days} · Wk ${Math.floor(days / 7) + 1}`
}

/** Today as YYYY-MM-DD in local time (for date inputs). */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}
