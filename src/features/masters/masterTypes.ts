// Config for docs/page-layouts/19-master-data.md: one page component, four tables.

export type MasterTable = "sheds" | "items" | "suppliers" | "buyers"

export type MasterRow = {
  id: number
  code: string
  name: string
  is_active: boolean
  note: string | null
  [key: string]: unknown
}

export type FieldType = "text" | "tel" | "number" | "select" | "textarea"

export type Field = {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: { value: string; label: string }[]
  /** Suggestions for free-text fields (rendered as a datalist). */
  suggestions?: string[]
  /** Only shown (and only saved) when this returns true. */
  showIf?: (values: Record<string, string>) => boolean
  defaultValue?: string
  placeholder?: string
  /** Not shown in the form; still saved (the code is auto-suggested). */
  hidden?: boolean
}

export type MasterConfig = {
  table: MasterTable
  title: string
  singular: string
  fields: Field[]
  /** Prefix for code suggestions; may depend on the form values (items by category). */
  codePrefix: (values: Record<string, string>) => string
  codePad: number
  /** Second line in the list. */
  line: (row: MasterRow) => string
  /** Group header in the list (items by category). */
  group?: (row: MasterRow) => string
}

const common: Field[] = [
  { name: "code", label: "Code", type: "text", required: true, hidden: true },
  { name: "name", label: "Name", type: "text", required: true },
]
const note: Field = { name: "note", label: "Note", type: "textarea" }

const itemPrefix: Record<string, string> = { FEED: "FD-", MEDICINE: "MED-", VACCINE: "VAC-", HUSK: "HSK-" }

const party = (table: "suppliers" | "buyers", title: string, singular: string, prefix: string): MasterConfig => ({
  table,
  title,
  singular,
  codePrefix: () => prefix,
  codePad: 2,
  fields: [
    ...common,
    { name: "company", label: "Company", type: "text" },
    { name: "phone", label: "Phone", type: "tel", placeholder: "01XXXXXXXXX" },
    note,
  ],
  line: (r) => [r.company, r.phone].filter(Boolean).join(" · "),
})

export const masterConfigs: Record<MasterTable, MasterConfig> = {
  sheds: {
    table: "sheds",
    title: "Sheds",
    singular: "shed",
    codePrefix: () => "S",
    codePad: 1,
    fields: [
      ...common,
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        defaultValue: "GROWER",
        options: [
          { value: "BROODER", label: "Brooder" },
          { value: "GROWER", label: "Grower" },
        ],
      },
      note,
    ],
    line: (r) => (r.type === "BROODER" ? "Brooder" : "Grower"),
  },
  items: {
    table: "items",
    title: "Items",
    singular: "item",
    codePrefix: (v) => itemPrefix[v.category] ?? "IT-",
    codePad: 2,
    fields: [
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        defaultValue: "FEED",
        options: [
          { value: "FEED", label: "Feed" },
          { value: "MEDICINE", label: "Medicine" },
          { value: "VACCINE", label: "Vaccine" },
          { value: "HUSK", label: "Husk" },
        ],
      },
      ...common,
      {
        name: "unit",
        label: "Unit",
        type: "text",
        required: true,
        defaultValue: "bag",
        suggestions: ["bag", "bottle", "vial", "dose", "pcs", "packet", "kg", "litre"],
      },
      {
        name: "unit_weight_kg",
        label: "Kg per unit",
        type: "number",
        required: true,
        defaultValue: "50",
        showIf: (v) => v.category === "FEED",
      },
      note,
    ],
    line: (r) => [r.unit, r.unit_weight_kg ? `${r.unit_weight_kg} kg` : null].filter(Boolean).join(" · "),
    group: (r) => String(r.category),
  },
  suppliers: party("suppliers", "Suppliers", "supplier", "SUP-"),
  buyers: party("buyers", "Buyers", "buyer", "BUY-"),
}
