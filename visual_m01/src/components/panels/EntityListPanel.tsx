import { useState, useCallback, useMemo, useRef } from 'react';
import { useEntityStore } from '@/editor/store';
import { useSelectionStore } from '@/editor/store/selectionStore';
import { useHistoryStore, RenameEntityCommand } from '@/editor';
import { COLORS } from '@/styles/tokens';
import type { Entity, EntityType } from '@/editor/entities/types';
import { Eye, EyeOff, Lock, Unlock, ChevronDown, PanelLeftClose, PanelLeft, Search, X, Filter } from 'lucide-react';

// ─── 实体显示名生成 ───

function getEntityDisplayName(entity: Entity, entities: Record<string, Entity>): string {
  switch (entity.type) {
    case 'point': {
      const props = entity.properties as { label?: string };
      return props.label || `点${entity.id}`;
    }
    case 'segment': {
      const props = entity.properties as { startPointId: string; endPointId: string; curvePoints?: unknown[] };
      if (props.curvePoints) {
        return `弧线#${entity.id}`;
      }
      const start = entities[props.startPointId];
      const end = entities[props.endPointId];
      const startLabel = (start?.properties as { label?: string })?.label || '?';
      const endLabel = (end?.properties as { label?: string })?.label || '?';
      return `${startLabel}${endLabel}`;
    }
    case 'face': {
      const props = entity.properties as { pointIds: string[]; source: { type: string } };
      if (props.source?.type === 'crossSection') {
        const crossLabels = props.pointIds
          .map((pid: string) => (entities[pid]?.properties as { label?: string })?.label || '?')
          .join('');
        return crossLabels ? `截面${crossLabels}` : '截面';
      }
      if (props.source?.type === 'surface') {
        return `曲面#${entity.id}`;
      }
      const labels = props.pointIds
        .map((pid: string) => (entities[pid]?.properties as { label?: string })?.label || '?')
        .join('');
      return labels || `面#${entity.id}`;
    }
    case 'angleMeasurement': {
      const props = entity.properties as { angleLatex?: string };
      return props.angleLatex || `角度#${entity.id}`;
    }
    case 'distanceMeasurement': {
      const dmProps = entity.properties as { kind: string; entityIds: string[] };
      const descParts = dmProps.entityIds.map((eid: string) => {
        const ref = entities[eid];
        if (!ref) return '?';
        if (ref.type === 'point') return (ref.properties as { label?: string }).label || '?';
        if (ref.type === 'segment') {
          const sp = ref.properties as { startPointId: string; endPointId: string };
          const sl = (entities[sp.startPointId]?.properties as { label?: string })?.label || '?';
          const el = (entities[sp.endPointId]?.properties as { label?: string })?.label || '?';
          return `线${sl}${el}`;
        }
        if (ref.type === 'face') {
          const fp = ref.properties as { pointIds: string[] };
          const labels = fp.pointIds.map((pid: string) => (entities[pid]?.properties as { label?: string })?.label || '?').join('');
          return `面${labels}`;
        }
        return '?';
      });
      return descParts.join(' → ');
    }
    case 'coordinateSystem':
      return '坐标系';
    case 'circumSphere':
      return '外接球';
    case 'circumCircle':
      return '外接圆';
    default:
      return `${entity.type}#${entity.id}`;
  }
}

// ─── 分组配置 ───

interface GroupConfig {
  type: EntityType;
  label: string;
}

const ENTITY_GROUPS: GroupConfig[] = [
  { type: 'point', label: '点' },
  { type: 'segment', label: '线段' },
  { type: 'face', label: '面' },
  { type: 'coordinateSystem', label: '坐标系' },
  { type: 'circumSphere', label: '外接球' },
  { type: 'circumCircle', label: '外接圆' },
  { type: 'angleMeasurement', label: '角度度量' },
  { type: 'distanceMeasurement', label: '距离度量' },
];

// ─── 实体行 ───

/** 判断实体是否可重命名 */
function canRename(entity: Entity): boolean {
  if (entity.type === 'point') return true;
  if (entity.type === 'segment') return !(entity.properties as { builtIn?: boolean }).builtIn;
  return false;
}

/** 获取实体当前 label */
function getEntityLabel(entity: Entity): string {
  return (entity.properties as { label?: string }).label ?? '';
}

function EntityRow({ entity, entities }: { entity: Entity; entities: Record<string, Entity> }) {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.includes(entity.id);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = useMemo(() => getEntityDisplayName(entity, entities), [entity, entities]);

  const handleClick = useCallback(() => {
    useSelectionStore.getState().select(entity.id);
  }, [entity.id]);

  const handleDoubleClick = useCallback(() => {
    if (!canRename(entity)) return;
    setDraft(getEntityLabel(entity));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [entity]);

  const commitRename = useCallback(() => {
    const oldLabel = getEntityLabel(entity);
    if (draft.trim() && draft.trim() !== oldLabel) {
      useHistoryStore.getState().execute(
        new RenameEntityCommand(entity.id, oldLabel, draft.trim()),
      );
    }
    setEditing(false);
  }, [entity, draft]);

  const handleToggleVisible = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useEntityStore.getState().toggleVisible(entity.id);
  }, [entity.id]);

  const handleToggleLocked = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useEntityStore.getState().toggleLocked(entity.id);
  }, [entity.id]);

  const isHidden = !entity.visible;
  const isLocked = !!entity.locked;

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
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-xs bg-white outline-none px-1 py-0 rounded border"
          style={{ minWidth: 0, borderColor: COLORS.primary, color: COLORS.text }}
          autoFocus
        />
      ) : (
        <span className="flex-1 truncate" style={{ minWidth: 0 }}>
          {displayName}
          {(entity.properties as { builtIn?: boolean }).builtIn && (
            <span style={{ color: COLORS.textPlaceholder, marginLeft: 4 }}>(内置)</span>
          )}
        </span>
      )}

      {/* 锁定图标（锁定时常驻，否则 hover 时显示） */}
      {!editing && (isLocked || hovered) && (
        <button
          className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: isLocked ? COLORS.warning : COLORS.textPlaceholder }}
          onClick={handleToggleLocked}
          title={isLocked ? '解除锁定' : '锁定'}
        >
          {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
      )}

      {/* 可见性图标（隐藏时常驻，否则 hover 时显示） */}
      {!editing && (isHidden || hovered) && (
        <button
          className="p-0.5 rounded hover:bg-black/5 flex-shrink-0"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: isHidden ? COLORS.error : COLORS.textPlaceholder }}
          onClick={handleToggleVisible}
          title={isHidden ? '显示' : '隐藏'}
        >
          {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      )}
    </div>
  );
}

// ─── 分组折叠面板 ───

function EntityGroup({ label, entities, allEntities }: { label: string; entities: Entity[]; allEntities: Record<string, Entity> }) {
  const [open, setOpen] = useState(true);
  const isEmpty = entities.length === 0;

  return (
    <div className="border-b" style={{ borderColor: COLORS.border }}>
      <button
        className="w-full flex items-center gap-1 py-1.5 px-2 text-xs font-medium"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isEmpty ? COLORS.textPlaceholder : COLORS.textMuted }}
        onClick={() => !isEmpty && setOpen(!open)}
      >
        {!isEmpty && (
          <ChevronDown
            size={12}
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
          />
        )}
        {isEmpty && <span style={{ width: 12, display: 'inline-block' }} />}
        <span>{label}</span>
        <span style={{ color: COLORS.textPlaceholder }}>({entities.length})</span>
      </button>
      {open && !isEmpty && (
        <div className="pb-1">
          {entities.map((entity) => (
            <EntityRow key={entity.id} entity={entity} entities={allEntities} />
          ))}
        </div>
      )}
      {isEmpty && (
        <div className="px-2 pb-1.5">
          <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>暂无{label}</span>
        </div>
      )}
    </div>
  );
}

// ─── 主面板 ───

export function EntityListPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideBuiltIn, setHideBuiltIn] = useState(false);
  const activeGeometryId = useEntityStore((s) => s.activeGeometryId);
  const entities = useEntityStore((s) => s.entities);

  // 按类型分组当前几何体的关联实体（排除 geometry 自身）
  const groupedEntities = useMemo(() => {
    const related = !activeGeometryId ? [] : Object.values(entities).filter((e) => {
      if (e.type === 'geometry') return false;
      const p = e.properties as { geometryId?: string };
      return p.geometryId === activeGeometryId;
    });

    const query = searchQuery.trim().toLowerCase();

    return ENTITY_GROUPS.map((group) => {
      let groupEntities = related.filter((e) => e.type === group.type);
      // 隐藏内置过滤
      if (hideBuiltIn) {
        groupEntities = groupEntities.filter((e) =>
          !(e.properties as { builtIn?: boolean }).builtIn
        );
      }
      // 搜索过滤
      if (query) {
        groupEntities = groupEntities.filter((e) =>
          getEntityDisplayName(e, entities).toLowerCase().includes(query)
        );
      }
      return { ...group, entities: groupEntities };
    });
  }, [activeGeometryId, entities, searchQuery, hideBuiltIn]);

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
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-2 py-2 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <span className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>
          实体列表
        </span>
        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
            style={{
              fontSize: 10,
              border: `1px solid ${hideBuiltIn ? COLORS.primary : COLORS.border}`,
              background: hideBuiltIn ? `${COLORS.primary}12` : 'transparent',
              cursor: 'pointer',
              color: hideBuiltIn ? COLORS.primary : COLORS.textPlaceholder,
            }}
            onClick={() => setHideBuiltIn(!hideBuiltIn)}
          >
            <Filter size={10} />
            <span>{hideBuiltIn ? '已隐藏内置' : '隐藏内置'}</span>
          </button>
          <button
            className="p-0.5 rounded hover:bg-black/5"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.textMuted }}
            onClick={() => setCollapsed(true)}
            title="折叠面板"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>

      {/* 搜索框 */}
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

      {/* 实体分组列表 */}
      <div className="flex-1 overflow-y-auto">
        {groupedEntities.map((group) => (
          <EntityGroup
            key={group.type}
            label={group.label}
            entities={group.entities}
            allEntities={entities}
          />
        ))}
      </div>
    </div>
  );
}
