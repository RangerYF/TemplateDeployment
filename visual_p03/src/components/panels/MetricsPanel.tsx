import { useMemo } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { solveRefraction } from '@/engine/refractionSolver';
import { fmt, deg, rad } from '@/engine/refractionGeometry';
import { SHAPES } from '@/data/refractionData';
import type { SolveResult } from '@/data/refractionData';
import { Readout } from './shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function edgeLabel(edge: SolveResult['firstEdge']): string {
  if (edge === 'interface') return '单界面';
  if (edge === 'top') return '上边界';
  if (edge === 'bottom') return '下边界';
  if (edge === 'left') return '左边界';
  if (edge === 'right') return '右边界';
  if (edge === 'arc') return '曲面';
  return '—';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MetricsPanel() {
  const settings = useSimulationStore((s) => s.settings);

  const result = useMemo(() => solveRefraction(settings), [settings]);

  const showSource2 =
    settings.showSource2 === true &&
    settings.shape !== 'apparent' &&
    settings.shape !== 'snellwindow';

  const result2 = useMemo(
    () =>
      showSource2
        ? solveRefraction({
            ...settings,
            sourceAngleDeg: settings.source2AngleDeg ?? 35,
            sourceAnchorX: settings.source2AnchorX ?? settings.sourceAnchorX,
            sourceY: settings.source2Y ?? 150,
          })
        : null,
    [settings, showSource2],
  );

  const shapeLabel =
    SHAPES.find((s) => s.id === settings.shape)?.label ?? '介质';

  return (
    <div className="space-y-0.5">
      {/* ── Standard readouts (non-snellwindow) ──────────────────── */}
      {settings.shape !== 'snellwindow' && (
        <>
          <Readout label="当前对象" value={shapeLabel} />
          <Readout label="状态" value={result.status} />
          <Readout label="路径模式" value={result.pathMode} />
          <Readout label="首次命中" value={edgeLabel(result.firstEdge)} />
          <Readout label="末次命中" value={edgeLabel(result.lastEdge)} />

          <Readout
            label="入射角"
            value={fmt(result.incidentDeg, 2)}
            unit={result.incidentDeg != null ? '°' : ''}
          />
          {result2 && (
            <Readout
              label="入射角 (对比)"
              value={fmt(result2.incidentDeg, 2)}
              unit={result2.incidentDeg != null ? '°' : ''}
            />
          )}

          <Readout
            label="折射角"
            value={fmt(result.refractedDeg, 2)}
            unit={result.refractedDeg != null ? '°' : ''}
            highlight
          />
          {result2 && (
            <Readout
              label="折射角 (对比)"
              value={fmt(result2.refractedDeg, 2)}
              unit={result2.refractedDeg != null ? '°' : ''}
              highlight
            />
          )}

          <Readout
            label="反射角"
            value={fmt(result.reflectedDeg, 2)}
            unit={result.reflectedDeg != null ? '°' : ''}
          />
          {result2 && (
            <Readout
              label="反射角 (对比)"
              value={fmt(result2.reflectedDeg, 2)}
              unit={result2.reflectedDeg != null ? '°' : ''}
            />
          )}

          {result.exitDeg !== undefined && (
            <Readout
              label="出射角"
              value={fmt(result.exitDeg, 2)}
              unit={result.exitDeg != null ? '°' : ''}
            />
          )}

          {result.criticalDeg !== undefined && (
            <Readout
              label="临界角"
              value={fmt(result.criticalDeg, 2)}
              unit={result.criticalDeg != null ? '°' : ''}
            />
          )}

          {result.shiftCm !== undefined && (
            <Readout
              label="侧向位移"
              value={fmt(result.shiftCm, 2)}
              unit={result.shiftCm != null ? 'cm' : ''}
            />
          )}

          {result.coreDeg !== undefined && (
            <Readout
              label="纤芯传播角"
              value={fmt(result.coreDeg, 2)}
              unit={result.coreDeg != null ? '°' : ''}
            />
          )}

          {result.effectiveWallDeg !== undefined && (
            <Readout
              label="壁面入射角"
              value={fmt(result.effectiveWallDeg, 2)}
              unit={result.effectiveWallDeg != null ? '°' : ''}
            />
          )}

          {result.realDepthCm != null && (
            <Readout
              label={
                (settings.apparentMode ?? 'depth') === 'depth'
                  ? '实际深度 h'
                  : '实际高度 h'
              }
              value={fmt(result.realDepthCm, 1)}
              unit="cm"
            />
          )}

          {result.apparentDepthCm != null && (
            <Readout
              label={
                (settings.apparentMode ?? 'depth') === 'depth'
                  ? "视深 h'"
                  : "视高 h'"
              }
              value={fmt(result.apparentDepthCm, 2)}
              unit="cm"
              highlight
            />
          )}
        </>
      )}

      {/* ── Snell window readouts ────────────────────────────────── */}
      {settings.shape === 'snellwindow' && (() => {
        const nW = settings.snellWaterN ?? 1.333;
        const depth = settings.snellSourceDepthCm ?? 8;
        const incDeg = settings.snellIncidentAngleDeg ?? 30;
        const critAngle = deg(Math.asin(Math.min(1, 1 / nW)));
        const windowR = depth * Math.tan(rad(critAngle));
        const sinR = Math.sin(rad(incDeg)) * nW;
        const isTIR = sinR > 1;
        const refractedDeg = isTIR ? null : deg(Math.asin(sinR));

        return (
          <>
            <Readout label="当前对象" value={shapeLabel} />
            <Readout label="入射角 θ₁" value={incDeg.toFixed(0)} unit="°" />
            <Readout
              label="折射角 θ₂"
              value={isTIR ? '全反射' : refractedDeg!.toFixed(1)}
              unit={isTIR ? '' : '°'}
              highlight
            />
            <Readout label="临界角 θc" value={critAngle.toFixed(1)} unit="°" />
            <Readout
              label="光源形态"
              value={
                (settings.snellSourceShape ?? 'point') === 'line'
                  ? '线光源'
                  : (settings.snellSourceShape ?? 'point') === 'polygon'
                    ? '多边形光源'
                    : '点光源'
              }
            />
            {(settings.snellSourceShape ?? 'point') !== 'point' && (
              <Readout
                label="光源尺寸"
                value={fmt(settings.snellSourceSizeCm ?? 4, 1)}
                unit="cm"
              />
            )}
            <Readout label="水折射率 n" value={nW.toFixed(3)} />
            <Readout label="水深 h" value={depth.toFixed(1)} unit="cm" />
            <Readout
              label="斯涅尔窗半径 r"
              value={windowR.toFixed(2)}
              unit="cm"
              highlight
            />
          </>
        );
      })()}

    </div>
  );
}
