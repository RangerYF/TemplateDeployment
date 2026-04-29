import { useRef, useCallback } from 'react';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import type { PiecewiseSegment } from '@/types';
import { COLORS } from '@/styles/colors';
import { pillHover, focusRing, dangerHover, btnHover } from '@/styles/interactionStyles';
import { createId } from '@/lib/id';

// ─── Overlap detection ───────────────────────────────────────────────────────

/** Returns true if two segments' domains have a non-empty overlap. */
function doOverlap(a: PiecewiseSegment, b: PiecewiseSegment): boolean {
  const aMin = a.domain.xMin ?? -Infinity;
  const aMax = a.domain.xMax ??  Infinity;
  const bMin = b.domain.xMin ?? -Infinity;
  const bMax = b.domain.xMax ??  Infinity;

  // They don't overlap if one ends before the other starts
  if (aMax < bMin || bMax < aMin) return false;
  // Equal-boundary case: only overlap if both are inclusive at that point
  if (aMax === bMin) return a.domain.xMaxInclusive && b.domain.xMinInclusive;
  if (bMax === aMin) return b.domain.xMaxInclusive && a.domain.xMinInclusive;
  return true;
}

/** Returns a Set of segment IDs that overlap with at least one other segment. */
function overlappingIds(segments: PiecewiseSegment[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (doOverlap(segments[i], segments[j])) {
        result.add(segments[i].id);
        result.add(segments[j].id);
      }
    }
  }
  return result;
}

// ─── Infinity helpers ────────────────────────────────────────────────────────

function displayBound(v: number | null): string {
  if (v === null) return '';
  return String(v);
}

function parseBound(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (t === '' || t === 'inf' || t === '+inf' || t === 'infinity') return null;
  if (t === '-inf' || t === '-infinity') return null;
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
}

// ─── Default new segment ─────────────────────────────────────────────────────

function makeDefaultSegment(): PiecewiseSegment {
  return {
    id: createId(),
    exprStr: 'x',
    domain: { xMin: 0, xMax: 1, xMinInclusive: true, xMaxInclusive: false },
  };
}

// ─── Quick-insert symbols (shared with FunctionInputPanel) ───────────────────

const QUICK_SYMBOLS: { label: string; insert: string; cursorBack?: number }[] = [
  { label: 'sin',  insert: 'sin()',  cursorBack: 1 },
  { label: 'cos',  insert: 'cos()',  cursorBack: 1 },
  { label: 'tan',  insert: 'tan()',  cursorBack: 1 },
  { label: 'sqrt', insert: 'sqrt()', cursorBack: 1 },
  { label: 'abs',  insert: 'abs()',  cursorBack: 1 },
  { label: 'π',    insert: 'pi' },
  { label: 'x²',   insert: 'x^2' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function PiecewisePanel() {
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const fn = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId),
  );

  // Snapshot segments at the moment a field is first edited (for Undo "before")
  const segSnapRef = useRef<PiecewiseSegment[] | null>(null);

  // Per-segment expression input refs for quick-insert cursor control
  const exprInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const setExprRef = useCallback(
    (segId: string) => (el: HTMLInputElement | null) => {
      if (el) exprInputRefs.current.set(segId, el);
      else exprInputRefs.current.delete(segId);
    },
    [],
  );

  const handleQuickInsert = (
    e: React.MouseEvent,
    segId: string,
    segExpr: string,
    text: string,
    cursorBack = 0,
  ) => {
    e.preventDefault(); // keep focus on the input
    const input = exprInputRefs.current.get(segId);
    const start = input?.selectionStart ?? segExpr.length;
    const end   = input?.selectionEnd   ?? segExpr.length;
    const newValue = segExpr.slice(0, start) + text + segExpr.slice(end);
    handleExprChange(segId, newValue);
    const cursorPos = start + text.length - cursorBack;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  if (!fn || fn.mode !== 'piecewise') return null;

  const { segments } = fn;
  const overlaps = overlappingIds(segments);

  const captureSnapshot = () => {
    if (segSnapRef.current === null) {
      segSnapRef.current = fn.segments.map((s) => ({ ...s, domain: { ...s.domain } }));
    }
  };

  const commitCommand = (label: string) => {
    if (!activeFunctionId || segSnapRef.current === null) return;
    const before = { segments: segSnapRef.current };
    const after  = { segments: useFunctionStore.getState().functions.find((f) => f.id === activeFunctionId)?.segments ?? [] };
    editorInstance?.execute(new UpdateFunctionParamCommand(activeFunctionId, before, after, label));
    segSnapRef.current = null;
  };

  // ── Add / remove ──────────────────────────────────────────────────────────

  const handleAdd = () => {
    if (!activeFunctionId) return;
    const before = { segments: fn.segments.map((s) => ({ ...s, domain: { ...s.domain } })) };
    const newSeg = makeDefaultSegment();
    useFunctionStore.getState().addSegment(activeFunctionId, newSeg);
    const after = { segments: [...fn.segments, newSeg] };
    editorInstance?.execute(new UpdateFunctionParamCommand(activeFunctionId, before, after, '添加分段'));
  };

  const handleRemove = (segId: string) => {
    if (!activeFunctionId) return;
    const before = { segments: fn.segments.map((s) => ({ ...s, domain: { ...s.domain } })) };
    useFunctionStore.getState().removeSegment(activeFunctionId, segId);
    const after = { segments: fn.segments.filter((s) => s.id !== segId) };
    editorInstance?.execute(new UpdateFunctionParamCommand(activeFunctionId, before, after, '删除分段'));
  };

  // ── Expression change ─────────────────────────────────────────────────────

  const handleExprChange = (segId: string, value: string) => {
    if (!activeFunctionId) return;
    captureSnapshot();
    useFunctionStore.getState().updateSegment(activeFunctionId, segId, { exprStr: value });
  };

  const handleExprCommit = (segId: string) => {
    void segId;
    commitCommand('修改分段表达式');
  };

  // ── Domain bound change ───────────────────────────────────────────────────

  const handleBoundChange = (
    segId: string,
    side: 'xMin' | 'xMax',
    raw: string,
  ) => {
    if (!activeFunctionId) return;
    captureSnapshot();
    const val = parseBound(raw);
    useFunctionStore.getState().updateSegment(activeFunctionId, segId, {
      domain: {
        ...fn.segments.find((s) => s.id === segId)!.domain,
        [side]: val,
      },
    });
  };

  const handleBoundCommit = () => {
    commitCommand('修改分段区间');
  };

  const handleInclusiveChange = (
    segId: string,
    side: 'xMinInclusive' | 'xMaxInclusive',
    checked: boolean,
  ) => {
    if (!activeFunctionId) return;
    const before = { segments: fn.segments.map((s) => ({ ...s, domain: { ...s.domain } })) };
    useFunctionStore.getState().updateSegment(activeFunctionId, segId, {
      domain: {
        ...fn.segments.find((s) => s.id === segId)!.domain,
        [side]: checked,
      },
    });
    const after = { segments: useFunctionStore.getState().functions.find((f) => f.id === activeFunctionId)?.segments ?? [] };
    editorInstance?.execute(new UpdateFunctionParamCommand(activeFunctionId, before, after, '修改端点条件'));
  };

  return (
    <div style={{ fontSize: '13px', color: COLORS.textPrimary }}>
      <div style={{
        fontWeight: 600,
        marginBottom: '10px',
        color: COLORS.textSecondary,
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        分段函数编辑器
      </div>

      {segments.map((seg, idx) => {
        const hasOverlap = overlaps.has(seg.id);
        return (
          <div
            key={seg.id}
            style={{
              marginBottom: '12px',
              padding: '8px',
              background: COLORS.dark,
              borderRadius: '12px',
              borderLeft: hasOverlap ? `3px solid ${COLORS.warning}` : '3px solid transparent',
            }}
            title={hasOverlap ? '定义域与其他分段重叠' : undefined}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ flex: 1, fontSize: '11px', color: COLORS.textSecondary }}>
                第 {idx + 1} 段
              </span>
              <button
                onClick={() => handleRemove(seg.id)}
                style={{ ...removeBtnStyle, transition: 'background 0.12s, color 0.12s' }}
                title="删除此段"
                {...dangerHover(COLORS.neutral)}
              >
                ×
              </button>
            </div>

            {/* Expression */}
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: COLORS.textSecondary, marginRight: '4px' }}>
                f(x) =
              </span>
              <input
                ref={setExprRef(seg.id)}
                type="text"
                value={seg.exprStr}
                onChange={(e) => handleExprChange(seg.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleExprCommit(seg.id); }}
                style={{ ...inputStyle, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                {...focusRing(undefined, undefined, undefined, { onBlur: () => handleExprCommit(seg.id) })}
              />
              {/* Quick-insert symbol buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                {QUICK_SYMBOLS.map(({ label, insert, cursorBack }) => (
                  <button
                    key={label}
                    onMouseDown={(e) => handleQuickInsert(e, seg.id, seg.exprStr, insert, cursorBack)}
                    style={{ ...quickBtnStyle, transition: 'background 0.12s, color 0.12s, border-color 0.12s' }}
                    {...pillHover(COLORS.surfaceAlt, COLORS.textSecondary, COLORS.border)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Domain bounds */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '12px' }}>
              <input
                type="text"
                value={displayBound(seg.domain.xMin)}
                placeholder="-∞"
                onChange={(e) => handleBoundChange(seg.id, 'xMin', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBoundCommit(); }}
                style={{ ...inputStyle, width: '52px', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                {...focusRing(undefined, undefined, undefined, { onBlur: handleBoundCommit })}
              />
              <span style={{ color: COLORS.textSecondary }}>≤ x</span>
              <span style={{ color: COLORS.textSecondary }}>
                {seg.domain.xMaxInclusive ? '≤' : '<'}
              </span>
              <input
                type="text"
                value={displayBound(seg.domain.xMax)}
                placeholder="+∞"
                onChange={(e) => handleBoundChange(seg.id, 'xMax', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleBoundCommit(); }}
                style={{ ...inputStyle, width: '52px', textAlign: 'center', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                {...focusRing(undefined, undefined, undefined, { onBlur: handleBoundCommit })}
              />
            </div>

            {/* Inclusive checkboxes */}
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: COLORS.textSecondary }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={seg.domain.xMinInclusive}
                  onChange={(e) => handleInclusiveChange(seg.id, 'xMinInclusive', e.target.checked)}
                  style={{ accentColor: COLORS.primary }}
                />
                包含左端点
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={seg.domain.xMaxInclusive}
                  onChange={(e) => handleInclusiveChange(seg.id, 'xMaxInclusive', e.target.checked)}
                  style={{ accentColor: COLORS.primary }}
                />
                包含右端点
              </label>
            </div>
          </div>
        );
      })}

      {/* Add segment button */}
      <button onClick={handleAdd} style={{ ...addBtnStyle, transition: 'background 0.12s' }} {...btnHover(COLORS.surfaceHover)}>
        + 添加分段
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '10px',
  color: COLORS.textPrimary,
  padding: '3px 6px',
  fontSize: '12px',
  fontFamily: 'monospace',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: COLORS.neutral,
  cursor: 'pointer',
  fontSize: '16px',
  lineHeight: 1,
  padding: '0 2px',
};

const addBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px',
  fontSize: '12px',
  background: 'none',
  border: `1px dashed ${COLORS.border}`,
  borderRadius: '8px',
  color: COLORS.textSecondary,
  cursor: 'pointer',
};

const quickBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: '11px',
  borderRadius: '9999px',
  border: `1px solid ${COLORS.border}`,
  background: COLORS.surfaceAlt,
  color: COLORS.textSecondary,
  cursor: 'pointer',
  fontFamily: 'monospace',
};
