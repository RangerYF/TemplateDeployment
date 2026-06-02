import { useEffect } from 'react';
import * as math from 'mathjs';
import { useActiveConic } from '@/hooks/useActiveEntity';
import { useParamSlider } from '@/hooks/useParamSlider';
import { useEntityStore } from '@/editor/store/entityStore';
import { useEccentricityDemoStore } from '@/editor/store/eccentricityDemoStore';
import { updateEntityParams } from '@/editor/entities/types';
import { UpdateCurveParamCommand } from '@/editor/commands/UpdateCurveParamCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { UniversalSlider, ResetButton } from '@/components/shared/UniversalSlider';
import { KaTeXRenderer } from '@/components/KaTeXRenderer';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import {
  getEntityEccentricity,
} from '@/engine/eccentricityEngine';
import { EccentricityZoneBar, defaultSweepRange, sweepRangeBounds } from '@/components/panels/EccentricityPanel';
import type { ConicAxisOrientation, ConicEntity } from '@/types';
import { isConicEntity } from '@/types';
import { formatConicValue } from '@/engine/conicDisplay';

function toConicFormulaLatex(text: string): string {
  return text
    .replace(/²/g, '^2')
    .replace(/−/g, '-');
}

// ─── Stale-closure-safe store helpers ─────────────────────────────────────────

function getActiveEntity(): ConicEntity | null {
  const store = useEntityStore.getState();
  const e = store.entities.find((en) => en.id === store.activeEntityId);
  if (!e) return null;
  if (e.type === 'ellipse' || e.type === 'hyperbola' || e.type === 'parabola' || e.type === 'circle') return e;
  return null;
}

function getParam(key: string): number {
  const e = getActiveEntity();
  if (!e) return 0;
  return (e.params as unknown as Record<string, number>)[key] ?? 0;
}

function getDerivedC(): number {
  const e = getActiveEntity();
  if (!e) return 0;
  if (e.type === 'ellipse' || e.type === 'hyperbola') return e.derived.c;
  return 0;
}

function parseConicParamInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const normalized = text.replace(/√/g, 'sqrt');
    const value = math.evaluate(normalized);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/** Safety: clamp value to avoid division-by-zero or degenerate shapes. */
function safeClamp(key: string, value: number, entityType: string): number {
  if (key === 'p' && entityType === 'parabola' && Math.abs(value) < 0.05) {
    return value < 0 ? -0.05 : 0.05;
  }
  // Prevent b=0 or a=0 which causes division by zero in ellipse/hyperbola
  if ((key === 'a' || key === 'b' || key === 'r') && value < 0.05) {
    return 0.05;
  }
  // For ellipse, ensure b < a
  if (key === 'b' && entityType === 'ellipse') {
    const a = getParam('a');
    if (value >= a) return Math.max(0.05, a - 0.05);
  }
  return value;
}

function liveUpdate(key: string, value: number): void {
  const store = useEntityStore.getState();
  const e     = store.entities.find((en) => en.id === store.activeEntityId);
  if (!e || !isConicEntity(e)) return;
  if (key === 'c' && (e.type === 'ellipse' || e.type === 'hyperbola')) {
    const a = e.params.a;
    const safeC = Math.max(0.05, value);
    if (e.type === 'ellipse') {
      const cappedC = Math.min(safeC, Math.max(0.05, a - 0.05));
      const nextB = Math.sqrt(Math.max(0.05 * 0.05, a * a - cappedC * cappedC));
      store.updateEntity(e.id, updateEntityParams(e, { b: nextB } as never));
      return;
    }
    const nextB = Math.sqrt(Math.max(0.05 * 0.05, safeC * safeC - a * a));
    store.updateEntity(e.id, updateEntityParams(e, { b: nextB } as never));
    return;
  }
  const safe = safeClamp(key, value, e.type);
  store.updateEntity(e.id, updateEntityParams(e, { [key]: safe } as never));
}

function commitParam(key: string, before: number, after: number): void {
  if (before === after) return;
  const store       = useEntityStore.getState();
  const afterEntity = store.entities.find((en) => en.id === store.activeEntityId);
  if (!afterEntity || !isConicEntity(afterEntity)) return;
  let beforeEntity: ConicEntity;
  if (key === 'c' && (afterEntity.type === 'ellipse' || afterEntity.type === 'hyperbola')) {
    const a = afterEntity.params.a;
    if (afterEntity.type === 'ellipse') {
      const cappedC = Math.min(Math.max(0.05, before), Math.max(0.05, a - 0.05));
      const prevB = Math.sqrt(Math.max(0.05 * 0.05, a * a - cappedC * cappedC));
      beforeEntity = updateEntityParams(afterEntity, { b: prevB } as never);
    } else {
      const prevB = Math.sqrt(Math.max(0.05 * 0.05, before * before - a * a));
      beforeEntity = updateEntityParams(afterEntity, { b: prevB } as never);
    }
  } else {
    beforeEntity = updateEntityParams(afterEntity, { [key]: before } as never);
  }
  executeM03Command(new UpdateCurveParamCommand(afterEntity.id, beforeEntity, afterEntity));
}

function toggleParabolaOrientation(): void {
  const store        = useEntityStore.getState();
  const beforeEntity = store.entities.find((en) => en.id === store.activeEntityId);
  if (!beforeEntity || beforeEntity.type !== 'parabola') return;
  const newOrientation = beforeEntity.params.orientation === 'v' ? 'h' : 'v';
  const afterEntity    = updateEntityParams(beforeEntity, { orientation: newOrientation } as never);
  store.updateEntity(beforeEntity.id, afterEntity);
  executeM03Command(new UpdateCurveParamCommand(beforeEntity.id, beforeEntity, afterEntity));
}

function toggleConicOrientation(): void {
  const store        = useEntityStore.getState();
  const beforeEntity = store.entities.find((en) => en.id === store.activeEntityId);
  if (!beforeEntity || (beforeEntity.type !== 'ellipse' && beforeEntity.type !== 'hyperbola')) return;
  const currentOrientation = beforeEntity.params.orientation === 'v' ? 'v' : 'h';
  const newOrientation: ConicAxisOrientation = currentOrientation === 'v' ? 'h' : 'v';
  const afterEntity = updateEntityParams(beforeEntity, { orientation: newOrientation } as never);
  store.updateEntity(beforeEntity.id, afterEntity);
  executeM03Command(new UpdateCurveParamCommand(beforeEntity.id, beforeEntity, afterEntity));
}

function eccentricityTypeLabel(e: number): string {
  if (e < 1 - 1e-6) return '椭圆';
  if (Math.abs(e - 1) < 1e-6) return '抛物线';
  return '双曲线';
}

// ─── Default values for reset ────────────────────────────────────────────────

const DEFAULTS: Record<string, Record<string, number>> = {
  ellipse:   { a: 5, b: 3, cx: 0, cy: 0 },
  hyperbola: { a: 3, b: 4, cx: 0, cy: 0 },
  parabola:  { p: 2, cx: 0, cy: 0 },
  circle:    { r: 3, cx: 0, cy: 0 },
};

function handleReset(entityType: string): void {
  const store = useEntityStore.getState();
  const e = store.entities.find((en) => en.id === store.activeEntityId);
  if (!e || !isConicEntity(e)) return;
  const defaults = DEFAULTS[entityType];
  if (!defaults) return;
  const beforeEntity = e;
  const afterEntity = updateEntityParams(e, defaults as never);
  store.updateEntity(e.id, afterEntity);
  executeM03Command(new UpdateCurveParamCommand(e.id, beforeEntity as ConicEntity, afterEntity));
}

// ─── ConicParamPanel ──────────────────────────────────────────────────────────

export function ConicParamPanel() {
  const entity = useActiveConic();
  const teachingFormat = useEntityStore((s) => s.displayOptions.teachingFormat);
  const displayMode = teachingFormat ? 'teaching' : 'decimal';

  // ── All slider hooks unconditionally (Rules of Hooks) ────────────────────
  const aSlider  = useParamSlider<number>({
    getValue:     () => getParam('a'),
    onLiveUpdate: (v) => liveUpdate('a', v),
    onCommit:     (b, a) => commitParam('a', b, a),
  });
  const bSlider  = useParamSlider<number>({
    getValue:     () => getParam('b'),
    onLiveUpdate: (v) => liveUpdate('b', v),
    onCommit:     (b, a) => commitParam('b', b, a),
  });
  const cSlider  = useParamSlider<number>({
    getValue:     () => getDerivedC(),
    onLiveUpdate: (v) => liveUpdate('c', v),
    onCommit:     (b, a) => commitParam('c', b, a),
  });
  const pSlider  = useParamSlider<number>({
    getValue:     () => getParam('p'),
    onLiveUpdate: (v) => liveUpdate('p', v),
    onCommit:     (b, a) => commitParam('p', b, a),
  });
  const rSlider  = useParamSlider<number>({
    getValue:     () => getParam('r'),
    onLiveUpdate: (v) => liveUpdate('r', v),
    onCommit:     (b, a) => commitParam('r', b, a),
  });
  const cxSlider = useParamSlider<number>({
    getValue:     () => getParam('cx'),
    onLiveUpdate: (v) => liveUpdate('cx', v),
    onCommit:     (b, a) => commitParam('cx', b, a),
  });
  const cySlider = useParamSlider<number>({
    getValue:     () => getParam('cy'),
    onLiveUpdate: (v) => liveUpdate('cy', v),
    onCommit:     (b, a) => commitParam('cy', b, a),
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!entity) {
    return (
      <div style={{ padding: '16px 12px' }}>
        <p style={{ fontSize: '13px', color: COLORS.textSecondary, textAlign: 'center' }}>
          选择一条曲线以编辑参数
        </p>
      </div>
    );
  }

  // ── Render params for the active entity type ──────────────────────────────
  const p = entity.params;

  return (
    <div style={{ padding: '12px' }}>

      {/* Section title */}
      <p style={{
        fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary,
        marginBottom: '2px',
      }}>
        曲线参数
      </p>
      <div style={{ fontSize: '12px', color: COLORS.textDark, marginBottom: '12px', fontWeight: 600, lineHeight: 1.7, minHeight: 24 }}>
        {entity.type === 'ellipse'   && <KaTeXRenderer latex={toConicFormulaLatex((entity.params.orientation ?? 'h') === 'v' ? 'x²/b² + y²/a² = 1' : 'x²/a² + y²/b² = 1')} />}
        {entity.type === 'hyperbola' && <KaTeXRenderer latex={toConicFormulaLatex((entity.params.orientation ?? 'h') === 'v' ? 'y²/a² − x²/b² = 1' : 'x²/a² − y²/b² = 1')} />}
        {entity.type === 'parabola'  && <KaTeXRenderer latex={toConicFormulaLatex('y² = 2px')} />}
        {entity.type === 'circle'    && <KaTeXRenderer latex={toConicFormulaLatex('(x−cx)² + (y−cy)² = r²')} />}
      </div>

      {/* ── Ellipse ──────────────────────────────────────────────────── */}
      {entity.type === 'ellipse' && (() => {
        const ep = p as typeof entity.params;
        const bMax = Math.max(0.2, ep.a - 0.05);
        const cMax = Math.max(0.05, ep.a - 0.05);
        const orientation = ep.orientation ?? 'h';
        return (
          <>
            <OrientationToggle
              orientation={orientation}
              horizontalLabel="长轴沿 x 轴"
              verticalLabel="长轴沿 y 轴"
              onToggle={toggleConicOrientation}
            />
            <UniversalSlider label="a" value={ep.a} min={0.5} max={10} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => aSlider.handleChange(v)}
              onCommit={(v) => aSlider.handleCommit(v)} />
            <UniversalSlider label="b" value={ep.b} min={0.1} max={bMax} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => bSlider.handleChange(v)}
              onCommit={(v) => bSlider.handleCommit(v)} />
            <UniversalSlider label="c" value={entity.derived.c} min={0.05} max={cMax} step={0.1}
              color={COLORS.focusPoint}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cSlider.handleChange(v)}
              onCommit={(v) => cSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={ep.cx} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={ep.cy} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
          </>
        );
      })()}

      {/* ── Hyperbola ─────────────────────────────────────────────────── */}
      {entity.type === 'hyperbola' && (() => {
        const hp = p as typeof entity.params;
        const cMin = Math.sqrt(hp.a * hp.a + 0.05 * 0.05);
        const orientation = hp.orientation ?? 'h';
        return (
          <>
            <OrientationToggle
              orientation={orientation}
              horizontalLabel="实轴沿 x 轴"
              verticalLabel="实轴沿 y 轴"
              onToggle={toggleConicOrientation}
            />
            <UniversalSlider label="a" value={hp.a} min={0.5} max={10} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => aSlider.handleChange(v)}
              onCommit={(v) => aSlider.handleCommit(v)} />
            <UniversalSlider label="b" value={hp.b} min={0.5} max={10} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => bSlider.handleChange(v)}
              onCommit={(v) => bSlider.handleCommit(v)} />
            <UniversalSlider label="c" value={entity.derived.c} min={cMin} max={12} step={0.1}
              color={COLORS.focusPoint}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cSlider.handleChange(v)}
              onCommit={(v) => cSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={hp.cx} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={hp.cy} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
          </>
        );
      })()}

      {/* ── Parabola ──────────────────────────────────────────────────── */}
      {entity.type === 'parabola' && (() => {
        const pp = p as typeof entity.params;
        const isV = pp.orientation === 'v';
        return (
          <>
            {/* Orientation toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textDark }}>方向</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['h', 'v'] as const).map((dir) => {
                  const isActive = dir === pp.orientation;
                  return (
                    <button
                      key={dir}
                      onClick={isActive ? undefined : toggleParabolaOrientation}
                      style={{
                        padding: '4px 12px', fontSize: '12px', fontWeight: 600,
                        borderRadius: '4px', border: `1.5px solid ${isActive ? COLORS.primary : COLORS.borderMuted}`,
                        background: isActive ? `${COLORS.primary}22` : 'transparent',
                        color: isActive ? COLORS.primary : COLORS.textSecondary,
                        cursor: isActive ? 'default' : 'pointer',
                        transition: 'background 0.15s',
                      }}
                      {...(isActive ? {} : btnHover(COLORS.surfaceHover))}
                    >
                      {dir === 'h' ? 'y²=2p(x−cx)' : 'x²=2p(y−cy)'}
                    </button>
                  );
                })}
              </div>
            </div>
            <UniversalSlider label="p" value={pp.p} min={-10} max={10} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => pSlider.handleChange(v)}
              onCommit={(v) => pSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={pp.cx} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={pp.cy} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
            <p style={{ fontSize: '11px', color: COLORS.textSecondary, textAlign: 'right', marginTop: '-4px', marginBottom: '4px', fontFamily: 'monospace' }}>
              {isV
                ? `${pp.p >= 0 ? 'p>0 向上，p<0 向下' : 'p<0 向下，p>0 向上'}`
                : `${pp.p >= 0 ? 'p>0 向右，p<0 向左' : 'p<0 向左，p>0 向右'}`}
            </p>
          </>
        );
      })()}

      {/* ── Circle ────────────────────────────────────────────────────── */}
      {entity.type === 'circle' && (() => {
        const cp = p as typeof entity.params;
        return (
          <>
            <UniversalSlider label="r" value={cp.r} min={0.1} max={10} step={0.1}
              color={entity.color}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => rSlider.handleChange(v)}
              onCommit={(v) => rSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={cp.cx} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={cp.cy} min={-10} max={10} step={0.1}
              parseInput={parseConicParamInput}
              formatInputValue={(v) => formatConicValue(v, displayMode, 4)}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
          </>
        );
      })()}

      {/* Reset button */}
      <ResetButton onClick={() => handleReset(entity.type)} label="重置默认值" />

      {/* ── Compact eccentricity readout (non-circle) ──────────────── */}
      {entity.type !== 'circle' && <CompactEccentricity entity={entity} />}

    </div>
  );
}

// ─── Compact eccentricity section ─────────────────────────────────────────────

function CompactEccentricity({ entity }: { entity: ConicEntity }) {
  const activeEntityId = useEccentricityDemoStore((s) => s.activeEntityId);
  const sweepRange = useEccentricityDemoStore((s) => s.sweepRange);
  const speed = useEccentricityDemoStore((s) => s.speed);
  const playState = useEccentricityDemoStore((s) => s.playState);
  const setActiveDemoEntity = useEccentricityDemoStore((s) => s.setActiveEntity);
  const currentE = getEntityEccentricity(entity);
  const effectiveRange = activeEntityId === entity.id ? sweepRange : defaultSweepRange(entity);
  const speedPercent = `${Math.round(speed * 100)}%`;

  useEffect(() => {
    if (activeEntityId === entity.id) return;
    setActiveDemoEntity(entity.id, defaultSweepRange(entity));
  }, [activeEntityId, entity, setActiveDemoEntity]);

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.textPrimary }}>离心率</span>
        <span style={{
          fontSize: '13px', fontWeight: 700,
          color: entity.color, fontFamily: 'monospace',
        }}>
          {eccentricityTypeLabel(currentE)}  e = {currentE.toFixed(4)}
        </span>
      </div>

      <EccentricityZoneBar e={currentE} color={entity.color} />

      <p style={{
        fontSize: '10px',
        color: COLORS.textSecondary,
        marginTop: 4,
        marginBottom: 6,
        lineHeight: 1.5,
      }}>
        右侧“离心率演变”面板现已支持速度调节、播放、暂停与停止。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
        {([
          { value: 'ellipse-only', label: '仅椭圆' },
          { value: 'ellipse-to-parabola', label: '到抛物线' },
          { value: 'hyperbola-only', label: '仅双曲线' },
          { value: 'full-conics', label: '全部' },
        ] as Array<{ value: ReturnType<typeof defaultSweepRange>; label: string }>).map((option) => {
          const active = option.value === effectiveRange;
          return (
            <div
              key={option.value}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${active ? COLORS.primary : COLORS.borderMuted}`,
                background: active ? `${COLORS.primary}18` : COLORS.surface,
                color: active ? COLORS.primary : COLORS.textSecondary,
                fontSize: '10px',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              {option.label}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 8,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        <div
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            background: COLORS.surfaceAlt,
            color: COLORS.textDark,
            fontSize: '11px',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          速度 {speedPercent}
        </div>
        <div
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            background: playState === 'playing'
              ? `${COLORS.primary}18`
              : playState === 'paused'
                ? `${COLORS.warning}18`
                : COLORS.surfaceAlt,
            color: playState === 'playing'
              ? COLORS.primary
              : playState === 'paused'
                ? '#B45309'
                : COLORS.textSecondary,
            fontSize: '11px',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {playState === 'playing' ? '播放中' : playState === 'paused' ? '已暂停' : '待播放'}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          marginTop: 8,
          padding: '6px 8px',
          borderRadius: 6,
          fontSize: '10px',
          lineHeight: 1.5,
          border: `1px dashed ${COLORS.borderMuted}`,
          background: COLORS.surface,
          color: COLORS.textSecondary,
        }}
      >
        当前范围：{sweepRangeBounds(effectiveRange, currentE).label}。需要控制椭圆到双曲线的演示节奏时，使用下方独立“离心率演变”面板中的速度滑块和播放/暂停按钮。
      </div>
    </div>
  );
}

function OrientationToggle({
  orientation,
  horizontalLabel,
  verticalLabel,
  onToggle,
}: {
  orientation: ConicAxisOrientation;
  horizontalLabel: string;
  verticalLabel: string;
  onToggle: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textDark }}>方向</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['h', 'v'] as const).map((dir) => {
          const isActive = dir === orientation;
          return (
            <button
              key={dir}
              onClick={isActive ? undefined : onToggle}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '4px',
                border: `1.5px solid ${isActive ? COLORS.primary : COLORS.borderMuted}`,
                background: isActive ? `${COLORS.primary}22` : 'transparent',
                color: isActive ? COLORS.primary : COLORS.textSecondary,
                cursor: isActive ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
              {...(isActive ? {} : btnHover(COLORS.surfaceHover))}
            >
              {dir === 'h' ? horizontalLabel : verticalLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
