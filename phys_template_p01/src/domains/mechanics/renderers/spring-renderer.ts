import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { getConnectorAttachPoint } from './connector-utils';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const SPRING_COLOR = '#4A5568';
const SPRING_WIDTH = 1.5; // px
const ZIGZAG_COUNT = 10; // 锯齿个数
const ZIGZAG_AMPLITUDE = 8; // px，锯齿振幅（半幅）
const LEAD_LENGTH = 8; // px，两端直线引导段

const springRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform, entities } = ctx;
  const c = ctx.ctx;

  // 查找两端实体（支持 pivot↔block 和 block↔block 两种模式）
  const endAId = (entity.properties.pivotEntityId as string) || (entity.properties.entityAId as string);
  const endBId = (entity.properties.blockEntityId as string) || (entity.properties.entityBId as string);
  if (!endAId || !endBId) return;

  const entityA = entities.get(endAId);
  const entityB = entities.get(endBId);
  if (!entityA || !entityB) return;

  // 计算端点位置
  let startPos = entityA.transform.position;
  let endPos: { x: number; y: number };

  if (entityA.type === 'block') {
    // block↔block 模式：A 端也需要边缘点
    const bCenter = entityB.type === 'block'
      ? getConnectorAttachPoint(entityB, entityA.transform.position)
      : entityB.transform.position;
    startPos = getConnectorAttachPoint(entityA, bCenter);
    endPos = entityB.type === 'block'
      ? getConnectorAttachPoint(entityB, entityA.transform.position)
      : entityB.transform.position;
  } else {
    // pivot↔block 模式
    endPos = getConnectorAttachPoint(entityB, startPos);
  }

  // 缓存端点供 hitTest/drawOutline 使用
  entity.properties._endPos = endPos;
  entity.transform.position = startPos;

  const s1 = worldToScreen(startPos, coordinateTransform);
  const s2 = worldToScreen(endPos, coordinateTransform);

  // 绘制锯齿波形
  const dx = s2.x - s1.x;
  const dy = s2.y - s1.y;
  const totalLen = Math.hypot(dx, dy);
  if (totalLen < 2) return;

  // 单位方向向量（沿弹簧轴）和垂直向量
  const ux = dx / totalLen;
  const uy = dy / totalLen;
  const perpX = -uy; // 垂直方向
  const perpY = ux;

  c.save();
  c.beginPath();

  // 起点引导段
  c.moveTo(s1.x, s1.y);
  const leadStart = LEAD_LENGTH;
  const leadEnd = totalLen - LEAD_LENGTH;
  const zigzagLen = leadEnd - leadStart;

  if (zigzagLen <= 0) {
    // 弹簧太短，画直线
    c.lineTo(s2.x, s2.y);
  } else {
    // 引导段起点 → 锯齿起点
    c.lineTo(s1.x + ux * leadStart, s1.y + uy * leadStart);

    // 锯齿部分
    const segLen = zigzagLen / ZIGZAG_COUNT;
    for (let i = 0; i < ZIGZAG_COUNT; i++) {
      const mid = leadStart + segLen * (i + 0.5);
      const end = leadStart + segLen * (i + 1);
      const sign = i % 2 === 0 ? 1 : -1;

      // 锯齿顶点
      c.lineTo(
        s1.x + ux * mid + perpX * ZIGZAG_AMPLITUDE * sign,
        s1.y + uy * mid + perpY * ZIGZAG_AMPLITUDE * sign,
      );
      // 锯齿回到轴线（最后一个直接到引导段终点）
      if (i < ZIGZAG_COUNT - 1) {
        c.lineTo(s1.x + ux * end, s1.y + uy * end);
      }
    }

    // 引导段终点
    c.lineTo(s1.x + ux * leadEnd, s1.y + uy * leadEnd);
  }

  // 终点引导段
  c.lineTo(s2.x, s2.y);

  c.strokeStyle = SPRING_COLOR;
  c.lineWidth = SPRING_WIDTH;
  c.stroke();
  c.restore();
};

export function registerSpringRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'spring',
    renderer: springRenderer,
    layer: 'connector',
  });
}
