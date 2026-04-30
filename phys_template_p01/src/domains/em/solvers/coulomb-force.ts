import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';

const K = 8.99e9; // 库仑常数 N·m²/C²

const coulombForceSolver: SolverFunction = (scene, time) => {
  const charges = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'point-charge',
  );

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  for (const charge of charges) {
    const q1Raw = (charge.properties.charge as number) ?? 1;
    const q1 = q1Raw * 1e-6; // μC → C
    const pos1 = charge.transform.position;
    const forces: Force[] = [];

    // 计算其他电荷对此电荷的库仑力
    for (const other of charges) {
      if (other.id === charge.id) continue;

      const q2Raw = (other.properties.charge as number) ?? 1;
      const q2 = q2Raw * 1e-6; // μC → C
      const pos2 = other.transform.position;

      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      const r = Math.hypot(dx, dy);
      if (r < 1e-6) continue; // 避免除零

      const forceMag = K * Math.abs(q1 * q2) / (r * r);
      // 同号排斥（方向从 other 指向 charge），异号吸引（方向从 charge 指向 other）
      const sign = q1 * q2 > 0 ? 1 : -1;
      const dirX = (dx / r) * sign;
      const dirY = (dy / r) * sign;

      forces.push({
        type: 'electric',
        label: `F${other.label ?? ''}`,
        magnitude: forceMag,
        direction: { x: dirX, y: dirY },
        displayMagnitude: forceMag * 100,
      });
    }

    // 合力
    let rx = 0;
    let ry = 0;
    for (const f of forces) {
      rx += f.direction.x * f.magnitude;
      ry += f.direction.y * f.magnitude;
    }
    const resultantMag = Math.hypot(rx, ry);

    forceAnalyses.set(charge.id, {
      entityId: charge.id,
      forces,
      resultant: {
        type: 'resultant',
        label: 'F合',
        magnitude: resultantMag,
        direction: resultantMag > 0 ? { x: rx / resultantMag, y: ry / resultantMag } : { x: 0, y: 0 },
        displayMagnitude: resultantMag * 100,
      },
    });

    motionStates.set(charge.id, {
      entityId: charge.id,
      position: pos1,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    });
  }

  const result: PhysicsResult = {
    time,
    forceAnalyses,
    motionStates,
  };

  return result;
};

export function registerCoulombForceSolver(): void {
  solverRegistry.register({
    id: 'em-coulomb-force',
    label: '库仑力',
    pattern: {
      entityTypes: ['point-charge'],
      relationType: 'coulomb',
      qualifier: { interaction: 'electrostatic' },
    },
    solveMode: 'analytical',
    solve: coulombForceSolver,
  });
}
