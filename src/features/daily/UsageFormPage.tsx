import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, SaveBar } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { errorMessage } from "@/lib/errors"
import { money, num, today } from "@/lib/format"
import { unwrap, useBatchSummaries } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import {
  BatchPicker,
  DeleteEntry,
  Field,
  lastUsed,
  rememberLast,
  ResultCard,
  toNum,
  useEntryRow,
  useInvalidateDaily,
  Warn,
} from "./shared"

type Kind = "ISSUE" | "RETURN"
type Values = { kind: Kind; batch: string; date: string; item: string; qty: string; note: string }

const CATEGORY_ORDER = ["FEED", "MEDICINE", "VACCINE", "HUSK"]

export function UsageFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const invalidate = useInvalidateDaily()
  const addAnother = useRef(false)
  const [showNote, setShowNote] = useState(false)

  const qKind = search.get("kind")
  const form = useForm<Values>({
    defaultValues: {
      kind: qKind === "RETURN" ? "RETURN" : "ISSUE",
      batch: search.get("batch") ?? lastUsed("batch"),
      date: today(),
      item: "",
      qty: "",
      note: "",
    },
  })
  const { register, handleSubmit, reset, setValue, watch, setError, formState } = form
  const [kind, batch, item, qtyText] =watch(["kind", "batch", "item", "qty"])
  const err = formState.errors

  const existing = useEntryRow("usages", id)
  useEffect(() => {
    const u = existing.data
    if (!u) return
    reset({ kind: u.kind, batch: String(u.batch_id), date: u.date, item: String(u.item_id), qty: String(u.qty), note: u.note ?? "" })
    if (u.note) setShowNote(true)
  }, [existing.data, reset])

  const items = useQuery({
    queryKey: ["master", "items"],
    queryFn: async () => unwrap(await supabase.from("items").select("*").order("code")),
  })
  const stock = useQuery({
    queryKey: ["v_item_stock"],
    queryFn: async () => unwrap(await supabase.from("v_item_stock").select("*")),
  })
  const batchId = Number(batch) || 0
  const batchUsages = useQuery({
    queryKey: ["entries", "usages", "batch", batchId],
    enabled: batchId > 0,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("usages")
          .select("id, item_id, kind, qty, signed_qty, cost")
          .eq("batch_id", batchId)
          .eq("is_void", false)
          .order("id", { ascending: false }),
      ),
  })
  const batches = useBatchSummaries()
  const batchCode = batches.data?.find((b) => b.id === batchId)?.code ?? ""

  // Rows without the one being edited, so limits match what the DB trigger will see.
  const others = useMemo(() => (batchUsages.data ?? []).filter((u) => u.id !== id), [batchUsages.data, id])
  const issuedTo = useMemo(() => {
    const m = new Map<number, number>()
    for (const u of others) m.set(u.item_id, (m.get(u.item_id) ?? 0) + (u.signed_qty ?? 0))
    return m
  }, [others])
  const recent = useMemo(() => [...new Set((batchUsages.data ?? []).map((u) => u.item_id))].slice(0, 3), [batchUsages.data])

  const itemRows = useMemo(() => {
    const st = new Map((stock.data ?? []).map((s) => [s.id, s]))
    return (items.data ?? [])
      .filter((i) => i.is_active || String(i.id) === item)
      .map((i) => ({ ...i, balance: st.get(i.id)?.balance_qty ?? 0, avgCost: st.get(i.id)?.avg_unit_cost ?? null }))
  }, [items.data, stock.data, item])

  const visible = itemRows.filter((i) => kind === "ISSUE" || (issuedTo.get(i.id) ?? 0) > 0 || String(i.id) === item)
  const sel = itemRows.find((i) => String(i.id) === item)
  const qty = toNum(qtyText)

  // Own row (edit mode) is already in the balance; add it back so the check compares to what's free.
  const own = existing.data && String(existing.data.item_id) === item ? (existing.data.signed_qty ?? 0) : 0
  const balance = sel ? sel.balance + own : 0
  const issued = sel ? (issuedTo.get(sel.id) ?? 0) : 0

  // Preview price: ISSUE → store average; RETURN → batch average issued cost (the trigger does the same).
  const unitCost = useMemo(() => {
    if (!sel) return null
    if (kind === "ISSUE") return sel.avgCost
    const iss = others.filter((u) => u.item_id === sel.id && u.kind === "ISSUE")
    const q = iss.reduce((s, u) => s + u.qty, 0)
    return q > 0 ? iss.reduce((s, u) => s + (u.cost ?? 0), 0) / q : null
  }, [sel, kind, others])
  const cost = unitCost != null && qty > 0 ? qty * unitCost : null

  const overStore = kind === "ISSUE" && sel != null && qty > balance
  const overIssued = kind === "RETURN" && sel != null && qty > issued

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const row = {
        date: v.date,
        batch_id: Number(v.batch),
        item_id: Number(v.item),
        kind: v.kind,
        qty: toNum(v.qty),
        note: v.note.trim() || null,
      }
      // unit_cost is filled by the DB trigger; the generated Insert type just doesn't know that.
      const q = isEdit ? supabase.from("usages").update(row).eq("id", id) : supabase.from("usages").insert(row as never)
      return unwrap(await q.select("cost").single())
    },
    onSuccess: (saved, v) => {
      rememberLast("batch", v.batch)
      invalidate("usages")
      const what = `${num(toNum(v.qty))} ${sel?.unit ?? ""} ${sel?.name ?? ""}`.replace(/ +/g, " ")
      toast.success(
        v.kind === "ISSUE"
          ? `Saved — ${what} → ${batchCode} · ${money(saved.cost)}`
          : `Saved — ${what} returned from ${batchCode} · ${money(saved.cost)}`,
      )
      if (addAnother.current && !isEdit) {
        reset({ ...v, item: "", qty: "", note: "" })
        setShowNote(false)
      } else navigate(-1)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const submit = handleSubmit((v) => {
    if (!v.batch) return setError("batch", { message: "Choose a batch" })
    if (!v.item) return setError("item", { message: "Choose an item" })
    if (!(toNum(v.qty) > 0)) return setError("qty", { message: "Enter a quantity above 0" })
    if (overIssued) return setError("qty", { message: `Only ${num(issued)} ${sel?.unit} are still issued to ${batchCode}` })
    save.mutate(v)
  })

  const pick = (i: string) => setValue("item", i, { shouldValidate: false })

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit usage" : "Usage"}
        back
        backTo="/batches"
        actions={isEdit && existing.data && <DeleteEntry table="usages" id={id} note={existing.data.note} />}
      />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 p-4 pb-28">
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(v) => {
            if (!v) return
            setValue("kind", v as Kind)
            setValue("item", "")
          }}
          className="w-full"
        >
          <ToggleGroupItem value="ISSUE" className="h-11 flex-1">
            Issue to batch
          </ToggleGroupItem>
          <ToggleGroupItem value="RETURN" className="h-11 flex-1">
            Return to store
          </ToggleGroupItem>
        </ToggleGroup>

        <BatchPicker
          value={batch}
          onChange={(v) => {
            setValue("batch", v)
            setValue("item", "")
          }}
          error={err.batch?.message}
        />
        <Field label="Date *" htmlFor="date">
          <Input id="date" type="date" className="h-11" {...register("date", { required: true })} />
        </Field>

        <Field label="Item *" error={err.item?.message}>
          <Select value={item} onValueChange={pick}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue placeholder={kind === "RETURN" && batch && visible.length === 0 ? "Nothing issued to this batch" : "Select item"} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ORDER.map((cat) => {
                const rows = visible.filter((i) => i.category === cat)
                return (
                  rows.length > 0 && (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {rows.map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          {i.name} ({i.unit}) ·{" "}
                          {kind === "ISSUE" ? `store ${num(i.balance)}` : `issued to ${batchCode}: ${num(issuedTo.get(i.id) ?? 0)}`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )
                )
              })}
            </SelectContent>
          </Select>
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Recent:</span>
              {recent
                .map((rid) => visible.find((i) => i.id === rid))
                .filter((i) => i != null)
                .map((i) => (
                  <Button key={i.id} type="button" size="sm" variant="outline" onClick={() => pick(String(i.id))}>
                    {i.name}
                  </Button>
                ))}
            </div>
          )}
        </Field>

        <Field label={`Quantity *${sel ? ` (${sel.unit})` : ""}`} htmlFor="qty" error={err.qty?.message}>
          <Input id="qty" inputMode="decimal" className="h-11" placeholder="0" {...register("qty")} />
        </Field>

        {sel && (
          <ResultCard>
            <div>
              {cost != null
                ? `≈ ${money(kind === "RETURN" ? -cost : cost)}  (avg ${money(unitCost, 2)} / ${sel.unit})`
                : kind === "ISSUE"
                  ? "No purchase recorded yet for this item"
                  : "—"}
            </div>
            {sel.category === "FEED" && sel.unit_weight_kg != null && qty > 0 && (
              <div>{num(qty * sel.unit_weight_kg)} kg feed</div>
            )}
            {qty > 0 && (
              <div>
                {kind === "ISSUE"
                  ? `Store after: ${num(balance - qty)} ${sel.unit}`
                  : `Store after: ${num(balance + qty)} ${sel.unit} · still issued: ${num(issued - qty)}`}
              </div>
            )}
          </ResultCard>
        )}
        {overStore && (
          <Warn>
            Store shows {num(balance)} {sel?.unit}; you're issuing {num(qty)}
          </Warn>
        )}
        {overIssued && (
          <p className="text-sm text-red-600">
            Only {num(issued)} {sel?.unit} are still issued to {batchCode}
          </p>
        )}

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
