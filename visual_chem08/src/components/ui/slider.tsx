import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { COLORS, RADIUS } from "@/styles/tokens";
import { Minus, Plus } from "lucide-react";

export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  /** +/- 按钮每次增减的量（默认等于 step） */
  buttonStep?: number;
  disabled?: boolean;
  /** 数值显示格式化 */
  formatValue?: (v: number) => string;
  /** 解析输入值 */
  parseValue?: (s: string) => number;
  /** 隐藏加减按钮 */
  hideButtons?: boolean;
  /** 隐藏可编辑数值 */
  hideInput?: boolean;
}

export function Slider({
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  buttonStep,
  disabled = false,
  formatValue,
  parseValue,
  hideButtons = false,
  hideInput = false,
  className,
  ...props
}: SliderProps) {
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const current = value[0];
  const bStep = buttonStep ?? step;
  const percentage = Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100));

  // 精度：根据 step 自动确定小数位
  const decimals = React.useMemo(() => {
    const s = step.toString();
    const dotIdx = s.indexOf('.');
    return dotIdx < 0 ? 0 : s.length - dotIdx - 1;
  }, [step]);

  const bDecimals = React.useMemo(() => {
    const s = bStep.toString();
    const dotIdx = s.indexOf('.');
    return dotIdx < 0 ? 0 : s.length - dotIdx - 1;
  }, [bStep]);

  const maxDecimals = Math.max(decimals, bDecimals);
  const fmt = formatValue ?? ((v: number) => v.toFixed(maxDecimals));
  const parse = parseValue ?? ((s: string) => parseFloat(s));

  const clamp = React.useCallback((v: number) => {
    const precision = Math.max(decimals, bDecimals);
    const rounded = parseFloat(v.toFixed(precision));
    return Math.max(min, Math.min(max, rounded));
  }, [min, max, decimals, bDecimals]);

  const emit = React.useCallback((v: number) => {
    onValueChange?.([clamp(v)]);
  }, [onValueChange, clamp]);

  const handleDecrement = () => emit(current - bStep);
  const handleIncrement = () => emit(current + bStep);

  const startEdit = () => {
    if (disabled) return;
    setEditText(fmt(current));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const parsed = parse(editText);
    if (!isNaN(parsed)) {
      emit(parsed);
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      {/* 减号按钮 */}
      {!hideButtons && (
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || current <= min}
          className="shrink-0 flex items-center justify-center rounded-md transition-colors duration-100 hover:bg-gray-100 disabled:opacity-30"
          style={{ width: 22, height: 22, color: COLORS.textMuted }}
        >
          <Minus size={13} />
        </button>
      )}

      {/* 滑条区域 */}
      <div className="relative flex h-5 flex-1 touch-none select-none items-center">
        {/* Track */}
        <div
          className="relative h-[6px] w-full grow overflow-hidden"
          style={{
            backgroundColor: COLORS.bgMuted,
            borderRadius: RADIUS.full,
          }}
        >
          <div
            className="absolute h-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: COLORS.primary,
              borderRadius: RADIUS.full,
            }}
          />
        </div>

        {/* 原生 range — 接收所有指针事件 */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => emit(Number(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer"
          style={{ opacity: 0, zIndex: 2, margin: 0 }}
        />

        {/* 视觉 Thumb */}
        <div
          className="absolute h-[18px] w-[18px]"
          style={{
            left: `calc(${percentage}% - 9px)`,
            borderRadius: RADIUS.full,
            backgroundColor: COLORS.white,
            border: `2px solid ${COLORS.primary}`,
            boxShadow: `0 1px 4px rgba(0, 0, 0, 0.08)`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      </div>

      {/* 加号按钮 */}
      {!hideButtons && (
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || current >= max}
          className="shrink-0 flex items-center justify-center rounded-md transition-colors duration-100 hover:bg-gray-100 disabled:opacity-30"
          style={{ width: 22, height: 22, color: COLORS.textMuted }}
        >
          <Plus size={13} />
        </button>
      )}

      {/* 可编辑数值 */}
      {!hideInput && (
        editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="shrink-0 text-center text-xs font-medium focus:outline-none"
            style={{
              width: 64,
              height: 24,
              borderRadius: RADIUS.sm,
              border: `1.5px solid ${COLORS.primary}`,
              color: COLORS.text,
              boxShadow: `0 0 0 2px ${COLORS.primaryFocusRing}`,
            }}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={disabled}
            className="shrink-0 text-center text-xs font-medium cursor-text transition-colors duration-100"
            style={{
              width: 64,
              height: 24,
              lineHeight: '24px',
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              backgroundColor: COLORS.bg,
            }}
            title="点击编辑数值"
          >
            {fmt(current)}
          </button>
        )
      )}
    </div>
  );
}
