import { useState, useRef, useCallback } from 'react';
import { COLORS } from '@/styles/tokens';

interface EditableNumberProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Optional display formatter, defaults to String(value) */
  format?: (v: number) => string;
  /** Text color for the display span, defaults to COLORS.text */
  color?: string;
}

/**
 * Shows a number value as styled text. Click to reveal an inline input.
 * Validates on Enter or blur: clamps to [min, max] and snaps to nearest step.
 */
export function EditableNumber({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  color,
}: EditableNumberProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback((inputVal: string) => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      // Snap to nearest valid step, then clamp
      const snapped = Math.round((parsed - min) / step) * step + min;
      const clamped = Math.min(max, Math.max(min, snapped));
      onChange(clamped);
    }
    setEditing(false);
  }, [min, max, step, onChange]);

  const startEdit = useCallback(() => {
    setRaw(String(value));
    setEditing(true);
    // Focus after state update
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={raw}
        min={min}
        max={max}
        step={step}
        onChange={e => setRaw(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: 68,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.text,
          textAlign: 'right',
          border: `1px solid ${COLORS.primary}`,
          borderRadius: 4,
          padding: '1px 4px',
          outline: 'none',
          backgroundColor: COLORS.bg,
        }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="点击编辑"
      style={{
        fontSize: 14,
        fontWeight: 600,
        color: color ?? COLORS.text,
        cursor: 'text',
        borderBottom: `1px dashed ${COLORS.border}`,
        paddingBottom: 1,
        userSelect: 'none',
      }}
    >
      {format ? format(value) : value}
    </span>
  );
}
