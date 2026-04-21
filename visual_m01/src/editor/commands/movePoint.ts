import type { Command } from './types';
import { useEntityStore } from '../store/entityStore';

export class MovePointCommand implements Command {
  readonly type = 'movePoint';
  readonly label = '移动点';

  private pointId: string;
  private oldPositionOverride: [number, number, number] | undefined;
  private newPositionOverride: [number, number, number] | undefined;

  constructor(
    pointId: string,
    oldPositionOverride: [number, number, number] | undefined,
    newPositionOverride: [number, number, number] | undefined,
  ) {
    this.pointId = pointId;
    this.oldPositionOverride = oldPositionOverride;
    this.newPositionOverride = newPositionOverride;
  }

  execute(): void {
    useEntityStore.getState().updateProperties(this.pointId, {
      positionOverride: this.newPositionOverride,
    });
  }

  undo(): void {
    useEntityStore.getState().updateProperties(this.pointId, {
      positionOverride: this.oldPositionOverride,
    });
  }
}
