import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS } from "@/styles/tokens";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "secondary" | "dark" | "ghost" | "danger" | "default" | "accent";
  size?: "default" | "sm" | "lg";
}

const variantStyles: Record<string, React.CSSProperties> = {
  // Primary - 品牌绿按钮 (SYXMA 规范)
  primary: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
  },
  // Default - 别名，指向 primary
  default: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
  },
  // Accent - 别名，指向 primary (保持向后兼容)
  accent: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
  },
  // Dark - 深色按钮
  dark: {
    backgroundColor: COLORS.dark,
    color: COLORS.white,
  },
  // Outline - 描边按钮
  outline: {
    backgroundColor: "transparent",
    color: COLORS.primary,
    border: `1.5px solid ${COLORS.primary}`,
  },
  // Secondary - 次要按钮
  secondary: {
    backgroundColor: COLORS.bgMuted,
    color: COLORS.text,
  },
  // Ghost - 幽灵按钮
  ghost: {
    backgroundColor: "transparent",
    color: COLORS.textMuted,
  },
  // Danger - 危险按钮
  danger: {
    backgroundColor: COLORS.errorLight,
    color: COLORS.error,
  },
};

const hoverBgs: Record<string, string> = {
  primary: COLORS.primaryHover,
  default: COLORS.primaryHover,
  accent: COLORS.primaryHover,
  dark: COLORS.darkHover,
  outline: COLORS.primaryLight,
  secondary: COLORS.primary,
  ghost: COLORS.bgMuted,
  danger: COLORS.error,
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", style, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const sizes: Record<string, string> = {
      default: "px-5 py-3 text-sm",
      sm: "px-3.5 py-2 text-[13px]",
      lg: "px-6 py-3 text-base",
    };

    const baseStyle = variantStyles[variant] || variantStyles.primary;
    const hoverBg = hoverBgs[variant] || hoverBgs.primary;

    const needsColorSwap = variant === "danger" || variant === "secondary";

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!props.disabled) {
        e.currentTarget.style.backgroundColor = hoverBg;
        if (needsColorSwap) {
          e.currentTarget.style.color = COLORS.white;
        }
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!props.disabled) {
        e.currentTarget.style.backgroundColor = baseStyle.backgroundColor || "";
        if (needsColorSwap) {
          e.currentTarget.style.color = baseStyle.color || "";
        }
      }
      onMouseLeave?.(e);
    };

    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium focus:outline-none disabled:pointer-events-none",
          sizes[size],
          className
        )}
        ref={ref}
        style={{
          borderRadius: "9999px",
          transition: "all 0.12s",
          ...baseStyle,
          ...(props.disabled
            ? { backgroundColor: COLORS.primaryDisabled, color: COLORS.white, opacity: 1 }
            : {}),
          ...style,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
