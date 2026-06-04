import { useState } from 'react';
import { SHAPES } from '@/data/refractionData';
import { useSimulationStore } from '@/store/simulationStore';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

export function SceneOverlay() {
  const [open, setOpen] = useState(true);
  const shape = useSimulationStore((s) => s.settings.shape);
  const selectExperiment = useSimulationStore((s) => s.selectExperiment);
  const currentLabel = SHAPES.find((s) => s.id === shape)?.label ?? '实验';

  return (
    <div
      className="absolute left-4 top-4 z-10 overflow-hidden transition-all duration-300"
      style={{
        ...glass,
        width: open ? 180 : 'auto',
        maxHeight: open ? '70vh' : 40,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center justify-between px-4 py-2.5"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold text-white/90">
          {open ? '实验场景' : currentLabel}
        </span>
        <span
          className="text-sm text-white/40 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : '' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => { selectExperiment(s.experimentId); setOpen(false); }}
              className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
              style={
                s.id === shape
                  ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
