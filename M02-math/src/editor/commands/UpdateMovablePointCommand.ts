import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { MovablePointEntity } from '@/types';

export class UpdateMovablePointCommand implements Command {
  readonly type = 'update-movable-point';
  readonly label = '移动动点';

  constructor(
    private readonly entityId: string,
    private readonly before: MovablePointEntity,
    private readonly after: MovablePointEntity,
  ) {}

  execute(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.after);
  }

  undo(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.before);
  }
}
