/**
 * DiffractionSceneOverlay.tsx
 * Glassmorphism overlay for switching between slit / circle / disk aperture types.
 * Follows the same pattern as LensSceneOverlay.tsx.
 */

import { useState } from 'react';
import { useDiffractionStore } from '@/store/diffractionStore';
import type { ApertureType, DiffractionExperimentId } from '@/data/diffractionData';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

const APERTURE_PRESETS: {
  aperture: ApertureType;
  experimentId: DiffractionExperimentId;
  label: string;
}[] = [
  { aperture: 'slit', experimentId: 'opt-031', label: '单缝衍射' },
  { aperture: 'circle', experimentId: 'opt-032', label: '圆孔衍射（艾里斑）' },
  { aperture: 'disk', experimentId: 'opt-032', label: '圆板衍射（泊松亮斑）' },
];

export function DiffractionSceneOverlay() {
  const [open, setOpen] = useState(true);
  const settings = useDiffractionStore((s) => s.settings);
  const updateSettings = useDiffractionStore((s) => s.updateSettings);
  const selectExperiment = useDiffractionStore((s) => s.selectExperiment);
  const currentAperture = settings.aperture;
  const currentLabel =
    APERTURE_PRESETS.find((p) => p.aperture === currentAperture)?.label ??
    '衍射实验';

  return (
    <div
      className="absolute left-4 top-4 z-10 overflow-hidden transition-all duration-300"
      style={{
        ...glass,
        width: open ? 200 : 'auto',
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
          {open ? '衍射实验' : currentLabel}
        </span>
        <span
          className="text-sm text-white/40 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : '' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-1 px-3 pb-3">
          {APERTURE_PRESETS.map((p) => (
            <button
              key={p.aperture}
              onClick={() => {
                selectExperiment(p.experimentId);
                updateSettings({ aperture: p.aperture });
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
              style={
                p.aperture === currentAperture
                  ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
