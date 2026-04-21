import { create } from 'zustand';
import type { Tool } from '../tools/types';
import { signals } from '../signals';

export interface ToolStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

interface ToolStoreState {
  activeToolId: string;
  tools: Record<string, Tool>;
  isDragging: boolean;
  /** 当前工具的步骤提示文案（单行文本，优先于 ModeIndicator 的静态映射） */
  toolStepInfo: string | null;
  /** 多步骤工具的结构化步骤列表（供 ModeIndicator 渲染进度条） */
  toolSteps: ToolStep[] | null;

  registerTool(tool: Tool): void;
  setActiveTool(toolId: string): void;
  getActiveTool(): Tool | undefined;
  setIsDragging(dragging: boolean): void;
  setToolStepInfo(info: string | null): void;
  setToolSteps(steps: ToolStep[] | null): void;
}

export const useToolStore = create<ToolStoreState>()((set, get) => ({
  activeToolId: 'select',
  tools: {},
  isDragging: false,
  toolStepInfo: null,
  toolSteps: null,

  registerTool(tool: Tool): void {
    set((state) => ({
      tools: { ...state.tools, [tool.id]: tool },
    }));
  },

  setActiveTool(toolId: string): void {
    const state = get();
    const currentTool = state.tools[state.activeToolId];
    const nextTool = state.tools[toolId];

    if (!nextTool) return;

    currentTool?.onDeactivate?.();
    set({ activeToolId: toolId });
    nextTool.onActivate?.();

    signals.toolChanged.emit({ toolId });
  },

  getActiveTool(): Tool | undefined {
    const state = get();
    return state.tools[state.activeToolId];
  },

  setIsDragging(dragging: boolean): void {
    set({ isDragging: dragging });
  },

  setToolStepInfo(info: string | null): void {
    set({ toolStepInfo: info });
  },

  setToolSteps(steps: ToolStep[] | null): void {
    set({ toolSteps: steps });
  },
}));
