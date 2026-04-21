import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';

/**
 * CircumCircleTool — 外接圆工具
 * 职责：点击 3 个 Point Entity 选定外接圆定义点，创建 CircumCircle Entity
 */

let selectedPointIds: string[] = [];

export const circumCircleTool: Tool = {
  id: 'circumCircle',
  label: '外接圆',

  onActivate() {
    selectedPointIds = [];
  },

  onDeactivate() {
    selectedPointIds = [];
    useSelectionStore.getState().clear();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (!event.hitEntityId || event.hitEntityType !== 'point') return;

    // 不重复选同一个点
    if (selectedPointIds.includes(event.hitEntityId)) return;

    selectedPointIds.push(event.hitEntityId);
    useSelectionStore.getState().addToSelection(event.hitEntityId);

    if (selectedPointIds.length >= 3) {
      createCircumCircle();
      selectedPointIds = [];
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      selectedPointIds = [];
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    } else if (event.key === 'Backspace') {
      if (selectedPointIds.length > 0) {
        selectedPointIds.pop();
        if (selectedPointIds.length > 0) {
          useSelectionStore
            .getState()
            .select(selectedPointIds[selectedPointIds.length - 1]);
        } else {
          useSelectionStore.getState().clear();
        }
      }
    }
  },
};

function createCircumCircle(): void {
  const entityStore = useEntityStore.getState();

  // 验证三个点
  const pointIds: [string, string, string] = [
    selectedPointIds[0],
    selectedPointIds[1],
    selectedPointIds[2],
  ];

  // 获取 geometryId（从第一个点）
  const firstPoint = entityStore.getEntity(pointIds[0]);
  if (!firstPoint || firstPoint.type !== 'point') return;
  const geometryId = (firstPoint.properties as PointProperties).geometryId;

  const command = new CreateEntityCommand('circumCircle', {
    pointIds,
    geometryId,
  });
  useHistoryStore.getState().execute(command);

  useSelectionStore.getState().clear();
  useToolStore.getState().setActiveTool('select');
}
