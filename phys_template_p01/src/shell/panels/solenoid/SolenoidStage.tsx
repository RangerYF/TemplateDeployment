import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  buildSolenoidSceneGeometry,
  clamp,
  computeSolenoidCenterField,
  getTeachingStepDescription,
  sampleSolenoidField,
  sampleParticlePath,
  type TeachingStep,
  type Vec3,
} from '@/domains/em/logic/solenoid-teaching';
import type { SolenoidDisplayMode, SolenoidHoverSample, SolenoidViewMode } from '@/store/simulation-store';

interface SolenoidStageProps {
  current: number;
  turns: number;
  length: number;
  radius: number;
  directionSign: number;
  displayMode: SolenoidDisplayMode;
  viewMode: SolenoidViewMode;
  teachingStep: TeachingStep;
  hoverSample: SolenoidHoverSample | null;
  onHoverSample: (sample: SolenoidHoverSample | null) => void;
}

interface StageSize {
  width: number;
  height: number;
}

interface StageCamera {
  yawDeg: number;
  pitchDeg: number;
  zoom: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

interface CompassSpec {
  point: Vec3;
  id: string;
}

const OUTER_LOOP_STROKES = ['#A7C0E8', '#B8CBE7', '#C8D7EB'] as const;
const INNER_FIELD_COLOR = '#1E66D0';
const OUTER_FIELD_COLOR = '#9AB6DE';
const COIL_STROKE = '#C97D35';
const COIL_STROKE_LIGHT = '#E0A66B';

function getViewPreset(viewMode: SolenoidViewMode): StageCamera {
  switch (viewMode) {
    case 'front':
      return { yawDeg: 0, pitchDeg: 0, zoom: 1.12 };
    case 'side':
      return { yawDeg: 54, pitchDeg: 8, zoom: 1.06 };
    case 'section':
      return { yawDeg: 0, pitchDeg: 0, zoom: 1.18 };
    case 'orbit':
    default:
      return { yawDeg: -28, pitchDeg: 16, zoom: 1.04 };
  }
}

function rotatePoint(point: Vec3, camera: StageCamera): ProjectedPoint {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = (point.x * cosYaw) - (point.z * sinYaw);
  const z1 = (point.x * sinYaw) + (point.z * cosYaw);
  const y2 = (point.y * cosPitch) - (z1 * sinPitch);
  const z2 = (point.y * sinPitch) + (z1 * cosPitch);

  return {
    x: x1,
    y: y2,
    depth: z2,
  };
}

function getStageScale(size: StageSize, length: number, radius: number, camera: StageCamera): number {
  const widthSpan = (length * 1.28) + (radius * 0.82);
  const heightSpan = radius * 2.95;
  return Math.min(
    Math.max((size.width - 96) / Math.max(widthSpan, 1e-6), 56),
    Math.max((size.height - 132) / Math.max(heightSpan, 1e-6), 56),
  ) * camera.zoom;
}

function getStageCenter(size: StageSize): { x: number; y: number } {
  return {
    x: size.width * 0.52,
    y: size.height * 0.53,
  };
}

function projectPoint(
  point: Vec3,
  camera: StageCamera,
  size: StageSize,
  length: number,
  radius: number,
): ProjectedPoint {
  const rotated = rotatePoint(point, camera);
  const scale = getStageScale(size, length, radius, camera);
  const center = getStageCenter(size);
  return {
    x: center.x + (rotated.x * scale),
    y: center.y - (rotated.y * scale),
    depth: rotated.depth,
  };
}

function unprojectPlanePoint(
  screenX: number,
  screenY: number,
  camera: StageCamera,
  size: StageSize,
  length: number,
  radius: number,
): Vec3 {
  const center = getStageCenter(size);
  const scale = getStageScale(size, length, radius, camera);
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const safeCosYaw = Math.abs(cosYaw) < 1e-3 ? (cosYaw < 0 ? -1e-3 : 1e-3) : cosYaw;
  const safeCosPitch = Math.abs(cosPitch) < 1e-3 ? (cosPitch < 0 ? -1e-3 : 1e-3) : cosPitch;

  const x1 = (screenX - center.x) / scale;
  const y2 = (center.y - screenY) / scale;
  const x = x1 / safeCosYaw;
  const y = (y2 + (x * sinYaw * Math.sin(pitch))) / safeCosPitch;
  return { x, y, z: 0 };
}

function buildPath(points: ProjectedPoint[], closed: boolean = false): string {
  if (points.length === 0) return '';
  const commands = points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  if (closed) commands.push('Z');
  return commands.join(' ');
}

function floatArrayToVec3List(values: Float32Array): Vec3[] {
  const points: Vec3[] = [];
  for (let index = 0; index < values.length; index += 3) {
    points.push({
      x: values[index] ?? 0,
      y: values[index + 1] ?? 0,
      z: values[index + 2] ?? 0,
    });
  }
  return points;
}

function averageDepth(points: ProjectedPoint[]): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, point) => sum + point.depth, 0) / points.length;
}

function buildArrowSample(points: Vec3[], progress: number): { start: Vec3; end: Vec3 } | null {
  if (points.length < 3) return null;

  const normalized = ((progress % 1) + 1) % 1;
  const maxIndex = points.length - 2;
  const tailIndex = Math.max(0, Math.min(maxIndex - 1, Math.floor(maxIndex * normalized)));
  const start = points[tailIndex];
  const end = points[tailIndex + 1];
  if (!start || !end) return null;

  return { start, end };
}

function rgbaFromTuple(
  color: readonly [number, number, number, number],
  alphaMultiplier: number = 1,
): string {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${Math.max(0, Math.min(color[3] * alphaMultiplier, 1)).toFixed(3)})`;
}

function buildRing(x: number, radius: number, segments: number = 52): Vec3[] {
  const points: Vec3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * Math.PI * 2;
    points.push({
      x,
      y: radius * Math.cos(theta),
      z: radius * Math.sin(theta),
    });
  }
  return points;
}

function buildCoilRingCenters(turns: number, length: number, teachingStep: TeachingStep): number[] {
  const ringCount = teachingStep === 1
    ? 1
    : teachingStep === 2
      ? clamp(Math.round(turns / 140), 4, 6)
      : clamp(Math.round(turns / 90), 9, 14);
  if (ringCount === 1) return [0];
  return Array.from({ length: ringCount }, (_, index) =>
    -length / 2 + ((length * index) / Math.max(ringCount - 1, 1)));
}

function buildInternalArrowLines(
  length: number,
  radius: number,
  directionSign: number,
  teachingStep: TeachingStep,
  currentNormalized: number,
): Array<{
  start: Vec3;
  end: Vec3;
}> {
  let offsets: number[];
  if (teachingStep === 1) {
    offsets = currentNormalized > 0.68 ? [-0.12, 0.12] : [0];
  } else if (teachingStep === 2) {
    offsets = currentNormalized > 0.72
      ? [-0.28, -0.1, 0.1, 0.28]
      : [-0.2, 0, 0.2];
  } else {
    offsets = currentNormalized > 0.72
      ? [-0.38, -0.18, 0, 0.18, 0.38]
      : currentNormalized > 0.28
        ? [-0.26, -0.08, 0.08, 0.26]
        : [-0.22, 0, 0.22];
  }

  return offsets.map((offset, index) => {
    const depth = ((index % 2 === 0) ? -0.08 : 0.08) * radius;
    const startX = directionSign > 0 ? -length * 0.4 : length * 0.4;
    const endX = -startX;
    return {
      start: { x: startX, y: offset * radius, z: depth },
      end: { x: endX, y: offset * radius, z: depth },
    };
  });
}

function buildCompassSpecs(length: number, radius: number): CompassSpec[] {
  return [
    { id: 'compass-center-left', point: { x: -length * 0.24, y: 0, z: 0 } },
    { id: 'compass-center', point: { x: 0, y: 0, z: 0 } },
    { id: 'compass-center-right', point: { x: length * 0.24, y: 0, z: 0 } },
    { id: 'compass-left-top', point: { x: -length * 0.72, y: radius * 1.08, z: 0 } },
    { id: 'compass-left-bottom', point: { x: -length * 0.72, y: -radius * 1.08, z: 0 } },
    { id: 'compass-right-top', point: { x: length * 0.72, y: radius * 1.08, z: 0 } },
    { id: 'compass-right-bottom', point: { x: length * 0.72, y: -radius * 1.08, z: 0 } },
    { id: 'compass-return-top', point: { x: 0, y: radius * 1.65, z: 0 } },
    { id: 'compass-return-bottom', point: { x: 0, y: -radius * 1.65, z: 0 } },
  ];
}

function normalizeVector(vector: Vec3): Vec3 {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude < 1e-8) {
    return { x: 1, y: 0, z: 0 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

function formatMilliTesla(valueTesla: number): string {
  return `${(valueTesla * 1000).toFixed(2)} mT`;
}

export function SolenoidStage({
  current,
  turns,
  length,
  radius,
  directionSign,
  displayMode,
  viewMode,
  teachingStep,
  hoverSample,
  onHoverSample,
}: SolenoidStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const velocityRef = useRef({ yaw: 0, pitch: 0, zoom: 0 });
  const cameraRef = useRef<StageCamera>(getViewPreset(viewMode));
  const targetCameraRef = useRef<StageCamera>(getViewPreset(viewMode));
  const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
  const [frameTimeMs, setFrameTimeMs] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    targetCameraRef.current = getViewPreset(viewMode);
    if (viewMode !== 'orbit') {
      velocityRef.current = { yaw: 0, pitch: 0, zoom: 0 };
    }
  }, [viewMode]);

  useEffect(() => {
    let frameId = 0;
    let previousTime = 0;

    const tick = (time: number) => {
      const delta = previousTime === 0 ? 16.7 : time - previousTime;
      previousTime = time;
      const normalizedDt = Math.min(delta / 16.7, 2);

      const camera = cameraRef.current;
      const target = targetCameraRef.current;
      const velocity = velocityRef.current;

      if (!dragRef.current.active) {
        camera.yawDeg += velocity.yaw * normalizedDt;
        camera.pitchDeg += velocity.pitch * normalizedDt;
        camera.zoom += velocity.zoom * normalizedDt;

        velocity.yaw *= 0.9;
        velocity.pitch *= 0.9;
        velocity.zoom *= 0.78;

        camera.yawDeg += (target.yawDeg - camera.yawDeg) * 0.12;
        camera.pitchDeg += (target.pitchDeg - camera.pitchDeg) * 0.14;
        camera.zoom += (target.zoom - camera.zoom) * 0.16;
      }

      camera.yawDeg = clamp(camera.yawDeg, -72, 72);
      camera.pitchDeg = clamp(camera.pitchDeg, -24, 28);
      camera.zoom = clamp(camera.zoom, 0.84, 1.3);

      setFrameTimeMs(time);
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const camera: StageCamera = {
    yawDeg: cameraRef.current.yawDeg,
    pitchDeg: cameraRef.current.pitchDeg,
    zoom: cameraRef.current.zoom,
  };
  const centerField = useMemo(() => computeSolenoidCenterField(current, turns, length), [current, turns, length]);
  const currentNormalized = clamp((current - 0.5) / 9.5, 0, 1);
  const timeSeconds = frameTimeMs * 0.001;
  const showVolumeShading = displayMode === 'volume';
  const sceneGeometry = useMemo(
    () => buildSolenoidSceneGeometry({
      current,
      turns,
      length,
      radius,
      directionSign,
      displayMode,
      teachingStep,
      quality: 1,
    }),
    [current, turns, length, radius, directionSign, displayMode, teachingStep],
  );

  const ringCenters = useMemo(
    () => buildCoilRingCenters(turns, length * 0.9, teachingStep),
    [turns, length, teachingStep],
  );
  const internalArrows = useMemo(
    () => buildInternalArrowLines(length, radius, directionSign, teachingStep, currentNormalized),
    [length, radius, directionSign, teachingStep, currentNormalized],
  );
  const compassSpecs = useMemo(() => buildCompassSpecs(length, radius), [length, radius]);

  const projectedRings = useMemo(() => {
    return ringCenters
      .map((centerX) => {
        const projected = buildRing(centerX, radius, 58).map((point) =>
          projectPoint(point, camera, stageSize, length, radius));
        const averageDepth = projected.reduce((sum, point) => sum + point.depth, 0) / Math.max(projected.length, 1);
        return {
          key: `ring-${centerX.toFixed(3)}`,
          path: buildPath(projected),
          averageDepth,
        };
      })
      .sort((left, right) => left.averageDepth - right.averageDepth);
  }, [ringCenters, radius, camera.yawDeg, camera.pitchDeg, camera.zoom, stageSize, length]);

  const projectedOuterLoops = useMemo(() => {
    const depthThreshold = viewMode === 'section' ? radius * 0.24 : radius * 0.56;
    const lineStride = displayMode === 'textbook' ? 2 : 1;
    return sceneGeometry.fieldLines
      .filter((line, index) => {
        const depth = Math.abs(line.positions[2] ?? 0);
        return depth <= depthThreshold && index % lineStride === 0;
      })
      .map((line, index) => {
        const points = floatArrayToVec3List(line.positions);
        const projected = points.map((point) =>
          projectPoint(point, camera, stageSize, length, radius));
        const arrowSample = buildArrowSample(points, 0.16 + ((index % 5) * 0.12));
        return {
          id: `outer-loop-${index}`,
          path: buildPath(projected),
          arrowStart: arrowSample
            ? projectPoint(arrowSample.start, camera, stageSize, length, radius)
            : null,
          arrowEnd: arrowSample
            ? projectPoint(arrowSample.end, camera, stageSize, length, radius)
            : null,
          color: OUTER_LOOP_STROKES[index % OUTER_LOOP_STROKES.length] ?? OUTER_FIELD_COLOR,
          width: Math.max(1.1, 1.15 + (line.averageStrength * 1.35)),
          opacity: clamp(0.16 + (line.averageStrength * 0.34), 0.18, 0.54),
          averageDepth: averageDepth(projected),
        };
      })
      .sort((left, right) => left.averageDepth - right.averageDepth);
  }, [
    sceneGeometry,
    viewMode,
    displayMode,
    radius,
    camera.yawDeg,
    camera.pitchDeg,
    camera.zoom,
    stageSize,
    length,
  ]);

  const projectedInternalArrows = useMemo(() => {
    return internalArrows.map((arrow, index) => ({
      id: `internal-arrow-${index}`,
      start: projectPoint(arrow.start, camera, stageSize, length, radius),
      end: projectPoint(arrow.end, camera, stageSize, length, radius),
    }));
  }, [internalArrows, camera.yawDeg, camera.pitchDeg, camera.zoom, stageSize, length, radius]);

  const compassRenderData = useMemo(() => {
    return compassSpecs.map((spec) => {
      const sample = sampleSolenoidField(spec.point, {
        current,
        turns,
        length,
        radius,
        directionSign,
        teachingStep,
      });
      const normalized = normalizeVector(sample.vector);
      const base = projectPoint(spec.point, camera, stageSize, length, radius);
      const tip = projectPoint({
        x: spec.point.x + (normalized.x * 0.28),
        y: spec.point.y + (normalized.y * 0.28),
        z: spec.point.z + (normalized.z * 0.28),
      }, camera, stageSize, length, radius);
      const angleDeg = (Math.atan2(tip.y - base.y, tip.x - base.x) * 180) / Math.PI;

      return {
        id: spec.id,
        screen: base,
        angleDeg,
      };
    });
  }, [compassSpecs, current, turns, length, radius, directionSign, teachingStep, camera.yawDeg, camera.pitchDeg, camera.zoom, stageSize]);

  const fieldParticles = useMemo(() => {
    if (displayMode !== 'particles') return [];

    const scale = getStageScale(stageSize, length, radius, camera);
    return sceneGeometry.particleSeeds
      .map((seed, index) => {
        const path = sceneGeometry.particlePaths[seed.pathIndex];
        if (!path) return null;

        const point = sampleParticlePath(path, (timeSeconds * 0.22) + seed.offset);
        const screen = projectPoint(point, camera, stageSize, length, radius);
        return {
          id: `field-particle-${index}`,
          screen,
          radius: Math.max(2.2, scale * seed.size * 0.36),
          opacity: seed.alpha,
          fill: path.averageStrength > 0.7 ? INNER_FIELD_COLOR : OUTER_FIELD_COLOR,
        };
      })
      .filter((particle): particle is NonNullable<typeof particle> => particle != null)
      .sort((left, right) => left.screen.depth - right.screen.depth);
  }, [
    displayMode,
    sceneGeometry,
    timeSeconds,
    stageSize,
    length,
    radius,
    camera,
  ]);

  const projectedVolumeSprites = useMemo(() => {
    if (!showVolumeShading) return [];

    const scale = getStageScale(stageSize, length, radius, camera);
    return sceneGeometry.volumeSprites
      .map((sprite, index) => {
        const screen = projectPoint(sprite.center, camera, stageSize, length, radius);
        return {
          id: `volume-sprite-${index}`,
          x: screen.x,
          y: screen.y,
          depth: screen.depth,
          radius: Math.max(1.6, scale * sprite.size * 0.44),
          fill: rgbaFromTuple(sprite.color, 0.92),
          opacity: clamp(0.08 + (sprite.intensity * 0.22), 0.08, 0.4),
        };
      })
      .sort((left, right) => left.depth - right.depth);
  }, [
    showVolumeShading,
    sceneGeometry,
    stageSize,
    length,
    radius,
    camera,
  ]);

  const updateHoverSample = (clientX: number, clientY: number) => {
    if (!containerRef.current || stageSize.width <= 0 || stageSize.height <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const world = unprojectPlanePoint(clientX - rect.left, clientY - rect.top, camera, stageSize, length, radius);
    const bounded = {
      x: clamp(world.x, -length * 0.95, length * 0.95),
      y: clamp(world.y, -radius * 2.3, radius * 2.3),
      z: 0,
    };
    const sample = sampleSolenoidField(bounded, {
      current,
      turns,
      length,
      radius,
      directionSign,
      teachingStep,
    });

    onHoverSample({
      x: bounded.x,
      y: bounded.y,
      z: bounded.z,
      magnitude: sample.magnitude,
      directionLabel: sample.directionLabel,
      screenX: clientX - rect.left,
      screenY: clientY - rect.top,
      region: sample.region,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    targetCameraRef.current = { ...cameraRef.current };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateHoverSample(event.clientX, event.clientY);
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;

    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;

    cameraRef.current.yawDeg += dx * 0.22;
    cameraRef.current.pitchDeg = clamp(cameraRef.current.pitchDeg - (dy * 0.14), -24, 28);
    targetCameraRef.current = { ...cameraRef.current };
    velocityRef.current.yaw = dx * 0.006;
    velocityRef.current.pitch = -dy * 0.0045;

    dragRef.current.x = event.clientX;
    dragRef.current.y = event.clientY;
  };

  const stopDragging = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    stopDragging();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoomDelta = event.deltaY * -0.0009;
    cameraRef.current.zoom = clamp(cameraRef.current.zoom + zoomDelta, 0.84, 1.3);
    targetCameraRef.current.zoom = cameraRef.current.zoom;
    velocityRef.current.zoom = zoomDelta * 0.2;
  };

  const hoverCardLeft = hoverSample
    ? clamp(hoverSample.screenX + 18, 18, Math.max(stageSize.width - 220, 18))
    : 18;
  const hoverCardTop = hoverSample
    ? clamp(hoverSample.screenY + 18, 18, Math.max(stageSize.height - 126, 18))
    : 18;

  const internalLabelAnchor = projectPoint({ x: length * 0.28, y: radius * 0.14, z: 0 }, camera, stageSize, length, radius);
  const outerLabelAnchor = projectPoint({ x: 0, y: radius * 2.05, z: 0 }, camera, stageSize, length, radius);
  const solenoidLabelAnchor = projectPoint({ x: -length * 0.14, y: -radius * 1.18, z: radius * 0.6 }, camera, stageSize, length, radius);

  const sectionShadeOpacity = viewMode === 'section'
    ? 0.18 + (currentNormalized * 0.16)
    : showVolumeShading
      ? 0.12 + (currentNormalized * 0.12)
      : 0.06 + (currentNormalized * 0.1);
  const internalArrowStrokeWidth = 2.1 + (currentNormalized * 1.5);
  const internalArrowOpacity = 0.68 + (currentNormalized * 0.28);
  const outerLoopOpacity = 0.46 + (currentNormalized * 0.34);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={stopDragging}
      onPointerLeave={() => {
        stopDragging();
        onHoverSample(null);
      }}
      onWheel={handleWheel}
      style={{
        position: 'relative',
        minHeight: 660,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 28,
        cursor: isDragging ? 'grabbing' : 'grab',
        background: 'linear-gradient(180deg, #FCFDFE 0%, #F4F7FB 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(142,156,180,0.12) 1px, transparent 0),
            linear-gradient(180deg, rgba(223,231,242,0.28), transparent 22%)
          `,
          backgroundSize: '24px 24px, 100% 100%',
          pointerEvents: 'none',
        }}
      />

      <svg
        viewBox={`0 0 ${Math.max(stageSize.width, 1)} ${Math.max(stageSize.height, 1)}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <marker id="solenoid-inner-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
            <path d="M0,1 L8,5 L0,9 Z" fill={INNER_FIELD_COLOR} />
          </marker>
          <marker id="solenoid-outer-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <path d="M0,0 L7,4.5 L0,9 Z" fill={OUTER_FIELD_COLOR} />
          </marker>
          <linearGradient id="solenoid-body-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F6D1A6" />
            <stop offset="58%" stopColor="#E3A765" />
            <stop offset="100%" stopColor="#C97D35" />
          </linearGradient>
          <linearGradient id="solenoid-inside-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`rgba(66, 133, 244, ${sectionShadeOpacity * 0.55})`} />
            <stop offset="50%" stopColor={`rgba(66, 133, 244, ${sectionShadeOpacity})`} />
            <stop offset="100%" stopColor={`rgba(66, 133, 244, ${sectionShadeOpacity * 0.55})`} />
          </linearGradient>
        </defs>

        {projectedOuterLoops.map((loop) => (
          <path
            key={loop.id}
            d={loop.path}
            fill="none"
            stroke={loop.color}
            strokeWidth={loop.width}
            opacity={loop.opacity * outerLoopOpacity}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {projectedOuterLoops.map((loop) => (
          <line
            key={`${loop.id}-arrow`}
            x1={loop.arrowStart?.x ?? 0}
            y1={loop.arrowStart?.y ?? 0}
            x2={loop.arrowEnd?.x ?? 0}
            y2={loop.arrowEnd?.y ?? 0}
            stroke={OUTER_FIELD_COLOR}
            strokeWidth={1.8}
            opacity={Math.min(loop.opacity * outerLoopOpacity * 1.12, 0.7)}
            markerEnd="url(#solenoid-outer-arrow)"
          />
        ))}

        {showVolumeShading && (
          projectedVolumeSprites.map((sprite) => (
            <circle
              key={sprite.id}
              cx={sprite.x}
              cy={sprite.y}
              r={sprite.radius}
              fill={sprite.fill}
              opacity={sprite.opacity}
            />
          ))
        )}

        {!showVolumeShading && (
          <ellipse
            cx={getStageCenter(stageSize).x}
            cy={getStageCenter(stageSize).y}
            rx={Math.max(getStageScale(stageSize, length, radius, camera) * length * 0.39, 10)}
            ry={Math.max(getStageScale(stageSize, length, radius, camera) * radius * 0.46, 10)}
            fill={`rgba(67, 126, 223, ${sectionShadeOpacity})`}
          />
        )}

        {projectedRings.map((ring, index) => (
          <path
            key={ring.key}
            d={ring.path}
            fill="none"
            stroke={index % 2 === 0 ? COIL_STROKE : COIL_STROKE_LIGHT}
            strokeWidth={3.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {projectedInternalArrows.map((arrow) => (
          <line
            key={arrow.id}
            x1={arrow.start.x}
            y1={arrow.start.y}
            x2={arrow.end.x}
            y2={arrow.end.y}
            stroke={INNER_FIELD_COLOR}
            strokeWidth={internalArrowStrokeWidth}
            opacity={internalArrowOpacity}
            strokeLinecap="round"
            markerEnd="url(#solenoid-inner-arrow)"
          />
        ))}

        {fieldParticles.map((particle) => (
          <circle
            key={particle.id}
            cx={particle.screen.x}
            cy={particle.screen.y}
            r={particle.radius}
            fill={particle.fill}
            opacity={particle.opacity}
          />
        ))}

        {compassRenderData.map((compass) => (
          <g
            key={compass.id}
            transform={`translate(${compass.screen.x.toFixed(1)} ${compass.screen.y.toFixed(1)}) rotate(${compass.angleDeg.toFixed(1)})`}
          >
            <ellipse cx="0" cy="0" rx="15" ry="9.5" fill="#FFFFFF" stroke="#95A4BB" strokeWidth="1.2" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke="#26466F" strokeWidth="1.4" />
            <line x1="0" y1="0" x2="8" y2="0" stroke="#D25555" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="1.8" fill="#26466F" />
          </g>
        ))}

        <g>
          <line
            x1={outerLabelAnchor.x}
            y1={outerLabelAnchor.y}
            x2={Math.max(outerLabelAnchor.x - 92, 22)}
            y2={Math.max(outerLabelAnchor.y - 54, 26)}
            stroke="#9CB2D1"
            strokeWidth="1.2"
          />
          <rect
            x={Math.max(outerLabelAnchor.x - 238, 14)}
            y={Math.max(outerLabelAnchor.y - 94, 12)}
            width="196"
            height="52"
            rx="12"
            fill="rgba(255,255,255,0.86)"
            stroke="rgba(188,201,222,0.9)"
          />
          <text x={Math.max(outerLabelAnchor.x - 226, 24)} y={Math.max(outerLabelAnchor.y - 72, 30)} fill="#4E6E98" fontSize="12" fontWeight="700">
            外部磁场较弱，形成闭合回路
          </text>
          <text x={Math.max(outerLabelAnchor.x - 226, 24)} y={Math.max(outerLabelAnchor.y - 54, 48)} fill="#7A8BA4" fontSize="11">
            线条更细、更疏，方向与内部主场相反返回
          </text>
        </g>

        <g>
          <line
            x1={internalLabelAnchor.x}
            y1={internalLabelAnchor.y}
            x2={Math.min(internalLabelAnchor.x + 108, Math.max(stageSize.width - 138, 108))}
            y2={Math.max(internalLabelAnchor.y - 56, 28)}
            stroke="#7EA1D8"
            strokeWidth="1.2"
          />
          <rect
            x={Math.min(internalLabelAnchor.x + 110, Math.max(stageSize.width - 244, 18))}
            y={Math.max(internalLabelAnchor.y - 92, 14)}
            width="210"
            height="58"
            rx="12"
            fill="rgba(255,255,255,0.88)"
            stroke="rgba(173,194,228,0.95)"
          />
          <text
            x={Math.min(internalLabelAnchor.x + 124, Math.max(stageSize.width - 230, 28))}
            y={Math.max(internalLabelAnchor.y - 68, 32)}
            fill={INNER_FIELD_COLOR}
            fontSize="12"
            fontWeight="700"
          >
            内部磁场（近似匀强）
          </text>
          <text
            x={Math.min(internalLabelAnchor.x + 124, Math.max(stageSize.width - 230, 28))}
            y={Math.max(internalLabelAnchor.y - 50, 50)}
            fill="#6F86A8"
            fontSize="11"
          >
            箭头平行、方向一致，B {directionSign > 0 ? '向右' : '向左'}
          </text>
        </g>

        <g>
          <line
            x1={solenoidLabelAnchor.x}
            y1={solenoidLabelAnchor.y}
            x2={Math.max(solenoidLabelAnchor.x - 66, 18)}
            y2={Math.min(solenoidLabelAnchor.y + 42, Math.max(stageSize.height - 40, 42))}
            stroke="#C9A07A"
            strokeWidth="1.1"
          />
          <text
            x={Math.max(solenoidLabelAnchor.x - 124, 18)}
            y={Math.min(solenoidLabelAnchor.y + 58, Math.max(stageSize.height - 22, 58))}
            fill="#A86B30"
            fontSize="12"
            fontWeight="700"
          >
            螺线管
          </text>
        </g>

        {hoverSample && (
          <circle
            cx={hoverSample.screenX}
            cy={hoverSample.screenY}
            r="7.5"
            fill="none"
            stroke={hoverSample.region === 'inside' ? INNER_FIELD_COLOR : '#7EA1D8'}
            strokeWidth="1.6"
          />
        )}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 18,
          top: 18,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(206,216,231,0.92)',
            color: '#5A7395',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          教材模式优先
        </div>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(206,216,231,0.92)',
            color: '#5A7395',
            fontSize: 12,
          }}
        >
          中心磁场 {formatMilliTesla(centerField)}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 18,
          top: 18,
          padding: '10px 12px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.82)',
          border: '1px solid rgba(206,216,231,0.92)',
          color: '#617B9D',
          fontSize: 12,
          lineHeight: 1.7,
          pointerEvents: 'none',
        }}
      >
        默认展示：斜侧前方教材视角
        <br />
        拖拽轻量旋转，滚轮缩放
      </div>

      <div
        style={{
          position: 'absolute',
          left: 18,
          bottom: 18,
          maxWidth: 330,
          padding: '12px 14px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.84)',
          border: '1px solid rgba(205,216,232,0.92)',
          color: '#697E9C',
          fontSize: 12,
          lineHeight: 1.75,
          pointerEvents: 'none',
        }}
      >
        {getTeachingStepDescription(teachingStep)}
      </div>

      {hoverSample && (
        <div
          style={{
            position: 'absolute',
            left: hoverCardLeft,
            top: hoverCardTop,
            minWidth: 198,
            padding: '12px 14px',
            borderRadius: 16,
            border: '1px solid rgba(196, 208, 227, 0.95)',
            background: 'rgba(255,255,255,0.94)',
            color: '#4E6787',
            pointerEvents: 'none',
            boxShadow: '0 18px 34px rgba(73, 92, 126, 0.10)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#6A83A6' }}>
            局部磁场采样
          </div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 760, color: INNER_FIELD_COLOR }}>
            {formatMilliTesla(hoverSample.magnitude)}
          </div>
          <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 12, lineHeight: 1.6 }}>
            <span>方向：{hoverSample.directionLabel}</span>
            <span>区域：{hoverSample.region === 'inside' ? 'inside' : 'outside'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
