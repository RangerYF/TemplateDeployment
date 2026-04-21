import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { ImplicitCurveEntity } from '@/types';

export class UpdateImplicitCurveCommand implements Command {
  readonly type = 'update-implicit-curve';
  readonly label = '修改隐式曲线参数';

  constructor(
    private readonly entityId: string,
    private readonly before: ImplicitCurveEntity,
    private readonly after: ImplicitCurveEntity,
  ) {}

  execute(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.after);
  }

  undo(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.before);
  }
}
