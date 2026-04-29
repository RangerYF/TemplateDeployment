import { useActiveConic } from '@/hooks/useActiveEntity';
import { useEntityStore } from '@/editor/store/entityStore';
import { COLORS } from '@/styles/colors';
import { classifyCircleLine } from '@/canvas/renderers/circleLineRenderer';
import type { CircleLineRelation } from '@/canvas/renderers/circleLineRenderer';
import type { LineEntity } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number with 4 decimal places, always showing sign. */
function fmtSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(4);
}

/** Format a coordinate pair, e.g. "(−4.0000, 0.0000)". */
function fmtPoint(x: number, y: number): string {
  return `(${x.toFixed(4)}, ${y.toFixed(4)})`;
}

/** Build a human-readable asymptote equation from stored slope/intercept. */
function fmtAsymptote(k: number, b: number): string {
  const sign     = k >= 0 ? '' : '−';
  const absK     = Math.abs(k).toFixed(4);
  const bAbs     = Math.abs(b).toFixed(4);
  const bSign    = b >= 0 ? ' + ' : ' − ';
  if (b === 0) return `y = ${sign}${absK}x`;
  return `y = ${sign}${absK}x${bSign}${bAbs}`;
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
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
      <span style={{ fontSize: '13px', color: COLORS.textPrimary }}>{label}</span>
      <span style={{
        fontSize: '13px', fontFamily: 'monospace', fontWeight: 600,
        color: color ?? COLORS.textDark,
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── DerivedInfoPanel ─────────────────────────────────────────────────────────

export function DerivedInfoPanel() {
  const entity = useActiveConic();

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
      <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
        {entity.type === 'ellipse' && (() => {
          const { a, b, cx, cy } = entity.params;
          const a2 = (a * a).toFixed(2).replace(/\.?0+$/, '');
          const b2 = (b * b).toFixed(2).replace(/\.?0+$/, '');
          const ox = cx !== 0 ? ` \u2212 ${Math.abs(cx).toFixed(2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${Math.abs(cy).toFixed(2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          return `${xTerm}/${a2} + ${yTerm}/${b2} = 1`;
        })()}
        {entity.type === 'hyperbola' && (() => {
          const { a, b, cx, cy } = entity.params;
          const a2 = (a * a).toFixed(2).replace(/\.?0+$/, '');
          const b2 = (b * b).toFixed(2).replace(/\.?0+$/, '');
          const ox = cx !== 0 ? ` \u2212 ${Math.abs(cx).toFixed(2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${Math.abs(cy).toFixed(2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          return `${xTerm}/${a2} \u2212 ${yTerm}/${b2} = 1`;
        })()}
        {entity.type === 'parabola' && (() => {
          const { p, cx, cy } = entity.params;
          const p2 = (2 * p).toFixed(2).replace(/\.?0+$/, '');
          const isV = entity.derived.orientation === 'v';
          const ox = cx !== 0 ? ` \u2212 ${Math.abs(cx).toFixed(2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${Math.abs(cy).toFixed(2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          return isV ? `${xTerm} = ${p2}y` : `${yTerm} = ${p2}x`;
        })()}
        {entity.type === 'circle' && (() => {
          const { r, cx, cy } = entity.params;
          const r2 = (r * r).toFixed(2).replace(/\.?0+$/, '');
          const ox = cx !== 0 ? ` \u2212 ${Math.abs(cx).toFixed(2)}`.replace('\u2212 ', cx > 0 ? '\u2212 ' : '+ ') : '';
          const oy = cy !== 0 ? ` \u2212 ${Math.abs(cy).toFixed(2)}`.replace('\u2212 ', cy > 0 ? '\u2212 ' : '+ ') : '';
          const xTerm = cx !== 0 ? `(x${ox})\u00B2` : 'x\u00B2';
          const yTerm = cy !== 0 ? `(y${oy})\u00B2` : 'y\u00B2';
          return `${xTerm} + ${yTerm} = ${r2}`;
        })()}
      </p>

      {/* ── Ellipse ──────────────────────────────────────────────────── */}
      {entity.type === 'ellipse' && (() => {
        const d = entity.derived;
        const latus = (2 * entity.params.b * entity.params.b / entity.params.a);
        return (
          <>
            <Section title="焦点">
              <Row label="F₁" value={fmtPoint(d.foci[0][0], d.foci[0][1])}
                color={COLORS.focusPoint} />
              <Row label="F₂" value={fmtPoint(d.foci[1][0], d.foci[1][1])}
                color={COLORS.focusPoint} />
            </Section>
            <Section title="离心率 / 焦距">
              <Row label="e = c/a" value={d.e.toFixed(6)} />
              <Row label="c = √(a²−b²)" value={d.c.toFixed(6)} />
              <Row label="通径 2b²/a" value={latus.toFixed(6)} />
            </Section>
            <Section title="准线">
              <Row label="x₁ =" value={fmtSigned(d.directrices[0])} color={COLORS.directrix} />
              <Row label="x₂ =" value={fmtSigned(d.directrices[1])} color={COLORS.directrix} />
            </Section>
          </>
        );
      })()}

      {/* ── Hyperbola ─────────────────────────────────────────────────── */}
      {entity.type === 'hyperbola' && (() => {
        const d = entity.derived;
        const latus = (2 * entity.params.b * entity.params.b / entity.params.a);
        return (
          <>
            <Section title="焦点">
              <Row label="F₁" value={fmtPoint(d.foci[0][0], d.foci[0][1])}
                color={COLORS.focusPoint} />
              <Row label="F₂" value={fmtPoint(d.foci[1][0], d.foci[1][1])}
                color={COLORS.focusPoint} />
            </Section>
            <Section title="离心率 / 焦距">
              <Row label="e = c/a" value={d.e.toFixed(6)} />
              <Row label="c = √(a²+b²)" value={d.c.toFixed(6)} />
              <Row label="通径 2b²/a" value={latus.toFixed(6)} />
            </Section>
            <Section title="准线">
              <Row label="x₁ =" value={fmtSigned(d.directrices[0])} color={COLORS.directrix} />
              <Row label="x₂ =" value={fmtSigned(d.directrices[1])} color={COLORS.directrix} />
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
              <Row label="p/2 =" value={(p / 2).toFixed(6)} />
              <Row label="通径 2p =" value={(2 * p).toFixed(6)} />
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
              <Row label="半径 r =" value={entity.params.r.toFixed(6)} />
            </Section>
            <Section title="面积 / 周长">
              <Row label="S = πr²" value={d.area.toFixed(6)} />
              <Row label="C = 2πr" value={d.circumference.toFixed(6)} />
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
