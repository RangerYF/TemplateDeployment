/**
 * UniversalSlider — Projector-ready parameter slider with manual input.
 *
 * Features:
 *  - Thick track (6px) + large handle (18px) for projector visibility
 *  - Inline numeric input for precise manual entry
 *  - Dynamic sensitivity: large ranges are handled without layout breakage
 *  - Label with live value readout at ≥ 14px
 *  - Safety: clamps to [min, max], prevents invalid values
 *
 * Usage:
 *   <UniversalSlider
 *     label="a"
 *     value={5}
 *     min={0.1} max={10} step={0.1}
 *     onChange={(v) => handleChange(v)}
 *     onCommit={(v) => handleCommit(v)}
 *   />
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { COLORS } from '@/styles/colors';
import { focusRing } from '@/styles/interactionStyles';

export interface UniversalSliderProps {
  /** Parameter label (e.g. "a", "e", "θ") */
  label: string;
  /** Current value */
  value: number;
  /** Range constraints */
  min: number;
  max: number;
  /** Step increment (default 0.1) */
  step?: number;
  /** Decimal places for display (default auto from step) */
  decimals?: number;
  /** Called on every slider tick for live preview */
  onChange: (value: number) => void;
  /** Called on slider release for Undo/Redo commit */
  onCommit: (value: number) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Unit suffix (e.g. "°", "π") */
  unit?: string;
  /** Custom display value text (overrides numeric display) */
  displayValue?: string;
  /** Accent color (default primary green) */
  color?: string;
}

function inferDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function UniversalSlider({
  label,
  value,
  min,
  max,
  step = 0.1,
  decimals,
  onChange,
  onCommit,
  disabled = false,
  unit = '',
  displayValue,
  color,
}: UniversalSliderProps) {
  const dp = decimals ?? inferDecimals(step);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when value changes externally while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(value.toFixed(dp));
    }
  }, [value, dp, isEditing]);

  const handleSliderChange = useCallback(([v]: number[]) => {
    onChange(v);
  }, [onChange]);

  const handleSliderCommit = useCallback(([v]: number[]) => {
    onCommit(v);
  }, [onCommit]);

  // Manual input handlers
  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(value.toFixed(dp));
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value, dp, disabled]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const parsed = parseFloat(draft);
    if (isNaN(parsed)) return; // revert
    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    onCommit(clamped);
  }, [draft, min, max, onChange, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [commitEdit]);

  const accentColor = color ?? COLORS.primary;
  const showValue = displayValue ?? `${value.toFixed(dp)}${unit}`;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '36px 1fr 64px',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px',
    }}>
      {/* Label */}
      <span style={{
        fontSize: '14px', fontWeight: 700,
        color: accentColor, fontFamily: 'monospace',
      }}>
        {label}
      </span>

      {/* Slider */}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={handleSliderChange}
        onValueCommit={handleSliderCommit}
      />

      {/* Value readout / manual input */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%', textAlign: 'right',
            fontSize: '13px', fontFamily: 'monospace', fontWeight: 600,
            color: COLORS.textPrimary, background: COLORS.surfaceAlt,
            border: `1px solid ${accentColor}`,
            borderRadius: 8, padding: '1px 4px',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          title="点击输入精确值"
          style={{
            fontSize: '13px', fontFamily: 'monospace', fontWeight: 600,
            color: disabled ? COLORS.neutral : COLORS.textPrimary,
            textAlign: 'right',
            cursor: disabled ? 'default' : 'text',
            padding: '1px 4px',
            borderRadius: 8,
            border: '1px solid transparent',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { if (!disabled) (e.target as HTMLElement).style.borderColor = COLORS.borderMuted; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'transparent'; }}
        >
          {showValue}
        </span>
      )}
    </div>
  );
}

// ─── Convenience: Reset Button ──────────────────────────────────────────────

export interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function ResetButton({ onClick, disabled, label = '重置默认值' }: ResetButtonProps) {
  const restBg = disabled ? COLORS.surfaceAlt : COLORS.surface;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', marginTop: 4, marginBottom: 4,
        padding: '4px 0',
        borderRadius: 8,
        fontSize: '11px', fontWeight: 600,
        border: `1px solid ${COLORS.borderMuted}`,
        background: restBg,
        color: disabled ? COLORS.neutral : COLORS.textDark,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = COLORS.surfaceLight; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = restBg; }}
      {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.borderMuted)}
    >
      {label}
    </button>
  );
}
