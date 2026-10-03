import { useQuery } from "@tanstack/react-query"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

export type Party = "supplier" | "buyer"

/** Bill type (v_bills.bill_type) → entry route segment. */
export const billRoute: Record<string, string> = { SALE: "sales", PURCHASE: "purchases", CHICKS: "chick-purchases" }

export function useItemStock() {
  return useQuery({
    queryKey: ["v_item_stock"],
    queryFn: async () => unwrap(await supabase.from("v_item_stock").select("*").order("name")),
  })
}

/** Both balance views, normalised (buyer `received` → `paid`). */
export type Balance = {
  id: number
  code: string
  name: string
  company: string | null
  phone: string | null
  is_active: boolean
  bills: number
  billed: number
  paid: number
  due: number
}

export function useBalances(party: Party) {
  return useQuery({
    queryKey: ["balances", party],
    queryFn: async (): Promise<Balance[]> => {
      if (party === "supplier") return unwrap(await supabase.from("v_supplier_balance").select("*")) as Balance[]
      const rows = unwrap(await supabase.from("v_buyer_balance").select("*"))
      return rows.map((r) => ({ ...r, paid: r.received })) as Balance[]
    },
  })
}

export function useBalance(party: Party, id: number) {
  const q = useBalances(party)
  return { ...q, data: q.data?.find((b) => b.id === id) }
}

type BillFilter = { party?: "SUPPLIER" | "BUYER"; partyId?: number; unpaidOnly?: boolean }

export function useBills({ party, partyId, unpaidOnly }: BillFilter = {}) {
  return useQuery({
    queryKey: ["v_bills", party ?? "all", partyId ?? "all", unpaidOnly ?? false],
    queryFn: async () => {
      let q = supabase.from("v_bills").select("*")
      if (party) q = q.eq("party", party)
      if (partyId != null) q = q.eq("party_id", partyId)
      if (unpaidOnly) q = q.gt("due", 0)
      // Unpaid: oldest first. Party detail: newest first.
      return unwrap(await q.order("date", { ascending: !!unpaidOnly }))
    },
  })
}

export function usePartyPayments(party: Party) {
  return useQuery({
    queryKey: ["payments", party],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("payments")
          .select("*")
          .eq("party", party === "supplier" ? "SUPPLIER" : "BUYER")
          .eq("is_void", false)
          .order("date", { ascending: false }),
      ),
  })
}
