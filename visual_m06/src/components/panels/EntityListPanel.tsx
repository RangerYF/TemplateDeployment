import { useState, useCallback, useMemo } from 'react';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useHistoryStore } from '@/editor/store/historyStore';
import { ToggleVisibilityCmd } from '@/editor/demo/demoCommands';
import { COLORS } from '@/styles/tokens';
import type { DemoEntity, DemoEntityType } from '@/editor/demo/demoTypes';
import { Eye, EyeOff, ChevronDown, PanelLeftClose, PanelLeft, Search, X } from 'lucide-react';

function getEntityDisplayName(entity: DemoEntity, entities: Record<string, DemoEntity>): string {
  switch (entity.type) {
    case 'demoPoint': return entity.label || `点${entity.id}`;
    case 'demoVector': return entity.label || `向量${entity.id}`;
    case 'demoVecOp': return `运算(${entity.kind})`;
    case 'demoMarker': return entity.label || `标记${entity.id}`;
    case 'demoSegment': {
      const s = entities[entity.startId];
      const e = entities[entity.endId];
      const sl = s && 'label' in s ? s.label : '?';
      const el = e && 'label' in e ? e.label : '?';
      return `线段 ${sl}${el}`;
    }
    case 'demoCircle': {
      const c = entities[entity.centerId];
      const cl = c && 'label' in c ? c.label : '?';
      return `圆${cl}`;
    }
    case 'demoText': return entity.text.slice(0, 12) || '文字';
    case 'demoAngleMark': return '角度标注';
    case 'demoDistanceMark': return '距离标注';
    case 'demoLine': {
      const p1 = entities[entity.point1Id];
      const p2 = entities[entity.point2Id];
      const l1 = p1 && 'label' in p1 ? p1.label : '?';
      const l2 = p2 && 'label' in p2 ? p2.label : '?';
      return `直线 ${l1}${l2}`;
    }
    case 'demoRay': {
      const o = entities[entity.originId];
      const t = entities[entity.throughId];
      const ol = o && 'label' in o ? o.label : '?';
      const tl = t && 'label' in t ? t.label : '?';
      return `射线 ${ol}${tl}`;
    }
    case 'demoPolygon': return `多边形(${entity.vertexIds.length}边)`;
    case 'demoSlider': return entity.label || `滑动条${entity.id}`;
    default: return `实体${(entity as DemoEntity).id}`;
  }
}

interface GroupConfig {
  type: DemoEntityType;
  label: string;
}

const ENTITY_GROUPS: GroupConfig[] = [
  { type: 'demoVector', label: '向量' },
  { type: 'demoVecOp', label: '向量运算' },
  { type: 'demoPoint', label: '端点' },
  { type: 'demoMarker', label: '标记点' },
  { type: 'demoSegment', label: '线段' },
  { type: 'demoLine', label: '直线' },
  { type: 'demoRay', label: '射线' },
  { type: 'demoCircle', label: '圆' },
  { type: 'demoPolygon', label: '多边形' },
  { type: 'demoAngleMark', label: '角度标注' },
  { type: 'demoDistanceMark', label: '距离标注' },
  { type: 'demoText', label: '文字' },
  { type: 'demoSlider', label: '滑动条' },
];

interface EntityRowProps {
  entity: DemoEntity;
  entities: Record<string, DemoEntity>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function EntityRow({ entity, entities, selectedId, onSelect }: EntityRowProps) {
  const isSelected = selectedId === entity.id;
  const [hovered, setHovered] = useState(false);
  const displayName = useMemo(() => getEntityDisplayName(entity, entities), [entity, entities]);
  const isHidden = entity.visible === false;

  const handleClick = useCallback(() => {
    onSelect(entity.id);
  }, [entity.id, onSelect]);

  const handleToggleVisible = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const before = entity.visible !== false;
    useHistoryStore.getState().execute(
      new ToggleVisibilityCmd(entity.id, before, !before),
    );
  }, [entity.id, entity.visible]);

  return (
    <div
      className="flex items-center gap-1 pl-4 pr-2 py-0.5 cursor-pointer rounded-sm text-xs"
      style={{
        background: isSelected ? COLORS.primaryLight : hovered ? COLORS.bgHover : 'transparent',
        color: isHidden ? COLORS.textPlaceholder : COLORS.text,
        textDecoration: isHidden ? 'line-through' : 'none',
        marginLeft: 4,
        borderLeft: isSelected ? `2px solid ${COLORS.primary}` : '2px solid transparent',
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="flex-1 truncate" style={{ minWidth: 0 }}>
        {displayName}
      </span>
      {(isHidden || hovered) && (
        <button
          className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: isHidden ? COLORS.error : COLORS.textPlaceholder,
          }}
          onClick={handleToggleVisible}
          title={isHidden ? '显示' : '隐藏'}
        >
          {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </div>
  );
}

function EntityGroup({
  label, entities, allEntities, selectedId, onSelect,
}: {
  label: string;
  entities: DemoEntity[];
  allEntities: Record<string, DemoEntity>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (entities.length === 0) return null;

  return (
    <div className="border-b" style={{ borderColor: COLORS.border }}>
      <button
        className="w-full flex items-center gap-1 py-1.5 px-2 text-xs font-medium"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: COLORS.textMuted }}
        onClick={() => setOpen(!open)}
      >
        <ChevronDown
          size={12}
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
        />
        <span>{label}</span>
        <span style={{ color: COLORS.textPlaceholder }}>({entities.length})</span>
      </button>
      {open && (
        <div className="pb-1">
          {entities.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              entities={allEntities}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EntityListPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function EntityListPanel({ selectedId, onSelect }: EntityListPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const entities = useDemoEntityStore((s) => s.entities);

  const groupedEntities = useMemo(() => {
    const all = Object.values(entities);
    const query = searchQuery.trim().toLowerCase();

    return ENTITY_GROUPS.map((group) => {
      let groupEntities = all.filter((e) => e.type === group.type);
      if (query) {
        groupEntities = groupEntities.filter((e) =>
          getEntityDisplayName(e, entities).toLowerCase().includes(query),
        );
      }
      return { ...group, entities: groupEntities };
    }).filter((g) => g.entities.length > 0);
  }, [entities, searchQuery]);

  if (collapsed) {
    return (
      <div
        className="h-full flex items-start pt-2"
        style={{ borderRight: `1px solid ${COLORS.border}` }}
      >
        <button
          className="p-1.5 rounded hover:bg-black/5"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.textMuted }}
          onClick={() => setCollapsed(false)}
          title="展开实体列表"
        >
          <PanelLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        width: 200,
        minWidth: 200,
        borderRight: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
      }}
    >
      <div
        className="flex items-center justify-between px-2 py-2 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <span className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>
          实体列表
        </span>
        <button
          className="p-0.5 rounded hover:bg-black/5"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.textMuted }}
          onClick={() => setCollapsed(true)}
          title="折叠面板"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <div className="px-2 py-1.5 border-b" style={{ borderColor: COLORS.border }}>
        <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: COLORS.bgMuted }}>
          <Search size={12} style={{ color: COLORS.textPlaceholder, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="搜索实体..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none border-none"
            style={{ color: COLORS.text, minWidth: 0 }}
          />
          {searchQuery && (
            <button
              className="p-0.5 rounded hover:bg-black/5"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.textPlaceholder, flexShrink: 0 }}
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groupedEntities.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>暂无实体</span>
          </div>
        ) : (
          groupedEntities.map((group) => (
            <EntityGroup
              key={group.type}
              label={group.label}
              entities={group.entities}
              allEntities={entities}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
