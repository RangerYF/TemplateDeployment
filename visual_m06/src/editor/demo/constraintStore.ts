import { create } from 'zustand';
import { parseConstraint, parseExpression, type ConstraintContext, type ParsedConstraint } from '@/engine/constraintParser';
import { marchingSquares } from '@/engine/marchingSquares';
import { DEMO_COLORS } from './demoTypes';

export interface LocusConstraint {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  parsed: ParsedConstraint | null;
  segments: [number, number, number, number][];
}

export interface ObjectiveExtrema {
  min?: { x: number; y: number; value: number };
  max?: { x: number; y: number; value: number };
}

interface ConstraintState {
  constraints: Record<string, LocusConstraint>;
  nextId: number;
  objectiveExpr: string;
  objectiveExtrema: ObjectiveExtrema | null;
  addConstraint(expr: string, color?: string): string;
  removeConstraint(id: string): void;
  updateConstraint(id: string, patch: Partial<Pick<LocusConstraint, 'expression' | 'color' | 'visible'>>): void;
  setObjectiveExpr(expr: string): void;
  solveAll(ctx: ConstraintContext): void;
  clearAll(): void;
}

export const useConstraintStore = create<ConstraintState>((set, get) => ({
  constraints: {},
  nextId: 1,
  objectiveExpr: '',
  objectiveExtrema: null,

  addConstraint(expr, color) {
    const state = get();
    const id = `lc-${state.nextId}`;
    const colorIdx = Object.keys(state.constraints).length % DEMO_COLORS.length;
    const c: LocusConstraint = {
      id,
      expression: expr,
      color: color ?? DEMO_COLORS[colorIdx === 0 ? 1 : colorIdx],
      visible: true,
      parsed: null,
      segments: [],
    };
    set({ constraints: { ...state.constraints, [id]: c }, nextId: state.nextId + 1 });
    return id;
  },

  removeConstraint(id) {
    const current = get().constraints;
    const next = { ...current };
    delete next[id];
    set({ constraints: next });
  },

  updateConstraint(id, patch) {
    const state = get();
    const c = state.constraints[id];
    if (!c) return;
    set({ constraints: { ...state.constraints, [id]: { ...c, ...patch } } });
  },

  setObjectiveExpr(expr) {
    set({ objectiveExpr: expr, objectiveExtrema: null });
  },

  solveAll(ctx) {
    const state = get();
    const updated = { ...state.constraints };
    for (const [id, c] of Object.entries(updated)) {
      if (!c.visible) continue;
      let parsed = c.parsed;
      if (!parsed) {
        parsed = parseConstraint(c.expression, ctx);
      }
      if (!parsed) {
        updated[id] = { ...c, parsed: null, segments: [] };
        continue;
      }
      const segments = marchingSquares(
        (x, y) => parsed!.fn(x, y, ctx),
      );
      updated[id] = { ...c, parsed, segments };
    }

    let objectiveExtrema: ObjectiveExtrema | null = null;
    if (state.objectiveExpr.trim()) {
      const objFn = parseExpression(state.objectiveExpr.trim());
      if (objFn) {
        const allSegments = Object.values(updated)
          .filter((c) => c.visible && c.segments.length > 0)
          .flatMap((c) => c.segments);
        let minPt: ObjectiveExtrema['min'];
        let maxPt: ObjectiveExtrema['max'];
        const seen = new Set<string>();
        for (const [x1, y1, x2, y2] of allSegments) {
          for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
            const key = `${px.toFixed(4)},${py.toFixed(4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const v = objFn(px, py, ctx);
            if (isNaN(v)) continue;
            if (!minPt || v < minPt.value) minPt = { x: px, y: py, value: v };
            if (!maxPt || v > maxPt.value) maxPt = { x: px, y: py, value: v };
          }
        }
        if (minPt || maxPt) objectiveExtrema = { min: minPt, max: maxPt };
      }
    }

    set({ constraints: updated, objectiveExtrema });
  },

  clearAll() {
    set({ constraints: {}, nextId: 1, objectiveExpr: '', objectiveExtrema: null });
  },
}));
