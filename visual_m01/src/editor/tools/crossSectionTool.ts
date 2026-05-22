import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useHistoryStore } from '../store/historyStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { createCrossSectionFromPoints } from '../crossSectionHelper';
import { useNotificationStore } from '@/components/scene/notificationStore';

/**
 * CrossSectionTool — 截面工具
 * 职责：多次点击 Point Entity 选定截面定义点，创建 Face(crossSection) + 交点 Points
 */

let definingPointIds: string[] = [];

export const crossSectionTool: Tool = {
  id: 'crossSection',
  label: '截面',

  onActivate() {
    definingPointIds = [];
  },

  onDeactivate() {
    definingPointIds = [];
  },

  onPointerDown(event: ToolPointerEvent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ud = (event.intersection as any)?.object?.userData;

    if (ud?.isSnapPoint) {
      const { geometryId, edgeStart, edgeEnd, t } = ud.snapData as {
        geometryId: string; edgeStart: number; edgeEnd: number; t: number;
      };
      const pointId = getOrCreateEdgePoint(geometryId, edgeStart, edgeEnd, t);
      if (!pointId || definingPointIds.includes(pointId)) return;
      addDefiningPoint(pointId);
      return;
    }

    if (!event.hitEntityId || event.hitEntityType !== 'point') return;
    if (definingPointIds.includes(event.hitEntityId)) return;
    addDefiningPoint(event.hitEntityId);
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      definingPointIds = [];
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    } else if (event.key === 'Backspace') {
      // 撤销最后一个选定的定义点
      if (definingPointIds.length > 0) {
        definingPointIds.pop();
        if (definingPointIds.length > 0) {
          useSelectionStore
            .getState()
            .select(definingPointIds[definingPointIds.length - 1]);
        } else {
          useSelectionStore.getState().clear();
        }
      }
    }
  },

  renderOverlay() {
    return null;
  },
};

function addDefiningPoint(pointId: string) {
  definingPointIds.push(pointId);
  useSelectionStore.getState().addToSelection(pointId);

  if (definingPointIds.length >= 3) {
    const result = tryCreateCrossSection();
    definingPointIds = [];
    if (result.success) {
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    } else {
      useSelectionStore.getState().clear();
      useNotificationStore.getState().show(result.message);
    }
  }
}

function getOrCreateEdgePoint(geometryId: string, edgeStart: number, edgeEnd: number, t: number): string | null {
  const store = useEntityStore.getState();
  const existing = store.findPointOnEdge(geometryId, edgeStart, edgeEnd, t);
  if (existing) return existing.id;

  const label = nextAvailableLabel(store);
  const cmd = new CreateEntityCommand('point', {
    builtIn: false,
    geometryId,
    constraint: { type: 'edge' as const, edgeStart, edgeEnd, t },
    label,
  });
  useHistoryStore.getState().execute(cmd);
  return cmd.getCreatedId();
}

function nextAvailableLabel(store: ReturnType<typeof useEntityStore.getState>): string {
  const entities = store.entities;
  const used = new Set<string>();
  for (const e of Object.values(entities)) {
    if (e.type === 'point') {
      used.add((e.properties as PointProperties).label);
    }
  }
  for (let i = 1; ; i++) {
    const label = `P${i}`;
    if (!used.has(label)) return label;
  }
}

/**
 * 尝试从当前定义点计算截面并创建（委托给 crossSectionHelper）
 * @returns 创建结果
 */
function tryCreateCrossSection(): { success: boolean; message: string } {
  const entityStore = useEntityStore.getState();

  // 获取第一个点的 geometryId
  const firstPoint = entityStore.getEntity(definingPointIds[0]);
  if (!firstPoint || firstPoint.type !== 'point') {
    return { success: false, message: '请选择几何体上的点来创建截面' };
  }
  const geometryId = (firstPoint.properties as PointProperties).geometryId;

  const selectedPoints = definingPointIds
    .map((id) => entityStore.getEntity(id))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity));
  const allSameGeometry = selectedPoints.every((entity) => {
    if (entity.type !== 'point') return false;
    return (entity.properties as PointProperties).geometryId === geometryId;
  });
  if (!allSameGeometry) {
    return { success: false, message: '截面定义点必须属于同一个几何体' };
  }

  return createCrossSectionFromPoints(geometryId, definingPointIds);
}
