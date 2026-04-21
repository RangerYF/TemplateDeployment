import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const LINE_COLOR = '#4A5568';
const HATCH_COLOR = '#A0AEC0';
const HATCH_SPACING = 8; // px
const HATCH_HEIGHT = 12; // px
const ANGLE_ARC_RADIUS = 20; // px
const RIGHT_ANGLE_SIZE = 8; // px

const slopeRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;

  const angleDeg = (entity.properties.angle as number) ?? 30;
  const length = (entity.properties.length as number) ?? 3;
  const angleRad = (angleDeg * Math.PI) / 180;

  const baseWidth = length * Math.cos(angleRad);
  const height = length * Math.sin(angleRad);

  // 三个顶点（物理坐标）
  const bottomLeft = position; // 直角顶点
  const bottomRight = { x: position.x + baseWidth, y: position.y };
  const topCorner = { x: position.x, y: position.y + height };

  // 转换到屏幕坐标
  const sBottomLeft = worldToScreen(bottomLeft, coordinateTransform);
  const sBottomRight = worldToScreen(bottomRight, coordinateTransform);
  const sTopCorner = worldToScreen(topCorner, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // ── 斜线填充（三角形内部底边侧，教材风格） ──
  c.save();
  c.beginPath();
  c.moveTo(sBottomLeft.x, sBottomLeft.y);
  c.lineTo(sBottomRight.x, sBottomRight.y);
  c.lineTo(sTopCorner.x, sTopCorner.y);
  c.closePath();
  c.clip();

  c.strokeStyle = HATCH_COLOR;
  c.lineWidth = 1;

  // 底边长度（像素）
  const lineLength = sBottomRight.x - sBottomLeft.x;
  const count = Math.ceil(lineLength / HATCH_SPACING);

  for (let i = 0; i <= count; i++) {
    const x = sBottomLeft.x + i * HATCH_SPACING;
    if (x > sBottomRight.x) break;
    c.beginPath();
    c.moveTo(x, sBottomLeft.y);
    c.lineTo(x - HATCH_HEIGHT * 0.7, sBottomLeft.y + HATCH_HEIGHT);
    c.stroke();
  }

  // 竖直边（左边）也画斜线填充
  const verticalHeight = sBottomLeft.y - sTopCorner.y; // 屏幕像素高度
  const vCount = Math.ceil(verticalHeight / HATCH_SPACING);
  for (let i = 0; i <= vCount; i++) {
    const y = sTopCorner.y + i * HATCH_SPACING;
    if (y > sBottomLeft.y) break;
    c.beginPath();
    c.moveTo(sBottomLeft.x, y);
    c.lineTo(sBottomLeft.x - HATCH_HEIGHT, y + HATCH_HEIGHT * 0.7);
    c.stroke();
  }

  c.restore();

  // ── 主线：斜边 ──
  c.beginPath();
  c.moveTo(sBottomRight.x, sBottomRight.y);
  c.lineTo(sTopCorner.x, sTopCorner.y);
  c.strokeStyle = LINE_COLOR;
  c.lineWidth = 2;
  c.stroke();

  // ── 底边 ──
  c.beginPath();
  c.moveTo(sBottomLeft.x, sBottomLeft.y);
  c.lineTo(sBottomRight.x, sBottomRight.y);
  c.stroke();

  // ── 竖直边（左边） ──
  c.beginPath();
  c.moveTo(sBottomLeft.x, sBottomLeft.y);
  c.lineTo(sTopCorner.x, sTopCorner.y);
  c.stroke();

  // ── 直角标记（底左角 bottomLeft，垂直边与底边交汇处） ──
  c.beginPath();
  c.moveTo(sBottomLeft.x + RIGHT_ANGLE_SIZE, sBottomLeft.y);
  c.lineTo(sBottomLeft.x + RIGHT_ANGLE_SIZE, sBottomLeft.y - RIGHT_ANGLE_SIZE);
  c.lineTo(sBottomLeft.x, sBottomLeft.y - RIGHT_ANGLE_SIZE);
  c.strokeStyle = LINE_COLOR;
  c.lineWidth = 1;
  c.stroke();

  // ── 角度弧线（底右角 bottomRight 的 θ） ──
  // 底右角：底边（向左=π）与斜边（向左上）之间的夹角
  // 用 atan2 精确计算斜边方向
  const hypAngle = Math.atan2(
    sTopCorner.y - sBottomRight.y, // 屏幕 dy（负值，向上）
    sTopCorner.x - sBottomRight.x, // 屏幕 dx（负值，向左）
  );

  c.beginPath();
  // 从底边方向（π）顺时针画到斜边方向（hypAngle），取小弧
  c.arc(
    sBottomRight.x, sBottomRight.y,
    ANGLE_ARC_RADIUS,
    Math.PI, // 底边方向（向左）
    hypAngle, // 斜边方向（向左上）
    false, // clockwise → 小弧（从π增大经过2π到hypAngle）
  );
  c.strokeStyle = LINE_COLOR;
  c.lineWidth = 1;
  c.stroke();

  // ── θ 文本 ──
  // 弧线中点角度（π 到 hypAngle 之间，经过 2π 方向的短弧中点）
  const midAngle = Math.PI + ((hypAngle - Math.PI + 2 * Math.PI) % (2 * Math.PI)) / 2;
  const labelR = ANGLE_ARC_RADIUS + 10;
  const labelX = sBottomRight.x + Math.cos(midAngle) * labelR;
  const labelY = sBottomRight.y + Math.sin(midAngle) * labelR;

  c.font = "11px 'Inter', sans-serif";
  c.fillStyle = LINE_COLOR;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('θ', labelX, labelY);

  c.restore();
};

export function registerSlopeRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'slope',
    renderer: slopeRenderer,
    layer: 'surface',
  });
}
