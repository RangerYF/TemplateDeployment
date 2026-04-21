import type { Command } from './types';
import type { EntityType, EntityPropertiesMap } from '../entities/types';
import { useEntityStore } from '../store/entityStore';

export class CreateEntityCommand<T extends EntityType> implements Command {
  readonly type = 'createEntity';
  readonly label: string;

  private entityType: T;
  private properties: EntityPropertiesMap[T];
  private createdId: string | null = null;

  constructor(entityType: T, properties: EntityPropertiesMap[T]) {
    this.entityType = entityType;
    this.properties = properties;
    this.label = `创建${entityType}`;
  }

  execute(): void {
    const store = useEntityStore.getState();

    if (this.createdId !== null) {
      // redo 场景：恢复原 ID 的实体
      const entity = {
        id: this.createdId,
        type: this.entityType,
        properties: this.properties,
        visible: true,
      };
      store.restoreEntity(entity);
    } else {
      // 首次执行
      const entity = store.createEntity(this.entityType, this.properties);
      this.createdId = entity.id;
    }
  }

  undo(): void {
    if (this.createdId === null) return;
    useEntityStore.getState().deleteEntity(this.createdId);
  }

  /** 获取创建的实体 ID（供外部使用，如 BatchCommand 内部协调） */
  getCreatedId(): string | null {
    return this.createdId;
  }
}
