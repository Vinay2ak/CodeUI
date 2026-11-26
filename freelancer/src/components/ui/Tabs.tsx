import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export interface LegacyTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  ariaLabel?: string
}

export type TabsProps =
  | LegacyTabsProps
  | React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

const LegacyTabs: React.FC<LegacyTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "Navigation tabs",
}) => {
  const tabListRef = React.useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1
    if (e.key === "ArrowRight") {
      targetIndex = (index + 1) % tabs.length
    } else if (e.key === "ArrowLeft") {
      targetIndex = (index - 1 + tabs.length) % tabs.length
    } else if (e.key === "Home") {
      targetIndex = 0
    } else if (e.key === "End") {
      targetIndex = tabs.length - 1
    }

    if (targetIndex >= 0) {
      e.preventDefault()
      const tabButtons =
        tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      if (tabButtons && tabButtons[targetIndex]) {
        tabButtons[targetIndex].focus()
        onChange(tabs[targetIndex].id)
      }
    }
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 p-1 rounded-lg bg-raised border border-line"
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink hover:bg-surface"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        )
      })}
    </div>
  )
}

export type OverloadedTabs = {
  (props: LegacyTabsProps): React.ReactElement | null
  (
    props: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> &
      React.RefAttributes<React.ElementRef<typeof TabsPrimitive.Root>>
  ): React.ReactElement | null
  displayName?: string
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>((props, ref) => {
  if ("tabs" in props) {
    return <LegacyTabs {...props} />
  }
  return <TabsPrimitive.Root ref={ref} {...props} />
}) as OverloadedTabs
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-raised p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
