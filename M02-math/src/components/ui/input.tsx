import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { COLORS, RADIUS } from '@/styles/tokens';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, onFocus, onBlur, onMouseEnter, onMouseLeave, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex w-full bg-white px-4 py-3 text-sm font-medium',
          'transition-[border-color,box-shadow] duration-[0.12s]',
          'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          'placeholder:text-eduMind-textPlaceholder',
          className,
        )}
        style={{
          borderRadius: RADIUS.input,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.text,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!props.disabled && document.activeElement !== e.currentTarget) {
            e.currentTarget.style.borderColor = COLORS.textMuted;
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!props.disabled && document.activeElement !== e.currentTarget) {
            e.currentTarget.style.borderColor = COLORS.border;
          }
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = COLORS.primary;
          e.currentTarget.style.boxShadow  = `0 0 0 3px ${COLORS.primaryFocusRing}`;
          onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = COLORS.border;
          e.currentTarget.style.boxShadow   = 'none';
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
