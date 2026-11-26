import * as React from "react"
import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string
  height?: string
}

function Skeleton({ className, width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, ...style }}
      className={cn("animate-pulse rounded-md bg-raised", className)}
      {...props}
    />
  )
}

export { Skeleton }
