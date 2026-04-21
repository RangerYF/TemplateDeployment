import type { Command } from './types';
import type { EntityType, EntityPropertiesMap } from '../entities/types';
import { useEntityStore } from '../store/entityStore';

export class UpdatePropertiesCommand<T extends EntityType = EntityType> implements Command {
  readonly type = 'updateProperties';
  readonly label: string;

  private entityId: string;
  private oldProperties: Partial<EntityPropertiesMap[T]>;
  private newProperties: Partial<EntityPropertiesMap[T]>;

  constructor(
    entityId: string,
    oldProperties: Partial<EntityPropertiesMap[T]>,
    newProperties: Partial<EntityPropertiesMap[T]>,
    label?: string,
  ) {
    this.entityId = entityId;
    this.oldProperties = oldProperties;
    this.newProperties = newProperties;
    this.label = label ?? '更新属性';
  }

  execute(): void {
    useEntityStore.getState().updateProperties(this.entityId, this.newProperties);
  }

  undo(): void {
    useEntityStore.getState().updateProperties(this.entityId, this.oldProperties);
  }
}
