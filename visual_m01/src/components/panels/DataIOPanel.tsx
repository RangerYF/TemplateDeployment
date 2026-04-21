import { useRef, useCallback } from 'react';
import { COLORS } from '@/styles/tokens';
import { useEntityStore, useHistoryStore } from '@/editor';
import { clearCache } from '@/editor/builderCache';
import type { Entity } from '@/editor/entities/types';
import {
  buildSnapshotEnvelope,
  extractSceneSnapshot,
  validateSnapshotPayload,
} from '@/runtime/embed';

const btnStyle: React.CSSProperties = {
  background: COLORS.bgMuted,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

function IOButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-3 py-1.5 rounded text-sm font-medium"
      style={btnStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = COLORS.primary;
        e.currentTarget.style.color = '#fff';
        e.currentTarget.style.borderColor = COLORS.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = COLORS.bgMuted;
        e.currentTarget.style.color = COLORS.text;
        e.currentTarget.style.borderColor = COLORS.border;
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.96)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {label}
    </button>
  );
}

export function DataIOPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const snapshot = useEntityStore.getState().getSnapshot();
    const json = JSON.stringify(buildSnapshotEnvelope(snapshot), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const validation = validateSnapshotPayload(raw);
        if (!validation.ok) {
          alert(`文件格式无效：${validation.errors.join('；')}`);
          return;
        }
        const snapshot = extractSceneSnapshot(raw);
        if (!snapshot) {
          alert('文件格式无效：无法提取 scene snapshot');
          return;
        }
        useHistoryStore.setState({ undoStack: [], redoStack: [], canUndo: false, canRedo: false });
        clearCache();
        useEntityStore.getState().loadSnapshot(
          snapshot as {
            entities: Record<string, Entity>;
            nextId: number;
            activeGeometryId: string | null;
          },
        );
      } catch (err) {
        alert('解析失败：' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return (
    <div className="flex gap-2">
      <IOButton label="导出" onClick={handleExport} />
      <IOButton label="导入" onClick={handleImport} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
