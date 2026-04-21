export type { Tool, ToolPointerEvent } from './types';

export { selectTool } from './selectTool';
export { drawSegmentTool } from './drawSegmentTool';
export { crossSectionTool } from './crossSectionTool';
export { coordSystemTool } from './coordSystemTool';
export { circumCircleTool } from './circumCircleTool';
export { angleTool } from './angleTool';
export { distanceTool } from './distanceTool';

import { useToolStore } from '../store/toolStore';
import { selectTool } from './selectTool';
import { drawSegmentTool } from './drawSegmentTool';
import { crossSectionTool } from './crossSectionTool';
import { coordSystemTool } from './coordSystemTool';
import { circumCircleTool } from './circumCircleTool';
import { angleTool } from './angleTool';
import { distanceTool } from './distanceTool';

/**
 * 注册所有 Tool 到 ToolStore，设置默认 activeTool 为 'select'
 * 阶段4调用此函数完成初始化
 */
export function registerAllTools(): void {
  const store = useToolStore.getState();
  store.registerTool(selectTool);
  store.registerTool(drawSegmentTool);
  store.registerTool(crossSectionTool);
  store.registerTool(coordSystemTool);
  store.registerTool(circumCircleTool);
  store.registerTool(angleTool);
  store.registerTool(distanceTool);
  store.setActiveTool('select');
}
