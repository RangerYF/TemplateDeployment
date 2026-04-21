import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电源正极颜色 */
const POSITIVE_COLOR = '#C0392B';
/** 电源负极颜色 */
const NEGATIVE_COLOR = '#2980B9';
/** 电源外框颜色 */
const FRAME_COLOR = '#555';

/**
 * 直流电源渲染器
 *
 * 绘制内容：
 * 1. 电池符号（长短竖线）
 * 2. ε 和 r 标注
 * 3. 正负极标记
 */
const dcSourceRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.8;
  const height = (entity.properties.height as number) ?? 0.5;
  const emf = (entity.properties.emf as number) ?? 6;
  const r = (entity.properties.internalResistance as number) ?? 1;

  // 中心点
  const centerScreen = worldToScreen(
    { x: position.x + width / 2, y: position.y + height / 2 },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 外框（虚线矩形）
  c.strokeStyle = FRAME_COLOR;
  c.lineWidth = 1;
  c.setLineDash([4, 3]);
  c.strokeRect(
    centerScreen.x - screenW / 2,
    centerScreen.y - screenH / 2,
    screenW,
    screenH,
  );
  c.setLineDash([]);

  // 2. 电池符号：中心位置绘制长短竖线
  const lineH = screenH * 0.6;
  const gap = screenW * 0.12;

  // 长竖线（正极）
  c.strokeStyle = POSITIVE_COLOR;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(centerScreen.x - gap, centerScreen.y - lineH / 2);
  c.lineTo(centerScreen.x - gap, centerScreen.y + lineH / 2);
  c.stroke();

  // 短竖线（负极）
  c.strokeStyle = NEGATIVE_COLOR;
  c.lineWidth = 2;
  const shortH = lineH * 0.5;
  c.beginPath();
  c.moveTo(centerScreen.x + gap, centerScreen.y - shortH / 2);
  c.lineTo(centerScreen.x + gap, centerScreen.y + shortH / 2);
  c.stroke();

  // 正负极标记
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillStyle = POSITIVE_COLOR;
  c.fillText('+', centerScreen.x - gap, centerScreen.y - lineH / 2 - 5);
  c.fillStyle = NEGATIVE_COLOR;
  c.fillText('−', centerScreen.x + gap, centerScreen.y - shortH / 2 - 5);

  // 3. 参数标注
  const labelY = centerScreen.y + screenH / 2 + 16;
  drawTextLabel(c, `ε=${emf}V  r=${r}Ω`, { x: centerScreen.x, y: labelY }, {
    color: '#333',
    fontSize: 12,
    align: 'center',
  });

  c.restore();
};

export function registerDCSourceRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'dc-source',
    renderer: dcSourceRenderer,
    layer: 'object',
  });
}
