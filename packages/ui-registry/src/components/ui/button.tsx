import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-[0.9375rem] leading-[1.46667] font-medium whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-[3px] active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-dark shadow-xs hover:shadow-sm",
        destructive:
          "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-white shadow-xs hover:shadow-sm",
        outline:
          "border-input text-foreground hover:border-primary/60 hover:bg-primary/[0.06] hover:text-primary border bg-transparent",
        secondary: "bg-primary/[0.16] text-primary hover:bg-primary/[0.24]",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[38px] px-[18px] py-2 has-[>svg]:px-4",
        sm: "h-[30px] gap-1.5 rounded-md px-3.5 text-[0.8125rem] has-[>svg]:px-3",
        lg: "h-[46px] rounded-md px-[22px] text-[1.0625rem] has-[>svg]:px-5",
        icon: "size-[38px]",
        "icon-sm": "size-[30px]",
        "icon-lg": "size-[46px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
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
