import { useState, useEffect } from 'react';
import { Viewport, centerOriginViewport } from '@/canvas/Viewport';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { COLORS } from '@/styles/colors';
import { btnHover, focusRing } from '@/styles/interactionStyles';
import { DEFAULT_VIEWPORT } from '@/types';

interface RangeField {
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
}

function toStr(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const AXIS_SCALE_FACTOR = 0.8;

export function ViewportPanel() {
  const viewport = useFunctionStore((s) => s.viewport);

  const [fields, setFields] = useState<RangeField>({
    xMin: toStr(viewport.xMin),
    xMax: toStr(viewport.xMax),
    yMin: toStr(viewport.yMin),
    yMax: toStr(viewport.yMax),
  });
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const getEditorViewport = () =>
    editorInstance?.getViewport()
    ?? new Viewport(viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax, 800, 600);

  const applyViewport = (next: Viewport) => {
    editorInstance?.setViewport(next);
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
    if (xMin >= xMax) { setError('x 轴左边界必须小于右边界'); return; }
    if (yMin >= yMax) { setError('y 轴下边界必须小于上边界'); return; }

    const current = getEditorViewport();
    applyViewport(new Viewport(xMin, xMax, yMin, yMax, current.width, current.height));
  };

  const handleReset = () => {
    const current = getEditorViewport();
    applyViewport(
      new Viewport(
        DEFAULT_VIEWPORT.xMin,
        DEFAULT_VIEWPORT.xMax,
        DEFAULT_VIEWPORT.yMin,
        DEFAULT_VIEWPORT.yMax,
        current.width,
        current.height,
      ),
    );
  };

  const handleCenterOrigin = () => {
    applyViewport(centerOriginViewport(getEditorViewport()));
  };

  const handleAxisScale = (axis: 'x' | 'y', factor: number) => {
    const current = getEditorViewport();
    if (axis === 'x') {
      const center = (current.xMin + current.xMax) / 2;
      const half = current.xRange * factor / 2;
      applyViewport(new Viewport(center - half, center + half, current.yMin, current.yMax, current.width, current.height));
      return;
    }

    const center = (current.yMin + current.yMax) / 2;
    const half = current.yRange * factor / 2;
    applyViewport(new Viewport(current.xMin, current.xMax, center - half, center + half, current.width, current.height));
  };

  const handleAxisReset = (axis: 'x' | 'y') => {
    const current = getEditorViewport();
    if (axis === 'x') {
      applyViewport(
        new Viewport(
          DEFAULT_VIEWPORT.xMin,
          DEFAULT_VIEWPORT.xMax,
          current.yMin,
          current.yMax,
          current.width,
          current.height,
        ),
      );
      return;
    }

    applyViewport(
      new Viewport(
        current.xMin,
        current.xMax,
        DEFAULT_VIEWPORT.yMin,
        DEFAULT_VIEWPORT.yMax,
        current.width,
        current.height,
      ),
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
          横纵坐标单独调整
        </span>
        <span style={{ fontSize: '11px', color: COLORS.neutral }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <>
          <p style={{ fontSize: '11px', color: COLORS.textSecondary, lineHeight: 1.55, margin: '0 0 10px' }}>
            可分别修改横轴和纵轴范围，避免函数图像被拉得过高、过扁或看起来过于夸张。
          </p>

          {/* x range row */}
          <div style={rowStyle}>
            <span style={axisLabelStyle}>横轴 x</span>
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
          <div style={axisActionRowStyle}>
            <button
              onClick={() => handleAxisScale('x', AXIS_SCALE_FACTOR)}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              横轴放大
            </button>
            <button
              onClick={() => handleAxisScale('x', 1 / AXIS_SCALE_FACTOR)}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              横轴缩小
            </button>
            <button
              onClick={() => handleAxisReset('x')}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              横轴默认
            </button>
          </div>

          {/* y range row */}
          <div style={rowStyle}>
            <span style={axisLabelStyle}>纵轴 y</span>
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
          <div style={axisActionRowStyle}>
            <button
              onClick={() => handleAxisScale('y', AXIS_SCALE_FACTOR)}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              纵轴放大
            </button>
            <button
              onClick={() => handleAxisScale('y', 1 / AXIS_SCALE_FACTOR)}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              纵轴缩小
            </button>
            <button
              onClick={() => handleAxisReset('y')}
              style={miniButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              纵轴默认
            </button>
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: '11px', color: COLORS.error, margin: '4px 0 6px' }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '4px' }}>
            <button
              onClick={handleCommit}
              title="按输入值更新当前坐标范围"
              style={actionButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              应用输入
            </button>
            <button
              onClick={handleCenterOrigin}
              title="保持当前缩放比例，将原点移到中心"
              style={actionButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              原点居中
            </button>
            <button
              onClick={handleReset}
              title="重置到默认视口范围"
              style={actionButtonStyle}
              {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
            >
              全部默认
            </button>
          </div>
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
  width: '42px',
  flexShrink: 0,
  lineHeight: 1.2,
};

const axisActionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '6px',
  marginBottom: '10px',
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

const actionButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px',
  fontSize: '12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.textSecondary,
  cursor: 'pointer',
  transition: 'background 0.12s',
};

const miniButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 6px',
  fontSize: '11px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.textSecondary,
  cursor: 'pointer',
  transition: 'background 0.12s',
};
