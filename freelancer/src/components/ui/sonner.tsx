import * as React from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function useDocumentTheme(): "dark" | "light" {
  const [theme, setTheme] = React.useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "dark"
    return document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark"
  })

  React.useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark")
    })
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
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
            "group-[.toast]:bg-raised group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
