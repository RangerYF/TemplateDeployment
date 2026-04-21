import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type {
  MotionViewportData,
  Vec2,
} from '@/core/types';
import type { PlacementBox } from '@/renderer/placement';
import { segmentToBox, measureText, placeLabel } from '@/renderer/placement';

// ═══════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════

const VELOCITY_COLOR = '#2563EB';
const ACCELERATION_COLOR = '#DC2626';
const MIN_ARROW_LENGTH = 20;
const MAX_ARROW_LENGTH = 150;
const LABEL_FONT_SIZE = 12;
const PERP_OFFSET = 12;

// ═══════════════════════════════════════════════
// 箭头长度映射（对数）
// ═══════════════════════════════════════════════

function velocityToLength(magnitude: number): number {
  if (magnitude <= 0) return 0;
  const len =
    MIN_ARROW_LENGTH +
    ((MAX_ARROW_LENGTH - MIN_ARROW_LENGTH) * Math.log(1 + magnitude)) /
      Math.log(1 + 50);
  return Math.max(MIN_ARROW_LENGTH, Math.min(MAX_ARROW_LENGTH, len));
}

function accelerationToLength(magnitude: number): number {
  if (magnitude <= 0) return 0;
  const len =
    MIN_ARROW_LENGTH +
    ((MAX_ARROW_LENGTH - MIN_ARROW_LENGTH) * Math.log(1 + magnitude)) /
      Math.log(1 + 30);
  return Math.max(MIN_ARROW_LENGTH, Math.min(MAX_ARROW_LENGTH, len));
}

// ═══════════════════════════════════════════════
// 标签候选位置
// ═══════════════════════════════════════════════

function generateLabelCandidates(
  screenFrom: Vec2,
  screenTo: Vec2,
): Array<{ left: number; top: number; preference: number }> {
  const mid = {
    x: (screenFrom.x + screenTo.x) / 2,
    y: (screenFrom.y + screenTo.y) / 2,
  };
  const off = 14;
  return [
    { left: mid.x + off, top: mid.y - LABEL_FONT_SIZE / 2, preference: 0 },
    { left: mid.x - off - 60, top: mid.y - LABEL_FONT_SIZE / 2, preference: 1 },
    { left: mid.x - 30, top: mid.y - off - LABEL_FONT_SIZE, preference: 2 },
    { left: mid.x - 30, top: mid.y + off, preference: 3 },
  ];
}

// ═══════════════════════════════════════════════
// 主渲染器（箭头，图表由 MotionCharts React 组件负责）
// ═══════════════════════════════════════════════

const motionViewportRenderer: ViewportRenderer = (data, entities, renderCtx) => {
  if (data.type !== 'motion') return;

  const motionData = data.data as MotionViewportData;
  const { motionStates } = motionData;
  const { coordinateTransform } = renderCtx;
  const ctx = renderCtx.ctx;

  for (const motion of motionStates) {
    const entity = entities.get(motion.entityId);
    if (!entity) continue;

    const entityHeight = (entity.properties.height as number) ?? 0;
    const rotation = entity.transform.rotation ?? 0;
    const pos = entity.transform.position;
    const center = {
      x: pos.x + -Math.sin(rotation) * (entityHeight / 2),
      y: pos.y + Math.cos(rotation) * (entityHeight / 2),
    };
    const screenCenter = worldToScreen(center, coordinateTransform);
    const occupied: PlacementBox[] = [];

    // ── 速度箭头 ──
    const vMag = Math.hypot(motion.velocity.x, motion.velocity.y);
    if (vMag > 1e-4) {
      const vDir = {
        x: motion.velocity.x / vMag,
        y: motion.velocity.y / vMag,
      };
      const arrowLen = velocityToLength(vMag);
      const screenTo = {
        x: screenCenter.x + vDir.x * arrowLen,
        y: screenCenter.y - vDir.y * arrowLen,
      };

      drawArrow(ctx, screenCenter, screenTo, {
        color: VELOCITY_COLOR,
        lineWidth: 2.5,
        arrowHeadSize: 10,
        dashed: false,
      });
      occupied.push(segmentToBox(screenCenter, screenTo, 2.5));

      const labelText = `v=${vMag.toFixed(1)}m/s`;
      const textW = measureText(labelText, LABEL_FONT_SIZE, ctx);
      const candidates = generateLabelCandidates(screenCenter, screenTo);
      const placement = placeLabel(candidates, textW, LABEL_FONT_SIZE, occupied);
      drawTextLabel(
        ctx,
        labelText,
        { x: placement.left + textW / 2, y: placement.top + LABEL_FONT_SIZE / 2 },
        { color: VELOCITY_COLOR, fontSize: LABEL_FONT_SIZE, align: 'center' },
      );
    }

    // ── 加速度箭头（虚线） ──
    const aMag = Math.hypot(motion.acceleration.x, motion.acceleration.y);
    if (aMag > 1e-4) {
      const aDir = {
        x: motion.acceleration.x / aMag,
        y: motion.acceleration.y / aMag,
      };
      const arrowLen = accelerationToLength(aMag);

      // 屏幕方向 + 垂直偏移
      const screenDirX = aDir.x;
      const screenDirY = -aDir.y;
      const screenDirLen = Math.hypot(screenDirX, screenDirY);
      const normDirX = screenDirX / screenDirLen;
      const normDirY = screenDirY / screenDirLen;
      const perpX = normDirY;
      const perpY = -normDirX;

      const offsetFrom = {
        x: screenCenter.x + perpX * PERP_OFFSET,
        y: screenCenter.y + perpY * PERP_OFFSET,
      };
      const offsetTo = {
        x: offsetFrom.x + normDirX * arrowLen,
        y: offsetFrom.y + normDirY * arrowLen,
      };

      drawArrow(ctx, offsetFrom, offsetTo, {
        color: ACCELERATION_COLOR,
        lineWidth: 2,
        arrowHeadSize: 8,
        dashed: true,
      });
      occupied.push(segmentToBox(offsetFrom, offsetTo, 2));

      const labelText = `a=${aMag.toFixed(1)}m/s²`;
      const textW = measureText(labelText, LABEL_FONT_SIZE, ctx);
      const candidates = generateLabelCandidates(offsetFrom, offsetTo);
      const placement = placeLabel(candidates, textW, LABEL_FONT_SIZE, occupied);
      drawTextLabel(
        ctx,
        labelText,
        { x: placement.left + textW / 2, y: placement.top + LABEL_FONT_SIZE / 2 },
        { color: ACCELERATION_COLOR, fontSize: LABEL_FONT_SIZE, align: 'center' },
      );
    }
  }
};

export function registerMotionViewport(): void {
  rendererRegistry.registerViewport('motion', motionViewportRenderer);
}
