import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { getBlockCenter, getConnectorAttachPoint } from './connector-utils';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const ROPE_COLOR = '#5A6577';
const ROPE_WIDTH = 1.5; // px

const ropeRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform, entities } = ctx;
  const c = ctx.ctx;

  // 支持 pivot↔block 和 block↔block 两种连接模式
  const endAId = (entity.properties.pivotEntityId as string) || (entity.properties.entityAId as string);
  const endBId = (entity.properties.blockEntityId as string) || (entity.properties.entityBId as string);
  if (!endAId || !endBId) return;

  const entityA = entities.get(endAId);
  const entityB = entities.get(endBId);
  if (!entityA || !entityB) return;

  let startPos = entityA.transform.position;
  let endPos: { x: number; y: number };

  if (entityA.type === 'block') {
    // block↔block 模式：用几何中心作为方向参考，确保绳水平
    const centerA = getBlockCenter(entityA);
    const centerB = entityB.type === 'block' ? getBlockCenter(entityB) : entityB.transform.position;
    startPos = getConnectorAttachPoint(entityA, centerB);
    endPos = entityB.type === 'block'
      ? getConnectorAttachPoint(entityB, centerA)
      : entityB.transform.position;
  } else {
    // pivot↔block 模式（原有逻辑）
    endPos = getConnectorAttachPoint(entityB, startPos);
  }

  // 缓存端点供 hitTest/drawOutline 使用
  entity.properties._endPos = endPos;
  entity.transform.position = startPos;

  const s1 = worldToScreen(startPos, coordinateTransform);
  const s2 = worldToScreen(endPos, coordinateTransform);

  c.save();
  c.beginPath();
  c.moveTo(s1.x, s1.y);
  c.lineTo(s2.x, s2.y);
  c.strokeStyle = ROPE_COLOR;
  c.lineWidth = ROPE_WIDTH;
  c.stroke();
  c.restore();
};

export function registerRopeRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'rope',
    renderer: ropeRenderer,
    layer: 'connector',
  });
}
