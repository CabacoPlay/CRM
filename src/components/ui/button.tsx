import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-dark shadow-soft",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline: "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-soft",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-hero text-primary-foreground hover:shadow-glow shadow-medium",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-soft",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-soft",
        danger: "bg-danger text-danger-foreground hover:bg-danger/90 shadow-soft",
        fab: "bg-primary text-primary-foreground hover:bg-primary-dark shadow-glow rounded-full",
        mode: "bg-primary text-white hover:bg-primary-dark border-0 shadow-sm font-medium",
        modeInactive: "border border-muted-foreground/30 bg-background text-foreground hover:bg-secondary hover:text-secondary-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
        fab: "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, iconLeft, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp 
        className={cn(buttonVariants({ variant, size, className }))} 
        ref={ref} 
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          iconLeft
        )}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
