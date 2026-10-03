import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, SaveBar } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/errors"
import { num, pct, today } from "@/lib/format"
import { unwrap, useBatchSummaries } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { BatchPicker, DeleteEntry, Field, lastUsed, rememberLast, ResultCard, toNum, useEntryRow, useInvalidateDaily, Warn } from "./shared"

type Reason = "NORMAL" | "ACCIDENT" | "ILLNESS"
type Values = { batch: string; date: string; shed: string; count: string; reason: Reason; note: string }
const REASONS: [Reason, string][] = [
  ["NORMAL", "Normal"],
  ["ACCIDENT", "Accident"],
  ["ILLNESS", "Illness"],
]

function daysBefore(d: string, n: number) {
  const [y, m, day] = d.split("-").map(Number)
  const t = new Date(y, m - 1, day - n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
}

export function MortalityFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const invalidate = useInvalidateDaily()
  const addAnother = useRef(false)
  const [showNote, setShowNote] = useState(false)

  const form = useForm<Values>({
    defaultValues: { batch: search.get("batch") ?? lastUsed("batch"), date: today(), shed: "", count: "", reason: "NORMAL", note: "" },
  })
  const { register, handleSubmit, reset, setValue, watch, setError, formState } = form
  const [batch, shed, countText, reason, date] = watch(["batch", "shed", "count", "reason", "date"])
  const err = formState.errors
  const batchId = Number(batch) || 0

  const existing = useEntryRow("mortalities", id)
  useEffect(() => {
    const m = existing.data
    if (!m) return
    reset({ batch: String(m.batch_id), date: m.date, shed: String(m.shed_id), count: String(m.dead_count), reason: m.reason, note: m.note ?? "" })
    if (m.note) setShowNote(true)
  }, [existing.data, reset])

  const sheds = useQuery({
    queryKey: ["master", "sheds"],
    queryFn: async () => unwrap(await supabase.from("sheds").select("*").order("code")),
  })
  const summaries = useBatchSummaries()
  const sum = summaries.data?.find((b) => b.id === batchId)

  // Default shed = last shed used for this batch (create mode only).
  const last = useQuery({
    queryKey: ["entries", "mortalities", "last", batchId],
    enabled: batchId > 0 && !isEdit,
    queryFn: async () =>
      unwrap(
        await supabase.from("mortalities").select("shed_id").eq("batch_id", batchId).eq("is_void", false).order("id", { ascending: false }).limit(1),
      ),
  })
  const lastShed = last.data?.[0]?.shed_id
  useEffect(() => {
    if (!isEdit && lastShed && !shed) setValue("shed", String(lastShed))
  }, [isEdit, lastShed, shed, setValue])

  const recent = useQuery({
    queryKey: ["entries", "mortalities", "recent", batchId, date],
    enabled: batchId > 0 && !!date,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("mortalities")
          .select("id, dead_count")
          .eq("batch_id", batchId)
          .eq("is_void", false)
          .gte("date", daysBefore(date, 7))
          .lt("date", date),
      ),
  })

  const count = toNum(countText)
  const own = existing.data && existing.data.batch_id === batchId ? existing.data.dead_count : 0
  const dead = (sum?.dead ?? 0) - own
  const live = (sum?.live_balance ?? 0) + own
  const over = sum != null && count > live
  const weekTotal = (recent.data ?? []).filter((r) => r.id !== id).reduce((s, r) => s + r.dead_count, 0)
  const unusual = count > 0 && weekTotal > 0 && count > 3 * (weekTotal / 7)

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const row = {
        date: v.date,
        batch_id: Number(v.batch),
        shed_id: Number(v.shed),
        dead_count: toNum(v.count),
        reason: v.reason,
        note: v.note.trim() || null,
      }
      return unwrap(await (isEdit ? supabase.from("mortalities").update(row).eq("id", id) : supabase.from("mortalities").insert(row)).select("id"))
    },
    onSuccess: (_r, v) => {
      rememberLast("batch", v.batch)
      invalidate("mortalities")
      const total = dead + toNum(v.count)
      toast.success(`Saved — ${num(toNum(v.count))} dead in ${sum?.code ?? "batch"} · total ${num(total)} (${pct(sum?.chicks_placed ? total / sum.chicks_placed : null)})`)
      if (addAnother.current && !isEdit) {
        reset({ ...v, count: "", note: "", reason: "NORMAL" })
        setShowNote(false)
      } else navigate(-1)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = handleSubmit((v) => {
    if (!v.batch) return setError("batch", { message: "Choose a batch" })
    if (!v.shed) return setError("shed", { message: "Choose a shed" })
    const c = toNum(v.count)
    if (!Number.isInteger(c) || c <= 0) return setError("count", { message: "Enter a whole number above 0" })
    if (over) return setError("count", { message: `Only ${num(live)} birds are live in ${sum?.code}` })
    save.mutate(v)
  })

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit mortality" : "Mortality"}
        back
        backTo="/batches"
        actions={isEdit && existing.data && <DeleteEntry table="mortalities" id={id} note={existing.data.note} />}
      />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 p-4 pb-28">
        <BatchPicker value={batch} onChange={(v) => { setValue("batch", v); if (!isEdit) setValue("shed", "") }} error={err.batch?.message} />
        <Field label="Date *" htmlFor="date">
          <Input id="date" type="date" className="h-11" {...register("date", { required: true })} />
        </Field>
        <Field label="Shed *" error={err.shed?.message}>
          <Select value={shed} onValueChange={(v) => setValue("shed", v)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder="Select shed" />
            </SelectTrigger>
            <SelectContent>
              {(sheds.data ?? [])
                .filter((s) => s.is_active || String(s.id) === shed)
                .map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Dead birds *" htmlFor="count" error={err.count?.message}>
          <Input id="count" inputMode="numeric" className="h-11" placeholder="0" {...register("count")} />
        </Field>
        <Field label="Reason">
          <ToggleGroup
            type="single"
            variant="outline"
            value={reason}
            onValueChange={(v) => v && setValue("reason", v as Reason)}
            className="w-full"
          >
            {REASONS.map(([v, label]) => (
              <ToggleGroupItem key={v} value={v} className="h-11 flex-1">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {sum && count > 0 && (
          <ResultCard>
            <div>
              Today: {num(count)} ({pct(sum.chicks_placed ? count / sum.chicks_placed : null)} of placed)
            </div>
            <div>
              Total: {num(dead + count)} · {pct(sum.chicks_placed ? (dead + count) / sum.chicks_placed : null)}
            </div>
            <div>Live after: {num(live - count)}</div>
          </ResultCard>
        )}
        {over && (
          <p className="text-sm text-red-600">
            Only {num(live)} birds are live in {sum?.code}
          </p>
        )}
        {unusual && <Warn>Unusual: {num(count)} is more than 3× the 7-day daily average ({num(+(weekTotal / 7).toFixed(1))}).</Warn>}

        {showNote || reason === "ILLNESS" ? (
          <Field label={reason === "ILLNESS" ? "Note (symptoms)" : "Note"} htmlFor="note">
            <Textarea id="note" {...register("note")} />
          </Field>
        ) : (
          <button type="button" className="text-sm text-muted-foreground" onClick={() => setShowNote(true)}>
            + Add note (e.g. symptoms)
          </button>
        )}
      </form>
      <SaveBar>
        {!isEdit && (
          <Button type="button" variant="outline" className="h-11 flex-1" disabled={save.isPending} onClick={() => { addAnother.current = true; void submit() }}>
            Save & add another
          </Button>
        )}
        <Button type="button" className="h-11 flex-1" disabled={save.isPending} onClick={() => { addAnother.current = false; void submit() }}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </SaveBar>
    </>
  )
}
