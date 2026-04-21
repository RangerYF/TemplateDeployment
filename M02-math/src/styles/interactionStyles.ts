/**
 * interactionStyles — Event-handler factories for hover/focus states.
 *
 * Since the project uses inline styles, CSS pseudo-classes (:hover/:focus)
 * are unavailable. These utilities produce spread-ready handler objects.
 */

import type { CSSProperties } from 'react';
import { COLORS } from '@/styles/colors';

// ─── Types ──────────────────────────────────────────────────────────────────

type MouseHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: (e: React.MouseEvent<HTMLElement>) => void;
};

type FocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur:  (e: React.FocusEvent<HTMLElement>) => void;
};

// ─── Button hover ───────────────────────────────────────────────────────────

/** Generic button hover: swap background on enter/leave. */
export function btnHover(hoverBg: string, restBg: string = 'transparent'): MouseHandlers {
  return {
    onMouseEnter: (e) => { e.currentTarget.style.background = hoverBg; },
    onMouseLeave: (e) => { e.currentTarget.style.background = restBg; },
  };
}

/** Icon button hover: surfaceAlt background. */
export function iconBtnHover(): MouseHandlers {
  return btnHover(COLORS.surfaceLight, 'transparent');
}

/** Danger button hover: red tint on enter, muted on leave. */
export function dangerHover(restColor: string = '#BFBFBF'): MouseHandlers {
  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.color = COLORS.error;
      e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.color = restColor;
      e.currentTarget.style.background = 'transparent';
    },
  };
}

/** List row hover: light background when not active. */
export function rowHover(isActive: boolean): MouseHandlers {
  return {
    onMouseEnter: (e) => {
      if (!isActive) e.currentTarget.style.background = COLORS.surfaceHover;
    },
    onMouseLeave: (e) => {
      if (!isActive) e.currentTarget.style.background = 'transparent';
    },
  };
}

/** Quick-insert pill button hover: primary fill. */
export function pillHover(
  restBg: string = COLORS.surfaceAlt,
  restColor: string = COLORS.textSecondary,
  restBorder: string = COLORS.border,
): MouseHandlers {
  return {
    onMouseEnter: (e) => {
      e.currentTarget.style.background = COLORS.primary;
      e.currentTarget.style.color = '#FFF';
      e.currentTarget.style.borderColor = COLORS.primary;
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = restBg;
      e.currentTarget.style.color = restColor;
      e.currentTarget.style.borderColor = restBorder;
    },
  };
}

// ─── Focus ring ─────────────────────────────────────────────────────────────

/** Input/button focus ring via boxShadow + borderColor. */
export function focusRing(
  focusColor: string = COLORS.primary,
  ringColor: string = COLORS.primaryFocusRing,
  restBorder: string = COLORS.border,
  /** Extra callbacks to run alongside the focus-ring handlers. */
  extra?: {
    onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
    onBlur?:  (e: React.FocusEvent<HTMLElement>) => void;
  },
): FocusHandlers {
  return {
    onFocus: (e) => {
      e.currentTarget.style.borderColor = focusColor;
      e.currentTarget.style.boxShadow = `0 0 0 3px ${ringColor}`;
      extra?.onFocus?.(e);
    },
    onBlur: (e) => {
      e.currentTarget.style.borderColor = restBorder;
      e.currentTarget.style.boxShadow = 'none';
      extra?.onBlur?.(e);
    },
  };
}

// ─── Base style constants ───────────────────────────────────────────────────

/** Common icon button base styles. */
export const iconBtnBase: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.12s, color 0.12s',
};

/** Common panel input transition. */
export const panelInputBase: CSSProperties = {
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
