import { useRef, useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useInteractionStore } from '@/editor/store/interactionStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { startAnimation, easeInOut } from '@/engine/animationEngine';
import { buildReadableExpr, getTemplate, buildTemplateExpr } from '@/engine/functionTemplates';
import type { Transform, FunctionParam } from '@/types';
import { DEFAULT_TRANSFORM } from '@/types';
import { COLORS } from '@/styles/colors';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InspectorTarget {
  /** Position relative to the canvas container (px) */
  x: number;
  y: number;
  /** The function that was clicked */
  functionId: string;
  /** Optional: math coords for pinning */
  mathX?: number;
  mathY?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_W = 260;

/** Light palette — matches right-panel white-card style */
const P = {
  bg:         COLORS.surface,
  border:     COLORS.border,
  text:       COLORS.textPrimary,
  textDim:    COLORS.textSecondary,
  accent:     COLORS.primary,
  accentDim:  COLORS.primaryFocusRing,
  surface:    COLORS.surfaceAlt,
  inputBg:    COLORS.surfaceAlt,
} as const;

// ─── Transform specs (compact version of TransformPanel) ─────────────────────

type ParamKey = keyof Transform;

interface TSpec {
  key: ParamKey;
  label: string;
  min: number;
  max: number;
  skipZ: boolean;
  demoTo: number;
}

const T_SPECS: TSpec[] = [
  { key: 'a', label: 'a', min: -20,  max: 20,  skipZ: true,  demoTo: 2.0 },
  { key: 'b', label: 'b', min: -20,  max: 20,  skipZ: true,  demoTo: 2.0 },
  { key: 'h', label: 'h', min: -100, max: 100, skipZ: false, demoTo: 3.0 },
  { key: 'k', label: 'k', min: -100, max: 100, skipZ: false, demoTo: 2.0 },
];

function skipZero(v: number, prev: number): number {
  if (v === 0 || Math.abs(v) < 0.05) return prev > 0 ? -0.1 : 0.1;
  return v;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CurveInspectorPanel({
  target,
  containerRect,
  onClose,
}: {
  target: InspectorTarget;
  /** Bounding rect of the canvas container — used for position clamping */
  containerRect: DOMRect;
  onClose: () => void;
}) {
  const fn = useFunctionStore((s) => s.functions.find((f) => f.id === target.functionId) ?? null);
  const isGlobalAnim = useAnimationStore((s) => s.isAnyAnimating);

  // ── Position: clamp so the panel stays within the container ──
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const posComputed = useRef(false);

  useEffect(() => {
    if (posComputed.current) return;
    posComputed.current = true;
    const el = panelRef.current;
    const pH = el?.offsetHeight ?? 260;
    const pW = PANEL_W;
    const cW = containerRect.width;
    const cH = containerRect.height;

    // Prefer right of click, fall back left
    let left = target.x + 12;
    if (left + pW > cW - 8) left = target.x - pW - 12;
    left = Math.max(8, Math.min(left, cW - pW - 8));

    // Prefer below click, fall back above
    let top = target.y - 20;
    if (top + pH > cH - 8) top = target.y - pH + 20;
    top = Math.max(8, Math.min(top, cH - pH - 8));

    setPos({ left, top });
  }, [target, containerRect]);

  // ── Transform slider state ──
  const dragStartRef = useRef<Transform | null>(null);
  const [animKey, setAnimKey] = useState<ParamKey | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const stopDemo = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setAnimKey(null);
    useAnimationStore.getState().setIsAnimating(false);
  }, []);

  useEffect(() => () => { stopDemo(); }, [stopDemo]);

  // ── Named-param slider state ──
  const paramSnapRef = useRef<FunctionParam[] | null>(null);

  if (!fn) return null;

  const fnId = fn.id;
  const { transform, namedParams } = fn;
  const template = fn.templateId ? getTemplate(fn.templateId) : null;
  const hasNamedParams = namedParams.length > 0;
  const isStandard = fn.mode === 'standard';

  // ── Transform handlers ─────────────────────────────────────────────────
  const handleTChange = (key: ParamKey, spec: TSpec, raw: number) => {
    if (!dragStartRef.current) dragStartRef.current = { ...transform };
    const v = spec.skipZ ? skipZero(raw, transform[key] as number) : raw;
    useFunctionStore.getState().updateFunction(fnId, { transform: { ...transform, [key]: v } });
  };

  const handleTCommit = (key: ParamKey, raw: number, spec: TSpec) => {
    const before = dragStartRef.current ?? transform;
    dragStartRef.current = null;
    const v = spec.skipZ ? skipZero(raw, before[key] as number) : raw;
    if (before[key] === v) return;
    editorInstance?.execute(
      new UpdateFunctionParamCommand(fnId,
        { transform: { ...before } },
        { transform: { ...transform, [key]: v } },
        `调整 ${key}`,
      ),
    );
  };

  const handleTReset = () => {
    stopDemo();
    editorInstance?.execute(
      new UpdateFunctionParamCommand(fnId,
        { transform: { ...transform } },
        { transform: { ...DEFAULT_TRANSFORM } },
        '重置变换参数',
      ),
    );
  };

  const handleDemo = (spec: TSpec) => {
    if (animKey === spec.key) { stopDemo(); return; }
    cancelRef.current?.();
    const captured = { ...transform };
    setAnimKey(spec.key);
    useAnimationStore.getState().setIsAnimating(true);
    cancelRef.current = startAnimation({
      from: transform[spec.key] as number,
      to: spec.demoTo,
      duration: 800,
      easing: easeInOut,
      onFrame: (v) => {
        const latest = useFunctionStore.getState().functions.find((f) => f.id === fnId);
        if (!latest) return;
        useFunctionStore.getState().updateFunction(fnId, { transform: { ...latest.transform, [spec.key]: v } });
      },
      onComplete: () => {
        editorInstance?.execute(
          new UpdateFunctionParamCommand(fnId,
            { transform: captured },
            { transform: { ...captured, [spec.key]: spec.demoTo } },
            `演示 ${spec.key} 动画`,
          ),
        );
        setAnimKey(null);
        useAnimationStore.getState().setIsAnimating(false);
        cancelRef.current = null;
      },
    });
  };

  // ── Named-param handlers ───────────────────────────────────────────────
  const buildParamUpdate = (name: string, value: number) => {
    const newParams = namedParams.map((p) => p.name === name ? { ...p, value } : p);
    if (fn.templateId) {
      const expr = buildTemplateExpr(fn.templateId, newParams);
      return { namedParams: newParams, ...(expr !== null ? { exprStr: expr } : {}) };
    }
    return { namedParams: newParams };
  };

  const handlePChange = (name: string, value: number) => {
    if (!paramSnapRef.current) paramSnapRef.current = namedParams.map((p) => ({ ...p }));
    useFunctionStore.getState().updateFunction(fnId, buildParamUpdate(name, value));
  };

  const handlePCommit = (name: string, value: number) => {
    const before = paramSnapRef.current ?? namedParams.map((p) => ({ ...p }));
    paramSnapRef.current = null;
    const bp = before.find((p) => p.name === name);
    if (bp?.value === value) return;
    const beforeExpr = fn.templateId ? buildTemplateExpr(fn.templateId, before) : null;
    editorInstance?.execute(
      new UpdateFunctionParamCommand(fnId,
        { namedParams: before, ...(beforeExpr !== null ? { exprStr: beforeExpr } : {}) },
        buildParamUpdate(name, value),
        `调整参数 ${name}`,
      ),
    );
  };

  // ── Pin handler ────────────────────────────────────────────────────────
  const handlePin = () => {
    if (target.mathX != null && target.mathY != null) {
      useInteractionStore.getState().togglePinnedPoint({
        mathX: target.mathX,
        mathY: target.mathY,
        functionId: target.functionId,
      });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const isAnim = animKey !== null || isGlobalAnim;

  return (
    <div
      ref={panelRef}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: pos.left,
        top: pos.top,
        width: PANEL_W,
        zIndex: 50,
        background: P.bg,
        border: `1px solid ${P.border}`,
        borderRadius: '14px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: 'inspectorIn 0.15s ease-out',
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px',
        borderBottom: `1px solid ${P.border}`,
      }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: COLORS.primary, flexShrink: 0,
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: P.text }}>
              {fn.label}
            </span>
            {template && (
              <span style={{
                fontSize: '9px', padding: '1px 5px', borderRadius: '9999px',
                background: `${COLORS.primary}15`, color: P.accent,
                border: `1px solid ${COLORS.primary}40`,
              }}>
                {template.label}
              </span>
            )}
          </div>
          <p style={{
            fontSize: '10px', fontFamily: 'monospace', color: P.textDim,
            margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            = {buildReadableExpr(fn.exprStr)}
          </p>
        </div>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div style={{ padding: '8px 12px 10px', maxHeight: '320px', overflowY: 'auto' }}>

        {/* Named params (if any) */}
        {hasNamedParams && (
          <Section title="函数参数">
            {namedParams.map((p) => {
              const spec = template?.defaultParams.find((d) => d.name === p.name);
              return (
                <CompactSlider
                  key={p.name}
                  label={p.label}
                  value={p.value}
                  min={spec?.min ?? -10}
                  max={spec?.max ?? 10}
                  step={spec?.step ?? 0.1}
                  disabled={isAnim}
                  onChange={(v) => handlePChange(p.name, v)}
                  onCommit={(v) => handlePCommit(p.name, v)}
                />
              );
            })}
          </Section>
        )}

        {/* Transform sliders */}
        {isStandard && (
          <Section title="变换 y = a·f(b(x−h))+k">
            {T_SPECS.map((spec) => (
              <CompactSlider
                key={spec.key}
                label={spec.label}
                value={transform[spec.key] as number}
                min={spec.min}
                max={spec.max}
                step={0.1}
                disabled={isAnim}
                onChange={(v) => handleTChange(spec.key, spec, v)}
                onCommit={(v) => handleTCommit(spec.key, v, spec)}
                demoActive={animKey === spec.key}
                onDemo={() => handleDemo(spec)}
              />
            ))}
            <button onClick={handleTReset} style={actionBtnStyle}>
              重置变换
            </button>
          </Section>
        )}

        {/* Actions row */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          {target.mathX != null && (
            <button onClick={handlePin} style={actionBtnStyle}>
              📌 取点
            </button>
          )}
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes inspectorIn {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <p style={{
        fontSize: '10px', fontWeight: 600, color: P.textDim, margin: '0 0 4px',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function CompactSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  onCommit,
  demoActive,
  onDemo,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  demoActive?: boolean;
  onDemo?: () => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: onDemo ? '16px 1fr 42px 22px' : '16px 1fr 42px',
      alignItems: 'center',
      gap: '4px',
      marginBottom: '5px',
    }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: P.accent, fontFamily: 'monospace' }}>
        {label}
      </span>
      <Slider
        min={min} max={max} step={step}
        value={[Math.max(min, Math.min(max, value))]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={([v]) => onCommit(v)}
      />
      <span style={{
        fontSize: '10px', fontFamily: 'monospace', color: P.text,
        textAlign: 'right', userSelect: 'none',
      }}>
        {value.toFixed(1)}
      </span>
      {onDemo && (
        <button
          onClick={onDemo}
          title={demoActive ? '停止' : '演示'}
          style={{
            width: 20, height: 20, borderRadius: '8px', fontSize: '9px',
            border: `1px solid ${demoActive ? P.accent : P.border}`,
            background: demoActive ? P.accentDim : 'transparent',
            color: demoActive ? P.accent : P.textDim,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {demoActive ? '■' : '▶'}
        </button>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const closeBtnStyle: React.CSSProperties = {
  width: 22, height: 22, borderRadius: '8px',
  background: 'transparent', border: 'none',
  color: COLORS.neutral, fontSize: '12px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const actionBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 0',
  fontSize: '11px',
  borderRadius: '8px',
  border: `1px solid ${P.border}`,
  background: P.surface,
  color: P.textDim,
  cursor: 'pointer',
};
