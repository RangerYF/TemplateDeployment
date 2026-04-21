import type { Vec2 } from '../types';

/** 运动状态（积分器输入/输出） */
export interface IntegratorState {
  position: Vec2;
  velocity: Vec2;
}

/**
 * Semi-implicit Euler（辛欧拉）积分器
 *
 * 先更新速度，再用新速度更新位置。
 * 辛积分器，保能量，一阶精度。
 */
export function semiImplicitEuler(
  state: IntegratorState,
  acceleration: Vec2,
  dt: number,
): IntegratorState {
  // 先更新速度
  const newVelocity: Vec2 = {
    x: state.velocity.x + acceleration.x * dt,
    y: state.velocity.y + acceleration.y * dt,
  };
  // 再用新速度更新位置
  const newPosition: Vec2 = {
    x: state.position.x + newVelocity.x * dt,
    y: state.position.y + newVelocity.y * dt,
  };

  return { position: newPosition, velocity: newVelocity };
}

/**
 * Velocity Verlet 积分器
 *
 * 二阶精度辛积分器，适合周期运动（弹簧振子、天体）。
 * accelerationFn 接收位置和速度，返回加速度。
 */
export function velocityVerlet(
  state: IntegratorState,
  accelerationFn: (position: Vec2, velocity: Vec2) => Vec2,
  dt: number,
): IntegratorState {
  // 当前加速度
  const a = accelerationFn(state.position, state.velocity);

  // 更新位置：x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt^2
  const newPosition: Vec2 = {
    x: state.position.x + state.velocity.x * dt + 0.5 * a.x * dt * dt,
    y: state.position.y + state.velocity.y * dt + 0.5 * a.y * dt * dt,
  };

  // 用新位置计算新加速度
  const aNew = accelerationFn(newPosition, state.velocity);

  // 更新速度：v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
  const newVelocity: Vec2 = {
    x: state.velocity.x + 0.5 * (a.x + aNew.x) * dt,
    y: state.velocity.y + 0.5 * (a.y + aNew.y) * dt,
  };

  return { position: newPosition, velocity: newVelocity };
}
