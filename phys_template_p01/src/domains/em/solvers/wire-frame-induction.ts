import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult, Vec2 } from '@/core/types';
import {
  computeRectangularLoopInductionStep,
  createRectangularLoopSnapshot,
  extractUniformBFieldRegions,
} from '../p13/core';

/**
 * 矩形线框穿过匀强磁场 · 电磁感应求解器
 *
 * Phase 1 目标：
 * - 保留现有矩形线框 demo 的物理行为与展示口径
 * - 将通用感应计算移入 P-13 核心层，solver 只负责场景推进与运行时回写
 * - 安培力仍只做标注，不反作用到速度
 */

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const frames = Array.from(scene.entities.values()).filter(
    (entity) => entity.type === 'wire-frame',
  );
  const fields = Array.from(scene.entities.values()).filter(
    (entity) => entity.type === 'uniform-bfield',
  );

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();
  const fieldRegions = extractUniformBFieldRegions(fields);

  for (const frame of frames) {
    const initVel = (frame.properties.initialVelocity as Vec2) ?? { x: 1, y: 0 };
    const loopBase = createRectangularLoopSnapshot(frame);

    const prevMotion = prevResult?.motionStates.get(frame.id);
    const pos: Vec2 = prevMotion
      ? { ...prevMotion.position }
      : { ...frame.transform.position };
    const vel: Vec2 = prevMotion
      ? { ...prevMotion.velocity }
      : { ...initVel };

    const newPos: Vec2 = {
      x: pos.x + vel.x * dt,
      y: pos.y + vel.y * dt,
    };

    const previousFlux = (frame.properties.flux as number) ?? 0;
    const step = computeRectangularLoopInductionStep({
      loop: {
        ...loopBase,
        position: newPos,
        velocity: vel,
      },
      fields: fieldRegions,
      previousFlux,
      dt,
    });

    frame.properties.emf = step.circuit.emf;
    frame.properties.current = step.circuit.current;
    frame.properties.flux = step.flux.flux;
    frame.properties.inductionRuntime = step.runtime;

    const forces: Force[] = [];
    const ampereForce = toAmpereForce(step.ampereForce);
    if (ampereForce) {
      forces.push(ampereForce);
    }

    const resultantMag = ampereForce?.magnitude ?? 0;
    forceAnalyses.set(frame.id, {
      entityId: frame.id,
      forces,
      resultant: {
        type: 'resultant',
        label: resultantMag > 0.01 ? `F安=${resultantMag.toFixed(3)}N` : 'F安≈0',
        magnitude: resultantMag,
        direction: ampereForce?.direction ?? { x: 0, y: 0 },
        displayMagnitude: resultantMag * 100,
      },
    });

    const prevTrajectory = prevMotion?.trajectory ?? [];
    const trajectory = [...prevTrajectory];
    const frameIndex = Math.round(time / (dt || 1 / 60));
    if (frameIndex % 3 === 0 || prevTrajectory.length === 0) {
      trajectory.push({
        x: newPos.x + loopBase.width / 2,
        y: newPos.y + loopBase.height / 2,
      });
    }
    if (trajectory.length > 1000) {
      trajectory.splice(0, trajectory.length - 1000);
    }

    motionStates.set(frame.id, {
      entityId: frame.id,
      position: newPos,
      velocity: vel,
      acceleration: { x: 0, y: 0 },
      trajectory,
    });
  }

  return {
    time,
    forceAnalyses,
    motionStates,
  } satisfies PhysicsResult;
};

function toAmpereForce(
  sample: ReturnType<typeof computeRectangularLoopInductionStep>['ampereForce'],
): Force | null {
  if (!sample) return null;
  return {
    type: 'ampere',
    label: `F安=${sample.magnitude.toFixed(3)}N`,
    magnitude: sample.magnitude,
    direction: sample.direction,
    displayMagnitude: sample.magnitude * 100,
  };
}

export function registerWireFrameInductionSolver(): void {
  solverRegistry.register({
    id: 'em-wire-frame-induction',
    label: '矩形线框穿过匀强磁场',
    pattern: {
      entityTypes: ['wire-frame', 'uniform-bfield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'induction' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
