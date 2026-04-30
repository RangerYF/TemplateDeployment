import { buildFrame } from '@/engine/orbitalMechanics';
import { useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';

export function MetricsPanel() {
  const modelId = useSimulationStore((state) => state.currentModelId);
  const elapsedSeconds = useSimulationStore((state) => state.elapsedSeconds);
  const phase = useSimulationStore((state) => state.hohmannPhase);
  const ignitionAngle = useSimulationStore((state) => state.hohmannIgnitionAngle);
  const params = useActiveParams();
  const metrics = buildFrame(modelId, params, elapsedSeconds, phase, ignitionAngle).metrics;

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold" style={{ color: COLORS.text }}>{metrics.title}</h4>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>{metrics.insight}</p>
      </div>
      <div className="space-y-1.5">
        {metrics.values.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="rounded-xl border px-3 py-2"
            style={{ borderColor: COLORS.border, background: COLORS.bg }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{item.label}</span>
              <span className="text-xs font-semibold text-right" style={{ color: COLORS.text }}>{item.value}</span>
            </div>
            {item.note && <div className="mt-1 text-[11px]" style={{ color: COLORS.textPlaceholder }}>{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
