import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap text-sm font-semibold transition-all duration-(--duration-base) ease-(--ease-standard) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:transition-transform [&_svg]:duration-(--duration-base) [&_svg]:ease-(--ease-standard) hover:[&_svg]:translate-x-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background shadow-(--shadow-sm) hover:bg-foreground/90 hover:shadow-(--shadow-md) active:scale-[0.98] active:shadow-(--shadow-sm)",
        accent:
          "bg-accent text-foreground shadow-(--shadow-sm) hover:bg-accent-hover hover:shadow-(--shadow-md) hover:-translate-y-px active:scale-[0.98] active:translate-y-0 active:shadow-(--shadow-sm)",
        secondary:
          "border border-border-strong bg-transparent text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:border-foreground hover:bg-accent-muted/40",
        ghost:
          "text-foreground hover:bg-accent-muted",
        destructive:
          "bg-destructive text-white shadow-(--shadow-sm) hover:bg-destructive/90 hover:shadow-(--shadow-md)",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-7",
        sm: "h-10 px-5 text-xs",
        lg: "h-14 px-9 text-base",
        icon: "h-11 w-11",
      },
      shape: {
        default: "rounded-none",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
