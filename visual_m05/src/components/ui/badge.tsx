import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/styles/tokens";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "gray";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn("inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium", className)}
      style={{
        ...(variant === "default"
          ? { backgroundColor: COLORS.primaryLight, color: COLORS.primary }
          : {}),
        ...(variant === "outline"
          ? { border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg, color: COLORS.textSecondary }
          : {}),
        ...(variant === "gray"
          ? { backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary }
          : {}),
      }}
      {...props}
    />
  );
}
