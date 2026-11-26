import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-fast outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground border-transparent hover:bg-primary/90",
        outline:
          "border-border bg-card text-card-foreground hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground border-border hover:border-accent/60",
        ghost:
          "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-accent underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm font-semibold",
        xs: "h-7 gap-1 rounded-lg px-2.5 text-xs",
        sm: "h-8 gap-1.5 rounded-xl px-3 text-xs",
        lg: "h-11 gap-2 rounded-xl px-5 text-sm font-semibold",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-7 rounded-lg",
        "icon-sm": "size-8 rounded-xl",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      fullWidth = false,
      disabled,
      type,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot.Root : "button";
    const isDisabled = Boolean(disabled || loading);

    return (
      <Comp
        ref={ref}
        type={asChild ? type : (type ?? "button")}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
