import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import type { MagneticFieldDirection } from '../types';

/** 磁场区域边框颜色 */
const BFIELD_BORDER_COLOR = '#9B59B6';
/** 磁场区域背景填充色（半透明） */
const BFIELD_FILL_COLOR = 'rgba(155, 89, 182, 0.06)';
/** ×/· 符号颜色 */
const BFIELD_SYMBOL_COLOR = '#9B59B6';
/** 符号网格间距（物理单位 m） */
const SYMBOL_SPACING = 0.5;
/** 符号大小（像素） */
const SYMBOL_SIZE = 6;

/**
 * 匀强磁场实体渲染器
 *
 * 绘制内容：
 * 1. 矩形区域边框（虚线）+ 淡色填充
 * 2. × 或 · 符号阵列表示磁场方向
 */
const uniformBFieldRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 3;
  const height = (entity.properties.height as number) ?? 2;
  const direction = (entity.properties.direction as MagneticFieldDirection) ?? 'into';

  // 物理坐标：position 为左下角，右上角 = position + (width, height)
  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 背景填充
  c.fillStyle = BFIELD_FILL_COLOR;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 虚线边框
  c.strokeStyle = BFIELD_BORDER_COLOR;
  c.lineWidth = 1.5;
  c.setLineDash([6, 4]);
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.setLineDash([]);

  // 3. × 或 · 符号阵列
  c.strokeStyle = BFIELD_SYMBOL_COLOR;
  c.fillStyle = BFIELD_SYMBOL_COLOR;
  c.lineWidth = 1.2;

  const spacingPx = worldLengthToScreen(SYMBOL_SPACING, coordinateTransform);
  // 从区域内部留半个间距开始
  const startX = screenTopLeft.x + spacingPx / 2;
  const startY = screenTopLeft.y + spacingPx / 2;
  const cols = Math.floor(screenW / spacingPx);
  const rows = Math.floor(screenH / spacingPx);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = startX + col * spacingPx;
      const cy = startY + row * spacingPx;

      if (direction === 'into') {
        // × 符号（垂直纸面向内）
        drawCross(c, cx, cy, SYMBOL_SIZE);
      } else {
        // · 符号（垂直纸面向外）—— 圆心加点
        drawDot(c, cx, cy, SYMBOL_SIZE);
      }
    }
  }

  // 4. 标签
  if (entity.label) {
    c.fillStyle = BFIELD_BORDER_COLOR;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    const magnitude = (entity.properties.magnitude as number) ?? 0.5;
    const dirLabel = direction === 'into' ? '向内' : '向外';
    c.fillText(
      `${entity.label} B=${magnitude}T ${dirLabel}`,
      screenTopLeft.x + 4,
      screenTopLeft.y + 4,
    );
  }

  c.restore();
};

/** 绘制 × 符号 */
function drawCross(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  c.beginPath();
  c.moveTo(cx - size, cy - size);
  c.lineTo(cx + size, cy + size);
  c.moveTo(cx + size, cy - size);
  c.lineTo(cx - size, cy + size);
  c.stroke();
}

/** 绘制 · 符号（实心圆点 + 外圈） */
function drawDot(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
): void {
  // 外圈
  c.beginPath();
  c.arc(cx, cy, size, 0, Math.PI * 2);
  c.stroke();
  // 中心实心点
  c.beginPath();
  c.arc(cx, cy, 2, 0, Math.PI * 2);
  c.fill();
}

export function registerUniformBFieldRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'uniform-bfield',
    renderer: uniformBFieldRenderer,
    layer: 'field',
  });
}
