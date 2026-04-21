import { useRef, useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { useActiveConic } from '@/hooks/useActiveEntity';
import { useParamSlider } from '@/hooks/useParamSlider';
import { useEntityStore } from '@/editor/store/entityStore';
import { updateEntityParams } from '@/editor/entities/types';
import { UpdateCurveParamCommand } from '@/editor/commands/UpdateCurveParamCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { UniversalSlider, ResetButton } from '@/components/shared/UniversalSlider';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import {
  getEntityEccentricity,
  getEntityFixedC,
  startEccentricityAnimation,
} from '@/engine/eccentricityEngine';
import { EccentricityZoneBar } from '@/components/panels/EccentricityPanel';
import type { ConicEntity } from '@/types';
import { isConicEntity } from '@/types';

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

/** Safety: clamp value to avoid division-by-zero or degenerate shapes. */
function safeClamp(key: string, value: number, entityType: string): number {
  // Prevent b=0 or a=0 which causes division by zero in ellipse/hyperbola
  if ((key === 'a' || key === 'b' || key === 'p' || key === 'r') && value < 0.05) {
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
  const safe = safeClamp(key, value, e.type);
  store.updateEntity(e.id, updateEntityParams(e, { [key]: safe } as never));
}

function commitParam(key: string, before: number, after: number): void {
  if (before === after) return;
  const store       = useEntityStore.getState();
  const afterEntity = store.entities.find((en) => en.id === store.activeEntityId);
  if (!afterEntity || !isConicEntity(afterEntity)) return;
  const beforeEntity = updateEntityParams(afterEntity, { [key]: before } as never);
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
      <p style={{ fontSize: '12px', color: COLORS.textDark, marginBottom: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
        {entity.type === 'ellipse'   && 'x²/a² + y²/b² = 1'}
        {entity.type === 'hyperbola' && 'x²/a² − y²/b² = 1'}
        {entity.type === 'parabola'  && 'y² = 2px'}
        {entity.type === 'circle'    && '(x−cx)² + (y−cy)² = r²'}
      </p>

      {/* ── Ellipse ──────────────────────────────────────────────────── */}
      {entity.type === 'ellipse' && (() => {
        const ep = p as typeof entity.params;
        const bMax = Math.max(0.2, ep.a - 0.05);
        return (
          <>
            <UniversalSlider label="a" value={ep.a} min={0.5} max={10} step={0.1}
              color={entity.color}
              onChange={(v) => aSlider.handleChange(v)}
              onCommit={(v) => aSlider.handleCommit(v)} />
            <UniversalSlider label="b" value={ep.b} min={0.1} max={bMax} step={0.1}
              color={entity.color}
              onChange={(v) => bSlider.handleChange(v)}
              onCommit={(v) => bSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={ep.cx} min={-10} max={10} step={0.1}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={ep.cy} min={-10} max={10} step={0.1}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
          </>
        );
      })()}

      {/* ── Hyperbola ─────────────────────────────────────────────────── */}
      {entity.type === 'hyperbola' && (() => {
        const hp = p as typeof entity.params;
        return (
          <>
            <UniversalSlider label="a" value={hp.a} min={0.5} max={10} step={0.1}
              color={entity.color}
              onChange={(v) => aSlider.handleChange(v)}
              onCommit={(v) => aSlider.handleCommit(v)} />
            <UniversalSlider label="b" value={hp.b} min={0.5} max={10} step={0.1}
              color={entity.color}
              onChange={(v) => bSlider.handleChange(v)}
              onCommit={(v) => bSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={hp.cx} min={-10} max={10} step={0.1}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={hp.cy} min={-10} max={10} step={0.1}
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
                      {dir === 'h' ? 'y²=2px →' : 'x²=2py ↑'}
                    </button>
                  );
                })}
              </div>
            </div>
            <UniversalSlider label="p" value={pp.p} min={0.1} max={10} step={0.1}
              color={entity.color}
              onChange={(v) => pSlider.handleChange(v)}
              onCommit={(v) => pSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={pp.cx} min={-10} max={10} step={0.1}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={pp.cy} min={-10} max={10} step={0.1}
              onChange={(v) => cySlider.handleChange(v)}
              onCommit={(v) => cySlider.handleCommit(v)} />
            <p style={{ fontSize: '11px', color: COLORS.textSecondary, textAlign: 'right', marginTop: '-4px', marginBottom: '4px', fontFamily: 'monospace' }}>
              {isV ? '(x−cx)² = 2p(y−cy)' : '(y−cy)² = 2p(x−cx)'}
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
              onChange={(v) => rSlider.handleChange(v)}
              onCommit={(v) => rSlider.handleCommit(v)} />
            <UniversalSlider label="cx" value={cp.cx} min={-10} max={10} step={0.1}
              onChange={(v) => cxSlider.handleChange(v)}
              onCommit={(v) => cxSlider.handleCommit(v)} />
            <UniversalSlider label="cy" value={cp.cy} min={-10} max={10} step={0.1}
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
  const cancelRef = useRef<(() => void) | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, [entity.id]);

  useEffect(() => {
    return () => { cancelRef.current?.(); };
  }, []);

  const currentE = getEntityEccentricity(entity);

  function handleAutoSweep() {
    if (isAnimating) return;
    const store = useEntityStore.getState();
    const raw   = store.entities.find((en) => en.id === entity.id);
    if (!raw || !isConicEntity(raw)) return;
    const live = raw;
    const fixedC = getEntityFixedC(live);

    setIsAnimating(true);
    const cancel = startEccentricityAnimation({
      entityId: live.id,
      fromE:    0.01,
      toE:      2.0,
      fixedC,
      duration: 3000,
      onComplete: () => {
        setIsAnimating(false);
        cancelRef.current = null;
      },
    });
    cancelRef.current = cancel;
  }

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

      <button
        onClick={handleAutoSweep}
        disabled={isAnimating}
        style={{
          width: '100%', marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: '5px 0',
          borderRadius: 6,
          fontSize: '12px', fontWeight: 600,
          border: 'none', cursor: isAnimating ? 'not-allowed' : 'pointer',
          background: isAnimating ? COLORS.border : `${COLORS.primary}22`,
          color: isAnimating ? COLORS.textDisabled : COLORS.primary,
          transition: 'background 0.15s',
        }}
        {...(isAnimating ? {} : btnHover(`${COLORS.primary}38`, `${COLORS.primary}22`))}
      >
        <Play size={11} />
        Auto Sweep ▶
      </button>
    </div>
  );
}
