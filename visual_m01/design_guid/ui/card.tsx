import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/styles/tokens";

// ============================================
// 卡片样式常量 - SYXMA Design System
// 边框卡片，不使用阴影（SYXMA-minimal 哲学）
// ============================================
export const CARD_STYLES = {
  // 基础卡片样式（边框 + 18px 圆角）
  base: "bg-white border border-[#E5E7EB] p-6 transition-[border-color,box-shadow] duration-[0.12s] cursor-pointer",
  // 间距常量
  spacing: {
    padding: "p-6",
    gap: "gap-6",
  },
  // 圆角常量
  radius: {
    card: "rounded-[18px]",
    sm: "rounded-lg",
    md: "rounded-xl",
    lg: "rounded-2xl",
  },
} as const;

// ============================================
// 难度标签配置 - SYXMA Design System
// 使用 COLORS token 的难度色
// ============================================
export const DIFFICULTY_CONFIG = {
  basic: {
    bg: COLORS.easyBg,
    color: COLORS.easy,
    label: "基础",
  },
  advanced: {
    bg: COLORS.mediumBg,
    color: COLORS.medium,
    label: "深入",
  },
  challenge: {
    bg: COLORS.hardBg,
    color: COLORS.hard,
    label: "挑战",
  },
  elite: {
    bg: COLORS.hardBg,
    color: COLORS.hard,
    label: "拔尖",
  },
} as const;

// 难度级别映射（1-5 级对应不同难度）
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export const getDifficultyStyle = (level: DifficultyLevel) => {
  const configMap: Record<number, keyof typeof DIFFICULTY_CONFIG> = {
    1: "basic",
    2: "basic",
    3: "advanced",
    4: "challenge",
    5: "elite",
  };
  return DIFFICULTY_CONFIG[configMap[level] || "basic"];
};

// ============================================
// 基础 Card 组件 - SYXMA 边框卡片
// ============================================
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "elevated" | "interactive";
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-white border border-[#E5E7EB] rounded-[18px] p-6",
    elevated: "bg-white border border-[#E5E7EB] rounded-[18px] p-6 shadow-sm",
    interactive:
      "bg-white border border-[#E5E7EB] rounded-[18px] p-6 transition-[border-color,box-shadow] duration-[0.12s] cursor-pointer hover:border-[#D1D1CF] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
  };

  return (
    <div
      ref={ref}
      className={cn(variants[variant], className)}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight text-[#1A1A2E]", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#595959]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// ============================================
// DifficultyBadge 组件 - 难度标签（方形小标签）
// SYXMA .tag-difficulty: border-radius 4px, 12px/600
// ============================================
interface DifficultyBadgeProps {
  level: DifficultyLevel;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const DifficultyBadge = ({
  level,
  showLabel = true,
  size = "md",
  className,
}: DifficultyBadgeProps) => {
  const config = getDifficultyStyle(level);

  const sizeStyles = {
    sm: {
      badge: "px-2 py-0.5 text-[11px]",
      dot: "w-1.5 h-1.5",
    },
    md: {
      badge: "px-2 py-0.5 text-xs",
      dot: "w-2 h-2",
    },
    lg: {
      badge: "px-3 py-1 text-sm",
      dot: "w-2.5 h-2.5",
    },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] font-semibold uppercase",
        sizeStyles[size].badge,
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.color,
      }}
    >
      <span
        className={cn("rounded-full", sizeStyles[size].dot)}
        style={{ backgroundColor: config.color }}
      />
      {showLabel && config.label}
    </span>
  );
};

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DifficultyBadge,
};