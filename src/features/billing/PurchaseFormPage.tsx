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
import { kg, money, num, today } from "@/lib/format"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import {
  activeOrSelected,
  belowPaid,
  decimalInput,
  Field,
  FormBar,
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
  useMasterRows,
  Warn,
  type Method,
} from "./shared"

type Values = {
  date: string
  supplier_id: string
  item_id: string
  qty: string
  unit_price: string
  paid: string
  method: Method
  note: string
}

const blank = (): Values => ({
  date: today(),
  supplier_id: "",
  item_id: "",
  qty: "",
  unit_price: "",
  paid: "",
  method: (lastUsed.get("lastMethod") as Method) ?? "CASH",
  note: "",
})

export function PurchaseFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const again = useRef(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const existing = useQuery({
    queryKey: ["entries", "purchases", id],
    enabled: isEdit,
    queryFn: async () => unwrap(await supabase.from("purchases").select("*").eq("id", id!).single()),
  })
  const bill = useBill("PURCHASE", id)
  const suppliers = useMasterRows("suppliers")
  const items = useMasterRows("items")

  const form = useForm<Values>({
    defaultValues: { ...blank(), item_id: search.get("item") ?? "", supplier_id: search.get("supplier") ?? "" },
  })
  const { register, handleSubmit, reset, setValue, watch, control, formState } = form
  const v = watch()

  useEffect(() => {
    const p = existing.data
    if (!p) return
    reset({
      date: p.date,
      supplier_id: String(p.supplier_id),
      item_id: String(p.item_id),
      qty: String(p.qty),
      unit_price: String(p.unit_price),
      paid: "",
      method: "CASH",
      note: p.note ?? "",
    })
    if (p.note) setNoteOpen(true)
  }, [existing.data, reset])

  const item = items.data?.find((i) => String(i.id) === v.item_id)
  const itemId = v.item_id ? Number(v.item_id) : null

  const last = useQuery({
    queryKey: ["entries", "purchases", "last-price", itemId, id],
    enabled: itemId != null,
    queryFn: async () => {
      let q = supabase.from("purchases").select("unit_price").eq("item_id", itemId!).eq("is_void", false)
      if (id != null) q = q.neq("id", id)
      return unwrap(await q.order("date", { ascending: false }).order("id", { ascending: false }).limit(1)).at(0)?.unit_price ?? null
    },
  })
  const stock = useQuery({
    queryKey: ["v_item_stock", itemId],
    enabled: itemId != null,
    queryFn: async () => unwrap(await supabase.from("v_item_stock").select("balance_qty").eq("id", itemId!).single()).balance_qty,
  })

  // New purchase: suggest the last price paid once per picked item.
  const lastPrice = last.data
  const suggestedFor = useRef<number | null>(null)
  useEffect(() => {
    if (isEdit || lastPrice == null || suggestedFor.current === itemId) return
    suggestedFor.current = itemId
    setValue("unit_price", String(lastPrice))
  }, [isEdit, itemId, lastPrice, setValue])

  const qty = n(v.qty)
  const price = n(v.unit_price)
  const amount = r2(qty * price)
  const paid = n(v.paid)
  const change = lastPrice && price > 0 ? (price - lastPrice) / lastPrice : null
  const below = isEdit && qty > 0 ? belowPaid(amount, bill.data?.paid) : null
  const storeAfter = stock.data != null && qty > 0 && !isEdit ? stock.data + qty : null

  const save = useMutation({
    mutationFn: async (f: Values) => {
      const row = {
        date: f.date,
        item_id: Number(f.item_id),
        supplier_id: Number(f.supplier_id),
        qty: n(f.qty),
        unit_price: n(f.unit_price),
        note: orNull(f.note),
      }
      if (isEdit) {
        unwrap(await supabase.from("purchases").update(row).eq("id", id))
        return id
      }
      return unwrap(
        await supabase.rpc("create_purchase", {
          p_date: row.date,
          p_item_id: row.item_id,
          p_supplier_id: row.supplier_id,
          p_qty: row.qty,
          p_unit_price: row.unit_price,
          p_paid: n(f.paid),
          p_method: f.method,
          p_note: row.note ?? undefined,
        }),
      )
    },
    onSuccess: (_id, f) => {
      invalidateBilling(qc, "purchases")
      lastUsed.set("lastMethod", f.method)
      toast.success(`Saved: ${money(amount)}` + (isEdit ? "" : ` · due ${money(Math.max(amount - paid, 0))}`))
      if (again.current && !isEdit) reset({ ...blank(), date: f.date, supplier_id: f.supplier_id, method: f.method })
      else if (window.history.length > 1) navigate(-1)
      else navigate("/")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const err = formState.errors
  return (
    <>
      <PageHeader title={isEdit ? "Edit purchase" : "Purchase"} back backTo="/" />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form
        id="purchase-form"
        onSubmit={handleSubmit((f) => (below ? toast.error(below) : save.mutate(f)))}
        className="space-y-5 p-4 pb-28"
      >
        <Field label="Date *" error={err.date?.message}>
          <Input type="date" className="h-11" {...register("date", { required: "Date is required" })} />
        </Field>
        <PickField
          control={control}
          name="supplier_id"
          label="Supplier"
          options={activeOrSelected(suppliers.data, v.supplier_id).map((s) => ({ value: String(s.id), label: `${s.name} · ${s.code}` }))}
        />
        <PickField
          control={control}
          name="item_id"
          label="Item"
          options={activeOrSelected(items.data, v.item_id).map((i) => ({ value: String(i.id), label: `${i.name} (${i.unit})` }))}
        />

        <Section title="Quantity and price">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Quantity${item ? ` (${item.unit})` : ""} *`} error={err.qty?.message}>
              <Input {...decimalInput} {...register("qty", { validate: positive })} />
            </Field>
            <Field label="Unit price *" error={err.unit_price?.message}>
              <Input {...decimalInput} {...register("unit_price", { validate: (x) => (!!x && notNegative(x) === true) || "Enter the price" })} />
            </Field>
          </div>
        </Section>

        <ResultCard>
          <Row label="Amount" value={money(amount, 2)} strong />
          {item?.category === "FEED" && item.unit_weight_kg != null && qty > 0 && (
            <Row label="Feed" value={kg(qty * item.unit_weight_kg)} />
          )}
          {storeAfter != null && item && <Row label="Store after" value={`${num(storeAfter)} ${item.unit}`} />}
          {lastPrice != null && <Row label="Last price" value={`${money(lastPrice, 2)}${change != null ? ` (${change >= 0 ? "+" : ""}${Math.round(change * 100)}%)` : ""}`} />}
        </ResultCard>
        {change != null && Math.abs(change) > 0.25 && (
          <Warn>Price is {Math.round(Math.abs(change) * 100)}% {change > 0 ? "higher" : "lower"} than last time. Correct?</Warn>
        )}
        {below && <Warn>{below}</Warn>}
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Changing quantity or price only affects the average cost of future issues. Past usage costs stay as they were.
          </p>
        )}

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
            amount={amount}
            paid={paid}
          />
        )}

        {noteOpen ? (
          <Field label="Note">
            <Textarea placeholder="Bill no, etc." {...register("note")} />
          </Field>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            + Add note (bill no, etc.)
          </Button>
        )}
      </form>
      <FormBar formId="purchase-form" pending={save.isPending} isEdit={isEdit} again={again} />
    </>
  )
}
