import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, Row, StatusBadge } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/errors"
import { dateShortOrFull, money, today } from "@/lib/format"
import { unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import {
  decimalInput,
  Field,
  FormBar,
  invalidateBilling,
  lastUsed,
  MethodToggle,
  n,
  orNull,
  payStatus,
  PickField,
  r2,
  ResultCard,
  Warn,
  type Method,
} from "./shared"

type Party = "SUPPLIER" | "BUYER"
type Values = { party: Party; party_id: string; bill: string; date: string; amount: string; method: Method; note: string }

const FK = { CHICKS: "chick_purchase_id", PURCHASE: "purchase_id", SALE: "sale_id" } as const
type BillType = keyof typeof FK
const billKey = (b: { bill_type: string | null; bill_id: number | null }) => `${b.bill_type}:${b.bill_id}`
const isBillType = (t: string): t is BillType => t in FK

export function PaymentFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const again = useRef(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const paramParty = search.get("party") === "BUYER" ? "BUYER" : "SUPPLIER"
  const paramBill = search.get("bill") ?? ""
  const [paramType, paramBillId] = paramBill.split(":")

  const existing = useQuery({
    queryKey: ["entries", "payments", id],
    enabled: isEdit,
    queryFn: async () => unwrap(await supabase.from("payments").select("*").eq("id", id!).single()),
  })

  const form = useForm<Values>({
    defaultValues: {
      party: search.get("party") ? paramParty : "SUPPLIER",
      party_id: search.get("party_id") ?? "",
      bill: paramBill,
      date: today(),
      amount: "",
      method: (lastUsed.get("lastMethod") as Method) ?? "CASH",
      note: "",
    },
  })
  const { register, handleSubmit, reset, setValue, watch, control, formState } = form
  const v = watch()

  // Edit: fill from the payment. Its bill is fixed (one payment = one bill).
  const editType = existing.data
    ? existing.data.sale_id != null
      ? "SALE"
      : existing.data.purchase_id != null
        ? "PURCHASE"
        : "CHICKS"
    : null
  const editBillId = existing.data ? (existing.data.sale_id ?? existing.data.purchase_id ?? existing.data.chick_purchase_id) : null
  const prefillType = isEdit ? editType : isBillType(paramType ?? "") ? (paramType as BillType) : null
  const prefillId = isEdit ? editBillId : Number(paramBillId) || null

  // The bill named by the edit target or ?bill=: gives the party id and the amount limit.
  const target = useQuery({
    queryKey: ["v_bills", prefillType, prefillId],
    enabled: prefillType != null && prefillId != null,
    queryFn: async () =>
      unwrap(await supabase.from("v_bills").select("*").eq("bill_type", prefillType!).eq("bill_id", prefillId!).single()),
  })

  useEffect(() => {
    const p = existing.data
    const b = target.data
    if (!p || !b) return
    reset({
      party: p.party,
      party_id: String(b.party_id),
      bill: billKey(b),
      date: p.date,
      amount: String(p.amount),
      method: p.method,
      note: p.note ?? "",
    })
    if (p.note) setNoteOpen(true)
  }, [existing.data, target.data, reset])

  useEffect(() => {
    if (isEdit || !target.data || v.party_id) return
    setValue("party", target.data.party ?? "SUPPLIER")
    setValue("party_id", String(target.data.party_id))
  }, [isEdit, target.data, v.party_id, setValue])

  const parties = useQuery({
    queryKey: ["balances", v.party],
    queryFn: async () =>
      unwrap(await supabase.from(v.party === "SUPPLIER" ? "v_supplier_balance" : "v_buyer_balance").select("*")),
  })
  const partyRows = [...(parties.data ?? [])]
    .filter((p) => p.is_active || String(p.id) === v.party_id)
    .sort((a, b) => (b.due ?? 0) - (a.due ?? 0) || (a.code ?? "").localeCompare(b.code ?? ""))
  const party = partyRows.find((p) => String(p.id) === v.party_id)

  const partyId = v.party_id ? Number(v.party_id) : null
  const bills = useQuery({
    queryKey: ["v_bills", "unpaid", v.party, partyId],
    enabled: partyId != null && !isEdit,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("v_bills")
          .select("*")
          .eq("party", v.party)
          .eq("party_id", partyId!)
          .gt("due", 0)
          .order("date")
          .order("bill_id"),
      ),
  })

  // New payment: keep a valid bill selected (first unpaid one by default) and default the amount to its full due.
  const billList = bills.data
  useEffect(() => {
    if (isEdit || !billList) return
    if (!billList.some((b) => billKey(b) === v.bill)) setValue("bill", billList[0] ? billKey(billList[0]) : "")
  }, [isEdit, billList, v.bill, setValue])

  const selected = isEdit ? target.data : billList?.find((b) => billKey(b) === v.bill)
  const selKey = selected ? billKey(selected) : ""
  const selDue = selected?.due ?? null
  useEffect(() => {
    if (!isEdit && selDue != null) setValue("amount", String(selDue))
  }, [isEdit, selKey, selDue, setValue])

  // Edit: this payment is already counted in paid, so it can be raised by the bill's remaining due only.
  const limit = selected ? (selected.due ?? 0) + (isEdit ? (existing.data?.amount ?? 0) : 0) : 0
  const amount = n(v.amount)
  const dueAfter = selected ? r2(limit - amount) : null
  const over = selected != null && amount > limit

  const save = useMutation({
    mutationFn: async (f: Values) => {
      const row = { date: f.date, amount: n(f.amount), method: f.method, note: orNull(f.note) }
      if (isEdit) {
        unwrap(await supabase.from("payments").update(row).eq("id", id))
        return
      }
      const [type, billId] = f.bill.split(":")
      unwrap(
        await supabase.from("payments").insert({
          ...row,
          party: f.party,
          [FK[type as BillType]]: Number(billId),
        }),
      )
    },
    onSuccess: (_r, f) => {
      invalidateBilling(qc, "payments")
      lastUsed.set("lastMethod", f.method)
      toast.success(
        `Saved: ${money(amount)} ${f.party === "SUPPLIER" ? "paid" : "received"}` +
          (dueAfter != null ? ` · bill ${payStatus(limit, limit - dueAfter) === "PAID" ? "PAID" : `due ${money(dueAfter)}`}` : ""),
      )
      if (again.current && !isEdit) reset({ ...f, bill: "", amount: "", note: "" })
      else if (window.history.length > 1) navigate(-1)
      else navigate("/")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const sup = v.party === "SUPPLIER"
  const err = formState.errors
  return (
    <>
      <PageHeader title={isEdit ? "Edit payment" : sup ? "Pay supplier" : "Receive from buyer"} back backTo="/money" />
      {(existing.error || target.error) && (
        <div className="p-4">
          <ErrorNote error={existing.error ?? target.error} />
        </div>
      )}
      <form
        id="payment-form"
        onSubmit={handleSubmit((f) => {
          if (!f.bill) return toast.error("Choose a bill to pay.")
          if (over) return toast.error(`Payment ${money(amount, 2)} is more than the remaining due ${money(limit, 2)}`)
          save.mutate(f)
        })}
        className="space-y-5 p-4 pb-28"
      >
        {!isEdit && (
          <ToggleGroup
            type="single"
            variant="outline"
            value={v.party}
            onValueChange={(p) => {
              if (!p) return
              setValue("party", p as Party)
              setValue("party_id", "")
              setValue("bill", "")
              setValue("amount", "")
            }}
            className="h-11 w-full"
          >
            <ToggleGroupItem value="SUPPLIER" className="h-11 flex-1">
              Pay supplier
            </ToggleGroupItem>
            <ToggleGroupItem value="BUYER" className="h-11 flex-1">
              Receive from buyer
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {isEdit ? (
          <Field label={sup ? "Supplier" : "Buyer"}>
            <p className="font-medium">{party?.name ?? "…"}</p>
          </Field>
        ) : (
          <PickField
            control={control}
            name="party_id"
            label={sup ? "Supplier" : "Buyer"}
            options={partyRows.map((p) => ({
              value: String(p.id),
              label: `${p.name}${(p.due ?? 0) > 0 ? ` · due ${money(p.due)}` : ""}`,
            }))}
            onPick={() => {
              setValue("bill", "")
              setValue("amount", "")
            }}
          />
        )}

        <Field label="Bill *">
          {isEdit ? (
            selected ? <BillCard bill={selected} /> : <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !partyId ? (
            <p className="text-sm text-muted-foreground">Choose a {sup ? "supplier" : "buyer"} first.</p>
          ) : bills.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading bills…</p>
          ) : bills.error ? (
            <ErrorNote error={bills.error} />
          ) : billList?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unpaid bills for {party?.name ?? "this party"}.</p>
          ) : (
            <div className="space-y-2" role="radiogroup">
              {billList?.map((b) => (
                <BillCard key={billKey(b)} bill={b} checked={billKey(b) === v.bill} onSelect={() => setValue("bill", billKey(b))} />
              ))}
            </div>
          )}
        </Field>

        <Field label="Date *" error={err.date?.message}>
          <Input type="date" className="h-11" {...register("date", { required: "Date is required" })} />
        </Field>
        <Field label="Amount *" error={err.amount?.message}>
          <Input {...decimalInput} {...register("amount", { validate: (x) => n(x) > 0 || "Must be more than 0" })} />
        </Field>
        <Field label="Method">
          <MethodToggle control={control} name="method" />
        </Field>

        {selected && (
          <ResultCard>
            <Row
              label="Bill after"
              value={
                <span className="inline-flex items-center gap-2">
                  due {money(Math.max(dueAfter ?? 0, 0), 2)} <StatusBadge status={dueAfter != null && dueAfter <= 0 ? "PAID" : amount > 0 ? "PARTIALLY" : "DUE"} />
                </span>
              }
            />
            {party && <Row label={`${party.name} due after`} value={money(Math.max((party.due ?? 0) - (isEdit ? (existing.data?.amount ?? 0) : 0) - amount, 0), 2)} />}
          </ResultCard>
        )}
        {over && <Warn>Payment {money(amount, 2)} is more than the remaining due {money(limit, 2)}.</Warn>}

        {noteOpen ? (
          <Field label="Note">
            <Textarea placeholder="Transaction id, cheque no" {...register("note")} />
          </Field>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
            + Add note (txn id, cheque no)
          </Button>
        )}
      </form>
      <FormBar formId="payment-form" pending={save.isPending} isEdit={isEdit} again={again} />
    </>
  )
}

function BillCard({
  bill,
  checked,
  onSelect,
}: {
  bill: { date: string | null; description: string | null; amount: number | null; due: number | null; payment_status: string | null }
  checked?: boolean
  onSelect?: () => void
}) {
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {dateShortOrFull(bill.date)} · {bill.description}
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          {money(bill.amount)} · due {money(bill.due)}
        </div>
      </div>
      <StatusBadge status={bill.payment_status} />
    </>
  )
  if (!onSelect) return <div className="flex items-center gap-3 rounded-xl border p-3">{body}</div>
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${checked ? "border-primary bg-accent" : ""}`}
    >
      <span className={`size-4 shrink-0 rounded-full border ${checked ? "border-primary bg-primary" : ""}`} />
      {body}
    </button>
  )
}
