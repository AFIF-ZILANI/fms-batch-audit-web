import { useQuery } from "@tanstack/react-query"
import { supabase } from "./supabase"

/** Query keys in one place so mutations can invalidate the right caches. */
export const keys = {
  batchSummaries: ["v_batch_summary"] as const,
  batchSummary: (id: number) => ["v_batch_summary", id] as const,
  batch: (id: number) => ["batches", id] as const,
  master: (table: string) => ["master", table] as const,
}

/**
 * Throws Supabase errors so React Query puts them in `error`, and returns the data.
 * `data` is only null for writes without `.select()`, whose result callers ignore.
 */
export function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R["data"]> {
  if (res.error) throw res.error
  return res.data as NonNullable<R["data"]>
}

export function useBatchSummaries() {
  return useQuery({
    queryKey: keys.batchSummaries,
    queryFn: async () =>
      unwrap(await supabase.from("v_batch_summary").select("*").order("start_date", { ascending: false })),
  })
}

export function useBatchSummary(id: number) {
  return useQuery({
    queryKey: keys.batchSummary(id),
    queryFn: async () => unwrap(await supabase.from("v_batch_summary").select("*").eq("id", id).single()),
  })
}

/**
 * Next code for a prefix, e.g. ("batches", "B-", 3) → "B-004".
 * Looks at existing codes starting with the prefix and adds one to the highest number.
 */
export async function nextCode(
  table: "batches" | "sheds" | "items" | "suppliers" | "buyers",
  prefix: string,
  pad: number,
): Promise<string> {
  const rows = unwrap(await supabase.from(table).select("code").like("code", `${prefix}%`))
  const max = rows.reduce((m, r) => {
    const n = Number.parseInt(r.code.slice(prefix.length), 10)
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `${prefix}${String(max + 1).padStart(pad, "0")}`
}
