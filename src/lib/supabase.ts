import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Set when env vars are missing; the app shows a setup screen instead of crashing. */
export const configError =
  !url || !key ? "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not set. Copy .env.example to .env.local." : null

export const supabase = createClient<Database>(url ?? "http://localhost", key ?? "missing")
