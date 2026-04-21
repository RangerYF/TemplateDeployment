import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { AnyEntity } from '@/types';

/**
 * Records the addition of any entity (conic or line) for Undo/Redo.
 *
 * execute: add entity to store
 * undo:    remove entity; clear activeEntityId if it pointed to this entity
 */
export class AddEntityCommand implements Command {
  readonly type  = 'add-entity';
  readonly label = '添加';

  constructor(private readonly entity: AnyEntity) {}

  execute(): void {
    useEntityStore.getState().addEntity(this.entity);
  }

  undo(): void {
    const store = useEntityStore.getState();
    store.removeEntity(this.entity.id);
    if (store.activeEntityId === this.entity.id) {
      store.setActiveEntityId(null);
    }
  }
}
