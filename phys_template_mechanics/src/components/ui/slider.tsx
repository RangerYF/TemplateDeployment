import * as React from "react";
import { cn } from "@/lib/utils/cn";
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
  const rawPercentage = range > 0 ? ((value[0] - min) / range) * 100 : 0;
  const percentage = Math.max(0, Math.min(100, Number.isFinite(rawPercentage) ? rawPercentage : 0));

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
          backgroundColor: COLORS.bgMuted,
          borderRadius: RADIUS.full,
        }}
      >
        {/* Fill */}
        <div
          className="absolute h-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: COLORS.primary,
          }}
        />
      </div>
      {/* Thumb (visual only) */}
      <div
        className="absolute h-5 w-5 shadow-sm ring-offset-white transition-transform pointer-events-none"
        style={{
          left: `calc(${percentage}% - 10px)`,
          borderRadius: RADIUS.full,
          backgroundColor: COLORS.white,
          border: `2px solid ${COLORS.primary}`,
          boxShadow: `0 1px 4px rgba(0, 0, 0, 0.04)`,
          // Focus ring color
          "--tw-ring-color": COLORS.primaryFocusRing,
        } as React.CSSProperties}
      />
      {/* Invisible range input on top for interaction */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        disabled={disabled}
        className="absolute h-5 w-full cursor-pointer opacity-0"
        style={{ zIndex: 1 }}
      />
    </div>
  );
}
