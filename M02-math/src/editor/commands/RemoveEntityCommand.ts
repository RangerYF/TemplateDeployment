import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { AnyEntity } from '@/types';

/**
 * Records the removal of any entity (conic or line) for Undo/Redo.
 *
 * execute: remove entity; clear activeEntityId if it pointed to this entity
 * undo:    restore entity to end of list (position not preserved — acceptable)
 */
export class RemoveEntityCommand implements Command {
  readonly type  = 'remove-entity';
  readonly label = '删除';

  /** Movable points that were cascade-deleted (saved for undo). */
  private cascadedPoints: AnyEntity[] = [];

  constructor(private readonly entity: AnyEntity) {}

  execute(): void {
    const store = useEntityStore.getState();

    // Cascade-delete movable points constrained to this entity
    if (this.entity.type !== 'movable-point') {
      this.cascadedPoints = store.entities.filter(
        (e) => e.type === 'movable-point' && e.params.constraintEntityId === this.entity.id,
      );
      for (const cp of this.cascadedPoints) {
        store.removeEntity(cp.id);
      }
    }

    store.removeEntity(this.entity.id);
    if (store.activeEntityId === this.entity.id) {
      store.setActiveEntityId(null);
    }
  }

  undo(): void {
    const store = useEntityStore.getState();
    store.addEntity(this.entity);
    // Restore cascade-deleted movable points
    for (const cp of this.cascadedPoints) {
      store.addEntity(cp);
    }
  }
}
