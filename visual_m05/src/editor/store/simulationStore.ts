import { create } from 'zustand';
import type { SimulationEntity } from '../entities/types';
import type { SimulationType, SimulationParams, SimulationResult } from '../../types/simulation';
import { DEFAULT_PARAMS } from '../../types/simulation';
import { signals } from '../signals';

export interface SimulationSnapshot {
  simulations: Record<string, SimulationEntity>;
  activeSimId: string | null;
  nextId: number;
}

interface SimulationStoreState {
  simulations: Record<string, SimulationEntity>;
  activeSimId: string | null;
  nextId: number;

  createSimulation(type: SimulationType, params?: SimulationParams): SimulationEntity;
  updateParams(id: string, params: Partial<SimulationParams>): void;
  setResult(id: string, result: SimulationResult): void;
  setRunning(id: string, running: boolean): void;
  resetResult(id: string): void;
  getActiveSimulation(): SimulationEntity | undefined;
  setActiveSimId(id: string | null): void;
  getSnapshot(): SimulationSnapshot;
  loadSnapshot(snapshot: SimulationSnapshot): void;
}

export const useSimulationStore = create<SimulationStoreState>()((set, get) => ({
  simulations: {},
  activeSimId: null,
  nextId: 1,

  createSimulation(type: SimulationType, params?: SimulationParams): SimulationEntity {
    const state = get();
    const id = `sim-${state.nextId}`;
    const entity: SimulationEntity = {
      id,
      type,
      params: params ?? DEFAULT_PARAMS[type],
      result: null,
      isRunning: false,
      visible: true,
    };

    set({
      simulations: { ...state.simulations, [id]: entity },
      activeSimId: id,
      nextId: state.nextId + 1,
    });

    signals.simulationCreated.emit({ simId: id });
    signals.selectionChanged.emit({ simId: id });
    return entity;
  },

  updateParams(id: string, params: Partial<SimulationParams>): void {
    const state = get();
    const sim = state.simulations[id];
    if (!sim) return;

    const updated: SimulationEntity = {
      ...sim,
      params: { ...sim.params, ...params } as SimulationParams,
    };

    set({ simulations: { ...state.simulations, [id]: updated } });
    signals.simulationUpdated.emit({ simId: id, changes: Object.keys(params) });
  },

  setResult(id: string, result: SimulationResult): void {
    const state = get();
    const sim = state.simulations[id];
    if (!sim) return;

    set({
      simulations: {
        ...state.simulations,
        [id]: { ...sim, result, isRunning: false },
      },
    });
    signals.simulationRun.emit({ simId: id });
  },

  setRunning(id: string, running: boolean): void {
    const state = get();
    const sim = state.simulations[id];
    if (!sim) return;

    set({
      simulations: {
        ...state.simulations,
        [id]: { ...sim, isRunning: running },
      },
    });
  },

  resetResult(id: string): void {
    const state = get();
    const sim = state.simulations[id];
    if (!sim) return;

    set({
      simulations: {
        ...state.simulations,
        [id]: { ...sim, result: null, isRunning: false },
      },
    });
    signals.simulationReset.emit({ simId: id });
  },

  getActiveSimulation(): SimulationEntity | undefined {
    const state = get();
    if (!state.activeSimId) return undefined;
    return state.simulations[state.activeSimId];
  },

  setActiveSimId(id: string | null): void {
    set({ activeSimId: id });
    signals.selectionChanged.emit({ simId: id });
  },

  getSnapshot(): SimulationSnapshot {
    const state = get();
    return {
      simulations: { ...state.simulations },
      activeSimId: state.activeSimId,
      nextId: state.nextId,
    };
  },

  loadSnapshot(snapshot: SimulationSnapshot): void {
    set({
      simulations: snapshot.simulations,
      activeSimId: snapshot.activeSimId,
      nextId: snapshot.nextId,
    });
  },
}));
