import { create } from 'zustand';
import type { TitrationType } from '@/data/titrationPresets';
import { TITRATION_PRESETS, getPreset } from '@/data/titrationPresets';
import {
  generateTitrationCurve,
  type TitrationCurveResult,
} from '@/engine/titrationMath';

// Curve colors for overlaid curves
export const CURVE_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

export interface ComparisonStoreSnapshot {
  selectedTypes: TitrationType[];
}

export interface ComparisonState {
  selectedTypes: TitrationType[];
  curves: Partial<Record<TitrationType, TitrationCurveResult>>;

  toggleType: (type: TitrationType) => void;
  getSnapshot: () => ComparisonStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<ComparisonStoreSnapshot>) => void;
}

function buildCurves(types: TitrationType[]): Partial<Record<TitrationType, TitrationCurveResult>> {
  const result: Partial<Record<TitrationType, TitrationCurveResult>> = {};
  for (const t of types) {
    const preset = getPreset(t);
    result[t] = generateTitrationCurve(t, 0.1, 0.1, 20, preset.pKa);
  }
  return result;
}

const defaultTypes: TitrationType[] = [
  TITRATION_PRESETS[0].type,
  TITRATION_PRESETS[2].type,
];

const VALID_TYPES = new Set<TitrationType>(TITRATION_PRESETS.map((preset) => preset.type));

export const useComparisonStore = create<ComparisonState>((set, get) => ({
  selectedTypes: defaultTypes,
  curves: buildCurves(defaultTypes),

  toggleType: (type) =>
    set((s) => {
      let next: TitrationType[];
      if (s.selectedTypes.includes(type)) {
        next = s.selectedTypes.filter((t) => t !== type);
      } else {
        next = [...s.selectedTypes, type];
      }
      return { selectedTypes: next, curves: buildCurves(next) };
    }),

  getSnapshot: (): ComparisonStoreSnapshot => {
    const state: ComparisonState = get();
    return {
      selectedTypes: [...state.selectedTypes],
    };
  },

  loadSnapshot: (snapshot) => {
    const selectedTypes = Array.isArray(snapshot?.selectedTypes)
      ? snapshot.selectedTypes.filter((value): value is TitrationType => typeof value === 'string' && VALID_TYPES.has(value as TitrationType))
      : defaultTypes;
    const nextTypes = selectedTypes.length > 0 ? selectedTypes : defaultTypes;
    set({
      selectedTypes: nextTypes,
      curves: buildCurves(nextTypes),
    });
  },
}));
