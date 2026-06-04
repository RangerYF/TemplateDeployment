/**
 * LensSceneOverlay.tsx
 * Glassmorphism overlay for switching lens presets (u>2f, u=2f, etc.)
 * Follows the same pattern as SceneOverlay.tsx for refraction.
 */

import { useState } from 'react';
import { useLensStore } from '@/store/lensStore';
import { LENS_TYPES } from '@/data/lensData';
import type { LensExperimentId } from '@/data/lensData';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

const LENS_PRESETS: { id: LensExperimentId; label: string }[] = [
  { id: 'opt-011', label: '凸透镜成像' },
  { id: 'opt-012', label: '凹透镜成像' },
];

export function LensSceneOverlay() {
  const [open, setOpen] = useState(true);
  const currentId = useLensStore((s) => s.currentExperimentId);
  const selectExperiment = useLensStore((s) => s.selectExperiment);
  const currentLabel = LENS_PRESETS.find((p) => p.id === currentId)?.label ?? '透镜实验';

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
          {open ? '透镜实验' : currentLabel}
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
          {LENS_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                selectExperiment(p.id);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors"
              style={
                p.id === currentId
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
