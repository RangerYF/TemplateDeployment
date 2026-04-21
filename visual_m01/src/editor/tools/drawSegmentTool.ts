import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';

/**
 * DrawSegmentTool — 画线段工具
 * 职责：两次点击 Point Entity 创建 Segment Entity
 */

let startPointId: string | null = null;

export const drawSegmentTool: Tool = {
  id: 'drawSegment',
  label: '画线段',

  onActivate() {
    startPointId = null;
  },

  onDeactivate() {
    startPointId = null;
  },

  onPointerDown(event: ToolPointerEvent) {
    // 仅响应 Point Entity 命中
    if (!event.hitEntityId || event.hitEntityType !== 'point') return;

    const store = useEntityStore.getState();
    const hitEntity = store.getEntity(event.hitEntityId);
    if (!hitEntity || hitEntity.type !== 'point') return;

    if (startPointId === null) {
      // 第一次点击：记录起点
      startPointId = event.hitEntityId;
      useSelectionStore.getState().select(event.hitEntityId);
    } else {
      // 第二次点击
      if (event.hitEntityId === startPointId) return; // 不能自连

      // 获取两个点的 geometryId
      const startEntity = store.getEntity(startPointId);
      if (!startEntity || startEntity.type !== 'point') {
        startPointId = null;
        return;
      }

      const geometryId = (startEntity.properties as PointProperties).geometryId;

      // 构造 CreateEntityCommand 创建 Segment
      const command = new CreateEntityCommand('segment', {
        builtIn: false,
        geometryId,
        startPointId,
        endPointId: event.hitEntityId,
        style: { color: '#ff0000', dashed: false },
      });

      useHistoryStore.getState().execute(command);

      // 创建完成，切回选择工具
      startPointId = null;
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      startPointId = null;
      useSelectionStore.getState().clear();
      useToolStore.getState().setActiveTool('select');
    }
  },

  renderOverlay() {
    // 阶段4实现预览线渲染（起点 → 鼠标当前位置）
    return null;
  },
};
