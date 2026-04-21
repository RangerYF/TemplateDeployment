/**
 * Ephemeral trajectory data for movable points (not in undo history).
 */

import { create } from 'zustand';

interface TrajectoryPoint {
  x: number;
  y: number;
}

const MAX_TRACE_POINTS = 500;

interface MovablePointStoreState {
  trajectories: Record<string, TrajectoryPoint[]>;
  pushTracePoint: (pointId: string, x: number, y: number) => void;
  clearTrajectory: (pointId: string) => void;
  clearAll: () => void;
}

export const useMovablePointStore = create<MovablePointStoreState>((set) => ({
  trajectories: {},

  pushTracePoint: (pointId, x, y) =>
    set((s) => {
      const existing = s.trajectories[pointId] ?? [];
      const next = [...existing, { x, y }];
      if (next.length > MAX_TRACE_POINTS) next.shift();
      return { trajectories: { ...s.trajectories, [pointId]: next } };
    }),

  clearTrajectory: (pointId) =>
    set((s) => {
      const { [pointId]: _removed, ...rest } = s.trajectories;
      void _removed;
      return { trajectories: rest };
    }),

  clearAll: () => set({ trajectories: {} }),
}));
