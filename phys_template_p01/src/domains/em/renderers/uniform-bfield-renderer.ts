import { rendererRegistry } from '@/core/registries/renderer-registry';
import type { SemicircleHalf } from '@/core/physics/geometry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import type { MagneticFieldDirection } from '../types';

/** 磁场区域边框颜色 */
const BFIELD_BORDER_COLOR = '#9B59B6';
/** 磁场区域背景填充色（半透明） */
const BFIELD_FILL_COLOR = 'rgba(155, 89, 182, 0.06)';
/** ×/· 符号颜色 */
const BFIELD_SYMBOL_COLOR = '#9B59B6';
/** 磁场强度滑块范围 */
const MIN_BFIELD_MAGNITUDE = 0.01;
const MAX_BFIELD_MAGNITUDE = 2;
/** 稀疏/密集状态下的符号网格间距（物理单位 m） */
const MAX_SYMBOL_SPACING = 0.92;
const MIN_SYMBOL_SPACING = 0.3;
/** 符号大小（像素） */
const SYMBOL_SIZE = 6;

function bToSymbolSpacing(magnitude: number): number {
  const clamped = Math.max(MIN_BFIELD_MAGNITUDE, Math.min(MAX_BFIELD_MAGNITUDE, magnitude));
  const normalized = (
    Math.log(clamped) - Math.log(MIN_BFIELD_MAGNITUDE)
  ) / (
    Math.log(MAX_BFIELD_MAGNITUDE) - Math.log(MIN_BFIELD_MAGNITUDE)
  );

  return MAX_SYMBOL_SPACING + (MIN_SYMBOL_SPACING - MAX_SYMBOL_SPACING) * normalized;
}

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
  const magnitude = (entity.properties.magnitude as number) ?? 0.5;
  const boundaryShape = entity.properties.boundaryShape as string | undefined;
  const boundaryRadius = entity.properties.boundaryRadius as number | undefined;
  const autoBoundaryMode = entity.properties.autoBoundaryMode as string | undefined;
  const boundaryHalf = (entity.properties.boundaryHalf as SemicircleHalf | undefined) ?? 'up';
  const symbolSpacing = bToSymbolSpacing(magnitude);

  const c = ctx.ctx;

  // ── 圆形 / 半圆边界渲染 ──
  if ((boundaryShape === 'circle' || boundaryShape === 'semicircle') && boundaryRadius != null) {
    const centerPhys = {
      x: position.x + width / 2,
      y: position.y + height / 2,
    };
    const screenCenter = worldToScreen(centerPhys, coordinateTransform);
    const screenRadius = worldLengthToScreen(boundaryRadius, coordinateTransform);

    c.save();
    traceRoundBoundaryPath(
      c,
      screenCenter.x,
      screenCenter.y,
      screenRadius,
      boundaryShape,
      boundaryHalf,
    );
    c.clip();

    // Fill background
    c.fillStyle = BFIELD_FILL_COLOR;
    c.fill();

    // Draw symbols inside clipped region
    c.strokeStyle = BFIELD_SYMBOL_COLOR;
    c.fillStyle = BFIELD_SYMBOL_COLOR;
    c.lineWidth = 1.2;

    const spacingPx = worldLengthToScreen(symbolSpacing, coordinateTransform);
    const startX = screenCenter.x - screenRadius + spacingPx / 2;
    const startY = screenCenter.y - screenRadius + spacingPx / 2;
    const cols = Math.floor((screenRadius * 2) / spacingPx);
    const rows = Math.floor((screenRadius * 2) / spacingPx);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const sx = startX + col * spacingPx;
        const sy = startY + row * spacingPx;
        if (direction === 'into') {
          drawCross(c, sx, sy, SYMBOL_SIZE);
        } else {
          drawDot(c, sx, sy, SYMBOL_SIZE);
        }
      }
    }

    c.restore();

    // Draw circular border (outside clip)
    c.save();
    c.strokeStyle = BFIELD_BORDER_COLOR;
    c.lineWidth = 1.5;
    c.setLineDash([6, 4]);
    traceRoundBoundaryPath(
      c,
      screenCenter.x,
      screenCenter.y,
      screenRadius,
      boundaryShape,
      boundaryHalf,
    );
    c.stroke();
    c.setLineDash([]);

    if (boundaryShape === 'circle') {
      drawCircleCenterMarker(c, screenCenter.x, screenCenter.y);
    }

    // Label
    if (entity.label) {
      c.fillStyle = BFIELD_BORDER_COLOR;
      c.font = '12px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      const dirLabel = direction === 'into' ? '向内' : '向外';
      const radiusLabel = autoBoundaryMode && boundaryRadius != null
        ? ` r_ref=${boundaryRadius.toFixed(2)}m`
        : '';
      c.fillText(
        `${entity.label} B=${magnitude}T ${dirLabel}${radiusLabel}`,
        screenCenter.x,
        screenCenter.y - screenRadius - 4,
      );
    }
    c.restore();
    return; // Early return, don't draw rectangular version
  }

  // ── 矩形边界渲染（默认） ──
  // 物理坐标：position 为左下角，右上角 = position + (width, height)
  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

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

  const spacingPx = worldLengthToScreen(symbolSpacing, coordinateTransform);
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

function traceRoundBoundaryPath(
  c: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  shape: string | undefined,
  half: SemicircleHalf,
): void {
  c.beginPath();

  if (shape === 'semicircle') {
    if (half === 'down') {
      c.moveTo(centerX - radius, centerY);
      c.arc(centerX, centerY, radius, Math.PI, 0, true);
      c.lineTo(centerX - radius, centerY);
      return;
    }
    if (half === 'left') {
      c.moveTo(centerX, centerY - radius);
      c.arc(centerX, centerY, radius, -Math.PI / 2, Math.PI / 2, true);
      c.lineTo(centerX, centerY - radius);
      return;
    }
    if (half === 'right') {
      c.moveTo(centerX, centerY - radius);
      c.arc(centerX, centerY, radius, -Math.PI / 2, Math.PI / 2, false);
      c.lineTo(centerX, centerY - radius);
      return;
    }

    c.moveTo(centerX - radius, centerY);
    c.arc(centerX, centerY, radius, Math.PI, 0, false);
    c.lineTo(centerX - radius, centerY);
    return;
  }

  c.arc(centerX, centerY, radius, 0, Math.PI * 2);
}

function drawCircleCenterMarker(
  c: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
): void {
  c.save();
  c.strokeStyle = BFIELD_BORDER_COLOR;
  c.lineWidth = 1.4;

  c.beginPath();
  c.moveTo(centerX - 9, centerY);
  c.lineTo(centerX + 9, centerY);
  c.moveTo(centerX, centerY - 9);
  c.lineTo(centerX, centerY + 9);
  c.stroke();

  c.fillStyle = 'rgba(255, 255, 255, 0.96)';
  c.beginPath();
  c.arc(centerX, centerY, 5, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.beginPath();
  c.moveTo(centerX + 4, centerY - 4);
  c.lineTo(centerX + 10, centerY - 10);
  c.stroke();

  c.fillStyle = BFIELD_BORDER_COLOR;
  c.font = '600 12px Inter, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'bottom';
  c.fillText('O', centerX + 12, centerY - 8);
  c.restore();
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
