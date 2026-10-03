// Maps Postgres / PostgREST errors to plain messages (docs/design.md §4.5).

type DbError = { code?: string; message?: string; hint?: string | null; details?: string | null } | null | undefined

const byHint: Record<string, string | null> = {
  usage_no_purchase: "This item has no purchase on or before this date. Record the purchase first.",
  usage_return_not_issued: "This item was never issued to this batch.",
  usage_return_too_much: null, // DB message already has the numbers
  payment_too_much: null,
  payment_no_bill: "That bill was deleted.",
}

const byConstraint: Record<string, string> = {
  sales_net: "Crate deduction is larger than the weight.",
  sales_birds: "Enter at least one bird (male or female).",
  sales_amount: "Discount is larger than the sale amount.",
  items_feed_needs_weight: "Feed needs kg per bag.",
  batches_dates: "Close date can't be before start date.",
  chick_purchases_discount: "Discount is more than the total price.",
  payments_one_bill: "A payment must belong to exactly one bill.",
}

export function isForeignKeyViolation(err: DbError): boolean {
  return err?.code === "23503"
}

export function errorMessage(err: unknown): string {
  const e = err as DbError
  if (!e) return "Something went wrong."
  if (e.message === "Failed to fetch" || e.message?.includes("NetworkError")) {
    return "No connection. Not saved. Try again."
  }
  if (e.hint && e.hint in byHint) return byHint[e.hint] ?? e.message ?? "Not allowed."
  if (e.code === "23505") return "This code is already used."
  if (e.code === "23503") return "Used in other records."
  if (e.code === "23514") {
    const name = Object.keys(byConstraint).find((c) => e.message?.includes(c))
    if (name) return byConstraint[name]
  }
  if (e.message === "Invalid login credentials") return "Email or password is wrong."
  return `Couldn't save: ${e.message ?? "unknown error"}`
}
