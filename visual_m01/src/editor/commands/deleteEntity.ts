import type { Command } from './types';
import type { Entity } from '../entities/types';
import { useEntityStore } from '../store/entityStore';

export class DeleteEntityCommand implements Command {
  readonly type = 'deleteEntity';
  readonly label: string;

  private entityId: string;
  private snapshot: Entity | null = null;

  constructor(entityId: string) {
    this.entityId = entityId;
    this.label = '删除实体';
  }

  execute(): void {
    const store = useEntityStore.getState();
    const entity = store.getEntity(this.entityId);
    if (!entity) return;

    // 深拷贝快照
    this.snapshot = JSON.parse(JSON.stringify(entity));
    store.deleteEntity(this.entityId);
  }

  undo(): void {
    if (!this.snapshot) return;
    useEntityStore.getState().restoreEntity(this.snapshot);
  }
}
