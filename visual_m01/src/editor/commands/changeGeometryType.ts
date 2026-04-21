import type { Command } from './types';
import type { Entity, GeometryProperties } from '../entities/types';
import type { BuilderResult } from '../../engine/types';
import { useEntityStore } from '../store/entityStore';

export class ChangeGeometryTypeCommand implements Command {
  readonly type = 'changeGeometryType';
  readonly label = '切换几何体类型';

  private geometryId: string;
  private newGeometryType: GeometryProperties['geometryType'];
  private newParams: GeometryProperties['params'];
  private newBuilderResult: BuilderResult;

  // undo 快照（execute 时填充）
  private oldGeometryType: GeometryProperties['geometryType'] | null = null;
  private oldParams: GeometryProperties['params'] | null = null;
  private relatedSnapshot: Entity[] = [];

  constructor(
    geometryId: string,
    newGeometryType: GeometryProperties['geometryType'],
    newParams: GeometryProperties['params'],
    newBuilderResult: BuilderResult,
  ) {
    this.geometryId = geometryId;
    this.newGeometryType = newGeometryType;
    this.newParams = newParams;
    this.newBuilderResult = newBuilderResult;
  }

  execute(): void {
    const store = useEntityStore.getState();
    const geometry = store.getEntity(this.geometryId);
    if (!geometry || geometry.type !== 'geometry') return;

    const props = geometry.properties as GeometryProperties;

    // 1. 快照当前状态
    if (this.oldGeometryType === null) {
      this.oldGeometryType = props.geometryType;
      this.oldParams = JSON.parse(JSON.stringify(props.params));
    }

    // 2. 快照所有关联实体（不含 geometry 自身）
    const related = store.getRelatedEntities(this.geometryId);
    if (this.relatedSnapshot.length === 0) {
      this.relatedSnapshot = JSON.parse(JSON.stringify(related));
    }

    // 3. 删除所有关联实体
    for (const entity of related) {
      if (store.getEntity(entity.id)) {
        store.deleteEntity(entity.id);
      }
    }

    // 4. 更新 geometry 实体
    store.updateProperties(this.geometryId, {
      geometryType: this.newGeometryType,
      params: this.newParams,
    });

    // 5. 创建新 builtIn 子实体
    store.createBuiltInEntities(this.geometryId, this.newBuilderResult);
  }

  undo(): void {
    if (this.oldGeometryType === null || this.oldParams === null) return;

    const store = useEntityStore.getState();

    // 1. 删除当前所有关联实体（新 builtIn）
    const currentRelated = store.getRelatedEntities(this.geometryId);
    for (const entity of currentRelated) {
      if (store.getEntity(entity.id)) {
        store.deleteEntity(entity.id);
      }
    }

    // 2. 恢复旧 geometryType + params
    store.updateProperties(this.geometryId, {
      geometryType: this.oldGeometryType,
      params: this.oldParams,
    });

    // 3. 恢复所有关联实体快照
    store.restoreEntities(this.relatedSnapshot);
  }
}
