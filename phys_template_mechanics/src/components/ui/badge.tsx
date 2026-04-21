import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { COLORS } from '@/styles/tokens'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'primary' | 'gray'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'rounded-[20px] px-3 py-1 text-[13px] font-medium',
    outline: 'rounded-[20px] px-3 py-1 text-[13px] font-medium border',
    primary: 'rounded-[20px] px-3 py-1 text-[13px] font-medium',
    gray: 'rounded-xs px-2 py-0.5 text-xs font-normal',
  }

  return (
    <div
      className={cn('inline-flex items-center', variants[variant], className)}
      style={{
        ...(variant === 'default' || variant === 'primary'
          ? {
              backgroundColor: COLORS.primaryLight,
              color: COLORS.primary,
            }
          : {}),
        ...(variant === 'outline'
          ? {
              borderColor: COLORS.border,
              backgroundColor: COLORS.bg,
              color: COLORS.textSecondary,
            }
          : {}),
        ...(variant === 'gray'
          ? {
              backgroundColor: '#F5F5F5',
              color: COLORS.textSecondary,
            }
          : {}),
      }}
      {...props}
    />
  )
}
