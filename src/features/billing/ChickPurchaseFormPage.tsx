import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, Row } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"
import { date, money, num, today } from "@/lib/format"
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
  supplier_id: string
  date: string
  chicks: string
  rate: string
  discount: string
  paid: string
  method: Method
  note: string
}

const blank = (): Values => ({
  batch_id: "",
  supplier_id: "",
  date: today(),
  chicks: "",
  rate: "",
  discount: "",
  paid: "",
  method: (lastUsed.get("lastMethod") as Method) ?? "CASH",
  note: "",
})

export function ChickPurchaseFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const again = useRef(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const existing = useQuery({
    queryKey: ["entries", "chick_purchases", id],
    enabled: isEdit,
    queryFn: async () => unwrap(await supabase.from("chick_purchases").select("*").eq("id", id!).single()),
  })
  const bill = useBill("CHICKS", id)
  const suppliers = useMasterRows("suppliers")

  const form = useForm<Values>({ defaultValues: blank() })
  const { register, handleSubmit, reset, setValue, watch, control, formState } = form
  const v = watch()
  const batches = useDefaultBatch(!isEdit, v.batch_id, (b) => setValue("batch_id", b), search.get("batch"))

  useEffect(() => {
    const c = existing.data
    if (!c) return
    reset({
      batch_id: String(c.batch_id),
      supplier_id: String(c.supplier_id),
      date: c.date,
      chicks: String(c.chicks_placed),
      rate: String(c.rate),
      discount: String(c.discount),
      paid: "",
      method: "CASH",
      note: c.note ?? "",
    })
    if (c.note) setNoteOpen(true)
  }, [existing.data, reset])

  const chicks = Math.trunc(n(v.chicks))
  const total = r2(chicks * n(v.rate))
  const discount = n(v.discount)
  const net = r2(total - discount)
  const paid = n(v.paid)
  const ready = chicks > 0 && n(v.rate) > 0
  const batch = batches?.find((b) => String(b.id) === v.batch_id)
  const below = isEdit && ready ? belowPaid(net, bill.data?.paid) : null
  const tooMuchDiscount = ready && discount > total

  const save = useMutation({
    mutationFn: async (f: Values) => {
      const row = {
        date: f.date,
        batch_id: Number(f.batch_id),
        supplier_id: Number(f.supplier_id),
        chicks_placed: Math.trunc(n(f.chicks)),
        rate: n(f.rate),
        discount: n(f.discount),
        note: orNull(f.note),
      }
      if (isEdit) {
        unwrap(await supabase.from("chick_purchases").update(row).eq("id", id))
        return id
      }
      return unwrap(
        await supabase.rpc("create_chick_purchase", {
          p_date: row.date,
          p_batch_id: row.batch_id,
          p_supplier_id: row.supplier_id,
          p_chicks_placed: row.chicks_placed,
          p_rate: row.rate,
          p_discount: row.discount,
          p_paid: n(f.paid),
          p_method: f.method,
          p_note: row.note ?? undefined,
        }),
      )
    },
    onSuccess: (_id, f) => {
      invalidateBilling(qc, "chick_purchases")
      lastUsed.set("lastBatchId", f.batch_id)
      lastUsed.set("lastMethod", f.method)
      toast.success(`Saved: ${num(chicks)} chicks · net ${money(net)}` + (isEdit ? "" : ` · due ${money(Math.max(net - paid, 0))}`))
      if (again.current && !isEdit) reset({ ...blank(), batch_id: f.batch_id, supplier_id: f.supplier_id, date: f.date, method: f.method })
      else if (window.history.length > 1) navigate(-1)
      else navigate("/")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const err = formState.errors
  return (
    <>
      <PageHeader title={isEdit ? "Edit chick purchase" : "Chick purchase"} back backTo="/" />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form
        id="chick-form"
        onSubmit={handleSubmit((f) => (below ? toast.error(below) : save.mutate(f)))}
        className="space-y-5 p-4 pb-28"
      >
        <BatchField
          control={control}
          name="batch_id"
          batches={batches ?? []}
          label={(b) => `${b.code} · started ${date(b.start_date)}`}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *" error={err.date?.message}>
            <Input type="date" className="h-11" {...register("date", { required: "Date is required" })} />
          </Field>
          <PickField
            control={control}
            name="supplier_id"
            label="Supplier"
            options={activeOrSelected(suppliers.data, v.supplier_id).map((s) => ({ value: String(s.id), label: s.name }))}
          />
        </div>

        <Section title="Chicks">
          <Field label="Chicks placed *" error={err.chicks?.message}>
            <Input {...intInput} {...register("chicks", { validate: positive })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate per chick *" error={err.rate?.message}>
              <Input {...decimalInput} {...register("rate", { validate: positive })} />
            </Field>
            <Field label="Discount" error={err.discount?.message}>
              <Input {...decimalInput} {...register("discount", { validate: notNegative })} />
            </Field>
          </div>
        </Section>

        <ResultCard>
          <Row label="Total" value={money(total, 2)} />
          <Row label="Net" value={money(net, 2)} strong />
        </ResultCard>
        {tooMuchDiscount && <Warn>Discount is more than the total price.</Warn>}
        {batch && batch.status === "CLOSED" && <Warn>{batch.code} is closed.</Warn>}
        {batch && (batch.chicks_placed ?? 0) > 0 && !isEdit && (
          <p className="text-sm text-muted-foreground">
            {batch.code} already has {num(batch.chicks_placed)} chicks. This adds more.
          </p>
        )}
        {batch?.start_date && v.date < batch.start_date && (
          <Warn>Before batch start ({date(batch.start_date)}). It will show in data checks.</Warn>
        )}
        {below && <Warn>{below}</Warn>}

        {isEdit ? (
          <PaidSummary bill={bill.data} />
        ) : (
          <PayNow
            control={control}
            register={register}
            setValue={setValue}
            paidName="paid"
            methodName="method"
            label="Paid now"
            amount={Math.max(net, 0)}
            paid={paid}
          />
        )}

        {noteOpen ? (
          <Field
            label="Note"
            hint="Free extra chicks: count them in Chicks placed, and put their value in Discount (the rate is per paid chick)."
          >
            <Textarea {...register("note")} />
          </Field>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            + Add note (e.g. extra/free chicks)
          </Button>
        )}
      </form>
      <FormBar formId="chick-form" pending={save.isPending} isEdit={isEdit} again={again} />
    </>
  )
}
