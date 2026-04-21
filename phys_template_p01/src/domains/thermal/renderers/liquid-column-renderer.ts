import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import { mToCm } from '../logic/gas-law-utils';

/** 液柱颜色（水银 = 银灰色） */
const LIQUID_FILL = '#9E9E9E';
const LIQUID_STROKE = '#757575';

/**
 * 液柱渲染器
 *
 * 绘制内容：
 * 1. 银灰色液柱填充
 * 2. 长度标注
 */
const liquidColumnRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const props = entity.properties;

  const length = (props.length as number) ?? 0.1;
  const crossSection = (props.crossSection as number) ?? 2e-4;
  const positionOffset = (props.positionOffset as number) ?? 0;

  const c = ctx.ctx;
  c.save();

  const center = worldToScreen(
    { x: position.x, y: position.y + positionOffset },
    coordinateTransform,
  );
  const sw = worldLengthToScreen(Math.sqrt(crossSection) * 50, coordinateTransform);
  const sh = worldLengthToScreen(length, coordinateTransform);

  // 液柱填充
  c.fillStyle = LIQUID_FILL;
  c.fillRect(center.x - sw / 2, center.y - sh / 2, sw, sh);

  // 描边
  c.strokeStyle = LIQUID_STROKE;
  c.lineWidth = 1;
  c.strokeRect(center.x - sw / 2, center.y - sh / 2, sw, sh);

  // 长度标注
  const lengthCm = mToCm(length);
  drawTextLabel(c, `L = ${lengthCm.toFixed(1)} cm`, {
    x: center.x + sw / 2 + 8,
    y: center.y,
  }, {
    color: '#616161',
    fontSize: 11,
    align: 'left',
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 2,
  });

  c.restore();
};

export function registerLiquidColumnRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'liquid-column',
    renderer: liquidColumnRenderer,
    layer: 'object',
  });
}
