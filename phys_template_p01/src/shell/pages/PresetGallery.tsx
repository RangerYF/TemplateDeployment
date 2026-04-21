import { presetRegistry } from '@/core/registries/preset-registry';
import { COLORS } from '@/styles/tokens';
import type { PresetData } from '@/core/types';

const CATEGORY_LABELS: Record<string, string> = {
  'P-01': '力学',
  'P-02': '电磁学',
  'P-03': '热学',
  'P-04': '光学',
};

/** 分组入口：将同 group 的预设合并为一个入口卡片 */
interface GroupEntry {
  type: 'group';
  group: string;
  groupLabel: string;
  presets: PresetData[]; // 按 groupOrder 排序
}

interface SingleEntry {
  type: 'single';
  preset: PresetData;
}

type GalleryEntry = GroupEntry | SingleEntry;

function buildEntries(presets: PresetData[]): GalleryEntry[] {
  const groupMap = new Map<string, { label: string; presets: PresetData[] }>();
  const singles: PresetData[] = [];

  for (const p of presets) {
    if (p.group) {
      const existing = groupMap.get(p.group);
      if (existing) {
        existing.presets.push(p);
      } else {
        groupMap.set(p.group, { label: p.groupLabel ?? p.group, presets: [p] });
      }
    } else {
      singles.push(p);
    }
  }

  const entries: GalleryEntry[] = [];

  // 独立预设
  for (const p of singles) {
    entries.push({ type: 'single', preset: p });
  }

  // 分组入口
  for (const [group, data] of groupMap) {
    data.presets.sort((a, b) => (a.groupOrder ?? 100) - (b.groupOrder ?? 100));
    entries.push({ type: 'group', group, groupLabel: data.label, presets: data.presets });
  }

  return entries;
}

interface PresetGalleryProps {
  onSelectPreset: (presetId: string) => void;
}

export function PresetGallery({ onSelectPreset }: PresetGalleryProps) {
  const categories = presetRegistry.getCategories();

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      {/* 顶栏 */}
      <header
        className="flex items-center px-6 py-4"
        style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg }}
      >
        <h1 className="text-lg font-semibold" style={{ color: COLORS.text }}>
          物理模拟器
        </h1>
        <span className="ml-3 text-xs" style={{ color: COLORS.textMuted }}>
          选择一个预设场景开始
        </span>
      </header>

      {/* 预设网格 */}
      <main className="flex-1 overflow-y-auto p-6">
        {categories.map((cat) => {
          const presets = presetRegistry.getByCategory(cat);
          const entries = buildEntries(presets);
          return (
            <section key={cat} className="mb-8">
              <h2
                className="mb-4 text-sm font-semibold"
                style={{ color: COLORS.textSecondary }}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {entries.map((entry) => {
                  if (entry.type === 'single') {
                    return (
                      <PresetCard
                        key={entry.preset.id}
                        preset={entry.preset}
                        onClick={() => onSelectPreset(entry.preset.id)}
                      />
                    );
                  }

                  // 分组入口：直接加载首个子类型
                  return (
                    <button
                      key={entry.group}
                      onClick={() => onSelectPreset(entry.presets[0]!.id)}
                      className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md"
                      style={{
                        backgroundColor: COLORS.bg,
                        borderColor: COLORS.border,
                      }}
                    >
                      <div
                        className="mb-3 flex h-24 items-center justify-center rounded-lg text-2xl"
                        style={{ backgroundColor: COLORS.bgMuted }}
                      >
                        📎
                      </div>
                      <span
                        className="text-sm font-medium group-hover:text-[color:var(--hover-color)]"
                        style={{
                          color: COLORS.text,
                          '--hover-color': COLORS.primary,
                        } as React.CSSProperties}
                      >
                        {entry.groupLabel}
                      </span>
                      <span
                        className="mt-1 text-xs"
                        style={{ color: COLORS.textMuted }}
                      >
                        {entry.presets.length} 个子类型
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

// ─── 预设卡片 ───

function PresetCard({
  preset,
  onClick,
  compact,
}: {
  preset: PresetData;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:shadow-md"
      style={{
        backgroundColor: COLORS.bg,
        borderColor: COLORS.border,
      }}
    >
      {!compact && (
        <div
          className="mb-3 flex h-24 items-center justify-center rounded-lg text-2xl"
          style={{ backgroundColor: COLORS.bgMuted }}
        >
          {preset.supportedViewports.includes('force') ? '⚖️' : '⚡'}
        </div>
      )}

      <span
        className="text-sm font-medium group-hover:text-[color:var(--hover-color)]"
        style={{
          color: COLORS.text,
          '--hover-color': COLORS.primary,
        } as React.CSSProperties}
      >
        {preset.name}
      </span>

      <span
        className="mt-1 line-clamp-2 text-xs"
        style={{ color: COLORS.textMuted }}
      >
        {preset.description}
      </span>

      {!compact && (
        <div className="mt-2 flex items-center gap-2">
          {preset.duration === 0 && (
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              静态
            </span>
          )}
          {preset.duration > 0 && (
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {preset.duration}s 动画
            </span>
          )}
        </div>
      )}
    </button>
  );
}
