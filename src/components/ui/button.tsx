import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:bg-primary/90 active:scale-[0.96]",
        secondary:
          "bg-surface-2 text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] active:scale-[0.96]",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        outline:
          "text-fg shadow-[var(--shadow-border)] hover:bg-surface-2 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.96]",
        danger: "bg-danger text-fg hover:bg-danger/90 active:scale-[0.96]",
      },
      size: {
        default: "h-11 rounded-[var(--radius-sm)] px-4 text-sm",
        sm: "h-9 rounded-[var(--radius-sm)] px-3 text-sm",
        lg: "h-12 rounded-[var(--radius-md)] px-5 text-sm",
        icon: "size-11 rounded-[var(--radius-sm)]",
        "icon-sm": "size-9 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
