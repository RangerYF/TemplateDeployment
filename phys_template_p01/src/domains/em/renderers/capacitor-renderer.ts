import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电容器颜色 */
const CAP_COLOR = '#2980B9';
/** 电容器填充色 */
const CAP_FILL = 'rgba(41, 128, 185, 0.06)';

/**
 * 电容器渲染器
 *
 * 绘制内容：
 * 1. 两条平行竖线（电容符号）
 * 2. 连接导线
 * 3. C 值标注
 * 4. 电压/电荷标注（如有）
 */
const capacitorRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.6;
  const height = (entity.properties.height as number) ?? 0.4;
  const capacitance = (entity.properties.capacitance as number) ?? 10;
  const voltage = (entity.properties.voltage as number) ?? 0;
  const charge = (entity.properties.charge as number) ?? 0;

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 背景
  c.fillStyle = CAP_FILL;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  const centerX = screenTopLeft.x + screenW / 2;
  const centerY = screenTopLeft.y + screenH / 2;
  const plateH = screenH * 0.7;
  const gap = screenW * 0.15;

  // 1. 左侧导线
  c.strokeStyle = CAP_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(screenTopLeft.x, centerY);
  c.lineTo(centerX - gap, centerY);
  c.stroke();

  // 2. 左极板
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(centerX - gap, centerY - plateH / 2);
  c.lineTo(centerX - gap, centerY + plateH / 2);
  c.stroke();

  // 3. 右极板
  c.beginPath();
  c.moveTo(centerX + gap, centerY - plateH / 2);
  c.lineTo(centerX + gap, centerY + plateH / 2);
  c.stroke();

  // 4. 右侧导线
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(centerX + gap, centerY);
  c.lineTo(screenTopLeft.x + screenW, centerY);
  c.stroke();

  // 5. C值标注
  c.fillStyle = CAP_COLOR;
  c.font = 'bold 12px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`C=${capacitance}μF`, centerX, screenTopLeft.y + screenH + 14);

  // 6. 电压/电荷标注
  if (Math.abs(voltage) > 0.001 || Math.abs(charge) > 0.001) {
    drawTextLabel(
      c,
      `U=${voltage.toFixed(2)}V  Q=${charge.toFixed(1)}μC`,
      { x: centerX, y: screenTopLeft.y - 8 },
      { color: '#555', fontSize: 11, align: 'center' },
    );
  } else if (entity.label != null) {
    drawTextLabel(
      c,
      entity.label as string,
      { x: centerX, y: screenTopLeft.y - 8 },
      { color: '#555', fontSize: 12, align: 'center' },
    );
  }

  c.restore();
};

export function registerCapacitorRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'capacitor',
    renderer: capacitorRenderer,
    layer: 'object',
  });
}
