// Forward-declare Editor to avoid circular import; the concrete type is applied at call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = any;

export interface ToolEvent {
  canvasX: number;
  canvasY: number;
  mathX: number;
  mathY: number;
  nativeEvent: MouseEvent | WheelEvent;
}

export interface Tool {
  readonly id: string;
  onActivate?(editor: AnyEditor): void;
  onDeactivate?(): void;
  onPointerDown?(event: ToolEvent): void;
  onPointerMove?(event: ToolEvent): void;
  onPointerUp?(event: ToolEvent): void;
  onPointerLeave?(): void;
  onDblClick?(event: ToolEvent): void;
  onWheel?(event: ToolEvent & { deltaY: number }): void;
}
