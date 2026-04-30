import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/styles/tokens";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "primary" | "gray";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    // Default badge - uses primary color scheme (tag-primary style)
    // 药丸形标签：padding 4px 12px, font-size 13px, border-radius 20px
    default: "rounded-[20px] px-3 py-1 text-[13px] font-medium",
    // Outline badge - border style for secondary emphasis
    // 保留向后兼容，使用灰色边框方案
    outline: "rounded-[20px] px-3 py-1 text-[13px] font-medium border",
    // Primary variant - for knowledge point tags (pill shape)
    // 药丸形标签：padding 4px 12px, font-size 13px, border-radius 20px
    primary: "rounded-[20px] px-3 py-1 text-[13px] font-medium",
    // Gray variant - for category tags (small square)
    // 灰底方形标签：padding 2px 8px, font-size 12px, border-radius 4px
    gray: "rounded-xs px-2 py-0.5 text-xs font-normal",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center",
        variants[variant],
        className
      )}
      style={{
        // Apply COLORS token values via style to match SYXMA spec
        ...(variant === "default" || variant === "primary" ? {
          backgroundColor: COLORS.primaryLight,
          color: COLORS.primary,
        } : {}),
        ...(variant === "outline" ? {
          borderColor: COLORS.border,
          backgroundColor: COLORS.bg,
          color: COLORS.textSecondary,
        } : {}),
        ...(variant === "gray" ? {
          backgroundColor: "#F5F5F5", // Match SYXMA spec exactly
          color: COLORS.textSecondary,
        } : {}),
      }}
      {...props}
    />
  );
}
