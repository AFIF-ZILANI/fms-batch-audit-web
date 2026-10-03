import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { errorMessage } from "@/lib/errors"
import { supabase } from "@/lib/supabase"

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (session) return <Navigate to={from} replace />

  async function onForgot() {
    setError(null)
    setNotice(null)
    if (!email.trim()) return setError("Enter your email first.")
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setNotice("Check your email for a reset link.")
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else navigate(from, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="text-center">
        <div className="text-4xl">🐔</div>
        <h1 className="mt-2 text-2xl font-semibold">Batch Audit</h1>
        <p className="text-sm text-muted-foreground">Sonali farm records</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
            >
              {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
        <Button type="button" variant="link" className="w-full" disabled={busy} onClick={onForgot}>
          Forgot password?
        </Button>
      </form>
    </div>
  )
}
