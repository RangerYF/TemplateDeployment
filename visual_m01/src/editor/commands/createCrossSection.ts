import type { Command } from './types';
import { CreateEntityCommand } from './createEntity';
import { BatchCommand } from './batch';
import { useEntityStore } from '../store/entityStore';

/**
 * 截面多边形中的一个点：复用已有点 或 新建交点
 */
export type PolygonPoint =
  | { type: 'reuse'; pointId: string }
  | { type: 'create'; edgeStart: number; edgeEnd: number; t: number };

/**
 * 子面：引用 polygonPoints 中的索引
 */
export interface SubFace {
  pointIndices: number[];
}

/**
 * 自增截面交点标签计数器
 */
let nextCrossSectionPointLabel = 1;

export class CreateCrossSectionCommand implements Command {
  readonly type = 'createCrossSection';
  readonly label = '创建截面';

  private batch: BatchCommand;

  constructor(
    geometryId: string,
    definingPointIds: string[],
    polygonPoints: PolygonPoint[],
    subFaces: SubFace[],
  ) {
    const commands: Command[] = [];

    // 为每个 type='create' 的交点创建 Point Entity
    const pointCommands: Map<number, CreateEntityCommand<'point'>> = new Map();
    for (let i = 0; i < polygonPoints.length; i++) {
      const pp = polygonPoints[i];
      if (pp.type === 'create') {
        const cmd = new CreateEntityCommand('point', {
          builtIn: false,
          geometryId,
          constraint: {
            type: 'edge',
            edgeStart: pp.edgeStart,
            edgeEnd: pp.edgeEnd,
            t: pp.t,
          },
          label: `P${nextCrossSectionPointLabel++}`,
        });
        pointCommands.set(i, cmd);
        commands.push(cmd);
      }
    }

    // 用延迟 Command 创建面和线段（需要等新建交点的 ID）
    const deferredCommand: Command & { _innerBatch?: BatchCommand } = {
      type: 'createCrossSectionFacesAndSegments',
      label: '创建截面面与线段',
      execute: () => {
        const innerCommands: Command[] = [];

        // 解析每个 polygonPoint 对应的实际 pointId
        const resolvedPointIds: string[] = polygonPoints.map((pp, i) => {
          if (pp.type === 'reuse') return pp.pointId;
          const cmd = pointCommands.get(i);
          return cmd?.getCreatedId() ?? '';
        });

        // 创建子面
        for (const subFace of subFaces) {
          const facePointIds = subFace.pointIndices.map((idx) => resolvedPointIds[idx]);
          const faceCmd = new CreateEntityCommand('face', {
            builtIn: false,
            geometryId,
            pointIds: facePointIds,
            source: { type: 'crossSection', definingPointIds },
          });
          innerCommands.push(faceCmd);
        }

        // 创建截面多边形的边 Segment（已有的跳过）
        const entityStore = useEntityStore.getState();
        for (let i = 0; i < resolvedPointIds.length; i++) {
          const startId = resolvedPointIds[i];
          const endId = resolvedPointIds[(i + 1) % resolvedPointIds.length];
          if (!startId || !endId) continue;

          // 检查是否已有 Segment 连接这两个点
          const existing = entityStore.findSegmentByPoints(startId, endId);
          if (existing) continue;

          const segCmd = new CreateEntityCommand('segment', {
            builtIn: false,
            geometryId,
            startPointId: startId,
            endPointId: endId,
            style: { color: '#3b82f6', dashed: false },
          });
          innerCommands.push(segCmd);
        }

        // 创建定义点之间的连线（如果不在多边形边上且没有已有 Segment）
        for (let i = 0; i < definingPointIds.length; i++) {
          const startId = definingPointIds[i];
          const endId = definingPointIds[(i + 1) % definingPointIds.length];

          // 检查这条边是否已经是多边形的边（已在上面处理）
          const isPolygonEdge = resolvedPointIds.some((_, idx) => {
            const nextIdx = (idx + 1) % resolvedPointIds.length;
            return (resolvedPointIds[idx] === startId && resolvedPointIds[nextIdx] === endId)
              || (resolvedPointIds[idx] === endId && resolvedPointIds[nextIdx] === startId);
          });
          if (isPolygonEdge) continue;

          // 检查是否已有 Segment
          const existing = entityStore.findSegmentByPoints(startId, endId);
          if (existing) continue;

          const segCmd = new CreateEntityCommand('segment', {
            builtIn: false,
            geometryId,
            startPointId: startId,
            endPointId: endId,
            style: { color: '#3b82f6', dashed: true },
          });
          innerCommands.push(segCmd);
        }

        const batch = new BatchCommand('截面面与线段', innerCommands);
        batch.execute();
        deferredCommand._innerBatch = batch;
      },
      undo: () => {
        deferredCommand._innerBatch?.undo();
      },
    };
    commands.push(deferredCommand);

    this.batch = new BatchCommand('创建截面', commands);
  }

  execute(): void {
    this.batch.execute();
  }

  undo(): void {
    this.batch.undo();
  }
}
