import { useState, type ReactNode } from 'react';
import { entityRegistry } from '@/core/registries/entity-registry';
import {
  BUILDER_TEMPLATE_FAMILIES,
  getBuilderTemplateCategories,
  type BuilderTemplateFamily,
  type BuilderTemplateVariant,
} from '@/domains/em/builder/template-library';
import { COLORS } from '@/styles/tokens';

interface BuilderLeftPanelProps {
  mode?: 'template' | 'free';
  showTemplateLibraryInFree?: boolean;
  advancedEditEnabled: boolean;
  selectedFamilyId: string | null;
  selectedVariantId: string | null;
  onToggleAdvancedEdit: () => void;
  onSelectTemplate: (family: BuilderTemplateFamily, variant: BuilderTemplateVariant) => void;
}

const ADVANCED_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'source', label: '电源', types: ['dc-source'] },
  { key: 'resistor', label: '电阻类', types: ['fixed-resistor', 'slide-rheostat', 'resistance-box'] },
  { key: 'meter', label: '仪表类', types: ['ammeter', 'voltmeter', 'galvanometer'] },
  { key: 'other', label: '其他元件', types: ['switch', 'bulb', 'motor', 'capacitor'] },
];

const TYPE_ICONS: Record<string, string> = {
  'dc-source': '🔋',
  'fixed-resistor': '⊞',
  'slide-rheostat': '⇔',
  'resistance-box': '⊟',
  'switch': '⏻',
  'ammeter': 'A',
  'voltmeter': 'V',
  'galvanometer': 'G',
  'capacitor': '⊫',
  'bulb': '💡',
  'motor': 'M',
};

export function BuilderLeftPanel({
  mode = 'template',
  showTemplateLibraryInFree = false,
  advancedEditEnabled,
  selectedFamilyId,
  selectedVariantId,
  onToggleAdvancedEdit,
  onSelectTemplate,
}: BuilderLeftPanelProps) {
  const [showAdvancedPalette, setShowAdvancedPalette] = useState(mode === 'free');
  const [showTemplateIntro, setShowTemplateIntro] = useState(false);
  const categories = getBuilderTemplateCategories();
  const plannedFamilies = BUILDER_TEMPLATE_FAMILIES.filter((family) => family.status === 'planned');
  const showTemplateLibrary = mode === 'template' || showTemplateLibraryInFree;

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 320,
        minWidth: 300,
        borderRight: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <button
          onClick={() => setShowTemplateIntro((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
            {mode === 'free' ? '自由搭建实验台' : '模板驱动搭建'}
          </div>
          <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
            {showTemplateIntro ? '收起' : '展开'}
          </span>
        </button>
        {showTemplateIntro && (
          <div className="px-4 pb-3 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {mode === 'free'
              ? (showTemplateLibraryInFree
                  ? '默认从空白画布开始，也可以直接从下方模板区加载骨架，再继续自由拖元件、拉线、删线和移动位置。'
                  : '默认从空白画布开始，自由拖元件、拉线、删线和移动位置。模板体验仍保留在独立入口，不和这里混在一起。')
              : '当前先只保留“伏安法测电阻”这一个模板，用来验证模板入口本身是否真的有价值。进阶情况下仍可展开下方元件库继续搭建。'}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <EditModeCard
          mode={mode}
          advancedEditEnabled={advancedEditEnabled}
          onToggleAdvancedEdit={onToggleAdvancedEdit}
        />

        {showTemplateLibrary && categories.map((category) => (
          <section key={category.key}>
            <div className="mb-2 text-xs font-semibold" style={{ color: COLORS.textSecondary }}>
              {category.label}
            </div>

            <div className="space-y-3">
              {category.families.map((family) => (
                <TemplateFamilyCard
                  key={family.id}
                  family={family}
                  selectedFamilyId={selectedFamilyId}
                  selectedVariantId={selectedVariantId}
                  onSelectTemplate={onSelectTemplate}
                />
              ))}
            </div>
          </section>
        ))}

        <section
          className="rounded-xl border"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
        >
          <button
            onClick={() => setShowAdvancedPalette((prev) => !prev)}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <div>
              <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
                {mode === 'free' ? '元件库' : '进阶元件库'}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
                {mode === 'free'
                  ? (showTemplateLibraryInFree
                      ? '可先从上方模板起步，也可直接从这里拖元件到画布，自由搭建串联、并联和测量电路。'
                      : '从这里直接拖元件到画布，自由搭建串联、并联和测量电路。')
                  : '只有模板不够用时再展开，用于补充元件或从零微调。'}
              </div>
            </div>
            <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
              {showAdvancedPalette ? '收起' : '展开'}
            </span>
          </button>

          {showAdvancedPalette && (
            <div
              className="space-y-3 border-t px-3 py-3"
              style={{ borderColor: COLORS.border }}
            >
              {!advancedEditEnabled && (
                <div
                  className="rounded-lg px-3 py-2 text-[11px]"
                  style={{ backgroundColor: COLORS.warningLight, color: '#92400E', lineHeight: 1.6 }}
                >
                  {mode === 'free'
                    ? '请先在上方开启编辑，再拖拽元件或手工改连线。'
                    : '进阶元件库已展开，但当前仍是模板模式。请先在上方开启“进阶编辑”，再拖拽补元件或手工改连线。'}
                </div>
              )}

              {ADVANCED_GROUPS.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 text-[11px] font-semibold" style={{ color: COLORS.textSecondary }}>
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.types.map((type) => {
                      const registration = entityRegistry.get(type);
                      if (!registration) return null;

                      return (
                        <div
                          key={type}
                          draggable={advancedEditEnabled}
                          onDragStart={(event) => {
                            if (!advancedEditEnabled) return;
                            event.dataTransfer.setData('entityType', type);
                            event.dataTransfer.effectAllowed = 'copy';
                          }}
                          className="flex cursor-grab items-center gap-2 rounded-lg border px-2 py-2 text-xs transition-colors hover:bg-gray-50 active:cursor-grabbing"
                          style={{
                            borderColor: COLORS.border,
                            color: COLORS.text,
                            opacity: advancedEditEnabled ? 1 : 0.55,
                            cursor: advancedEditEnabled ? 'grab' : 'not-allowed',
                          }}
                        >
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md text-sm"
                            style={{ backgroundColor: COLORS.bgMuted }}
                          >
                            {TYPE_ICONS[type] ?? '?'}
                          </span>
                          <span>{registration.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="text-[10px]" style={{ color: COLORS.textMuted }}>
                {mode === 'free'
                  ? '拖到中间画布即可开始搭建。'
                  : '仍支持拖到中间画布继续补元件；但建议优先从模板起步。'}
              </div>
            </div>
          )}
        </section>

        <section
          className="rounded-xl border px-3 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
        >
          <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
            {mode === 'free' ? '自由搭建提示' : '模板边界'}
          </div>
          <div className="mt-2 space-y-1 text-[11px]" style={{ color: COLORS.textMuted }}>
            {mode === 'free' ? (
              <>
                <div>• 默认可从空白画布开始，也可直接从左侧模板区起步</div>
                <div>• 加载模板后仍保留自由编辑能力，可继续补元件和改连线</div>
                <div>• 需要反馈真实搭建体验时，优先走这个入口</div>
              </>
            ) : (
              <>
                <div>• 当前模板区只保留“伏安法测电阻”</div>
                <div>• 重点验证：哪些实验真的值得做成模板入口</div>
                <div>• 没开进阶编辑时，不允许拖元件、拉线、删线、移动位置</div>
                {plannedFamilies.map((family) => (
                  <div key={family.id}>• 后续待接入：{family.title}</div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}

function EditModeCard({
  mode,
  advancedEditEnabled,
  onToggleAdvancedEdit,
}: {
  mode: 'template' | 'free';
  advancedEditEnabled: boolean;
  onToggleAdvancedEdit: () => void;
}) {
  const title = mode === 'free' ? '编辑模式' : '进阶编辑';
  const statusLabel = advancedEditEnabled
    ? mode === 'free'
      ? '已开启'
      : '已开启'
    : mode === 'free'
      ? '已锁定'
      : '模板锁定中';
  const description = mode === 'free'
    ? advancedEditEnabled
      ? '当前可以直接拖元件、移动位置、拉线删线。'
      : '当前画布只读。开启后才能继续拖元件和修改连线。'
    : advancedEditEnabled
      ? '当前可在模板基础上补元件、移动位置、改连线。'
      : '当前先锁定模板骨架，只允许结构切换和参数调整。';
  const actionLabel = advancedEditEnabled
    ? mode === 'free'
      ? '切到只读'
      : '关闭进阶编辑'
    : mode === 'free'
      ? '开启编辑'
      : '开启进阶编辑';

  return (
    <section
      className="rounded-2xl border px-3 py-3"
      style={{
        borderColor: advancedEditEnabled ? `${COLORS.primary}55` : COLORS.borderStrong,
        backgroundColor: advancedEditEnabled ? COLORS.primaryLight : COLORS.bg,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
              {title}
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: advancedEditEnabled ? COLORS.primary : COLORS.textSecondary,
                backgroundColor: advancedEditEnabled ? COLORS.bg : COLORS.bgMuted,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {description}
          </div>
        </div>

        <button
          onClick={onToggleAdvancedEdit}
          className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors"
          style={{
            color: advancedEditEnabled ? COLORS.textSecondary : COLORS.white,
            backgroundColor: advancedEditEnabled ? COLORS.bg : COLORS.primary,
            border: `1px solid ${advancedEditEnabled ? COLORS.border : COLORS.primary}`,
            boxShadow: advancedEditEnabled ? 'none' : '0 2px 10px rgba(0, 192, 107, 0.16)',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function TemplateFamilyCard({
  family,
  selectedFamilyId,
  selectedVariantId,
  onSelectTemplate,
}: {
  family: BuilderTemplateFamily;
  selectedFamilyId: string | null;
  selectedVariantId: string | null;
  onSelectTemplate: (family: BuilderTemplateFamily, variant: BuilderTemplateVariant) => void;
}) {
  const isSelectedFamily = family.id === selectedFamilyId;
  const isPlanned = family.status === 'planned';

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: isSelectedFamily ? COLORS.primary : COLORS.border,
        backgroundColor: isSelectedFamily ? '#FBFFFD' : COLORS.bg,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
            {family.title}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
            {family.subtitle}
          </div>
        </div>

        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            color: isPlanned ? COLORS.textMuted : COLORS.primary,
            backgroundColor: isPlanned ? COLORS.bgMuted : COLORS.primaryLight,
          }}
        >
          {isPlanned ? '规划中' : '可用'}
        </span>
      </div>

      <div className="mt-2 text-[11px]" style={{ color: COLORS.textSecondary, lineHeight: 1.6 }}>
        {family.description}
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
          {family.structureLabel}
        </div>
        <div className="flex flex-wrap gap-2">
          {family.variants.map((variant) => {
            const isActive = isSelectedFamily && variant.id === selectedVariantId;
            const isDisabled = isPlanned || !variant.presetId;

            return (
              <button
                key={variant.id}
                onClick={() => {
                  if (!isDisabled) onSelectTemplate(family, variant);
                }}
                disabled={isDisabled}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: isActive ? COLORS.primary : COLORS.textSecondary,
                  backgroundColor: isActive ? COLORS.primaryLight : COLORS.bgMuted,
                  border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
                }}
                title={variant.description}
              >
                {variant.shortLabel ?? variant.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <InfoBlock label="允许调整" items={family.adjustableParts} />
        <InfoBlock label="默认锁定" items={family.lockedParts} />
      </div>
    </div>
  );
}

function InfoBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div
      className="rounded-lg px-2.5 py-2"
      style={{ backgroundColor: COLORS.bgMuted }}
    >
      <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
      <ListBlockContent
        items={items}
        emptyText="暂无"
        textColor={COLORS.textSecondary}
      />
    </div>
  );
}

function ListBlockContent({
  items,
  emptyText,
  textColor,
}: {
  items: string[];
  emptyText: string;
  textColor: string;
}): ReactNode {
  if (items.length === 0) {
    return (
      <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.5 }}>
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="mt-1 space-y-1">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-[11px]"
          style={{ color: textColor, lineHeight: 1.5 }}
        >
          <span style={{ color: COLORS.primary }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
