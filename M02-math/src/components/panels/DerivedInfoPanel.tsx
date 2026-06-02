import { useActiveConic } from '@/hooks/useActiveEntity';
import { useEntityStore } from '@/editor/store/entityStore';
import { COLORS } from '@/styles/colors';
import { KaTeXRenderer } from '@/components/KaTeXRenderer';
import { classifyCircleLine } from '@/canvas/renderers/circleLineRenderer';
import type { CircleLineRelation } from '@/canvas/renderers/circleLineRenderer';
import type { LineEntity } from '@/types';
import {
  formatAsymptoteConic,
  formatPointConic,
  formatSquareTermConic,
  formatConicValue,
  formatFractionPreferredConicValue,
} from '@/engine/conicDisplay';
import { toKatexInline } from '@/engine/triangleDisplay';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number with 4 decimal places, always showing sign. */
function fmtSigned(n: number): string {
  const mode = useEntityStore.getState().displayOptions.teachingFormat ? 'teaching' : 'decimal';
  const body = formatFractionPreferredConicValue(Math.abs(n), mode, 4, 96);
  if (Math.abs(n) < 1e-10) return '0';
  return n >= 0 ? `+${body}` : `−${body}`;
}

/** Format a coordinate pair, e.g. "(−4.0000, 0.0000)". */
function fmtPoint(x: number, y: number): string {
  const mode = useEntityStore.getState().displayOptions.teachingFormat ? 'teaching' : 'decimal';
  return formatPointConic(x, y, mode);
}

/** Build a human-readable asymptote equation from stored slope/intercept. */
function fmtAsymptote(k: number, b: number): string {
  const mode = useEntityStore.getState().displayOptions.teachingFormat ? 'teaching' : 'decimal';
  return formatAsymptoteConic(k, b, mode);
}

function toConicFormulaLatex(text: string): string {
  return text
    .replace(/²/g, '^2')
    .replace(/−/g, '-')
    .replace(/√(\d+)/g, '\\sqrt{$1}');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A labelled section with a thin separator. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{
        fontSize: '11px', fontWeight: 600,
        color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.6px',
        marginBottom: '6px',
      }}>
        {title}
      </p>
      {children}
    </div>
  );
}

/** One key → value row. */
function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  const shouldUseKatex = value.includes('√') || value.includes('/');
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span style={{ fontSize: '13px', color: COLORS.textPrimary }}>{label}</span>
      <span style={{
        fontSize: '13px', fontFamily: shouldUseKatex ? undefined : 'monospace', fontWeight: 600,
        color: color ?? COLORS.textDark,
        lineHeight: 1.6,
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
      }}>
        {shouldUseKatex ? <KaTeXRenderer latex={toKatexInline(value)} /> : value}
      </span>
    </div>
  );
}

// ─── DerivedInfoPanel ─────────────────────────────────────────────────────────

export function DerivedInfoPanel() {
  const entity = useActiveConic();
  const teachingFormat = useEntityStore((s) => s.displayOptions.teachingFormat);
  const displayMode = teachingFormat ? 'teaching' : 'decimal';

  if (!entity) {
    return (
      <div style={{ padding: '12px', borderTop: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: '12px', color: COLORS.textSecondary, textAlign: 'center' }}>
          选择曲线查看派生要素
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Section heading ──────────────────────────────────────────── */}
      <p style={{
        fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary,
        marginBottom: '10px',
      }}>
        派生要素
      </p>
      <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '12px', fontWeight: 600, lineHeight: 1.7, minHeight: 24 }}>
        {entity.type === 'ellipse' && (() => {
          const { a, b, cx, cy, orientation = 'h' } = entity.params;
          const major2 = formatSquareTermConic(a, displayMode);
          const minor2 = formatSquareTermConic(b, displayMode);
          const ox = cx !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cx), displayMode, 2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cy), displayMode, 2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          const text = orientation === 'v'
            ? `${xTerm}/${minor2} + ${yTerm}/${major2} = 1`
            : `${xTerm}/${major2} + ${yTerm}/${minor2} = 1`;
          return <KaTeXRenderer latex={toConicFormulaLatex(text)} />;
        })()}
        {entity.type === 'hyperbola' && (() => {
          const { a, b, cx, cy, orientation = 'h' } = entity.params;
          const major2 = formatSquareTermConic(a, displayMode);
          const minor2 = formatSquareTermConic(b, displayMode);
          const ox = cx !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cx), displayMode, 2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cy), displayMode, 2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          const text = orientation === 'v'
            ? `${yTerm}/${major2} \u2212 ${xTerm}/${minor2} = 1`
            : `${xTerm}/${major2} \u2212 ${yTerm}/${minor2} = 1`;
          return <KaTeXRenderer latex={toConicFormulaLatex(text)} />;
        })()}
        {entity.type === 'parabola' && (() => {
          const { p, cx, cy } = entity.params;
          const p2 = formatConicValue(2 * p, displayMode, 2);
          const isV = entity.derived.orientation === 'v';
          const ox = cx !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cx), displayMode, 2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cy), displayMode, 2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          const text = isV ? `${xTerm} = ${p2}y` : `${yTerm} = ${p2}x`;
          return <KaTeXRenderer latex={toConicFormulaLatex(text)} />;
        })()}
        {entity.type === 'circle' && (() => {
          const { r, cx, cy } = entity.params;
          const r2 = formatSquareTermConic(r, displayMode);
          const ox = cx !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cx), displayMode, 2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${formatConicValue(Math.abs(cy), displayMode, 2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          const text = `${xTerm} + ${yTerm} = ${r2}`;
          return <KaTeXRenderer latex={toConicFormulaLatex(text)} />;
        })()}
      </div>

      {/* ── Ellipse ──────────────────────────────────────────────────── */}
      {entity.type === 'ellipse' && (() => {
        const d = entity.derived;
        const latus = (2 * entity.params.b * entity.params.b / entity.params.a);
        const { a, b, cx, cy } = entity.params;
        const isV = d.orientation === 'v';
        return (
          <>
            <Section title="顶点">
              <Row label={isV ? '长轴上顶点' : '长轴右顶点'} value={fmtPoint(isV ? cx : cx + a, isV ? cy + a : cy)}
                color={COLORS.primary} />
              <Row label={isV ? '长轴下顶点' : '长轴左顶点'} value={fmtPoint(isV ? cx : cx - a, isV ? cy - a : cy)}
                color={COLORS.primary} />
              <Row label={isV ? '短轴右顶点' : '短轴上顶点'} value={fmtPoint(isV ? cx + b : cx, isV ? cy : cy + b)}
                color={COLORS.infoBlueDark} />
              <Row label={isV ? '短轴左顶点' : '短轴下顶点'} value={fmtPoint(isV ? cx - b : cx, isV ? cy : cy - b)}
                color={COLORS.infoBlueDark} />
            </Section>
            <Section title="焦点">
              <Row label="F₁" value={fmtPoint(d.foci[0][0], d.foci[0][1])}
                color={COLORS.focusPoint} />
              <Row label="F₂" value={fmtPoint(d.foci[1][0], d.foci[1][1])}
                color={COLORS.focusPoint} />
            </Section>
            <Section title="离心率 / 焦距">
              <Row label="e = c/a" value={formatConicValue(d.e, displayMode, 6)} />
              <Row label="c = √(a²−b²)" value={formatConicValue(d.c, displayMode, 6)} />
              <Row label="通径 2b²/a" value={formatConicValue(latus, displayMode, 6)} />
            </Section>
            <Section title="准线">
              <Row label={isV ? 'y₁ =' : 'x₁ ='} value={fmtSigned(d.directrices[0])} color={COLORS.directrix} />
              <Row label={isV ? 'y₂ =' : 'x₂ ='} value={fmtSigned(d.directrices[1])} color={COLORS.directrix} />
            </Section>
          </>
        );
      })()}

      {/* ── Hyperbola ─────────────────────────────────────────────────── */}
      {entity.type === 'hyperbola' && (() => {
        const d = entity.derived;
        const latus = (2 * entity.params.b * entity.params.b / entity.params.a);
        const isV = d.orientation === 'v';
        return (
          <>
            <Section title="轴端点">
              <Row label={isV ? '实轴下端点' : '实轴左端点'} value={fmtPoint(d.transverseVertices[0][0], d.transverseVertices[0][1])}
                color={COLORS.primary} />
              <Row label={isV ? '实轴上端点' : '实轴右端点'} value={fmtPoint(d.transverseVertices[1][0], d.transverseVertices[1][1])}
                color={COLORS.primary} />
              <Row label={isV ? '虚轴左端点' : '虚轴下端点'} value={fmtPoint(d.conjugateVertices[0][0], d.conjugateVertices[0][1])}
                color={COLORS.infoBlueDark} />
              <Row label={isV ? '虚轴右端点' : '虚轴上端点'} value={fmtPoint(d.conjugateVertices[1][0], d.conjugateVertices[1][1])}
                color={COLORS.infoBlueDark} />
            </Section>
            <Section title="焦点">
              <Row label="F₁" value={fmtPoint(d.foci[0][0], d.foci[0][1])}
                color={COLORS.focusPoint} />
              <Row label="F₂" value={fmtPoint(d.foci[1][0], d.foci[1][1])}
                color={COLORS.focusPoint} />
            </Section>
            <Section title="离心率 / 焦距">
              <Row label="e = c/a" value={formatConicValue(d.e, displayMode, 6)} />
              <Row label="c = √(a²+b²)" value={formatConicValue(d.c, displayMode, 6)} />
              <Row label="通径 2b²/a" value={formatConicValue(latus, displayMode, 6)} />
            </Section>
            <Section title="准线">
              <Row label={isV ? 'y₁ =' : 'x₁ ='} value={fmtSigned(d.directrices[0])} color={COLORS.directrix} />
              <Row label={isV ? 'y₂ =' : 'x₂ ='} value={fmtSigned(d.directrices[1])} color={COLORS.directrix} />
            </Section>
            <Section title="渐近线">
              <Row label="L₁" value={fmtAsymptote(d.asymptotes[0].k, d.asymptotes[0].b)}
                color={COLORS.asymptote} />
              <Row label="L₂" value={fmtAsymptote(d.asymptotes[1].k, d.asymptotes[1].b)}
                color={COLORS.asymptote} />
            </Section>
          </>
        );
      })()}

      {/* ── Parabola ──────────────────────────────────────────────────── */}
      {entity.type === 'parabola' && (() => {
        const d = entity.derived;
        const p = entity.params.p;
        const isV = d.orientation === 'v';
        return (
          <>
            <Section title="焦点">
              <Row label="F" value={fmtPoint(d.focus[0], d.focus[1])}
                color={COLORS.focusPoint} />
            </Section>
            <Section title="准线">
              <Row label={isV ? 'y =' : 'x ='} value={fmtSigned(d.directrix)} color={COLORS.directrix} />
            </Section>
            <Section title="焦准距">
              <Row label="p/2 =" value={formatConicValue(p / 2, displayMode, 6)} />
              <Row label="通径 2p =" value={formatConicValue(2 * p, displayMode, 6)} />
              <Row label="开口方向" value={isV ? (p >= 0 ? '向上' : '向下') : (p >= 0 ? '向右' : '向左')} />
            </Section>
          </>
        );
      })()}

      {/* ── Circle ────────────────────────────────────────────────────── */}
      {entity.type === 'circle' && (() => {
        const d = entity.derived;
        return (
          <>
            <Section title="几何量">
              <Row label="圆心" value={fmtPoint(d.center[0], d.center[1])} />
              <Row label="半径 r =" value={formatConicValue(entity.params.r, displayMode, 6)} />
            </Section>
            <Section title="面积 / 周长">
              <Row label="S = πr²" value={formatConicValue(d.area, displayMode, 6)} />
              <Row label="C = 2πr" value={formatConicValue(d.circumference, displayMode, 6)} />
            </Section>
          </>
        );
      })()}

      {/* ── Circle-Line Relation Card ──────────────────────────────── */}
      {entity.type === 'circle' && <CircleLineCard entity={entity} />}

    </div>
  );
}

// ─── Circle-Line Relation Card ───────────────────────────────────────────────

const RELATION_COLORS: Record<CircleLineRelation, string> = {
  '相交': COLORS.primary,
  '相切': '#FBBF24',
  '相离': COLORS.error,
};

const RELATION_EN: Record<CircleLineRelation, string> = {
  '相交': 'Intersecting',
  '相切': 'Tangent',
  '相离': 'Separated',
};

function distPointToLine(px: number, py: number, line: LineEntity): number {
  if (line.params.vertical) return Math.abs(px - line.params.x);
  const { k, b } = line.params;
  return Math.abs(py - k * px - b) / Math.sqrt(1 + k * k);
}

function CircleLineCard({ entity }: { entity: { type: 'circle'; params: { cx: number; cy: number; r: number } } }) {
  const entities = useEntityStore((s) => s.entities);
  const lines = entities.filter((e): e is LineEntity => e.type === 'line' && e.visible);

  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((line) => {
        const d = distPointToLine(entity.params.cx, entity.params.cy, line);
        const r = entity.params.r;
        const relation = classifyCircleLine(d, r);
        const color = RELATION_COLORS[relation];
        const cmp = d < r - 1e-4 ? '<' : Math.abs(d - r) < 1e-4 ? '=' : '>';

        return (
          <div key={line.id} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              圆与直线 {line.label ?? ''}
            </p>
            <Row label="d (圆心到直线)" value={d.toFixed(4)} color={color} />
            <Row label="r (半径)" value={r.toFixed(4)} />
            {/* Large status badge */}
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 6,
              background: color + '18', border: `2px solid ${color}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary, fontFamily: 'monospace' }}>
                d {cmp} r
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color }}>
                {relation} ({RELATION_EN[relation]})
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
