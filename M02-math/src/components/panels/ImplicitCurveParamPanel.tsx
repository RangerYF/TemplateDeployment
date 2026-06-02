/**
 * ImplicitCurveParamPanel — shown when the active entity is an implicit curve.
 *
 * Visual design aligned with design_guid SYXMA tokens:
 *  - Card-like sections with subtle borders and shadows
 *  - design_guid color palette (#00C06B primary, #1A1A2E text)
 *  - Refined input fields with 14px radius (RADIUS.input)
 *  - Polished quick-insert pill buttons
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEntityStore } from '@/editor/store/entityStore';
import { updateImplicitCurveParams } from '@/editor/entities/implicitCurve';
import { UpdateImplicitCurveCommand } from '@/editor/commands/UpdateImplicitCurveCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { parseImplicitEquation, compileImplicitCurve } from '@/engine/implicitCurveEngine';
import { useParamSlider } from '@/hooks/useParamSlider';
import { UniversalSlider } from '@/components/shared/UniversalSlider';
import { COLORS } from '@/styles/colors';
import { pillHover, focusRing } from '@/styles/interactionStyles';
import type { ImplicitCurveEntity, FunctionParam } from '@/types';

type TeachingCurveKind = 'distance-ratio' | 'distance-product' | null;

const QUICK_SYMBOLS: { label: string; insert: string; cursorBack?: number }[] = [
  { label: 'x\u00B2', insert: 'x^2' },
  { label: 'y\u00B2', insert: 'y^2' },
  { label: 'sin',  insert: 'sin()',  cursorBack: 1 },
  { label: 'cos',  insert: 'cos()',  cursorBack: 1 },
  { label: 'sqrt', insert: 'sqrt()', cursorBack: 1 },
  { label: 'abs',  insert: 'abs()',  cursorBack: 1 },
  { label: '\u03C0', insert: 'pi' },
];

function getActiveImplicit(): ImplicitCurveEntity | null {
  const s = useEntityStore.getState();
  const e = s.entities.find((en) => en.id === s.activeEntityId);
  return e?.type === 'implicit-curve' ? e : null;
}

function commitUpdate(before: ImplicitCurveEntity, after: ImplicitCurveEntity): void {
  executeM03Command(new UpdateImplicitCurveCommand(after.id, before, after));
}

function detectTeachingCurve(exprStr: string): TeachingCurveKind {
  if (exprStr.includes('sqrt((x-x1)^2+(y-y1)^2)-k*sqrt((x-x2)^2+(y-y2)^2)')) {
    return 'distance-ratio';
  }
  if (exprStr.includes('sqrt((x-x1)^2+(y-y1)^2)*sqrt((x-x2)^2+(y-y2)^2)-m')) {
    return 'distance-product';
  }
  return null;
}

function labelParam(param: FunctionParam, kind: TeachingCurveKind): string {
  if (kind === 'distance-ratio') {
    if (param.name === 'x1') return 'F1 x';
    if (param.name === 'y1') return 'F1 y';
    if (param.name === 'x2') return 'F2 x';
    if (param.name === 'y2') return 'F2 y';
    if (param.name === 'k') return 'k';
  }
  if (kind === 'distance-product') {
    if (param.name === 'x1') return 'F1 x';
    if (param.name === 'y1') return 'F1 y';
    if (param.name === 'x2') return 'F2 x';
    if (param.name === 'y2') return 'F2 y';
    if (param.name === 'm') return 'm';
  }
  return param.label;
}

function describeTeachingCurve(entity: ImplicitCurveEntity, kind: TeachingCurveKind): { title: string; body: string; accent: string } | null {
  if (!kind) return null;
  const params = Object.fromEntries(entity.params.namedParams.map((param) => [param.name, param.value]));
  const x1 = Number(params.x1 ?? 0);
  const y1 = Number(params.y1 ?? 0);
  const x2 = Number(params.x2 ?? 0);
  const y2 = Number(params.y2 ?? 0);
  const focalDistance = Math.hypot(x2 - x1, y2 - y1);

  if (kind === 'distance-ratio') {
    const k = Number(params.k ?? 1);
    const eps = 1e-3;
    if (Math.abs(k - 1) < eps) {
      return {
        title: '特殊情形',
        body: '当 k = 1 时，轨迹退化为两定点连线的中垂线。',
        accent: COLORS.infoBlueDark,
      };
    }
    if (k > 0 && k < 1) {
      return {
        title: '教学提示',
        body: 'k < 1 时，轨迹更靠近 F1；在当前模板下通常表现为阿波罗尼斯圆。',
        accent: COLORS.primary,
      };
    }
    return {
      title: '教学提示',
      body: 'k > 1 时，轨迹更靠近 F2；当两定点不共线于坐标轴时同样成立。',
      accent: COLORS.primary,
    };
  }

  const m = Number(params.m ?? 0);
  const threshold = (focalDistance * focalDistance) / 4;
  const eps = Math.max(1e-3, threshold * 0.02);
  if (Math.abs(m - threshold) < eps) {
    return {
      title: '特殊情形',
      body: '当 m 约等于两焦点距离平方的四分之一时，会接近伯努利双纽线的分界形态。',
      accent: COLORS.warning,
    };
  }
  if (m < threshold) {
    return {
      title: '教学提示',
      body: '当前更接近双叶分离的卡西尼卵形线，可观察两叶如何围绕两个定点分开。',
      accent: COLORS.warning,
    };
  }
  return {
    title: '教学提示',
    body: '当前更接近单叶连通的卡西尼卵形线，可观察曲线如何包围两定点形成整体。',
    accent: COLORS.warning,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImplicitCurveParamPanel() {
  const allEntities = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);

  const entity = allEntities.find(
    (e) => e.id === activeEntityId && e.type === 'implicit-curve',
  ) as ImplicitCurveEntity | undefined;

  const [eqInput, setEqInput] = useState('');
  const [eqError, setEqError] = useState<string | null>(null);
  const inputFocused = useRef(false);
  const inputDirty = useRef(false);
  const eqInputRef = useRef<HTMLInputElement>(null);

  const handleQuickInsert = useCallback(
    (e: React.MouseEvent, text: string, cursorBack = 0) => {
      e.preventDefault();
      const input = eqInputRef.current;
      const start = input?.selectionStart ?? eqInput.length;
      const end = input?.selectionEnd ?? eqInput.length;
      const next = eqInput.slice(0, start) + text + eqInput.slice(end);
      setEqInput(next);
      setEqError(null);
      inputDirty.current = true;
      const cursorPos = start + text.length - cursorBack;
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [eqInput],
  );

  useEffect(() => {
    if (inputFocused.current || !entity) return;
    setEqInput(formatImplicitDisplay(entity.params.exprStr));
    setEqError(null);
  }, [entity]);

  const commitEqInput = () => {
    const prev = getActiveImplicit();
    if (!prev) return;

    const parsed = parseImplicitEquation(eqInput, prev.params.namedParams);
    if (!parsed) {
      setEqError('无法解析方程，请检查格式');
      return;
    }

    const compiled = compileImplicitCurve({ exprStr: parsed.exprStr, namedParams: parsed.namedParams });
    if (!compiled) {
      setEqError('表达式编译失败');
      return;
    }

    setEqError(null);
    const after = updateImplicitCurveParams(prev, {
      exprStr: parsed.exprStr,
      namedParams: parsed.namedParams,
    });
    useEntityStore.getState().updateEntity(prev.id, after);
    commitUpdate(prev, after);
  };

  const handleParamChange = (idx: number, value: number) => {
    const current = getActiveImplicit();
    if (!current) return;
    const updated = current.params.namedParams.map((p, i) =>
      i === idx ? { ...p, value } : p,
    );
    const next = updateImplicitCurveParams(current, { namedParams: updated });
    useEntityStore.getState().updateEntity(current.id, next);
  };

  const handleParamCommit = (idx: number, value: number) => {
    const prev = getActiveImplicit();
    if (!prev) return;
    const updated = prev.params.namedParams.map((p, i) =>
      i === idx ? { ...p, value } : p,
    );
    const after = updateImplicitCurveParams(prev, { namedParams: updated });
    commitUpdate(prev, after);
  };

  if (!entity) return null;

  const hasParams = entity.params.namedParams.length > 0;
  const teachingKind = detectTeachingCurve(entity.params.exprStr);
  const teachingNote = describeTeachingCurve(entity, teachingKind);

  return (
    <div style={{ padding: '14px' }}>
      {/* Header */}
      <SectionLabel>自定义曲线</SectionLabel>

      {/* Equation display card */}
      <div style={{
        padding: '10px 12px', marginBottom: '12px',
        background: COLORS.primaryLight,
        border: `1px solid ${COLORS.primary}22`,
        borderRadius: '12px',
      }}>
        <p style={{
          fontSize: '14px', fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontWeight: 600, color: COLORS.primary, margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {formatImplicitDisplay(entity.params.exprStr)} = 0
        </p>
      </div>

      {teachingNote && (
        <div style={{
          padding: '10px 12px',
          marginBottom: '12px',
          background: teachingNote.accent === COLORS.warning ? COLORS.warningLight : COLORS.infoBlueBg,
          border: `1px solid ${teachingNote.accent === COLORS.warning ? '#FCD34D' : COLORS.infoBlueBorder}`,
          borderRadius: '12px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: teachingNote.accent, margin: '0 0 4px' }}>
            {teachingNote.title}
          </p>
          <p style={{ fontSize: '11px', color: COLORS.textPrimary, lineHeight: 1.6, margin: 0 }}>
            {teachingNote.body}
          </p>
        </div>
      )}

      {/* Equation text input */}
      <div style={{ marginBottom: '14px' }}>
        <p style={{ fontSize: '11px', color: COLORS.neutral, marginBottom: '5px' }}>
          输入隐式方程 f(x,y) = 0，回车确认
        </p>
        <input
          ref={eqInputRef}
          type="text"
          value={eqInput}
          placeholder="x^2 + y^2 = r^2"
          onChange={(e) => { setEqInput(e.target.value); setEqError(null); inputDirty.current = true; }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{
            width: '100%', padding: '8px 12px',
            fontSize: '13px', fontFamily: "'SF Mono', 'Fira Code', monospace",
            border: `1.5px solid ${eqError ? COLORS.error : COLORS.border}`,
            borderRadius: '14px', outline: 'none', boxSizing: 'border-box',
            background: eqError ? COLORS.errorLight : COLORS.surface,
            color: COLORS.textPrimary,
            transition: 'border-color 150ms, box-shadow 150ms',
          }}
          {...(eqError ? {} : focusRing(undefined, undefined, undefined, {
            onFocus: () => { inputFocused.current = true; inputDirty.current = false; },
            onBlur: () => { inputFocused.current = false; if (inputDirty.current) { inputDirty.current = false; commitEqInput(); } },
          }))}
          {...(eqError ? {
            onFocus: () => { inputFocused.current = true; inputDirty.current = false; },
            onBlur: () => { inputFocused.current = false; if (inputDirty.current) { inputDirty.current = false; commitEqInput(); } },
          } : {})}
        />
        {/* Quick-insert pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
          {QUICK_SYMBOLS.map(({ label, insert, cursorBack }) => (
            <button
              key={label}
              onMouseDown={(e) => handleQuickInsert(e, insert, cursorBack)}
              style={{
                padding: '3px 8px', fontSize: '11px',
                borderRadius: '9999px',
                border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt,
                color: COLORS.textSecondary, cursor: 'pointer',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                transition: 'all 100ms',
              }}
              {...pillHover(COLORS.surfaceAlt, COLORS.textSecondary, COLORS.border)}
            >
              {label}
            </button>
          ))}
        </div>
        {eqError && (
          <p style={{
            fontSize: '11px', color: COLORS.error, marginTop: '4px',
            padding: '4px 8px', background: COLORS.errorLight, borderRadius: '6px',
          }}>
            {eqError}
          </p>
        )}
      </div>

      {/* Named param sliders */}
      {hasParams && (
        <div>
          <SectionLabel>含参常量</SectionLabel>
          {entity.params.namedParams.map((p, idx) => (
            <NamedParamSliderRow
              key={p.name}
              param={p}
              displayLabel={labelParam(p, teachingKind)}
              onChange={(v) => handleParamChange(idx, v)}
              onCommit={(v) => handleParamCommit(idx, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '10px', fontWeight: 700, color: COLORS.neutral,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      marginBottom: '8px',
    }}>
      {children}
    </p>
  );
}

function NamedParamSliderRow({
  param, displayLabel, onChange, onCommit,
}: {
  param: FunctionParam;
  displayLabel: string;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const slider = useParamSlider<number>({
    getValue: () => param.value,
    onLiveUpdate: onChange,
    onCommit: (_before, after) => onCommit(after),
  });

  return (
    <UniversalSlider
      label={displayLabel}
      value={param.value}
      min={param.min}
      max={param.max}
      step={param.step}
      decimals={2}
      onChange={(v) => slider.handleChange(v)}
      onCommit={(v) => slider.handleCommit(v)}
    />
  );
}

function formatImplicitDisplay(exprStr: string): string {
  return exprStr
    .replace(/\*\*/g, '^')
    .replace(/\*/g, '\u00B7');
}
