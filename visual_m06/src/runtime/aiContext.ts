import { ALL_PRESETS, getPresetById, getPresetsByOperation } from '@/data/presets';
import { OPERATION_META, type OperationType } from '@/editor/entities/types';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import type { DemoVecOp, DemoVector } from '@/editor/demo/demoTypes';
import { useDemoToolStore } from '@/editor/demo/demoToolStore';
import { useUIStore, useVectorStore } from '@/editor/store';
import {
  add2D,
  add3D,
  angle2D,
  angle3D,
  cross2D,
  cross3D,
  decomposeVector,
  dot2D,
  dot3D,
  mag2D,
  mag3D,
  projectVec2D,
  projection2D,
  scale2D,
  sub2D,
  sub3D,
  toDeg,
} from '@/engine/vectorMath';

type VecSummary = {
  value: number[];
  magnitude: number;
};

type DerivedSummary = Record<string, unknown>;

export type M06AiContext = {
  templateKey: 'm06';
  summary: string;
  currentOperation: {
    id: OperationType;
    label: string;
    dimension: string;
    description: string;
  };
  vectors: {
    vecA: VecSummary;
    vecB: VecSummary;
    vecA3: VecSummary;
    vecB3: VecSummary;
    scalarK: number;
    chainVecs: number[][];
    decompTarget: VecSummary;
    basis1: VecSummary;
    basis2: VecSummary;
  };
  derived: DerivedSummary;
  activePresetId: string | null;
  presets: Array<{
    id: string;
    name: string;
    operation: OperationType;
    teachingPoint: string;
  }>;
  presetsForCurrentOperation: Array<{
    id: string;
    name: string;
    teachingPoint: string;
  }>;
  activeTeachingPoints: string[];
  interpretationHints: string[];
  stateWarnings: string[];
  display: {
    showGrid: boolean;
    showAngleArc: boolean;
    showProjection: boolean;
    showDecompParallel: boolean;
    showPerspective: boolean;
    show3DGrid: boolean;
    showPolarization: boolean;
    showTeachingPoints: boolean;
    showCoordLabels: boolean;
    scenarioPanelOpen: boolean;
    paramPanelOpen: boolean;
  };
  format: {
    angleUnit: 'deg' | 'rad';
    decimalPlaces: number;
    surdMode: boolean;
    unitCircleAngle: number;
    unitCircleAngleDeg: number;
    unitCirclePlaying: boolean;
  };
  demoStage: {
    entityCount: number;
    vectorCount: number;
    operationCount: number;
    activeTool: string;
    opKind: string | null;
    vectors: Array<{
      id: string;
      label: string;
      startId: string;
      endId: string;
      start: number[];
      end: number[];
      value: number[];
      constraint?: string;
      constraintLength?: number;
    }>;
    operations: Array<{ id: string; kind: string; vec1Id: string; vec2Id?: string; scalarK?: number }>;
    bindings: Array<{ id: string; pointA: string; pointB: string }>;
  };
  constraints: string[];
};

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function summarize2D(value: [number, number]): VecSummary {
  return { value, magnitude: round(mag2D(value)) };
}

function summarize3D(value: [number, number, number]): VecSummary {
  return { value, magnitude: round(mag3D(value)) };
}

function buildDerived(operation: OperationType): DerivedSummary {
  const state = useVectorStore.getState();
  const angle = angle2D(state.vecA, state.vecB);
  const angle3 = angle3D(state.vecA3, state.vecB3);
  const chainTotal = [state.vecA, state.vecB, ...state.chainVecs].reduce(add2D, [0, 0] as [number, number]);
  const decomp = decomposeVector(state.decompTarget, state.basis1, state.basis2);
  const cross = cross3D(state.vecA3, state.vecB3);

  const common2D = {
    sum: add2D(state.vecA, state.vecB),
    difference: sub2D(state.vecA, state.vecB),
    dot: round(dot2D(state.vecA, state.vecB)),
    crossScalar: round(cross2D(state.vecA, state.vecB)),
    angleRad: round(angle),
    angleDeg: round(toDeg(angle)),
  };

  switch (operation) {
    case 'concept':
    case 'coordinate':
      return {
        vecA: state.vecA,
        magnitudeA: round(mag2D(state.vecA)),
      };
    case 'parallelogram':
      return common2D;
    case 'triangle':
      return {
        chainTotal,
        chainVectorCount: 2 + state.chainVecs.length,
        magnitude: round(mag2D(chainTotal)),
      };
    case 'subtraction':
      return {
        difference: sub2D(state.vecA, state.vecB),
        magnitude: round(mag2D(sub2D(state.vecA, state.vecB))),
      };
    case 'scalar':
      return {
        scaled: scale2D(state.vecA, state.scalarK),
        scalarK: state.scalarK,
        magnitude: round(mag2D(scale2D(state.vecA, state.scalarK))),
      };
    case 'dotProduct':
      return {
        ...common2D,
        projectionLength: round(projection2D(state.vecA, state.vecB)),
        projectionVector: projectVec2D(state.vecA, state.vecB),
        polarizationLeft: round(mag2D(add2D(state.vecA, state.vecB)) ** 2 - mag2D(sub2D(state.vecA, state.vecB)) ** 2),
        polarizationDot: round(dot2D(state.vecA, state.vecB)),
      };
    case 'decomposition':
      return {
        coefficients: decomp ? [round(decomp[0]), round(decomp[1])] : null,
        determinant: round(cross2D(state.basis1, state.basis2)),
      };
    case 'space3D':
      return {
        sum: add3D(state.vecA3, state.vecB3),
        difference: sub3D(state.vecA3, state.vecB3),
        dot: round(dot3D(state.vecA3, state.vecB3)),
        angleRad: round(angle3),
        angleDeg: round(toDeg(angle3)),
      };
    case 'crossProduct':
    case 'geometry3D':
      return {
        cross,
        crossMagnitude: round(mag3D(cross)),
        dotWithA: round(dot3D(cross, state.vecA3)),
        dotWithB: round(dot3D(cross, state.vecB3)),
        angleRad: round(angle3),
        angleDeg: round(toDeg(angle3)),
      };
    case 'demoStage':
      return {};
  }
}

function buildInterpretationHints(operation: OperationType): string[] {
  switch (operation) {
    case 'concept':
      return ['解释向量时强调方向和大小，平移不改变自由向量本身。'];
    case 'coordinate':
      return ['坐标表示要联系“终点坐标减起点坐标”和模长公式。'];
    case 'parallelogram':
      return ['平行四边形法则中，两向量为邻边，和向量是共同起点出发的对角线。'];
    case 'triangle':
      return ['三角形法则强调首尾相接，总和向量从链首起点指向链尾终点。'];
    case 'subtraction':
      return ['向量减法可解释为 a-b=a+(-b)，共起点时由 b 的终点指向 a 的终点。'];
    case 'scalar':
      return ['数乘中 k 的符号决定方向，|k| 决定模长缩放倍数。'];
    case 'dotProduct':
      return ['点积是标量，可用于判断垂直、求夹角和计算投影；不要把点积画成向量。'];
    case 'decomposition':
      return ['基底分解要强调两个基底不共线时分解唯一，系数由模板计算。'];
    case 'space3D':
      return ['空间向量的加法、点积和夹角公式与二维一致，只是多了 z 分量。'];
    case 'crossProduct':
      return ['叉积结果是向量，方向由右手定则决定，模长等于平行四边形面积。'];
    case 'geometry3D':
      return ['立体几何中叉积常用于求法向量和面积，点积常用于判断垂直与求夹角。'];
    case 'demoStage':
      return ['自由演示台中的结果向量由渲染层实时计算；AI 只应创建输入向量和运算节点。'];
  }
}

function buildStateWarnings(operation: OperationType): string[] {
  const state = useVectorStore.getState();
  const warnings: string[] = [];
  if ((operation === 'dotProduct' || operation === 'parallelogram' || operation === 'subtraction') && (mag2D(state.vecA) < 1e-10 || mag2D(state.vecB) < 1e-10)) {
    warnings.push('当前存在零向量，夹角或方向相关解释需要谨慎。');
  }
  if (operation === 'decomposition' && Math.abs(cross2D(state.basis1, state.basis2)) < 1e-10) {
    warnings.push('当前 basis1 与 basis2 共线，目标向量无法唯一分解。');
  }
  if ((operation === 'crossProduct' || operation === 'geometry3D') && mag3D(cross3D(state.vecA3, state.vecB3)) < 1e-10) {
    warnings.push('当前三维向量叉积接近零向量，可能共线或存在零向量。');
  }
  return warnings;
}

export function buildM06AiContext(): M06AiContext {
  const vectorState = useVectorStore.getState();
  const uiState = useUIStore.getState();
  const demoState = useDemoEntityStore.getState();
  const demoTool = useDemoToolStore.getState();
  const meta = OPERATION_META[vectorState.operation];
  const demoEntities = Object.values(demoState.entities);
  const demoVectors = demoEntities.filter((item): item is DemoVector => item.type === 'demoVector');
  const demoOps = demoEntities.filter((item): item is DemoVecOp => item.type === 'demoVecOp');
  const activePreset = vectorState.activePresetId ? getPresetById(vectorState.activePresetId) : undefined;

  return {
    templateKey: 'm06',
    summary: `当前为${meta.label}，${meta.description}。`,
    currentOperation: {
      id: meta.id,
      label: meta.label,
      dimension: meta.dimension,
      description: meta.description,
    },
    vectors: {
      vecA: summarize2D(vectorState.vecA),
      vecB: summarize2D(vectorState.vecB),
      vecA3: summarize3D(vectorState.vecA3),
      vecB3: summarize3D(vectorState.vecB3),
      scalarK: vectorState.scalarK,
      chainVecs: vectorState.chainVecs,
      decompTarget: summarize2D(vectorState.decompTarget),
      basis1: summarize2D(vectorState.basis1),
      basis2: summarize2D(vectorState.basis2),
    },
    derived: buildDerived(vectorState.operation),
    activePresetId: vectorState.activePresetId,
    presets: ALL_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      operation: preset.operation,
      teachingPoint: preset.teachingPoint,
    })),
    presetsForCurrentOperation: getPresetsByOperation(vectorState.operation).map((preset) => ({
      id: preset.id,
      name: preset.name,
      teachingPoint: preset.teachingPoint,
    })),
    activeTeachingPoints: activePreset?.teachingPoints ?? (activePreset ? [activePreset.teachingPoint] : []),
    interpretationHints: buildInterpretationHints(vectorState.operation),
    stateWarnings: buildStateWarnings(vectorState.operation),
    display: {
      showGrid: vectorState.showGrid,
      showAngleArc: vectorState.showAngleArc,
      showProjection: vectorState.showProjection,
      showDecompParallel: vectorState.showDecompParallel,
      showPerspective: vectorState.showPerspective,
      show3DGrid: vectorState.show3DGrid,
      showPolarization: vectorState.showPolarization,
      showTeachingPoints: uiState.showTeachingPoints,
      showCoordLabels: uiState.showCoordLabels,
      scenarioPanelOpen: uiState.scenarioPanelOpen,
      paramPanelOpen: uiState.paramPanelOpen,
    },
    format: {
      angleUnit: vectorState.angleUnit,
      decimalPlaces: vectorState.decimalPlaces,
      surdMode: vectorState.surdMode,
      unitCircleAngle: vectorState.unitCircleAngle,
      unitCircleAngleDeg: round(toDeg(vectorState.unitCircleAngle)),
      unitCirclePlaying: vectorState.unitCirclePlaying,
    },
    demoStage: {
      entityCount: demoEntities.length,
      vectorCount: demoVectors.length,
      operationCount: demoOps.length,
      activeTool: demoTool.activeTool,
      opKind: demoTool.opKind,
      vectors: demoVectors.map((vector) => {
        const start = demoState.entities[vector.startId];
        const end = demoState.entities[vector.endId];
        const startPoint = start?.type === 'demoPoint' ? start : null;
        const endPoint = end?.type === 'demoPoint' ? end : null;
        return {
          id: vector.id,
          label: vector.label,
          startId: vector.startId,
          endId: vector.endId,
          start: startPoint ? [startPoint.x, startPoint.y] : [0, 0],
          end: endPoint ? [endPoint.x, endPoint.y] : [0, 0],
          value: startPoint && endPoint ? [round(endPoint.x - startPoint.x), round(endPoint.y - startPoint.y)] : [0, 0],
          constraint: vector.constraint,
          constraintLength: vector.constraintLength,
        };
      }),
      operations: demoOps.map((op) => ({
        id: op.id,
        kind: op.kind,
        vec1Id: op.vec1Id,
        vec2Id: op.vec2Id,
        scalarK: op.scalarK,
      })),
      bindings: demoState.bindings.map((binding) => ({
        id: binding.id,
        pointA: binding.pointA,
        pointB: binding.pointB,
      })),
    },
    constraints: [
      'AI 只能输出 operations、patch、explanation、warnings，不要输出 envelope。',
      '结构性搭建优先使用 operations，不要直接手写 vector、ui、demo 或 demoTool 状态树。',
      'M06 只处理向量运算演示台，不要输出 M02/M03/M04/M05 相关 payload 或 operation。',
      '向量和、差、点积、投影、分解系数、叉积、夹角等派生量由 M06 计算；AI 不应手写派生结果。',
      '二维向量必须是 [x,y]，三维向量必须是 [x,y,z]，所有分量必须是有限数字。',
      '基底分解要求 basis1 与 basis2 不共线；共线时返回 warnings，不要继续依赖分解结果。',
      '自由演示台引用已有向量时必须使用 aiContext.demoStage.vectors 中的 id 或 label。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。',
    ],
  };
}
