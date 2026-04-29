import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { COLORS, RADIUS } from '@/styles/tokens';

export interface SliderProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function snapToStep(raw: number, step: number, min: number): number {
  return Math.round((raw - min) / step) * step + min;
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
  const trackRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);

  const val = value[0];

  // Adaptive range: expand to enclose the current value
  const effectiveMin = Math.min(min, val);
  const effectiveMax = Math.max(max, val);
  const range = effectiveMax - effectiveMin;
  const pct = range > 0 ? Math.max(0, Math.min(100, ((val - effectiveMin) / range) * 100)) : 0;

  // Whether value is outside the declared [min, max]
  const isExtended = val < min || val > max;

  const computeValue = React.useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return val;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const eMin = Math.min(min, val);
      const eMax = Math.max(max, val);
      const raw = eMin + ratio * (eMax - eMin);
      return snapToStep(raw, step, min);
    },
    [min, max, step, val],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      const v = computeValue(e.clientX);
      onValueChange?.([v]);
    },
    [disabled, computeValue, onValueChange],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      const v = computeValue(e.clientX);
      onValueChange?.([v]);
    },
    [computeValue, onValueChange],
  );

  const handlePointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const v = computeValue(e.clientX);
      onValueCommit?.([v]);
    },
    [computeValue, onValueCommit],
  );

  const fillColor = isExtended ? COLORS.warning : COLORS.primary;

  return (
    <div
      className={cn(
        'relative flex h-5 w-full touch-none select-none items-center overflow-hidden',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      style={{ minWidth: 0 }}
      {...props}
    >
      {/* Track — interaction target */}
      <div
        ref={trackRef}
        className="relative h-2 w-full grow cursor-pointer overflow-hidden"
        style={{ backgroundColor: COLORS.bgMuted, borderRadius: RADIUS.full }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Fill */}
        <div
          className="pointer-events-none absolute h-full"
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>

      {/* Thumb */}
      <div
        className="pointer-events-none absolute h-5 w-5 shadow-sm"
        style={{
          left: `calc(${pct}% - 10px)`,
          borderRadius: RADIUS.full,
          backgroundColor: COLORS.white,
          border: `2px solid ${fillColor}`,
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
        }}
      />
    </div>
  );
}
