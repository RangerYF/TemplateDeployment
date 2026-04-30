import { rendererRegistry } from '@/core/registries/renderer-registry';
import { FORCE_COLORS } from '@/core/visual-constants';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import { useSimulationStore } from '@/store/simulation-store';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, ForceAnalysis, MotionState, Vec2 } from '@/core/types';
import {
  ELECTROGRAVITY_DETACHED_FLAG,
  ELECTROGRAVITY_RELEASE_ANGLE_FLAG,
  ELECTROGRAVITY_RELEASE_POINT_FLAG,
  getCirclePosition,
  getCircleTangent,
  getElectrogravityCircleConfig,
  isElectrogravityCircleScene,
} from '../logic/electrogravity-circular-motion';
import { sampleMagneticFieldAtPoint } from '../logic/lorentz-force';
import { isDynamicPointCharge } from '../logic/point-charge-role';

const TRAJECTORY_COLOR = '#64748B';
const VELOCITY_COLOR = '#0EA5E9';
const MIN_ARROW_LENGTH = 20;
const MAX_ARROW_LENGTH = 120;
const EDGE_GAP = 0.02;
const MAX_TRAJECTORY_POINTS = 2400;

const motionViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'motion') return;
  const showTrajectory = useSimulationStore.getState().showTrajectory;

  const analysesByEntity = new Map<string, ForceAnalysis>();
  const efields = Array.from(entities.values()).filter((entity) => entity.type === 'uniform-efield');
  const bfields = Array.from(entities.values()).filter((entity) => entity.type === 'uniform-bfield');
  const emitters = Array.from(entities.values()).filter((entity) => entity.type === 'particle-emitter');
  const dynamicParticles = Array.from(entities.values()).filter(isDynamicPointCharge);
  for (const analysis of data.data.analyses ?? []) {
    analysesByEntity.set(analysis.entityId, analysis);
  }

  for (const motionState of data.data.motionStates) {
    const entity = entities.get(motionState.entityId);
    if (!entity) continue;

    if (isElectrogravityCircleScene(entity, efields[0])) {
      drawCircularTrackGuide(ctx.ctx, entity, efields[0]!, motionState, ctx.coordinateTransform);
    }

    if (
      showTrajectory &&
      dynamicParticles.length === 1 &&
      !isElectrogravityCircleScene(entity, efields[0]) &&
      bfields.length > 0
    ) {
      const magneticGuide = getMagneticCircularTrackGuide(entity, motionState, bfields);
      if (magneticGuide) {
        drawMagneticCircularTrackGuide(
          ctx.ctx,
          magneticGuide.center,
          magneticGuide.radius,
          ctx.coordinateTransform,
        );
      }
    }

    if (showTrajectory && motionState.trajectory && motionState.trajectory.length > 1) {
      drawTrajectory(ctx.ctx, motionState.trajectory, ctx.coordinateTransform);
    }

    const speed = Math.hypot(motionState.velocity.x, motionState.velocity.y);
    if (speed > 1e-6) {
      const velocityDirection = normalize(motionState.velocity);
      drawVectorArrow(
        ctx.ctx,
        motionState.position,
        velocityDirection,
        vectorLength(speed, 24),
        ctx.coordinateTransform,
        entity.properties.radius as number | undefined,
        VELOCITY_COLOR,
        `v=${speed.toFixed(2)}m/s`,
        false,
      );
    }

    const analysis = analysesByEntity.get(motionState.entityId);
    const electricForce = analysis?.forces.find((item) => item.type === 'electric');
    const magneticForce = analysis?.forces.find((item) => item.type === 'lorentz');
    const combinedFieldForces = Boolean(electricForce && magneticForce && efields.length > 0 && bfields.length > 0);

    if (combinedFieldForces && electricForce && magneticForce) {
      drawVectorArrow(
        ctx.ctx,
        motionState.position,
        electricForce.direction,
        vectorLength(electricForce.magnitude, 32),
        ctx.coordinateTransform,
        entity.properties.radius as number | undefined,
        FORCE_COLORS.electric,
        formatForceLabel('FE', electricForce.magnitude),
        false,
      );
      drawVectorArrow(
        ctx.ctx,
        motionState.position,
        magneticForce.direction,
        vectorLength(magneticForce.magnitude, 32),
        ctx.coordinateTransform,
        entity.properties.radius as number | undefined,
        FORCE_COLORS.lorentz,
        formatForceLabel('FB', magneticForce.magnitude),
        false,
      );

      if ((analysis?.resultant.magnitude ?? 0) <= 1e-6) {
        drawZeroResultantLabel(
          ctx.ctx,
          motionState.position,
          ctx.coordinateTransform,
          entity.properties.radius as number | undefined,
        );
      }
      continue;
    }

    const force =
      magneticForce ??
      electricForce ??
      analysis?.resultant;
    if (force && force.magnitude > 1e-6) {
      const label = force.type === 'electric'
        ? formatForceLabel('FE', force.magnitude)
        : force.type === 'lorentz'
          ? formatForceLabel('FB', force.magnitude)
          : formatForceLabel('F合', force.magnitude);
      drawVectorArrow(
        ctx.ctx,
        motionState.position,
        force.direction,
        vectorLength(force.magnitude, 32),
        ctx.coordinateTransform,
        entity.properties.radius as number | undefined,
        force.type === 'resultant' ? FORCE_COLORS.resultant : FORCE_COLORS[force.type],
        label,
        force.type === 'resultant',
      );
    }
  }

  const focusingEmitter = emitters.find(
    (entity) =>
      entity.properties.pattern === 'focusing' &&
      bfields.some((field) => field.properties.autoBoundaryMode === 'focusing-min-radius'),
  );
  if (showTrajectory && focusingEmitter) {
    drawFocusingGuide(
      ctx.ctx,
      focusingEmitter,
      ctx.coordinateTransform,
    );
  }
};

function drawCircularTrackGuide(
  canvasContext: CanvasRenderingContext2D,
  particle: import('@/core/types').Entity,
  field: import('@/core/types').Entity,
  motionState: MotionState,
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const config = getElectrogravityCircleConfig(particle, field);
  const particleProps = particle.properties as Record<string, unknown>;
  const detached = particleProps[ELECTROGRAVITY_DETACHED_FLAG] === true;
  const releasePoint = readVec2Like(particleProps[ELECTROGRAVITY_RELEASE_POINT_FLAG]);
  const releaseAngle = readNumberLike(particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG]);
  const center = worldToScreen(config.center, coordinateTransform);
  const screenRadius = config.radius * coordinateTransform.scale;
  const top = worldToScreen(getCirclePosition(config, Math.PI), coordinateTransform);
  const bottom = worldToScreen(getCirclePosition(config, 0), coordinateTransform);
  const ball = worldToScreen(motionState.position, coordinateTransform);

  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(100, 116, 139, 0.7)';
  canvasContext.lineWidth = 1.8;
  canvasContext.setLineDash([8, 5]);
  canvasContext.beginPath();
  canvasContext.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
  canvasContext.stroke();
  canvasContext.setLineDash([]);

  canvasContext.fillStyle = 'rgba(100, 116, 139, 0.9)';
  canvasContext.beginPath();
  canvasContext.arc(top.x, top.y, 3, 0, Math.PI * 2);
  canvasContext.arc(bottom.x, bottom.y, 3, 0, Math.PI * 2);
  canvasContext.arc(center.x, center.y, 4, 0, Math.PI * 2);
  canvasContext.fill();
  canvasContext.restore();

  canvasContext.save();
  canvasContext.strokeStyle = detached ? 'rgba(34, 197, 94, 0.46)' : 'rgba(34, 197, 94, 0.92)';
  canvasContext.lineWidth = detached ? 2 : 2.8;
  if (detached) {
    canvasContext.setLineDash([8, 5]);
  }
  canvasContext.beginPath();
  canvasContext.moveTo(center.x, center.y);
  const ropeEnd = detached && releasePoint
    ? worldToScreen(releasePoint, coordinateTransform)
    : ball;
  canvasContext.lineTo(ropeEnd.x, ropeEnd.y);
  canvasContext.stroke();
  canvasContext.setLineDash([]);
  canvasContext.restore();

  drawTextLabel(canvasContext, '最高点', { x: top.x, y: top.y - 16 }, {
    color: '#475569',
    fontSize: 11,
    align: 'center',
  });
  drawTextLabel(canvasContext, '最低点', { x: bottom.x, y: bottom.y + 18 }, {
    color: '#475569',
    fontSize: 11,
    align: 'center',
  });
  drawTextLabel(canvasContext, '固定点', { x: center.x + 22, y: center.y - 14 }, {
    color: '#475569',
    fontSize: 11,
    align: 'left',
  });

  if (detached && releasePoint) {
    const releaseScreen = worldToScreen(releasePoint, coordinateTransform);
    const tangent = releaseAngle != null
      ? getCircleTangent(releaseAngle)
      : normalize(motionState.velocity);
    const tangentEnd = {
      x: releaseScreen.x + tangent.x * 34,
      y: releaseScreen.y - tangent.y * 34,
    };

    canvasContext.save();
    canvasContext.fillStyle = '#0EA5E9';
    canvasContext.beginPath();
    canvasContext.arc(releaseScreen.x, releaseScreen.y, 4, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();

    drawArrow(canvasContext, releaseScreen, tangentEnd, {
      color: '#0EA5E9',
      lineWidth: 2.2,
      arrowHeadSize: 9,
      dashed: true,
    });
    drawTextLabel(canvasContext, '脱离点 / 切线方向', {
      x: tangentEnd.x + tangent.x * 10,
      y: tangentEnd.y - tangent.y * 8,
    }, {
      color: '#0EA5E9',
      fontSize: 11,
      align: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: 4,
    });
    return;
  }

  drawTextLabel(canvasContext, '绳处于拉紧约束', {
    x: center.x + 40,
    y: center.y + screenRadius + 16,
  }, {
    color: '#16A34A',
    fontSize: 11,
    align: 'left',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    padding: 4,
  });
}

function drawMagneticCircularTrackGuide(
  canvasContext: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const screenCenter = worldToScreen(center, coordinateTransform);
  const screenRadius = radius * coordinateTransform.scale;

  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(100, 116, 139, 0.55)';
  canvasContext.lineWidth = 1.4;
  canvasContext.setLineDash([6, 5]);
  canvasContext.beginPath();
  canvasContext.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
  canvasContext.stroke();
  canvasContext.setLineDash([]);
  canvasContext.restore();
}

function drawVectorArrow(
  canvasContext: CanvasRenderingContext2D,
  center: Vec2,
  direction: Vec2,
  length: number,
  coordinateTransform: { scale: number; origin: Vec2 },
  radius: number | undefined,
  color: string,
  label: string,
  dashed: boolean,
): void {
  const start = getEdgeStart(center, direction, radius);
  const screenStart = worldToScreen(start, coordinateTransform);
  const screenEnd = {
    x: screenStart.x + direction.x * length,
    y: screenStart.y - direction.y * length,
  };

  drawArrow(canvasContext, screenStart, screenEnd, {
    color,
    lineWidth: dashed ? 2 : 2.5,
    arrowHeadSize: dashed ? 9 : 10,
    dashed,
  });

  drawTextLabel(
    canvasContext,
    label,
    {
      x: screenEnd.x + direction.x * 10,
      y: screenEnd.y - direction.y * 10 - 8,
    },
    {
      color,
      fontSize: 11,
      align: 'center',
    },
  );
}

function drawZeroResultantLabel(
  canvasContext: CanvasRenderingContext2D,
  center: Vec2,
  coordinateTransform: { scale: number; origin: Vec2 },
  radius: number | undefined,
): void {
  const screenCenter = worldToScreen(center, coordinateTransform);
  const offset = ((radius ?? 0.12) * coordinateTransform.scale) + 28;
  drawTextLabel(
    canvasContext,
    '合力 = 0',
    {
      x: screenCenter.x + offset,
      y: screenCenter.y - offset * 0.55,
    },
    {
      color: FORCE_COLORS.resultant,
      fontSize: 11,
      align: 'left',
    },
  );
}

function drawFocusingGuide(
  canvasContext: CanvasRenderingContext2D,
  emitter: Entity,
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const source = emitter.transform.position;
  const launchAngleDeg = Number(emitter.properties.launchAngleDeg ?? 0);
  const focusDistance = Number(emitter.properties.focusDistance ?? 0);
  if (!Number.isFinite(focusDistance) || focusDistance <= 0) return;

  const radians = (launchAngleDeg * Math.PI) / 180;
  const focus = {
    x: source.x + (Math.cos(radians) * focusDistance),
    y: source.y + (Math.sin(radians) * focusDistance),
  };
  const sourceScreen = worldToScreen(source, coordinateTransform);
  const focusScreen = worldToScreen(focus, coordinateTransform);

  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(14, 165, 233, 0.42)';
  canvasContext.lineWidth = 1.2;
  canvasContext.setLineDash([7, 5]);
  canvasContext.beginPath();
  canvasContext.moveTo(sourceScreen.x, sourceScreen.y);
  canvasContext.lineTo(focusScreen.x, focusScreen.y);
  canvasContext.stroke();
  canvasContext.setLineDash([]);

  canvasContext.fillStyle = '#0EA5E9';
  canvasContext.beginPath();
  canvasContext.arc(focusScreen.x, focusScreen.y, 4, 0, Math.PI * 2);
  canvasContext.fill();
  canvasContext.restore();

  drawTextLabel(canvasContext, '焦点', {
    x: focusScreen.x + 18,
    y: focusScreen.y - 14,
  }, {
    color: '#0F766E',
    fontSize: 11,
    align: 'left',
  });
}

function drawTrajectory(
  canvasContext: CanvasRenderingContext2D,
  trajectory: Vec2[],
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const points = trajectory.length > MAX_TRAJECTORY_POINTS
    ? trajectory.slice(trajectory.length - MAX_TRAJECTORY_POINTS)
    : trajectory;

  if (points.length < 2) return;

  canvasContext.save();
  canvasContext.strokeStyle = TRAJECTORY_COLOR;
  canvasContext.lineWidth = 1.4;
  canvasContext.globalAlpha = 0.82;
  canvasContext.beginPath();

  const firstPoint = worldToScreen(points[0]!, coordinateTransform);
  canvasContext.moveTo(firstPoint.x, firstPoint.y);

  for (let index = 1; index < points.length; index += 1) {
    const point = worldToScreen(points[index]!, coordinateTransform);
    canvasContext.lineTo(point.x, point.y);
  }

  canvasContext.stroke();
  canvasContext.restore();
}

function getMagneticCircularTrackGuide(
  particle: Entity,
  motionState: MotionState,
  bfields: Entity[],
): { center: Vec2; radius: number } | null {
  if (particle.type !== 'point-charge' || bfields.length !== 1) return null;

  const field = bfields[0]!;
  if ((field.properties.boundaryShape as string | undefined) != null) return null;

  const charge = Number(particle.properties.charge ?? 0);
  const mass = Math.max(Number(particle.properties.mass ?? 0), 1e-6);
  const speed = Math.hypot(motionState.velocity.x, motionState.velocity.y);
  if (Math.abs(charge) < 1e-9 || speed < 1e-9) return null;

  const fieldSample = sampleMagneticFieldAtPoint(motionState.position, [field]);
  if (!fieldSample.inField || fieldSample.magnitude < 1e-9) return null;

  const forceDirection = normalize({
    x: charge * motionState.velocity.y * fieldSample.signedBz,
    y: -charge * motionState.velocity.x * fieldSample.signedBz,
  });
  if (Math.hypot(forceDirection.x, forceDirection.y) < 1e-9) return null;

  const radius = (mass * speed) / (Math.abs(charge) * fieldSample.magnitude);
  if (!Number.isFinite(radius) || radius <= 0.02) return null;

  const center = {
    x: motionState.position.x + forceDirection.x * radius,
    y: motionState.position.y + forceDirection.y * radius,
  };

  const fieldLeft = field.transform.position.x;
  const fieldBottom = field.transform.position.y;
  const fieldRight = fieldLeft + Number(field.properties.width ?? 0);
  const fieldTop = fieldBottom + Number(field.properties.height ?? 0);
  const margin = 0.02;

  if (
    center.x - radius < fieldLeft + margin ||
    center.x + radius > fieldRight - margin ||
    center.y - radius < fieldBottom + margin ||
    center.y + radius > fieldTop - margin
  ) {
    return null;
  }

  return { center, radius };
}

function getEdgeStart(center: Vec2, direction: Vec2, radius?: number): Vec2 {
  if (radius == null || radius <= 0) return center;

  return {
    x: center.x + direction.x * (radius + EDGE_GAP),
    y: center.y + direction.y * (radius + EDGE_GAP),
  };
}

function normalize(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-9) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function readVec2Like(value: unknown): Vec2 | null {
  if (!value || typeof value !== 'object' || !('x' in value) || !('y' in value)) {
    return null;
  }
  const x = readNumberLike((value as { x?: unknown }).x);
  const y = readNumberLike((value as { y?: unknown }).y);
  if (x == null || y == null) return null;
  return { x, y };
}

function readNumberLike(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function vectorLength(magnitude: number, factor: number): number {
  if (magnitude <= 0) return 0;
  const scaled = MIN_ARROW_LENGTH + Math.log10(1 + magnitude * factor) * 34;
  return Math.max(MIN_ARROW_LENGTH, Math.min(MAX_ARROW_LENGTH, scaled));
}

function formatForceLabel(symbol: string, magnitude: number): string {
  const digits = magnitude >= 1 ? 2 : 3;
  return `${symbol}=${magnitude.toFixed(digits)}N`;
}

export function registerMotionViewport(): void {
  rendererRegistry.registerViewport('motion', motionViewportRenderer);
}
