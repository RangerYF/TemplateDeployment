import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult, Vec2 } from '@/core/types';
import { computeFlux, computeInduction } from '../logic/flux-calculator';
import type { MagneticFieldDirection } from '../types';

/**
 * 矩形线框穿过匀强磁场 · 电磁感应求解器
 *
 * 物理场景：
 *   矩形线框以初速度水平穿过匀强磁场区域。
 *   进入/离开磁场时，磁通量变化产生感应电动势和感应电流。
 *   感应电流在磁场中受安培力（阻碍相对运动——楞次定律）。
 *
 * 物理公式：
 *   Φ = B · S_overlap
 *   ε = -dΦ/dt
 *   I = ε / R
 *   F_ampere = B · I · L_eff（有效切割长度）
 *
 * 求解模式：数值积分（semi-implicit-euler）
 *   Phase 1 简化：线框仅水平运动，不考虑安培力对速度的影响（匀速运动）
 *   安培力作为标注信息输出到 ForceAnalysis，但不改变速度
 */

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const frames = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'wire-frame',
  );
  const fields = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'uniform-bfield',
  );

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  for (const frame of frames) {
    const frameW = (frame.properties.width as number) ?? 1;
    const frameH = (frame.properties.height as number) ?? 0.8;
    const resistance = (frame.properties.resistance as number) ?? 2;
    const initVel = (frame.properties.initialVelocity as Vec2) ?? { x: 1, y: 0 };

    // 获取上一帧状态
    const prevMotion = prevResult?.motionStates.get(frame.id);
    const pos: Vec2 = prevMotion
      ? { ...prevMotion.position }
      : { ...frame.transform.position };
    const vel: Vec2 = prevMotion
      ? { ...prevMotion.velocity }
      : { ...initVel };

    // 匀速运动：更新位置
    const newX = pos.x + vel.x * dt;
    const newY = pos.y + vel.y * dt;
    const newPos: Vec2 = { x: newX, y: newY };

    // 计算当前帧磁通量
    const currentFluxResult = computeFlux(newPos, frameW, frameH, fields);

    // 获取上一帧磁通量（从 properties 中读取求解器存储的值）
    const prevFlux = (frame.properties.flux as number) ?? 0;

    // 计算感应电动势和电流
    const induction = computeInduction(
      currentFluxResult.flux,
      prevFlux,
      dt,
      resistance,
      currentFluxResult.overlapArea,
    );

    // 将 EMF/电流/磁通量写回实体 properties（运行时状态）
    frame.properties.emf = induction.emf;
    frame.properties.current = induction.current;
    frame.properties.flux = currentFluxResult.flux;

    // 计算安培力（标注用，不改变速度）
    const forces: Force[] = [];
    const ampereForce = computeAmpereForce(induction.current, frameH, vel, fields);
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
      },
    });

    // 轨迹记录
    const prevTrajectory = prevMotion?.trajectory ?? [];
    const trajectory = [...prevTrajectory];
    const frameIndex = Math.round(time / (dt || 1 / 60));
    if (frameIndex % 3 === 0 || prevTrajectory.length === 0) {
      trajectory.push({ x: newX + frameW / 2, y: newY + frameH / 2 }); // 记录中心点
    }
    if (trajectory.length > 1000) {
      trajectory.splice(0, trajectory.length - 1000);
    }

    motionStates.set(frame.id, {
      entityId: frame.id,
      position: newPos,
      velocity: vel,
      acceleration: { x: 0, y: 0 }, // 匀速
      trajectory,
    });
  }

  return {
    time,
    forceAnalyses,
    motionStates,
  } satisfies PhysicsResult;
};

/**
 * 计算安培力 F = BIL
 *
 * L_eff 是线框与磁场重叠的有效切割边长度（垂直于运动方向的边）。
 * 力方向遵循楞次定律：阻碍磁通量变化，即阻碍相对运动。
 */
function computeAmpereForce(
  current: number,
  frameHeight: number,
  velocity: Vec2,
  fieldEntities: Array<{ properties: Record<string, unknown> }>,
): Force | null {
  if (Math.abs(current) < 1e-9) return null;

  // 获取主磁场参数
  let totalB = 0;
  for (const field of fieldEntities) {
    const mag = (field.properties.magnitude as number) ?? 0;
    const dir = (field.properties.direction as MagneticFieldDirection) ?? 'into';
    // B_z 符号
    totalB += dir === 'out' ? mag : -mag;
  }
  if (Math.abs(totalB) < 1e-9) return null;

  // 有效切割长度 = 线框高度（垂直于水平运动方向的边）
  const lEff = frameHeight;

  // 安培力大小 F = |B| · |I| · L_eff
  const forceMag = Math.abs(totalB) * Math.abs(current) * lEff;

  // 力方向：楞次定律 —— 阻碍相对运动
  // 若线框向右运动（vx > 0）且磁通量增加（进入磁场），
  // 感应电流产生的安培力向左（阻碍进入）
  // 这里通过 F = IL × B 的叉积来计算：
  // 对于水平运动，安培力沿水平方向，与速度反向
  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < 1e-9) return null;

  // 力方向与速度方向相反（楞次定律）
  const dirX = -velocity.x / speed;
  const dirY = -velocity.y / speed;

  return {
    type: 'ampere',
    label: `F安=${forceMag.toFixed(3)}N`,
    magnitude: forceMag,
    direction: { x: dirX, y: dirY },
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
