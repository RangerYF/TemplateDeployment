import type { Tool, ToolPointerEvent } from './types';
import type { Command } from '../commands/types';
import type { PointProperties, SegmentProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useHistoryStore } from '../store/historyStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { BatchCommand } from '../commands/batch';
import { useNotificationStore } from '@/components/scene/notificationStore';

const DEFAULT_LABELS = ['M', 'N', 'P', 'Q', 'R', 'S', 'T'];

function subscript(n: number): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return String(n)
    .split('')
    .map((d) => subs[Number(d)])
    .join('');
}

function getNextPointLabel(): string {
  const entities = useEntityStore.getState().entities;
  const existing = Object.values(entities)
    .filter((e) => e.type === 'point')
    .map((e) => (e.properties as PointProperties).label);
  for (const l of DEFAULT_LABELS) {
    if (!existing.includes(l)) return l;
  }
  let i = 1;
  while (existing.includes(`M${subscript(i)}`)) i++;
  return `M${subscript(i)}`;
}

let unsubscribe: (() => void) | null = null;
let handling = false;

function handleSegmentSelected(segmentId: string) {
  if (handling) return;
  handling = true;

  const entityStore = useEntityStore.getState();
  const seg = entityStore.getEntity(segmentId);
  if (!seg || seg.type !== 'segment') {
    handling = false;
    return;
  }
  const segProps = seg.properties as SegmentProperties;

  const label = getNextPointLabel();
  const pointCmd = new CreateEntityCommand('point', {
    builtIn: false,
    geometryId: segProps.geometryId,
    constraint: {
      type: 'segment' as const,
      segmentId,
      t: 0.5,
    },
    label,
  });

  const deferredFaceCmd: Command & { _inner?: CreateEntityCommand<'face'> } = {
    type: 'createPerpendicularPlaneFace',
    label: '创建垂面',
    execute() {
      const pointId = pointCmd.getCreatedId()!;
      if (!this._inner) {
        this._inner = new CreateEntityCommand('face', {
          builtIn: false,
          geometryId: segProps.geometryId,
          pointIds: [pointId],
          source: { type: 'perpendicularPlane' as const, pointId },
          showPlane: true,
        });
      }
      this._inner.execute();
    },
    undo() {
      this._inner?.undo();
    },
  };

  const batch = new BatchCommand('创建垂面', [pointCmd, deferredFaceCmd]);
  useHistoryStore.getState().execute(batch);

  const pointId = pointCmd.getCreatedId();
  if (pointId) {
    useSelectionStore.getState().select(pointId);
  }

  cleanup();
  useToolStore.getState().setActiveTool('select');
  useNotificationStore.getState().show(`已创建垂面 — 选中点 ${label} 后拖动右侧「参数 t」滑块可移动垂面`, 4000);
  handling = false;
}

function createFaceForPoint(pointId: string, geometryId: string) {
  const pointEntity = useEntityStore.getState().getEntity(pointId);
  const pointLabel = pointEntity?.type === 'point'
    ? (pointEntity.properties as PointProperties).label
    : '?';

  const command = new CreateEntityCommand('face', {
    builtIn: false,
    geometryId,
    pointIds: [pointId],
    source: { type: 'perpendicularPlane' as const, pointId },
    showPlane: true,
  });
  useHistoryStore.getState().execute(command);
  useSelectionStore.getState().select(pointId);
  useToolStore.getState().setActiveTool('select');
  useNotificationStore.getState().show(`已创建垂面 — 选中点 ${pointLabel} 后拖动右侧「参数 t」滑块可移动垂面`, 4000);
}

function cleanup() {
  unsubscribe?.();
  unsubscribe = null;
  handling = false;
  useToolStore.getState().setToolStepInfo(null);
  useToolStore.getState().setToolSteps(null);
}

export const perpendicularPlaneTool: Tool = {
  id: 'perpendicularPlane',
  label: '垂面',

  onActivate() {
    useSelectionStore.getState().clear();
    handling = false;

    useToolStore.getState().setToolSteps([
      { label: '选择线段或线段上的动点', status: 'active' as const },
    ]);

    let prevSelectedId: string | undefined;
    unsubscribe = useSelectionStore.subscribe((state) => {
      if (handling) return;
      const id = state.selectedIds[0];
      if (!id || id === prevSelectedId) return;
      prevSelectedId = id;
      const entity = useEntityStore.getState().getEntity(id);
      if (entity?.type === 'segment') {
        handleSegmentSelected(id);
      }
    });

    const currentSelected = useSelectionStore.getState().selectedIds[0];
    if (currentSelected) {
      const entity = useEntityStore.getState().getEntity(currentSelected);
      if (entity?.type === 'segment') {
        handleSegmentSelected(currentSelected);
      }
    }
  },

  onDeactivate() {
    cleanup();
    useSelectionStore.getState().clear();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (!event.hitEntityId) return;

    if (event.hitEntityType === 'point') {
      const entityStore = useEntityStore.getState();
      const pointEntity = entityStore.getEntity(event.hitEntityId);
      if (!pointEntity || pointEntity.type !== 'point') return;

      const props = pointEntity.properties as PointProperties;
      const constraint = props.constraint;

      if (constraint.type !== 'segment' && constraint.type !== 'edge') {
        useNotificationStore.getState().show('该点不在线段/棱上，请点击线段上的动点，或从左侧实体列表选择线段');
        return;
      }

      createFaceForPoint(event.hitEntityId, props.geometryId);
    } else if (event.hitEntityType === 'segment') {
      handleSegmentSelected(event.hitEntityId);
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      cleanup();
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    }
  },

  renderOverlay() {
    return null;
  },
};
