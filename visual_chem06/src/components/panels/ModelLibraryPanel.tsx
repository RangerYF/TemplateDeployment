import { useMemo, type ReactNode } from 'react';
import { FlaskConical, BatteryCharging, Zap } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { getFilteredModels, type FamilyFilter, useElectrochemStore } from '@/store/electrochemStore';

const FAMILY_OPTIONS: { value: FamilyFilter; label: string }[] = [
  { value: 'all', label: '全部模型' },
  { value: 'galvanic', label: '原电池 / 燃料电池' },
  { value: 'electrolytic', label: '电解池 / 电镀' },
];

export function ModelLibraryPanel() {
  const models = useElectrochemStore((state) => state.models);
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const searchQuery = useElectrochemStore((state) => state.searchQuery);
  const familyFilter = useElectrochemStore((state) => state.familyFilter);
  const setSearchQuery = useElectrochemStore((state) => state.setSearchQuery);
  const setFamilyFilter = useElectrochemStore((state) => state.setFamilyFilter);
  const selectModel = useElectrochemStore((state) => state.selectModel);

  const filteredModels = useMemo(() => getFilteredModels(models, familyFilter, searchQuery), [models, familyFilter, searchQuery]);
  const grouped = useMemo(() => ({ galvanic: filteredModels.filter((model) => model.family === 'galvanic'), electrolytic: filteredModels.filter((model) => model.family === 'electrolytic') }), [filteredModels]);

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden border-r" style={{ borderColor: COLORS.border, background: COLORS.bg, boxShadow: SHADOWS.sm }}>
      <div className="border-b px-4 py-4" style={{ borderColor: COLORS.border }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>模型库</h2>
            <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>13 个预设模型，按 PRD 约束固定配置。</p>
          </div>
          <div className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: COLORS.primaryLight, color: COLORS.primary }}>C-06</div>
        </div>
        <div className="mt-4"><SearchInput value={searchQuery} onChange={setSearchQuery} /></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FAMILY_OPTIONS.map((option) => {
            const active = familyFilter === option.value;
            return (
              <button key={option.value} type="button" className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors" style={{ background: active ? COLORS.primary : COLORS.bgMuted, color: active ? COLORS.white : COLORS.textSecondary }} onClick={() => setFamilyFilter(option.value)}>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ModelSection title="原电池 / 可充电" icon={<BatteryCharging size={14} />} items={grouped.galvanic} selectedModelId={selectedModelId} onSelect={selectModel} />
        <ModelSection title="电解 / 电镀" icon={<Zap size={14} />} items={grouped.electrolytic} selectedModelId={selectedModelId} onSelect={selectModel} />
        {filteredModels.length === 0 ? <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: COLORS.border, color: COLORS.textMuted }}>没有匹配模型，尝试搜索“盐桥”“电镀”或“充电”。</div> : null}
      </div>
    </aside>
  );
}

interface ModelSectionProps {
  title: string;
  icon: ReactNode;
  items: ReturnType<typeof useElectrochemStore.getState>['models'];
  selectedModelId: string;
  onSelect: (id: string) => void;
}

function ModelSection({ title, icon, items, selectedModelId, onSelect }: ModelSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>{icon}<span>{title}</span></div>
      <div className="space-y-3">
        {items.map((model) => {
          const active = model.id === selectedModelId;
          return (
            <button key={model.id} type="button" className="w-full rounded-[18px] border px-4 py-4 text-left transition-all" style={{ borderColor: active ? COLORS.primary : COLORS.border, background: active ? COLORS.primaryLight : COLORS.bg, boxShadow: active ? '0 10px 28px rgba(0, 192, 107, 0.12)' : 'none' }} onClick={() => onSelect(model.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><FlaskConical size={14} color={active ? COLORS.primary : COLORS.textMuted} /><span className="text-sm font-semibold" style={{ color: COLORS.text }}>{model.title}</span></div>
                  <p className="mt-2 text-xs leading-5" style={{ color: COLORS.textSecondary }}>{model.summary}</p>
                </div>
                <LevelBadge level={model.level} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: COLORS.bgMuted, color: COLORS.textSecondary }}>{tag}</span>)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
