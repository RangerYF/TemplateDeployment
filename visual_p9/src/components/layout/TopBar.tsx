import { CELESTIAL_MODELS } from '@/data/celestialData';
import { useActiveModel, useSimulationStore } from '@/store/simulationStore';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { cn } from '@/lib/utils/cn';

export function TopBar() {
  const activeModel = useActiveModel();
  const currentModelId = useSimulationStore((state) => state.currentModelId);
  const selectModel = useSimulationStore((state) => state.selectModel);
  const isPlaying = useSimulationStore((state) => state.isPlaying);
  const setPlaying = useSimulationStore((state) => state.setPlaying);

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4"
      style={{ background: COLORS.bg, borderColor: COLORS.border, boxShadow: SHADOWS.sm }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: COLORS.dark, color: COLORS.white }}>
          P09
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold" style={{ color: COLORS.text }}>
            天体运动与引力模拟器
          </h1>
          <div className="truncate text-[11px]" style={{ color: COLORS.textPlaceholder }}>
            {activeModel.id} · {activeModel.name_cn}
          </div>
        </div>
      </div>

      <nav className="hidden items-center gap-1 overflow-x-auto rounded-xl px-2 py-1 md:flex" style={{ background: COLORS.bgMuted }}>
        {CELESTIAL_MODELS.map((model) => {
          const active = model.id === currentModelId;
          return (
            <button
              key={model.id}
              className={cn('whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all')}
              style={{
                background: active ? COLORS.primary : 'transparent',
                color: active ? COLORS.white : COLORS.textMuted,
              }}
              onClick={() => selectModel(model.id)}
            >
              {model.shortName}
            </button>
          );
        })}
      </nav>

      <button
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
        style={{ background: isPlaying ? COLORS.primaryLight : COLORS.primary, color: isPlaying ? COLORS.primary : COLORS.white }}
        onClick={() => setPlaying(!isPlaying)}
      >
        {isPlaying ? '暂停' : '播放'}
      </button>
    </header>
  );
}
