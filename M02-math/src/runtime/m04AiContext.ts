import { useM04UiStore } from '@/editor/store/m04UiStore';
import { useUnitCircleStore } from '@/editor/store/unitCircleStore';
import { useM04FunctionStore } from '@/editor/store/m04FunctionStore';
import { useTriangleSolverStore } from '@/editor/store/triangleSolverStore';
import { useTrigStore } from '@/editor/store/trigStore';
import type { FnType, SolveMode } from '@/types';

export interface M04AiContext {
  templateKey: 'm04';
  appMode: 'trig' | 'triangle';
  unitCircle: ReturnType<ReturnType<typeof useUnitCircleStore.getState>['getSnapshot']> & {
    angleDeg: number;
    anglePiMultiple: number;
  };
  functionGraph: ReturnType<ReturnType<typeof useM04FunctionStore.getState>['getSnapshot']>;
  triangleSolver: ReturnType<ReturnType<typeof useTriangleSolverStore.getState>['getSnapshot']>;
  legacyTrigComparison: ReturnType<ReturnType<typeof useTrigStore.getState>['getSnapshot']>;
  supportedFnTypes: FnType[];
  supportedSolveModes: SolveMode[];
  supportedPresetScenes: string[];
  notes: string[];
}

export function buildM04AiContext(): M04AiContext {
  const unitCircle = useUnitCircleStore.getState().getSnapshot();

  return {
    templateKey: 'm04',
    appMode: useM04UiStore.getState().appMode,
    unitCircle: {
      ...structuredClone(unitCircle),
      angleDeg: unitCircle.angleRad * 180 / Math.PI,
      anglePiMultiple: unitCircle.angleRad / Math.PI,
    },
    functionGraph: structuredClone(useM04FunctionStore.getState().getSnapshot()),
    triangleSolver: structuredClone(useTriangleSolverStore.getState().getSnapshot()),
    legacyTrigComparison: structuredClone(useTrigStore.getState().getSnapshot()),
    supportedFnTypes: ['sin', 'cos', 'tan'],
    supportedSolveModes: ['SSS', 'SAS', 'ASA', 'AAS', 'SSA'],
    supportedPresetScenes: [
      'standard-sine',
      'phase-shift',
      'amplitude-frequency',
      'unit-circle-special-angle',
      'five-point-sine',
      'auxiliary-angle',
      'triangle-345',
    ],
    notes: [
      'M04 AI 优先使用 operations 控制单位圆、三角函数图像、五点法、辅助角公式和三角形解算。',
      '角度可以用 angleRad、angleDeg 或 piMultiple 表示；不要同时写多个互相矛盾的角度字段。',
      '三角形解算结果由 M04 solveSolveMode 计算，AI 只提供模式和输入边角。',
      'legacyTrigComparison 是旧双图对比状态，当前主界面优先使用 functionGraph。',
    ],
  };
}
