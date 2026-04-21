/**
 * UpdateAngleCommand — M04 Phase 1
 *
 * Records a completed angle-drag operation for Undo/Redo.
 *
 * Created by AngleDragTool.onPointerUp() after the user releases the drag.
 * During drag, the store is updated directly (no Command) for live preview.
 */

import type { Command } from '@/editor/commands/types';
import { useUnitCircleStore } from '@/editor/store/unitCircleStore';
import { lookupAngle } from '@/engine/exactValueEngine';

export class UpdateAngleCommand implements Command {
  readonly type  = 'update-angle';
  readonly label = '旋转角度';

  constructor(
    private readonly prevAngle: number,
    private readonly nextAngle: number,
  ) {}

  execute(): void {
    const { snapped, snappedAngle, values } = lookupAngle(this.nextAngle);
    useUnitCircleStore.getState().setAngle(snappedAngle, snapped, values);
  }

  undo(): void {
    const { snapped, snappedAngle, values } = lookupAngle(this.prevAngle);
    useUnitCircleStore.getState().setAngle(snappedAngle, snapped, values);
  }
}
