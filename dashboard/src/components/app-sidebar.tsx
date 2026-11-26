import * as React from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Code2,
  CreditCard,
  FolderKanban,
  HeartPulse,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react"

import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSession, logout } from "@/features/session/session"
import { env } from "@/lib/env"

const OWNER_NAV_ITEMS: NavMainItem[] = [
  { title: "Overview", href: "#overview", icon: LayoutDashboard },
  { title: "Projects", href: "#projects", icon: FolderKanban },
  { title: "Payments", href: "#payments", icon: CreditCard },
  { title: "Settings", href: "#settings", icon: Settings },
]

const ADMIN_NAV_ITEMS: NavMainItem[] = [
  { title: "Overview", href: "#overview", icon: LayoutDashboard },
  { title: "Users", href: "#users", icon: Users },
  { title: "Service health", href: "#health", icon: HeartPulse },
  { title: "Settings", href: "#settings", icon: Settings },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  const [currentHash, setCurrentHash] = React.useState(
    () => (typeof window !== "undefined" ? window.location.hash : "") || "#overview"
  )

  const isAdmin = user?.role === "admin"
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : OWNER_NAV_ITEMS

  React.useEffect(() => {
    const handleHash = () => {
      setCurrentHash(window.location.hash || "#overview")
    }
    window.addEventListener("hashchange", handleHash)
    return () => window.removeEventListener("hashchange", handleHash)
  }, [])

  React.useEffect(() => {
    setCurrentHash(location.hash || "#overview")
  }, [location.hash])

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    setOpenMobile(false)
    const basePath = isAdmin ? "/admin" : "/owner"
    if (location.pathname !== basePath && location.pathname !== "/") {
      e.preventDefault()
      navigate(`${basePath}${href}`)
    } else {
      window.location.hash = href
      setCurrentHash(href)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="rounded-xl h-11 px-2.5 hover:bg-secondary/70"
            >
              <a
                href="#overview"
                onClick={(e) => handleNavClick(e, "#overview")}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                  <Code2 className="h-4 w-4" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-bold tracking-tight text-foreground">
                    CodeBridge
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isAdmin ? "Platform admin" : "Project owner"}
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={navItems}
          activeHref={currentHash}
          onSelectItem={handleNavClick}
        />
      </SidebarContent>

      <SidebarFooter className="pt-2 border-t border-border/60">
        <NavUser
          user={{
            name: user?.displayName || (isAdmin ? "Admin User" : "Project Owner"),
            email: user?.email || "owner@codebridge.dev",
            roleLabel: isAdmin ? "Administrator" : "Project Owner",
          }}
          onSettings={(e) => handleNavClick(e, "#settings")}
          accountUrl={env.VITE_ACCOUNT_URL}
          onLogout={logout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
