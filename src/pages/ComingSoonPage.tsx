import { PageHeader } from "@/components/layout/PageHeader"

export function ComingSoonPage({ title, milestone }: { title: string; milestone: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="p-4">
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {title} arrives in milestone {milestone} (see docs/prd.md §8).
        </div>
      </div>
    </>
  )
}
