import * as math from 'mathjs';
import type { Viewport } from '@/canvas/Viewport';
import type { FunctionEntry } from '@/types';
import { preprocessExpression } from '@/engine/expressionEngine';
import { COLORS } from '@/styles/colors';

type TrigBase = 'tan' | 'cot' | 'sec' | 'csc';
type FunctionNodeLike = { fn: { toString: () => string }; args: math.MathNode[] };

interface VerticalAsymptoteSpec {
  base: TrigBase;
  omega: number;
  phaseShift: number;
}

function detectVerticalAsymptoteSpec(exprStr: string): VerticalAsymptoteSpec | null {
  try {
    const processed = preprocessExpression(exprStr.trim());
    const node = math.parse(processed);
    let trigCall: FunctionNodeLike | null = null;

    node.traverse((current) => {
      if (trigCall) return;
      if (current.type !== 'FunctionNode') return;
      const fnNode = current as unknown as FunctionNodeLike;
      const fnName = fnNode.fn.toString();
      if (fnName === 'tan' || fnName === 'cot' || fnName === 'sec' || fnName === 'csc') {
        trigCall = fnNode;
      }
    });

    if (trigCall === null) return null;
    const trigCallNode: FunctionNodeLike = trigCall;
    if (trigCallNode.args.length !== 1) return null;

    const base = trigCallNode.fn.toString() as TrigBase;
    const argNode = trigCallNode.args[0];
    const compiled = argNode.compile();
    const at0 = compiled.evaluate({ x: 0 });
    const at1 = compiled.evaluate({ x: 1 });
    const at2 = compiled.evaluate({ x: 2 });

    if (
      typeof at0 !== 'number' ||
      typeof at1 !== 'number' ||
      typeof at2 !== 'number' ||
      !Number.isFinite(at0) ||
      !Number.isFinite(at1) ||
      !Number.isFinite(at2)
    ) {
      return null;
    }

    const omega = at1 - at0;
    const secondDelta = at2 - at1;
    if (!Number.isFinite(omega) || Math.abs(omega) < 1e-10) return null;
    if (Math.abs(secondDelta - omega) > 1e-6) return null;

    return {
      base,
      omega,
      phaseShift: at0,
    };
  } catch {
    return null;
  }
}

function getAsymptoteOffset(base: TrigBase): number {
  if (base === 'tan' || base === 'sec') return Math.PI / 2;
  return 0;
}

function isWithinDisplayDomain(mathX: number, fn: FunctionEntry): boolean {
  if (!fn.displayDomain.enabled) return true;
  if (fn.displayDomain.xMin !== null && mathX < fn.displayDomain.xMin) return false;
  if (fn.displayDomain.xMax !== null && mathX > fn.displayDomain.xMax) return false;
  return true;
}

export function renderFunctionAsymptotes(
  ctx: CanvasRenderingContext2D,
  fn: FunctionEntry,
  viewport: Viewport,
): void {
  if (!fn.visible || fn.mode !== 'standard') return;

  const spec = detectVerticalAsymptoteSpec(fn.exprStr);
  if (!spec) return;

  const { b, h } = fn.transform;
  if (!Number.isFinite(b) || Math.abs(b) < 1e-10) return;

  const baseOffset = getAsymptoteOffset(spec.base);
  const localXMin = b * (viewport.xMin - h);
  const localXMax = b * (viewport.xMax - h);
  const argMin = spec.omega * Math.min(localXMin, localXMax) + spec.phaseShift;
  const argMax = spec.omega * Math.max(localXMin, localXMax) + spec.phaseShift;

  const nMin = Math.ceil((argMin - baseOffset) / Math.PI);
  const nMax = Math.floor((argMax - baseOffset) / Math.PI);
  if (!Number.isFinite(nMin) || !Number.isFinite(nMax) || nMin > nMax) return;

  ctx.save();
  ctx.strokeStyle = COLORS.asymptote;
  ctx.lineWidth = 1.75;
  ctx.setLineDash([7, 5]);

  for (let n = nMin; n <= nMax; n++) {
    const xPrime = (baseOffset + n * Math.PI - spec.phaseShift) / spec.omega;
    const mathX = h + xPrime / b;
    if (!Number.isFinite(mathX)) continue;
    if (mathX < viewport.xMin || mathX > viewport.xMax) continue;
    if (!isWithinDisplayDomain(mathX, fn)) continue;

    const [cxTop, cyTop] = viewport.toCanvas(mathX, viewport.yMax);
    const [, cyBottom] = viewport.toCanvas(mathX, viewport.yMin);

    ctx.beginPath();
    ctx.moveTo(cxTop, cyTop);
    ctx.lineTo(cxTop, cyBottom);
    ctx.stroke();
  }

  ctx.restore();
}

export function getVerticalAsymptoteXValues(
  fn: FunctionEntry,
  viewport: Viewport,
): number[] {
  if (!fn.visible || fn.mode !== 'standard') return [];

  const spec = detectVerticalAsymptoteSpec(fn.exprStr);
  if (!spec) return [];

  const { b, h } = fn.transform;
  if (!Number.isFinite(b) || Math.abs(b) < 1e-10) return [];

  const baseOffset = getAsymptoteOffset(spec.base);
  const localXMin = b * (viewport.xMin - h);
  const localXMax = b * (viewport.xMax - h);
  const argMin = spec.omega * Math.min(localXMin, localXMax) + spec.phaseShift;
  const argMax = spec.omega * Math.max(localXMin, localXMax) + spec.phaseShift;

  const nMin = Math.ceil((argMin - baseOffset) / Math.PI);
  const nMax = Math.floor((argMax - baseOffset) / Math.PI);
  if (!Number.isFinite(nMin) || !Number.isFinite(nMax) || nMin > nMax) return [];

  const xs: number[] = [];
  for (let n = nMin; n <= nMax; n++) {
    const xPrime = (baseOffset + n * Math.PI - spec.phaseShift) / spec.omega;
    const mathX = h + xPrime / b;
    if (!Number.isFinite(mathX)) continue;
    if (mathX < viewport.xMin || mathX > viewport.xMax) continue;
    if (!isWithinDisplayDomain(mathX, fn)) continue;
    xs.push(mathX);
  }
  return xs;
}
