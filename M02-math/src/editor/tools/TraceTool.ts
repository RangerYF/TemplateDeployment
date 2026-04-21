import type { Tool, ToolEvent } from '@/editor/tools/types';
import { useFunctionStore } from '@/editor/store/functionStore';
import { evaluateStandard, getNumericalDerivative } from '@/engine/sampler';

/**
 * TraceTool — activated when "显示切线" is on.
 *
 * On pointer move: evaluates the active function at mathX, computes the
 * numerical derivative, and writes all three tangent fields atomically.
 *
 * On pointer leave: clears tangent state (sets tangentX = null).
 */
export class TraceTool implements Tool {
  readonly id = 'trace';

  onPointerMove(e: ToolEvent): void {
    const store = useFunctionStore.getState();
    const activeFn = store.functions.find((f) => f.id === store.activeFunctionId);
    if (!activeFn || activeFn.mode !== 'standard') return;

    const x0   = e.mathX;
    const y0   = evaluateStandard(activeFn, x0);
    if (y0 === null) {
      store.setTangentPoint(null, 0, null);
      return;
    }

    const slope = getNumericalDerivative(activeFn, x0);
    store.setTangentPoint(x0, y0, slope);
  }

  onPointerLeave(): void {
    useFunctionStore.getState().setTangentPoint(null, 0, null);
  }
}
