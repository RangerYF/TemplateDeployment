import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
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
    if (!event.hitEntityId || event.hitEntityType !== 'point') return;

    // 不重复选同一个点
    if (definingPointIds.includes(event.hitEntityId)) return;

    definingPointIds.push(event.hitEntityId);
    useSelectionStore.getState().addToSelection(event.hitEntityId);

    if (definingPointIds.length >= 3) {
      // 尝试计算截面
      const result = tryCreateCrossSection();
      // 无论成功与否，重置定义点
      definingPointIds = [];
      if (result.success) {
        // 创建成功，切回选择工具
        useSelectionStore.getState().clear();
        useToolStore.getState().setActiveTool('select');
      } else {
        useSelectionStore.getState().clear();
        useNotificationStore.getState().show(result.message);
      }
    }
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
