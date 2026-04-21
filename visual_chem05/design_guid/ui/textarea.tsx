import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS } from "@/styles/tokens";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, style, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "flex w-full border bg-white px-4 py-3 text-sm font-medium leading-[1.6] resize-vertical placeholder:text-[--textarea-placeholder] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        minHeight: "120px",
        borderRadius: RADIUS.input,
        borderColor: COLORS.border,
        color: COLORS.text,
        transition: "border-color 0.12s",
        ["--textarea-placeholder" as string]: COLORS.textPlaceholder,
        ...style,
      }}
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
      {...props}
    />
  );
}
