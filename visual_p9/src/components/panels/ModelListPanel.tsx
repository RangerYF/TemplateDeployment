import { CELESTIAL_MODELS } from '@/data/celestialData';
import { useSimulationStore } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';
import { cn } from '@/lib/utils/cn';

interface ModelListPanelProps {
  widthPx?: number;
}

export function ModelListPanel({ widthPx = 232 }: ModelListPanelProps) {
  const currentModelId = useSimulationStore((state) => state.currentModelId);
  const selectModel = useSimulationStore((state) => state.selectModel);

  return (
    <aside
      className="hidden shrink-0 overflow-y-auto border-r lg:block"
      style={{ width: widthPx, borderColor: COLORS.border, background: COLORS.bg }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: COLORS.border }}>
        <div className="text-xs font-semibold tracking-wider" style={{ color: COLORS.text }}>
          天体模型
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textPlaceholder }}>
          P09 · 高中物理万有引力
        </div>
      </div>
      <div className="space-y-2 p-3">
        {CELESTIAL_MODELS.map((model) => {
          const active = model.id === currentModelId;
          return (
            <button
              key={model.id}
              className={cn('w-full rounded-[18px] border p-3 text-left transition-all hover:shadow-sm')}
              style={{
                borderColor: active ? COLORS.primary : COLORS.border,
                background: active ? COLORS.primaryLight : COLORS.bg,
              }}
              onClick={() => selectModel(model.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: active ? COLORS.primary : COLORS.bgMuted, color: active ? COLORS.white : COLORS.textMuted }}
                >
                  {model.shortName.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold" style={{ color: COLORS.text }}>{model.shortName}</div>
                  <div className="text-[11px]" style={{ color: COLORS.textPlaceholder }}>{model.id}</div>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                {model.teaching_points[0]}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
