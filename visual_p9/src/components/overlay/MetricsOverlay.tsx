import { useState } from 'react';
import { buildFrame } from '@/engine/orbitalMechanics';
import { useActiveParams, useSimulationStore } from '@/store/simulationStore';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

export function MetricsOverlay() {
  const [open, setOpen] = useState(true);

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
    <div
      className="absolute bottom-4 left-4 z-10 overflow-hidden transition-all duration-300"
      style={{
        ...glass,
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: open ? '60vh' : 40,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-4 py-2.5"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold text-white/90">
          {metrics.title}
        </span>
        <span className="text-white/40 text-sm transition-transform" style={{ transform: open ? 'rotate(180deg)' : '' }}>
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {/* Metric rows */}
          <div className="space-y-0.5">
            {metrics.values.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1"
                style={{
                  borderBottom:
                    i < metrics.values.length - 1
                      ? '1px solid rgba(255,255,255,0.06)'
                      : 'none',
                }}
              >
                <span className="text-[11px] text-white/45">{v.label}</span>
                <span className="text-[11px] font-semibold tabular-nums text-white/85">
                  {v.value}
                </span>
              </div>
            ))}
          </div>

          {/* Insight */}
          {metrics.insight && (
            <p className="mt-2 text-[10px] leading-relaxed text-white/40">
              {metrics.insight}
            </p>
          )}

          {/* Scale label */}
          <p className="mt-1 text-[10px] text-white/30">
            {frame.scaleLabel}
          </p>
        </div>
      )}
    </div>
  );
}
