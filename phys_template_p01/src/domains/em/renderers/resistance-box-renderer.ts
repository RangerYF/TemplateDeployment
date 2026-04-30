import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电阻箱外框颜色 */
const BOX_COLOR = '#2C3E50';
/** 电阻箱填充色 */
const BOX_FILL = 'rgba(44, 62, 80, 0.06)';
/** 旋钮颜色 */
const KNOB_COLOR = '#E67E22';
/** 旋钮文字颜色 */
const KNOB_TEXT = '#FFFFFF';

/**
 * 电阻箱渲染器
 *
 * 绘制内容：
 * 1. 矩形外框
 * 2. 四个旋钮位（×1000 / ×100 / ×10 / ×1）显示当前数字
 * 3. 总阻值标注
 */
const resistanceBoxRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 1.0;
  const height = (entity.properties.height as number) ?? 0.5;
  const resistance = (entity.properties.resistance as number) ?? 0;

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 矩形外框
  c.fillStyle = BOX_FILL;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.strokeStyle = BOX_COLOR;
  c.lineWidth = 2;
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 四个旋钮
  const R = Math.max(0, Math.min(9999, Math.round(resistance)));
  const digits = [
    Math.floor(R / 1000) % 10,
    Math.floor(R / 100) % 10,
    Math.floor(R / 10) % 10,
    R % 10,
  ];
  const multipliers = ['×1000', '×100', '×10', '×1'];

  const knobRadius = Math.min(screenW / 10, screenH / 3.5);
  const knobY = screenTopLeft.y + screenH * 0.4;
  const knobStartX = screenTopLeft.x + screenW * 0.15;
  const knobSpacing = (screenW * 0.7) / 3;

  for (let i = 0; i < 4; i++) {
    const kx = knobStartX + knobSpacing * i;

    // 旋钮圆
    c.beginPath();
    c.arc(kx, knobY, knobRadius, 0, Math.PI * 2);
    c.fillStyle = KNOB_COLOR;
    c.fill();
    c.strokeStyle = '#D35400';
    c.lineWidth = 1.5;
    c.stroke();

    // 旋钮上的数字
    c.fillStyle = KNOB_TEXT;
    c.font = `bold ${Math.max(10, knobRadius)}px Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(digits[i]), kx, knobY);

    // 倍率标注
    c.fillStyle = '#777';
    c.font = `${Math.max(8, knobRadius * 0.65)}px Inter, sans-serif`;
    c.fillText(multipliers[i]!, kx, knobY + knobRadius + 10);
  }

  // 3. 顶部标注总阻值
  const centerX = screenTopLeft.x + screenW / 2;

  c.fillStyle = BOX_COLOR;
  c.font = 'bold 13px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`R=${R}Ω`, centerX, screenTopLeft.y - 10);

  // 4. 底部标注（电压/电流，若有）
  const current = (entity.properties.current as number) ?? 0;
  const voltage = (entity.properties.voltage as number) ?? 0;
  if (Math.abs(current) > 1e-6) {
    drawTextLabel(
      c,
      `U=${voltage.toFixed(2)}V  I=${current.toFixed(3)}A`,
      { x: centerX, y: screenTopLeft.y + screenH + 28 },
      { color: '#555', fontSize: 11, align: 'center' },
    );
  } else if (entity.label != null) {
    drawTextLabel(
      c,
      entity.label as string,
      { x: centerX, y: screenTopLeft.y + screenH + 28 },
      { color: '#555', fontSize: 12, align: 'center' },
    );
  }

  c.restore();
};

export function registerResistanceBoxRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'resistance-box',
    renderer: resistanceBoxRenderer,
    layer: 'object',
  });
}
