import { Viewport } from '@/canvas/Viewport';
import type { Command } from '@/editor/commands/types';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { useHistoryStore } from '@/editor/store/historyStore';
import type { ViewportState } from '@/types';

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Minimal surface that both Editor (M02) and EditorInjectable (M03/M04)
 * expose. PanZoomTool / TraceTool only need these four methods.
 */
export interface IEditor {
  getViewport(): Viewport;
  setViewport(vp: Viewport): void;
  activateTool(tool: Tool): void;
  execute(command: Command): void;
}

// ─── Injectable Editor ────────────────────────────────────────────────────────

/**
 * An Editor variant whose only difference from the M02 Editor is that it
 * receives a `setViewportFn` callback via the constructor instead of
 * hard-wiring `useFunctionStore`.
 *
 * This enables multiple fully-isolated Editor instances on the same page:
 *  - Each instance owns its own Viewport (no shared state between the two canvases).
 *  - Each instance calls the correct Zustand store setter via the injected fn.
 *  - Both instances share the same historyStore (Undo/Redo stack is global).
 *
 * Injection pattern (from M03-v2 §3.2 / M04-v2 §3.2):
 * ```typescript
 * const editor = new EditorInjectable(
 *   initialVp,
 *   useTrigStore.getState().setViewportB,  // bound to this canvas instance
 * );
 * ```
 */
export class EditorInjectable implements IEditor {
  private viewport: Viewport;
  private activeTool: Tool | null = null;

  constructor(
    initialViewport: Viewport,
    /** Called whenever the viewport changes (pan / zoom / resize). */
    private readonly setViewportFn: (vp: ViewportState) => void,
  ) {
    this.viewport = initialViewport;
  }

  // ── Viewport ──────────────────────────────────────────────────────────────

  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Update the viewport and propagate to the injected store setter.
   * Called by PanZoomTool on every pan / zoom tick and on ResizeObserver events.
   */
  setViewport(vp: Viewport): void {
    this.viewport = vp;
    this.setViewportFn({
      xMin: vp.xMin,
      xMax: vp.xMax,
      yMin: vp.yMin,
      yMax: vp.yMax,
    });
  }

  // ── Tool management ───────────────────────────────────────────────────────

  activateTool(tool: Tool): void {
    this.activeTool?.onDeactivate?.();
    this.activeTool = tool;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool.onActivate?.(this as any);   // safe: Tool.onActivate(editor: AnyEditor)
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  // ── Event dispatch ────────────────────────────────────────────────────────

  dispatchPointerDown(event: ToolEvent): void {
    this.activeTool?.onPointerDown?.(event);
  }

  dispatchPointerMove(event: ToolEvent): void {
    this.activeTool?.onPointerMove?.(event);
  }

  dispatchPointerUp(event: ToolEvent): void {
    this.activeTool?.onPointerUp?.(event);
  }

  dispatchPointerLeave(): void {
    this.activeTool?.onPointerLeave?.();
  }

  dispatchDblClick(event: ToolEvent): void {
    this.activeTool?.onDblClick?.(event);
  }

  dispatchWheel(event: ToolEvent & { deltaY: number }): void {
    this.activeTool?.onWheel?.(event);
  }

  // ── Command / history ─────────────────────────────────────────────────────

  /**
   * Execute a command and push it to the shared history stack.
   * Note: execute() calls command.execute() before historyStore.execute()
   * (identical to M02 Editor.execute behaviour).
   */
  execute(command: Command): void {
    command.execute();
    useHistoryStore.getState().execute(command);
  }
}
