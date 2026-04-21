import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { TeX } from '@/components/ui/TeX';
import type { CalcStep } from '@/engine/math/types';

interface CalcStepsModalProps {
  title: string;
  steps: CalcStep[];
  onClose: () => void;
}

export function CalcStepsModal({ title, steps, onClose }: CalcStepsModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      />
      {/* 弹窗内容 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          backgroundColor: COLORS.bg,
          borderRadius: RADIUS.md,
          boxShadow: SHADOWS.lg,
          padding: '24px 28px',
          minWidth: 320,
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: COLORS.text,
              margin: 0,
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: COLORS.textMuted,
              padding: '2px 6px',
              borderRadius: RADIUS.xs,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step, i) => (
            <div key={i}>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: RADIUS.full,
                    backgroundColor: COLORS.primaryLight,
                    color: COLORS.primary,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </span>
                {step.label}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: COLORS.bgMuted,
                  borderRadius: RADIUS.xs,
                  textAlign: 'center',
                }}
              >
                <TeX math={step.latex} display />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
