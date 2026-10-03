import { useQuery } from "@tanstack/react-query"
import { today } from "@/lib/format"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

export function useReminders() {
  return useQuery({
    queryKey: ["v_reminders"],
    queryFn: async () => unwrap(await supabase.from("v_reminders").select("*").order("batch_code")),
  })
}

export function useDataCheckCount() {
  return useQuery({
    queryKey: ["v_data_checks", "count"],
    queryFn: async () => {
      const res = await supabase.from("v_data_checks").select("*", { count: "exact", head: true })
      if (res.error) throw res.error
      return res.count ?? 0
    },
  })
}

/** { weOwe, owedToUs } across all suppliers / buyers. */
export function useMoneyStrip() {
  return useQuery({
    queryKey: ["money-strip"],
    queryFn: async () => {
      const [s, b] = await Promise.all([
        supabase.from("v_supplier_balance").select("due"),
        supabase.from("v_buyer_balance").select("due"),
      ])
      const sum = (rows: { due: number | null }[]) => rows.reduce((t, r) => t + (r.due ?? 0), 0)
      return { weOwe: sum(unwrap(s)), owedToUs: sum(unwrap(b)) }
    },
  })
}

/** Entries dated today per batch id (usages, mortalities, weights, sales). */
export function useTodayCounts() {
  return useQuery({
    queryKey: ["today-counts", today()],
    queryFn: async () => {
      const d = today()
      const results = await Promise.all([
        supabase.from("usages").select("batch_id").eq("date", d).eq("is_void", false),
        supabase.from("mortalities").select("batch_id").eq("date", d).eq("is_void", false),
        supabase.from("weights").select("batch_id").eq("date", d).eq("is_void", false),
        supabase.from("sales").select("batch_id").eq("date", d).eq("is_void", false),
      ])
      const counts: Record<number, number> = {}
      for (const r of results) for (const row of unwrap(r)) counts[row.batch_id] = (counts[row.batch_id] ?? 0) + 1
      return counts
    },
  })
}
