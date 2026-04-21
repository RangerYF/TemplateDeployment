/**
 * usePiSlider — M04 Phase 3
 *
 * Specialised slider hook for the phase-shift parameter φ (radians).
 * Wraps `useParamSlider` and adds:
 *  - Step size π/12 (15°) for clean π-fraction snapping
 *  - Live Unicode label via formatPiLabel (for canvas/text display)
 *  - Live LaTeX label via formatPiLatex (for KaTeXRenderer)
 *
 * The underlying slider value is always in radians; the labels are
 * formatted on each render — no additional state needed.
 *
 * @example
 * ```typescript
 * const piSlider = usePiSlider({
 *   getValue:     () => useM04FunctionStore.getState().transform.phi,
 *   onLiveUpdate: (rad) => useM04FunctionStore.getState().setTransform({ phi: rad }),
 *   onCommit:     (before, after) =>
 *     executeM03Command(new UpdateTransformCommand(...)),
 * });
 *
 * <Slider
 *   min={-Math.PI} max={Math.PI} step={piSlider.step}
 *   value={[piSlider.numericValue]}
 *   onValueChange={piSlider.handleChange}
 *   onValueCommit={piSlider.handleCommit}
 * />
 * <span>{piSlider.valueLabel}</span>   // "π/4"
 * ```
 */

import { useParamSlider } from '@/hooks/useParamSlider';
import { formatPiLabel, formatPiLatex } from '@/engine/piAxisEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsePiSliderOptions {
  /** Read the current φ value (radians) from the store. */
  getValue:     () => number;
  /** Live-preview update (no Command). */
  onLiveUpdate: (rad: number) => void;
  /** Commit update on release — write one Command here. */
  onCommit:     (before: number, after: number) => void;
  min?: number;   // default -π
  max?: number;   // default  π
}

export interface UsePiSliderReturn {
  handleChange:  (vals: number[]) => void;
  handleCommit:  (vals: number[]) => void;
  /** Step size in radians (π/12). */
  step:          number;
  /** Current value in radians. */
  numericValue:  number;
  /** Unicode label for plain-text display, e.g. "π/4". */
  valueLabel:    string;
  /** LaTeX label for KaTeXRenderer, e.g. "\\frac{\\pi}{4}". */
  valueLatex:    string;
  min:           number;
  max:           number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const PI_12 = Math.PI / 12;

export function usePiSlider(options: UsePiSliderOptions): UsePiSliderReturn {
  const min = options.min ?? -Math.PI;
  const max = options.max ??  Math.PI;

  const inner = useParamSlider<number>({
    getValue:     options.getValue,
    onLiveUpdate: options.onLiveUpdate,
    onCommit:     options.onCommit,
  });

  const numericValue = options.getValue();

  return {
    handleChange: ([v]: number[]) => inner.handleChange(v),
    handleCommit: ([v]: number[]) => inner.handleCommit(v),
    step:         PI_12,
    numericValue,
    valueLabel:   formatPiLabel(numericValue),
    valueLatex:   formatPiLatex(numericValue),
    min,
    max,
  };
}
