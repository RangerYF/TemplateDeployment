import { COLORS, RADIUS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { cn } from '@/lib/utils/cn';
import { CRYSTAL_CATEGORIES } from '@/data/crystalCategories';
import { getCrystalById } from '@/data/crystalRepository';
import type { CrystalCategory, PackingType } from '@/engine/types';

const PACKING_TYPES: { type: PackingType; label: string }[] = [
  { type: 'SC', label: 'SC' },
  { type: 'BCC', label: 'BCC' },
  { type: 'FCC', label: 'FCC' },
  { type: 'HCP', label: 'HCP' },
];

export function TopBar() {
  const activeTab = useCrystalStore((s) => s.activeTab);
  const setActiveTab = useCrystalStore((s) => s.setActiveTab);
  const packingType = useCrystalStore((s) => s.packingType);
  const setPackingType = useCrystalStore((s) => s.setPackingType);

  return (
    <div
      className="h-14 flex items-center px-4 gap-4 shrink-0"
      style={{
        backgroundColor: COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Left: Title */}
      <h1
        className="text-base font-bold whitespace-nowrap mr-4"
        style={{ color: COLORS.text }}
      >
        化学键与晶体结构查看器
      </h1>

      {/* Center: Tab switch */}
      <div className="flex items-center gap-1">
        <TabButton
          label="晶体查看"
          active={activeTab === 'crystal'}
          onClick={() => setActiveTab('crystal')}
        />
        <TabButton
          label="堆积演示"
          active={activeTab === 'packing'}
          onClick={() => setActiveTab('packing')}
        />
      </div>

      {/* Divider */}
      <div
        className="w-px h-6 mx-2"
        style={{ backgroundColor: COLORS.border }}
      />

      {/* Context-dependent filter buttons */}
      {activeTab === 'crystal' ? (
        <CrystalCategoryFilters />
      ) : (
        <div className="flex items-center gap-1">
          {PACKING_TYPES.map((p) => (
            <FilterButton
              key={p.type}
              label={p.label}
              active={packingType === p.type}
              onClick={() => setPackingType(p.type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crystal category filter buttons (visible when activeTab = 'crystal')
// ---------------------------------------------------------------------------

function CrystalCategoryFilters() {
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const selected = getCrystalById(selectedCrystalId);
  const activeCategory: CrystalCategory | null = selected?.category ?? null;

  return (
    <div className="flex items-center gap-1">
      {CRYSTAL_CATEGORIES.map((cat) => (
        <FilterButton
          key={cat.id}
          label={cat.name}
          active={activeCategory === cat.id}
          onClick={() => {
            // Scroll to category section in left panel
            const el = document.getElementById(`crystal-cat-${cat.id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable button components
// ---------------------------------------------------------------------------

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn('px-4 py-1.5 text-sm font-medium transition-colors')}
      style={{
        borderRadius: RADIUS.sm,
        backgroundColor: active ? COLORS.primary : 'transparent',
        color: active ? COLORS.white : COLORS.textSecondary,
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn('px-3 py-1 text-xs font-medium transition-colors')}
      style={{
        borderRadius: RADIUS.xs,
        backgroundColor: active ? COLORS.primaryLight : 'transparent',
        color: active ? COLORS.primary : COLORS.textMuted,
        border: active ? `1px solid ${COLORS.primary}` : '1px solid transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
