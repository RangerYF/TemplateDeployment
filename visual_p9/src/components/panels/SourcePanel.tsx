import { DATA_SOURCES } from '@/data/celestialData';
import { COLORS } from '@/styles/tokens';

export function SourcePanel() {
  return (
    <div className="space-y-2">
      {DATA_SOURCES.map((source) => (
        <div key={source.id} className="rounded-xl border p-3" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
          <div className="text-xs font-semibold" style={{ color: COLORS.text }}>{source.item}</div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>{source.value}</div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textPlaceholder }}>{source.source}</div>
        </div>
      ))}
    </div>
  );
}
