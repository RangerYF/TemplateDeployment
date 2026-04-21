import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { COLORS } from '@/styles/tokens';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'secondary' | 'dark' | 'ghost' | 'danger' | 'default' | 'accent';
  size?: 'default' | 'sm' | 'lg';
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary:   { backgroundColor: COLORS.primary,   color: COLORS.white },
  default:   { backgroundColor: COLORS.primary,   color: COLORS.white },
  accent:    { backgroundColor: COLORS.primary,   color: COLORS.white },
  dark:      { backgroundColor: COLORS.dark,      color: COLORS.white },
  outline:   { backgroundColor: 'transparent',    color: COLORS.primary, border: `1.5px solid ${COLORS.primary}` },
  secondary: { backgroundColor: COLORS.bgMuted,   color: COLORS.text },
  ghost:     { backgroundColor: 'transparent',    color: COLORS.textMuted },
  danger:    { backgroundColor: COLORS.errorLight, color: COLORS.error },
};

const hoverBgs: Record<string, string> = {
  primary:   COLORS.primaryHover,
  default:   COLORS.primaryHover,
  accent:    COLORS.primaryHover,
  dark:      COLORS.darkHover,
  outline:   COLORS.primaryLight,
  secondary: COLORS.bgHover,
  ghost:     COLORS.bgMuted,
  danger:    COLORS.error,
};

const sizes: Record<string, string> = {
  default: 'px-5 py-3 text-sm',
  sm:      'px-3.5 py-2 text-[13px]',
  lg:      'px-6 py-3 text-base',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'default', style, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props },
    ref,
  ) => {
    const baseStyle = variantStyles[variant] ?? variantStyles.primary;
    const hoverBg   = hoverBgs[variant]      ?? hoverBgs.primary;

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!props.disabled) {
        e.currentTarget.style.backgroundColor = hoverBg;
        if (variant === 'danger') e.currentTarget.style.color = COLORS.white;
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!props.disabled) {
        e.currentTarget.style.backgroundColor = baseStyle.backgroundColor ?? '';
        if (variant === 'danger') e.currentTarget.style.color = COLORS.error;
      }
      onMouseLeave?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
      if (!props.disabled) {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.primaryFocusRing}`;
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
      e.currentTarget.style.boxShadow = 'none';
      onBlur?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-medium focus:outline-none disabled:pointer-events-none',
          sizes[size],
          className,
        )}
        style={{
          borderRadius: '9999px',
          transition: 'background-color 0.15s, color 0.15s, box-shadow 0.15s',
          ...baseStyle,
          ...(props.disabled
            ? { backgroundColor: COLORS.primaryDisabled, color: COLORS.white, opacity: 1 }
            : {}),
          ...style,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
