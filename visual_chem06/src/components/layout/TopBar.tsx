import type { ReactNode } from 'react';
import { Activity, ArrowLeftRight, Zap } from 'lucide-react';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { COLORS } from '@/styles/tokens';
import { getCurrentModel, getCurrentScenario, useElectrochemStore } from '@/store/electrochemStore';

export function TopBar() {
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const selectedScenarioId = useElectrochemStore((state) => state.selectedScenarioId);
  const playing = useElectrochemStore((state) => state.playing);
  const speed = useElectrochemStore((state) => state.speed);

  const model = getCurrentModel({ selectedModelId });
  const scenario = getCurrentScenario({ selectedModelId, selectedScenarioId });

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: COLORS.primaryLight, color: COLORS.primary }}>
          <Zap size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-base font-semibold" style={{ color: COLORS.text }}>电化学演示台</h1>
            <LevelBadge level={model.level} />
            <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: COLORS.bgMuted, color: COLORS.textSecondary }}>
              {model.subtype}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs" style={{ color: COLORS.textMuted }}>
            <span>{model.title}</span>
            <span>·</span>
            <span>{scenario.label}</span>
            <span>·</span>
            <span>{scenario.loopLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <StatusChip icon={<Activity size={12} />} label={playing ? '播放中' : '已暂停'} active={playing} />
        <StatusChip icon={<ArrowLeftRight size={12} />} label={`${speed}x`} active />
      </div>
    </header>
  );
}

interface StatusChipProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

function StatusChip({ icon, label, active = false }: StatusChipProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium"
      style={{
        background: active ? COLORS.primaryLight : COLORS.bgMuted,
        color: active ? COLORS.primary : COLORS.textSecondary,
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

