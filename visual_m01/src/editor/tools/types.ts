import type { EntityType } from '../entities/types';

export interface ToolPointerEvent {
  nativeEvent: PointerEvent;
  intersection?: unknown; // THREE.Intersection — 阶段3实现时替换为具体类型
  hitEntityId?: string;
  hitEntityType?: EntityType;
}

export interface Tool {
  id: string;
  label: string;
  onActivate?(): void;
  onDeactivate?(): void;
  onPointerDown?(event: ToolPointerEvent): void;
  onPointerMove?(event: ToolPointerEvent): void;
  onPointerUp?(event: ToolPointerEvent): void;
  onKeyDown?(event: KeyboardEvent): void;
  renderOverlay?(): unknown; // React.ReactNode — 阶段3实现时替换
}
