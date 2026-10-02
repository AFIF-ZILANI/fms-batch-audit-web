import { useState } from "react"
import { Outlet, useLocation } from "react-router"
import { AddSheet } from "./AddSheet"
import { BottomNav } from "./BottomNav"

/** Pages under /new or /edit are full-screen forms with their own sticky Save bar, so the nav is hidden. */
function isFormRoute(pathname: string) {
  return /\/(new|edit)$/.test(pathname)
}

export function AppShell() {
  const { pathname } = useLocation()
  const [addOpen, setAddOpen] = useState(false)
  const showNav = !isFormRoute(pathname)

  return (
    <div className="mx-auto min-h-dvh max-w-screen-sm bg-background">
      <main className={showNav ? "pb-24" : "pb-28"}>
        <Outlet />
      </main>
      {showNav && <BottomNav onAdd={() => setAddOpen(true)} />}
      <AddSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
