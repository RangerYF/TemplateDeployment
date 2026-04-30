import { P13_MODEL_KEYS } from './types';

export const P13_LENZ_MAGNET_COIL_PRESET_ID = 'P13-EMI-001-lenz-magnet-coil';

export type P13LenzPole = 'N' | 'S';
export type P13LenzMotion = 'insert' | 'withdraw';
export type P13LenzAxisDirection = 'left' | 'right';
export type P13LenzFluxChangeTrend = 'increase' | 'decrease';
export type P13LenzCurrentDirection = 'clockwise' | 'counterclockwise';
export type P13LenzInteraction = 'repel' | 'attract';
export type P13LenzStepKey =
  | 'original-flux'
  | 'flux-change'
  | 'induced-current'
  | 'induced-field'
  | 'ampere-force';

export interface P13LenzAnalysisInput {
  pole: P13LenzPole;
  motion: P13LenzMotion;
  turns: number;
}

export interface P13LenzAnalysisStep {
  key: P13LenzStepKey;
  title: string;
  shortValue: string;
  description: string;
  accentColor: string;
}

export interface P13LenzAnalysisResult {
  modelKey: typeof P13_MODEL_KEYS.lenzMagnetCoil;
  pole: P13LenzPole;
  motion: P13LenzMotion;
  turns: number;
  originalFluxDirection: P13LenzAxisDirection;
  fluxChangeTrend: P13LenzFluxChangeTrend;
  inducedCurrentDirection: P13LenzCurrentDirection;
  inducedFieldDirection: P13LenzAxisDirection;
  ampereForceDirection: P13LenzAxisDirection;
  interaction: P13LenzInteraction;
  steps: P13LenzAnalysisStep[];
}

export const LENZ_POLE_LABELS: Record<P13LenzPole, string> = {
  N: 'N 极',
  S: 'S 极',
};

export const LENZ_MOTION_LABELS: Record<P13LenzMotion, string> = {
  insert: '插入',
  withdraw: '拔出',
};

export const LENZ_AXIS_DIRECTION_LABELS: Record<P13LenzAxisDirection, string> = {
  left: '向左',
  right: '向右',
};

export const LENZ_FLUX_CHANGE_LABELS: Record<P13LenzFluxChangeTrend, string> = {
  increase: '增大',
  decrease: '减小',
};

export const LENZ_CURRENT_DIRECTION_LABELS: Record<P13LenzCurrentDirection, string> = {
  clockwise: '顺时针（从右看）',
  counterclockwise: '逆时针（从右看）',
};

export const LENZ_INTERACTION_LABELS: Record<P13LenzInteraction, string> = {
  repel: '排斥',
  attract: '吸引',
};

const STEP_ACCENTS: Record<P13LenzStepKey, string> = {
  'original-flux': '#4F46E5',
  'flux-change': '#0EA5E9',
  'induced-current': '#F97316',
  'induced-field': '#16A34A',
  'ampere-force': '#DC2626',
};

export const LENZ_CASES: ReadonlyArray<Pick<P13LenzAnalysisInput, 'pole' | 'motion'>> = [
  { pole: 'N', motion: 'insert' },
  { pole: 'N', motion: 'withdraw' },
  { pole: 'S', motion: 'insert' },
  { pole: 'S', motion: 'withdraw' },
] as const;

function clampTurns(turns: number): number {
  if (!Number.isFinite(turns)) return 100;
  return Math.max(10, Math.min(500, Math.round(turns / 10) * 10));
}

function invertAxisDirection(direction: P13LenzAxisDirection): P13LenzAxisDirection {
  return direction === 'left' ? 'right' : 'left';
}

function getOriginalFluxDirection(pole: P13LenzPole): P13LenzAxisDirection {
  return pole === 'N' ? 'left' : 'right';
}

function getCurrentDirection(
  inducedFieldDirection: P13LenzAxisDirection,
): P13LenzCurrentDirection {
  return inducedFieldDirection === 'right' ? 'counterclockwise' : 'clockwise';
}

function getInteraction(motion: P13LenzMotion): P13LenzInteraction {
  return motion === 'insert' ? 'repel' : 'attract';
}

function getAmpereForceDirection(motion: P13LenzMotion): P13LenzAxisDirection {
  return motion === 'insert' ? 'right' : 'left';
}

export function analyzeLenzMagnetCoil(
  input: P13LenzAnalysisInput,
): P13LenzAnalysisResult {
  const turns = clampTurns(input.turns);
  const originalFluxDirection = getOriginalFluxDirection(input.pole);
  const fluxChangeTrend: P13LenzFluxChangeTrend =
    input.motion === 'insert' ? 'increase' : 'decrease';
  const inducedFieldDirection =
    fluxChangeTrend === 'increase'
      ? invertAxisDirection(originalFluxDirection)
      : originalFluxDirection;
  const inducedCurrentDirection = getCurrentDirection(inducedFieldDirection);
  const interaction = getInteraction(input.motion);
  const ampereForceDirection = getAmpereForceDirection(input.motion);

  const poleLabel = LENZ_POLE_LABELS[input.pole];
  const motionLabel = LENZ_MOTION_LABELS[input.motion];
  const originalFluxLabel = LENZ_AXIS_DIRECTION_LABELS[originalFluxDirection];
  const fluxChangeLabel = LENZ_FLUX_CHANGE_LABELS[fluxChangeTrend];
  const inducedCurrentLabel = LENZ_CURRENT_DIRECTION_LABELS[inducedCurrentDirection];
  const inducedFieldLabel = LENZ_AXIS_DIRECTION_LABELS[inducedFieldDirection];
  const ampereForceLabel = LENZ_AXIS_DIRECTION_LABELS[ampereForceDirection];
  const interactionLabel = LENZ_INTERACTION_LABELS[interaction];

  const steps: P13LenzAnalysisStep[] = [
    {
      key: 'original-flux',
      title: '原磁通量方向',
      shortValue: originalFluxLabel,
      description:
        input.pole === 'N'
          ? '本模型约定磁棒位于线圈右侧，且所选磁极就是靠近线圈的一端。N 极靠近线圈时，穿过线圈的原磁通量沿轴向左。'
          : '本模型约定磁棒位于线圈右侧，且所选磁极就是靠近线圈的一端。S 极靠近线圈时，穿过线圈的原磁通量沿轴向右。',
      accentColor: STEP_ACCENTS['original-flux'],
    },
    {
      key: 'flux-change',
      title: '磁通量变化方向',
      shortValue: fluxChangeLabel,
      description:
        input.motion === 'insert'
          ? `${poleLabel}${motionLabel}时，原来这个方向的磁通量变得更强，所以判定为${fluxChangeLabel}。匝数 n=${turns} 只会放大感应效应，不改变方向判断。`
          : `${poleLabel}${motionLabel}时，原来这个方向的磁通量变得更弱，所以判定为${fluxChangeLabel}。方向判断仍遵循 ε = -nΔΦ/Δt。`,
      accentColor: STEP_ACCENTS['flux-change'],
    },
    {
      key: 'induced-current',
      title: '感应电流方向',
      shortValue: inducedCurrentLabel,
      description: `线圈必须产生能阻碍这次磁通量变化的感应磁场。按右手定则，从右看线圈，感应电流应为${inducedCurrentLabel}。`,
      accentColor: STEP_ACCENTS['induced-current'],
    },
    {
      key: 'induced-field',
      title: '感应磁场方向',
      shortValue: inducedFieldLabel,
      description:
        fluxChangeTrend === 'increase'
          ? `原磁通量在${fluxChangeLabel}，所以感应磁场必须取反，改为${inducedFieldLabel}，用来抵消“增大”这件事。`
          : `原磁通量在${fluxChangeLabel}，所以感应磁场与原磁通量同向，即${inducedFieldLabel}，用来补偿“减小”这件事。`,
      accentColor: STEP_ACCENTS['induced-field'],
    },
    {
      key: 'ampere-force',
      title: '对磁棒的安培力方向',
      shortValue: `${interactionLabel}，${ampereForceLabel}`,
      description:
        input.motion === 'insert'
          ? `磁棒正在向左插入线圈，线圈对它表现为${interactionLabel}，安培力把磁棒推回${ampereForceLabel}，从而阻碍插入。`
          : `磁棒正在向右拔出线圈，线圈对它表现为${interactionLabel}，安培力把磁棒拉回${ampereForceLabel}，从而阻碍拔出。`,
      accentColor: STEP_ACCENTS['ampere-force'],
    },
  ];

  return {
    modelKey: P13_MODEL_KEYS.lenzMagnetCoil,
    pole: input.pole,
    motion: input.motion,
    turns,
    originalFluxDirection,
    fluxChangeTrend,
    inducedCurrentDirection,
    inducedFieldDirection,
    ampereForceDirection,
    interaction,
    steps,
  };
}

export function listLenzReferenceCases(turns = 100): P13LenzAnalysisResult[] {
  return LENZ_CASES.map((item) =>
    analyzeLenzMagnetCoil({
      pole: item.pole,
      motion: item.motion,
      turns,
    }),
  );
}
