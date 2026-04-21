import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { LineEntity } from '@/types';

/** Records a parameter change on a line entity for Undo/Redo. */
export class UpdateLineParamCommand implements Command {
  readonly type  = 'update-line-param';
  readonly label = '修改直线参数';

  constructor(
    private readonly entityId: string,
    private readonly before:   LineEntity,
    private readonly after:    LineEntity,
  ) {}

  execute(): void { useEntityStore.getState().updateEntity(this.entityId, this.after); }
  undo():    void { useEntityStore.getState().updateEntity(this.entityId, this.before); }
}
