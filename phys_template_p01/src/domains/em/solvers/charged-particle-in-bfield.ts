import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  appendTrajectorySamples,
  ensureTrajectorySeed,
  integrateParticleState2D,
  particleStatePosition,
  particleStateVelocity,
  resolvePointChargeState2D,
} from '../logic/charged-particle-motion';
import { isDetectorScreen, resolveDetectorScreenCollision } from '../logic/detector-screen';
import { computeLorentzForce, sampleMagneticFieldAtPoint } from '../logic/lorentz-force';
import { isDynamicPointCharge } from '../logic/point-charge-role';

const MIN_MASS = 1e-6;
const MAX_TRAJECTORY_POINTS = 2400;
const TRAJECTORY_POINT_MIN_DISTANCE = 0.01;
const MAX_SUBSTEP = 1 / 480;

/**
 * 带电粒子在匀强磁场中运动求解器
 *
 * 使用二维状态量推进：
 * - 状态 = { x, y, vx, vy }
 * - 磁场内：a = (q / m) * (v × B)
 * - 磁场外：a = 0，保持匀速直线运动
 * - 轨迹只记录积分过程中真实采样到的位置点
 */
const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
  const fields = Array.from(scene.entities.values()).filter((entity) => entity.type === 'uniform-bfield');
  const screens = Array.from(scene.entities.values()).filter(isDetectorScreen);

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  for (const particle of particles) {
    const particleProps = particle.properties as Record<string, unknown>;
    if (!prevResult || time === 0) {
      particleProps.stoppedOnScreen = false;
      delete particleProps.screenHitEntityId;
      delete particleProps.screenHitPoint;
    }

    const charge = (particle.properties.charge as number) ?? 0;
    const mass = Math.max((particle.properties.mass as number) ?? 1, MIN_MASS);
    const previousMotion = prevResult?.motionStates.get(particle.id);
    const state = resolvePointChargeState2D(particle, previousMotion);
    const trajectory = previousMotion?.trajectory ? [...previousMotion.trajectory] : [];
    ensureTrajectorySeed(trajectory, particleStatePosition(state));

    if (particleProps.stoppedOnScreen === true) {
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
        position: previousMotion?.position ?? particle.transform.position,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        trajectory,
        entityPropsPatch: {
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
        const field = sampleMagneticFieldAtPoint(
          { x: currentState.x, y: currentState.y },
          fields,
        );

        if (!field.inField) {
          return { ax: 0, ay: 0 };
        }

        const chargeToMassRatio = charge / mass;
        return {
          ax: chargeToMassRatio * currentState.vy * field.signedBz,
          ay: -chargeToMassRatio * currentState.vx * field.signedBz,
        };
      },
    });

    appendTrajectorySamples(trajectory, integration.sampledPositions, {
      minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
      maxPoints: MAX_TRAJECTORY_POINTS,
    });

    let position = particleStatePosition(integration.state);
    let velocity = particleStateVelocity(integration.state);
    const screenCollision = resolveDetectorScreenCollision({
      particle,
      previousPosition: particleStatePosition(state),
      nextPosition: position,
      screens,
    });
    if (screenCollision) {
      position = screenCollision.position;
      velocity = { x: 0, y: 0 };
      particleProps.stoppedOnScreen = true;
      particleProps.screenHitEntityId = screenCollision.screen.id;
      particleProps.screenHitPoint = screenCollision.position;
      appendTrajectorySamples(trajectory, [position], {
        minDistance: 0,
        maxPoints: MAX_TRAJECTORY_POINTS,
      });
    }

    const currentLorentz = screenCollision ? null : computeLorentzForce(position, velocity, charge, fields);
    const ax = currentLorentz ? currentLorentz.fx / mass : 0;
    const ay = currentLorentz ? currentLorentz.fy / mass : 0;
    const currentForceMagnitude = currentLorentz?.force.magnitude ?? 0;

    const resultant: Force = {
      type: 'resultant',
      label: currentForceMagnitude > 0.001 ? `F合=${currentForceMagnitude.toFixed(3)}N` : 'F合≈0',
      magnitude: currentForceMagnitude,
      direction: currentForceMagnitude > 0 && currentLorentz
        ? currentLorentz.force.direction
        : { x: 0, y: 0 },
      displayMagnitude: currentForceMagnitude * 100,
    };

    forceAnalyses.set(particle.id, {
      entityId: particle.id,
      forces: currentLorentz ? [currentLorentz.force] : [],
      resultant,
    });

    motionStates.set(particle.id, {
      entityId: particle.id,
      position,
      velocity,
      acceleration: { x: ax, y: ay },
      trajectory,
      entityPropsPatch: screenCollision
        ? {
            stoppedOnScreen: true,
            screenHitEntityId: screenCollision.screen.id,
            screenHitPoint: screenCollision.position,
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

export function registerChargedParticleInBFieldSolver(): void {
  solverRegistry.register({
    id: 'em-charged-particle-in-bfield',
    label: '带电粒子在匀强磁场中运动',
    pattern: {
      entityTypes: ['point-charge', 'uniform-bfield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'magnetic' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
