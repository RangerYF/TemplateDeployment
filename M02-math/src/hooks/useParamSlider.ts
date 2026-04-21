import { useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Options for the useParamSlider hook.
 *
 * @template T  The parameter value type (number for most math params;
 *              use a tuple like [number] when adapting to Radix-style
 *              Slider which emits number[]).
 */
export interface UseParamSliderOptions<T> {
  /**
   * Read the current committed value from the store.
   * Called once at the start of each drag to capture the "before" snapshot.
   */
  getValue: () => T;

  /**
   * Push a live-preview update to the store WITHOUT recording a Command.
   * Called on every slider tick during drag (≤1 per RAF frame in practice).
   */
  onLiveUpdate: (value: T) => void;

  /**
   * Commit the change by recording an Undo/Redo Command.
   * Called once when the user releases the slider (onValueCommit).
   *
   * @param before  Value snapshot taken at drag-start.
   * @param after   Final value when the user released.
   */
  onCommit: (before: T, after: T) => void;
}

export interface UseParamSliderReturn<T> {
  /** Wire to Slider's `onValueChange` (fires on every tick). */
  handleChange: (value: T) => void;
  /** Wire to Slider's `onValueCommit` (fires once on release). */
  handleCommit: (value: T) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Generic drag-preview-commit lifecycle for any math parameter slider.
 *
 * Interaction layers:
 *  - Drag start  : snapshot current value into snapRef (the "before" for Undo)
 *  - Drag ongoing: call onLiveUpdate for real-time Canvas preview (no Command)
 *  - Drag end    : call onCommit(before, after) → caller writes one Command
 *
 * Designed for direct reuse in M04 for A / ω / k sliders.
 * Extend with usePiSlider (M04) for φ (π/12 step + π-fraction display).
 *
 * @example
 * ```typescript
 * const aSlider = useParamSlider<number>({
 *   getValue:     () => useTrigStore.getState().userParams.A,
 *   onLiveUpdate: (A) => useTrigStore.getState().setUserParam('A', A),
 *   onCommit: (before, after) =>
 *     editorRef.current?.execute(
 *       new UpdateTrigParamCommand({ A: before }, { A: after }),
 *     ),
 * });
 * // <Slider onValueChange={([v]) => aSlider.handleChange(v)}
 * //         onValueCommit={([v]) => aSlider.handleCommit(v)} />
 * ```
 */
export function useParamSlider<T>(
  options: UseParamSliderOptions<T>,
): UseParamSliderReturn<T> {
  // Holds the "before" snapshot captured at the first drag tick.
  // null between drags — avoids capturing if the value was already committed.
  const snapRef = useRef<T | null>(null);

  const handleChange = (value: T): void => {
    if (snapRef.current === null) {
      // First tick of this drag: snapshot the committed state
      snapRef.current = options.getValue();
    }
    options.onLiveUpdate(value);
  };

  const handleCommit = (value: T): void => {
    // If snapRef is null, the user clicked without dragging; treat current as before
    const before = snapRef.current ?? options.getValue();
    snapRef.current = null;             // reset for next drag
    options.onCommit(before, value);
  };

  return { handleChange, handleCommit };
}
