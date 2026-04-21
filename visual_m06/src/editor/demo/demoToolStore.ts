import { create } from 'zustand';
import type { DemoTool, DemoOpKind } from './demoTypes';

export interface DemoToolSnapshot {
  activeTool: DemoTool;
  opKind: DemoOpKind | null;
  step: number;
  pendingStartPoint: { x: number; y: number } | null;
  pendingVec1Id: string | null;
}

interface DemoToolStoreState {
  activeTool: DemoTool;
  opKind: DemoOpKind | null;
  step: number;  // 0 / 1 多步骤进度
  pendingStartPoint: { x: number; y: number } | null;  // createVector 第一步临时起点
  pendingVec1Id: string | null;  // vectorOp 第一步选中向量

  setTool(tool: DemoTool): void;
  setOpKind(kind: DemoOpKind | null): void;
  nextStep(): void;
  resetTool(): void;
  setPendingStart(pt: { x: number; y: number } | null): void;
  setPendingVec1(id: string | null): void;
  getSnapshot(): DemoToolSnapshot;
  loadSnapshot(snapshot?: Partial<DemoToolSnapshot>): void;
}

export const useDemoToolStore = create<DemoToolStoreState>()((set) => ({
  activeTool: 'select',
  opKind: null,
  step: 0,
  pendingStartPoint: null,
  pendingVec1Id: null,

  setTool(tool) {
    set({ activeTool: tool, step: 0, pendingStartPoint: null, pendingVec1Id: null });
  },

  setOpKind(kind) {
    set({ opKind: kind, step: 0, pendingStartPoint: null, pendingVec1Id: null });
  },

  nextStep() {
    set((s) => ({ step: s.step + 1 }));
  },

  resetTool() {
    set({ step: 0, pendingStartPoint: null, pendingVec1Id: null });
  },

  setPendingStart(pt) {
    set({ pendingStartPoint: pt });
  },

  setPendingVec1(id) {
    set({ pendingVec1Id: id });
  },

  getSnapshot(): DemoToolSnapshot {
    const state: DemoToolStoreState = useDemoToolStore.getState();
    return {
      activeTool: state.activeTool,
      opKind: state.opKind,
      step: state.step,
      pendingStartPoint: state.pendingStartPoint,
      pendingVec1Id: state.pendingVec1Id,
    };
  },

  loadSnapshot(snapshot?: Partial<DemoToolSnapshot>) {
    set({
      activeTool: snapshot?.activeTool ?? 'select',
      opKind: snapshot?.opKind ?? null,
      step: snapshot?.step ?? 0,
      pendingStartPoint: snapshot?.pendingStartPoint ?? null,
      pendingVec1Id: snapshot?.pendingVec1Id ?? null,
    });
  },
}));
