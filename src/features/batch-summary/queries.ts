import { useQuery } from "@tanstack/react-query"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

const k = (name: string, id: number) => ["batch-summary", name, id] as const

export function useBatchWeights(id: number) {
  return useQuery({
    queryKey: k("weights", id),
    queryFn: async () =>
      unwrap(await supabase.from("v_batch_weights").select("*").eq("batch_id", id).order("date", { ascending: false })),
  })
}

export function useBatchMortalities(id: number) {
  return useQuery({
    queryKey: k("mortalities", id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from("mortalities")
          .select("id,date,dead_count,reason,sheds(code,name)")
          .eq("batch_id", id)
          .eq("is_void", false)
          .order("date", { ascending: false }),
      ),
  })
}

export function useBatchUsages(id: number) {
  return useQuery({
    queryKey: k("usages", id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from("usages")
          .select("kind,qty,items(id,name,unit,unit_weight_kg,category)")
          .eq("batch_id", id)
          .eq("is_void", false),
      ),
  })
}

export function useBatchSales(id: number) {
  return useQuery({
    queryKey: k("sales", id),
    queryFn: async () => {
      const [bills, sales] = await Promise.all([
        supabase.from("v_bills").select("*").eq("bill_type", "SALE").eq("batch_id", id).order("date", { ascending: false }),
        supabase.from("sales").select("id,total_birds,net_weight_kg,buyers(name)").eq("batch_id", id).eq("is_void", false),
      ])
      const byId = new Map(unwrap(sales).map((s) => [s.id, s]))
      return unwrap(bills).flatMap((b) => {
        const s = byId.get(b.bill_id ?? -1)
        return s ? [{ ...b, birds: s.total_birds, netKg: s.net_weight_kg, buyer: s.buyers?.name ?? "" }] : []
      })
    },
  })
}

export function useBatchChickBills(id: number) {
  return useQuery({
    queryKey: k("chicks", id),
    queryFn: async () => {
      const [bills, cps] = await Promise.all([
        supabase.from("v_bills").select("*").eq("bill_type", "CHICKS").eq("batch_id", id).order("date", { ascending: false }),
        supabase
          .from("chick_purchases")
          .select("id,chicks_placed,rate,suppliers(name)")
          .eq("batch_id", id)
          .eq("is_void", false),
      ])
      const byId = new Map(unwrap(cps).map((c) => [c.id, c]))
      return unwrap(bills).flatMap((b) => {
        const c = byId.get(b.bill_id ?? -1)
        return c ? [{ ...b, chicks: c.chicks_placed, rate: c.rate, supplier: c.suppliers?.name ?? "" }] : []
      })
    },
  })
}
