import { useActiveModel } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';

export function TeachingPanel() {
  const model = useActiveModel();

  return (
    <div className="space-y-2">
      {model.teaching_points.map((point) => (
        <div key={point} className="flex gap-2 text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLORS.primary }} />
          <span>{point}</span>
        </div>
      ))}
      <div className="rounded-xl px-3 py-2 text-[11px]" style={{ background: COLORS.primaryLight, color: COLORS.textMuted }}>
        动画重点：{model.animations.highlight.join(' / ')}
      </div>
    </div>
  );
}
