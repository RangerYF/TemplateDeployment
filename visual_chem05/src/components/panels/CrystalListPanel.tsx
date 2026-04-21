import { useState } from 'react';
import { useCrystalStore } from '@/store';
import { CRYSTAL_STRUCTURES, getCrystalsByCategory } from '@/data/crystalRepository';
import { CRYSTAL_CATEGORIES } from '@/data/crystalCategories';
import { COLORS, RADIUS } from '@/styles/tokens';
import { cn } from '@/lib/utils/cn';
import type { CrystalCategory, GradeLevel } from '@/engine/types';

// ---------------------------------------------------------------------------
// Grade level badge colors
// ---------------------------------------------------------------------------

const GRADE_BADGE_STYLES: Record<GradeLevel, { bg: string; color: string }> = {
  '高中必修': { bg: COLORS.successLight, color: COLORS.success },
  '高中选修': { bg: COLORS.infoLight, color: COLORS.info },
  '拓展':     { bg: COLORS.warningLight, color: COLORS.warning },
};

// ---------------------------------------------------------------------------
// CrystalListPanel
// ---------------------------------------------------------------------------

export function CrystalListPanel() {
  const selectedCrystalId = useCrystalStore((s) => s.selectedCrystalId);
  const selectCrystal = useCrystalStore((s) => s.selectCrystal);
  const activeTab = useCrystalStore((s) => s.activeTab);

  // Don't show the list panel in packing mode
  if (activeTab === 'packing') {
    return null;
  }

  return (
    <div
      className="w-[220px] min-w-[220px] h-full flex flex-col border-r"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: COLORS.text }}
        >
          晶体列表
        </h2>
        <p
          className="text-xs mt-0.5"
          style={{ color: COLORS.textMuted }}
        >
          {CRYSTAL_STRUCTURES.length} 种晶体结构
        </p>
      </div>

      {/* Scrollable crystal list grouped by category */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {CRYSTAL_CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.id}
            categoryId={cat.id}
            categoryName={cat.name}
            selectedCrystalId={selectedCrystalId}
            onSelect={selectCrystal}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible category section
// ---------------------------------------------------------------------------

function CategorySection({
  categoryId,
  categoryName,
  selectedCrystalId,
  onSelect,
}: {
  categoryId: CrystalCategory;
  categoryName: string;
  selectedCrystalId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const crystals = getCrystalsByCategory(categoryId);

  if (crystals.length === 0) return null;

  return (
    <div id={`crystal-cat-${categoryId}`}>
      {/* Category header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: COLORS.bgMuted,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: COLORS.textSecondary }}
        >
          {categoryName}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="text-xs"
            style={{ color: COLORS.textPlaceholder }}
          >
            {crystals.length}
          </span>
          <span
            className="text-xs"
            style={{
              color: COLORS.textPlaceholder,
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s',
              display: 'inline-block',
            }}
          >
            ▼
          </span>
        </span>
      </button>

      {/* Crystal items */}
      {open && (
        <div>
          {crystals.map((crystal) => {
            const isSelected = crystal.id === selectedCrystalId;
            const badgeStyle = GRADE_BADGE_STYLES[crystal.gradeLevel];

            return (
              <button
                key={crystal.id}
                className={cn(
                  'w-full text-left px-4 py-2.5 transition-colors',
                  'hover:bg-[var(--hover-bg)]',
                )}
                style={{
                  backgroundColor: isSelected ? COLORS.primaryLight : 'transparent',
                  borderLeft: isSelected ? `3px solid ${COLORS.primary}` : '3px solid transparent',
                  // CSS variable for hover (fallback handled by Tailwind)
                  ['--hover-bg' as string]: COLORS.bgHover,
                }}
                onClick={() => onSelect(crystal.id)}
              >
                {/* Formula */}
                <div
                  className="text-sm font-bold leading-tight"
                  style={{ color: isSelected ? COLORS.primary : COLORS.text }}
                  dangerouslySetInnerHTML={{ __html: crystal.formulaHtml }}
                />

                {/* Name + badge row */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="text-xs truncate"
                    style={{ color: COLORS.textSecondary }}
                  >
                    {crystal.name}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 shrink-0 font-medium"
                    style={{
                      borderRadius: RADIUS.xs,
                      backgroundColor: badgeStyle.bg,
                      color: badgeStyle.color,
                    }}
                  >
                    {crystal.gradeLevel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
