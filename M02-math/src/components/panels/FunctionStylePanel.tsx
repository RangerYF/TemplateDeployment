import { useEffect, useMemo, useState } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { COLORS } from '@/styles/colors';
import { btnHover, focusRing } from '@/styles/interactionStyles';
import type { CurveLineStyle, FunctionDisplayDomain } from '@/types';

const CURVE_SWATCHES = [
  '#2563EB',
  '#DC2626',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#4B5563',
] as const;

const LINE_STYLE_OPTIONS: Array<{ value: CurveLineStyle; label: string; dash: boolean }> = [
  { value: 'solid', label: '实线', dash: false },
  { value: 'dashed', label: '虚线', dash: true },
] as const;

function fmtDomainValue(value: number | null): string {
  return value === null ? '' : (Number.isInteger(value) ? String(value) : value.toFixed(1));
}

function parseNullableNumber(raw: string): number | null | typeof NaN {
  const text = raw.trim();
  if (!text) return null;
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : NaN;
}

export function FunctionStylePanel() {
  const activeFunction = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );

  const [domainDraft, setDomainDraft] = useState({ xMin: '', xMax: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFunction) {
      setDomainDraft({ xMin: '', xMax: '' });
      setError(null);
      return;
    }
    setDomainDraft({
      xMin: fmtDomainValue(activeFunction.displayDomain.xMin),
      xMax: fmtDomainValue(activeFunction.displayDomain.xMax),
    });
    setError(null);
  }, [activeFunction]);

  const currentDomain = activeFunction?.displayDomain;
  const domainSummary = useMemo(() => {
    if (!currentDomain?.enabled) return '当前显示整个函数图像';
    const left = currentDomain.xMin === null ? '-∞' : fmtDomainValue(currentDomain.xMin);
    const right = currentDomain.xMax === null ? '+∞' : fmtDomainValue(currentDomain.xMax);
    return `当前仅显示 ${left} ≤ x ≤ ${right}`;
  }, [currentDomain]);

  if (!activeFunction) return null;

  const commitPatch = (after: Partial<typeof activeFunction>, label: string) => {
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        activeFunction.id,
        {
          color: activeFunction.color,
          lineStyle: activeFunction.lineStyle,
          displayDomain: { ...activeFunction.displayDomain },
        },
        after,
        label,
      ),
    );
  };

  const handleColorSelect = (color: string) => {
    if (color === activeFunction.color) return;
    commitPatch({ color }, '修改函数颜色');
  };

  const handleLineStyleSelect = (lineStyle: CurveLineStyle) => {
    if (lineStyle === activeFunction.lineStyle) return;
    commitPatch({ lineStyle }, lineStyle === 'solid' ? '切换为实线' : '切换为虚线');
  };

  const applyDomainPatch = (patch: FunctionDisplayDomain, label: string) => {
    useFunctionStore.getState().updateFunction(activeFunction.id, { displayDomain: patch });
    commitPatch({ displayDomain: patch }, label);
  };

  const handleDomainToggle = (enabled: boolean) => {
    const nextDomain: FunctionDisplayDomain = {
      ...activeFunction.displayDomain,
      enabled,
    };
    applyDomainPatch(nextDomain, enabled ? '开启显示定义域' : '关闭显示定义域');
  };

  const handleDomainCommit = () => {
    const parsedMin = parseNullableNumber(domainDraft.xMin);
    const parsedMax = parseNullableNumber(domainDraft.xMax);
    if (Number.isNaN(parsedMin) || Number.isNaN(parsedMax)) {
      setError('定义域边界请输入数字');
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin >= parsedMax) {
      setError('定义域左边界必须小于右边界');
      return;
    }
    const nextDomain: FunctionDisplayDomain = {
      ...activeFunction.displayDomain,
      xMin: parsedMin,
      xMax: parsedMax,
    };
    setError(null);
    applyDomainPatch(nextDomain, '修改函数定义域');
  };

  const handleDomainReset = () => {
    setDomainDraft({ xMin: '', xMax: '' });
    setError(null);
    applyDomainPatch(
      {
        enabled: false,
        xMin: null,
        xMax: null,
      },
      '恢复完整显示范围',
    );
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 8px' }}>
        曲线设置
      </p>

      <div style={{ marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: '0 0 6px' }}>
          颜色
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CURVE_SWATCHES.map((color) => {
            const active = color === activeFunction.color;
            return (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                title={color}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  border: active ? `2px solid ${COLORS.textPrimary}` : `1px solid ${COLORS.border}`,
                  background: color,
                  cursor: 'pointer',
                  boxShadow: active ? `0 0 0 3px ${COLORS.primaryFocusRing}` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: '0 0 6px' }}>
          线型
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {LINE_STYLE_OPTIONS.map((option) => {
            const active = option.value === activeFunction.lineStyle;
            return (
              <button
                key={option.value}
                onClick={() => handleLineStyleSelect(option.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '10px',
                  border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                  background: active ? `${COLORS.primary}18` : COLORS.surface,
                  color: active ? COLORS.primary : COLORS.textSecondary,
                  cursor: 'pointer',
                }}
                {...btnHover(active ? `${COLORS.primary}24` : COLORS.surfaceAlt, active ? `${COLORS.primary}18` : COLORS.surface)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <span
                    style={{
                      width: 18,
                      borderTop: option.dash ? `2px dashed ${active ? COLORS.primary : COLORS.textSecondary}` : `2px solid ${active ? COLORS.primary : COLORS.textSecondary}`,
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{option.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: 0 }}>
            显示定义域
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <span style={{ fontSize: '11px', color: activeFunction.displayDomain.enabled ? COLORS.textPrimary : COLORS.textSecondary }}>
              {activeFunction.displayDomain.enabled ? '已开启' : '未开启'}
            </span>
            <input
              type="checkbox"
              checked={activeFunction.displayDomain.enabled}
              onChange={(e) => handleDomainToggle(e.target.checked)}
            />
          </label>
        </div>

        <p style={{ fontSize: '10px', color: COLORS.textSecondary, margin: '0 0 8px', lineHeight: 1.5 }}>
          {domainSummary}
        </p>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
          <input
            type="text"
            inputMode="decimal"
            value={domainDraft.xMin}
            onChange={(e) => { setDomainDraft((draft) => ({ ...draft, xMin: e.target.value })); setError(null); }}
            placeholder="-10"
            style={{ ...domainInputStyle, opacity: activeFunction.displayDomain.enabled ? 1 : 0.7 }}
            {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleDomainCommit })}
          />
          <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>≤ x ≤</span>
          <input
            type="text"
            inputMode="decimal"
            value={domainDraft.xMax}
            onChange={(e) => { setDomainDraft((draft) => ({ ...draft, xMax: e.target.value })); setError(null); }}
            placeholder="10"
            style={{ ...domainInputStyle, opacity: activeFunction.displayDomain.enabled ? 1 : 0.7 }}
            {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.border, { onBlur: handleDomainCommit })}
          />
        </div>

        {error && (
          <p style={{ fontSize: '11px', color: COLORS.error, margin: '0 0 6px' }}>
            ⚠ {error}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            onClick={handleDomainCommit}
            style={secondaryButtonStyle}
            {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
          >
            应用范围
          </button>
          <button
            onClick={handleDomainReset}
            style={secondaryButtonStyle}
            {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
          >
            恢复完整
          </button>
        </div>
      </div>
    </div>
  );
}

const domainInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '4px 6px',
  fontSize: '12px',
  fontFamily: 'monospace',
  color: COLORS.textPrimary,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '10px',
  textAlign: 'right',
  outline: 'none',
  boxSizing: 'border-box',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: '12px',
  borderRadius: '10px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surface,
  color: COLORS.textSecondary,
  cursor: 'pointer',
};
