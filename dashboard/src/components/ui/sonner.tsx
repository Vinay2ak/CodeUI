import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { getInitialTheme, type Theme } from "@/lib/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

function useDocumentTheme(): Theme {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const attr = document.documentElement.getAttribute("data-theme")
      if (attr === "light" || attr === "dark") return attr
    }
    return getInitialTheme()
  })

  React.useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() => {
      const next = el.getAttribute("data-theme")
      if (next === "light" || next === "dark") {
        setTheme(next)
      }
    })
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] })
    return () => observer.disconnect()
  }, [])

  return theme
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useDocumentTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
