import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  appendTrajectorySamples,
  ensureTrajectorySeed,
} from '../logic/charged-particle-motion';
import {
  angularAccelerationForCircle,
  ELECTROGRAVITY_DETACHED_FLAG,
  ELECTROGRAVITY_RELEASE_ANGLE_FLAG,
  ELECTROGRAVITY_RELEASE_POINT_FLAG,
  ELECTROGRAVITY_RELEASE_SPEED_FLAG,
  electricForceVector,
  getCirclePosition,
  getCircleTangent,
  getElectrogravityCircleConfig,
  gravityForceVector,
  isElectrogravityCircleScene,
  omegaFromCircleVelocity,
  resultantAccelerationForCircle,
  speedFromOmega,
  tensionForCircle,
  angleFromCirclePosition,
  getCircleInwardNormal,
} from '../logic/electrogravity-circular-motion';
import { getPointChargeLaunchState } from '../logic/point-charge-kinematics';

const MAX_SUBSTEP = 1 / 240;
const MAX_TRAJECTORY_POINTS = 2400;
const TRAJECTORY_POINT_MIN_DISTANCE = 0.01;
const STOP_EPSILON = 1e-6;

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const particles = Array.from(scene.entities.values()).filter((entity) => entity.type === 'point-charge');
  const efields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-efield');
  const particle = particles.find((entity) => isElectrogravityCircleScene(entity, efields[0]));
  const field = efields[0];

  if (!particle || !field) {
    return {
      time,
      forceAnalyses: new Map(),
      motionStates: new Map(),
    } satisfies PhysicsResult;
  }

  const config = getElectrogravityCircleConfig(particle, field);
  const particleProps = particle.properties as Record<string, unknown>;
  if (!prevResult || time === 0) {
    delete particleProps[ELECTROGRAVITY_DETACHED_FLAG];
    delete particleProps[ELECTROGRAVITY_RELEASE_POINT_FLAG];
    delete particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG];
    delete particleProps[ELECTROGRAVITY_RELEASE_SPEED_FLAG];
  }

  const previousMotion = prevResult?.motionStates.get(particle.id);
  const detachedFromTrack = particleProps[ELECTROGRAVITY_DETACHED_FLAG] === true;
  const previousSpeed = previousMotion
    ? Math.hypot(previousMotion.velocity.x, previousMotion.velocity.y)
    : 0;
  const previousAcceleration = previousMotion
    ? Math.hypot(previousMotion.acceleration.x, previousMotion.acceleration.y)
    : 0;

  if (
    previousMotion &&
    time > 0 &&
    previousSpeed < STOP_EPSILON &&
    previousAcceleration < STOP_EPSILON
  ) {
    const stoppedAnalysis = buildForceAnalysis(config, previousMotion, 0, true);
    return {
      time,
      forceAnalyses: new Map([[particle.id, stoppedAnalysis]]),
      motionStates: new Map([[particle.id, {
        ...previousMotion,
        entityPropsPatch: detachedFromTrack
          ? buildDetachedProps(particleProps)
          : undefined,
      }]]),
    } satisfies PhysicsResult;
  }

  if (detachedFromTrack && previousMotion) {
    const detachedMotion = integrateDetachedMotion(config, previousMotion, dt);
    const detachedSpeed = Math.hypot(detachedMotion.velocity.x, detachedMotion.velocity.y);
    const detachedAnalysis = buildForceAnalysis(config, detachedMotion, detachedSpeed, true);
    return {
      time,
      forceAnalyses: new Map([[particle.id, detachedAnalysis]]),
      motionStates: new Map([[particle.id, {
        ...detachedMotion,
        entityPropsPatch: buildDetachedProps(particleProps),
      }]]),
    } satisfies PhysicsResult;
  }

  const launch = getPointChargeLaunchState(particle);
  let angle = previousMotion
    ? angleFromCirclePosition(config, previousMotion.position)
    : 0;
  let omega = previousMotion
    ? omegaFromCircleVelocity(config, angle, previousMotion.velocity)
    : (launch.velocity.x >= 0 ? 1 : -1) * (launch.speed / config.radius);

  const trajectory = previousMotion?.trajectory ? [...previousMotion.trajectory] : [];
  ensureTrajectorySeed(trajectory, getCirclePosition(config, angle));

  const stepCount = dt > 0
    ? Math.max(1, Math.ceil(dt / MAX_SUBSTEP))
    : 0;
  const stepDt = stepCount > 0 ? dt / stepCount : 0;
  const sampledPositions = [];
  let detachedMotion: MotionState | null = null;

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    const alpha = angularAccelerationForCircle(config, angle);
    omega += alpha * stepDt;
    angle += omega * stepDt;

    const position = getCirclePosition(config, angle);
    sampledPositions.push(position);

    const speed = speedFromOmega(config, omega);
    const tension = tensionForCircle(config, speed, angle);

    if (tension <= 0) {
      particleProps[ELECTROGRAVITY_DETACHED_FLAG] = true;
      particleProps[ELECTROGRAVITY_RELEASE_POINT_FLAG] = { ...position };
      particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG] = angle;
      particleProps[ELECTROGRAVITY_RELEASE_SPEED_FLAG] = speed;
      appendTrajectorySamples(trajectory, sampledPositions, {
        minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
        maxPoints: MAX_TRAJECTORY_POINTS,
      });
      const tangent = getCircleTangent(angle);
      const remainingDt = Math.max(dt - ((stepIndex + 1) * stepDt), 0);
      detachedMotion = integrateDetachedMotion(config, {
        entityId: particle.id,
        position,
        velocity: {
          x: tangent.x * omega * config.radius,
          y: tangent.y * omega * config.radius,
        },
        acceleration: detachedAcceleration(config),
        angularVelocity: 0,
        trajectory,
      }, remainingDt);
      break;
    }
  }

  if (detachedMotion) {
    const detachedSpeed = Math.hypot(detachedMotion.velocity.x, detachedMotion.velocity.y);
    const forceAnalysis = buildForceAnalysis(config, detachedMotion, detachedSpeed, true);
    return {
      time,
      forceAnalyses: new Map([[particle.id, forceAnalysis]]),
      motionStates: new Map([[particle.id, {
        ...detachedMotion,
        entityPropsPatch: buildDetachedProps(particleProps),
      }]]),
    } satisfies PhysicsResult;
  }

  appendTrajectorySamples(trajectory, sampledPositions, {
    minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
    maxPoints: MAX_TRAJECTORY_POINTS,
  });

  const position = getCirclePosition(config, angle);
  const tangent = getCircleTangent(angle);
  const speed = speedFromOmega(config, omega);
  const motion: MotionState = {
    entityId: particle.id,
    position,
    velocity: {
      x: tangent.x * omega * config.radius,
      y: tangent.y * omega * config.radius,
    },
    acceleration: resultantAccelerationForCircle(config, angle, omega),
    angularVelocity: omega,
    trajectory,
  };

  const forceAnalysis = buildForceAnalysis(config, motion, speed, false);

  return {
    time,
    forceAnalyses: new Map([[particle.id, forceAnalysis]]),
    motionStates: new Map([[particle.id, motion]]),
  } satisfies PhysicsResult;
};

function detachedAcceleration(
  config: ReturnType<typeof getElectrogravityCircleConfig>,
): { x: number; y: number } {
  return {
    x: (config.charge * config.fieldMagnitude * config.fieldDirection.x) / config.mass,
    y: config.electricAccelerationY - config.gravity,
  };
}

function integrateDetachedMotion(
  config: ReturnType<typeof getElectrogravityCircleConfig>,
  initialMotion: MotionState,
  dt: number,
): MotionState {
  const trajectory = initialMotion.trajectory ? [...initialMotion.trajectory] : [];
  ensureTrajectorySeed(trajectory, initialMotion.position);

  const acceleration = detachedAcceleration(config);
  if (dt <= 0) {
    return {
      ...initialMotion,
      acceleration,
      angularVelocity: 0,
      trajectory,
    };
  }

  const stepCount = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  const stepDt = dt / stepCount;
  const sampledPositions = [];
  const position = { ...initialMotion.position };
  const velocity = { ...initialMotion.velocity };

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    velocity.x += acceleration.x * stepDt;
    velocity.y += acceleration.y * stepDt;
    position.x += velocity.x * stepDt;
    position.y += velocity.y * stepDt;
    sampledPositions.push({ ...position });
  }

  appendTrajectorySamples(trajectory, sampledPositions, {
    minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
    maxPoints: MAX_TRAJECTORY_POINTS,
  });

  return {
    entityId: initialMotion.entityId,
    position,
    velocity,
    acceleration,
    angularVelocity: 0,
    trajectory,
  };
}

function buildDetachedProps(
  particleProps: Record<string, unknown>,
): Record<string, unknown> {
  return {
    [ELECTROGRAVITY_DETACHED_FLAG]: true,
    ...(particleProps[ELECTROGRAVITY_RELEASE_POINT_FLAG] != null
      ? { [ELECTROGRAVITY_RELEASE_POINT_FLAG]: particleProps[ELECTROGRAVITY_RELEASE_POINT_FLAG] }
      : {}),
    ...(particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG] != null
      ? { [ELECTROGRAVITY_RELEASE_ANGLE_FLAG]: particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG] }
      : {}),
    ...(particleProps[ELECTROGRAVITY_RELEASE_SPEED_FLAG] != null
      ? { [ELECTROGRAVITY_RELEASE_SPEED_FLAG]: particleProps[ELECTROGRAVITY_RELEASE_SPEED_FLAG] }
      : {}),
  };
}

function buildForceAnalysis(
  config: ReturnType<typeof getElectrogravityCircleConfig>,
  motion: MotionState,
  speed: number,
  detached: boolean,
): ForceAnalysis {
  const angle = angleFromCirclePosition(config, motion.position);
  const inward = getCircleInwardNormal(angle);
  const gravityVector = gravityForceVector(config);
  const electricVector = electricForceVector(config);
  const tension = detached ? 0 : Math.max(tensionForCircle(config, speed, angle), 0);

  const forces: Force[] = [
    buildForce('gravity', gravityVector, 'G'),
    buildForce('electric', electricVector, 'qE'),
  ];

  if (tension > STOP_EPSILON) {
    forces.push({
      type: 'tension',
      label: `绳拉力 T=${tension.toFixed(2)}N`,
      magnitude: tension,
      direction: inward,
      displayMagnitude: tension * 28,
    });
  }

  const resultantVector = {
    x: motion.acceleration.x * config.mass,
    y: motion.acceleration.y * config.mass,
  };
  const resultantMagnitude = Math.hypot(resultantVector.x, resultantVector.y);

  return {
    entityId: motion.entityId,
    forces,
    resultant: {
      type: 'resultant',
      label: resultantMagnitude > STOP_EPSILON
        ? `${detached ? '脱轨后 ' : ''}F合=${resultantMagnitude.toFixed(2)}N`
        : 'F合≈0',
      magnitude: resultantMagnitude,
      direction: resultantMagnitude > STOP_EPSILON
        ? {
          x: resultantVector.x / resultantMagnitude,
          y: resultantVector.y / resultantMagnitude,
        }
        : { x: 0, y: 0 },
      displayMagnitude: resultantMagnitude * 30,
    },
  };
}

function buildForce(
  type: 'gravity' | 'electric',
  vector: { x: number; y: number },
  symbol: string,
): Force {
  const magnitude = Math.hypot(vector.x, vector.y);
  return {
    type,
    label: magnitude > STOP_EPSILON ? `${symbol}=${magnitude.toFixed(2)}N` : `${symbol}≈0`,
    magnitude,
    direction: magnitude > STOP_EPSILON
      ? { x: vector.x / magnitude, y: vector.y / magnitude }
      : { x: 0, y: 0 },
    displayMagnitude: magnitude * 28,
  };
}

export function registerElectrogravityCircularMotionSolver(): void {
  solverRegistry.register({
    id: 'em-electrogravity-circular-motion',
    label: '静电场与重力场圆周运动',
    pattern: {
      entityTypes: ['point-charge', 'uniform-efield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'electrogravity-circular' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
    priority: 20,
  });
}
