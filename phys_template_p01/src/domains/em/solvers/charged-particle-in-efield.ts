import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, Force, ForceAnalysis, MotionState, PhysicsResult, Vec2 } from '@/core/types';
import {
  appendTrajectorySamples,
  ensureTrajectorySeed,
  integrateParticleState2D,
  particleStatePosition,
  particleStateVelocity,
  resolvePointChargeState2D,
} from '../logic/charged-particle-motion';
import { isDetectorScreen, resolveDetectorScreenCollision } from '../logic/detector-screen';
import { computeElectricForce } from '../logic/electric-force';
import { isDynamicPointCharge } from '../logic/point-charge-role';

/**
 * 带电粒子在匀强电场中运动求解器
 *
 * 物理场景：
 * - EMF-011 电场加速：粒子从静止开始加速
 * - EMF-012 电场偏转：粒子以初速度垂直于电场方向射入，做类抛体运动
 *
 * 求解模式：数值积分（semi-implicit-euler）
 */

const MIN_MASS = 1e-6;
const MAX_TRAJECTORY_POINTS = 2400;
const TRAJECTORY_POINT_MIN_DISTANCE = 0.01;
const MAX_SUBSTEP = 1 / 480;

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
  const efields = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'uniform-efield',
  );
  const screens = Array.from(scene.entities.values()).filter(isDetectorScreen);

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  for (const particle of particles) {
    const particleProps = particle.properties as Record<string, unknown>;
    if (!prevResult || time === 0) {
      particleProps.stoppedOnPlate = false;
      particleProps.stoppedOnScreen = false;
      delete particleProps.screenHitEntityId;
      delete particleProps.screenHitPoint;
    }

    const charge = (particle.properties.charge as number) ?? 1;
    const mass = Math.max((particle.properties.mass as number) ?? 1, MIN_MASS);
    const previousMotion = prevResult?.motionStates.get(particle.id);
    const state = resolvePointChargeState2D(particle, previousMotion);
    const trajectory = previousMotion?.trajectory ? [...previousMotion.trajectory] : [];
    ensureTrajectorySeed(trajectory, particleStatePosition(state));

    if (particleProps.stoppedOnPlate === true || particleProps.stoppedOnScreen === true) {
      const stoppedPosition = previousMotion?.position ?? particle.transform.position;
      const zeroVelocity = { x: 0, y: 0 };
      const zeroAcceleration = { x: 0, y: 0 };
      forceAnalyses.set(particle.id, {
        entityId: particle.id,
        forces: [],
        resultant: {
          type: 'resultant',
          label: 'F合≈0',
          magnitude: 0,
          direction: { x: 0, y: 0 },
          displayMagnitude: 0,
        },
      });
      motionStates.set(particle.id, {
        entityId: particle.id,
        position: { ...stoppedPosition },
        velocity: zeroVelocity,
        acceleration: zeroAcceleration,
        trajectory,
        entityPropsPatch: particleProps.stoppedOnPlate === true
          ? {
              stoppedOnPlate: true,
            }
          : {
              stoppedOnScreen: true,
              screenHitEntityId: particleProps.screenHitEntityId,
              screenHitPoint: particleProps.screenHitPoint,
            },
      });
      continue;
    }

    const integration = integrateParticleState2D(state, {
      dt,
      maxSubstep: MAX_SUBSTEP,
      accelerationAt: (currentState) => {
        const electric = computeElectricForce(
          { x: currentState.x, y: currentState.y },
          charge,
          efields,
        );
        if (!electric) {
          return { ax: 0, ay: 0 };
        }
        return {
          ax: electric.fx / mass,
          ay: electric.fy / mass,
        };
      },
    });

    appendTrajectorySamples(trajectory, integration.sampledPositions, {
      minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
      maxPoints: MAX_TRAJECTORY_POINTS,
    });

    const previousPosition = particleStatePosition(state);
    let position = particleStatePosition(integration.state);
    let velocity = particleStateVelocity(integration.state);
    const plateCollision = resolvePlateCollisionStop({
      particle,
      previousPosition,
      nextPosition: position,
      nextVelocity: velocity,
      efields,
    });
    const screenCollision = resolveDetectorScreenCollision({
      particle,
      previousPosition,
      nextPosition: position,
      screens,
    });
    const collision = pickEarlierCollision(plateCollision, screenCollision);

    if (collision) {
      position = collision.position;
      velocity = { x: 0, y: 0 };
      if (collision.type === 'plate') {
        particleProps.stoppedOnPlate = true;
      } else {
        particleProps.stoppedOnScreen = true;
        particleProps.screenHitEntityId = collision.screen.id;
        particleProps.screenHitPoint = collision.position;
      }
      appendTrajectorySamples(trajectory, [position], {
        minDistance: 0,
        maxPoints: MAX_TRAJECTORY_POINTS,
      });
    }

    const currentElectric = collision ? null : computeElectricForce(position, charge, efields);
    const ax = currentElectric ? currentElectric.fx / mass : 0;
    const ay = currentElectric ? currentElectric.fy / mass : 0;
    const forces: Force[] = currentElectric ? [currentElectric.force] : [];
    const resultantMag = Math.hypot(ax * mass, ay * mass);
    const resultant: Force = {
      type: 'resultant',
      label: resultantMag > 0.001 ? `F合=${resultantMag.toFixed(3)}N` : 'F合≈0',
      magnitude: resultantMag,
      direction: resultantMag > 0
        ? { x: (ax * mass) / resultantMag, y: (ay * mass) / resultantMag }
        : { x: 0, y: 0 },
      displayMagnitude: resultantMag * 100,
    };

    forceAnalyses.set(particle.id, {
      entityId: particle.id,
      forces,
      resultant,
    });

    motionStates.set(particle.id, {
      entityId: particle.id,
      position,
      velocity,
      acceleration: { x: ax, y: ay },
      trajectory,
      entityPropsPatch: collision
        ? collision.type === 'plate'
          ? {
              stoppedOnPlate: true,
            }
          : {
              stoppedOnScreen: true,
              screenHitEntityId: collision.screen.id,
              screenHitPoint: collision.position,
            }
        : undefined,
    });
  }

  return {
    time,
    forceAnalyses,
    motionStates,
  } satisfies PhysicsResult;
};

export function registerChargedParticleInEFieldSolver(): void {
  solverRegistry.register({
    id: 'em-charged-particle-in-efield',
    label: '带电粒子在匀强电场中运动',
    pattern: {
      entityTypes: ['point-charge', 'uniform-efield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'electric' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}

function resolvePlateCollisionStop({
  particle,
  previousPosition,
  nextPosition,
  nextVelocity,
  efields,
}: {
  particle: Entity;
  previousPosition: Vec2;
  nextPosition: Vec2;
  nextVelocity: Vec2;
  efields: Entity[];
}): { position: Vec2; progress: number } | null {
  const radius = Math.max((particle.properties.radius as number) ?? 0.12, 0.02);

  for (const field of efields) {
    const showPlates = (field.properties.showPlates as boolean) ?? false;
    const stopOnPlateCollision = (field.properties.stopOnPlateCollision as boolean | undefined) ?? true;
    if (!showPlates || !stopOnPlateCollision) continue;

    const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
    const fieldLeft = field.transform.position.x + radius;
    const fieldRight = field.transform.position.x + ((field.properties.width as number) ?? 0) - radius;
    const fieldBottom = field.transform.position.y + radius;
    const fieldTop = field.transform.position.y + ((field.properties.height as number) ?? 0) - radius;

    if (Math.abs(direction.y) > Math.abs(direction.x)) {
      const wasInsideGap =
        previousPosition.x >= fieldLeft - 1e-6 &&
        previousPosition.x <= fieldRight + 1e-6 &&
        previousPosition.y > fieldBottom + 1e-6 &&
        previousPosition.y < fieldTop - 1e-6;
      const isWithinPlateSpan =
        nextPosition.x >= fieldLeft - 1e-6 &&
        nextPosition.x <= fieldRight + 1e-6;

      if (!wasInsideGap || !isWithinPlateSpan) continue;

      if (nextPosition.y <= fieldBottom && nextVelocity.y < 0) {
        return interpolatePlateCollision(previousPosition, nextPosition, 'y', fieldBottom);
      }
      if (nextPosition.y >= fieldTop && nextVelocity.y > 0) {
        return interpolatePlateCollision(previousPosition, nextPosition, 'y', fieldTop);
      }
      continue;
    }

    const wasInsideGap =
      previousPosition.y >= fieldBottom - 1e-6 &&
      previousPosition.y <= fieldTop + 1e-6 &&
      previousPosition.x > fieldLeft + 1e-6 &&
      previousPosition.x < fieldRight - 1e-6;
    const isWithinPlateSpan =
      nextPosition.y >= fieldBottom - 1e-6 &&
      nextPosition.y <= fieldTop + 1e-6;

    if (!wasInsideGap || !isWithinPlateSpan) continue;

    if (nextPosition.x <= fieldLeft && nextVelocity.x < 0) {
      return interpolatePlateCollision(previousPosition, nextPosition, 'x', fieldLeft);
    }
    if (nextPosition.x >= fieldRight && nextVelocity.x > 0) {
      return interpolatePlateCollision(previousPosition, nextPosition, 'x', fieldRight);
    }
  }

  return null;
}

function interpolatePlateCollision(
  previousPosition: Vec2,
  nextPosition: Vec2,
  collisionAxis: 'x' | 'y',
  boundaryValue: number,
): { position: Vec2; progress: number } {
  const otherAxis = collisionAxis === 'x' ? 'y' : 'x';
  const axisDelta = nextPosition[collisionAxis] - previousPosition[collisionAxis];

  if (Math.abs(axisDelta) < 1e-9) {
    return {
      position: {
        x: collisionAxis === 'x' ? boundaryValue : nextPosition.x,
        y: collisionAxis === 'y' ? boundaryValue : nextPosition.y,
      },
      progress: 0,
    };
  }

  const progress = (boundaryValue - previousPosition[collisionAxis]) / axisDelta;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const otherValue = previousPosition[otherAxis]
    + ((nextPosition[otherAxis] - previousPosition[otherAxis]) * clampedProgress);

  return {
    position: {
      x: collisionAxis === 'x' ? boundaryValue : otherValue,
      y: collisionAxis === 'y' ? boundaryValue : otherValue,
    },
    progress: clampedProgress,
  };
}

function pickEarlierCollision(
  plateCollision: { position: Vec2; progress: number } | null,
  screenCollision: ReturnType<typeof resolveDetectorScreenCollision>,
): { type: 'plate'; position: Vec2 } | { type: 'screen'; position: Vec2; screen: Entity } | null {
  if (plateCollision && (!screenCollision || plateCollision.progress <= screenCollision.progress)) {
    return {
      type: 'plate',
      position: plateCollision.position,
    };
  }

  if (screenCollision) {
    return {
      type: 'screen',
      position: screenCollision.position,
      screen: screenCollision.screen,
    };
  }

  return null;
}
