import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { COLORS, RADIUS } from "@/styles/tokens"

const alertVariants = cva(
  "relative w-full p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "",
        info: "",
        warning: "",
        error: "",
        success: "",
        destructive: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: COLORS.infoLight,
    color: COLORS.info,
    borderLeft: `4px solid ${COLORS.info}`,
    borderRadius: RADIUS.input, // 14px
  },
  info: {
    backgroundColor: COLORS.infoLight,
    color: COLORS.info,
    borderLeft: `4px solid ${COLORS.info}`,
    borderRadius: RADIUS.input,
  },
  warning: {
    backgroundColor: COLORS.warningLight,
    color: COLORS.warning,
    borderLeft: `4px solid ${COLORS.warning}`,
    borderRadius: RADIUS.input,
  },
  error: {
    backgroundColor: COLORS.errorLight,
    color: COLORS.error,
    borderLeft: `4px solid ${COLORS.error}`,
    borderRadius: RADIUS.input,
  },
  success: {
    backgroundColor: COLORS.successLight,
    color: COLORS.success,
    borderLeft: `4px solid ${COLORS.success}`,
    borderRadius: RADIUS.input,
  },
  destructive: {
    backgroundColor: COLORS.errorLight,
    color: COLORS.error,
    borderLeft: `4px solid ${COLORS.error}`,
    borderRadius: RADIUS.input,
  },
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, style, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
      fontSize: "14px",
      lineHeight: "1.65",
      ...variantStyles[variant || "default"],
      ...style,
    }}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
