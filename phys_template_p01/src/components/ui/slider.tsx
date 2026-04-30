import * as React from "react";
import { cn } from "@/lib/utils";
import { COLORS, RADIUS } from "@/styles/tokens";

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function Slider({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  ...props
}: SliderProps) {
  const range = max - min;
  const percentage = (((value[0] ?? 0) - min) / range) * 100;
  const hasNegative = min < 0 && max > 0;
  const zeroPercent = hasNegative ? ((0 - min) / range) * 100 : 0;

  return (
    <div
      className={cn(
        "relative flex h-5 w-full touch-none select-none items-center",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    >
      {/* Track */}
      <div
        className="relative h-2 w-full grow overflow-hidden"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.full,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {/* Fill：正负范围时从零点双向填充，否则从左边界填充 */}
        {hasNegative ? (
          <div
            className="absolute h-full"
            style={{
              left: `${Math.min(zeroPercent, percentage)}%`,
              width: `${Math.abs(percentage - zeroPercent)}%`,
              backgroundColor: COLORS.primary,
            }}
          />
        ) : (
          <div
            className="absolute h-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: COLORS.primary,
            }}
          />
        )}
        {/* 零点刻度线 */}
        {hasNegative && (
          <div
            className="absolute top-0 h-full"
            style={{
              left: `${zeroPercent}%`,
              width: 1,
              backgroundColor: COLORS.textMuted,
              opacity: 0.5,
            }}
          />
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        disabled={disabled}
        className="absolute h-2 w-full cursor-pointer opacity-0"
      />
      {/* Thumb (pointer-events: none — input underneath handles drag) */}
      <div
        className="pointer-events-none absolute h-5 w-5 shadow-sm ring-offset-white transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none"
        style={{
          left: `calc(${percentage}% - 10px)`,
          borderRadius: RADIUS.full,
          backgroundColor: COLORS.white,
          border: `2px solid ${COLORS.primary}`,
          boxShadow: `0 1px 4px rgba(0, 0, 0, 0.04)`,
          "--tw-ring-color": COLORS.primaryFocusRing,
        } as React.CSSProperties}
      />
    </div>
  );
}
