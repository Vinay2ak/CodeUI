import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NotificationBell } from "@/components/dashboard/NotificationBell"
import { useSession } from "@/features/session/session"

export function SiteHeader() {
  const { user } = useSession()
  const isAdmin = user?.role === "admin"

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 backdrop-blur-sm transition-[width,height] ease-linear">
      <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="-ml-1 h-9 w-9 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground" />
          <Separator
            orientation="vertical"
            className="mx-1.5 h-4 bg-border"
          />
          <h1 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
            {isAdmin ? "Admin Dashboard" : "Project Owner Dashboard"}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
