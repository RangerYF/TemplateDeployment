import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { getConnectorAttachPoint } from './connector-utils';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const ROD_COLOR = '#2D3748';
const ROD_HALF_WIDTH = 3; // px 杆半宽（双线间距的一半）
const JOINT_RADIUS = 3.5; // px 铰接小圆点

/**
 * 杆渲染器 — 教材风格
 * 双平行线 + 两端封口 + 铰接圆点，视觉上明确为"刚性杆"
 */
const rodRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform, entities } = ctx;
  const c = ctx.ctx;

  const pivotId = entity.properties.pivotEntityId as string;
  const blockId = entity.properties.blockEntityId as string;
  if (!pivotId || !blockId) return;

  const pivotEntity = entities.get(pivotId);
  const blockEntity = entities.get(blockId);
  if (!pivotEntity || !blockEntity) return;

  const startPos = pivotEntity.transform.position;
  const endPos = getConnectorAttachPoint(blockEntity, startPos);

  entity.properties._endPos = endPos;

  const s1 = worldToScreen(startPos, coordinateTransform);
  const s2 = worldToScreen(endPos, coordinateTransform);

  const dx = s2.x - s1.x;
  const dy = s2.y - s1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  // 法向量
  const nx = -dy / len;
  const ny = dx / len;

  c.save();

  // 双平行线
  c.strokeStyle = ROD_COLOR;
  c.lineWidth = 1.5;

  // 上边线
  c.beginPath();
  c.moveTo(s1.x + nx * ROD_HALF_WIDTH, s1.y + ny * ROD_HALF_WIDTH);
  c.lineTo(s2.x + nx * ROD_HALF_WIDTH, s2.y + ny * ROD_HALF_WIDTH);
  c.stroke();

  // 下边线
  c.beginPath();
  c.moveTo(s1.x - nx * ROD_HALF_WIDTH, s1.y - ny * ROD_HALF_WIDTH);
  c.lineTo(s2.x - nx * ROD_HALF_WIDTH, s2.y - ny * ROD_HALF_WIDTH);
  c.stroke();

  // 两端封口线
  c.beginPath();
  c.moveTo(s1.x + nx * ROD_HALF_WIDTH, s1.y + ny * ROD_HALF_WIDTH);
  c.lineTo(s1.x - nx * ROD_HALF_WIDTH, s1.y - ny * ROD_HALF_WIDTH);
  c.stroke();

  c.beginPath();
  c.moveTo(s2.x + nx * ROD_HALF_WIDTH, s2.y + ny * ROD_HALF_WIDTH);
  c.lineTo(s2.x - nx * ROD_HALF_WIDTH, s2.y - ny * ROD_HALF_WIDTH);
  c.stroke();

  // 两端铰接小圆点（空心）
  c.lineWidth = 1.5;
  c.fillStyle = '#fff';
  for (const p of [s1, s2]) {
    c.beginPath();
    c.arc(p.x, p.y, JOINT_RADIUS, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  c.restore();
};

export function registerRodRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'rod',
    renderer: rodRenderer,
    layer: 'connector',
  });
}
