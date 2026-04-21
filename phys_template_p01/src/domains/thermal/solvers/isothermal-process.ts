import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { isothermalPressure, m3ToLiters, paToCmHg } from '../logic/gas-law-utils';

/**
 * 等温过程求解器 (THM-011)
 *
 * pV = const (T 不变)
 * 用户调节 V2 → 自动计算 p2
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  if (!gasColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p1 = (gasColumn.properties.initialPressure as number) ?? 101325;
  const V1 = (gasColumn.properties.initialVolume as number) ?? 1e-4;
  const V2 = (gasColumn.properties.volume as number) ?? V1;
  const crossSection = (gasColumn.properties.crossSection as number) ?? 2e-4;

  // 等温过程：p2 = p1 * V1 / V2
  const p2 = isothermalPressure(p1, V1, V2);

  // 更新气柱属性
  gasColumn.properties.pressure = p2;
  gasColumn.properties.length = V2 / crossSection;

  // 生成 p-V 图表数据（等温线）
  const chartData: Array<{ x: number; y: number }> = [];
  const vMin = Math.min(V1, V2) * 0.5;
  const vMax = Math.max(V1, V2) * 1.5;
  for (let i = 0; i <= 40; i++) {
    const v = vMin + (i / 40) * (vMax - vMin);
    chartData.push({
      x: m3ToLiters(v),
      y: paToCmHg(isothermalPressure(p1, V1, v)),
    });
  }
  gasColumn.properties.chartData = chartData;
  gasColumn.properties.chartType = 'p-V';

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerIsothermalProcessSolver(): void {
  solverRegistry.register({
    id: 'thm-isothermal-process',
    label: '等温过程',
    pattern: {
      entityTypes: ['gas-container', 'gas-column'],
      relationType: 'contains',
      qualifier: { thermal: 'isothermal' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
