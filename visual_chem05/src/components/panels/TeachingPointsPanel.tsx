import { COLORS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { getCrystalById } from '@/data/crystalRepository';

export function TeachingPointsPanel() {
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const crystal = getCrystalById(selectedCrystalId);

  if (!crystal || crystal.teachingPoints.length === 0) {
    return (
      <p className="text-xs" style={{ color: COLORS.textPlaceholder }}>
        暂无教学要点
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {crystal.teachingPoints.map((point, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed">
          {/* Green bullet marker */}
          <span
            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: COLORS.primary }}
          />
          <span style={{ color: COLORS.text }}>{point}</span>
        </li>
      ))}
    </ul>
  );
}
