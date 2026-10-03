import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, SaveBar } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"
import { age, date as fmtDate, grams, kg, today } from "@/lib/format"
import { unwrap, useBatchSummaries } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { BatchPicker, DeleteEntry, Field, lastUsed, rememberLast, ResultCard, toNum, useEntryRow, useInvalidateDaily, Warn } from "./shared"

type Values = { batch: string; date: string; size: string; total: string; note: string }

const dayMs = 86_400_000
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / dayMs)

export function WeightFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const invalidate = useInvalidateDaily()
  const addAnother = useRef(false)
  const [showNote, setShowNote] = useState(false)

  const form = useForm<Values>({
    defaultValues: { batch: search.get("batch") ?? lastUsed("batch"), date: today(), size: "", total: "", note: "" },
  })
  const { register, handleSubmit, reset, setValue, watch, setError, formState } = form
  const [batch, date, sizeText, totalText] = watch(["batch", "date", "size", "total"])
  const err = formState.errors
  const batchId = Number(batch) || 0

  const existing = useEntryRow("weights", id)
  useEffect(() => {
    const w = existing.data
    if (!w) return
    reset({ batch: String(w.batch_id), date: w.date, size: String(w.sample_size), total: String(w.total_weight_kg), note: w.note ?? "" })
    if (w.note) setShowNote(true)
  }, [existing.data, reset])

  const summaries = useBatchSummaries()
  const sum = summaries.data?.find((b) => b.id === batchId)

  // Previous sample: latest before the chosen date.
  const prevQ = useQuery({
    queryKey: ["v_batch_weights", batchId, date],
    enabled: batchId > 0 && !!date,
    queryFn: async () =>
      unwrap(await supabase.from("v_batch_weights").select("id, date, avg_weight_g").eq("batch_id", batchId).lt("date", date).order("date", { ascending: false }).limit(2)),
  })
  const prev = (prevQ.data ?? []).find((r) => r.id !== id)

  const size = toNum(sizeText)
  const total = toNum(totalText)
  const ready = size > 0 && total > 0
  const avg = ready ? (total * 1000) / size : null
  const ageDays = sum?.start_date ? dayDiff(date, sum.start_date) : null
  const live = sum?.live_balance ?? null
  const outOfRange = avg != null && (avg > 5000 || avg < 20)

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const row = {
        date: v.date,
        batch_id: Number(v.batch),
        sample_size: toNum(v.size),
        total_weight_kg: toNum(v.total),
        note: v.note.trim() || null,
      }
      return unwrap(await (isEdit ? supabase.from("weights").update(row).eq("id", id) : supabase.from("weights").insert(row)).select("avg_weight_g").single())
    },
    onSuccess: (saved, v) => {
      rememberLast("batch", v.batch)
      invalidate("weights")
      toast.success(`Saved — avg ${grams(saved.avg_weight_g)} · ${sum?.code ?? "batch"}`)
      if (addAnother.current && !isEdit) {
        reset({ ...v, size: "", total: "", note: "" })
        setShowNote(false)
      } else navigate(-1)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = handleSubmit((v) => {
    if (!v.batch) return setError("batch", { message: "Choose a batch" })
    const s = toNum(v.size)
    if (!Number.isInteger(s) || s <= 0) return setError("size", { message: "Enter a whole number above 0" })
    const t = toNum(v.total)
    if (!(t > 0)) return setError("total", { message: "Enter the total weight above 0" })
    if ((t * 1000) / s > 5000 || (t * 1000) / s < 20) return setError("total", { message: "Check units: total weight is in kg" })
    save.mutate(v)
  })

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit weight sample" : "Weight sample"}
        back
        backTo="/batches"
        actions={isEdit && existing.data && <DeleteEntry table="weights" id={id} note={existing.data.note} />}
      />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 p-4 pb-28">
        <BatchPicker value={batch} onChange={(v) => setValue("batch", v)} error={err.batch?.message} />
        <Field label="Date *" htmlFor="date">
          <Input id="date" type="date" className="h-11" {...register("date", { required: true })} />
        </Field>
        <Field label="Birds weighed *" htmlFor="size" error={err.size?.message}>
          <Input id="size" inputMode="numeric" className="h-11" placeholder="50" {...register("size")} />
        </Field>
        <Field label="Total weight (kg) *" htmlFor="total" error={err.total?.message}>
          <Input id="total" inputMode="decimal" className="h-11" placeholder="0" {...register("total")} />
        </Field>

        {avg != null && (
          <ResultCard>
            <div>
              Avg {grams(avg)}
              {ageDays != null && ageDays >= 0 && ` · ${age(ageDays)}`}
            </div>
            {prev?.avg_weight_g != null && (
              <div>
                {avg - prev.avg_weight_g >= 0 ? "+" : "−"}
                {grams(Math.abs(avg - prev.avg_weight_g))} since {fmtDate(prev.date)} ({grams(prev.avg_weight_g)})
              </div>
            )}
            {live != null && (
              <div>
                Flock est. {kg((avg * live) / 1000)} ({live.toLocaleString("en-IN")} live)
              </div>
            )}
          </ResultCard>
        )}
        {ready && size < 30 && <Warn>Small sample (&lt; 30 birds), result may be misleading.</Warn>}
        {avg != null && !outOfRange && prev?.avg_weight_g != null && avg < prev.avg_weight_g && (
          <Warn>Lower than last sample ({grams(prev.avg_weight_g)}). Check the numbers.</Warn>
        )}
        {outOfRange && <p className="text-sm text-red-600">Check units: total weight is in kg.</p>}

        {showNote ? (
          <Field label="Note" htmlFor="note">
            <Textarea id="note" {...register("note")} />
          </Field>
        ) : (
          <button type="button" className="text-sm text-muted-foreground" onClick={() => setShowNote(true)}>
            + Add note
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
