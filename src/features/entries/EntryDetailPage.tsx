/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRightIcon, MoreVerticalIcon } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, ListSkeleton, Row as KV, SectionTitle, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"
import { date, dateShortOrFull, money } from "@/lib/format"
import { unwrap } from "@/lib/queries"
import { cn } from "@/lib/utils"
import {
  BILL_DELETED,
  db,
  deletedReason,
  entryConfigs,
  invalidateLedgers,
  isEntryType,
  paymentBill,
  stripDeleted,
  withDeleted,
  type EntryConfig,
  type Row,
} from "./entryTypes"

const sumAmount = (rows: Row[]) => rows.reduce((s, p) => s + Number(p.amount), 0)
const taggedWithBill = (p: Row) => !!p.is_void && !!deletedReason(p.note)?.startsWith(BILL_DELETED)

export function EntryDetailPage() {
  const { type, id } = useParams()
  if (!isEntryType(type) || !Number(id)) return <Navigate to="/more" replace />
  return <EntryDetail key={`${type}/${id}`} cfg={entryConfigs[type]} id={Number(id)} />
}

function EntryDetail({ cfg, id }: { cfg: EntryConfig; id: number }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<"delete" | "restore" | null>(null)
  const [reason, setReason] = useState("")

  const entry = useQuery({
    queryKey: ["entries", cfg.type, id],
    queryFn: async () => unwrap(await db(cfg.table).select(cfg.select).eq("id", id).single()) as Row,
  })
  const pays = useQuery({
    queryKey: ["entries", cfg.type, id, "payments"],
    enabled: !!cfg.bill,
    queryFn: async () =>
      unwrap(await db("payments").select("*").eq(cfg.bill!.payCol, id).order("date").order("id")) as Row[],
  })
  // Gain vs previous sample comes from the view (it skips deleted rows, so it is empty for them).
  const gain = useQuery({
    queryKey: ["entries", cfg.type, id, "gain"],
    enabled: cfg.type === "weights",
    queryFn: async () => (await db("v_batch_weights").select("gain_g").eq("id", id).maybeSingle()).data as Row | null,
  })

  const row = entry.data
  const isVoid = !!row?.is_void
  const allPays = pays.data ?? []
  const livePays = allPays.filter((p) => !p.is_void)
  const paid = sumAmount(livePays)
  const amount = row && cfg.bill ? Number(row[cfg.bill.amountCol]) : 0
  const due = amount - paid
  const status = due <= 0 ? "PAID" : paid > 0 ? "PARTIALLY" : "DUE"

  /** Restores the entry and (for bills) the given payments, bill first so the payment guard sees it. */
  const restoreFn = async (r: Row, payRows: Row[]) => {
    unwrap(await db(cfg.table).update({ is_void: false, note: stripDeleted(r.note) }).eq("id", r.id))
    for (const p of payRows)
      unwrap(await db("payments").update({ is_void: false, note: stripDeleted(p.note) }).eq("id", p.id))
  }

  const del = useMutation({
    mutationFn: async (why: string) => {
      const r = row!
      unwrap(await db(cfg.table).update({ is_void: true, note: withDeleted(r.note, why) }).eq("id", id))
      try {
        for (const p of livePays)
          unwrap(await db("payments").update({ is_void: true, note: withDeleted(p.note, `${BILL_DELETED}: ${why}`) }).eq("id", p.id))
      } catch (e) {
        await db(cfg.table).update({ is_void: false, note: r.note }).eq("id", id) // roll the bill back
        throw e
      }
      return { before: r, voided: livePays }
    },
    onSuccess: ({ before, voided }) => {
      invalidateLedgers(qc)
      setDialog(null)
      setReason("")
      toast.success(`${cfg.singular} #${id} deleted`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () =>
            restoreFn(before, voided)
              .then(() => {
                invalidateLedgers(qc)
                toast.success(`${cfg.singular} #${id} restored`)
              })
              .catch((e) => toast.error(errorMessage(e))),
        },
      })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const restore = useMutation({
    mutationFn: async (withPayments: boolean) => restoreFn(row!, withPayments ? allPays.filter(taggedWithBill) : []),
    onSuccess: () => {
      invalidateLedgers(qc)
      setDialog(null)
      toast.success(`${cfg.singular} #${id} restored`)
    },
    onError: (e) => {
      setDialog(null)
      toast.error(errorMessage(e))
    },
  })

  const tagged = allPays.filter(taggedWithBill)
  const startRestore = () => (cfg.bill && tagged.length > 0 ? setDialog("restore") : restore.mutate(false))
  const recordUrl = cfg.bill ? `/payments/new?party=${cfg.bill.party}&bill=${cfg.bill.type}:${id}` : ""

  const section = (title: string, items: [string, string][]) =>
    items.length > 0 && (
      <section className="space-y-1">
        <SectionTitle>{title}</SectionTitle>
        <div className="divide-y">
          {items.map(([k, v]) => (
            <KV key={k} label={k} value={v} />
          ))}
        </div>
      </section>
    )

  const bill = row && cfg.type === "payments" ? paymentBill(row) : null

  return (
    <>
      <PageHeader
        title={`${cfg.singular} #${id}`}
        back
        backTo={`/entries/${cfg.type}`}
        actions={
          row && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVerticalIcon className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isVoid ? (
                  <DropdownMenuItem onSelect={startRestore}>Restore</DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => navigate(`/${cfg.type}/${id}/edit`)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onSelect={() => setDialog("delete")}>
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      <div className="mx-auto max-w-screen-sm space-y-5 p-4">
        {entry.isLoading && <ListSkeleton rows={4} />}
        {entry.error && <ErrorNote error={entry.error} />}

        {row && (
          <>
            {isVoid && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3 text-sm">
                <span>
                  Deleted{deletedReason(row.note) ? ` · reason: ${deletedReason(row.note)}` : ""}
                </span>
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={startRestore}>
                  Restore
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground">{cfg.subtitle(row)}</p>
              {cfg.bill && !isVoid && pays.isSuccess && <StatusBadge status={status} />}
            </div>

            <div className={cn("space-y-5", isVoid && "text-muted-foreground line-through")}>
              {section("Entered", cfg.entered(row))}
              {bill && (
                <div className="py-1.5">
                  <KV
                    label="Bill"
                    value={
                      <Link to={`/entries/${bill.route}/${bill.id}`} className="inline-flex items-center text-foreground underline-offset-2 hover:underline">
                        {bill.label} · {bill.party ?? "—"}
                        <ChevronRightIcon className="size-4" />
                      </Link>
                    }
                  />
                </div>
              )}
              {section("Calculated", cfg.calculated(row, gain.data))}
            </div>

            {cfg.bill && (
              <section className="space-y-2">
                <SectionTitle>Payments</SectionTitle>
                {pays.isLoading && <ListSkeleton rows={1} />}
                {pays.error && <ErrorNote error={pays.error} />}
                {pays.isSuccess && allPays.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
                {allPays.map((p) => (
                  <Card key={p.id} className="cursor-pointer flex-row items-center gap-3 px-4 py-3 active:bg-accent" onClick={() => navigate(`/entries/payments/${p.id}`)}>
                    <span className={cn("flex-1 text-sm", p.is_void && "text-muted-foreground line-through")}>
                      {dateShortOrFull(p.date)} · {p.method.charAt(0) + p.method.slice(1).toLowerCase()}
                      {p.is_void && " · deleted"}
                    </span>
                    <span className={cn("font-medium tabular-nums", p.is_void && "text-muted-foreground line-through")}>{money(p.amount, 2)}</span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Card>
                ))}
                {pays.isSuccess && !isVoid && (
                  <>
                    <KV label="Due" value={money(due, 2)} strong />
                    {due > 0 && (
                      <Button variant="outline" className="h-11 w-full" onClick={() => navigate(recordUrl)}>
                        Record payment
                      </Button>
                    )}
                  </>
                )}
              </section>
            )}

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Note: {stripDeleted(row.note) ?? "—"}</p>
              <p>
                Created{" "}
                {row.created_at
                  ? new Date(row.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : date(row.date)}
              </p>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {cfg.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cfg.bill && livePays.length > 0
                ? `This ${cfg.singular.toLowerCase()} has ${livePays.length} payment${livePays.length > 1 ? "s" : ""} (${money(paid)}). Deleting it also deletes ${livePays.length > 1 ? "its payments" : "that payment"}. You can restore it later.`
                : "It is hidden everywhere but kept in history. You can restore it later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for deleting" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!reason.trim() || del.isPending}
              onClick={(e) => {
                e.preventDefault()
                del.mutate(reason.trim())
              }}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "restore"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this {cfg.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              It was deleted together with {tagged.length} payment{tagged.length > 1 ? "s" : ""} ({money(sumAmount(tagged))}). Restore{" "}
              {tagged.length > 1 ? "them" : "it"} too?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate(false)}
            >
              {cfg.singular} only
            </Button>
            <AlertDialogAction
              disabled={restore.isPending}
              onClick={(e) => {
                e.preventDefault()
                restore.mutate(true)
              }}
            >
              Restore with payments
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
