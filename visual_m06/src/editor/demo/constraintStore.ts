import { create } from 'zustand';
import { parseConstraint, parseExpression, type ConstraintContext, type ParsedConstraint } from '@/engine/constraintParser';
import { isVecExpression, parseVecConstraint, parseVecExpression, type ParsedVecConstraint, type VecConstraintContext } from '@/engine/vecExprParser';
import { marchingSquares } from '@/engine/marchingSquares';
import { DEMO_COLORS } from './demoTypes';
import type { DemoEntity, DemoVector, DemoPoint } from './demoTypes';

export interface LocusConstraint {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  parsed: ParsedConstraint | null;
  parsedVec: ParsedVecConstraint | null;
  isVecConstraint: boolean;
  segments: [number, number, number, number][];
  segmentsByVec: Record<string, [number, number, number, number][]>;
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
  solveAll(ctx: ConstraintContext, entities?: Record<string, DemoEntity>): void;
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
      parsedVec: null,
      isVecConstraint: false,
      segments: [],
      segmentsByVec: {},
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

  solveAll(ctx, entities) {
    const state = get();
    const updated = { ...state.constraints };

    // Build vector map from entities
    const vecLabels = new Set<string>();
    const vectorMap: Record<string, { dx: number; dy: number }> = {};
    const vecStartMap: Record<string, { x: number; y: number }> = {};
    if (entities) {
      for (const e of Object.values(entities)) {
        if (e.type !== 'demoVector') continue;
        const v = e as DemoVector;
        if (!v.label) continue;
        vecLabels.add(v.label);
        const sp = entities[v.startId] as DemoPoint | undefined;
        const ep = entities[v.endId] as DemoPoint | undefined;
        if (sp && ep) {
          vectorMap[v.label] = { dx: ep.x - sp.x, dy: ep.y - sp.y };
          vecStartMap[v.label] = { x: sp.x, y: sp.y };
        }
      }
    }

    const hasVecConstraints = Object.values(updated).some((c) => c.visible && isVecExpression(c.expression));

    for (const [id, c] of Object.entries(updated)) {
      if (!c.visible) continue;

      const isVec = isVecExpression(c.expression);

      if (isVec && entities) {
        let parsedVec = c.parsedVec;
        if (!parsedVec) {
          parsedVec = parseVecConstraint(c.expression, vecLabels);
        }
        if (!parsedVec) {
          updated[id] = { ...c, parsedVec, isVecConstraint: true, parsed: null, segments: [], segmentsByVec: {} };
          continue;
        }

        // Compute locus for EACH referenced vector (others stay fixed)
        const segsByVec: Record<string, [number, number, number, number][]> = {};
        for (const vecLabel of parsedVec.referencedVecs) {
          const freeStart = vecStartMap[vecLabel] ?? { x: 0, y: 0 };
          const vecCtx: VecConstraintContext = {
            vectors: vectorMap,
            freeVecLabel: vecLabel,
            freeVecStart: freeStart,
          };
          segsByVec[vecLabel] = marchingSquares((x, y) => parsedVec!.fn(x, y, vecCtx));
        }

        updated[id] = { ...c, parsedVec, isVecConstraint: true, parsed: null, segments: [], segmentsByVec: segsByVec };
      } else {
        let parsed = c.parsed;
        if (!parsed) {
          parsed = parseConstraint(c.expression, ctx);
        }
        if (!parsed) {
          updated[id] = { ...c, parsed: null, parsedVec: null, isVecConstraint: false, segments: [], segmentsByVec: {} };
          continue;
        }
        const segments = marchingSquares((x, y) => parsed!.fn(x, y, ctx));
        updated[id] = { ...c, parsed, parsedVec: null, isVecConstraint: false, segments, segmentsByVec: {} };
      }
    }

    // Objective extrema
    let objectiveExtrema: ObjectiveExtrema | null = null;
    if (state.objectiveExpr.trim()) {
      // Gather all segments from both point constraints and vector constraints
      const allSegments: [number, number, number, number][] = [];
      for (const c of Object.values(updated)) {
        if (!c.visible) continue;
        if (c.segments.length > 0) allSegments.push(...c.segments);
        for (const segs of Object.values(c.segmentsByVec)) {
          allSegments.push(...segs);
        }
      }

      if (allSegments.length > 0) {
        const objExprTrimmed = state.objectiveExpr.trim();
        const isObjVec = isVecExpression(objExprTrimmed);

        let objFn: ((px: number, py: number) => number) | null = null;

        if (isObjVec && hasVecConstraints) {
          // For vector objective, evaluate for each referenced vector
          const vecObjFn = parseVecExpression(objExprTrimmed, vecLabels);
          if (vecObjFn) {
            // Use first referenced vec as context (simplified)
            const referencedVecs = [...objExprTrimmed.matchAll(/\\vec\{(\w+)\}/g)].map(m => m[1]);
            const primaryVec = referencedVecs[0];
            if (primaryVec) {
              const vecCtx: VecConstraintContext = {
                vectors: vectorMap,
                freeVecLabel: primaryVec,
                freeVecStart: vecStartMap[primaryVec] ?? { x: 0, y: 0 },
              };
              objFn = (px, py) => vecObjFn(px, py, vecCtx);
            }
          }
        } else {
          const ptObjFn = parseExpression(objExprTrimmed);
          if (ptObjFn) objFn = (px, py) => ptObjFn(px, py, ctx);
        }

        if (objFn) {
          let minPt: ObjectiveExtrema['min'];
          let maxPt: ObjectiveExtrema['max'];
          const seen = new Set<string>();
          for (const [x1, y1, x2, y2] of allSegments) {
            for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
              const key = `${px.toFixed(4)},${py.toFixed(4)}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const v = objFn(px, py);
              if (isNaN(v)) continue;
              if (!minPt || v < minPt.value) minPt = { x: px, y: py, value: v };
              if (!maxPt || v > maxPt.value) maxPt = { x: px, y: py, value: v };
            }
          }
          if (minPt || maxPt) objectiveExtrema = { min: minPt, max: maxPt };
        }
      }
    }

    set({ constraints: updated, objectiveExtrema });
  },

  clearAll() {
    set({ constraints: {}, nextId: 1, objectiveExpr: '', objectiveExtrema: null });
  },
}));
