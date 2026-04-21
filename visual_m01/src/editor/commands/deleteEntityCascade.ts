import type { Command } from './types';
import type { Entity } from '../entities/types';
import { useEntityStore } from '../store/entityStore';

export class DeleteEntityCascadeCommand implements Command {
  readonly type = 'deleteEntityCascade';
  readonly label = '删除实体（级联）';

  private entityId: string;
  private deletedSnapshot: Entity[] = [];

  constructor(entityId: string) {
    this.entityId = entityId;
  }

  execute(): void {
    const store = useEntityStore.getState();
    const deleted = store.cascadeDelete(this.entityId);
    // 深拷贝快照
    this.deletedSnapshot = JSON.parse(JSON.stringify(deleted));
  }

  undo(): void {
    if (this.deletedSnapshot.length === 0) return;

    const store = useEntityStore.getState();
    // 按原始顺序恢复（cascadeDelete 返回顺序：先自身后级联子实体，
    // 恢复时需按创建顺序——ID 升序，确保先恢复被引用的实体）
    const sorted = [...this.deletedSnapshot].sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    store.restoreEntities(sorted);
  }
}
