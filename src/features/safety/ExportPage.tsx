import { DownloadIcon, InfoIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { date, today } from "@/lib/format"
import { download, toCsv, zip } from "./csv"
import { fetchAll } from "./fetchAll"
import { getLastExport, lastExportDaysAgo, setLastExport } from "./lastExport"

const tables = [
  "sheds", "items", "suppliers", "buyers", "batches", "chick_purchases", "purchases",
  "sales", "payments", "usages", "mortalities", "weights",
] as const
// Views have no single id: order by their natural key.
const views: [string, string, [string, string]][] = [
  ["batch_summary", "v_batch_summary", ["id", "id"]],
  ["bills", "v_bills", ["bill_type", "bill_id"]],
  ["item_stock", "v_item_stock", ["id", "id"]],
]

export function ExportPage() {
  const [progress, setProgress] = useState<string | null>(null)
  const [last, setLast] = useState(getLastExport)

  async function run() {
    const jobs: [string, string, [string, string]][] = [
      ...tables.map((t): [string, string, [string, string]] => [t, t, ["id", "id"]]),
      ...views,
    ]
    try {
      const files: { name: string; content: string }[] = []
      for (const [i, [name, source, order]] of jobs.entries()) {
        setProgress(`Exporting ${name.replaceAll("_", " ")}… ${i + 1}/${jobs.length}`)
        files.push({ name: `${name}.csv`, content: toCsv(await fetchAll(source, order)) })
      }
      download(zip(files), `batch-audit-${today()}.zip`)
      setLastExport()
      setLast(getLastExport())
      toast.success("Export downloaded")
    } catch (e) {
      toast.error(`Export failed: ${(e as { message?: string })?.message ?? "unknown error"}`)
    } finally {
      setProgress(null)
    }
  }

  const days = lastExportDaysAgo()
  return (
    <>
      <PageHeader title="Export data" back backTo="/more" />
      <div className="space-y-4 p-4">
        <p className="text-muted-foreground">Download all records as CSV files (opens in Excel / Google Sheets).</p>
        <p>
          Last export:{" "}
          {last ? `${date(last.toISOString())} (${days === 0 ? "today" : `${days} days ago`})` : "never"}
        </p>
        <Button size="lg" className="h-14 w-full" disabled={!!progress} onClick={run}>
          <DownloadIcon /> {progress ?? "Download all data (.zip)"}
        </Button>
        <ul className="space-y-1 text-sm">
          <li>✓ 12 tables (incl. deleted rows)</li>
          <li>✓ Batch summary</li>
          <li>✓ Bills with paid / due</li>
          <li>✓ Stock</li>
        </ul>
        <div className="flex gap-2 rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          Do this every week and keep the file in Google Drive or email it to yourself.
        </div>
      </div>
    </>
  )
}
