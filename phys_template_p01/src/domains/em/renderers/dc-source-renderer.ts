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
  const circuitType = entity.properties.circuitType as string | undefined;
  const useVerticalPolarity = circuitType === 'ohmmeter' || circuitType === 'multi-range-ohmmeter';

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

  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';

  if (useVerticalPolarity) {
    const lineGap = screenH * 0.16;
    const longW = screenW * 0.56;
    const shortW = screenW * 0.32;

    c.strokeStyle = POSITIVE_COLOR;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(centerScreen.x - longW / 2, centerScreen.y - lineGap);
    c.lineTo(centerScreen.x + longW / 2, centerScreen.y - lineGap);
    c.stroke();

    c.strokeStyle = NEGATIVE_COLOR;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(centerScreen.x - shortW / 2, centerScreen.y + lineGap);
    c.lineTo(centerScreen.x + shortW / 2, centerScreen.y + lineGap);
    c.stroke();

    c.fillStyle = POSITIVE_COLOR;
    c.fillText('+', centerScreen.x, centerScreen.y - lineGap - 8);
    c.fillStyle = NEGATIVE_COLOR;
    c.fillText('−', centerScreen.x, centerScreen.y + lineGap + 14);
  } else {
    const lineH = screenH * 0.6;
    const gap = screenW * 0.12;

    // 普通电路统一按“右正左负”显示，和上方主回路电流方向保持一致。
    c.strokeStyle = NEGATIVE_COLOR;
    c.lineWidth = 2;
    const shortH = lineH * 0.5;
    c.beginPath();
    c.moveTo(centerScreen.x - gap, centerScreen.y - shortH / 2);
    c.lineTo(centerScreen.x - gap, centerScreen.y + shortH / 2);
    c.stroke();

    c.strokeStyle = POSITIVE_COLOR;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(centerScreen.x + gap, centerScreen.y - lineH / 2);
    c.lineTo(centerScreen.x + gap, centerScreen.y + lineH / 2);
    c.stroke();

    c.fillStyle = NEGATIVE_COLOR;
    c.fillText('−', centerScreen.x - gap, centerScreen.y - shortH / 2 - 5);
    c.fillStyle = POSITIVE_COLOR;
    c.fillText('+', centerScreen.x + gap, centerScreen.y - lineH / 2 - 5);
  }

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
