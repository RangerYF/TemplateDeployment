import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { COLORS } from '@/styles/tokens';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  className,
  ...props
}: SwitchProps) {
  // Sync internal state with controlled prop
  const [internalChecked, setInternalChecked] = React.useState(checked);
  React.useEffect(() => { setInternalChecked(checked); }, [checked]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setInternalChecked(next);
    onCheckedChange?.(next);
  };

  return (
    <label
      className={cn(
        'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      style={{
        backgroundColor: internalChecked ? COLORS.primary : COLORS.bgMuted,
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.filter = 'brightness(0.92)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'none';
      }}
    >
      <input
        type="checkbox"
        checked={internalChecked}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        onFocus={(e) => {
          const label = e.currentTarget.parentElement;
          if (label) label.style.boxShadow = `0 0 0 3px ${COLORS.primaryFocusRing}`;
        }}
        onBlur={(e) => {
          const label = e.currentTarget.parentElement;
          if (label) label.style.boxShadow = 'none';
        }}
        {...props}
      />
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full shadow',
          internalChecked ? 'translate-x-6' : 'translate-x-1',
        )}
        style={{
          backgroundColor: COLORS.white,
          transition: 'transform 0.12s',
        }}
      />
    </label>
  );
}
