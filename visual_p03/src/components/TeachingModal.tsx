import { useModuleStore } from '@/store/moduleStore';
import { useSimulationStore } from '@/store/simulationStore';
import { REFRACTION_EXPERIMENTS } from '@/data/refractionData';
import { LENS_EXPERIMENTS } from '@/data/lensData';
import { DOUBLESLIT_EXPERIMENTS } from '@/data/doubleSlitData';
import { DIFFRACTION_EXPERIMENTS } from '@/data/diffractionData';
import { THINFILM_EXPERIMENTS } from '@/data/thinFilmData';
import { useDoubleSlitStore } from '@/store/doubleSlitStore';
import { useDiffractionStore } from '@/store/diffractionStore';
import { useThinFilmStore } from '@/store/thinFilmStore';
import { useLensStore } from '@/store/lensStore';

interface Props {
  onClose: () => void;
}

function getExperimentData(mod: string, refrExpId: string, lensExpId: string, dblExpId: string, diffExpId: string, tfExpId: string) {
  switch (mod) {
    case 'refraction': return REFRACTION_EXPERIMENTS.find((e) => e.id === refrExpId);
    case 'lens': return LENS_EXPERIMENTS.find((e) => e.id === lensExpId);
    case 'doubleslit': return DOUBLESLIT_EXPERIMENTS.find((e) => e.id === dblExpId);
    case 'diffraction': return DIFFRACTION_EXPERIMENTS.find((e) => e.id === diffExpId);
    case 'thinfilm': return THINFILM_EXPERIMENTS.find((e) => e.id === tfExpId);
    default: return null;
  }
}

export function TeachingModal({ onClose }: Props) {
  const mod = useModuleStore((s) => s.activeModule);
  const refrExpId = useSimulationStore((s) => s.settings.experimentId);
  const lensExpId = useLensStore((s) => s.currentExperimentId);
  const dblExpId = useDoubleSlitStore((s) => s.currentExperimentId ?? 'opt-021');
  const diffExpId = useDiffractionStore((s) => s.currentExperimentId ?? 'opt-031');
  const tfExpId = useThinFilmStore((s) => s.currentExperimentId ?? 'opt-043');

  const exp = getExperimentData(mod, refrExpId, lensExpId, dblExpId, diffExpId, tfExpId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
        style={{
          background: 'var(--theme-panel-bg)',
          border: '1px solid var(--theme-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>
              {exp?.title ?? '教学要点'}
            </h2>
            {exp?.summary && (
              <p className="mt-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                {exp.summary}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:opacity-70"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            ×
          </button>
        </div>

        {exp?.formulas && exp.formulas.length > 0 && (
          <div className="mb-4">
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              核心公式
            </h3>
            <div className="space-y-2">
              {exp.formulas.map((f: string, i: number) => (
                <div
                  key={i}
                  className="rounded-lg px-3 py-2 text-sm font-mono"
                  style={{
                    background: 'var(--theme-surface-hover)',
                    color: 'var(--theme-text)',
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {exp?.teachingPoints && exp.teachingPoints.length > 0 && (
          <div>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              教学要点
            </h3>
            <ul className="space-y-1.5">
              {exp.teachingPoints.map((point: string, i: number) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  <span style={{ color: 'var(--theme-primary)' }}>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!exp && (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            当前实验暂无教学要点数据。
          </p>
        )}
      </div>
    </div>
  );
}
