import { cn } from '@/lib/utils/cn';
import { COLORS } from '@/styles/tokens';
import { useEntityStore, useHistoryStore, ChangeGeometryTypeCommand } from '@/editor';
import { GEOMETRY_LIST, GEOMETRY_GROUPS, DEFAULT_PARAMS, type GeometryType } from '@/types/geometry';
import { buildGeometry } from '@/engine/builders';
import type { GeometryProperties } from '@/editor/entities/types';
import { GEOMETRY_ICON_MAP } from '@/components/icons/geometryIconMap';

/** 根据 type 查找 GeometryMeta */
const META_MAP = Object.fromEntries(GEOMETRY_LIST.map((g) => [g.type, g]));
export function TopBar() {
  const activeGeometry = useEntityStore((s) => s.getActiveGeometry());
  const currentType = (activeGeometry?.properties as GeometryProperties | undefined)?.geometryType ?? 'cube';

  const handleSwitch = (newType: GeometryType) => {
    if (!activeGeometry || newType === currentType) return;

    const newParams = DEFAULT_PARAMS[newType];
    const newResult = buildGeometry(newType, newParams);
    if (!newResult) return;

    const cmd = new ChangeGeometryTypeCommand(
      activeGeometry.id,
      newType,
      newParams,
      newResult,
    );
    useHistoryStore.getState().execute(cmd);
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div
        className="mr-1 flex items-center rounded-lg px-3 py-1"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.text }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
          M01 立体几何展示台
        </span>
      </div>

      {GEOMETRY_GROUPS.map((group, groupIdx) => (
        <div key={group.label} className="flex items-center">
          {/* 分组间竖线分隔 */}
          {groupIdx > 0 && (
            <div
              className="mx-2 self-stretch"
              style={{
                width: 1,
                backgroundColor: COLORS.border,
                minHeight: 24,
              }}
            />
          )}

          {/* 分组内容 */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: COLORS.bgMuted }}
          >
            <span
              className="mr-1.5 whitespace-nowrap"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: COLORS.text,
                letterSpacing: '0.05em',
              }}
            >
              {group.label}
            </span>
            {group.types.map((type) => {
              const meta = META_MAP[type];
              if (!meta) return null;
              const Icon = GEOMETRY_ICON_MAP[type];
              const isActive = currentType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleSwitch(type)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium transition-all duration-150',
                    'hover:opacity-80',
                  )}
                  style={{
                    backgroundColor: isActive ? COLORS.primary : 'transparent',
                    color: isActive ? COLORS.white : COLORS.textSecondary,
                  }}
                >
                  {Icon && <Icon size={14} />}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
