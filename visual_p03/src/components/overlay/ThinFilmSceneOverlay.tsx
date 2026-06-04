/**
 * ThinFilmSceneOverlay.tsx
 * Glassmorphism overlay for switching between newton / wedge / soap film types.
 * Follows the same pattern as LensSceneOverlay.tsx.
 */

import { useState } from 'react';
import { useThinFilmStore } from '@/store/thinFilmStore';
import { FILM_TYPES } from '@/data/thinFilmData';
import type { ThinFilmExperimentId } from '@/data/thinFilmData';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

const FILM_PRESETS: { id: ThinFilmExperimentId; label: string; desc: string }[] = [
  { id: 'opt-043', label: '牛顿环', desc: '同心圆等厚干涉' },
  { id: 'opt-042', label: '楔形薄膜', desc: '平行等厚条纹' },
  { id: 'opt-041', label: '肥皂泡', desc: '白光彩色条纹' },
];

export function ThinFilmSceneOverlay() {
  const [open, setOpen] = useState(true);
  const currentId = useThinFilmStore((s) => s.currentExperimentId);
  const selectExperiment = useThinFilmStore((s) => s.selectExperiment);
  const currentLabel = FILM_PRESETS.find((p) => p.id === currentId)?.label ?? '薄膜干涉';

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
          {open ? '薄膜干涉实验' : currentLabel}
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
          {FILM_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                selectExperiment(p.id);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left transition-colors"
              style={
                p.id === currentId
                  ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              <div className="text-xs font-medium">{p.label}</div>
              <div className="text-[10px] opacity-60 mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
