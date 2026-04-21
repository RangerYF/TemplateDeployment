import { useRef, useEffect, useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { startAnimation, easeInOut } from '@/engine/animationEngine';
import type { Transform } from '@/types';
import { DEFAULT_TRANSFORM } from '@/types';
import { COLORS } from '@/styles/colors';
import { btnHover, focusRing } from '@/styles/interactionStyles';

// ─── Zero-skip helper ────────────────────────────────────────────────────────

function skipZero(newValue: number, prevValue: number): number {
  if (newValue === 0 || Math.abs(newValue) < 0.05) {
    return prevValue > 0 ? -0.1 : 0.1;
  }
  return newValue;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ParamKey = keyof Transform;

interface ParamSpec {
  key:    ParamKey;
  label:  string;
  min:    number;
  max:    number;
  skipZ:  boolean;
  demoTo: number;   // demo animation target value
  hint?:  string;   // optional explanatory text shown below the slider row
}

const PARAMS: ParamSpec[] = [
  { key: 'a', label: 'a', min: -20,  max: 20,  skipZ: true,  demoTo: 2.0 },
  { key: 'b', label: 'b', min: -20,  max: 20,  skipZ: true,  demoTo: 2.0 },
  { key: 'h', label: 'h', min: -100, max: 100, skipZ: false, demoTo: 3.0,
    hint: 'f(x−h)：h>0 右移，h<0 左移' },
  { key: 'k', label: 'k', min: -100, max: 100, skipZ: false, demoTo: 2.0 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function TransformPanel() {
  const activeFunctionId  = useFunctionStore((s) => s.activeFunctionId);
  const functions         = useFunctionStore((s) => s.functions);
  const isGlobalAnimating = useAnimationStore((s) => s.isAnyAnimating);

  const activeFunction = functions.find((f) => f.id === activeFunctionId) ?? null;

  // Snapshot of transform at start of each manual drag (for Undo "before")
  const dragStartRef = useRef<Transform | null>(null);

  // Demo animation state — which param is currently being animated
  const [animatingParam, setAnimatingParam] = useState<ParamKey | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // ── Stable stop-demo helper ───────────────────────────────────────────
  const stopDemo = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setAnimatingParam(null);
    useAnimationStore.getState().setIsAnimating(false);
  }, []);

  // Cancel on unmount
  useEffect(() => () => { stopDemo(); }, [stopDemo]);

  // Cancel when the active function changes
  useEffect(() => { stopDemo(); }, [activeFunctionId, stopDemo]);

  // Draft strings for the number inputs (one per param key)
  const [drafts, setDrafts] = useState<Partial<Record<ParamKey, string>>>({});

  // Sync drafts when active function changes or after Undo/Redo/animation
  const tA = activeFunction?.mode === 'standard' ? activeFunction.transform.a : null;
  const tB = activeFunction?.mode === 'standard' ? activeFunction.transform.b : null;
  const tH = activeFunction?.mode === 'standard' ? activeFunction.transform.h : null;
  const tK = activeFunction?.mode === 'standard' ? activeFunction.transform.k : null;
  useEffect(() => {
    if (tA === null) { setDrafts({}); return; }
    // Only sync if the user isn't mid-drag (dragStartRef is null)
    if (dragStartRef.current === null) {
      setDrafts({ a: String(tA), b: String(tB), h: String(tH), k: String(tK) });
    }
  }, [activeFunctionId, tA, tB, tH, tK]);

  if (!activeFunction || activeFunction.mode !== 'standard') {
    return null;
  }

  const { transform } = activeFunction;
  const fnId = activeFunction.id;

  // ── Manual slider drag ────────────────────────────────────────────────
  const handleChange = (key: ParamKey, spec: ParamSpec, rawValue: number) => {
    if (dragStartRef.current === null) {
      dragStartRef.current = { ...transform };
    }
    const prev  = transform[key] as number;
    const value = spec.skipZ ? skipZero(rawValue, prev) : rawValue;
    useFunctionStore.getState().updateFunction(fnId, {
      transform: { ...transform, [key]: value },
    });
  };

  const handleCommit = (key: ParamKey, rawValue: number, spec: ParamSpec) => {
    const before = dragStartRef.current ?? transform;
    dragStartRef.current = null;
    const prev  = before[key] as number;
    const value = spec.skipZ ? skipZero(rawValue, prev) : rawValue;
    if (before[key] === value) return;
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        fnId,
        { transform: { ...before } },
        { transform: { ...transform, [key]: value } },
        `调整 ${key} (${(before[key] as number).toFixed(1)} → ${value.toFixed(1)})`,
      ),
    );
  };

  // ── Reset transform ───────────────────────────────────────────────────
  const handleReset = () => {
    stopDemo();
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        fnId,
        { transform: { ...transform } },
        { transform: { ...DEFAULT_TRANSFORM } },
        '重置变换参数',
      ),
    );
  };

  // ── Input handlers (direct value entry for out-of-slider-range values) ─
  const handleInputChange = (key: ParamKey, raw: string) => {
    setDrafts((d) => ({ ...d, [key]: raw }));
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const spec = PARAMS.find((p) => p.key === key)!;
      const value = spec.skipZ ? skipZero(parsed, transform[key] as number) : parsed;
      useFunctionStore.getState().updateFunction(fnId, { transform: { ...transform, [key]: value } });
    }
  };

  const handleInputCommit = (key: ParamKey) => {
    const raw = drafts[key] ?? '';
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) {
      // Revert to current store value
      setDrafts((d) => ({ ...d, [key]: String(transform[key]) }));
      return;
    }
    const spec = PARAMS.find((p) => p.key === key)!;
    const value = spec.skipZ ? skipZero(parsed, transform[key] as number) : parsed;
    if ((transform[key] as number) === value) return;
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        fnId,
        { transform: { ...transform } },
        { transform: { ...transform, [key]: value } },
        `调整 ${key} → ${value.toFixed(2)}`,
      ),
    );
    setDrafts((d) => ({ ...d, [key]: String(value) }));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, key: ParamKey) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    else if (e.key === 'Escape') {
      setDrafts((d) => ({ ...d, [key]: String(transform[key]) }));
      (e.target as HTMLInputElement).blur();
    }
  };

  // ── Per-param demo animation ──────────────────────────────────────────
  const handleDemo = (spec: ParamSpec) => {
    const key = spec.key;

    // Toggle off if already animating this param
    if (animatingParam === key) {
      stopDemo();
      return;
    }

    // Stop any other running animation first
    cancelRef.current?.();
    cancelRef.current = null;

    const capturedTransform = { ...transform };
    const fromValue = transform[key] as number;
    const toValue   = spec.demoTo;

    setAnimatingParam(key);
    useAnimationStore.getState().setIsAnimating(true);

    cancelRef.current = startAnimation({
      from:     fromValue,
      to:       toValue,
      duration: 800,
      easing:   easeInOut,
      onFrame: (value) => {
        const latest = useFunctionStore.getState().functions.find((f) => f.id === fnId);
        if (!latest) return;
        useFunctionStore.getState().updateFunction(fnId, {
          transform: { ...latest.transform, [key]: value },
        });
      },
      onComplete: () => {
        editorInstance?.execute(
          new UpdateFunctionParamCommand(
            fnId,
            { transform: capturedTransform },
            { transform: { ...capturedTransform, [key]: toValue } },
            `演示 ${key} 动画`,
          ),
        );
        setAnimatingParam(null);
        useAnimationStore.getState().setIsAnimating(false);
        cancelRef.current = null;
      },
    });
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Header */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 4px' }}>
        全局变换
      </p>
      <p style={{ fontSize: '11px', color: COLORS.textSecondary, margin: '0 0 10px', fontFamily: 'monospace' }}>
        y ={' '}
        <span style={{ color: transform.a !== 1 ? COLORS.primary : COLORS.textSecondary, fontWeight: transform.a !== 1 ? 600 : 400 }}>a</span>
        {' · f('}
        <span style={{ color: transform.b !== 1 ? COLORS.primary : COLORS.textSecondary, fontWeight: transform.b !== 1 ? 600 : 400 }}>b</span>
        {'(x − '}
        <span style={{ color: transform.h !== 0 ? COLORS.primary : COLORS.textSecondary, fontWeight: transform.h !== 0 ? 600 : 400 }}>h</span>
        {')) + '}
        <span style={{ color: transform.k !== 0 ? COLORS.primary : COLORS.textSecondary, fontWeight: transform.k !== 0 ? 600 : 400 }}>k</span>
      </p>

      {/* Slider rows */}
      {PARAMS.map((spec) => {
        const value      = transform[spec.key] as number;
        const isAnim     = animatingParam === spec.key || isGlobalAnimating;

        return (
          <div key={spec.key} style={{ marginBottom: spec.hint ? '4px' : '10px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '18px 1fr 72px 26px',
              alignItems: 'center',
              gap: '6px',
            }}>
              {/* Param label */}
              <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.primary, fontFamily: 'monospace' }}>
                {spec.label}
              </span>

              {/* Slider */}
              <Slider
                min={spec.min}
                max={spec.max}
                step={0.1}
                value={[Math.max(spec.min, Math.min(spec.max, value))]}
                disabled={isAnim}
                onValueChange={([v]) => { handleChange(spec.key, spec, v); setDrafts((d) => ({ ...d, [spec.key]: String(v) })); }}
                onValueCommit={([v]) => handleCommit(spec.key, v, spec)}
              />

              {/* Inline number input (allows out-of-slider-range values) */}
              <input
                type="text"
                inputMode="decimal"
                disabled={isAnim}
                value={drafts[spec.key] ?? String(value)}
                onChange={(e) => handleInputChange(spec.key, e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, spec.key)}
                style={{
                  width: '100%',
                  minWidth: 0,   // prevent form-element intrinsic min-width from expanding grid cell
                  padding: '2px 5px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: COLORS.textSecondary,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '10px',
                  textAlign: 'right',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                {...focusRing(undefined, undefined, undefined, { onBlur: () => handleInputCommit(spec.key) })}
              />

              {/* Demo button */}
              <button
                onClick={() => handleDemo(spec)}
                title={isAnim ? '停止演示' : `演示 ${spec.key} 动画`}
                style={{
                  background: isAnim ? COLORS.primary : COLORS.surfaceAlt,
                  border:     `1px solid ${isAnim ? COLORS.primaryHover : COLORS.border}`,
                  borderRadius: '8px',
                  color:      isAnim ? COLORS.dark : COLORS.textSecondary,
                  cursor:     'pointer',
                  fontSize:   '10px',
                  padding:    '2px 4px',
                  lineHeight: '1.4',
                  flexShrink: 0,
                  transition: 'background 0.12s',
                }}
                {...btnHover(
                  isAnim ? COLORS.primaryHover : COLORS.surfaceLight,
                  isAnim ? COLORS.primary : COLORS.surfaceAlt,
                )}
              >
                {isAnim ? '■' : '▶'}
              </button>
            </div>

            {/* Hint text (h param only) */}
            {spec.hint && (
              <p style={{
                fontSize: '10px',
                color: COLORS.neutral,
                margin: '2px 0 8px 24px',
                fontFamily: 'monospace',
              }}>
                {spec.hint}
              </p>
            )}
          </div>
        );
      })}

      {/* Reset button */}
      <button
        onClick={handleReset}
        style={{
          width: '100%',
          marginTop: '4px',
          padding: '5px',
          fontSize: '12px',
          borderRadius: '8px',
          border: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          color: COLORS.textSecondary,
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        {...btnHover(COLORS.surfaceAlt, COLORS.surface)}
      >
        重置变换
      </button>
    </div>
  );
}
