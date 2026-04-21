import { Viewport } from '@/canvas/Viewport';
import type { Command } from '@/editor/commands/types';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { useHistoryStore } from '@/editor/store/historyStore';
import { useFunctionStore } from '@/editor/store/functionStore';

export class Editor {
  private viewport: Viewport;
  private activeTool: Tool | null = null;

  constructor(initialViewport: Viewport) {
    this.viewport = initialViewport;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  setViewport(vp: Viewport): void {
    this.viewport = vp;
    useFunctionStore.getState().setViewport({
      xMin: vp.xMin,
      xMax: vp.xMax,
      yMin: vp.yMin,
      yMax: vp.yMax,
    });
  }

  activateTool(tool: Tool): void {
    this.activeTool?.onDeactivate?.();
    this.activeTool = tool;
    tool.onActivate?.(this);
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  getActiveToolId(): string {
    return this.activeTool?.id ?? '';
  }

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

  execute(command: Command): void {
    command.execute();
    useHistoryStore.getState().execute(command);
  }
}

export let editorInstance: Editor | null = null;

export function initEditor(vp: Viewport): Editor {
  editorInstance = new Editor(vp);
  return editorInstance;
}
