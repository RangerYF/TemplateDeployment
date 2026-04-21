import * as React from "react";
import { cn } from "@/lib/utils";
import { COLORS, RADIUS } from "@/styles/tokens";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full bg-white px-4 py-3 text-sm font-medium transition-[border-color,box-shadow] duration-[0.12s] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "placeholder:text-[#9CA3AF]",
          className
        )}
        style={{
          borderRadius: RADIUS.input,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          ...style,
        }}
        ref={ref}
        {...props}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.primary;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.primaryFocusRing}`;
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = COLORS.border;
          e.currentTarget.style.boxShadow = "none";
          props.onBlur?.(e);
        }}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
