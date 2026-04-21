// Entity 系统
export * from './entities';

// Signal 系统
export { Signal, signals } from './signals';
export type { CommandLike } from './signals';

// Store
export { useEntityStore, useSelectionStore, useToolStore, useHistoryStore, useUIStore } from './store';

// Commands
export {
  CreateEntityCommand,
  DeleteEntityCommand,
  UpdatePropertiesCommand,
  BatchCommand,
  ChangeGeometryTypeCommand,
  UpdateGeometryParamsCommand,
  MovePointCommand,
  RenameEntityCommand,
  CreateCrossSectionCommand,
  UpdateCrossSectionCommand,
  DeleteEntityCascadeCommand,
} from './commands';
export type { Command } from './commands';

// Tools
export type { Tool, ToolPointerEvent } from './tools';
export {
  selectTool,
  drawSegmentTool,
  crossSectionTool,
  coordSystemTool,
  circumCircleTool,
  registerAllTools,
} from './tools';

// Shortcuts
export { setupShortcuts, teardownShortcuts } from './shortcuts';

// Builder Cache
export { getBuilderResult, useBuilderResult, invalidateCache, clearCache } from './builderCache';

// Init
export { initEditor, useEditorInit } from './init';
