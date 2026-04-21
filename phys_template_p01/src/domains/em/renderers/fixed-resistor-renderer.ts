import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电阻外框颜色 */
const RESISTOR_COLOR = '#8E44AD';
/** 电阻填充色 */
const RESISTOR_FILL = 'rgba(142, 68, 173, 0.08)';

/**
 * 定值电阻渲染器
 *
 * 绘制内容：
 * 1. 矩形方框（电阻符号）
 * 2. R 值标注
 * 3. 电压/电流读数（如有）
 */
const fixedResistorRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.8;
  const height = (entity.properties.height as number) ?? 0.4;
  const resistance = (entity.properties.resistance as number) ?? 10;
  const voltage = (entity.properties.voltage as number) ?? 0;
  const current = (entity.properties.current as number) ?? 0;

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 矩形方框
  c.fillStyle = RESISTOR_FILL;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.strokeStyle = RESISTOR_COLOR;
  c.lineWidth = 2;
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 中心标注 R 值
  const centerX = screenTopLeft.x + screenW / 2;
  const centerY = screenTopLeft.y + screenH / 2;

  c.fillStyle = RESISTOR_COLOR;
  c.font = 'bold 13px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`R=${resistance}Ω`, centerX, centerY);

  // 3. 底部标注电压/电流
  if (Math.abs(current) > 1e-6) {
    const infoText = `U=${voltage.toFixed(2)}V  I=${current.toFixed(3)}A`;
    drawTextLabel(
      c,
      infoText,
      { x: centerX, y: screenTopLeft.y + screenH + 16 },
      { color: '#555', fontSize: 11, align: 'center' },
    );
  } else if (entity.label) {
    drawTextLabel(
      c,
      entity.label,
      { x: centerX, y: screenTopLeft.y + screenH + 16 },
      { color: '#555', fontSize: 12, align: 'center' },
    );
  }

  c.restore();
};

export function registerFixedResistorRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'fixed-resistor',
    renderer: fixedResistorRenderer,
    layer: 'object',
  });
}
