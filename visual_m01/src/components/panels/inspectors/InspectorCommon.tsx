import { useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react';
import type { Entity } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, RenameEntityCommand, DeleteEntityCascadeCommand } from '@/editor';
import { Input } from '@/components/ui/input';
import { COLORS } from '@/styles/tokens';

interface InspectorHeaderProps {
  entity: Entity;
  typeName: string;
  canDelete?: boolean;
  deleteLabel?: string;
  displayName?: string;
  canRename?: boolean;
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.textMuted,
  marginBottom: 2,
};

const readonlyValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: COLORS.text,
  padding: '3px 8px',
  background: COLORS.bgMuted,
  borderRadius: 4,
  border: `1px solid ${COLORS.border}`,
};

export function InspectorHeader({
  entity,
  typeName,
  canDelete,
  deleteLabel = '删除',
  displayName,
  canRename = true,
}: InspectorHeaderProps) {
  const isHidden = !entity.visible;
  const isLocked = !!entity.locked;

  const label = displayName ?? (entity.properties as { label?: string }).label ?? '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const commitRename = useCallback(() => {
    if (draft !== label && draft.trim()) {
      useHistoryStore.getState().execute(
        new RenameEntityCommand(entity.id, label, draft.trim()),
      );
    }
    setEditing(false);
  }, [entity.id, label, draft]);

  const handleToggleVisible = useCallback(() => {
    useEntityStore.getState().toggleVisible(entity.id);
  }, [entity.id]);

  const handleToggleLocked = useCallback(() => {
    useEntityStore.getState().toggleLocked(entity.id);
  }, [entity.id]);

  const handleDelete = useCallback(() => {
    useHistoryStore.getState().execute(
      new DeleteEntityCascadeCommand(entity.id),
    );
  }, [entity.id]);

  return (
    <div style={{ marginBottom: 10 }}>
      {/* 类型 + 名称字段 */}
      <div className="flex gap-3" style={{ marginBottom: 8 }}>
        {/* 类型 */}
        <div style={{ flex: '0 0 auto' }}>
          <div style={fieldLabelStyle}>类型</div>
          <div style={readonlyValueStyle}>{typeName}</div>
        </div>

        {/* 名称 */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div style={fieldLabelStyle}>名称</div>
          {canRename ? (
            editing ? (
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                className="h-7 text-sm px-2"
                style={{ fontSize: 13, fontWeight: 600 }}
                autoFocus
              />
            ) : (
              <Input
                value={label || typeName}
                readOnly
                onClick={() => { setDraft(label); setEditing(true); }}
                className="h-7 text-sm px-2 cursor-pointer"
                style={{ fontSize: 13, fontWeight: 600, background: COLORS.bg }}
                title="点击编辑名称"
              />
            )
          ) : (
            <div style={readonlyValueStyle} className="truncate">{label || typeName}</div>
          )}
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleToggleVisible}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            border: `1px solid ${COLORS.border}`,
            background: isHidden ? 'rgba(239,68,68,0.08)' : COLORS.bgMuted,
            cursor: 'pointer',
            color: isHidden ? COLORS.error : COLORS.textMuted,
          }}
          title={isHidden ? '显示' : '隐藏'}
        >
          {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
          {isHidden ? '已隐藏' : '隐藏'}
        </button>

        <button
          onClick={handleToggleLocked}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{
            border: `1px solid ${COLORS.border}`,
            background: isLocked ? 'rgba(234,179,8,0.08)' : COLORS.bgMuted,
            cursor: 'pointer',
            color: isLocked ? COLORS.warning : COLORS.textMuted,
          }}
          title={isLocked ? '解除锁定' : '锁定'}
        >
          {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          {isLocked ? '已锁定' : '锁定'}
        </button>

        {canDelete && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bgMuted,
              cursor: 'pointer',
              color: COLORS.error,
            }}
            title={deleteLabel}
          >
            <Trash2 size={12} />
            {deleteLabel}
          </button>
        )}
      </div>
    </div>
  );
}
