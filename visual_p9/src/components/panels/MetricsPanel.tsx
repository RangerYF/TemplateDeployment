import { buildFrame } from '@/engine/orbitalMechanics';
import { useActiveParams, useSimulationStore } from '@/store/simulationStore';

export function MetricsPanel() {
  const { currentModelId, elapsedSeconds, hohmannPhase, hohmannIgnitionAngle } =
    useSimulationStore();
  const params = useActiveParams();
  const frame = buildFrame(
    currentModelId,
    params,
    elapsedSeconds,
    hohmannPhase,
    hohmannIgnitionAngle,
  );
  const { metrics } = frame;

  return (
    <div className="space-y-1">
      {metrics.values.map((v, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-1.5"
          style={{
            borderBottom:
              i < metrics.values.length - 1
                ? '1px solid var(--theme-border)'
                : 'none',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {v.label}
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: 'var(--theme-text)' }}
          >
            {v.value}
          </span>
        </div>
      ))}
      {metrics.insight && (
        <p
          className="text-xs mt-2 leading-relaxed"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {metrics.insight}
        </p>
      )}
    </div>
  );
}
