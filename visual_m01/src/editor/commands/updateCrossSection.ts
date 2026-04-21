import type { Command } from './types';
import type { Entity } from '../entities/types';
import { useEntityStore } from '../store/entityStore';

interface NewIntersection {
  edgeStart: number;
  edgeEnd: number;
  t: number;
  label: string;
}

export class UpdateCrossSectionCommand implements Command {
  readonly type = 'updateCrossSection';
  readonly label = '更新截面';

  private faceId: string;
  private geometryId: string;
  private oldIntersectionSnapshot: Entity[];
  private oldPointIds: string[];
  private newIntersections: NewIntersection[];

  // 执行后记录新交点 ID（用于 undo 删除）
  private newPointIds: string[] = [];

  constructor(
    faceId: string,
    geometryId: string,
    oldIntersectionSnapshot: Entity[],
    oldPointIds: string[],
    newIntersections: NewIntersection[],
  ) {
    this.faceId = faceId;
    this.geometryId = geometryId;
    this.oldIntersectionSnapshot = JSON.parse(JSON.stringify(oldIntersectionSnapshot));
    this.oldPointIds = [...oldPointIds];
    this.newIntersections = newIntersections;
  }

  execute(): void {
    const store = useEntityStore.getState();

    // 1. 删除旧交点
    for (const snapshot of this.oldIntersectionSnapshot) {
      if (store.getEntity(snapshot.id)) {
        store.deleteEntity(snapshot.id);
      }
    }

    // 2. 创建新交点
    this.newPointIds = [];
    for (const intersection of this.newIntersections) {
      const point = store.createEntity('point', {
        builtIn: false,
        geometryId: this.geometryId,
        constraint: {
          type: 'edge',
          edgeStart: intersection.edgeStart,
          edgeEnd: intersection.edgeEnd,
          t: intersection.t,
        },
        label: intersection.label,
      });
      this.newPointIds.push(point.id);
    }

    // 3. 更新 Face 的 pointIds
    store.updateProperties(this.faceId, { pointIds: this.newPointIds });
  }

  undo(): void {
    const store = useEntityStore.getState();

    // 1. 删除新交点
    for (const id of this.newPointIds) {
      if (store.getEntity(id)) {
        store.deleteEntity(id);
      }
    }

    // 2. 恢复旧交点
    store.restoreEntities(this.oldIntersectionSnapshot);

    // 3. 恢复 Face 的旧 pointIds
    store.updateProperties(this.faceId, { pointIds: this.oldPointIds });
  }
}
