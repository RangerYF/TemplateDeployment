import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { isobaricVolume, m3ToLiters } from '../logic/gas-law-utils';

/**
 * 等压过程求解器 (THM-012)
 *
 * V/T = const (p 不变)
 * 用户调节 T2 → 自动计算 V2
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  if (!gasColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const V1 = (gasColumn.properties.initialVolume as number) ?? 1e-4;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;
  const crossSection = (gasColumn.properties.crossSection as number) ?? 2e-4;

  // 等压过程：V2 = V1 * T2 / T1
  const V2 = isobaricVolume(V1, T1, T2);

  // 更新气柱属性
  gasColumn.properties.volume = V2;
  gasColumn.properties.length = V2 / crossSection;

  // 生成 V-T 图表数据（等压线 — 过原点直线）
  const chartData: Array<{ x: number; y: number }> = [];
  const tMin = Math.min(T1, T2) * 0.5;
  const tMax = Math.max(T1, T2) * 1.5;
  for (let i = 0; i <= 40; i++) {
    const t = tMin + (i / 40) * (tMax - tMin);
    chartData.push({
      x: t,
      y: m3ToLiters(isobaricVolume(V1, T1, t)),
    });
  }
  gasColumn.properties.chartData = chartData;
  gasColumn.properties.chartType = 'V-T';

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerIsobaricProcessSolver(): void {
  solverRegistry.register({
    id: 'thm-isobaric-process',
    label: '等压过程',
    pattern: {
      entityTypes: ['gas-container', 'gas-column'],
      relationType: 'contains',
      qualifier: { thermal: 'isobaric' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
