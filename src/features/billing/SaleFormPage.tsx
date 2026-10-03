import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useController, useForm, type Control } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, Row } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/errors"
import { kg, money, num, today } from "@/lib/format"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import {
  activeOrSelected,
  BatchField,
  belowPaid,
  decimalInput,
  Field,
  FormBar,
  intInput,
  invalidateBilling,
  lastUsed,
  n,
  notNegative,
  orNull,
  PaidSummary,
  PayNow,
  PickField,
  positive,
  r2,
  ResultCard,
  Section,
  useBill,
  useDefaultBatch,
  useMasterRows,
  Warn,
  type Method,
} from "./shared"

type Values = {
  batch_id: string
  buyer_id: string
  date: string
  male: string
  female: string
  grade: "A" | "B" | "C"
  gross: string
  ded: string
  rate: string
  discount: string
  received: string
  method: Method
  note: string
}

const blank = (): Values => ({
  batch_id: "",
  buyer_id: "",
  date: today(),
  male: "",
  female: "",
  grade: "A",
  gross: "",
  ded: lastUsed.get("lastDeductionG") ?? "",
  rate: "",
  discount: "",
  received: "",
  method: (lastUsed.get("lastMethod") as Method) ?? "CASH",
  note: "",
})

function GradeToggle({ control }: { control: Control<Values> }) {
  const { field } = useController({ control, name: "grade" })
  return (
    <ToggleGroup type="single" variant="outline" value={field.value} onValueChange={(v) => v && field.onChange(v)} className="h-11">
      {(["A", "B", "C"] as const).map((g) => (
        <ToggleGroupItem key={g} value={g} className="h-11">
          {g}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function SaleFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const again = useRef(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const existing = useQuery({
    queryKey: ["entries", "sales", id],
    enabled: isEdit,
    queryFn: async () => unwrap(await supabase.from("sales").select("*").eq("id", id!).single()),
  })
  const bill = useBill("SALE", id)
  const buyers = useMasterRows("buyers")

  const form = useForm<Values>({ defaultValues: blank() })
  const { register, handleSubmit, reset, setValue, watch, control, setError, formState } = form
  const v = watch()
  const batches = useDefaultBatch(!isEdit, v.batch_id, (b) => setValue("batch_id", b), search.get("batch"))

  useEffect(() => {
    const s = existing.data
    if (!s) return
    reset({
      batch_id: String(s.batch_id),
      buyer_id: String(s.buyer_id),
      date: s.date,
      male: String(s.male_count),
      female: String(s.female_count),
      grade: s.grade,
      gross: String(s.gross_weight_kg),
      ded: String(s.deduction_per_crate_g),
      rate: String(s.rate),
      discount: String(s.discount),
      received: "",
      method: "CASH",
      note: s.note ?? "",
    })
    if (s.note) setNoteOpen(true)
  }, [existing.data, reset])

  // Live preview: mirrors the generated columns in the database.
  const birds = n(v.male) + n(v.female)
  const gross = n(v.gross)
  const crates = Math.ceil(gross / 20)
  const dedKg = (crates * n(v.ded)) / 1000
  const net = gross - dedKg
  const amount = r2(net * n(v.rate) - n(v.discount))
  const received = n(v.received)
  const avg = birds > 0 ? net / birds : 0
  const ready = gross > 0 && n(v.rate) > 0

  const batch = batches?.find((b) => String(b.id) === v.batch_id)
  const live = batch ? (batch.live_balance ?? 0) + (isEdit && existing.data?.batch_id === batch.id ? (existing.data.total_birds ?? 0) : 0) : null
  const below = isEdit && ready ? belowPaid(amount, bill.data?.paid) : null

  const save = useMutation({
    mutationFn: async (f: Values) => {
      const row = {
        date: f.date,
        batch_id: Number(f.batch_id),
        buyer_id: Number(f.buyer_id),
        male_count: n(f.male),
        female_count: n(f.female),
        grade: f.grade,
        gross_weight_kg: n(f.gross),
        deduction_per_crate_g: n(f.ded),
        rate: n(f.rate),
        discount: n(f.discount),
        note: orNull(f.note),
      }
      if (isEdit) {
        unwrap(await supabase.from("sales").update(row).eq("id", id))
        return id
      }
      return unwrap(
        await supabase.rpc("create_sale", {
          p_date: row.date,
          p_batch_id: row.batch_id,
          p_buyer_id: row.buyer_id,
          p_male_count: row.male_count,
          p_female_count: row.female_count,
          p_grade: row.grade,
          p_gross_weight_kg: row.gross_weight_kg,
          p_deduction_per_crate_g: row.deduction_per_crate_g,
          p_rate: row.rate,
          p_discount: row.discount,
          p_received: n(f.received),
          p_method: f.method,
          p_note: row.note ?? undefined,
        }),
      )
    },
    onSuccess: (_id, f) => {
      invalidateBilling(qc, "sales")
      qc.invalidateQueries({ queryKey: ["entries", "sales"] })
      lastUsed.set("lastBatchId", f.batch_id)
      lastUsed.set("lastDeductionG", f.ded)
      lastUsed.set("lastMethod", f.method)
      toast.success(
        `Saved: ${num(birds)} birds · ${kg(net)} · ${money(amount)}` +
          (isEdit ? "" : ` · due ${money(Math.max(amount - received, 0))}`),
      )
      if (again.current && !isEdit) {
        reset({ ...blank(), batch_id: f.batch_id, buyer_id: f.buyer_id, date: f.date, rate: f.rate, ded: f.ded, method: f.method })
      } else if (window.history.length > 1) navigate(-1)
      else navigate("/")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = (f: Values) => {
    if (birds === 0) return setError("male", { message: "Enter at least one bird" })
    if (live != null && birds > live) return setError("male", { message: `Only ${num(live)} birds are live` })
    if (below) return toast.error(below)
    save.mutate(f)
  }

  const err = formState.errors
  return (
    <>
      <PageHeader title={isEdit ? "Edit sale" : "Sale"} back backTo="/" />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form id="sale-form" onSubmit={handleSubmit(submit)} className="space-y-5 p-4 pb-28">
        <BatchField
          control={control}
          name="batch_id"
          batches={batches ?? []}
          label={(b) => `${b.code} · ${num(b.live_balance)} live`}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *" error={err.date?.message}>
            <Input type="date" className="h-11" {...register("date", { required: "Date is required" })} />
          </Field>
          <PickField
            control={control}
            name="buyer_id"
            label="Buyer"
            options={activeOrSelected(buyers.data, v.buyer_id).map((b) => ({ value: String(b.id), label: b.name }))}
          />
        </div>

        <Section title="Birds">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Male" error={err.male?.message}>
              <Input {...intInput} {...register("male", { validate: notNegative })} />
            </Field>
            <Field label="Female" error={err.female?.message}>
              <Input {...intInput} {...register("female", { validate: notNegative })} />
            </Field>
            <Field label="Grade">
              <GradeToggle control={control} />
            </Field>
          </div>
        </Section>

        <Section title="Weight">
          <Field label="Gross weight on scale (kg) *" error={err.gross?.message}>
            <Input {...decimalInput} {...register("gross", { validate: positive })} />
          </Field>
          <Field label="Deduction per crate (g)" error={err.ded?.message}>
            <Input {...decimalInput} {...register("ded", { validate: notNegative })} />
          </Field>
        </Section>

        <Section title="Price">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate per kg (net) *" error={err.rate?.message}>
              <Input {...decimalInput} {...register("rate", { validate: positive })} />
            </Field>
            <Field label="Discount" error={err.discount?.message}>
              <Input {...decimalInput} {...register("discount", { validate: notNegative })} />
            </Field>
          </div>
        </Section>

        <ResultCard>
          <Row label="Birds · crates" value={`${num(birds)} · ${num(crates)}`} />
          <Row label="Deduction" value={kg(dedKg)} />
          <Row label="Net weight" value={`${kg(net)}${birds > 0 ? ` · avg ${avg.toFixed(2)} kg/bird` : ""}`} />
          <Row label="Amount" value={money(amount, 2)} strong />
        </ResultCard>
        {gross > 0 && net <= 0 && <Warn>Crate deduction is larger than the weight.</Warn>}
        {ready && amount < 0 && <Warn>Discount is larger than the sale amount.</Warn>}
        {birds > 0 && net > 0 && (avg < 0.5 || avg > 3.5) && <Warn>Check weight: {avg.toFixed(1)} kg per bird looks wrong.</Warn>}
        {live != null && birds > live && <Warn>Only {num(live)} birds are live in this batch.</Warn>}
        {below && <Warn>{below}</Warn>}

        {isEdit ? (
          <PaidSummary bill={bill.data} />
        ) : (
          <PayNow
            control={control}
            register={register}
            setValue={setValue}
            paidName="received"
            methodName="method"
            label="Received now"
            amount={Math.max(amount, 0)}
            paid={received}
          />
        )}

        {noteOpen ? (
          <Field label="Note">
            <Textarea {...register("note")} />
          </Field>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            + Add note
          </Button>
        )}
      </form>
      <FormBar formId="sale-form" pending={save.isPending} isEdit={isEdit} again={again} />
    </>
  )
}
