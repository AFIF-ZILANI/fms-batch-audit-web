import { BuildingIcon, ChevronRightIcon, PackageIcon, TagIcon, TruckIcon, UsersIcon } from "lucide-react"
import type { ComponentType } from "react"
import { Link } from "react-router"
import { SectionTitle } from "@/components/common"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }> }

// M1 version of docs/page-layouts/22-more.md. Records, stock and safety links arrive with later milestones.
const setup: Item[] = [
  { to: "/settings/sheds", label: "Sheds", icon: BuildingIcon },
  { to: "/settings/items", label: "Items", icon: TagIcon },
  { to: "/settings/suppliers", label: "Suppliers", icon: TruckIcon },
  { to: "/settings/buyers", label: "Buyers", icon: UsersIcon },
]

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      <Card className="gap-0 divide-y py-0">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-12 items-center gap-3 px-4 active:bg-accent">
            <Icon className="size-5 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </Card>
    </section>
  )
}

export function MorePage() {
  const { session } = useAuth()
  return (
    <>
      <PageHeader title="More" />
      <div className="space-y-6 p-4">
        <Group title="Setup" items={setup} />
        <section className="space-y-2">
          <SectionTitle>Coming next</SectionTitle>
          <Card className="flex-row items-center gap-3 px-4 py-3 text-sm text-muted-foreground">
            <PackageIcon className="size-5" />
            Records, stock, data checks and export arrive in the next milestones.
          </Card>
        </section>
        <section className="space-y-2">
          <SectionTitle>Account</SectionTitle>
          <p className="text-sm">{session?.user.email}</p>
          <Button variant="outline" className="h-11 w-full" onClick={() => supabase.auth.signOut()}>
            Log out
          </Button>
        </section>
        <p className="text-center text-xs text-muted-foreground">v0.1 · Gross margin excludes labour &amp; electricity</p>
      </div>
    </>
  )
}
