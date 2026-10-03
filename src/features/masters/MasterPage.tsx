import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useController, useForm, type Control } from "react-hook-form"
import { Navigate, useParams } from "react-router"
import { toast } from "sonner"
import { EmptyState, ErrorNote, ListSkeleton, SectionTitle, StatusBadge } from "@/components/common"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, isForeignKeyViolation } from "@/lib/errors"
import { keys, nextCode, unwrap } from "@/lib/queries"
import { supabase } from "@/lib/supabase"
import { masterConfigs, type Field, type MasterConfig, type MasterRow, type MasterTable } from "./masterTypes"

// The four master tables share this page, so the Supabase client is used untyped here;
// the column set for each table is defined in masterTypes.ts and checked by the database.
type UntypedTable = {
  select: (cols: string) => { order: (c: string) => PromiseLike<{ data: unknown; error: unknown }> }
  insert: (row: object) => PromiseLike<{ data: unknown; error: unknown }>
  update: (row: object) => { eq: (c: string, v: number) => PromiseLike<{ data: unknown; error: unknown }> }
  delete: () => { eq: (c: string, v: number) => PromiseLike<{ data: unknown; error: unknown }> }
}
const table = (t: MasterTable) => supabase.from(t) as unknown as UntypedTable

export function MasterPage() {
  const { master } = useParams()
  const config = masterConfigs[master as MasterTable]
  if (!config) return <Navigate to="/more" replace />
  return <MasterList key={config.table} config={config} />
}

function MasterList({ config }: { config: MasterConfig }) {
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<MasterRow | "new" | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: keys.master(config.table),
    queryFn: async () => unwrap(await table(config.table).select("*").order("code")) as MasterRow[],
  })

  const { active, archived } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (r: MasterRow) => !q || r.name.toLowerCase().includes(q)
    const rows = (data ?? []).filter(match)
    return { active: rows.filter((r) => r.is_active), archived: rows.filter((r) => !r.is_active) }
  }, [data, search])

  const groups = useMemo(() => {
    if (!config.group) return [{ name: "", rows: active }]
    const map = new Map<string, MasterRow[]>()
    for (const r of active) map.set(config.group(r), [...(map.get(config.group(r)) ?? []), r])
    return [...map].map(([name, rows]) => ({ name, rows }))
  }, [active, config])

  return (
    <>
      <PageHeader
        title={config.title}
        back
        backTo="/more"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon /> Add
          </Button>
        }
      />
      <div className="space-y-4 p-4">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9"
          />
        </div>

        {isLoading && <ListSkeleton />}
        {error && <ErrorNote error={error} />}
        {data && data.length === 0 && (
          <EmptyState text={`No ${config.title.toLowerCase()} yet.`} action={{ label: `Add ${config.singular}`, onClick: () => setEditing("new") }} />
        )}

        {groups.map((g) => (
          <section key={g.name} className="space-y-2">
            {g.name && <SectionTitle>{g.name}</SectionTitle>}
            {g.rows.map((r) => (
              <MasterCard key={r.id} row={r} config={config} onClick={() => setEditing(r)} />
            ))}
          </section>
        ))}

        {archived.length > 0 && (
          <section className="space-y-2">
            <button type="button" className="text-sm text-muted-foreground" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "▾" : "▸"} Archived ({archived.length})
            </button>
            {showArchived &&
              archived.map((r) => <MasterCard key={r.id} row={r} config={config} onClick={() => setEditing(r)} />)}
          </section>
        )}
      </div>

      <MasterForm config={config} editing={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function MasterCard({ row, config, onClick }: { row: MasterRow; config: MasterConfig; onClick: () => void }) {
  const line = config.line(row)
  return (
    <Card className="cursor-pointer flex-row items-center gap-3 px-4 py-3 active:bg-accent" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          {!row.is_active && <StatusBadge status="ARCHIVED" />}
        </div>
        {line && <div className="truncate text-sm text-muted-foreground">{line}</div>}
      </div>
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </Card>
  )
}

type FormValues = Record<string, string>

function defaults(config: MasterConfig, row: MasterRow | null): FormValues {
  return Object.fromEntries(
    config.fields.map((f) => [f.name, row ? String(row[f.name] ?? "") : (f.defaultValue ?? "")]),
  )
}

function MasterForm({
  config,
  editing,
  onClose,
}: {
  config: MasterConfig
  editing: MasterRow | "new" | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const row = editing && editing !== "new" ? editing : null
  const isEdit = row != null
  const form = useForm<FormValues>({ defaultValues: defaults(config, row) })
  const { register, handleSubmit, reset, watch, setValue, getValues, control, formState } = form
  const values = watch()
  const lastSuggested = useRef("")
  const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null)

  // Reset when the sheet opens for a different row.
  useEffect(() => {
    if (editing) reset(defaults(config, row))
    lastSuggested.current = ""
  }, [editing, config, row, reset])

  // Suggest the next code for new records; re-suggest when the prefix changes (items by category),
  // unless the user typed their own code.
  const prefix = config.codePrefix(values)
  useEffect(() => {
    if (editing !== "new") return
    const current = getValues("code")
    if (current && current !== lastSuggested.current) return
    nextCode(config.table, prefix, config.codePad)
      .then((c) => {
        lastSuggested.current = c
        setValue("code", c)
      })
      .catch(() => {})
  }, [editing, prefix, config, getValues, setValue])

  const invalidate = () => qc.invalidateQueries({ queryKey: keys.master(config.table) })

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: Record<string, string | number | null> = {}
      for (const f of config.fields) {
        if (f.showIf && !f.showIf(v)) {
          payload[f.name] = null
          continue
        }
        const raw = (v[f.name] ?? "").trim()
        payload[f.name] = raw === "" ? null : f.type === "number" ? Number(raw) : raw
      }
      if (row) unwrap(await table(config.table).update(payload).eq("id", row.id))
      else unwrap(await table(config.table).insert(payload))
      return payload
    },
    onSuccess: (p) => {
      invalidate()
      toast.success(`${p.name} saved`)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: async () => unwrap(await table(config.table).delete().eq("id", row!.id)),
    onSuccess: () => {
      invalidate()
      toast.success(`${row?.name} deleted`)
      setConfirm(null)
      onClose()
    },
    onError: (e) => {
      if (isForeignKeyViolation(e as { code?: string })) setConfirm("archive")
      else {
        toast.error(errorMessage(e))
        setConfirm(null)
      }
    },
  })

  const setActive = useMutation({
    mutationFn: async (is_active: boolean) => unwrap(await table(config.table).update({ is_active }).eq("id", row!.id)),
    onSuccess: (_d, is_active) => {
      invalidate()
      toast.success(is_active ? `${row?.name} restored` : `${row?.name} archived`)
      setConfirm(null)
      onClose()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const codeChanged = isEdit && values.code !== row.code

  return (
    <>
      <Sheet open={editing != null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-screen-sm overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{isEdit ? `Edit ${config.singular}` : `New ${config.singular}`}</SheetTitle>
            <SheetDescription className="sr-only">Fields for the {config.singular}</SheetDescription>
          </SheetHeader>
          <form id="master-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4 px-4">
            {config.fields
              .filter((f) => !f.hidden)
              .filter((f) => !f.showIf || f.showIf(values))
              .map((f) => {
                const id = `m-${f.name}`
                const error = formState.errors[f.name]?.message as string | undefined
                const rules = {
                  required: f.required ? `${f.label} is required` : false,
                  ...(f.type === "number" ? { validate: (v: string) => !v || Number(v) > 0 || "Must be more than 0" } : {}),
                  ...(f.type === "tel"
                    ? { pattern: { value: /^[0-9+\s-]*$/, message: "Digits, spaces, + and - only" } }
                    : {}),
                }
                return (
                  <div key={f.name} className="space-y-2">
                    <Label htmlFor={id}>
                      {f.label}
                      {f.required && " *"}
                    </Label>
                    {f.type === "select" ? (
                      <SelectField id={id} field={f} control={control} />
                    ) : f.type === "textarea" ? (
                      <Textarea id={id} {...register(f.name)} />
                    ) : (
                      <>
                        <Input
                          id={id}
                          type={f.type === "number" ? "text" : f.type}
                          inputMode={f.type === "number" ? "decimal" : undefined}
                          placeholder={f.placeholder}
                          list={f.suggestions ? `${id}-list` : undefined}
                          className="h-11"
                          {...register(f.name, rules)}
                        />
                        {f.suggestions && (
                          <datalist id={`${id}-list`}>
                            {f.suggestions.map((s) => (
                              <option key={s} value={s} />
                            ))}
                          </datalist>
                        )}
                      </>
                    )}
                    {f.name === "code" && codeChanged && (
                      <p className="text-xs text-amber-700">Codes are used for the FMS migration. Change only if it's a typo.</p>
                    )}
                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </div>
                )
              })}
          </form>
          <SheetFooter className="flex-row gap-2">
            {isEdit && (
              <>
                {row.is_active ? (
                  <Button variant="ghost" className="text-red-600" onClick={() => setConfirm("delete")}>
                    Delete
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setActive.mutate(true)}>
                    Unarchive
                  </Button>
                )}
              </>
            )}
            <Button type="submit" form="master-form" className="h-11 flex-1" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm === "delete" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {row?.name}?</AlertDialogTitle>
                <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={(e) => {
                    e.preventDefault()
                    remove.mutate()
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{row?.name} is in use</AlertDialogTitle>
                <AlertDialogDescription>
                  It's used in other records, so it can't be deleted. Archive it instead? It will disappear from pickers but
                  stay in history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    setActive.mutate(false)
                  }}
                >
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SelectField({ id, field, control }: { id: string; field: Field; control: Control<FormValues> }) {
  const { field: f } = useController({
    control,
    name: field.name,
    rules: { required: field.required ? `${field.label} is required` : false },
  })
  return (
    <Select value={f.value} onValueChange={f.onChange}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {field.options?.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
