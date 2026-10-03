import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

export type Row = Record<string, string | number | boolean | null>
type Untyped = {
  select: (cols: string) => {
    order: (c: string) => {
      order: (c: string) => {
        range: (a: number, b: number) => PromiseLike<{ data: unknown; error: unknown }>
      }
    }
  }
}

const PAGE = 1000

/** Every row (including voided), paged past PostgREST's 1000-row default. `orderBy` columns must be unique together. */
export async function fetchAll(source: string, orderBy: [string, string] = ["id", "id"]): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const q = (supabase.from(source as never) as unknown as Untyped).select("*").order(orderBy[0]).order(orderBy[1])
    const rows = unwrap(await q.range(from, from + PAGE - 1)) as Row[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}
