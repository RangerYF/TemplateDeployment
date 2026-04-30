import type { Entity, ParamValues } from '@/core/types';
import type { SolenoidDisplayMode, SolenoidViewMode } from '@/store/simulation-store';
import { getSolenoidFieldDirection } from './current-direction';

export const SOLENOID_BFIELD_PRESET_ID = 'P02-EMF023-solenoid-bfield';
export const MU0 = 4 * Math.PI * 1e-7;

export type TeachingStep = 1 | 2 | 3;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SolenoidFieldSample {
  vector: Vec3;
  magnitude: number;
  strengthNormalized: number;
  inside: boolean;
  region: 'inside' | 'outside';
  directionLabel: string;
}

export interface SolenoidFieldLine {
  positions: Float32Array;
  colors: Float32Array;
  averageStrength: number;
}

export interface SolenoidParticlePath {
  positions: Vec3[];
  travelTimes: number[];
  totalTime: number;
  averageStrength: number;
  color: [number, number, number, number];
}

export interface SolenoidParticleSeed {
  pathIndex: number;
  offset: number;
  size: number;
  alpha: number;
}

export interface SolenoidVolumeSprite {
  center: Vec3;
  size: number;
  color: [number, number, number, number];
  intensity: number;
}

export interface SolenoidSectionCell {
  point: Vec3;
  magnitude: number;
  strengthNormalized: number;
  region: 'inside' | 'outside';
}

export interface SolenoidSectionArrow {
  point: Vec3;
  vector: Vec3;
  magnitude: number;
  region: 'inside' | 'outside';
}

export interface MeshGeometry {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
}

export interface SolenoidSceneGeometry {
  cylinder: MeshGeometry;
  helixPositions: Float32Array;
  helixColors: Float32Array;
  fieldLines: SolenoidFieldLine[];
  particlePaths: SolenoidParticlePath[];
  particleSeeds: SolenoidParticleSeed[];
  volumeSprites: SolenoidVolumeSprite[];
  sectionCells: SolenoidSectionCell[];
  sectionArrows: SolenoidSectionArrow[];
  centerField: number;
  uniformity: number;
  visibleTurns: number;
  bounds: {
    halfLength: number;
    radius: number;
  };
}

export interface SolenoidBuildOptions {
  current: number;
  turns: number;
  length: number;
  radius: number;
  directionSign: number;
  displayMode: SolenoidDisplayMode;
  teachingStep: TeachingStep;
  quality: number;
}

export interface OrbitCameraPreset {
  yawDeg: number;
  pitchDeg: number;
  distance: number;
}

interface TeachingProfile {
  visibleTurns: number;
  fieldBlend: number;
  uniformityBlend: number;
  lineCountPerSide: number;
  depthLayers: number[];
  particleDensity: number;
  volumeDensity: number;
}

const COPPER_LIGHT: [number, number, number, number] = [1.0, 0.86, 0.62, 0.96];
const COPPER_DARK: [number, number, number, number] = [0.73, 0.39, 0.12, 0.98];
const FIELD_STRONG: [number, number, number, number] = [0.12, 0.56, 1.0, 0.98];
const FIELD_SOFT: [number, number, number, number] = [0.59, 0.82, 1.0, 0.34];
const FIELD_VOLUME_CORE: [number, number, number, number] = [0.66, 0.88, 1.0, 0.52];
const FIELD_VOLUME_EDGE: [number, number, number, number] = [0.08, 0.37, 0.92, 0.16];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - (2 * t));
}

function mixColor(
  start: [number, number, number, number],
  end: [number, number, number, number],
  t: number,
): [number, number, number, number] {
  return [
    lerp(start[0], end[0], t),
    lerp(start[1], end[1], t),
    lerp(start[2], end[2], t),
    lerp(start[3], end[3], t),
  ];
}

function pushColor(target: number[], color: [number, number, number, number]): void {
  target.push(color[0], color[1], color[2], color[3]);
}

function pushVec3(target: number[], point: Vec3): void {
  target.push(point.x, point.y, point.z);
}

function bezierPoint(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const it = 1 - t;
  const b0 = it * it * it;
  const b1 = 3 * it * it * t;
  const b2 = 3 * it * t * t;
  const b3 = t * t * t;
  return {
    x: (p0.x * b0) + (p1.x * b1) + (p2.x * b2) + (p3.x * b3),
    y: (p0.y * b0) + (p1.y * b1) + (p2.y * b2) + (p3.y * b3),
    z: (p0.z * b0) + (p1.z * b1) + (p2.z * b2) + (p3.z * b3),
  };
}

function describeVector(vector: Vec3): string {
  const lateralMagnitude = Math.hypot(vector.y, vector.z);
  if (Math.abs(vector.x) > lateralMagnitude * 1.8) {
    return vector.x >= 0 ? '轴向右' : '轴向左';
  }
  if (Math.abs(vector.y) >= Math.abs(vector.z)) {
    if (vector.x >= 0 && vector.y >= 0) return '右上回绕';
    if (vector.x >= 0 && vector.y < 0) return '右下回绕';
    if (vector.x < 0 && vector.y >= 0) return '左上回绕';
    return '左下回绕';
  }
  return vector.x >= 0 ? '右前回绕' : '左后回绕';
}

export function findSolenoidEntity(entities: Map<string, Entity>): Entity | undefined {
  return Array.from(entities.values()).find((entity) => entity.type === 'solenoid');
}

export function getSolenoidCurrent(entity: Entity | undefined, paramValues: ParamValues): number {
  if (typeof paramValues.current === 'number') {
    return Math.abs(paramValues.current);
  }
  return Math.abs((entity?.properties.current as number) ?? 2);
}

export function getSolenoidTurns(entity: Entity | undefined, paramValues: ParamValues): number {
  if (typeof paramValues.turns === 'number') {
    return paramValues.turns;
  }
  return (entity?.properties.turns as number) ?? 500;
}

export function getSolenoidLength(entity: Entity | undefined): number {
  return (entity?.properties.length as number) ?? 3;
}

export function getSolenoidRadius(entity: Entity | undefined): number {
  return (((entity?.properties.height as number) ?? 1.2) / 2);
}

export function getSolenoidDirectionLabel(entity: Entity | undefined): string {
  return getSolenoidFieldDirection(entity ?? buildFallbackSolenoid('right')) === 'right'
    ? '向右'
    : '向左';
}

export function getSolenoidFieldSign(entity: Entity | undefined): number {
  return getSolenoidFieldDirection(entity ?? buildFallbackSolenoid('right')) === 'right' ? 1 : -1;
}

export function computeSolenoidCenterField(current: number, turns: number, length: number): number {
  return MU0 * (turns / Math.max(length, 1e-6)) * current;
}

export function computeSolenoidUniformity(turns: number): number {
  const normalizedTurns = clamp((turns - 80) / (1800 - 80), 0, 1);
  return 0.48 + (normalizedTurns * 0.47);
}

export function describeSolenoidMode(mode: SolenoidDisplayMode): string {
  switch (mode) {
    case 'particles':
      return '粒子模式只在教材图的基础上加入少量运动点，用来辅助观察磁场方向与强弱。';
    case 'volume':
      return '强度阴影模式保留教材线条，并用浅色阴影提示内部强、外部弱。';
    case 'textbook':
    default:
      return '教材模式强调内部近平行箭头与外部闭合回路，适合直接讲解 B ≈ μ₀nI。';
  }
}

export function describeSolenoidView(viewMode: SolenoidViewMode): string {
  switch (viewMode) {
    case 'side':
      return '侧视图更适合观察端部回流路径和外部闭合磁场线。';
    case 'section':
      return '轴向剖面会把内部近似匀强区和外部弱回流区分得更清楚。';
    case 'orbit':
      return '默认斜侧教材视角支持轻量旋转与缩放，但始终保持结构清晰。';
    case 'front':
    default:
      return '正视图用最直接的方式突出内部近似匀强与外部闭合返回。';
  }
}

export function getTeachingStepTitle(step: TeachingStep): string {
  if (step === 1) return 'Step 1 · 单个线圈';
  if (step === 2) return 'Step 2 · 多匝叠加';
  return 'Step 3 · 形成均匀场';
}

export function getTeachingStepDescription(step: TeachingStep): string {
  if (step === 1) {
    return '单个线圈先形成典型的偶极型闭合磁场，内部尚未表现为稳定均匀区。';
  }
  if (step === 2) {
    return '多个线圈叠加后，中心区域磁场彼此增强，端部仍存在明显回流。';
  }
  return '当匝数足够多且分布足够密时，中心区域演化为近似均匀的轴向磁场。';
}

export function getViewPreset(viewMode: SolenoidViewMode): OrbitCameraPreset {
  switch (viewMode) {
    case 'side':
      return { yawDeg: 84, pitchDeg: 10, distance: 8.4 };
    case 'section':
      return { yawDeg: 0, pitchDeg: 0, distance: 7.6 };
    case 'orbit':
      return { yawDeg: -28, pitchDeg: 18, distance: 9.0 };
    case 'front':
    default:
      return { yawDeg: -18, pitchDeg: 12, distance: 9.2 };
  }
}

function resolveTeachingProfile(step: TeachingStep, turns: number, quality: number): TeachingProfile {
  const densityQuality = clamp(quality, 0.7, 1.25);
  if (step === 1) {
    return {
      visibleTurns: 1,
      fieldBlend: 0.38,
      uniformityBlend: 0.42,
      lineCountPerSide: Math.round(3 + densityQuality * 2),
      depthLayers: [-0.18, 0.18],
      particleDensity: 0.72,
      volumeDensity: 0.7,
    };
  }
  if (step === 2) {
    return {
      visibleTurns: clamp(Math.round(turns / 140), 4, 7),
      fieldBlend: 0.72,
      uniformityBlend: 0.74,
      lineCountPerSide: Math.round(4 + densityQuality * 3),
      depthLayers: [-0.36, 0, 0.36],
      particleDensity: 0.9,
      volumeDensity: 0.88,
    };
  }
  return {
    visibleTurns: clamp(Math.round(turns / 44), 12, 22),
    fieldBlend: 1,
    uniformityBlend: computeSolenoidUniformity(turns),
    lineCountPerSide: Math.round(5 + densityQuality * 4),
    depthLayers: [-0.52, -0.18, 0.18, 0.52],
    particleDensity: 1.1,
    volumeDensity: 1,
  };
}

export function sampleSolenoidField(
  point: Vec3,
  options: Pick<SolenoidBuildOptions, 'current' | 'turns' | 'length' | 'radius' | 'directionSign' | 'teachingStep'>,
): SolenoidFieldSample {
  const centerField = computeSolenoidCenterField(options.current, options.turns, options.length);
  const profile = resolveTeachingProfile(options.teachingStep, options.turns, 1);
  const halfLength = options.length / 2;
  const radialDistance = Math.hypot(point.y, point.z);
  const axialNorm = Math.abs(point.x) / Math.max(halfLength, 1e-6);
  const radialNorm = radialDistance / Math.max(options.radius, 1e-6);
  const inside = axialNorm <= 1 && radialNorm <= 1;

  const interiorMaskAxial = 1 - smoothstep(0.68 + (0.12 * (1 - profile.fieldBlend)), 1.12, axialNorm);
  const interiorMaskRadial = 1 - smoothstep(0.78 + (0.12 * (1 - profile.fieldBlend)), 1.16, radialNorm);
  const interiorMask = interiorMaskAxial * interiorMaskRadial;
  const uniformity = lerp(0.42, computeSolenoidUniformity(options.turns), profile.uniformityBlend);
  const axialFalloff = 1 - (0.08 * (axialNorm ** (2.8 + uniformity)));
  const radialFalloff = 1 - (0.12 * (radialNorm ** 2));
  const interiorVector: Vec3 = {
    x: options.directionSign
      * centerField
      * (0.7 + (0.3 * uniformity))
      * axialFalloff
      * radialFalloff
      * interiorMask,
    y: 0,
    z: 0,
  };

  const radiusSquared = (point.x * point.x) + (point.y * point.y) + (point.z * point.z);
  const safeDistance = Math.max(Math.sqrt(radiusSquared), options.radius * 0.34);
  const moment = options.directionSign * centerField * options.length * (options.radius ** 2) * 2.2;
  const safeDistancePow5 = Math.max(safeDistance ** 5, 1e-6);
  const dipoleVector: Vec3 = {
    x: moment * (((3 * point.x * point.x) - radiusSquared) / safeDistancePow5),
    y: moment * ((3 * point.x * point.y) / safeDistancePow5),
    z: moment * ((3 * point.x * point.z) / safeDistancePow5),
  };

  const blendBase = Math.max(
    (axialNorm - (0.58 + (0.12 * profile.fieldBlend))) / 0.38,
    (radialNorm - (0.58 + (0.10 * profile.fieldBlend))) / 0.48,
  );
  const edgeBlend = clamp(blendBase, 0, 1) ** 1.2;

  const vector = inside
    ? {
        x: lerp(interiorVector.x, dipoleVector.x, edgeBlend),
        y: lerp(interiorVector.y, dipoleVector.y, edgeBlend),
        z: lerp(interiorVector.z, dipoleVector.z, edgeBlend),
      }
    : {
        x: dipoleVector.x * (0.86 + (0.14 * profile.fieldBlend)),
        y: dipoleVector.y * (0.86 + (0.14 * profile.fieldBlend)),
        z: dipoleVector.z * (0.86 + (0.14 * profile.fieldBlend)),
      };

  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  return {
    vector,
    magnitude,
    strengthNormalized: clamp(magnitude / Math.max(centerField, 1e-9), 0, 1.8),
    inside,
    region: inside ? 'inside' : 'outside',
    directionLabel: describeVector(vector),
  };
}

function buildCylinderMesh(length: number, radius: number): MeshGeometry {
  const halfLength = length / 2;
  const radialSegments = 42;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= radialSegments; i += 1) {
    const theta = (i / radialSegments) * Math.PI * 2;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const highlight = 0.5 + (0.5 * Math.cos(theta - (Math.PI * 0.35)));
    const color = mixColor(COPPER_DARK, COPPER_LIGHT, highlight * 0.65);

    positions.push(-halfLength, radius * cosTheta, radius * sinTheta);
    normals.push(0, cosTheta, sinTheta);
    pushColor(colors, [color[0], color[1], color[2], 0.24]);

    positions.push(halfLength, radius * cosTheta, radius * sinTheta);
    normals.push(0, cosTheta, sinTheta);
    pushColor(colors, [color[0], color[1], color[2], 0.20]);
  }

  for (let i = 0; i < radialSegments; i += 1) {
    const start = i * 2;
    indices.push(start, start + 1, start + 2);
    indices.push(start + 1, start + 3, start + 2);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint16Array(indices),
  };
}

function buildHelixGeometry(
  length: number,
  radius: number,
  visibleTurns: number,
  directionSign: number,
): {
  positions: Float32Array;
  colors: Float32Array;
} {
  const segments = Math.max(visibleTurns * 38, 84);
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = directionSign * visibleTurns * Math.PI * 2 * t;
    const point: Vec3 = {
      x: -length / 2 + (length * t),
      y: radius * Math.cos(angle),
      z: radius * Math.sin(angle),
    };
    const copper = mixColor(COPPER_DARK, COPPER_LIGHT, 0.35 + (0.65 * Math.sin((t * Math.PI) + 0.45)));
    pushVec3(positions, point);
    pushColor(colors, copper);
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  };
}

function buildClosedFieldLine(
  options: SolenoidBuildOptions,
  profile: TeachingProfile,
  levelRatio: number,
  signY: -1 | 1,
  depthRatio: number,
): SolenoidFieldLine {
  const halfLength = options.length / 2;
  const innerY = signY * options.radius * levelRatio;
  const outerY = signY * options.radius * (1.18 + (0.88 * levelRatio) + ((1 - profile.fieldBlend) * 0.26));
  const depth = depthRatio * options.radius;
  const capBulge = options.radius * (0.72 + (0.72 * levelRatio));
  const positions: number[] = [];
  const colors: number[] = [];
  let strengthSum = 0;
  let strengthCount = 0;

  const pushPoint = (point: Vec3, color: [number, number, number, number]) => {
    pushVec3(positions, point);
    pushColor(colors, color);
    const sample = sampleSolenoidField(point, options);
    strengthSum += sample.strengthNormalized;
    strengthCount += 1;
  };

  const insideColor = mixColor(FIELD_STRONG, [0.82, 0.94, 1, 0.98], clamp(Math.abs(depthRatio), 0, 1) * 0.32);
  const outsideColor = mixColor(FIELD_SOFT, FIELD_STRONG, 0.12 + (0.12 * (1 - levelRatio)));

  for (let i = 0; i <= 28; i += 1) {
    const t = i / 28;
    pushPoint({
      x: lerp(-halfLength, halfLength, t),
      y: innerY,
      z: depth,
    }, insideColor);
  }

  const rightStart: Vec3 = { x: halfLength, y: innerY, z: depth };
  const rightC1: Vec3 = { x: halfLength + (capBulge * 0.42), y: innerY, z: depth };
  const rightC2: Vec3 = { x: halfLength + (capBulge * 1.05), y: outerY, z: depth };
  const rightEnd: Vec3 = { x: halfLength, y: outerY, z: depth };
  for (let i = 1; i <= 18; i += 1) {
    const t = i / 18;
    const color = mixColor(insideColor, outsideColor, t);
    pushPoint(bezierPoint(rightStart, rightC1, rightC2, rightEnd, t), color);
  }

  for (let i = 1; i <= 28; i += 1) {
    const t = i / 28;
    pushPoint({
      x: lerp(halfLength, -halfLength, t),
      y: outerY,
      z: depth,
    }, outsideColor);
  }

  const leftStart: Vec3 = { x: -halfLength, y: outerY, z: depth };
  const leftC1: Vec3 = { x: -halfLength - (capBulge * 1.05), y: outerY, z: depth };
  const leftC2: Vec3 = { x: -halfLength - (capBulge * 0.42), y: innerY, z: depth };
  const leftEnd: Vec3 = { x: -halfLength, y: innerY, z: depth };
  for (let i = 1; i <= 18; i += 1) {
    const t = i / 18;
    const color = mixColor(outsideColor, insideColor, t);
    pushPoint(bezierPoint(leftStart, leftC1, leftC2, leftEnd, t), color);
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    averageStrength: strengthSum / Math.max(strengthCount, 1),
  };
}

function toParticlePath(line: SolenoidFieldLine, options: SolenoidBuildOptions): SolenoidParticlePath {
  const points: Vec3[] = [];
  for (let i = 0; i < line.positions.length; i += 3) {
    points.push({
      x: line.positions[i] ?? 0,
      y: line.positions[i + 1] ?? 0,
      z: line.positions[i + 2] ?? 0,
    });
  }

  const travelTimes: number[] = [0];
  let elapsed = 0;
  let strengthAcc = 0;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    const mid = {
      x: (prev.x + next.x) / 2,
      y: (prev.y + next.y) / 2,
      z: (prev.z + next.z) / 2,
    };
    const sample = sampleSolenoidField(mid, options);
    const segmentLength = Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z);
    const speed = 0.22 + (0.95 * sample.strengthNormalized) + (sample.inside ? 0.58 : 0);
    elapsed += segmentLength / Math.max(speed, 1e-4);
    strengthAcc += sample.strengthNormalized;
    travelTimes.push(elapsed);
  }

  return {
    positions: points,
    travelTimes,
    totalTime: Math.max(elapsed, 1e-4),
    averageStrength: strengthAcc / Math.max(points.length - 1, 1),
    color: line.averageStrength > 0.7 ? FIELD_STRONG : FIELD_SOFT,
  };
}

export function sampleParticlePath(path: SolenoidParticlePath, normalizedTime: number): Vec3 {
  const targetTime = (normalizedTime - Math.floor(normalizedTime)) * path.totalTime;
  const travelTimes = path.travelTimes;
  let index = 0;

  while ((index < travelTimes.length - 2) && ((travelTimes[index + 1] ?? 0) < targetTime)) {
    index += 1;
  }

  const t0 = travelTimes[index] ?? 0;
  const t1 = travelTimes[index + 1] ?? path.totalTime;
  const localT = t1 > t0 ? (targetTime - t0) / (t1 - t0) : 0;
  const p0 = path.positions[index] ?? path.positions[0] ?? { x: 0, y: 0, z: 0 };
  const p1 = path.positions[index + 1] ?? p0;

  return {
    x: lerp(p0.x, p1.x, localT),
    y: lerp(p0.y, p1.y, localT),
    z: lerp(p0.z, p1.z, localT),
  };
}

function buildParticleSeeds(
  particlePaths: SolenoidParticlePath[],
  options: SolenoidBuildOptions,
  profile: TeachingProfile,
): SolenoidParticleSeed[] {
  const seeds: SolenoidParticleSeed[] = [];
  const baseCount = Math.round((10 + (options.current * 4) + (options.turns / 220)) * profile.particleDensity);

  particlePaths.forEach((path, pathIndex) => {
    const pathCount = clamp(Math.round((baseCount / Math.max(particlePaths.length, 1)) * (0.75 + (path.averageStrength * 0.35))), 4, 18);
    for (let i = 0; i < pathCount; i += 1) {
      seeds.push({
        pathIndex,
        offset: (i / pathCount) + ((pathIndex * 0.13) % 1),
        size: 0.048 + (0.028 * path.averageStrength),
        alpha: 0.45 + (0.28 * path.averageStrength),
      });
    }
  });

  return seeds;
}

function buildVolumeSprites(
  options: SolenoidBuildOptions,
  profile: TeachingProfile,
): SolenoidVolumeSprite[] {
  const halfLength = options.length / 2;
  const xCount = Math.round(11 * profile.volumeDensity * options.quality);
  const radialCount = Math.round(7 * profile.volumeDensity * options.quality);
  const depthCount = Math.round(7 * profile.volumeDensity * options.quality);
  const sprites: SolenoidVolumeSprite[] = [];

  for (let ix = 0; ix < xCount; ix += 1) {
    const x = lerp(-halfLength * 1.2, halfLength * 1.2, ix / Math.max(xCount - 1, 1));
    for (let iy = 0; iy < radialCount; iy += 1) {
      const y = lerp(-options.radius * 1.95, options.radius * 1.95, iy / Math.max(radialCount - 1, 1));
      for (let iz = 0; iz < depthCount; iz += 1) {
        const z = lerp(-options.radius * 1.95, options.radius * 1.95, iz / Math.max(depthCount - 1, 1));
        const sample = sampleSolenoidField({ x, y, z }, options);
        const retain = sample.inside
          ? sample.strengthNormalized > 0.16
          : sample.strengthNormalized > 0.035;
        if (!retain) continue;

        const color = sample.inside
          ? mixColor(FIELD_VOLUME_EDGE, FIELD_VOLUME_CORE, clamp(sample.strengthNormalized, 0, 1))
          : mixColor(FIELD_VOLUME_EDGE, FIELD_SOFT, clamp(sample.strengthNormalized * 0.85, 0, 1));

        sprites.push({
          center: { x, y, z },
          size: sample.inside
            ? 0.16 + (0.22 * sample.strengthNormalized)
            : 0.08 + (0.16 * sample.strengthNormalized),
          color,
          intensity: sample.strengthNormalized,
        });
      }
    }
  }

  return sprites;
}

function buildSectionSamples(options: SolenoidBuildOptions): {
  cells: SolenoidSectionCell[];
  arrows: SolenoidSectionArrow[];
} {
  const halfLength = options.length / 2;
  const cells: SolenoidSectionCell[] = [];
  const arrows: SolenoidSectionArrow[] = [];

  const cellXCount = 28;
  const cellYCount = 18;
  for (let ix = 0; ix < cellXCount; ix += 1) {
    const x = lerp(-halfLength * 1.28, halfLength * 1.28, ix / Math.max(cellXCount - 1, 1));
    for (let iy = 0; iy < cellYCount; iy += 1) {
      const y = lerp(-options.radius * 2.05, options.radius * 2.05, iy / Math.max(cellYCount - 1, 1));
      const sample = sampleSolenoidField({ x, y, z: 0 }, options);
      cells.push({
        point: { x, y, z: 0 },
        magnitude: sample.magnitude,
        strengthNormalized: sample.strengthNormalized,
        region: sample.region,
      });
    }
  }

  const arrowXCount = 13;
  const arrowYCount = 9;
  for (let ix = 0; ix < arrowXCount; ix += 1) {
    const x = lerp(-halfLength * 1.15, halfLength * 1.15, ix / Math.max(arrowXCount - 1, 1));
    for (let iy = 0; iy < arrowYCount; iy += 1) {
      const y = lerp(-options.radius * 1.8, options.radius * 1.8, iy / Math.max(arrowYCount - 1, 1));
      const sample = sampleSolenoidField({ x, y, z: 0 }, options);
      arrows.push({
        point: { x, y, z: 0 },
        vector: sample.vector,
        magnitude: sample.magnitude,
        region: sample.region,
      });
    }
  }

  return { cells, arrows };
}

export function buildSolenoidSceneGeometry(options: SolenoidBuildOptions): SolenoidSceneGeometry {
  const profile = resolveTeachingProfile(options.teachingStep, options.turns, options.quality);
  const centerField = computeSolenoidCenterField(options.current, options.turns, options.length);
  const fieldLines: SolenoidFieldLine[] = [];
  const levels = Array.from({ length: profile.lineCountPerSide }, (_, index) =>
    lerp(0.12, 0.84, (index + 0.5) / profile.lineCountPerSide));

  for (const depthRatio of profile.depthLayers) {
    for (const signY of [-1, 1] as const) {
      for (const levelRatio of levels) {
        fieldLines.push(buildClosedFieldLine(options, profile, levelRatio, signY, depthRatio));
      }
    }
  }

  const particlePathSource = fieldLines.filter((_, index) => index % 2 === 0);
  const particlePaths = particlePathSource.map((line) => toParticlePath(line, options));
  const particleSeeds = buildParticleSeeds(particlePaths, options, profile);
  const volumeSprites = buildVolumeSprites(options, profile);
  const section = buildSectionSamples(options);
  const helix = buildHelixGeometry(options.length, options.radius, profile.visibleTurns, options.directionSign);

  return {
    cylinder: buildCylinderMesh(options.length * 1.03, options.radius * 1.02),
    helixPositions: helix.positions,
    helixColors: helix.colors,
    fieldLines,
    particlePaths,
    particleSeeds,
    volumeSprites,
    sectionCells: section.cells,
    sectionArrows: section.arrows,
    centerField,
    uniformity: lerp(0.42, computeSolenoidUniformity(options.turns), profile.uniformityBlend),
    visibleTurns: profile.visibleTurns,
    bounds: {
      halfLength: options.length / 2,
      radius: options.radius,
    },
  };
}

function buildFallbackSolenoid(direction: 'left' | 'right'): Entity {
  return {
    id: 'solenoid-fallback',
    type: 'solenoid',
    category: 'field',
    transform: { position: { x: 0, y: 0 }, rotation: 0 },
    properties: {
      current: 2,
      currentDirectionMode: direction === 'right' ? 'rightward' : 'leftward',
      turns: 500,
      length: 3,
      width: 3,
      height: 1.2,
    },
    label: '螺线管',
  };
}
