import { useState, useEffect } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { COLORS } from '@/styles/colors';
import { btnHover, focusRing } from '@/styles/interactionStyles';

interface RangeField {
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
}

function toStr(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function ViewportPanel() {
  const viewport = useFunctionStore((s) => s.viewport);

  const [fields, setFields] = useState<RangeField>({
    xMin: toStr(viewport.xMin),
    xMax: toStr(viewport.xMax),
    yMin: toStr(viewport.yMin),
    yMax: toStr(viewport.yMax),
  });
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  // Sync fields when viewport changes externally (pan/zoom/reset)
  useEffect(() => {
    setFields({
      xMin: toStr(viewport.xMin),
      xMax: toStr(viewport.xMax),
      yMin: toStr(viewport.yMin),
      yMax: toStr(viewport.yMax),
    });
    setError(null);
  }, [viewport]);

  const handleChange = (key: keyof RangeField, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const handleCommit = () => {
    const xMin = parseFloat(fields.xMin);
    const xMax = parseFloat(fields.xMax);
    const yMin = parseFloat(fields.yMin);
    const yMax = parseFloat(fields.yMax);

    if ([xMin, xMax, yMin, yMax].some(isNaN)) {
      setError('请输入有效数字');
      return;
    }
    if (xMin >= xMax) { setError('xMin 必须小于 xMax'); return; }
    if (yMin >= yMax) { setError('yMin 必须小于 yMax'); return; }

    // Viewport change is not recorded in Undo history
    const current = editorInstance?.getViewport();
    editorInstance?.setViewport(
      new Viewport(xMin, xMax, yMin, yMax, current?.width ?? 800, current?.height ?? 600),
    );
    setError(null);
  };

  const handleReset = () => {
    const current = editorInstance?.getViewport();
    editorInstance?.setViewport(
      new Viewport(-10, 10, -6, 6, current?.width ?? 800, current?.height ?? 600),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCommit();
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      {/* Collapsible header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: collapsed ? 0 : '10px',
          borderRadius: '4px',
          transition: 'background 0.12s',
        }}
        {...btnHover(COLORS.surfaceHover)}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>
          视口范围
        </span>
        <span style={{ fontSize: '11px', color: COLORS.neutral }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <>
          {/* x range row */}
          <div style={rowStyle}>
            <span style={axisLabelStyle}>x:</span>
            <input
              value={fields.xMin}
              onChange={(e) => handleChange('xMin', e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
              placeholder="-10"
              {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleCommit })}
            />
            <span style={{ fontSize: '12px', color: COLORS.neutral }}>~</span>
            <input
              value={fields.xMax}
              onChange={(e) => handleChange('xMax', e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
              placeholder="10"
              {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleCommit })}
            />
          </div>

          {/* y range row */}
          <div style={rowStyle}>
            <span style={axisLabelStyle}>y:</span>
            <input
              value={fields.yMin}
              onChange={(e) => handleChange('yMin', e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
              placeholder="-6"
              {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleCommit })}
            />
            <span style={{ fontSize: '12px', color: COLORS.neutral }}>~</span>
            <input
              value={fields.yMax}
              onChange={(e) => handleChange('yMax', e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
              placeholder="6"
              {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleCommit })}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: '11px', color: COLORS.error, margin: '4px 0 6px' }}>
              ⚠ {error}
            </p>
          )}

          {/* Reset viewport */}
          <button
            onClick={handleReset}
            style={{
              width: '100%',
              marginTop: '4px',
              padding: '5px',
              fontSize: '12px',
              borderRadius: '10px',
              border: `1px solid ${COLORS.border}`,
              background: COLORS.surface,
              color: COLORS.textSecondary,
              cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
          >
            重置视口
          </button>
        </>
      )}
    </div>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '6px',
};

const axisLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: COLORS.textSecondary,
  width: '14px',
  flexShrink: 0,
  fontFamily: 'monospace',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '4px 6px',
  fontSize: '12px',
  fontFamily: 'monospace',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.textPrimary,
  outline: 'none',
  textAlign: 'right',
};
