import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"
import { ErrorNote, SaveBar } from "@/components/common"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, isForeignKeyViolation } from "@/lib/errors"
import { today } from "@/lib/format"
import { keys, nextCode, unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"

type Values = { code: string; start_date: string; close_date: string; note: string }

export function BatchFormPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : null
  const isEdit = id != null
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const existing = useQuery({
    queryKey: keys.batch(id ?? 0),
    enabled: isEdit,
    queryFn: async () => unwrap(await supabase.from("batches").select("*").eq("id", id!).single()),
  })

  const form = useForm<Values>({ defaultValues: { code: "", start_date: today(), close_date: "", note: "" } })
  const { register, handleSubmit, reset, setValue, formState } = form

  // Prefill: existing batch in edit mode, next B-YYYY-MM-DD-NN code in create mode.
  useEffect(() => {
    if (isEdit && existing.data) {
      const b = existing.data
      reset({ code: b.code, start_date: b.start_date, close_date: b.close_date ?? "", note: b.note ?? "" })
    }
  }, [isEdit, existing.data, reset])
  // Create mode: suggest B-YYYY-MM-DD-NN (NN = next free number for that start date) until the user types their own code.
  const codeTyped = useRef(false)
  const startDate = form.watch("start_date")
  useEffect(() => {
    if (isEdit || !startDate || codeTyped.current) return
    nextCode("batches", `B-${startDate}-`, 2)
      .then((c) => !codeTyped.current && setValue("code", c))
      .catch(() => {})
  }, [isEdit, startDate, setValue])

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const row = {
        code: v.code.trim(),
        start_date: v.start_date,
        note: v.note.trim() || null,
        ...(isEdit ? { close_date: v.close_date || null } : {}),
      }
      if (isEdit) {
        unwrap(await supabase.from("batches").update(row).eq("id", id))
        return id
      }
      return unwrap(await supabase.from("batches").insert(row).select("id").single()).id
    },
    onSuccess: (newId, v) => {
      qc.invalidateQueries({ queryKey: keys.batchSummaries })
      qc.invalidateQueries({ queryKey: ["batches"] })
      toast.success(isEdit ? `${v.code} saved` : `${v.code} created`)
      navigate(`/batches/${newId}`, { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async () => unwrap(await supabase.from("batches").delete().eq("id", id!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.batchSummaries })
      toast.success("Batch deleted")
      navigate("/batches", { replace: true })
    },
    onError: (e) =>
      toast.error(
        isForeignKeyViolation(e as { code?: string })
          ? "This batch has entries, so it can't be deleted. Close it instead."
          : errorMessage(e),
      ),
  })

  const err = formState.errors

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit ${existing.data?.code ?? "batch"}` : "New batch"}
        back
        backTo="/batches"
        actions={
          isEdit && (
            <Button variant="ghost" size="icon" aria-label="Delete batch" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon className="size-5 text-red-600" />
            </Button>
          )
        }
      />
      {existing.error && (
        <div className="p-4">
          <ErrorNote error={existing.error} />
        </div>
      )}
      <form id="batch-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="code">Batch code *</Label>
          <Input id="code" className="h-11" {...register("code", { required: "Code is required", onChange: () => (codeTyped.current = true) })} />
          {err.code && <p className="text-sm text-red-600">{err.code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date (placement) *</Label>
          <Input id="start_date" type="date" className="h-11" {...register("start_date", { required: "Start date is required" })} />
          {err.start_date && <p className="text-sm text-red-600">{err.start_date.message}</p>}
        </div>
        {isEdit && (
          <div className="space-y-2">
            <Label htmlFor="close_date">Close date</Label>
            <Input
              id="close_date"
              type="date"
              className="h-11"
              {...register("close_date", {
                validate: (v, all) => !v || v >= all.start_date || "Close date can't be before start date",
              })}
            />
            <p className="text-xs text-muted-foreground">Leave empty while the batch is running.</p>
            {err.close_date && <p className="text-sm text-red-600">{err.close_date.message}</p>}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" placeholder="e.g. Brooder 1, chicks from X" {...register("note")} />
        </div>
      </form>
      <SaveBar>
        <Button type="submit" form="batch-form" className="h-11 flex-1" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </SaveBar>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {existing.data?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Only possible while the batch has no entries. A batch with entries should be closed instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
