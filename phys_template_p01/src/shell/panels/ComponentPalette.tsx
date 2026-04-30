import { useState } from 'react';
import { entityRegistry } from '@/core/registries/entity-registry';
import { COLORS } from '@/styles/tokens';

/** 电路元件类型白名单（排除非电路实体） */
const CIRCUIT_TYPES = new Set([
  'dc-source',
  'fixed-resistor',
  'slide-rheostat',
  'resistance-box',
  'switch',
  'ammeter',
  'voltmeter',
  'galvanometer',
  'capacitor',
  'bulb',
  'motor',
]);

/** 分组定义 */
const GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'source', label: '电源', types: ['dc-source'] },
  { key: 'resistive', label: '电阻类', types: ['fixed-resistor', 'slide-rheostat', 'resistance-box'] },
  { key: 'instrument', label: '仪表类', types: ['ammeter', 'voltmeter', 'galvanometer'] },
  { key: 'other', label: '其他元件', types: ['switch', 'capacitor', 'bulb', 'motor'] },
];

/** 元件图标 */
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

export function ComponentPalette() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 220,
        minWidth: 200,
        borderRight: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="px-4 py-3 text-sm font-semibold"
        style={{ color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
      >
        元器件库
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {GROUPS.map((group) => {
          const isCollapsed = collapsed[group.key] ?? false;
          const items = group.types
            .filter((t) => CIRCUIT_TYPES.has(t))
            .map((t) => entityRegistry.get(t))
            .filter(Boolean);

          if (items.length === 0) return null;

          return (
            <div key={group.key} className="mb-2">
              {/* 分组标题 */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
                style={{ color: COLORS.textSecondary }}
              >
                <span className="text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                {group.label}
              </button>

              {/* 元件列表 */}
              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {items.map((reg) => {
                    if (!reg) return null;
                    return (
                      <div
                        key={reg.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('entityType', reg.type);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="flex cursor-grab items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-gray-100 active:cursor-grabbing"
                        style={{ color: COLORS.text }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-md text-sm"
                          style={{ backgroundColor: COLORS.bgMuted }}
                        >
                          {TYPE_ICONS[reg.type] ?? '?'}
                        </span>
                        <span>{reg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="px-4 py-2 text-[10px]"
        style={{ color: COLORS.textMuted, borderTop: `1px solid ${COLORS.border}` }}
      >
        拖拽元件到画布
      </div>
    </aside>
  );
}
