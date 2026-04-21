/**
 * Core shared editor infrastructure — used across all skill modules.
 */
export { EditorInjectable } from '@/editor/core/EditorInjectable';
export type { IEditor } from '@/editor/core/EditorInjectable';
export { useHistoryStore } from '@/editor/store/historyStore';
export { useAnimationStore } from '@/editor/store/animationStore';
export type { Command } from '@/editor/commands/types';
export { PanZoomTool } from '@/editor/tools/PanZoomTool';
