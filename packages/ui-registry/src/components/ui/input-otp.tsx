"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 🎯 Purpose: Apply forwardRef to the InputOTP component for React 18/19 compatibility
 * 📝 Note: Uses OTPInput from the input-otp library
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput> & {
    containerClassName?: string;
  }
>(({ className, containerClassName, ...props }, ref) => {
  return (
    <OTPInput
      ref={ref}
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
});
InputOTP.displayName = "InputOTP";

/**
 * 🎯 Purpose: Apply forwardRef to the InputOTPGroup component for React 18/19 compatibility
 * 📝 Note: Uses an HTML div element
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const InputOTPGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
});
InputOTPGroup.displayName = "InputOTPGroup";

/**
 * 🎯 Purpose: Apply forwardRef to the InputOTPSlot component for React 18/19 compatibility
 * 📝 Note: Uses an HTML div element; reads slot state from OTPInputContext
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const InputOTPSlot = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    index: number;
  }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      ref={ref}
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-primary data-[active=true]:ring-primary/20 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive border-input relative flex h-10 w-10 items-center justify-center border-y border-r text-[0.9375rem] transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

/**
 * 🎯 Purpose: Apply forwardRef to the InputOTPSeparator component for React 18/19 compatibility
 * 📝 Note: Uses an HTML div element; acts as a visual separator
 * 🔄 History: 2025-10-11 - Added forwardRef for React 18/19 dual support
 */
const InputOTPSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ ...props }, ref) => {
  return (
    <div ref={ref} data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  );
});
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
