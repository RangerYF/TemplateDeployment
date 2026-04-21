import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 容器描边色 */
const CONTAINER_STROKE = '#616161';
/** 容器线宽 */
const CONTAINER_LINE_WIDTH = 2;
/** 封闭端填充色 */
const SEALED_FILL = '#E0E0E0';

/**
 * 气体容器渲染器
 *
 * 按 containerType 分支绘制：
 * - sealed-tube: 一端封闭的玻璃管
 * - cylinder: 气缸（底部和侧壁封闭）
 * - u-tube: U形管
 * - open-box: 开放盒子（分子运动模拟用）
 * - double-sealed: 双端密封管
 */
const gasContainerRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const containerType = (entity.properties.containerType as string) ?? 'sealed-tube';
  const w = (entity.properties.width as number) ?? 0.4;
  const h = (entity.properties.height as number) ?? 2.0;
  const inclineAngle = (entity.properties.inclineAngle as number) ?? 0;

  const c = ctx.ctx;
  c.save();

  const center = worldToScreen(position, coordinateTransform);
  const sw = worldLengthToScreen(w, coordinateTransform);
  const sh = worldLengthToScreen(h, coordinateTransform);

  // 倾斜管旋转
  if (inclineAngle !== 0) {
    c.translate(center.x, center.y);
    c.rotate((-inclineAngle * Math.PI) / 180);
    c.translate(-center.x, -center.y);
  }

  if (containerType === 'u-tube') {
    drawUTube(c, center, sw, sh, entity, coordinateTransform);
  } else if (containerType === 'open-box') {
    drawOpenBox(c, center, sw, sh);
  } else if (containerType === 'double-sealed') {
    drawDoubleSealed(c, center, sw, sh);
  } else {
    // sealed-tube or cylinder
    drawSealedTube(c, center, sw, sh, entity);
  }

  // 标签
  if (entity.label) {
    drawTextLabel(c, entity.label, {
      x: center.x,
      y: center.y + sh / 2 + 18,
    }, { color: '#757575', fontSize: 11, align: 'center' });
  }

  c.restore();
};

function drawSealedTube(
  c: CanvasRenderingContext2D,
  center: { x: number; y: number },
  sw: number, sh: number,
  entity: { properties: Record<string, unknown> },
): void {
  const openEnd = (entity.properties.openEnd as string) ?? 'top';
  const left = center.x - sw / 2;
  const top = center.y - sh / 2;

  // 管壁
  c.strokeStyle = CONTAINER_STROKE;
  c.lineWidth = CONTAINER_LINE_WIDTH;

  c.beginPath();
  // 左壁
  c.moveTo(left, top);
  c.lineTo(left, top + sh);
  // 右壁
  c.moveTo(left + sw, top);
  c.lineTo(left + sw, top + sh);
  c.stroke();

  // 封闭端
  c.fillStyle = SEALED_FILL;
  c.strokeStyle = CONTAINER_STROKE;
  c.lineWidth = CONTAINER_LINE_WIDTH + 1;

  if (openEnd === 'top') {
    // 底部封闭
    c.beginPath();
    c.moveTo(left, top + sh);
    c.lineTo(left + sw, top + sh);
    c.stroke();
    c.fillRect(left, top + sh - 3, sw, 6);
  } else if (openEnd === 'bottom') {
    // 顶部封闭
    c.beginPath();
    c.moveTo(left, top);
    c.lineTo(left + sw, top);
    c.stroke();
    c.fillRect(left, top - 3, sw, 6);
  } else {
    // 两端都封闭 (none)
    c.beginPath();
    c.moveTo(left, top);
    c.lineTo(left + sw, top);
    c.moveTo(left, top + sh);
    c.lineTo(left + sw, top + sh);
    c.stroke();
  }
}

function drawUTube(
  c: CanvasRenderingContext2D,
  center: { x: number; y: number },
  sw: number, sh: number,
  entity: { properties: Record<string, unknown> },
  coordinateTransform: { scale: number; origin: { x: number; y: number } },
): void {
  const leftH = worldLengthToScreen(
    (entity.properties.leftArmHeight as number) ?? 2.0,
    coordinateTransform,
  );
  const rightH = worldLengthToScreen(
    (entity.properties.rightArmHeight as number) ?? 2.0,
    coordinateTransform,
  );
  const armSpacing = sw * 2.5;
  const wallThick = sw;
  const bottom = center.y + sh / 2;

  c.strokeStyle = CONTAINER_STROKE;
  c.lineWidth = CONTAINER_LINE_WIDTH;

  // 左臂
  c.beginPath();
  c.moveTo(center.x - armSpacing / 2 - wallThick / 2, bottom - leftH);
  c.lineTo(center.x - armSpacing / 2 - wallThick / 2, bottom);
  c.lineTo(center.x + armSpacing / 2 + wallThick / 2, bottom);
  c.lineTo(center.x + armSpacing / 2 + wallThick / 2, bottom - rightH);
  c.stroke();

  // 内壁
  c.beginPath();
  c.moveTo(center.x - armSpacing / 2 + wallThick / 2, bottom - leftH);
  c.lineTo(center.x - armSpacing / 2 + wallThick / 2, bottom - wallThick);
  c.lineTo(center.x + armSpacing / 2 - wallThick / 2, bottom - wallThick);
  c.lineTo(center.x + armSpacing / 2 - wallThick / 2, bottom - rightH);
  c.stroke();
}

function drawOpenBox(
  c: CanvasRenderingContext2D,
  center: { x: number; y: number },
  sw: number, sh: number,
): void {
  const left = center.x - sw / 2;
  const top = center.y - sh / 2;

  c.strokeStyle = CONTAINER_STROKE;
  c.lineWidth = CONTAINER_LINE_WIDTH;
  c.setLineDash([6, 4]);

  // 矩形边框（虚线表示开放容器）
  c.strokeRect(left, top, sw, sh);
  c.setLineDash([]);
}

function drawDoubleSealed(
  c: CanvasRenderingContext2D,
  center: { x: number; y: number },
  sw: number, sh: number,
): void {
  const left = center.x - sw / 2;
  const top = center.y - sh / 2;

  c.strokeStyle = CONTAINER_STROKE;
  c.lineWidth = CONTAINER_LINE_WIDTH;

  // 两端都封闭的管
  c.strokeRect(left, top, sw, sh);

  // 封闭端标记
  c.fillStyle = SEALED_FILL;
  c.fillRect(left, top - 3, sw, 6);
  c.fillRect(left, top + sh - 3, sw, 6);
}

export function registerGasContainerRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'gas-container',
    renderer: gasContainerRenderer,
    layer: 'surface',
  });
}
