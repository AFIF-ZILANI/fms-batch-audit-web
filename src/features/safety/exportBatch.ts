import { download, toCsv } from "./csv"
import { fetchAll } from "./fetchAll"

const children = ["usages", "mortalities", "weights", "sales", "chick_purchases"] as const

/** F-82: one CSV with the batch summary row, then each child table's rows (a `record` column says which). */
export async function exportBatch(batchId: number, code: string) {
  const [summary, ...kids] = await Promise.all([fetchAll("v_batch_summary"), ...children.map((t) => fetchAll(t))])
  const rows = [
    ...summary.filter((r) => r.id === batchId).map((r) => ({ record: "summary", ...r })),
    ...kids.flatMap((k, i) => k.filter((r) => r.batch_id === batchId).map((r) => ({ record: children[i], ...r }))),
  ]
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  download(new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }), `${code}-audit.csv`)
}
