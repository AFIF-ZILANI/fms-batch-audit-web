import { ArrowLeftIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"

type Props = {
  title: ReactNode
  /** Show a back arrow. Goes back in history, or to `backTo` when there is no history (deep link). */
  back?: boolean
  backTo?: string
  actions?: ReactNode
}

export function PageHeader({ title, back, backTo = "/", actions }: Props) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur">
      {back ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(backTo))}
        >
          <ArrowLeftIcon className="size-5" />
        </Button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-1">{actions}</div>
    </header>
  )
}
