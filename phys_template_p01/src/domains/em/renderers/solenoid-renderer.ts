import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import {
  getSolenoidCurrentDirectionLabel,
  getSolenoidFieldDirection,
} from '../logic/current-direction';

/** 螺线管外壳颜色 */
const SOLENOID_COLOR = '#555555';
/** 线圈颜色 */
const COIL_COLOR = '#D35400';
/** 电流方向指示颜色 */
const CURRENT_INDICATOR_COLOR = '#E74C3C';
/** 标签颜色 */
const LABEL_COLOR = '#2C3E50';
/** 内部磁场方向箭头颜色 */
const INTERNAL_FIELD_COLOR = '#3498DB';

/**
 * 螺线管实体渲染器
 *
 * 绘制矩形外壳、内部线圈环、电流方向指示、内部磁场方向箭头
 */
const solenoidRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;
  const { position } = entity.transform;

  const current = Math.abs((entity.properties.current as number) ?? 2);
  const turns = (entity.properties.turns as number) ?? 500;
  const length = (entity.properties.length as number) ?? 3;
  const width = (entity.properties.width as number) ?? length;
  const height = (entity.properties.height as number) ?? 1.2;
  const fieldDirection = getSolenoidFieldDirection(entity);

  // position 为左下角
  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  c.save();

  // 1. 矩形外壳
  c.strokeStyle = SOLENOID_COLOR;
  c.lineWidth = 2;
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 线圈（6 个半椭圆弧）
  const coilCount = 6;
  const coilSpacing = screenW / (coilCount + 1);
  c.strokeStyle = COIL_COLOR;
  c.lineWidth = 1.8;

  for (let i = 1; i <= coilCount; i++) {
    const cx = screenTopLeft.x + i * coilSpacing;
    const arcW = coilSpacing * 0.4;
    const arcH = screenH * 0.35;
    const centerY = screenTopLeft.y + screenH / 2;

    // Draw an elliptical arc (top half visible) representing coil cross-section
    c.beginPath();
    c.ellipse(cx, centerY, arcW, arcH, 0, 0, Math.PI * 2);
    c.stroke();
  }

  // 3. 电流方向指示（顶部小箭头）
  c.fillStyle = CURRENT_INDICATOR_COLOR;
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.fillText(
    getSolenoidCurrentDirectionLabel(entity) === '上侧向右' ? 'I →' : 'I ←',
    screenTopLeft.x + screenW / 2,
    screenTopLeft.y - 4,
  );

  // 4. 内部磁场方向箭头（水平，根据右手定则）
  const arrowY = screenTopLeft.y + screenH / 2;
  const arrowStartX = screenTopLeft.x + screenW * 0.2;
  const arrowEndX = screenTopLeft.x + screenW * 0.8;
  const fieldRight = fieldDirection === 'right';
  const fromX = fieldRight ? arrowStartX : arrowEndX;
  const toX = fieldRight ? arrowEndX : arrowStartX;

  c.strokeStyle = INTERNAL_FIELD_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(fromX, arrowY);
  c.lineTo(toX, arrowY);
  c.stroke();

  // Arrow head
  const headSize = 8;
  const dir = fieldRight ? 1 : -1;
  c.fillStyle = INTERNAL_FIELD_COLOR;
  c.beginPath();
  c.moveTo(toX, arrowY);
  c.lineTo(toX - dir * headSize, arrowY - headSize * 0.5);
  c.lineTo(toX - dir * headSize, arrowY + headSize * 0.5);
  c.closePath();
  c.fill();

  // 5. 标签
  const n = (turns / length).toFixed(0);
  c.fillStyle = LABEL_COLOR;
  c.font = '12px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText(
    `n=${n}匝/m, I=${current}A, B${fieldRight ? '→' : '←'}`,
    screenTopLeft.x + screenW / 2,
    screenTopLeft.y + screenH + 6,
  );

  c.restore();
};

export function registerSolenoidRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'solenoid',
    renderer: solenoidRenderer,
    layer: 'field',
  });
}
