import { rendererRegistry } from '@/core/registries/renderer-registry';
import type { SemicircleHalf } from '@/core/physics/geometry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import {
  calculateFieldLines,
  calculateEquipotentialLines,
} from '@/domains/em/logic/field-line-calculator';
import { computePotentialAtPoint } from '@/domains/em/logic/electric-field-observables';
import { sampleMagneticFieldAtPoint } from '@/domains/em/logic/lorentz-force';
import { isSourcePointCharge } from '@/domains/em/logic/point-charge-role';
import { renderFieldLines } from '@/domains/em/viewports/field-lines-renderer';
import { renderMagneticLines } from '@/domains/em/viewports/magnetic-lines-renderer';
import { renderPotentialMap } from '@/domains/em/viewports/potential-map-renderer';
import { useSimulationStore } from '@/store/simulation-store';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, Vec2 } from '@/core/types';
import { isStaticElectrostaticScene } from '../logic/static-electrostatic-scene';

/** 场信息标注颜色 */
const FIELD_LABEL_COLOR = '#9B59B6';
const AMPERE_FORCE_COLOR = '#D946EF';
const AMPERE_GUIDE_COLOR = 'rgba(217, 70, 239, 0.28)';
const AMPERE_GHOST_COLOR = 'rgba(217, 70, 239, 0.4)';

// ─── 电场线缓存 ─────────────────────────────────────
let cachedChargeKey = '';
let cachedFieldLines: ReturnType<typeof calculateFieldLines> = [];
let cachedEquipotentialLines: ReturnType<typeof calculateEquipotentialLines> = [];

/** 生成用于缓存失效检测的 key */
function buildChargeKey(charges: Array<{ id: string; position: Vec2; charge: number }>): string {
  return charges
    .map(c => `${c.id}:${c.position.x.toFixed(4)},${c.position.y.toFixed(4)},${c.charge.toFixed(6)}`)
    .join('|');
}

function buildBoundsKey(bounds: { minX: number; maxX: number; minY: number; maxY: number }): string {
  return [
    bounds.minX.toFixed(4),
    bounds.maxX.toFixed(4),
    bounds.minY.toFixed(4),
    bounds.maxY.toFixed(4),
  ].join(',');
}

/**
 * 场视角渲染器（field viewport）
 *
 * 功能：在场视角下为场实体叠加信息标注层，包括：
 * - 场类型与物理量标注（B=0.5T 向内）
 * - 场方向指示（磁场用 ×/· 已由实体渲染器绘制，
 *   此处补充场强数值、方向文字和区域边界高亮）
 * - 点电荷场景：电场线 + 等势线可视化
 *
 * 设计思路：
 * - 实体渲染器（uniform-bfield-renderer）负责绘制场区域的基础外观（边框 + ×/· 阵列）
 * - 视角渲染器（本文件）在 field 视角激活时叠加额外信息标注
 * - 两者职责分离：切换到其他视角时，实体渲染器仍绘制场区域，但视角标注层不显示
 */
const fieldViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'field') return;

  const { fieldEntities } = data.data;
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;
  const simulationState = useSimulationStore.getState().simulationState;
  const hideSceneAnnotations = isStaticElectrostaticScene(
    entities.values(),
    simulationState.timeline.duration,
  );

  if (!hideSceneAnnotations) {
    for (const fieldInfo of fieldEntities) {
      const entity = entities.get(fieldInfo.entityId);
      if (!entity) continue;
      if (fieldInfo.fieldType !== 'magnetic' && fieldInfo.fieldType !== 'electric') continue;

      const { region } = fieldInfo;
      const boundaryShape = entity.properties.boundaryShape as string | undefined;
      const boundaryRadius = entity.properties.boundaryRadius as number | undefined;
      const boundaryHalf = (entity.properties.boundaryHalf as SemicircleHalf | undefined) ?? 'up';

      let infoText: string;
      if (fieldInfo.fieldType === 'magnetic') {
        const dirText = entity.properties.direction === 'out' ? '向外' : '向内';
        infoText = `B = ${fieldInfo.magnitude} T  ${dirText}`;
      } else if (fieldInfo.fieldType === 'electric') {
        infoText = `E = ${fieldInfo.magnitude} V/m`;
      } else {
        infoText = `${fieldInfo.fieldType}: ${fieldInfo.magnitude}`;
      }

      if ((boundaryShape === 'circle' || boundaryShape === 'semicircle') && boundaryRadius != null) {
        const centerWorld = {
          x: region.x + region.width / 2,
          y: region.y + region.height / 2,
        };
        const screenCenter = worldToScreen(centerWorld, coordinateTransform);
        const screenRadius = worldLengthToScreen(boundaryRadius, coordinateTransform);

        drawTextLabel(c, infoText, {
          x: screenCenter.x,
          y: screenCenter.y - screenRadius - 18,
        }, {
          color: FIELD_LABEL_COLOR,
          fontSize: 13,
          align: 'center',
        });

        c.save();
        c.strokeStyle = FIELD_LABEL_COLOR;
        c.lineWidth = 2.5;
        c.setLineDash([8, 4]);
        traceRoundFieldBoundaryPath(
          c,
          screenCenter.x,
          screenCenter.y,
          screenRadius,
          boundaryShape,
          boundaryHalf,
        );
        c.stroke();
        c.setLineDash([]);
        c.restore();
        continue;
      }

      const bottomRight = worldToScreen(
        { x: region.x + region.width, y: region.y },
        coordinateTransform,
      );

      drawTextLabel(c, infoText, { x: bottomRight.x - 4, y: bottomRight.y + 16 }, {
        color: FIELD_LABEL_COLOR,
        fontSize: 13,
        align: 'right',
      });

      const screenTopLeft = worldToScreen(
        { x: region.x, y: region.y + region.height },
        coordinateTransform,
      );
      const screenW = worldLengthToScreen(region.width, coordinateTransform);
      const screenH = worldLengthToScreen(region.height, coordinateTransform);

      c.save();
      c.strokeStyle = FIELD_LABEL_COLOR;
      c.lineWidth = 2.5;
      c.setLineDash([8, 4]);
      c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
      c.setLineDash([]);
      c.restore();
    }
  }

  // ─── 点电荷电场线渲染 ─────────────────────────────
  // 检测场景是否包含点电荷且不含匀强场实体
  let hasUniformField = false;
  const pointCharges: Array<{ id: string; position: Vec2; charge: number; radius?: number }> = [];

  for (const entity of entities.values()) {
    if (entity.type === 'uniform-bfield' || entity.type === 'uniform-efield') {
      hasUniformField = true;
      break;
    }
    if (isSourcePointCharge(entity)) {
      const charge = entity.properties.charge as number;
      if (charge !== 0) {
        // 点电荷的 charge 属性在库仑预设中单位为 μC，需 ×1e-6 转为 C
        pointCharges.push({
          id: entity.id,
          position: { ...entity.transform.position },
          charge: charge * 1e-6,
          radius: entity.properties.radius as number | undefined,
        });
      }
    }
  }

  const showFieldLines = useSimulationStore.getState().showFieldLines;
  const showEquipotentialLines = useSimulationStore.getState().showEquipotentialLines;
  const showPotentialMap = useSimulationStore.getState().showPotentialMap;
  const fieldLineDensity = useSimulationStore.getState().fieldLineDensity;
  const potentialProbeA = useSimulationStore.getState().potentialProbeA;
  const potentialProbeB = useSimulationStore.getState().potentialProbeB;
  const entityList = Array.from(entities.values());

  if (!hasUniformField && pointCharges.length > 0 && showPotentialMap) {
    renderPotentialMap(c, ctx.canvas, coordinateTransform, pointCharges, {
      showFieldLines,
      showEquipotentialLines,
    });
  }

  if (!hasUniformField && pointCharges.length > 0 && (showFieldLines || showEquipotentialLines)) {
    // worldToScreen / screenToWorld 使用的是 CSS 像素坐标，
    // 这里必须和 coordinateTransform 保持同一坐标口径，不能直接拿 DPR 放大的物理像素。
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = canvas.clientWidth || canvas.width / dpr;
    const canvasHeight = canvas.clientHeight || canvas.height / dpr;
    const bounds = {
      minX: -coordinateTransform.origin.x / coordinateTransform.scale,
      maxX: (canvasWidth - coordinateTransform.origin.x) / coordinateTransform.scale,
      minY: -(canvasHeight - coordinateTransform.origin.y) / coordinateTransform.scale,
      maxY: coordinateTransform.origin.y / coordinateTransform.scale,
    };

    // 缓存同时依赖电荷状态和当前可视边界，否则首次进入/缩放后会复用旧结果。
    const cacheKey = `${buildChargeKey(pointCharges)}|${buildBoundsKey(bounds)}|${fieldLineDensity}`;
    if (cacheKey !== cachedChargeKey) {
      cachedChargeKey = cacheKey;
      cachedFieldLines = calculateFieldLines(pointCharges, bounds, {
        density: fieldLineDensity,
      });
      cachedEquipotentialLines = calculateEquipotentialLines(pointCharges, bounds, {
        density: fieldLineDensity,
      });
    }

    renderFieldLines(c, cachedFieldLines, cachedEquipotentialLines, coordinateTransform, {
      showFieldLines,
      showEquipotentialLines,
    });
  }

  if (!hasUniformField && pointCharges.length > 0 && (potentialProbeA || potentialProbeB)) {
    renderPotentialProbeOverlay(
      c,
      coordinateTransform,
      pointCharges,
      potentialProbeA,
      potentialProbeB,
    );
  }

  // ─── 载流导线/螺线管磁感线渲染 ─────────────────────
  for (const entity of entityList) {
    if (entity.type === 'current-wire' || entity.type === 'solenoid') {
      renderMagneticLines(c, entity, coordinateTransform);
    }
  }

  const currentWires = entityList.filter((entity) => entity.type === 'current-wire');
  const uniformBFields = entityList.filter((entity) => entity.type === 'uniform-bfield');
  const hasPointChargeEntity = entityList.some((entity) => entity.type === 'point-charge');

  if (!hasPointChargeEntity && currentWires.length > 0 && uniformBFields.length > 0) {
    renderAmpereForceOverlay(c, coordinateTransform, currentWires, uniformBFields);
  }
};

export function registerFieldViewport(): void {
  rendererRegistry.registerViewport('field', fieldViewportRenderer);
}

function traceRoundFieldBoundaryPath(
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

function renderAmpereForceOverlay(
  canvasContext: CanvasRenderingContext2D,
  coordinateTransform: { scale: number; origin: Vec2 },
  currentWires: Entity[],
  bfields: Entity[],
): void {
  const animationTime = performance.now() / 1000;

  for (const wire of currentWires) {
    const overlay = buildAmpereOverlay(wire, bfields);
    if (!overlay) continue;

    const pulse = 0.5 + 0.5 * Math.sin(animationTime * 2.8);
    const arrowLength = 54 + 24 * pulse;
    const displacement = 0.12 + 0.16 * pulse;
    const startWorld = {
      x: overlay.center.x + overlay.forceDirection.x * 0.1,
      y: overlay.center.y + overlay.forceDirection.y * 0.1,
    };
    const endWorld = {
      x: startWorld.x + overlay.forceDirection.x * (arrowLength / coordinateTransform.scale),
      y: startWorld.y + overlay.forceDirection.y * (arrowLength / coordinateTransform.scale),
    };
    const screenStart = worldToScreen(startWorld, coordinateTransform);
    const screenEnd = worldToScreen(endWorld, coordinateTransform);
    const screenCenter = worldToScreen(overlay.center, coordinateTransform);
    const ghostBottom = worldToScreen(
      {
        x: overlay.bottom.x + overlay.forceDirection.x * displacement,
        y: overlay.bottom.y + overlay.forceDirection.y * displacement,
      },
      coordinateTransform,
    );
    const ghostTop = worldToScreen(
      {
        x: overlay.top.x + overlay.forceDirection.x * displacement,
        y: overlay.top.y + overlay.forceDirection.y * displacement,
      },
      coordinateTransform,
    );

    canvasContext.save();
    canvasContext.strokeStyle = AMPERE_GUIDE_COLOR;
    canvasContext.lineWidth = 2;
    canvasContext.setLineDash([6, 5]);
    canvasContext.beginPath();
    canvasContext.moveTo(screenCenter.x, screenCenter.y);
    canvasContext.lineTo(ghostBottom.x, ghostBottom.y + (ghostTop.y - ghostBottom.y) / 2);
    canvasContext.stroke();
    canvasContext.setLineDash([]);
    canvasContext.restore();

    canvasContext.save();
    canvasContext.strokeStyle = AMPERE_GHOST_COLOR;
    canvasContext.lineWidth = 4;
    canvasContext.setLineDash([8, 6]);
    canvasContext.beginPath();
    canvasContext.moveTo(ghostBottom.x, ghostBottom.y);
    canvasContext.lineTo(ghostTop.x, ghostTop.y);
    canvasContext.stroke();
    canvasContext.setLineDash([]);
    canvasContext.restore();

    drawArrow(canvasContext, screenStart, screenEnd, {
      color: AMPERE_FORCE_COLOR,
      lineWidth: 3,
      arrowHeadSize: 12,
    });

    drawTextLabel(
      canvasContext,
      `I${overlay.currentDirectionLabel}  B${overlay.fieldDirectionLabel}  F${overlay.forceDirectionLabel}`,
      worldToScreen({ x: overlay.center.x, y: overlay.top.y + 0.55 }, coordinateTransform),
      {
        color: AMPERE_FORCE_COLOR,
        fontSize: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        padding: 6,
      },
    );

    drawTextLabel(
      canvasContext,
      `安培力 ${overlay.forceDirectionLabel}`,
      {
        x: screenEnd.x + overlay.forceDirection.x * 14,
        y: screenEnd.y - overlay.forceDirection.y * 12,
      },
      {
        color: AMPERE_FORCE_COLOR,
        fontSize: 12,
        align: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        padding: 5,
      },
    );
  }
}

function buildAmpereOverlay(
  wire: Entity,
  bfields: Entity[],
): {
  center: Vec2;
  top: Vec2;
  bottom: Vec2;
  forceDirection: Vec2;
  currentDirectionLabel: string;
  fieldDirectionLabel: string;
  forceDirectionLabel: string;
} | null {
  const wireShape = (wire.properties.wireShape as string | undefined) ?? 'straight';
  if (wireShape !== 'straight') return null;

  const width = readNumber(wire.properties.width, 0.1);
  const height = readNumber(wire.properties.height, 0);
  const direction = normalizeVector({
    x: readNumber((wire.properties.wireDirection as Partial<Vec2> | undefined)?.x, 0),
    y: readNumber((wire.properties.wireDirection as Partial<Vec2> | undefined)?.y, 1),
  });
  if (Math.abs(direction.x) < 1e-6 && Math.abs(direction.y) < 1e-6) return null;

  const center = {
    x: wire.transform.position.x + width / 2,
    y: wire.transform.position.y + height / 2,
  };
  const fieldSample = sampleMagneticFieldAtPoint(center, bfields);
  if (!fieldSample.inField || !fieldSample.direction) return null;

  const forceDirection = normalizeVector({
    x: direction.y * fieldSample.signedBz,
    y: -direction.x * fieldSample.signedBz,
  });
  if (Math.abs(forceDirection.x) < 1e-6 && Math.abs(forceDirection.y) < 1e-6) return null;

  return {
    center,
    bottom: { x: center.x, y: wire.transform.position.y },
    top: { x: center.x, y: wire.transform.position.y + height },
    forceDirection,
    currentDirectionLabel: toVectorDirectionLabel(direction),
    fieldDirectionLabel: fieldSample.direction === 'out' ? '向外' : '向内',
    forceDirectionLabel: toVectorDirectionLabel(forceDirection),
  };
}

function renderPotentialProbeOverlay(
  canvasContext: CanvasRenderingContext2D,
  coordinateTransform: { scale: number; origin: Vec2 },
  charges: Array<{ position: Vec2; charge: number }>,
  probeA: Vec2 | null,
  probeB: Vec2 | null,
): void {
  if (!probeA && !probeB) return;

  canvasContext.save();

  if (probeA && probeB) {
    const start = worldToScreen(probeA, coordinateTransform);
    const end = worldToScreen(probeB, coordinateTransform);
    canvasContext.strokeStyle = '#8B5CF6';
    canvasContext.lineWidth = 1.5;
    canvasContext.setLineDash([8, 6]);
    canvasContext.beginPath();
    canvasContext.moveTo(start.x, start.y);
    canvasContext.lineTo(end.x, end.y);
    canvasContext.stroke();
    canvasContext.setLineDash([]);

    const mid = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const deltaV = computePotentialAtPoint(probeA, charges) - computePotentialAtPoint(probeB, charges);
    drawTextLabel(canvasContext, `ΔV=${formatPotentialValue(deltaV)}`, { x: mid.x, y: mid.y - 10 }, {
      color: '#8B5CF6',
      fontSize: 11,
      align: 'center',
    });
  }

  drawPotentialProbe(canvasContext, coordinateTransform, probeA, 'A', '#0EA5E9');
  drawPotentialProbe(canvasContext, coordinateTransform, probeB, 'B', '#F97316');
  canvasContext.restore();
}

function drawPotentialProbe(
  canvasContext: CanvasRenderingContext2D,
  coordinateTransform: { scale: number; origin: Vec2 },
  probe: Vec2 | null,
  label: 'A' | 'B',
  color: string,
): void {
  if (!probe) return;

  const screenPoint = worldToScreen(probe, coordinateTransform);
  canvasContext.save();
  canvasContext.fillStyle = '#FFFFFF';
  canvasContext.strokeStyle = color;
  canvasContext.lineWidth = 2;
  canvasContext.beginPath();
  canvasContext.arc(screenPoint.x, screenPoint.y, 7, 0, Math.PI * 2);
  canvasContext.fill();
  canvasContext.stroke();
  drawTextLabel(canvasContext, label, { x: screenPoint.x, y: screenPoint.y - 18 }, {
    color,
    fontSize: 12,
    align: 'center',
  });
  canvasContext.restore();
}

function formatPotentialValue(value: number): string {
  if (!Number.isFinite(value)) {
    return value > 0 ? '+∞ V' : '-∞ V';
  }
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) {
    return `${value.toExponential(2)} V`;
  }
  return `${value.toFixed(abs >= 100 ? 1 : 2)} V`;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeVector(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-9) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function toVectorDirectionLabel(vector: Vec2): string {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? '向右' : '向左';
  }
  return vector.y >= 0 ? '向上' : '向下';
}
