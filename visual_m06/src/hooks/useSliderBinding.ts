import { useEffect } from 'react';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { evalExactScoped, buildSliderScope } from '@/engine/exactMath';
import type { DemoPoint, DemoMarker, DemoText, DemoVecOp } from '@/editor/demo/demoTypes';

export function useSliderBinding() {
  useEffect(() => {
    let prevScope: Record<string, number> = {};

    const unsub = useDemoEntityStore.subscribe((state) => {
      const scope = buildSliderScope(state.entities);
      if (JSON.stringify(scope) === JSON.stringify(prevScope)) return;
      prevScope = scope;
      if (Object.keys(scope).length === 0) return;

      for (const e of Object.values(state.entities)) {
        if (e.type === 'demoPoint') {
          const pt = e as DemoPoint;
          if (!pt.xExpr && !pt.yExpr) continue;
          const nx = pt.xExpr ? evalExactScoped(pt.xExpr, scope) : pt.x;
          const ny = pt.yExpr ? evalExactScoped(pt.yExpr, scope) : pt.y;
          if (isNaN(nx) || isNaN(ny)) continue;
          if (Math.abs(nx - pt.x) > 1e-9 || Math.abs(ny - pt.y) > 1e-9) {
            state.updateEntity(pt.id, { x: nx, y: ny });
          }
        }

        if (e.type === 'demoMarker') {
          const mk = e as DemoMarker;
          if (!mk.xExpr && !mk.yExpr) continue;
          const nx = mk.xExpr ? evalExactScoped(mk.xExpr, scope) : mk.x;
          const ny = mk.yExpr ? evalExactScoped(mk.yExpr, scope) : mk.y;
          if (isNaN(nx) || isNaN(ny)) continue;
          if (Math.abs(nx - mk.x) > 1e-9 || Math.abs(ny - mk.y) > 1e-9) {
            state.updateEntity(mk.id, { x: nx, y: ny });
          }
        }

        if (e.type === 'demoText') {
          const tx = e as DemoText;
          if (!tx.xExpr && !tx.yExpr) continue;
          const nx = tx.xExpr ? evalExactScoped(tx.xExpr, scope) : tx.x;
          const ny = tx.yExpr ? evalExactScoped(tx.yExpr, scope) : tx.y;
          if (isNaN(nx) || isNaN(ny)) continue;
          if (Math.abs(nx - tx.x) > 1e-9 || Math.abs(ny - tx.y) > 1e-9) {
            state.updateEntity(tx.id, { x: nx, y: ny });
          }
        }

        if (e.type === 'demoVecOp') {
          const op = e as DemoVecOp;
          const patch: Record<string, number> = {};
          if (op.scalarKExpr) {
            const nk = evalExactScoped(op.scalarKExpr, scope);
            if (!isNaN(nk) && Math.abs(nk - (op.scalarK ?? 1)) > 1e-9) patch.scalarK = nk;
          }
          if (op.originXExpr) {
            const nx = evalExactScoped(op.originXExpr, scope);
            if (!isNaN(nx) && Math.abs(nx - (op.originX ?? 0)) > 1e-9) patch.originX = nx;
          }
          if (op.originYExpr) {
            const ny = evalExactScoped(op.originYExpr, scope);
            if (!isNaN(ny) && Math.abs(ny - (op.originY ?? 0)) > 1e-9) patch.originY = ny;
          }
          if (Object.keys(patch).length > 0) {
            state.updateEntity(op.id, patch);
          }
        }
      }
    });

    return unsub;
  }, []);
}
