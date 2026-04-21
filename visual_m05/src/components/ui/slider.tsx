"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS } from "@/styles/tokens";

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function Slider({
  value = [0],
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  ...props
}: SliderProps) {
  const percentage = ((value[0] - min) / (max - min)) * 100;

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
        style={{ backgroundColor: COLORS.bgMuted, borderRadius: RADIUS.full }}
      >
        {/* Fill */}
        <div
          className="absolute h-full"
          style={{ width: `${percentage}%`, backgroundColor: COLORS.primary }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        onMouseUp={(e) => onValueCommit?.([Number((e.target as HTMLInputElement).value)])}
        onTouchEnd={(e) => onValueCommit?.([Number((e.target as HTMLInputElement).value)])}
        disabled={disabled}
        className="absolute h-2 w-full cursor-pointer opacity-0"
      />
      {/* Thumb */}
      <div
        className="absolute h-5 w-5 pointer-events-none"
        style={{
          left: `calc(${percentage}% - 10px)`,
          borderRadius: RADIUS.full,
          backgroundColor: COLORS.white,
          border: `2px solid ${COLORS.primary}`,
          boxShadow: `0 1px 4px rgba(0, 0, 0, 0.12)`,
        }}
      />
    </div>
  );
}
