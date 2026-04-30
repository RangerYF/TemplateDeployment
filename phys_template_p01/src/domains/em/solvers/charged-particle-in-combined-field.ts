import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, Force, ForceAnalysis, MotionState, PhysicsResult, Vec2 } from '@/core/types';
import {
  appendTrajectorySamples,
  ensureTrajectorySeed,
  integrateParticleState2D,
} from '../logic/charged-particle-motion';
import { isDetectorScreen, resolveDetectorScreenCollision } from '../logic/detector-screen';
import { computeElectricForce } from '../logic/electric-force';
import {
  getFlowmeterSceneValues,
  getFlowmeterTeachingState,
} from '../logic/flowmeter-teaching';
import { computeLorentzForce } from '../logic/lorentz-force';
import { isDynamicPointCharge } from '../logic/point-charge-role';

/**
 * 带电粒子在复合场（电场 + 磁场）中运动求解器
 *
 * 物理场景：
 * - EMF-041 速度选择器：qE = qvB，只有 v = E/B 的粒子直线通过
 * - EMF-042 回旋加速器：粒子在磁场中做圆周运动，经过电场区域加速
 * - EMF-043 电磁流量计：导电流体在磁场中产生电场
 *
 * 求解模式：数值积分（semi-implicit-euler）
 * 合力：F = qE + q(v × B)
 */

const MIN_MASS = 1e-6;
const MAX_SUBSTEP = 1 / 480;
const MAX_TRAJECTORY_POINTS = 3000;
const TRAJECTORY_POINT_MIN_DISTANCE = 0.01;

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const particles = Array.from(scene.entities.values()).filter(isDynamicPointCharge);
  const efields = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'uniform-efield',
  );
  const bfields = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'uniform-bfield',
  );
  const screens = Array.from(scene.entities.values()).filter(isDetectorScreen);

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();
  const flowmeterSceneValues = getFlowmeterSceneValues(scene.entities.values(), scene.paramValues);
  const flowmeterTeachingState = flowmeterSceneValues
    ? getFlowmeterTeachingState({
      time,
      speed: flowmeterSceneValues.speed,
      magneticField: flowmeterSceneValues.magneticField,
      pipeDiameter: flowmeterSceneValues.pipeDiameter,
    })
    : null;
  const electricFieldsForSolver = flowmeterTeachingState
    ? efields.map((field) => ({
      ...field,
      properties: {
        ...field.properties,
        magnitude: flowmeterTeachingState.currentElectricField,
        voltage: flowmeterTeachingState.currentVoltage,
      },
    }))
    : efields;

  for (const particle of particles) {
    const particleProps = particle.properties as Record<string, unknown>;
    if (!prevResult || time === 0) {
      particleProps.stoppedOnScreen = false;
      delete particleProps.screenHitEntityId;
      delete particleProps.screenHitPoint;
    }

    const charge = (particle.properties.charge as number) ?? 1;
    const mass = Math.max((particle.properties.mass as number) ?? 1, MIN_MASS);
    const initVel = (particle.properties.initialVelocity as Vec2) ?? { x: 0, y: 0 };

    // 获取上一帧状态
    const prevMotion = prevResult?.motionStates.get(particle.id);
    if (particleProps.stoppedOnScreen === true) {
      motionStates.set(particle.id, {
        entityId: particle.id,
        position: prevMotion?.position ?? particle.transform.position,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
        trajectory: prevMotion?.trajectory ?? [],
        entityPropsPatch: {
          stoppedOnScreen: true,
          screenHitEntityId: particleProps.screenHitEntityId,
          screenHitPoint: particleProps.screenHitPoint,
        },
      });
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
      continue;
    }

    const pos: Vec2 = prevMotion
      ? { ...prevMotion.position }
      : { ...particle.transform.position };
    const vel: Vec2 = prevMotion
      ? { ...prevMotion.velocity }
      : { ...initVel };
    const trajectory = prevMotion?.trajectory ? [...prevMotion.trajectory] : [];
    ensureTrajectorySeed(trajectory, pos);
    const isFlowmeterParticle = flowmeterTeachingState != null && flowmeterSceneValues != null;

    // Semi-implicit Euler 积分
    const flowSpeed = isFlowmeterParticle ? flowmeterSceneValues.speed : null;
    const initialEvaluation = evaluateCombinedFieldState({
      position: pos,
      velocity: vel,
      charge,
      mass,
      efields: electricFieldsForSolver,
      bfields,
      flowSpeed,
      collectForces: false,
    });

    const nonFlowmeterIntegration = !isFlowmeterParticle
      ? integrateParticleState2D(
        {
          x: pos.x,
          y: pos.y,
          vx: vel.x,
          vy: vel.y,
        },
        {
          dt,
          maxSubstep: MAX_SUBSTEP,
          accelerationAt: (currentState) => {
            const evaluation = evaluateCombinedFieldState({
              position: { x: currentState.x, y: currentState.y },
              velocity: { x: currentState.vx, y: currentState.vy },
              charge,
              mass,
              efields: electricFieldsForSolver,
              bfields,
              flowSpeed: null,
              collectForces: false,
            });
            return { ax: evaluation.ax, ay: evaluation.ay };
          },
        },
      )
      : null;

    const {
      x: newX,
      y: newY,
      vx: newVx,
      vy: newVy,
      sampledPositions,
    } = isFlowmeterParticle
      ? integrateFlowmeterParticle({
        particle,
        position: pos,
        velocity: vel,
        acceleration: { x: initialEvaluation.ax, y: initialEvaluation.ay },
        dt,
        flowSpeed: flowmeterSceneValues.speed,
        guideField: initialEvaluation.effectiveEFields[0],
      })
      : {
        vx: nonFlowmeterIntegration!.state.vx,
        vy: nonFlowmeterIntegration!.state.vy,
        x: nonFlowmeterIntegration!.state.x,
        y: nonFlowmeterIntegration!.state.y,
        sampledPositions: nonFlowmeterIntegration!.sampledPositions,
      };

    // 轨迹采样
    appendTrajectorySamples(
      trajectory,
      sampledPositions,
      {
        minDistance: TRAJECTORY_POINT_MIN_DISTANCE,
        maxPoints: MAX_TRAJECTORY_POINTS,
      },
    );

    let nextPosition = { x: newX, y: newY };
    let nextVelocity = { x: newVx, y: newVy };
    const screenCollision = resolveDetectorScreenCollision({
      particle,
      previousPosition: pos,
      nextPosition,
      screens,
    });
    if (screenCollision) {
      nextPosition = screenCollision.position;
      nextVelocity = { x: 0, y: 0 };
      particleProps.stoppedOnScreen = true;
      particleProps.screenHitEntityId = screenCollision.screen.id;
      particleProps.screenHitPoint = screenCollision.position;
      appendTrajectorySamples(trajectory, [{ ...nextPosition }], {
        minDistance: 0,
        maxPoints: MAX_TRAJECTORY_POINTS,
      });
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
    } else {
      const finalEvaluation = evaluateCombinedFieldState({
        position: nextPosition,
        velocity: nextVelocity,
        charge,
        mass,
        efields: electricFieldsForSolver,
        bfields,
        flowSpeed,
      });
      const resultantFx = finalEvaluation.ax * mass;
      const resultantFy = finalEvaluation.ay * mass;
      const resultantMag = Math.hypot(resultantFx, resultantFy);
      const EM_FORCE_DISPLAY_SCALE = 100;

      forceAnalyses.set(particle.id, {
        entityId: particle.id,
        forces: finalEvaluation.forces,
        resultant: {
          type: 'resultant',
          label: 'F合',
          magnitude: resultantMag,
          direction: resultantMag > 0
            ? { x: resultantFx / resultantMag, y: resultantFy / resultantMag }
            : { x: 0, y: 0 },
          displayMagnitude: resultantMag * EM_FORCE_DISPLAY_SCALE,
        },
      });
    }

    motionStates.set(particle.id, {
      entityId: particle.id,
      position: nextPosition,
      velocity: nextVelocity,
      acceleration: screenCollision
        ? { x: 0, y: 0 }
        : (() => {
          const finalAcceleration = evaluateCombinedFieldState({
            position: nextPosition,
            velocity: nextVelocity,
            charge,
            mass,
            efields: electricFieldsForSolver,
            bfields,
            flowSpeed,
            collectForces: false,
          });
          return { x: finalAcceleration.ax, y: finalAcceleration.ay };
        })(),
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

const FLOWMETER_TRANSVERSE_DAMPING = 4.8;
const FLOWMETER_MAX_TRANSVERSE_SPEED = 2.4;

interface CombinedFieldEvaluation {
  forces: Force[];
  ax: number;
  ay: number;
  effectiveEFields: Entity[];
}

function evaluateCombinedFieldState({
  position,
  velocity,
  charge,
  mass,
  efields,
  bfields,
  flowSpeed,
  collectForces = true,
}: {
  position: Vec2;
  velocity: Vec2;
  charge: number;
  mass: number;
  efields: Entity[];
  bfields: Entity[];
  flowSpeed: number | null;
  collectForces?: boolean;
}): CombinedFieldEvaluation {
  const forces: Force[] = [];
  const effectiveEFields = resolveEffectiveEFields(efields, position, velocity);
  let ax = 0;
  let ay = 0;

  const electricResult = computeElectricForce(position, charge, effectiveEFields);
  if (electricResult) {
    if (collectForces) {
      forces.push(electricResult.force);
    }
    ax += electricResult.fx / mass;
    ay += electricResult.fy / mass;
  }

  const lorentzVelocity = flowSpeed != null ? { x: flowSpeed, y: 0 } : velocity;
  const lorentzResult = computeLorentzForce(position, lorentzVelocity, charge, bfields);
  if (lorentzResult) {
    if (collectForces) {
      forces.push(lorentzResult.force);
    }
    ax += lorentzResult.fx / mass;
    ay += lorentzResult.fy / mass;
  }

  if (flowSpeed != null && Math.abs(velocity.y) > 1e-6) {
    const dampingFy = -mass * FLOWMETER_TRANSVERSE_DAMPING * velocity.y;
    const dampingMagnitude = Math.abs(dampingFy);
    if (collectForces) {
      forces.push({
        type: 'custom',
        label: dampingMagnitude > 0.01 ? `f阻=${dampingMagnitude.toFixed(2)}N` : 'f阻≈0',
        magnitude: dampingMagnitude,
        direction: dampingMagnitude > 0
          ? { x: 0, y: dampingFy / dampingMagnitude }
          : { x: 0, y: 0 },
        displayMagnitude: dampingMagnitude * 100,
      });
    }
    ay += dampingFy / mass;
  }

  return {
    forces,
    ax,
    ay,
    effectiveEFields,
  };
}

/**
 * 回旋加速器交变电场处理
 *
 * 当粒子穿越电场区域时，根据粒子运动方向翻转电场方向，
 * 使粒子每次经过 D 形盒间隙时都获得加速。
 */
function resolveEffectiveEFields(
  efields: Entity[],
  pos: Vec2,
  vel: Vec2,
): Entity[] {
  return efields.map((field) => {
    if (field.properties.mode !== 'alternating') {
      return field;
    }

    const fieldPos = field.transform.position;
    const fieldWidth = (field.properties.width as number) ?? 0;
    const fieldHeight = (field.properties.height as number) ?? 0;
    const inGap = (
      pos.x >= fieldPos.x &&
      pos.x <= fieldPos.x + fieldWidth &&
      pos.y >= fieldPos.y &&
      pos.y <= fieldPos.y + fieldHeight
    );
    if (!inGap) return field;

    const fieldDir = field.properties.direction as Vec2;
    if (!fieldDir) return field;

    // 根据粒子速度在电场方向上的分量决定电场方向
    // 使电场始终加速粒子（与速度同向）
    const dot = vel.x * fieldDir.x + vel.y * fieldDir.y;
    if (dot >= 0) return field;

    return {
      ...field,
      properties: {
        ...field.properties,
        direction: { x: -fieldDir.x, y: -fieldDir.y },
      },
    };
  });
}

function integrateFlowmeterParticle({
  particle,
  position,
  velocity,
  acceleration,
  dt,
  flowSpeed,
  guideField,
}: {
  particle: { transform: { position: Vec2 }; properties: Record<string, unknown> };
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  dt: number;
  flowSpeed: number;
  guideField: { transform: { position: Vec2 }; properties: Record<string, unknown> } | undefined;
}): { x: number; y: number; vx: number; vy: number; sampledPositions: Vec2[] } {
  let newVy = velocity.y + acceleration.y * dt;
  newVy = Math.max(-FLOWMETER_MAX_TRANSVERSE_SPEED, Math.min(FLOWMETER_MAX_TRANSVERSE_SPEED, newVy));

  let newX = position.x + flowSpeed * dt;
  let newY = position.y + newVy * dt;
  const radius = Math.max((particle.properties.radius as number) ?? 0.1, 0.04);

  if (guideField) {
    const fieldBottom = guideField.transform.position.y + radius * 0.6;
    const fieldTop = guideField.transform.position.y + ((guideField.properties.height as number) ?? 0)
      - radius * 0.6;
    if (newY <= fieldBottom) {
      newY = fieldBottom;
      newVy = 0;
    } else if (newY >= fieldTop) {
      newY = fieldTop;
      newVy = 0;
    }
  }

  if (!Number.isFinite(newX)) {
    newX = position.x;
  }
  if (!Number.isFinite(newY)) {
    newY = position.y;
  }

  return {
    x: newX,
    y: newY,
    vx: flowSpeed,
    vy: newVy,
    sampledPositions: [{ x: newX, y: newY }],
  };
}

export function registerChargedParticleInCombinedFieldSolver(): void {
  solverRegistry.register({
    id: 'em-charged-particle-in-combined-field',
    label: '带电粒子在复合场中运动',
    pattern: {
      entityTypes: ['point-charge', 'uniform-bfield', 'uniform-efield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'combined' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
