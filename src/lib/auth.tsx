import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router"
import { supabase } from "./supabase"

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }))
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Route guard: sends logged-out users to /login and remembers where they were going. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}
