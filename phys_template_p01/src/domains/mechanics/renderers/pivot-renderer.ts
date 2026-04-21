import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const DOT_RADIUS = 6; // px
const DOT_COLOR = '#2D3748';
const HATCH_COLOR = '#4A5568';
const PULLEY_RADIUS = 12; // px，定滑轮圆环半径

const pivotRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const pos = entity.transform.position;
  const screen = worldToScreen(pos, coordinateTransform);
  const c = ctx.ctx;
  const style = entity.properties.style as string | undefined;
  const orientation = (entity.properties.orientation as string) ?? 'top';

  c.save();

  if (style === 'pulley') {
    // 定滑轮：空心圆环 + 中心实心点
    c.beginPath();
    c.arc(screen.x, screen.y, PULLEY_RADIUS, 0, Math.PI * 2);
    c.strokeStyle = DOT_COLOR;
    c.lineWidth = 2;
    c.stroke();

    c.beginPath();
    c.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    c.fillStyle = DOT_COLOR;
    c.fill();

    c.restore();
    return;
  }

  // 实心圆点
  c.beginPath();
  c.arc(screen.x, screen.y, DOT_RADIUS, 0, Math.PI * 2);
  c.fillStyle = DOT_COLOR;
  c.fill();

  // 根据 orientation 确定绘制方向
  if (orientation === 'left' || orientation === 'right') {
    // 竖直墙壁：三角形 + 斜线在左/右侧
    const sign = orientation === 'left' ? -1 : 1;

    const triH = 14;
    const triW = 18;
    const triBase = screen.x + sign * (DOT_RADIUS + 2);

    // 三角形（尖端指向圆点，底边朝墙壁方向）
    c.beginPath();
    c.moveTo(triBase, screen.y);
    c.lineTo(triBase + sign * triH, screen.y - triW / 2);
    c.lineTo(triBase + sign * triH, screen.y + triW / 2);
    c.closePath();
    c.fillStyle = DOT_COLOR;
    c.fill();

    // 竖直斜线（墙壁标记）
    const wallX = triBase + sign * triH;
    const hatchH = 8;
    const hatchCount = 5;
    const hatchSpan = triW + 4;
    c.strokeStyle = HATCH_COLOR;
    c.lineWidth = 1;
    for (let i = 0; i < hatchCount; i++) {
      const y = screen.y - hatchSpan / 2 + (i * hatchSpan) / (hatchCount - 1);
      c.beginPath();
      c.moveTo(wallX, y);
      c.lineTo(wallX + sign * hatchH, y - hatchH * 0.5);
      c.stroke();
    }
  } else {
    // 默认 "top"：天花板（原有逻辑）
    const triH = 14;
    const triW = 18;
    const triTop = screen.y - DOT_RADIUS - 2;

    c.beginPath();
    c.moveTo(screen.x, triTop);
    c.lineTo(screen.x - triW / 2, triTop - triH);
    c.lineTo(screen.x + triW / 2, triTop - triH);
    c.closePath();
    c.fillStyle = DOT_COLOR;
    c.fill();

    const hatchTop = triTop - triH;
    const hatchH = 8;
    const hatchCount = 5;
    const hatchSpan = triW + 4;
    c.strokeStyle = HATCH_COLOR;
    c.lineWidth = 1;
    for (let i = 0; i < hatchCount; i++) {
      const x = screen.x - hatchSpan / 2 + (i * hatchSpan) / (hatchCount - 1);
      c.beginPath();
      c.moveTo(x, hatchTop);
      c.lineTo(x - hatchH * 0.5, hatchTop - hatchH);
      c.stroke();
    }
  }

  c.restore();
};

export function registerPivotRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'pivot',
    renderer: pivotRenderer,
    layer: 'connector',
  });
}
