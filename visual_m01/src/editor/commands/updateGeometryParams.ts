import type { Command } from './types';
import type { Entity, GeometryProperties } from '../entities/types';
import type { BuilderResult } from '../../engine/types';
import { useEntityStore } from '../store/entityStore';

export class UpdateGeometryParamsCommand implements Command {
  readonly type = 'updateGeometryParams';
  readonly label = '更新几何体参数';

  private geometryId: string;
  private oldParams: GeometryProperties['params'];
  private newParams: GeometryProperties['params'];
  private topologyChanged: boolean;
  private oldBuiltInSnapshot: Entity[] | undefined;
  private newBuilderResult: BuilderResult | undefined;

  constructor(
    geometryId: string,
    oldParams: GeometryProperties['params'],
    newParams: GeometryProperties['params'],
    topologyChanged: boolean,
    oldBuiltInSnapshot?: Entity[],
    newBuilderResult?: BuilderResult,
  ) {
    this.geometryId = geometryId;
    this.oldParams = oldParams;
    this.newParams = newParams;
    this.topologyChanged = topologyChanged;
    this.oldBuiltInSnapshot = oldBuiltInSnapshot
      ? JSON.parse(JSON.stringify(oldBuiltInSnapshot))
      : undefined;
    this.newBuilderResult = newBuilderResult;
  }

  execute(): void {
    const store = useEntityStore.getState();

    // 1. 更新 params
    store.updateProperties(this.geometryId, { params: this.newParams });

    // 2. 拓扑变化时重建 builtIn
    if (this.topologyChanged && this.newBuilderResult) {
      store.rebuildBuiltInEntities(this.geometryId, this.newBuilderResult);
    }
  }

  undo(): void {
    const store = useEntityStore.getState();

    // 1. 恢复旧 params
    store.updateProperties(this.geometryId, { params: this.oldParams });

    // 2. 拓扑变化时恢复旧 builtIn 快照
    if (this.topologyChanged && this.oldBuiltInSnapshot) {
      // 删除当前 builtIn
      const currentBuiltIn = store.getBuiltInEntities(this.geometryId);
      for (const entity of currentBuiltIn) {
        if (store.getEntity(entity.id)) {
          store.deleteEntity(entity.id);
        }
      }
      // 恢复快照
      store.restoreEntities(this.oldBuiltInSnapshot);
    }
  }
}
