import React from "react"
import { motion } from "framer-motion"
import { PlusCircle, type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavMainItem {
  title: string
  href: string
  icon: LucideIcon
}

interface NavMainProps {
  items: NavMainItem[]
  activeHref: string
  onSelectItem: (e: React.MouseEvent, href: string) => void
  onQuickCreate?: () => void
  quickCreateLabel?: string
}

export function NavMain({
  items,
  activeHref,
  onSelectItem,
  onQuickCreate,
  quickCreateLabel = "Post a project",
}: NavMainProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        {onQuickCreate && (
          <SidebarMenu className="mb-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                tooltip={quickCreateLabel}
                onClick={onQuickCreate}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary hover:opacity-90 hover:text-primary-foreground active:scale-[0.98] transition-all font-medium h-9 shadow-sm"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>{quickCreateLabel}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive =
              activeHref === item.href ||
              (!activeHref && item.href === "#overview")
            const Icon = item.icon

            return (
              <SidebarMenuItem key={item.href} className="relative">
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-secondary border border-border pointer-events-none"
                    aria-hidden="true"
                  />
                )}
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                  className={`relative z-10 rounded-xl transition-colors h-9 ${
                    isActive
                      ? "bg-transparent hover:bg-transparent text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <a
                    href={item.href}
                    onClick={(e) => onSelectItem(e, item.href)}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? "text-accent" : "text-muted-foreground"
                      }`}
                    />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
