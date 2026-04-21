import type { Command } from './types';
import { useEntityStore } from '../store/entityStore';

export class RenameEntityCommand implements Command {
  readonly type = 'renameEntity';
  readonly label = '重命名实体';

  private entityId: string;
  private oldLabel: string;
  private newLabel: string;

  constructor(entityId: string, oldLabel: string, newLabel: string) {
    this.entityId = entityId;
    this.oldLabel = oldLabel;
    this.newLabel = newLabel;
  }

  execute(): void {
    useEntityStore.getState().updateProperties(this.entityId, { label: this.newLabel });
  }

  undo(): void {
    useEntityStore.getState().updateProperties(this.entityId, { label: this.oldLabel });
  }
}
