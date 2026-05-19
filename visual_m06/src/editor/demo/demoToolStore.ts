import { create } from 'zustand';
import type { DemoTool, DemoOpKind } from './demoTypes';

export interface DemoToolSnapshot {
  activeTool: DemoTool;
  opKind: DemoOpKind | null;
  step: number;
  pendingStartPoint: { x: number; y: number } | null;
  pendingVec1Id: string | null;
  pendingMarkerIds: string[];
  showAllCoords: boolean;
}

interface DemoToolStoreState {
  activeTool: DemoTool;
  opKind: DemoOpKind | null;
  step: number;
  pendingStartPoint: { x: number; y: number } | null;
  pendingVec1Id: string | null;
  pendingMarkerIds: string[];
  showAllCoords: boolean;

  setTool(tool: DemoTool): void;
  setOpKind(kind: DemoOpKind | null): void;
  nextStep(): void;
  resetTool(): void;
  setPendingStart(pt: { x: number; y: number } | null): void;
  setPendingVec1(id: string | null): void;
  pushPendingMarker(id: string): void;
  popPendingMarker(): void;
  toggleShowAllCoords(): void;
  getSnapshot(): DemoToolSnapshot;
  loadSnapshot(snapshot?: Partial<DemoToolSnapshot>): void;
}

export const useDemoToolStore = create<DemoToolStoreState>()((set) => ({
  activeTool: 'select',
  opKind: null,
  step: 0,
  pendingStartPoint: null,
  pendingVec1Id: null,
  pendingMarkerIds: [],
  showAllCoords: false,

  setTool(tool) {
    set({ activeTool: tool, step: 0, pendingStartPoint: null, pendingVec1Id: null, pendingMarkerIds: [] });
  },

  setOpKind(kind) {
    set({ opKind: kind, step: 0, pendingStartPoint: null, pendingVec1Id: null, pendingMarkerIds: [] });
  },

  nextStep() {
    set((s) => ({ step: s.step + 1 }));
  },

  resetTool() {
    set({ step: 0, pendingStartPoint: null, pendingVec1Id: null, pendingMarkerIds: [] });
  },

  setPendingStart(pt) {
    set({ pendingStartPoint: pt });
  },

  setPendingVec1(id) {
    set({ pendingVec1Id: id });
  },

  pushPendingMarker(id) {
    set((s) => ({ pendingMarkerIds: [...s.pendingMarkerIds, id] }));
  },

  popPendingMarker() {
    set((s) => ({ pendingMarkerIds: s.pendingMarkerIds.slice(0, -1) }));
  },

  toggleShowAllCoords() {
    set((s) => ({ showAllCoords: !s.showAllCoords }));
  },

  getSnapshot(): DemoToolSnapshot {
    const state: DemoToolStoreState = useDemoToolStore.getState();
    return {
      activeTool: state.activeTool,
      opKind: state.opKind,
      step: state.step,
      pendingStartPoint: state.pendingStartPoint,
      pendingVec1Id: state.pendingVec1Id,
      pendingMarkerIds: [...state.pendingMarkerIds],
      showAllCoords: state.showAllCoords,
    };
  },

  loadSnapshot(snapshot?: Partial<DemoToolSnapshot>) {
    set({
      activeTool: snapshot?.activeTool ?? 'select',
      opKind: snapshot?.opKind ?? null,
      step: snapshot?.step ?? 0,
      pendingStartPoint: snapshot?.pendingStartPoint ?? null,
      pendingVec1Id: snapshot?.pendingVec1Id ?? null,
      pendingMarkerIds: snapshot?.pendingMarkerIds ?? [],
      showAllCoords: snapshot?.showAllCoords ?? false,
    });
  },
}));
