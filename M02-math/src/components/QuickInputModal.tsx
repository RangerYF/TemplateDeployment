/**
 * QuickInputModal — Unified modal for creating both standard and piecewise functions.
 *
 * Flow: choose type → enter expression(s) → confirm → function created, set active, modal closes.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { compileExpression, isParseError } from '@/engine/expressionEngine';
import { detectAndMergeCoefficients } from '@/engine/coefficientDetector';
import { getKnownFunctionNames } from '@/engine/compositionEngine';
import { useFunctionStore } from '@/editor/store/functionStore';
import { executeM02Command } from '@/editor/commands/m02Execute';
import { AddFunctionCommand } from '@/editor/commands/AddFunctionCommand';
import { FUNCTION_COLORS, DEFAULT_TRANSFORM } from '@/types';
import type { FunctionEntry, PiecewiseSegment } from '@/types';
import { COLORS } from '@/styles/colors';
import { createId } from '@/lib/id';

// ─── Quick-insert buttons ────────────────────────────────────────────────────

const QUICK_SYMBOLS: { label: string; insert: string; cursorBack?: number }[] = [
  { label: 'sin',  insert: 'sin()',  cursorBack: 1 },
  { label: 'cos',  insert: 'cos()',  cursorBack: 1 },
  { label: 'tan',  insert: 'tan()',  cursorBack: 1 },
  { label: 'sqrt', insert: 'sqrt()', cursorBack: 1 },
  { label: 'abs',  insert: 'abs()',  cursorBack: 1 },
  { label: 'log',  insert: 'log()',  cursorBack: 1 },
  { label: 'x',    insert: 'x' },
  { label: 'π',    insert: 'pi' },
  { label: 'e',    insert: 'e' },
  { label: 'x²',   insert: 'x^2' },
  { label: 'x³',   insert: 'x^3' },
];

const LABELS = ['f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)', 'r(x)', 's(x)', 't(x)'];

type FnMode = 'standard' | 'piecewise';

// ─── Piecewise segment draft ─────────────────────────────────────────────────

interface SegmentDraft {
  id: string;
  exprStr: string;
  xMin: string;
  xMax: string;
  xMinInclusive: boolean;
  xMaxInclusive: boolean;
}

function makeSegmentDraft(): SegmentDraft {
  return {
    id: createId(),
    exprStr: '',
    xMin: '',
    xMax: '',
    xMinInclusive: true,
    xMaxInclusive: false,
  };
}

function parseBound(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (t === '' || t === 'inf' || t === '+inf' || t === '-inf') return null;
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

function segmentDraftToEntry(d: SegmentDraft): PiecewiseSegment {
  return {
    id: d.id,
    exprStr: d.exprStr || 'x',
    domain: {
      xMin: parseBound(d.xMin),
      xMax: parseBound(d.xMax),
      xMinInclusive: d.xMinInclusive,
      xMaxInclusive: d.xMaxInclusive,
    },
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickInputModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode]             = useState<FnMode>('standard');
  const [draft, setDraft]           = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [segments, setSegments]     = useState<SegmentDraft[]>([makeSegmentDraft()]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Compute label + color for new function
  const count = useFunctionStore((s) => s.functions.length);
  const nextLabel = LABELS[count] ?? `f${count}(x)`;
  const nextColor = FUNCTION_COLORS[count % FUNCTION_COLORS.length] as string;

  // ── Live validation (standard mode) ──
  const validate = useCallback((value: string) => {
    if (!value.trim()) { setParseError(null); return; }
    const fns = useFunctionStore.getState().functions;
    const knownFns = getKnownFunctionNames(fns);
    const compiled = compileExpression(value, knownFns);
    if (isParseError(compiled)) {
      setParseError(compiled.error);
    } else {
      setParseError(null);
    }
  }, []);

  const handleChange = (value: string) => {
    setDraft(value);
    validate(value);
  };

  // ── Confirm: create function + set active ──
  const handleConfirm = useCallback(() => {
    console.log('[QuickInputModal] handleConfirm called, mode=', mode, 'draft=', draft);
    if (mode === 'standard') {
      const expr = draft.trim();
      if (!expr) return;

      const fns = useFunctionStore.getState().functions;
      const knownFns = getKnownFunctionNames(fns);
      const compiled = compileExpression(expr, knownFns);
      if (isParseError(compiled)) {
        setParseError(compiled.error);
        inputRef.current?.focus();
        return;
      }

      const mergedParams = detectAndMergeCoefficients(expr, []) ?? [];

      const entry: FunctionEntry = {
        id:          createId(),
        label:       nextLabel,
        mode:        'standard',
        exprStr:     expr,
        segments:    [],
        color:       nextColor,
        visible:     true,
        transform:   { ...DEFAULT_TRANSFORM },
        templateId:  null,
        namedParams: mergedParams,
      };

      console.log('[QuickInputModal] executing add command for', entry.label, entry.exprStr);
      executeM02Command(new AddFunctionCommand(entry));
      useFunctionStore.getState().setActiveFunctionId(entry.id);
      console.log('[QuickInputModal] store functions after add:', useFunctionStore.getState().functions.length);
    } else {
      // Piecewise: validate at least one non-empty segment
      const validSegments = segments.filter((s) => s.exprStr.trim());
      if (validSegments.length === 0) return;

      const entrySegments = validSegments.map(segmentDraftToEntry);

      const entry: FunctionEntry = {
        id:          createId(),
        label:       nextLabel,
        mode:        'piecewise',
        exprStr:     entrySegments[0].exprStr,
        segments:    entrySegments,
        color:       nextColor,
        visible:     true,
        transform:   { ...DEFAULT_TRANSFORM },
        templateId:  null,
        namedParams: [],
      };

      executeM02Command(new AddFunctionCommand(entry));
      useFunctionStore.getState().setActiveFunctionId(entry.id);
    }
    onClose();
  }, [mode, draft, segments, nextLabel, nextColor, onClose]);

  // ── Key handling ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    if (e.key === 'Enter' && mode === 'standard') {
      e.preventDefault();
      handleConfirm();
    }
  };

  // ── Quick symbol insertion (standard mode) ──
  const handleInsert = (e: React.MouseEvent, text: string, cursorBack = 0) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? draft.length;
    const end   = input.selectionEnd   ?? draft.length;
    const newVal = draft.slice(0, start) + text + draft.slice(end);
    handleChange(newVal);
    const pos = start + text.length - cursorBack;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  };

  // ── Piecewise segment handlers ──
  const updateSegment = (id: string, patch: Partial<SegmentDraft>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const addSegment = () => {
    setSegments((prev) => [...prev, makeSegmentDraft()]);
  };
  const removeSegment = (id: string) => {
    setSegments((prev) => prev.length <= 1 ? prev : prev.filter((s) => s.id !== id));
  };

  const isValid = parseError === null;
  const canConfirmStandard = draft.trim().length > 0 && isValid;
  const canConfirmPiecewise = segments.some((s) => s.exprStr.trim());
  const canConfirm = mode === 'standard' ? canConfirmStandard : canConfirmPiecewise;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0, 0, 0, 0.25)',
          animation: 'qimOverlayIn 0.15s ease-out',
        }}
      />

      {/* Panel — light card style */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: 440,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '18px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          animation: 'qimPanelIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: COLORS.primary,
            }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: COLORS.textPrimary }}>
              新建函数
            </span>
            <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>
              {nextLabel}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: COLORS.neutral, fontSize: '14px', cursor: 'pointer',
            width: 24, height: 24, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
          }}>
            ✕
          </button>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: '4px', padding: '0 20px 12px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setMode('standard')}
            style={modeTabStyle(mode === 'standard')}
          >
            普通函数
          </button>
          <button
            onClick={() => setMode('piecewise')}
            style={modeTabStyle(mode === 'piecewise')}
          >
            分段函数
          </button>
        </div>

        {/* Scrollable content area */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 14px' }}>
          {mode === 'standard' ? (
            /* ── Standard mode ── */
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: `1.5px solid ${isValid ? (draft ? COLORS.primary : COLORS.border) : COLORS.error}`,
                background: COLORS.surfaceAlt,
                transition: 'border-color 0.15s',
              }}>
                <span style={{
                  fontSize: '14px', fontWeight: 600, color: COLORS.textSecondary,
                  fontFamily: 'monospace', flexShrink: 0,
                }}>
                  y =
                </span>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入表达式，如 sin(x)、a*x^2+b*x+c"
                  spellCheck={false}
                  autoComplete="off"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none', outline: 'none',
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    color: isValid ? COLORS.textPrimary : COLORS.error,
                    caretColor: COLORS.primary,
                  }}
                />
                {draft && (
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>
                    {isValid
                      ? <span style={{ color: COLORS.primary }}>✓</span>
                      : <span style={{ color: COLORS.error }}>✗</span>
                    }
                  </span>
                )}
              </div>

              {parseError && (
                <p style={{
                  fontSize: '11px', color: COLORS.error,
                  margin: '6px 0 0 4px', wordBreak: 'break-word',
                }}>
                  ⚠ {parseError}
                </p>
              )}

              {/* Quick symbols */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px',
              }}>
                {QUICK_SYMBOLS.map(({ label, insert, cursorBack }) => (
                  <button
                    key={label}
                    onMouseDown={(e) => handleInsert(e, insert, cursorBack)}
                    style={quickBtnStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.primaryLight; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p style={{
                fontSize: '10px', color: COLORS.textSecondary, margin: '10px 0 0',
                lineHeight: '1.4',
              }}>
                支持自动系数检测：输入 <code style={{ color: COLORS.primary }}>a*x^2+b*x+c</code> 将自动生成 a、b、c 滑块
              </p>
            </>
          ) : (
            /* ── Piecewise mode ── */
            <>
              {segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  style={{
                    marginBottom: '10px',
                    padding: '10px',
                    background: COLORS.surfaceAlt,
                    borderRadius: '12px',
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ flex: 1, fontSize: '11px', color: COLORS.textSecondary }}>
                      第 {idx + 1} 段
                    </span>
                    {segments.length > 1 && (
                      <button
                        onClick={() => removeSegment(seg.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: COLORS.neutral, cursor: 'pointer',
                          fontSize: '14px', lineHeight: 1, padding: '0 2px',
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Expression */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    marginBottom: '6px',
                  }}>
                    <span style={{
                      fontSize: '12px', color: COLORS.textSecondary, fontFamily: 'monospace',
                      flexShrink: 0,
                    }}>
                      f(x) =
                    </span>
                    <input
                      value={seg.exprStr}
                      onChange={(e) => updateSegment(seg.id, { exprStr: e.target.value })}
                      placeholder="x^2"
                      spellCheck={false}
                      style={segInputStyle}
                    />
                  </div>

                  {/* Domain bounds */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    marginBottom: '4px', fontSize: '12px',
                  }}>
                    <input
                      value={seg.xMin}
                      onChange={(e) => updateSegment(seg.id, { xMin: e.target.value })}
                      placeholder="-∞"
                      style={{ ...segInputStyle, width: '52px', textAlign: 'center' }}
                    />
                    <span style={{ color: COLORS.textSecondary }}>
                      {seg.xMinInclusive ? '≤' : '<'} x {seg.xMaxInclusive ? '≤' : '<'}
                    </span>
                    <input
                      value={seg.xMax}
                      onChange={(e) => updateSegment(seg.id, { xMax: e.target.value })}
                      placeholder="+∞"
                      style={{ ...segInputStyle, width: '52px', textAlign: 'center' }}
                    />
                  </div>

                  {/* Inclusive toggles */}
                  <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: COLORS.textSecondary }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={seg.xMinInclusive}
                        onChange={(e) => updateSegment(seg.id, { xMinInclusive: e.target.checked })}
                        style={{ width: 12, height: 12, accentColor: COLORS.primary }}
                      />
                      含左端
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={seg.xMaxInclusive}
                        onChange={(e) => updateSegment(seg.id, { xMaxInclusive: e.target.checked })}
                        style={{ width: 12, height: 12, accentColor: COLORS.primary }}
                      />
                      含右端
                    </label>
                  </div>
                </div>
              ))}

              {/* Add segment button */}
              <button
                onClick={addSegment}
                style={{
                  width: '100%', padding: '6px', fontSize: '12px',
                  background: 'none',
                  border: `1px dashed ${COLORS.border}`,
                  borderRadius: '8px',
                  color: COLORS.textSecondary, cursor: 'pointer',
                }}
              >
                + 添加分段
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
          padding: '12px 20px 16px',
          borderTop: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}>
          <span style={{ flex: 1, fontSize: '10px', color: COLORS.textSecondary }}>
            {mode === 'standard' ? 'Enter 确认 · Esc 取消' : 'Esc 取消'}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: '12px', borderRadius: '9999px',
              border: `1px solid ${COLORS.border}`, background: 'transparent',
              color: COLORS.textSecondary, cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: '6px 16px', fontSize: '12px', fontWeight: 600,
              borderRadius: '9999px', border: 'none',
              background: canConfirm ? COLORS.primary : COLORS.border,
              color: canConfirm ? '#FFFFFF' : COLORS.neutral,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            确认创建
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes qimOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes qimPanelIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}

// ─── Shared styles ───────────────────────────────────────────────────────────

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    borderRadius: '9999px',
    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? `${COLORS.primary}15` : 'transparent',
    color: active ? COLORS.primary : COLORS.textSecondary,
    cursor: active ? 'default' : 'pointer',
    transition: 'all 0.12s',
  };
}

const quickBtnStyle: React.CSSProperties = {
  padding: '3px 8px', fontSize: '12px', fontFamily: 'monospace',
  borderRadius: '9999px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surfaceAlt,
  color: COLORS.textSecondary, cursor: 'pointer',
  transition: 'background 0.1s',
};

const segInputStyle: React.CSSProperties = {
  flex: 1,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '10px',
  color: COLORS.textPrimary,
  padding: '4px 8px',
  fontSize: '12px',
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
};
