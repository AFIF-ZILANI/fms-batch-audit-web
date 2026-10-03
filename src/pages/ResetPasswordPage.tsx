import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { errorMessage } from "@/lib/errors"
import { supabase } from "@/lib/supabase"

/** Opened from the reset email: supabase-js turns the link into a session, then we set the new password. */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else navigate("/", { replace: true })
  }

  if (loading) return null

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <h1 className="text-center text-2xl font-semibold">Set a new password</h1>
      {session ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          This reset link is invalid or expired.{" "}
          <Link to="/login" className="underline">
            Back to login
          </Link>
        </p>
      )}
    </div>
  )
}
