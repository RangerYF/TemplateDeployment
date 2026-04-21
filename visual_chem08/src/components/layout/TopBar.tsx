import { COLORS } from '@/styles/tokens';
import { useUIStore, type ActiveTab } from '@/store';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'curve', label: 'pH 曲线' },
  { id: 'comparison', label: '曲线对比' },
  { id: 'buffer', label: '缓冲溶液' },
];

export function TopBar() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  return (
    <div
      className="flex items-center gap-4 px-5 py-2.5 border-b shrink-0"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center rounded-lg font-bold text-white text-sm"
        style={{
          width: 36,
          height: 36,
          background: COLORS.gradientPrimary,
          borderRadius: 10,
        }}
      >
        pH
      </div>

      {/* Title */}
      <span
        className="font-semibold text-base whitespace-nowrap"
        style={{ color: COLORS.text }}
      >
        酸碱滴定与 pH 模拟器
      </span>

      {/* Separator */}
      <div style={{ width: 1, height: 24, backgroundColor: COLORS.border }} />

      {/* Tab buttons */}
      <div
        className="flex items-center gap-1 px-1 py-1 rounded-full"
        style={{ backgroundColor: COLORS.bgMuted }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
              style={{
                backgroundColor: isActive ? COLORS.primary : 'transparent',
                color: isActive ? COLORS.white : COLORS.textMuted,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
