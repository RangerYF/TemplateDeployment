"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS } from "@/styles/tokens";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked = false, onCheckedChange, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "w-5 h-5 flex items-center justify-center border-2 transition-all",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer",
          className
        )}
        style={{
          borderRadius: RADIUS.xs,
          borderColor: checked ? COLORS.primary : COLORS.border,
          backgroundColor: checked ? COLORS.primary : COLORS.bg,
          color: COLORS.white,
        }}
      >
        {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
    );
  }
);

Checkbox.displayName = "Checkbox";
