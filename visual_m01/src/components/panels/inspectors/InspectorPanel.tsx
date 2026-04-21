import React from 'react';
import { useSelectionStore, useEntityStore } from '@/editor/store';
import { COLORS } from '@/styles/tokens';
import { inspectorRegistry } from './registry';

export function InspectorPanel() {
  const primaryId = useSelectionStore((s) => s.primaryId);
  const entity = useEntityStore((s) => (primaryId ? s.entities[primaryId] : undefined));

  if (!entity) {
    return (
      <div className="flex items-center justify-center min-h-[60px]">
        <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>
          请先选择一个实体（点、线、面、度量等）
        </span>
      </div>
    );
  }

  const Inspector = inspectorRegistry[entity.type];
  if (!Inspector) return null;

  return React.createElement(Inspector, { entity });
}
