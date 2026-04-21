/**
 * LineParamPanel — shown when the active entity is a line.
 *
 * Line creation methods:
 *   1. Equation Input  — text field parsing "y = kx + b" or "x = c"
 *   2. Two-Point       — collapsible section: enter (x₁,y₁) (x₂,y₂) → apply
 *   3. Point-Slope     — per-conic focus buttons: sets the line through
 *                        that focus while preserving the current slope k.
 *
 * Controls (sliders):
 *   k (slope), b (y-intercept), or x (vertical position).
 *
 * Intersection section:
 *   • Styled "未找到交点" notice when no intersections.
 *   • |AB| chord length with exact radical form (e.g. 5√2 ≈ 7.0711).
 *   • Focal-triangle area, latus-rectum annotation.
 *   • Circle d vs R analysis with relation badge.
 *   • Focus-snap buttons for each conic.
 *
 * Drag mode toggle:
 *   Button at top-right activates 'line-drag' tool so the user can
 *   click-and-drag the line on the canvas to translate it in real time.
 */

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Move, Crosshair } from 'lucide-react';
import { useEntityStore } from '@/editor/store/entityStore';
import { updateLineParams, updateLineNamedParams, clearLineEquation } from '@/editor/entities/line';
import { UpdateLineParamCommand } from '@/editor/commands/UpdateLineParamCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { useParamSlider } from '@/hooks/useParamSlider';
import { intersectLineConic } from '@/engine/intersectionEngine';
import { toRadicalForm } from '@/engine/radicalEngine';
import { detectLineCoefficients, resolveLineParams, formatEquationDisplay } from '@/engine/lineExpressionEngine';
import { UniversalSlider } from '@/components/shared/UniversalSlider';
import { COLORS } from '@/styles/colors';
import { btnHover, pillHover, focusRing } from '@/styles/interactionStyles';
import type { LineEntity, ConicEntity, LineParams, FunctionParam } from '@/types';
import { isConicEntity } from '@/types';

// ─── Quick-insert symbols ────────────────────────────────────────────────────
// cursorBack: 括号内光标偏移（1 = 跳入括号中间）
// 不支持隐式乘法 — 插入结果均为显式形式，如 sin() 而非 xsin(x)
const QUICK_SYMBOLS: { label: string; insert: string; cursorBack?: number }[] = [
  { label: 'sin',  insert: 'sin()',  cursorBack: 1 },
  { label: 'cos',  insert: 'cos()',  cursorBack: 1 },
  { label: 'tan',  insert: 'tan()',  cursorBack: 1 },
  { label: 'sqrt', insert: 'sqrt()', cursorBack: 1 },
  { label: 'abs',  insert: 'abs()',  cursorBack: 1 },
  { label: 'π',    insert: 'pi' },
  { label: 'x²',   insert: 'x^2' },
];

// ─── Equation parser ──────────────────────────────────────────────────────────

/**
 * Parse a user-typed equation string into LineParams overrides.
 * Accepted forms (whitespace-insensitive):
 *   x = 3          → vertical line at x=3
 *   y = 2x + 1     → slope 2, intercept 1
 *   y = -x - 0.5   → slope -1, intercept -0.5
 *   y = 3          → horizontal line (k=0, b=3)
 */
function parseLineEq(raw: string): Partial<LineParams> | null {
  const s = raw.replace(/\s+/g, '').toLowerCase().replace(/\u2212/g, '-');

  // Vertical: x = c
  const vm = s.match(/^x=([+-]?[\d.]+)$/);
  if (vm) {
    const x = parseFloat(vm[1]);
    return isNaN(x) ? null : { vertical: true, x };
  }

  if (!s.startsWith('y=')) return null;
  const rhs = s.slice(2);

  // kx (+ b)?
  const km = rhs.match(/^([+-]?[\d.]*)x([+-][\d.]+)?$/);
  if (km) {
    const kStr = km[1] ?? '';
    const bStr = km[2] ?? '';
    let k: number;
    if      (kStr === '' || kStr === '+') k = 1;
    else if (kStr === '-')                k = -1;
    else { k = parseFloat(kStr); if (isNaN(k)) return null; }
    const b = bStr ? parseFloat(bStr) : 0;
    if (isNaN(b)) return null;
    return { vertical: false, k, b };
  }

  // Constant: y = c  (no x term)
  const cm = rhs.match(/^([+-]?[\d.]+)$/);
  if (cm) {
    const b = parseFloat(cm[1]);
    return isNaN(b) ? null : { vertical: false, k: 0, b };
  }

  return null;
}

/** Build a compact equation string from params (for the text input field).
 *  Mirrors the formatting logic in renderLineLabel so the input field always
 *  shows a clean, re-parseable string — e.g. "y = 3" not "y = 0.00x + 3.00".
 */
function paramsToEqString(p: LineParams): string {
  if (p.vertical) return `x = ${fmtCoeff(p.x)}`;
  const { k, b } = p;

  // Slope term: omit "0x", use "x" for k=1, "-x" for k=-1
  let kStr: string;
  if      (Math.abs(k) < 1e-9)         kStr = '';
  else if (Math.abs(k - 1) < 1e-9)     kStr = 'x';
  else if (Math.abs(k + 1) < 1e-9)     kStr = '-x';
  else                                  kStr = `${fmtCoeff(k)}x`;

  // Intercept term: omit when b=0 and slope term exists
  let bStr: string;
  if (Math.abs(b) < 1e-9 && kStr !== '') {
    bStr = '';
  } else if (kStr === '') {
    bStr = fmtCoeff(b);             // constant line: "y = 3"
  } else {
    const absB = fmtCoeff(Math.abs(b));
    bStr = b >= 0 ? ` + ${absB}` : ` - ${absB}`;
  }

  return `y = ${kStr}${bStr}`;
}

function fmtCoeff(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ─── Store helpers ─────────────────────────────────────────────────────────────

function getActiveLine(): LineEntity | null {
  const s = useEntityStore.getState();
  const e = s.entities.find((en) => en.id === s.activeEntityId);
  return e?.type === 'line' ? e : null;
}

function liveUpdate(patch: Partial<LineEntity['params']>): void {
  const s = useEntityStore.getState();
  const e = s.entities.find((en) => en.id === s.activeEntityId);
  if (!e || e.type !== 'line') return;
  s.updateEntity(e.id, updateLineParams(e, patch));
}

function liveUpdateEntity(entity: LineEntity): void {
  const s = useEntityStore.getState();
  s.updateEntity(entity.id, entity);
}

function commitUpdate(before: LineEntity, after: LineEntity): void {
  executeM03Command(new UpdateLineParamCommand(after.id, before, after));
}

// ─── SliderRow (delegates to UniversalSlider) ────────────────────────────────

function SliderRow({
  label, value, min, max, step = 0.1, onChange, onCommit,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; onCommit: (v: number) => void;
}) {
  return (
    <UniversalSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      decimals={2}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}

function fmt4(n: number) { return n.toFixed(4); }

// ─── Latus-rectum helper ──────────────────────────────────────────────────────

function latusRectumLength(conic: ConicEntity): number | null {
  if (conic.type === 'ellipse')   return 2 * conic.params.b ** 2 / conic.params.a;
  if (conic.type === 'hyperbola') return 2 * conic.params.b ** 2 / conic.params.a;
  if (conic.type === 'parabola')  return 2 * conic.params.p;
  return null;
}

// ─── Relation badge ────────────────────────────────────────────────────────────

const RELATION_STYLE = {
  '相交': { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46', dot: COLORS.primary },
  '相切': { bg: COLORS.warningLight, border: '#FCD34D', text: '#78350F', dot: COLORS.warning },
  '相离': { bg: COLORS.errorBg, border: '#FCA5A5', text: '#7F1D1D', dot: COLORS.error },
} as const;

function RelationBadge({ relation }: { relation: '相交' | '相切' | '相离' }) {
  const s = RELATION_STYLE[relation];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10,
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.3px',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block', flexShrink: 0 }} />
      {relation}
    </span>
  );
}

// ─── IntersectionSection ──────────────────────────────────────────────────────

function IntersectionSection({ line, conics }: { line: LineEntity; conics: ConicEntity[] }) {
  const focalConstraint    = useEntityStore((s) => s.focalConstraint);
  const setFocalConstraint = useEntityStore((s) => s.setFocalConstraint);
  const setActiveTool      = useEntityStore((s) => s.setActiveTool);

  const visible = conics.filter((c) => c.visible);
  if (visible.length === 0) return null;

  const infoRow = (label: React.ReactNode, value: React.ReactNode, valueColor?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
      <span style={{ fontSize: '11px', color: COLORS.textSecondary, fontStyle: 'italic' }}>{label}</span>
      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: valueColor ?? COLORS.textDark, fontWeight: valueColor ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );

  const snapToFocus = (fx: number, fy: number) => {
    const prev = getActiveLine(); if (!prev) return;
    let patch: Partial<LineParams>;
    if (prev.params.vertical) {
      patch = { x: fx };
    } else {
      patch = { b: fy - prev.params.k * fx };
    }
    const after = updateLineParams(prev, patch);
    useEntityStore.getState().updateEntity(prev.id, after);
    commitUpdate(prev, after);
  };

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textDark, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
        交点分析
      </p>

      {visible.map((conic) => {
        const result = intersectLineConic(line.params, conic);
        const lrLen  = result.isLatusRectum ? latusRectumLength(conic) : null;
        const labels = ['A', 'B'];

        // Focus list for snap buttons
        const fociList: { label: string; x: number; y: number }[] = [];
        if (conic.type === 'ellipse' || conic.type === 'hyperbola') {
          fociList.push(
            { label: 'F₁', x: conic.derived.foci[0][0], y: conic.derived.foci[0][1] },
            { label: 'F₂', x: conic.derived.foci[1][0], y: conic.derived.foci[1][1] },
          );
        } else if (conic.type === 'parabola') {
          fociList.push({ label: 'F', x: conic.derived.focus[0], y: conic.derived.focus[1] });
        }

        return (
          <div key={conic.id} style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>

            {/* Color swatch + circle relation badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: conic.color, flexShrink: 0 }} />
              {conic.type === 'circle' && result.lineCircleRelation && (
                <RelationBadge relation={result.lineCircleRelation} />
              )}
            </div>

            {/* No-intersection styled notice */}
            {result.pts.length === 0 && conic.type !== 'circle' && (
              <div style={{
                padding: '5px 8px', marginBottom: '6px',
                background: COLORS.errorBg, border: `1px solid ${COLORS.errorBorder}`,
                borderRadius: '5px', fontSize: '11px', color: COLORS.errorDark,
                fontWeight: 600, textAlign: 'center',
              }}>
                未找到交点
              </div>
            )}

            {/* Intersection points A, B */}
            {result.pts.map((pt, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', color: COLORS.error, fontWeight: 700 }}>{labels[i] ?? `P${i + 1}`}</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: COLORS.textDark }}>
                  ({fmt4(pt[0])}, {fmt4(pt[1])})
                </span>
              </div>
            ))}

            {/* Chord length |AB| with exact radical form */}
            {result.chordLength !== null && (() => {
              const color  = result.isLatusRectum ? COLORS.warning : COLORS.primary;
              const radStr = toRadicalForm(result.chordLength);
              return (
                <>
                  {infoRow(
                    '|AB|',
                    radStr
                      ? <>{radStr}<span style={{ color: COLORS.neutral, fontWeight: 400 }}> \u2248 {fmt4(result.chordLength)}</span></>
                      : fmt4(result.chordLength),
                    color,
                  )}
                  {lrLen !== null && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginTop: '3px', padding: '3px 6px',
                      background: 'rgba(251,191,36,0.10)', borderRadius: '4px',
                      border: '1px solid rgba(251,191,36,0.30)',
                    }}>
                      <span style={{ fontSize: '10px', color: '#92400E', fontWeight: 600 }}>
                        通径 {conic.type === 'parabola' ? '2p' : '2b\u00B2/a'}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#92400E', fontWeight: 700 }}>
                        {lrLen.toFixed(4)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Focal distances |AF| and |BF| */}
            {result.focalDistances !== null && result.focalLabel && (() => {
              const fL = result.focalLabel;
              const [dAF, dBF] = result.focalDistances!;
              const radA = toRadicalForm(dAF);
              const radB = toRadicalForm(dBF);
              return (
                <div style={{
                  marginTop: '4px', padding: '4px 6px',
                  background: 'rgba(251,191,36,0.06)', borderRadius: '4px',
                  border: '1px solid rgba(251,191,36,0.18)',
                }}>
                  {infoRow(
                    `|A${fL}|`,
                    radA
                      ? <>{radA}<span style={{ color: COLORS.neutral, fontWeight: 400 }}> \u2248 {fmt4(dAF)}</span></>
                      : fmt4(dAF),
                    '#D97706',
                  )}
                  {infoRow(
                    `|B${fL}|`,
                    radB
                      ? <>{radB}<span style={{ color: COLORS.neutral, fontWeight: 400 }}> \u2248 {fmt4(dBF)}</span></>
                      : fmt4(dBF),
                    '#D97706',
                  )}
                </div>
              );
            })()}

            {/* Focal triangle area */}
            {result.focalTriangleArea !== null && (
              infoRow(
                `\u25b3${result.focalLabel === 'F\u2081' ? 'F\u2082' : 'F\u2081'}AB \u9762\u79ef`,
                fmt4(result.focalTriangleArea),
                '#FBBF24',
              )
            )}

            {/* Focus / latus-rectum label */}
            {result.focalLabel && (
              <div style={{
                fontSize: '10px',
                color: result.isLatusRectum ? '#92400E' : COLORS.neutral,
                marginTop: '3px',
                ...(result.isLatusRectum ? {
                  padding: '3px 6px',
                  background: 'rgba(251,191,36,0.15)',
                  borderRadius: '4px',
                  border: '1px solid rgba(251,191,36,0.35)',
                  fontWeight: 700,
                } : {}),
              }}>
                {result.isLatusRectum
                  ? `\u2728 \u901a\u5f84 (Latus Rectum) \u2014 \u8fc7\u7126\u70b9 ${result.focalLabel}\uff0c\u22a5 \u4e3b\u8f74`
                  : `\u5f26\u8fc7\u7126\u70b9 ${result.focalLabel}`}
              </div>
            )}

            {/* Circle d vs R analysis */}
            {conic.type === 'circle' && result.centerLineDist !== null && (
              <div style={{ marginTop: '6px', padding: '5px 7px', background: COLORS.surfaceHover, borderRadius: '5px', border: `1px solid ${COLORS.border}` }}>
                {infoRow('d  (\u5706\u5fc3\u5230\u76f4\u7ebf)', result.centerLineDist.toFixed(4))}
                {infoRow('R  (\u5706\u534a\u5f84)',     conic.params.r.toFixed(4))}
                {infoRow(`d \u2212 R`,
                  (result.centerLineDist - conic.params.r).toFixed(4),
                  result.lineCircleRelation === '\u76f8\u79bb' ? COLORS.error
                    : result.lineCircleRelation === '\u76f8\u5207' ? COLORS.warning
                    : COLORS.primary,
                )}
              </div>
            )}

            {/* Focus snap buttons + focal-constraint drag */}
            {fociList.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '10px', color: COLORS.neutral, marginBottom: '4px' }}>
                  \u8fc7\u7126\u70b9\u5438\u9644
                </p>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {fociList.map((f) => {
                    const isPinned = focalConstraint &&
                      Math.abs(focalConstraint.fx - f.x) < 1e-6 &&
                      Math.abs(focalConstraint.fy - f.y) < 1e-6;
                    return (
                      <div key={f.label} style={{ display: 'flex', gap: '2px' }}>
                        <button
                          onClick={() => snapToFocus(f.x, f.y)}
                          title={`\u76f4\u7ebf\u8fc7 ${f.label}(${f.x.toFixed(2)}, ${f.y.toFixed(2)})`}
                          style={{
                            padding: '3px 8px', fontSize: '10px', fontWeight: 600,
                            borderRadius: '4px 0 0 4px', cursor: 'pointer',
                            background: `${COLORS.focusPoint}22`,
                            border: `1px solid ${COLORS.focusPoint}`,
                            color: COLORS.focusPoint,
                          }}
                        >
                          \u8fc7{f.label}({f.x.toFixed(1)}, {f.y.toFixed(1)})
                        </button>
                        <button
                          onClick={() => {
                            if (isPinned) {
                              setFocalConstraint(null);
                              setActiveTool('pan-zoom');
                            } else {
                              snapToFocus(f.x, f.y);
                              setFocalConstraint({ fx: f.x, fy: f.y });
                              setActiveTool('line-drag');
                            }
                          }}
                          title={isPinned ? `\u53d6\u6d88\u7ed5 ${f.label} \u65cb\u8f6c` : `\u7ed5 ${f.label} \u65cb\u8f6c\u62d6\u62fd`}
                          style={{
                            padding: '3px 5px', fontSize: '10px',
                            borderRadius: '0 4px 4px 0', cursor: 'pointer',
                            background: isPinned ? `${COLORS.focusPoint}` : `${COLORS.focusPoint}11`,
                            border: `1px solid ${COLORS.focusPoint}`,
                            borderLeft: 'none',
                            color: isPinned ? COLORS.white : COLORS.focusPoint,
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Crosshair size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {focalConstraint && (
                  <p style={{ fontSize: '10px', color: '#B45309', marginTop: '4px', fontStyle: 'italic' }}>
                    \u2699 \u7ed5\u7126\u70b9\u65cb\u8f6c\u6a21\u5f0f\u2014\u62d6\u62fd\u76f4\u7ebf\u5c06\u56f4\u7ed5\u7126\u70b9\u65cb\u8f6c
                  </p>
                )}
              </div>
            )}

          </div>
        );
      })}
    </div>
  );
}

// ─── TwoPointSection ──────────────────────────────────────────────────────────

function TwoPointSection({ line }: { line: LineEntity }) {
  const [open, setOpen]   = useState(false);
  const [x1, setX1]       = useState('0');
  const [y1, setY1]       = useState('0');
  const [x2, setX2]       = useState('1');
  const [y2, setY2]       = useState('1');
  const [error, setError] = useState('');

  const apply = () => {
    const nx1 = parseFloat(x1), ny1 = parseFloat(y1);
    const nx2 = parseFloat(x2), ny2 = parseFloat(y2);
    if ([nx1, ny1, nx2, ny2].some(isNaN)) { setError('\u8bf7\u8f93\u5165\u6709\u6548\u6570\u5b57'); return; }
    if (Math.abs(nx1 - nx2) < 1e-10 && Math.abs(ny1 - ny2) < 1e-10) {
      setError('\u4e24\u70b9\u4e0d\u80fd\u91cd\u5408'); return;
    }
    setError('');
    const prev = getActiveLine(); if (!prev) return;
    let patch: Partial<LineParams>;
    if (Math.abs(nx1 - nx2) < 1e-10) {
      patch = { vertical: true, x: nx1 };
    } else {
      const k = (ny2 - ny1) / (nx2 - nx1);
      patch = { vertical: false, k, b: ny1 - k * nx1 };
    }
    const after = updateLineParams(prev, patch);
    useEntityStore.getState().updateEntity(prev.id, after);
    commitUpdate(prev, after);
  };

  const inputStyle: React.CSSProperties = {
    width: '54px', padding: '3px 5px', fontSize: '11px',
    fontFamily: 'monospace', border: `1px solid ${COLORS.borderMuted}`,
    borderRadius: '4px', outline: 'none',
  };

  return (
    <div style={{ padding: '0 12px', marginBottom: '10px' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', padding: '5px 8px', fontSize: '11px', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: COLORS.surfaceHover, border: `1px solid ${COLORS.border}`,
          borderRadius: '5px', cursor: 'pointer', color: COLORS.textDark,
        }}
        {...btnHover(COLORS.surfaceLight, COLORS.surfaceHover)}
      >
        <span>\u53cc\u70b9\u5b9a\u7ebf</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '8px', padding: '8px', background: COLORS.surfaceHover, borderRadius: '5px', border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            {([
              { label: 'x\u2081', val: x1, set: setX1 },
              { label: 'y\u2081', val: y1, set: setY1 },
              { label: 'x\u2082', val: x2, set: setX2 },
              { label: 'y\u2082', val: y2, set: setY2 },
            ] as const).map(({ label, val, set }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: COLORS.textSecondary, width: '16px' }}>{label}</span>
                <input
                  type="number" step="0.5" value={val}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          {error && <p style={{ fontSize: '10px', color: COLORS.errorDark, marginBottom: '5px' }}>{error}</p>}
          <button
            onClick={apply}
            style={{
              width: '100%', padding: '4px', fontSize: '11px', fontWeight: 600,
              borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: COLORS.primary, color: COLORS.textPrimary,
            }}
            {...btnHover(COLORS.primaryHover, COLORS.primary)}
          >
            \u5e94\u7528
          </button>
          <p style={{ fontSize: '10px', color: COLORS.neutral, marginTop: '5px', textAlign: 'center' }}>
            {line.params.vertical
              ? `\u5f53\u524d: x = ${line.params.x.toFixed(2)}`
              : `\u5f53\u524d: y = ${line.params.k.toFixed(2)}x ${line.params.b >= 0 ? '+' : '\u2212'} ${Math.abs(line.params.b).toFixed(2)}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── NamedParamSliders (parametric line coefficients) ─────────────────────────

function NamedParamSliders({ line }: { line: LineEntity }) {
  const params = line.namedParams!;

  const handleParamChange = (idx: number, value: number) => {
    const updated = params.map((p, i) => i === idx ? { ...p, value } : p);
    const resolved = line.equationStr ? resolveLineParams(line.equationStr, updated) : null;
    if (!resolved) return;
    const next = updateLineNamedParams(line, updated, resolved);
    liveUpdateEntity(next);
  };

  const handleParamCommit = (idx: number, value: number) => {
    const prev = getActiveLine(); if (!prev) return;
    const updated = (prev.namedParams ?? []).map((p, i) => i === idx ? { ...p, value } : p);
    const resolved = prev.equationStr ? resolveLineParams(prev.equationStr, updated) : null;
    if (!resolved) return;
    const after = updateLineNamedParams(prev, updated, resolved);
    commitUpdate(prev, after);
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <p style={{
        fontSize: '11px', fontWeight: 700, color: COLORS.textDark,
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px',
      }}>
        含参常量
      </p>
      {params.map((p, idx) => (
        <NamedParamSliderRow
          key={p.name}
          param={p}
          onChange={(v) => handleParamChange(idx, v)}
          onCommit={(v) => handleParamCommit(idx, v)}
        />
      ))}
    </div>
  );
}

function NamedParamSliderRow({
  param, onChange, onCommit,
}: {
  param: FunctionParam;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const slider = useParamSlider<number>({
    getValue:     () => param.value,
    onLiveUpdate: onChange,
    onCommit:     (_before, after) => onCommit(after),
  });

  return (
    <SliderRow
      label={param.label}
      value={param.value}
      min={param.min}
      max={param.max}
      step={param.step}
      onChange={(v) => slider.handleChange(v)}
      onCommit={(v) => slider.handleCommit(v)}
    />
  );
}

// ─── LineParamPanel ───────────────────────────────────────────────────────────

export function LineParamPanel() {
  const allEntities    = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const activeTool     = useEntityStore((s) => s.activeTool);
  const setActiveTool  = useEntityStore((s) => s.setActiveTool);

  const line   = allEntities.find((e) => e.id === activeEntityId && e.type === 'line') as LineEntity | undefined;
  const conics = allEntities.filter(isConicEntity);

  // ── Equation text field ────────────────────────────────────────────────────
  const [eqInput, setEqInput] = useState('');
  const [eqError, setEqError] = useState(false);
  const inputFocused = useRef(false);
  const inputDirty   = useRef(false);
  const eqInputRef   = useRef<HTMLInputElement>(null);

  // 快速插入：光标感知，括号函数自动定位到括号内
  const handleQuickInsert = useCallback(
    (e: React.MouseEvent, text: string, cursorBack = 0) => {
      e.preventDefault(); // 阻止 input 失焦
      const input = eqInputRef.current;
      const start = input?.selectionStart ?? eqInput.length;
      const end   = input?.selectionEnd   ?? eqInput.length;
      const next  = eqInput.slice(0, start) + text + eqInput.slice(end);
      setEqInput(next);
      setEqError(false);
      inputDirty.current = true;
      const cursorPos = start + text.length - cursorBack;
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [eqInput],
  );

  // Sync input from store whenever params change externally (slider drags).
  // Don't update while the user is actively typing.
  // Show beautified equationStr when present (parametric line), otherwise computed form.
  useEffect(() => {
    if (inputFocused.current || !line) return;
    const display = line.equationStr
      ? formatEquationDisplay(line.equationStr)
      : paramsToEqString(line.params);
    setEqInput(display);
    setEqError(false);
  }, [line]);

  // Reset line-specific tools when the panel unmounts (entity deselected / conic selected).
  useEffect(() => {
    return () => {
      const tool = useEntityStore.getState().activeTool;
      if (tool === 'line-drag' || tool === 'line-two-point') {
        useEntityStore.getState().setActiveTool('pan-zoom');
      }
    };
  }, []);

  const commitEqInput = () => {
    // Fast path: literal-number regex parser
    const parsed = parseLineEq(eqInput);
    if (parsed) {
      setEqError(false);
      const prev = getActiveLine(); if (!prev) return;
      // Literal equation — clear any symbolic fields
      const after: LineEntity = {
        ...updateLineParams(prev, parsed),
        equationStr: null,
        namedParams: undefined,
      };
      useEntityStore.getState().updateEntity(prev.id, after);
      commitUpdate(prev, after);
      setEqInput(paramsToEqString(after.params));
      return;
    }

    // Symbolic fallback: detect free coefficients
    const prev = getActiveLine(); if (!prev) return;
    const existing = prev.namedParams ?? [];
    const coeffs = detectLineCoefficients(eqInput, existing);
    if (coeffs === null) { setEqError(true); return; }

    if (coeffs.length === 0) {
      // No free variables — try resolving directly
      const resolved = resolveLineParams(eqInput, []);
      if (!resolved) { setEqError(true); return; }
      setEqError(false);
      const after: LineEntity = {
        ...prev,
        params: resolved,
        equationStr: null,
        namedParams: undefined,
      };
      useEntityStore.getState().updateEntity(prev.id, after);
      commitUpdate(prev, after);
      setEqInput(paramsToEqString(after.params));
      return;
    }

    // Has free variables — resolve with defaults
    const resolved = resolveLineParams(eqInput, coeffs);
    if (!resolved) { setEqError(true); return; }
    setEqError(false);
    const after: LineEntity = {
      ...prev,
      params: resolved,
      equationStr: eqInput,
      namedParams: coeffs,
    };
    useEntityStore.getState().updateEntity(prev.id, after);
    commitUpdate(prev, after);
  };

  // ── Sliders ────────────────────────────────────────────────────────────────
  // Manual k/b/x sliders clear the symbolic equation (user overrides parametric form)
  const kSlider = useParamSlider<number>({
    getValue:     () => getActiveLine()?.params.k ?? 0,
    onLiveUpdate: (v) => liveUpdate({ k: v }),
    onCommit:     (before, after) => {
      if (before === after) return;
      const prev = getActiveLine(); if (!prev) return;
      const beforeEntity = updateLineParams(prev, { k: before });
      const afterEntity  = clearLineEquation(updateLineParams(prev, { k: after }));
      commitUpdate(beforeEntity, afterEntity);
    },
  });
  const bSlider = useParamSlider<number>({
    getValue:     () => getActiveLine()?.params.b ?? 0,
    onLiveUpdate: (v) => liveUpdate({ b: v }),
    onCommit:     (before, after) => {
      if (before === after) return;
      const prev = getActiveLine(); if (!prev) return;
      const beforeEntity = updateLineParams(prev, { b: before });
      const afterEntity  = clearLineEquation(updateLineParams(prev, { b: after }));
      commitUpdate(beforeEntity, afterEntity);
    },
  });
  const xSlider = useParamSlider<number>({
    getValue:     () => getActiveLine()?.params.x ?? 0,
    onLiveUpdate: (v) => liveUpdate({ x: v }),
    onCommit:     (before, after) => {
      if (before === after) return;
      const prev = getActiveLine(); if (!prev) return;
      const beforeEntity = updateLineParams(prev, { x: before });
      const afterEntity  = clearLineEquation(updateLineParams(prev, { x: after }));
      commitUpdate(beforeEntity, afterEntity);
    },
  });

  if (!line) return null;

  const { k, b, vertical, x } = line.params;
  const isParametric   = !!(line.namedParams && line.namedParams.length > 0 && line.equationStr);
  const isDragMode     = activeTool === 'line-drag';
  const isTwoPointMode = activeTool === 'line-two-point';

  const toggleVertical = () => {
    const prev = getActiveLine(); if (!prev) return;
    const after = updateLineParams(prev, { vertical: !prev.params.vertical });
    commitUpdate(prev, after);
  };

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>直线参数</p>

          {/* Tool mode buttons */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {/* Canvas two-point click mode */}
            <button
              onClick={() => setActiveTool(isTwoPointMode ? 'pan-zoom' : 'line-two-point')}
              title={isTwoPointMode ? '取消双点画线' : '在画布上点击两点定义直线'}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                borderRadius: '5px', cursor: 'pointer',
                border: `1px solid ${isTwoPointMode ? COLORS.infoBlue : COLORS.borderMuted}`,
                background: isTwoPointMode ? COLORS.infoBlueBg : 'transparent',
                color: isTwoPointMode ? COLORS.infoBlueDark : COLORS.textSecondary,
              }}
              {...(!isTwoPointMode ? btnHover(COLORS.surfaceHover) : {})}
            >
              ✦ {isTwoPointMode ? '取消' : '双点'}
            </button>

            {/* Drag-translate mode */}
            <button
              onClick={() => setActiveTool(isDragMode ? 'pan-zoom' : 'line-drag')}
              title={isDragMode ? '退出拖动模式' : '启动画布拖动模式'}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                borderRadius: '5px', cursor: 'pointer',
                border: `1px solid ${isDragMode ? COLORS.primary : COLORS.borderMuted}`,
                background: isDragMode ? `${COLORS.primary}22` : 'transparent',
                color: isDragMode ? COLORS.primary : COLORS.textSecondary,
              }}
              {...(!isDragMode ? btnHover(COLORS.surfaceHover) : {})}
            >
              <Move size={11} />
              {isDragMode ? '拖动中' : '拖动'}
            </button>
          </div>
        </div>

        {/* Two-point mode instruction strip */}
        {isTwoPointMode && (
          <div style={{
            marginBottom: '8px', padding: '6px 10px',
            background: COLORS.infoBlueBg, border: `1px solid ${COLORS.infoBlueBorder}`,
            borderRadius: '5px', fontSize: '11px', color: COLORS.infoBlueDark,
          }}>
            在画布上依次点击两点 — 第一点标记 P₁，第二点完成定线。
            按 <kbd style={{ padding: '0 3px', background: '#DBEAFE', borderRadius: '3px', border: '1px solid #93C5FD' }}>Esc</kbd> 取消。
          </div>
        )}

        {/* ── Equation text input ───────────────────────────────────────── */}
        <div style={{ marginBottom: '10px' }}>
          <p style={{ fontSize: '10px', color: COLORS.textSecondary, marginBottom: '3px' }}>
            \u76f4\u63a5\u8f93\u5165\u65b9\u7a0b\uff0c\u56de\u8f66\u786e\u8ba4
          </p>
          <input
            ref={eqInputRef}
            type="text"
            value={eqInput}
            placeholder="y = 2x + 1 | y = kx + b | ax + by + c = 0"
            onFocus={(e) => {
              inputFocused.current = true; inputDirty.current = false;
              const ring = focusRing(COLORS.primary, COLORS.primaryFocusRing, eqError ? COLORS.error : COLORS.borderMuted);
              ring.onFocus(e);
            }}
            onBlur={(e) => {
              inputFocused.current = false;
              if (inputDirty.current) { inputDirty.current = false; commitEqInput(); }
              const ring = focusRing(COLORS.primary, COLORS.primaryFocusRing, eqError ? COLORS.error : COLORS.borderMuted);
              ring.onBlur(e);
            }}
            onChange={(e) => { setEqInput(e.target.value); setEqError(false); inputDirty.current = true; }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{
              width: '100%', padding: '6px 8px',
              fontSize: '12px', fontFamily: 'monospace',
              border: `1px solid ${eqError ? COLORS.error : COLORS.borderMuted}`,
              borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
              background: eqError ? COLORS.errorBg : COLORS.surface,
              color: COLORS.textPrimary,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {/* Quick-insert symbol buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {QUICK_SYMBOLS.map(({ label, insert, cursorBack }) => (
              <button
                key={label}
                onMouseDown={(e) => handleQuickInsert(e, insert, cursorBack)}
                style={{
                  padding: '2px 6px', fontSize: '11px', borderRadius: '4px',
                  border: `1px solid ${COLORS.borderMuted}`, background: COLORS.surfaceHover,
                  color: COLORS.textDark, cursor: 'pointer', fontFamily: 'monospace',
                }}
                {...pillHover(COLORS.surfaceHover, COLORS.textDark, COLORS.borderMuted)}
              >
                {label}
              </button>
            ))}
          </div>
          {eqError && (
            <p style={{ fontSize: '10px', color: COLORS.errorDark, marginTop: '2px' }}>
              格式: y = 2x + 1 | y = kx + b | ax + by + c = 0
            </p>
          )}
        </div>

        {/* ── Parametric mode: equation badge + named-param sliders ── */}
        {isParametric ? (
          <>
            {/* Equation display badge */}
            <div style={{
              padding: '6px 10px', marginBottom: '10px',
              background: `${COLORS.primary}11`,
              border: `1px solid ${COLORS.primary}44`,
              borderRadius: '6px',
            }}>
              <p style={{
                fontSize: '13px', fontFamily: 'monospace', fontWeight: 600,
                color: COLORS.primary, margin: 0,
              }}>
                {formatEquationDisplay(line.equationStr!)}
              </p>
              {/* Resolved numeric values */}
              <p style={{ fontSize: '10px', color: COLORS.textSecondary, margin: '4px 0 0' }}>
                {vertical
                  ? `x = ${fmtCoeff(x)}`
                  : `k = ${fmtCoeff(k)}\u2002b = ${fmtCoeff(b)}`}
              </p>
            </div>

            {/* Named-param sliders */}
            <NamedParamSliders line={line} />
          </>
        ) : (
          <>
            {/* ── Vertical toggle ───────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>\u8d44\u7ebf (x = c)</span>
              <button
                onClick={toggleVertical}
                style={{
                  padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '4px',
                  border: `1px solid ${vertical ? COLORS.primary : COLORS.borderMuted}`,
                  background: vertical ? `${COLORS.primary}22` : 'transparent',
                  color: vertical ? COLORS.primary : COLORS.textSecondary, cursor: 'pointer',
                }}
                {...(!vertical ? btnHover(COLORS.surfaceHover) : {})}
              >
                {vertical ? '\u5f00' : '\u5173'}
              </button>
            </div>

            {/* ── Parameter sliders ─────────────────────────────────────── */}
            {vertical ? (
              <SliderRow label="x\u2080" value={x} min={-10} max={10}
                onChange={(v) => xSlider.handleChange(v)}
                onCommit={(v) => xSlider.handleCommit(v)} />
            ) : (
              <>
                <SliderRow label="k" value={k} min={-5} max={5}
                  onChange={(v) => kSlider.handleChange(v)}
                  onCommit={(v) => kSlider.handleCommit(v)} />
                <SliderRow label="b" value={b} min={-10} max={10}
                  onChange={(v) => bSlider.handleChange(v)}
                  onCommit={(v) => bSlider.handleCommit(v)} />
              </>
            )}
          </>
        )}
      </div>

      {/* ── Two-point definition ──────────────────────────────────────────── */}
      <TwoPointSection line={line} />

      {/* ── Intersection results ──────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: '4px', paddingTop: '12px' }}>
        <IntersectionSection line={line} conics={conics} />
      </div>
    </div>
  );
}
