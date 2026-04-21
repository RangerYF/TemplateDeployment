import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { isochoricPressure, paToCmHg } from '../logic/gas-law-utils';

/**
 * 等容过程求解器 (THM-013)
 *
 * p/T = const (V 不变)
 * 用户调节 T2 → 自动计算 p2
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  if (!gasColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p1 = (gasColumn.properties.initialPressure as number) ?? 101325;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;

  // 等容过程：p2 = p1 * T2 / T1
  const p2 = isochoricPressure(p1, T1, T2);

  // 更新气柱属性
  gasColumn.properties.pressure = p2;

  // 生成 p-T 图表数据（等容线 — 过原点直线）
  const chartData: Array<{ x: number; y: number }> = [];
  const tMin = Math.min(T1, T2) * 0.5;
  const tMax = Math.max(T1, T2) * 1.5;
  for (let i = 0; i <= 40; i++) {
    const t = tMin + (i / 40) * (tMax - tMin);
    chartData.push({
      x: t,
      y: paToCmHg(isochoricPressure(p1, T1, t)),
    });
  }
  gasColumn.properties.chartData = chartData;
  gasColumn.properties.chartType = 'p-T';

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerIsochoricProcessSolver(): void {
  solverRegistry.register({
    id: 'thm-isochoric-process',
    label: '等容过程',
    pattern: {
      entityTypes: ['gas-container', 'gas-column'],
      relationType: 'contains',
      qualifier: { thermal: 'isochoric' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
