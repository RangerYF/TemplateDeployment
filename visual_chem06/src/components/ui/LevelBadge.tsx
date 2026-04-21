import { COLORS } from '@/styles/tokens';
import type { LevelTag } from '@/types/electrochem';

const LEVEL_STYLE: Record<LevelTag, { bg: string; color: string }> = {
  '[高中必修]': { bg: '#EBF8FF', color: '#2B6CB0' },
  '[高中选修]': { bg: '#FAF5FF', color: '#6B46C1' },
  '[拓展]': { bg: '#FFFAF0', color: '#C05621' },
};

interface LevelBadgeProps {
  level: LevelTag;
}

export function LevelBadge({ level }: LevelBadgeProps) {
  const style = LEVEL_STYLE[level] ?? { bg: COLORS.bgMuted, color: COLORS.textSecondary };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {level}
    </span>
  );
}
