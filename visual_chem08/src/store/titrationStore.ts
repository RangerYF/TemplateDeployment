import { create } from 'zustand';
import type { TitrationType } from '@/data/titrationPresets';
import { getPreset } from '@/data/titrationPresets';
import {
  generateTitrationCurve,
  type TitrationCurveResult,
} from '@/engine/titrationMath';

export interface TitrationStoreSnapshot {
  titrationTypeId: TitrationType;
  titrantConc: number;
  analyteConc: number;
  analyteVol: number;
  selectedIndicatorIds: string[];
}

export interface TitrationState {
  titrationTypeId: TitrationType;
  titrantConc: number;
  analyteConc: number;
  analyteVol: number;
  selectedIndicatorIds: string[];
  curveData: TitrationCurveResult | null;

  setTitrationType: (type: TitrationType) => void;
  setTitrantConc: (c: number) => void;
  setAnalyteConc: (c: number) => void;
  setAnalyteVol: (v: number) => void;
  toggleIndicator: (id: string) => void;
  getSnapshot: () => TitrationStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<TitrationStoreSnapshot>) => void;
}

function recalculate(state: {
  titrationTypeId: TitrationType;
  titrantConc: number;
  analyteConc: number;
  analyteVol: number;
}): TitrationCurveResult {
  const preset = getPreset(state.titrationTypeId);
  return generateTitrationCurve(
    state.titrationTypeId,
    state.titrantConc,
    state.analyteConc,
    state.analyteVol,
    preset.pKa,
  );
}

const initialState = {
  titrationTypeId: 'strongAcid_strongBase' as TitrationType,
  titrantConc: 0.1,
  analyteConc: 0.1,
  analyteVol: 20,
  selectedIndicatorIds: ['phenolphthalein'],
};

function clampPositive(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export const useTitrationStore = create<TitrationState>((set, get) => ({
  ...initialState,
  curveData: recalculate(initialState),

  setTitrationType: (type) =>
    set((s) => {
      const next = { ...s, titrationTypeId: type };
      return { titrationTypeId: type, curveData: recalculate(next) };
    }),

  setTitrantConc: (c) =>
    set((s) => {
      const next = { ...s, titrantConc: c };
      return { titrantConc: c, curveData: recalculate(next) };
    }),

  setAnalyteConc: (c) =>
    set((s) => {
      const next = { ...s, analyteConc: c };
      return { analyteConc: c, curveData: recalculate(next) };
    }),

  setAnalyteVol: (v) =>
    set((s) => {
      const next = { ...s, analyteVol: v };
      return { analyteVol: v, curveData: recalculate(next) };
    }),

  toggleIndicator: (id) =>
    set((s) => {
      const ids = s.selectedIndicatorIds.includes(id)
        ? s.selectedIndicatorIds.filter((i) => i !== id)
        : [...s.selectedIndicatorIds, id];
      return { selectedIndicatorIds: ids };
    }),

  getSnapshot: (): TitrationStoreSnapshot => {
    const state: TitrationState = get();
    return {
      titrationTypeId: state.titrationTypeId,
      titrantConc: state.titrantConc,
      analyteConc: state.analyteConc,
      analyteVol: state.analyteVol,
      selectedIndicatorIds: [...state.selectedIndicatorIds],
    };
  },

  loadSnapshot: (snapshot) => {
    const nextState: TitrationStoreSnapshot = {
      titrationTypeId: snapshot?.titrationTypeId ?? initialState.titrationTypeId,
      titrantConc: clampPositive(snapshot?.titrantConc, initialState.titrantConc),
      analyteConc: clampPositive(snapshot?.analyteConc, initialState.analyteConc),
      analyteVol: clampPositive(snapshot?.analyteVol, initialState.analyteVol),
      selectedIndicatorIds: Array.isArray(snapshot?.selectedIndicatorIds)
        ? snapshot.selectedIndicatorIds.filter((value): value is string => typeof value === 'string')
        : [...initialState.selectedIndicatorIds],
    };
    set({
      ...nextState,
      curveData: recalculate(nextState),
    });
  },
}));
