import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/styles/tokens";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-[14px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      style={{
        color: COLORS.text,
      }}
      {...props}
    />
  );
}
