import type {
  Entity,
  EventActionMapping,
  ParamValues,
  PhysicsEvent,
  PhysicsResult,
  PresetData,
  SceneDefinition,
  SimulationState,
  SimulatorEvent,
  SimulatorEventHandler,
  SolveMode,
  Vec2,
  ViewportType,
} from '../types';
import { solverRegistry, type SolverRegistration } from '../registries';
import { loadPreset, type PresetLoadResult } from './preset-loader';
import { getStraightWireDirectionVector } from '@/domains/em/logic/current-direction';
import { getEffectiveE } from '@/domains/em/logic/electric-force';
import { syncParticleEmitters } from '@/domains/em/logic/particle-emitter';
import { getPointChargeLaunchState } from '@/domains/em/logic/point-charge-kinematics';
import { isDynamicPointCharge } from '@/domains/em/logic/point-charge-role';
import { syncPointChargeLaunchProperties } from '@/domains/em/logic/point-charge-kinematics';

// ─── 常量 ───

const MAX_DT = 1 / 30; // 最大时间步长（防止大步长导致数值不稳定）
const SAMPLE_RATE = 60; // 解析解预计算采样率
const TWO_CHARGE_DISTANCE_MIN_CM = 2;
const TWO_CHARGE_DISTANCE_MAX_CM = 30;
const TWO_CHARGE_DISTANCE_DEFAULT_CM = 10;
const MIN_ELECTRIC_SCENE_DURATION = 0.8;
const MAX_ELECTRIC_SCENE_DURATION = 8;
const COLLISION_STOP_BUFFER = 0.12;
const EXIT_TAIL_MIN = 0.45;
const EXIT_TAIL_MAX = 1.4;
const VOLATILE_POINT_CHARGE_PROP_KEYS = [
  'stoppedOnPlate',
  'stoppedOnScreen',
  'screenHitEntityId',
  'screenHitPoint',
  'electrogravityDetached',
  'electrogravityReleasePoint',
  'electrogravityReleaseAngle',
  'electrogravityReleaseSpeed',
] as const;

type TwoChargePresetKey =
  | 'dipole'
  | 'same-positive'
  | 'same-negative'
  | 'unequal-dipole'
  | 'custom';

function clampCharge(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.max(-10, Math.min(10, num)) * 10) / 10;
}

function clampDistanceCm(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return TWO_CHARGE_DISTANCE_DEFAULT_CM;
  return Math.max(
    TWO_CHARGE_DISTANCE_MIN_CM,
    Math.min(TWO_CHARGE_DISTANCE_MAX_CM, Math.round(num)),
  );
}

function isClose(a: number, b: number, epsilon: number = 1e-6): boolean {
  return Math.abs(a - b) < epsilon;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function classifyTwoChargePreset(q1: number, q2: number): TwoChargePresetKey {
  if (q1 > 0 && q2 < 0 && isClose(Math.abs(q1), Math.abs(q2))) return 'dipole';
  if (q1 > 0 && q2 > 0 && isClose(q1, q2)) return 'same-positive';
  if (q1 < 0 && q2 < 0 && isClose(Math.abs(q1), Math.abs(q2))) return 'same-negative';
  if (q1 > 0 && q2 < 0 && isClose(q1, Math.abs(q2) * 2)) return 'unequal-dipole';
  return 'custom';
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampSceneDuration(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return clampValue(value, MIN_ELECTRIC_SCENE_DURATION, MAX_ELECTRIC_SCENE_DURATION);
}

function computeTailDuration(span: number, speed: number): number {
  return clampValue((Math.max(span, 0.5) / Math.max(speed, 0.5)) * 0.5, EXIT_TAIL_MIN, EXIT_TAIL_MAX);
}

function solveBoundaryTime(
  position: number,
  velocity: number,
  acceleration: number,
  target: number,
): number | null {
  const displacement = target - position;

  if (Math.abs(acceleration) < 1e-9) {
    if (Math.abs(velocity) < 1e-9) return null;
    const linearTime = displacement / velocity;
    return linearTime > 1e-6 ? linearTime : null;
  }

  const a = 0.5 * acceleration;
  const b = velocity;
  const c = position - target;
  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < 0) return null;

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const candidates = [t1, t2].filter((time) => Number.isFinite(time) && time > 1e-6);
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

// ─── Simulator ───

export interface ISimulator {
  // 生命周期
  loadPreset(preset: PresetData): void;
  loadScene(config: SimulatorSceneLoadConfig): void;
  unload(): void;

  // 播放控制
  play(): void;
  pause(): void;
  reset(): void;
  clearTrajectories(): void;

  // 时间轴
  seekTo(time: number): void;
  setPlaybackRate(rate: number): void;

  // 参数交互
  updateParam(paramKey: string, value: ParamValues[string]): void;
  updateEntityPosition(entityId: string, position: Vec2): void;

  // 状态读取
  getState(): SimulationState;
  getCurrentResult(): PhysicsResult | null;

  // 单步（供 render-loop 调用）
  step(dt: number): void;

  // 事件订阅
  on(event: SimulatorEvent, handler: SimulatorEventHandler): void;
  off(event: SimulatorEvent, handler: SimulatorEventHandler): void;
}

export interface SimulatorSceneLoadConfig {
  scene: SceneDefinition;
  solveMode: SolveMode;
  duration: number;
  defaultViewport: ViewportType;
  supportedViewports: ViewportType[];
  solverQualifier?: Record<string, string>;
  eventActions?: EventActionMapping[];
}

export function createSimulator(): ISimulator {
  // ─── 内部状态 ───
  let scene: SceneDefinition | null = null;
  let activeSolver: SolverRegistration | null = null;
  let solveMode: SolveMode = 'analytical';
  let duration = 5;
  let currentTime = 0;
  let playbackRate = 1;
  let status: 'idle' | 'running' | 'paused' | 'finished' = 'idle';
  let currentResult: PhysicsResult | null = null;
  let resultHistory: PhysicsResult[] = [];
  let precomputedResults: PhysicsResult[] | null = null;
  let eventActions: EventActionMapping[] = [];
  let supportedViewports: ViewportType[] = [];
  let defaultViewport: ViewportType = 'force';

  // 事件系统
  const listeners = new Map<SimulatorEvent, Set<SimulatorEventHandler>>();

  function emit(event: SimulatorEvent, data?: unknown): void {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  function clearPointChargeRuntimeProps(): void {
    if (!scene) return;

    for (const entity of scene.entities.values()) {
      if (entity.type !== 'point-charge') continue;

      const props = entity.properties as Record<string, unknown>;
      for (const key of VOLATILE_POINT_CHARGE_PROP_KEYS) {
        delete props[key];
      }
    }
  }

  function syncRuntimeEntityProps(result: PhysicsResult | null): void {
    if (!scene) return;

    clearPointChargeRuntimeProps();
    if (!result) return;

    for (const motionState of result.motionStates.values()) {
      if (!motionState.entityPropsPatch) continue;

      const entity = scene.entities.get(motionState.entityId);
      if (!entity) continue;

      Object.assign(entity.properties as Record<string, unknown>, motionState.entityPropsPatch);
    }
  }

  // ─── 内部辅助 ───

  function findNearestFrame(
    frames: PhysicsResult[],
    time: number,
  ): PhysicsResult | null {
    if (frames.length === 0) return null;

    // 二分查找最近帧
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const midFrame = frames[mid];
      if (midFrame && midFrame.time < time) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    const loFrame = frames[lo];
    if (!loFrame) return null;

    // 比较 lo 和 lo-1 哪个更近
    if (lo > 0) {
      const prevFrame = frames[lo - 1];
      if (prevFrame) {
        const diffLo = Math.abs(loFrame.time - time);
        const diffPrev = Math.abs(prevFrame.time - time);
        return diffLo < diffPrev ? loFrame : prevFrame;
      }
    }
    return loFrame;
  }

  function runEventDetection(
    prevResult: PhysicsResult | null,
    result: PhysicsResult,
  ): void {
    if (!activeSolver?.eventDetectors || !scene) return;

    for (const detector of activeSolver.eventDetectors) {
      const detection = detector.detect(scene, result, prevResult);
      if (detection) {
        const physicsEvent: PhysicsEvent = {
          type: detection.eventType,
          time: result.time,
          entityId: detection.entityId,
          description: `事件: ${detection.eventType}`,
          data: detection.data,
        };

        // 查找匹配的 eventAction
        for (const ea of eventActions) {
          if (ea.eventType !== detection.eventType) continue;
          if (ea.entityId && ea.entityId !== detection.entityId) continue;

          // 执行动作
          if (ea.action.type === 'stop') {
            status = 'finished';
          }

          emit('physics-event', { event: physicsEvent, action: ea.action });
        }
      }
    }
  }

  function computePrecomputedResults(): void {
    if (
      solveMode !== 'analytical' ||
      !activeSolver?.precompute ||
      !scene
    ) {
      precomputedResults = null;
      return;
    }
    precomputedResults = activeSolver.precompute(
      scene,
      duration,
      SAMPLE_RATE,
    );
  }

  function solveAtTime(time: number, dt: number): PhysicsResult | null {
    if (!activeSolver || !scene) return null;

    if (solveMode === 'analytical') {
      // 优先从预计算结果中取
      if (precomputedResults) {
        return findNearestFrame(precomputedResults, time);
      }
      return activeSolver.solve(scene, time, 0, null);
    } else {
      // 数值积分
      const prev =
        resultHistory.length > 0
          ? (resultHistory[resultHistory.length - 1] ?? null)
          : null;
      return activeSolver.solve(scene, time, dt, prev);
    }
  }

  function findParamSchema(
    paramKey: string,
  ): { targetEntityId?: string; targetProperty?: string } | null {
    if (!scene) return null;
    for (const group of scene.paramGroups) {
      for (const param of group.params) {
        if (param.key === paramKey) {
          return {
            targetEntityId: param.targetEntityId,
            targetProperty: param.targetProperty,
          };
        }
      }
    }
    return null;
  }

  function applyParamValue(
    paramKey: string,
    value: ParamValues[string],
  ): void {
    if (!scene) return;

    scene.paramValues[paramKey] = value;

    const schema = findParamSchema(paramKey);
    if (!schema?.targetEntityId || !schema.targetProperty) return;

    const entity = scene.entities.get(schema.targetEntityId);
    if (!entity) return;

    const targetRoot = schema.targetProperty.startsWith('transform.')
      ? (entity as unknown as Record<string, unknown>)
      : (entity.properties as Record<string, unknown>);

    setNestedProperty(targetRoot, schema.targetProperty, value);

    if (
      entity.type === 'point-charge' &&
      isPointChargeLaunchProperty(schema.targetProperty)
    ) {
      syncPointChargeLaunchProperties(entity, schema.targetProperty);
    }
  }

  function findEntityByParam(paramKey: string) {
    if (!scene) return null;
    const schema = findParamSchema(paramKey);
    if (!schema?.targetEntityId) return null;
    return scene.entities.get(schema.targetEntityId) ?? null;
  }

  function applyTwoChargeFieldEffects(changedParamKey?: string): void {
    if (!scene) return;

    const hasTwoChargeScene =
      'chargeQ1' in scene.paramValues &&
      'chargeQ2' in scene.paramValues &&
      'distanceCm' in scene.paramValues &&
      'chargePreset' in scene.paramValues;

    if (!hasTwoChargeScene) return;

    const charge1 = findEntityByParam('chargeQ1');
    const charge2 = findEntityByParam('chargeQ2');
    if (!charge1 || !charge2) return;

    const applyDistance = () => {
      const distanceCm = clampDistanceCm(scene!.paramValues.distanceCm);
      const halfDistance = distanceCm / 200;
      charge1.transform.position = { x: -halfDistance, y: 0 };
      charge2.transform.position = { x: halfDistance, y: 0 };
      scene!.paramValues.distanceCm = distanceCm;
    };

    const syncPreset = () => {
      const q1 = clampCharge(scene!.paramValues.chargeQ1, 1);
      const q2 = clampCharge(scene!.paramValues.chargeQ2, -1);
      scene!.paramValues.chargePreset = classifyTwoChargePreset(q1, q2);
    };

    if (changedParamKey === 'chargePreset') {
      const currentQ1 = clampCharge(scene.paramValues.chargeQ1, 1);
      const currentQ2 = clampCharge(scene.paramValues.chargeQ2, -1);
      const magnitudes = [Math.abs(currentQ1), Math.abs(currentQ2)].filter((m) => m > 0);
      const smallestMagnitude = magnitudes.length > 0 ? Math.min(...magnitudes) : 1;
      const baseCharge = Math.max(0.1, Math.min(5, smallestMagnitude));
      const preset = String(scene.paramValues.chargePreset) as TwoChargePresetKey;

      switch (preset) {
        case 'dipole':
          applyParamValue('chargeQ1', baseCharge);
          applyParamValue('chargeQ2', -baseCharge);
          break;
        case 'same-positive':
          applyParamValue('chargeQ1', baseCharge);
          applyParamValue('chargeQ2', baseCharge);
          break;
        case 'same-negative':
          applyParamValue('chargeQ1', -baseCharge);
          applyParamValue('chargeQ2', -baseCharge);
          break;
        case 'unequal-dipole':
          applyParamValue('chargeQ1', Math.min(10, Math.round(baseCharge * 2 * 10) / 10));
          applyParamValue('chargeQ2', -baseCharge);
          break;
        case 'custom':
        default:
          break;
      }

      applyDistance();
      syncPreset();
      return;
    }

    if (changedParamKey === 'chargeQ1') {
      applyParamValue('chargeQ1', clampCharge(scene.paramValues.chargeQ1, 1));
      syncPreset();
      return;
    }

    if (changedParamKey === 'chargeQ2') {
      applyParamValue('chargeQ2', clampCharge(scene.paramValues.chargeQ2, -1));
      syncPreset();
      return;
    }

    if (changedParamKey === 'distanceCm') {
      scene.paramValues.distanceCm = clampDistanceCm(scene.paramValues.distanceCm);
      applyDistance();
      return;
    }

    applyDistance();
    syncPreset();
  }

  function updatePointChargePosition(entityId: string, position: Vec2): void {
    if (!scene) return;

    const entity = scene.entities.get(entityId);
    if (!entity) return;

    const charge1 = findEntityByParam('chargeQ1');
    const charge2 = findEntityByParam('chargeQ2');

    if (charge1 && charge2 && (entityId === charge1.id || entityId === charge2.id)) {
      const minHalfDistance = TWO_CHARGE_DISTANCE_MIN_CM / 200;
      const maxHalfDistance = TWO_CHARGE_DISTANCE_MAX_CM / 200;
      const halfDistance = Math.max(
        minHalfDistance,
        Math.min(maxHalfDistance, Math.abs(position.x)),
      );

      charge1.transform.position = { x: -halfDistance, y: 0 };
      charge2.transform.position = { x: halfDistance, y: 0 };
      scene.paramValues.distanceCm = Math.round(halfDistance * 200);
      return;
    }

    entity.transform.position = { ...position };
  }

  function applyFlowmeterEffects(): void {
    if (!scene) return;
    if (!('v' in scene.paramValues) || !('B' in scene.paramValues) || !('L' in scene.paramValues)) {
      return;
    }

    const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
    const efield = Array.from(scene.entities.values()).find((entity) => entity.type === 'uniform-efield');
    const bfield = Array.from(scene.entities.values()).find((entity) => entity.type === 'uniform-bfield');
    if (!efield || !bfield || particles.length < 2) return;

    const flowSpeed = Math.max(readNumber(scene.paramValues.v, 0), 0);
    const magneticField = Math.max(
      readNumber(scene.paramValues.B, readNumber(bfield.properties.magnitude, 0)),
      0,
    );
    const pipeDiameter = Math.max(
      readNumber(scene.paramValues.L, readNumber(efield.properties.height, 1)),
      0.1,
    );
    const bfieldHeight = Math.max(readNumber(bfield.properties.height, 0), 0);
    const pipeCenterY = bfieldHeight > 0
      ? bfield.transform.position.y + (bfieldHeight / 2)
      : efield.transform.position.y + (readNumber(efield.properties.height, pipeDiameter) / 2);
    const inducedField = magneticField * flowSpeed;
    const inducedVoltage = inducedField * pipeDiameter;

    scene.paramValues.v = flowSpeed;
    scene.paramValues.B = magneticField;
    scene.paramValues.L = pipeDiameter;
    scene.paramValues.U = inducedVoltage;

    bfield.properties.magnitude = magneticField;
    efield.properties.showPlates = true;
    efield.properties.direction = { x: 0, y: -1 };
    efield.properties.height = pipeDiameter;
    efield.properties.magnitude = inducedField;
    efield.properties.voltage = inducedVoltage;
    efield.properties.dielectric = 1;
    efield.transform.position = {
      ...efield.transform.position,
      y: pipeCenterY - (pipeDiameter / 2),
    };

    for (const particle of particles) {
      particle.transform.position = {
        ...particle.transform.position,
        y: pipeCenterY,
      };
      particle.properties.initialVelocity = { x: flowSpeed, y: 0 };
      syncPointChargeLaunchProperties(particle, 'initialVelocity.x');
    }
  }

  function applyCyclotronEffects(): void {
    if (!scene) return;

    const alternatingFields = Array.from(scene.entities.values()).filter(
      (entity) => entity.type === 'uniform-efield' && entity.properties.mode === 'alternating',
    );
    if (alternatingFields.length === 0 || !('B' in scene.paramValues)) return;

    const bfields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-bfield');
    if (bfields.length < 2) return;

    const syncedB = Math.max(
      readNumber(scene.paramValues.B, readNumber(bfields[0]?.properties.magnitude, 0)),
      0,
    );

    scene.paramValues.B = syncedB;
    for (const bfield of bfields) {
      bfield.properties.magnitude = syncedB;
    }
  }

  function applyTwoStageEFieldEffects(): void {
    if (!scene) return;

    const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
    const efields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-efield');
    const bfields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-bfield');
    const screens = Array.from(scene.entities.values()).filter((entity) => entity.type === 'detector-screen');

    if (particles.length !== 1 || efields.length < 2 || bfields.length > 0 || screens.length === 0) return;

    const accelerationField = efields.find((field) => field.properties.stageRole === 'acceleration');
    const deflectionField = efields.find((field) => field.properties.stageRole === 'deflection');
    if (!accelerationField || !deflectionField) return;

    const particle = particles[0]!;
    const screen = screens[0]!;
    const particleRadius = Math.max((particle.properties.radius as number) ?? 0.12, 0.02);
    const accelerationWidth = Math.max(readNumber(accelerationField.properties.width, 4), 0.6);
    const accelerationHeight = Math.max(readNumber(accelerationField.properties.height, 2.8), 0.6);
    const deflectionWidth = Math.max(readNumber(deflectionField.properties.width, 4.8), 0.6);
    const deflectionHeight = Math.max(readNumber(deflectionField.properties.height, 2), 0.6);
    const stageGap = Math.max(
      readNumber(accelerationField.properties.stageGapAfter, 1.2),
      particleRadius * 2,
    );
    const screenGap = Math.max(
      readNumber(deflectionField.properties.screenGapAfter, 1.6),
      particleRadius * 2,
    );
    const screenHeight = Math.max(readNumber(screen.properties.height, 4.2), 0.6);
    const entryOffset = Math.max(particleRadius + 0.24, 0.45);

    particle.properties.stoppedOnPlate = false;
    particle.properties.stoppedOnScreen = false;
    delete particle.properties.screenHitEntityId;
    delete particle.properties.screenHitPoint;

    accelerationField.properties.showPlates = true;
    accelerationField.properties.stopOnPlateCollision = false;
    accelerationField.properties.direction = { x: 1, y: 0 };
    accelerationField.transform.position = {
      ...accelerationField.transform.position,
      y: -(accelerationHeight / 2),
    };

    deflectionField.properties.showPlates = true;
    deflectionField.properties.direction = { x: 0, y: -1 };
    deflectionField.transform.position = {
      ...deflectionField.transform.position,
      x: accelerationField.transform.position.x + accelerationWidth + stageGap,
      y: -(deflectionHeight / 2),
    };

    screen.transform.position = {
      ...screen.transform.position,
      x: deflectionField.transform.position.x + deflectionWidth + screenGap,
      y: -(screenHeight / 2),
    };

    particle.transform.position = {
      ...particle.transform.position,
      x: accelerationField.transform.position.x + entryOffset,
      y: 0,
    };

    particle.properties.initialDirectionDeg = 0;
    syncPointChargeLaunchProperties(particle, 'initialDirectionDeg');
  }

  function applyElectricMotionSceneEffects(): void {
    if (!scene) return;

    const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
    const efields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-efield');
    const bfields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-bfield');

    if (particles.length !== 1 || efields.length !== 1 || bfields.length > 0) return;

    const particle = particles[0]!;
    const field = efields[0]!;
    if (!((field.properties.showPlates as boolean) ?? false)) return;
    if (typeof particle.properties.trackRadius === 'number') return;

    particle.properties.stoppedOnPlate = false;
    particle.properties.stoppedOnScreen = false;
    delete particle.properties.screenHitEntityId;
    delete particle.properties.screenHitPoint;

    const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: -1 };
    const radius = Math.max((particle.properties.radius as number) ?? 0.12, 0.02);
    const launch = getPointChargeLaunchState(particle);

    if (Math.abs(direction.y) > Math.abs(direction.x) && Math.abs(launch.velocity.x) > 1e-6) {
      const yMin = field.transform.position.y + radius;
      const yMax = field.transform.position.y + ((field.properties.height as number) ?? 0) - radius;
      const clampedY = clampValue(particle.transform.position.y, yMin, yMax);
      particle.transform.position.y = clampedY;
      if ('entryY' in scene.paramValues) {
        scene.paramValues.entryY = clampedY;
      }
    }

    const estimatedDuration = estimateElectricMotionDuration(particle, field);
    if (estimatedDuration != null) {
      duration = estimatedDuration;
    }
  }

  function estimateElectricMotionDuration(particle: Entity, field: Entity): number | null {
    const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
    const width = Math.max((field.properties.width as number) ?? 0, 0);
    const height = Math.max((field.properties.height as number) ?? 0, 0);
    const radius = Math.max((particle.properties.radius as number) ?? 0.12, 0.02);
    const launch = getPointChargeLaunchState(particle);
    const charge = (particle.properties.charge as number) ?? 0;
    const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-6);
    const effectiveE = getEffectiveE(field);
    const ax = (charge * effectiveE * direction.x) / mass;
    const ay = (charge * effectiveE * direction.y) / mass;
    const startX = particle.transform.position.x;
    const startY = particle.transform.position.y;

    if (Math.abs(direction.y) > Math.abs(direction.x) && Math.abs(launch.velocity.x) > 1e-6) {
      const xMin = field.transform.position.x + radius;
      const xMax = field.transform.position.x + width - radius;
      const yMin = field.transform.position.y + radius;
      const yMax = field.transform.position.y + height - radius;
      const exitBoundaryX = launch.velocity.x >= 0 ? xMax : xMin;
      const exitTime = solveBoundaryTime(startX, launch.velocity.x, 0, exitBoundaryX);

      const collisionCandidates = [yMin, yMax]
        .map((targetY) => solveBoundaryTime(startY, launch.velocity.y, ay, targetY))
        .filter((time): time is number => time != null)
        .filter((time) => {
          const xAtTime = startX + launch.velocity.x * time;
          return xAtTime >= xMin - 1e-6 && xAtTime <= xMax + 1e-6;
        });
      const collisionTime = collisionCandidates.length > 0 ? Math.min(...collisionCandidates) : null;

      if (collisionTime != null && (exitTime == null || collisionTime <= exitTime + 1e-6)) {
        return clampSceneDuration(collisionTime + COLLISION_STOP_BUFFER);
      }

      if (exitTime != null) {
        const exitVy = launch.velocity.y + ay * exitTime;
        const exitSpeed = Math.hypot(launch.velocity.x, exitVy);
        return clampSceneDuration(exitTime + computeTailDuration(width, exitSpeed));
      }

      return clampSceneDuration(2.4);
    }

    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      const xMin = field.transform.position.x + radius;
      const xMax = field.transform.position.x + width - radius;
      const yMin = field.transform.position.y + radius;
      const yMax = field.transform.position.y + height - radius;
      const projectedDirection = Math.abs(launch.velocity.x) > 1e-6 ? launch.velocity.x : ax;
      if (Math.abs(projectedDirection) < 1e-6) {
        return clampSceneDuration(2.2);
      }

      const collisionBoundaryX = projectedDirection >= 0 ? xMax : xMin;
      const collisionTime = solveBoundaryTime(startX, launch.velocity.x, ax, collisionBoundaryX);
      const verticalExitCandidates = [yMin, yMax]
        .map((targetY) => solveBoundaryTime(startY, launch.velocity.y, ay, targetY))
        .filter((time): time is number => time != null)
        .filter((time) => {
          const xAtTime = startX + (launch.velocity.x * time) + (0.5 * ax * time * time);
          return xAtTime >= xMin - 1e-6 && xAtTime <= xMax + 1e-6;
        });
      const verticalExitTime = verticalExitCandidates.length > 0 ? Math.min(...verticalExitCandidates) : null;

      if (collisionTime != null && (verticalExitTime == null || collisionTime <= verticalExitTime + 1e-6)) {
        return clampSceneDuration(collisionTime + COLLISION_STOP_BUFFER);
      }

      if (verticalExitTime != null) {
        const exitVx = launch.velocity.x + ax * verticalExitTime;
        const exitVy = launch.velocity.y + ay * verticalExitTime;
        const exitSpeed = Math.hypot(exitVx, exitVy);
        return clampSceneDuration(verticalExitTime + computeTailDuration(height, exitSpeed));
      }

      return clampSceneDuration(2.2);
    }

    return null;
  }

  function applyP08SceneEffects(): void {
    if (!scene) return;

    for (const entity of scene.entities.values()) {
      if (entity.type === 'uniform-efield') {
        const directionMode = entity.properties.fieldDirectionMode as string | undefined;
        if (directionMode === 'upward') {
          entity.properties.direction = { x: 0, y: 1 };
        } else if (directionMode === 'downward') {
          entity.properties.direction = { x: 0, y: -1 };
        } else if (directionMode === 'rightward') {
          entity.properties.direction = { x: 1, y: 0 };
        } else if (directionMode === 'leftward') {
          entity.properties.direction = { x: -1, y: 0 };
        }
        continue;
      }

      if (entity.type === 'current-wire') {
        const wireShape = (entity.properties.wireShape as string | undefined) ?? 'straight';
        entity.properties.current = Math.abs((entity.properties.current as number) ?? 0);

        if (wireShape === 'straight') {
          const length = (entity.properties.length as number) ?? (entity.properties.height as number) ?? 4;
          entity.properties.length = length;
          entity.properties.height = length;
          entity.properties.width = (entity.properties.width as number) ?? 0.1;
          entity.properties.wireDirection = getStraightWireDirectionVector(entity);
        } else {
          const loopRadius = Math.max((entity.properties.loopRadius as number) ?? 1, 0.1);
          entity.properties.loopRadius = loopRadius;
          entity.properties.width = loopRadius * 2;
          entity.properties.height = loopRadius * 2;
        }
        continue;
      }

      if (entity.type === 'solenoid') {
        entity.properties.current = Math.abs((entity.properties.current as number) ?? 0);
        const length = Math.max(
          (entity.properties.length as number) ?? (entity.properties.width as number) ?? 3,
          0.1,
        );
        entity.properties.length = length;
        entity.properties.width = length;
      }
    }

    syncParticleEmitters(scene);
    applyFlowmeterEffects();
    applyCyclotronEffects();
    applyTwoStageEFieldEffects();
    applyElectricMotionSceneEffects();
  }

  function resolveSceneSolver(
    nextScene: SceneDefinition,
    qualifier?: Record<string, string>,
  ): SolverRegistration {
    const matchedSolvers = solverRegistry.match(nextScene, qualifier);
    if (matchedSolvers.length > 0) {
      return matchedSolvers[0]!;
    }

    return {
      id: '__stub__',
      label: '占位求解器',
      pattern: { entityTypes: [], relationType: 'none' },
      solveMode: 'analytical',
      solve: (_scene, sceneTime) => ({
        time: sceneTime,
        forceAnalyses: new Map(),
        motionStates: new Map(),
      }),
    };
  }

  function initializeLoadedScene(config: SimulatorSceneLoadConfig): void {
    scene = config.scene;
    for (const entity of scene.entities.values()) {
      if (entity.type === 'point-charge') {
        syncPointChargeLaunchProperties(entity);
      }
    }

    activeSolver = resolveSceneSolver(scene, config.solverQualifier);
    solveMode = config.solveMode;
    duration = config.duration;
    defaultViewport = config.defaultViewport;
    supportedViewports = config.supportedViewports;
    eventActions = config.eventActions ?? [];
    currentTime = 0;
    status = 'idle';
    resultHistory = [];
    currentResult = null;

    applyTwoChargeFieldEffects();
    applyP08SceneEffects();
    computePrecomputedResults();

    currentResult = solveAtTime(0, 0);
    if (currentResult && solveMode === 'numerical') {
      resultHistory.push(currentResult);
    }
    syncRuntimeEntityProps(currentResult);

    emit('preset-loaded', {
      scene,
      defaultViewport,
      supportedViewports,
    });
  }

  function resetAfterSceneMutation(): void {
    currentTime = 0;
    status = 'idle';
    resultHistory = [];

    computePrecomputedResults();

    currentResult = solveAtTime(0, 0);
    if (currentResult && solveMode === 'numerical') {
      resultHistory.push(currentResult);
    }
    syncRuntimeEntityProps(currentResult);
  }

  // ─── 构建当前 SimulationState 快照 ───

  function buildState(): SimulationState {
    return {
      status,
      solveMode,
      integrator: activeSolver?.integrator ?? 'semi-implicit-euler',
      timeline: {
        currentTime,
        duration,
        playbackRate,
        dt: 1 / 60,
      },
      scene: scene ?? {
        entities: new Map(),
        relations: [],
        paramGroups: [],
        paramValues: {},
      },
      currentResult,
      resultHistory,
    };
  }

  // ─── 公开 API ───

  return {
    loadPreset(preset: PresetData): void {
      let loadResult: PresetLoadResult;
      try {
        loadResult = loadPreset(preset);
      } catch (e) {
        console.error('[Simulator] 预设加载失败:', e);
        throw e;
      }

      activeSolver = loadResult.solver;
      initializeLoadedScene({
        scene: loadResult.scene,
        solveMode: loadResult.solveMode,
        duration: loadResult.duration,
        defaultViewport: loadResult.defaultViewport,
        supportedViewports: loadResult.supportedViewports,
        solverQualifier: preset.solverQualifier,
        eventActions: loadResult.eventActions,
      });
    },

    loadScene(config: SimulatorSceneLoadConfig): void {
      initializeLoadedScene(config);
    },

    unload(): void {
      scene = null;
      activeSolver = null;
      currentResult = null;
      resultHistory = [];
      precomputedResults = null;
      eventActions = [];
      status = 'idle';
      currentTime = 0;
    },

    play(): void {
      if (!scene || !activeSolver) return;
      if (status === 'finished') return;
      status = 'running';
    },

    pause(): void {
      if (status === 'running') {
        status = 'paused';
      }
    },

    reset(): void {
      currentTime = 0;
      status = 'idle';
      resultHistory = [];

      // 重新计算 t=0
      currentResult = solveAtTime(0, 0);
      if (currentResult && solveMode === 'numerical') {
        resultHistory.push(currentResult);
      }
      syncRuntimeEntityProps(currentResult);

      emit('reset', null);
    },

    clearTrajectories(): void {
      if (currentResult) {
        for (const motionState of currentResult.motionStates.values()) {
          motionState.trajectory = [];
        }
      }

      for (const historicalResult of resultHistory) {
        for (const motionState of historicalResult.motionStates.values()) {
          motionState.trajectory = [];
        }
      }
    },

    seekTo(time: number): void {
      const clampedTime = Math.max(0, Math.min(time, duration));

      if (solveMode === 'analytical') {
        currentResult = solveAtTime(clampedTime, 0);
      } else {
        // 数值积分：从 resultHistory 中查找最近帧
        currentResult = findNearestFrame(resultHistory, clampedTime);
      }

      currentTime = clampedTime;
      syncRuntimeEntityProps(currentResult);
    },

    setPlaybackRate(rate: number): void {
      playbackRate = rate;
    },

    updateParam(paramKey: string, value: ParamValues[string]): void {
      if (!scene) return;

      applyParamValue(paramKey, value);
      applyTwoChargeFieldEffects(paramKey);
      applyP08SceneEffects();
      resetAfterSceneMutation();
    },

    updateEntityPosition(entityId: string, position: Vec2): void {
      if (!scene) return;

      updatePointChargePosition(entityId, position);
      applyP08SceneEffects();
      resetAfterSceneMutation();
    },

    step(dt: number): void {
      if (status !== 'running' || !scene || !activeSolver) return;

      // ① 计算实际 dt
      const effectiveDt = Math.min(dt * playbackRate, MAX_DT);

      // ② 推进时间
      let newTime = currentTime + effectiveDt;
      if (newTime >= duration) {
        newTime = duration;
        status = 'finished';
      }

      // ③ 求解
      const prevResult = currentResult;
      const result = solveAtTime(newTime, effectiveDt);

      if (result) {
        // ④ 事件检测
        runEventDetection(prevResult, result);

        // ⑤ 状态更新
        currentResult = result;
        currentTime = newTime;
        syncRuntimeEntityProps(currentResult);

        if (solveMode === 'numerical') {
          resultHistory.push(result);
        }

        // ⑥ 通知渲染
        emit('frame', { time: newTime, result });
      }

      // ⑦ 循环控制
      if (status === 'finished') {
        emit('finished', { time: newTime });
      }
    },

    getState(): SimulationState {
      return buildState();
    },

    getCurrentResult(): PhysicsResult | null {
      return currentResult;
    },

    on(event: SimulatorEvent, handler: SimulatorEventHandler): void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    },

    off(event: SimulatorEvent, handler: SimulatorEventHandler): void {
      listeners.get(event)?.delete(handler);
    },
  };
}

// ─── 工具函数：设置嵌套属性 ───

function setNestedProperty(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  const lastKey = keys[keys.length - 1];
  if (!lastKey) return;

  if (keys.length === 1) {
    obj[lastKey] = value;
    return;
  }

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[lastKey] = value;
}

function isPointChargeLaunchProperty(path: string): boolean {
  return (
    path === 'initialSpeed' ||
    path === 'initialDirectionDeg' ||
    path === 'initialVelocity' ||
    path.startsWith('initialVelocity.')
  );
}

/** 全局默认 Simulator 实例 */
export const simulator = createSimulator();
