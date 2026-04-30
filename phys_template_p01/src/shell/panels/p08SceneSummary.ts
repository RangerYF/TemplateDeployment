import { presetRegistry } from '@/core/registries/preset-registry';
import type { Entity, MotionState, ParamValues, PhysicsResult, Vec2 } from '@/core/types';
import {
  computeElectricFieldMagnitudeAtPoint,
  computePotentialAtPoint,
  type PointChargeSample,
} from '@/domains/em/logic/electric-field-observables';
import {
  angleFromCirclePosition,
  classifyElectrogravityOutcome,
  criticalBottomSpeed,
  criticalTopSpeed,
  ELECTROGRAVITY_DETACHED_FLAG,
  ELECTROGRAVITY_RELEASE_ANGLE_FLAG,
  getElectrogravityOutcomeLabel,
  getElectrogravityReleaseLabel,
  getElectrogravityCircleConfig,
  isElectrogravityCircleScene,
  tensionForCircle,
} from '@/domains/em/logic/electrogravity-circular-motion';
import {
  getEFieldGap,
  getEFieldPlateSpan,
  getEffectiveE,
  getUniformEFieldDerivedState,
  getUniformEFieldModelLabel,
} from '@/domains/em/logic/electric-force';
import { isDetectorScreen } from '@/domains/em/logic/detector-screen';
import {
  getFlowmeterSceneValues,
  getFlowmeterTeachingState,
} from '@/domains/em/logic/flowmeter-teaching';
import { sampleMagneticFieldAtPoint } from '@/domains/em/logic/lorentz-force';
import { getPointChargeLaunchState } from '@/domains/em/logic/point-charge-kinematics';
import { analyzeParallelPlateDeflection } from '@/domains/em/logic/parallel-plate-deflection';
import {
  analyzeTwoStageEField,
  resolveTwoStageEFieldPair,
} from '@/domains/em/logic/two-stage-efield';
import { isDynamicPointCharge, isSourcePointCharge } from '@/domains/em/logic/point-charge-role';
import {
  getLoopCenterFieldDirectionLabel,
  getLoopCurrentDirectionLabel,
  getStraightWireCurrentDirectionLabel,
  getStraightWireFieldRotationLabel,
  getSolenoidCurrentDirectionLabel,
  getSolenoidFieldDirectionLabel,
} from '@/domains/em/logic/current-direction';
import { P08_FIELD_BUILDER_SCENE_ID } from '@/domains/em/builder/p08-field-builder-scene';
import { P08_MODULES, P08_PRESET_IDS } from '@/shell/pages/p08PresetCatalog';

const MU_0 = 4 * Math.PI * 1e-7;

export interface P08SummaryRow {
  label: string;
  value: string;
}

export interface PotentialMeasurementSummary {
  prompt: string;
  rows: P08SummaryRow[];
  deltaV?: string;
}

export interface P08SceneSummary {
  isP08: boolean;
  moduleTitle?: string;
  modelTitle?: string;
  formula?: string;
  summary?: string;
  explanation?: string;
  keyParameters: P08SummaryRow[];
  metrics: P08SummaryRow[];
  supportsFieldLineControls: boolean;
  supportsEquipotentialControls: boolean;
  supportsPotentialMapControl: boolean;
  supportsFieldDensityControl: boolean;
  supportsTrajectoryControl: boolean;
  supportsPotentialDifference: boolean;
  potentialMeasurement?: PotentialMeasurementSummary;
}

interface SummaryInput {
  presetId?: string;
  entities: Map<string, Entity>;
  result: PhysicsResult | null;
  paramValues: ParamValues;
  potentialProbeA: Vec2 | null;
  potentialProbeB: Vec2 | null;
}

export function getP08SceneSummary({
  presetId,
  entities,
  result,
  paramValues,
  potentialProbeA,
  potentialProbeB,
}: SummaryInput): P08SceneSummary {
  const isBuilderScene = presetId === P08_FIELD_BUILDER_SCENE_ID;

  if (!presetId || (!P08_PRESET_IDS.has(presetId) && !isBuilderScene)) {
    return {
      isP08: false,
      keyParameters: [],
      metrics: [],
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsTrajectoryControl: false,
      supportsPotentialDifference: false,
    };
  }

  const preset = presetRegistry.get(presetId);
  const entityList = Array.from(entities.values());
  const pointCharges = entityList.filter(isDynamicPointCharge);
  const sourceCharges = entityList.filter(isSourcePointCharge);
  const efields = entityList.filter((entity) => entity.type === 'uniform-efield');
  const detectorScreens = entityList.filter(isDetectorScreen);
  const bfields = entityList.filter((entity) => entity.type === 'uniform-bfield');
  const currentWires = entityList.filter((entity) => entity.type === 'current-wire');
  const solenoids = entityList.filter((entity) => entity.type === 'solenoid');
  const motionStates = result ? Array.from(result.motionStates.values()) : [];
  const representativeMotion = motionStates[0];
  const representativeParticle = representativeMotion
    ? entities.get(representativeMotion.entityId) ?? pointCharges[0]
    : pointCharges[0];
  const moduleTitle = isBuilderScene ? 'P-08 场搭建器' : getModuleTitleByPresetId(presetId);
  const builderModelTitle = isBuilderScene ? inferBuilderSceneTitle(entityList) : undefined;

  const electrostaticCharges = toElectrostaticCharges(sourceCharges);
  const supportsElectrostaticControls =
    electrostaticCharges.length > 0 &&
    efields.length === 0 &&
    bfields.length === 0 &&
    currentWires.length === 0 &&
    solenoids.length === 0;
  const supportsStaticPlateControls =
    efields.some((field) => (field.properties.showPlates as boolean) ?? false) &&
    pointCharges.length === 0;

  const baseSummary: P08SceneSummary = {
    isP08: true,
    moduleTitle,
    modelTitle: builderModelTitle ?? preset?.name ?? 'P-08 场景',
    formula: '',
    summary: isBuilderScene
      ? '自由添加场源、匀强场和带电粒子，复用现有画布、结果区与信息面板。'
      : (preset?.description ?? ''),
    explanation: isBuilderScene && entityList.length === 0
      ? '当前为空白场景。先从左侧添加点电荷、匀强场、导线或带电粒子，再根据课堂需要拖拽和调参。'
      : '',
    keyParameters: [],
    metrics: [],
    supportsFieldLineControls: supportsElectrostaticControls || supportsStaticPlateControls,
    supportsEquipotentialControls: supportsElectrostaticControls || supportsStaticPlateControls,
    supportsPotentialMapControl: supportsElectrostaticControls,
    supportsFieldDensityControl: supportsElectrostaticControls || supportsStaticPlateControls,
    supportsTrajectoryControl:
      pointCharges.length > 0 &&
      (
        efields.length > 0 ||
        bfields.length > 0 ||
        motionStates.length > 0
      ),
    supportsPotentialDifference: supportsElectrostaticControls,
    potentialMeasurement: supportsElectrostaticControls
      ? buildPotentialMeasurementSummary(electrostaticCharges, potentialProbeA, potentialProbeB)
      : undefined,
  };

  if (isBuilderScene && entityList.length === 0) {
    return baseSummary;
  }

  if (supportsElectrostaticControls) {
    return {
      ...baseSummary,
      ...buildElectrostaticSummary(electrostaticCharges, sourceCharges, paramValues, potentialProbeA, potentialProbeB),
    };
  }

  if (pointCharges.length > 0 && efields.length > 0 && isElectrogravityCircleScene(pointCharges[0], efields[0])) {
    return {
      ...baseSummary,
      ...buildElectrogravityCircularSummary(pointCharges[0]!, representativeMotion, efields[0]!),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if (efields.length > 0 && pointCharges.length === 0) {
    return {
      ...baseSummary,
      ...buildParallelPlateSummary(efields[0]!),
      supportsFieldLineControls: true,
      supportsEquipotentialControls: true,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: true,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if (efields.length > 1 && bfields.length === 0 && representativeParticle) {
    const stagePair = resolveTwoStageEFieldPair(efields);
    if (stagePair) {
      return {
        ...baseSummary,
        ...buildTwoStageElectricSummary(
          representativeParticle,
          representativeMotion,
          efields,
          detectorScreens,
          stagePair.accelerationField,
          stagePair.deflectionField,
        ),
        supportsFieldLineControls: false,
        supportsEquipotentialControls: false,
        supportsPotentialMapControl: false,
        supportsFieldDensityControl: false,
        supportsPotentialDifference: false,
        potentialMeasurement: undefined,
      };
    }
  }

  if (efields.length > 0 && bfields.length === 0 && representativeParticle) {
    return {
      ...baseSummary,
      ...buildElectricMotionSummary(representativeParticle, representativeMotion, efields[0]!, detectorScreens),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if (currentWires.length > 0 && bfields.length > 0 && pointCharges.length === 0) {
    return {
      ...baseSummary,
      ...buildAmpereForceSummary(currentWires[0]!, bfields),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsTrajectoryControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if ((currentWires.length > 0 || solenoids.length > 0) && pointCharges.length === 0) {
    return {
      ...baseSummary,
      ...buildStaticMagneticSummary(currentWires[0], solenoids[0]),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsTrajectoryControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if (bfields.length > 0 && efields.length === 0 && representativeParticle) {
    return {
      ...baseSummary,
      ...buildMagneticMotionSummary({
        presetId,
        particles: pointCharges,
        representativeParticle,
        representativeMotion,
        motionStates: result?.motionStates,
        fields: bfields,
      }),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  if (bfields.length > 0 && efields.length > 0 && representativeParticle) {
    return {
      ...baseSummary,
      ...buildCombinedFieldSummary(
        presetId,
        representativeParticle,
        representativeMotion,
        efields,
        bfields,
        paramValues,
        result?.time ?? 0,
      ),
      supportsFieldLineControls: false,
      supportsEquipotentialControls: false,
      supportsPotentialMapControl: false,
      supportsFieldDensityControl: false,
      supportsPotentialDifference: false,
      potentialMeasurement: undefined,
    };
  }

  return baseSummary;
}

function getModuleTitleByPresetId(presetId: string): string | undefined {
  return P08_MODULES.find((module) => (module.presetIds as readonly string[]).includes(presetId))?.title;
}

function inferBuilderSceneTitle(entityList: Entity[]): string {
  if (entityList.length === 0) return '空白场景';

  const hasSourceCharge = entityList.some(isSourcePointCharge);
  const hasParticle = entityList.some(isDynamicPointCharge);
  const hasEField = entityList.some((entity) => entity.type === 'uniform-efield');
  const hasPlateField = entityList.some(
    (entity) => entity.type === 'uniform-efield' && ((entity.properties.showPlates as boolean) ?? false),
  );
  const hasBField = entityList.some((entity) => entity.type === 'uniform-bfield');
  const hasScreen = entityList.some(isDetectorScreen);
  const hasWire = entityList.some((entity) => entity.type === 'current-wire' || entity.type === 'solenoid');

  if (hasSourceCharge && !hasParticle && !hasEField && !hasBField && !hasWire) {
    return '自由静电场';
  }
  if (hasParticle && hasPlateField && hasScreen) {
    return '自由平行板偏转';
  }
  if (hasParticle && hasPlateField) {
    return '自由平行板电场';
  }
  if (hasParticle && hasEField && hasBField) {
    return '自由复合场';
  }
  if (hasParticle && hasEField) {
    return '自由电场粒子运动';
  }
  if (hasParticle && hasBField) {
    return '自由磁场粒子运动';
  }
  if (!hasParticle && (hasWire || hasBField)) {
    return '自由静磁场';
  }
  if (!hasParticle && hasEField) {
    return '自由匀强电场';
  }
  return '自由场景';
}

function toElectrostaticCharges(entities: Entity[]): PointChargeSample[] {
  return entities
    .map((entity) => ({
      position: { ...entity.transform.position },
      charge: (((entity.properties.charge as number) ?? 0) * 1e-6),
    }))
    .filter((charge) => Math.abs(charge.charge) > 0);
}

function buildElectrostaticSummary(
  electrostaticCharges: PointChargeSample[],
  chargeEntities: Entity[],
  paramValues: ParamValues,
  potentialProbeA: Vec2 | null,
  potentialProbeB: Vec2 | null,
): Partial<P08SceneSummary> {
  const layerGuide = '电场线看方向，等势线看同一电势值，电势分布热力图看整体高低变化。';

  if (electrostaticCharges.length === 1) {
    const charge = chargeEntities[0]!;
    const chargeMicroC = (charge.properties.charge as number) ?? 0;
    const atOneMeter = computeElectricFieldMagnitudeAtPoint({ x: charge.transform.position.x + 1, y: charge.transform.position.y }, electrostaticCharges);
    return {
      formula: 'E = kQ / r²，V = kQ / r',
      explanation: potentialProbeA && potentialProbeB
        ? `${layerGuide} 当前已记录两点电势，可直接读取 ΔV = VA - VB。`
        : `${layerGuide} 红/橙色表示正电势较高，蓝色表示负电势较低；点击画布依次放置 A/B 点，可在右下角读取两点电势差。`,
      keyParameters: [
        { label: '电荷量 Q', value: `${formatSignedNumber(chargeMicroC, 1)} μC` },
        {
          label: '位置',
          value: `(${formatShort(charge.transform.position.x)}, ${formatShort(charge.transform.position.y)}) m`,
        },
      ],
      metrics: mergeRows(
        [
          { label: '1 m 处场强', value: `${formatPhysics(atOneMeter)} N/C` },
          { label: '1 m 处电势', value: `${formatPhysics(computePotentialAtPoint({ x: charge.transform.position.x + 1, y: charge.transform.position.y }, electrostaticCharges))} V` },
        ],
        buildPotentialMeasurementMetrics(electrostaticCharges, potentialProbeA, potentialProbeB),
      ),
    };
  }

  const [leftCharge, rightCharge] = [...chargeEntities].slice(0, 2).sort((a, b) => a.transform.position.x - b.transform.position.x);
  if (!leftCharge || !rightCharge) {
    return {
      formula: 'E = E₁ + E₂，V = Σ(kQi / ri)',
      explanation: '当前场景缺少完整的双点电荷配置。',
      keyParameters: [],
      metrics: [],
    };
  }
  const midpoint = {
    x: (leftCharge.transform.position.x + rightCharge.transform.position.x) / 2,
    y: (leftCharge.transform.position.y + rightCharge.transform.position.y) / 2,
  };
  const presetKey = typeof paramValues.chargePreset === 'string' ? paramValues.chargePreset : 'custom';
  const distanceCm = typeof paramValues.distanceCm === 'number'
    ? paramValues.distanceCm
    : Math.hypot(
      leftCharge.transform.position.x - rightCharge.transform.position.x,
      leftCharge.transform.position.y - rightCharge.transform.position.y,
    ) * 100;
  const midpointField = computeElectricFieldMagnitudeAtPoint(midpoint, electrostaticCharges);
  const midpointPotential = computePotentialAtPoint(midpoint, electrostaticCharges);

  return {
    formula: 'E = E₁ + E₂，V = Σ(kQi / ri)',
    explanation: potentialProbeA && potentialProbeB
      ? `${layerGuide} 当前测得的是 A、B 两点之间的电势差，适合课堂上直接比较不同构型。`
      : `${layerGuide} 红/橙区更接近正电势高区，蓝区更接近负电势低区；中点场强/电势可快速判断同号、异号和不等量构型差异。`,
    keyParameters: [
      { label: 'Q1', value: `${formatSignedNumber((leftCharge.properties.charge as number) ?? 0, 1)} μC` },
      { label: 'Q2', value: `${formatSignedNumber((rightCharge.properties.charge as number) ?? 0, 1)} μC` },
      { label: '间距 d', value: `${distanceCm.toFixed(0)} cm` },
      { label: '构型', value: presetKey === 'dipole' ? '等量异号' : presetKey === 'same-positive' ? '等量同号（正）' : presetKey === 'same-negative' ? '等量同号（负）' : presetKey === 'unequal-dipole' ? '不等量异号' : '自定义' },
    ],
    metrics: mergeRows(
      [
        { label: '中点场强', value: `${formatPhysics(midpointField)} N/C` },
        { label: '中点电势', value: `${formatPhysics(midpointPotential)} V` },
      ],
      buildPotentialMeasurementMetrics(electrostaticCharges, potentialProbeA, potentialProbeB),
    ),
  };
}

function getCapacitorFormula(model: 'direct' | 'constant-voltage' | 'constant-charge'): string {
  if (model === 'constant-charge') {
    return 'C = ε0εrS / d，E = Q / (ε0εrS)，U = Ed = Q / C';
  }
  if (model === 'constant-voltage') {
    return 'E = U / d，C = ε0εrS / d，Q = CU';
  }
  return 'E = magnitude';
}

function getCapacitorModelExplanation(model: 'direct' | 'constant-voltage' | 'constant-charge'): string {
  if (model === 'constant-charge') {
    return '定电荷模型对应电容器与电源断开、Q 保持不变；改变 Q 会直接改变 E，改变 εr 会反向改变 E。';
  }
  if (model === 'constant-voltage') {
    return '恒压模型对应电容器接电源、U 保持不变；εr 只改变电容 C 和极板电荷 Q，不直接改变 E。';
  }
  return '当前未启用电容器求解链路，直接按给定匀强电场处理。';
}

function getElectricMotionFormula(
  model: 'direct' | 'constant-voltage' | 'constant-charge',
  isDeflection: boolean,
): string {
  if (isDeflection) {
    if (model === 'constant-charge') {
      return 'E = Q / (ε0εrS)，U = Ed = Q / C，y = v₀y t + ½(qE/m)t²';
    }
    if (model === 'constant-voltage') {
      return 'E = U / d，y = v₀y t + ½(qE/m)t²';
    }
    return 'a = qE / m，y = v₀y t + ½at²';
  }

  if (model === 'constant-charge') {
    return 'E = Q / (ε0εrS)，U = Ed = Q / C，qU = ΔEk，v = √(v₀² + 2qU / m)';
  }
  if (model === 'constant-voltage') {
    return 'E = U / d，qU = ΔEk，v = √(v₀² + 2qU / m)';
  }
  return 'a = qE / m，v = √(v₀² + 2ad)';
}

function formatMaybeNumberWithUnit(value: number | null, unit: string): string {
  return value == null ? '—' : formatWithUnit(value, unit);
}

function buildParallelPlateSummary(field: Entity): Partial<P08SceneSummary> {
  const fieldState = getUniformEFieldDerivedState(field);
  const distance = fieldState.gap;
  const width = fieldState.plateSpan;
  const ratio = distance > 0 ? width / distance : 0;
  const edgeExplanation = ratio > 5
    ? '当前 W/d 较大，可近似看作匀强电场。'
    : '当前边缘效应不可忽略，适合演示极板尺寸对场分布的影响。';

  if (fieldState.model === 'direct') {
    return {
      formula: 'E = magnitude',
      explanation: `${edgeExplanation} 当前场景按直接设定匀强电场处理，不通过电容器的 U / Q 推导 E。`,
      keyParameters: [
        { label: '电场模型', value: getUniformEFieldModelLabel(fieldState.model) },
        { label: '显示极板', value: ((field.properties.showPlates as boolean) ?? false) ? '是' : '否' },
        { label: '场区宽度', value: `${formatShort((field.properties.width as number) ?? 0)} m` },
        { label: '场区高度', value: `${formatShort((field.properties.height as number) ?? 0)} m` },
      ],
      metrics: [
        { label: '当前 E', value: `${formatShort(getEffectiveE(field))} V/m` },
        { label: 'W/d 比值', value: ratio > 0 ? formatShort(ratio) : '—' },
      ],
    };
  }

  return {
    formula: getCapacitorFormula(fieldState.model),
    explanation: `${edgeExplanation} ${getCapacitorModelExplanation(fieldState.model)}`,
    keyParameters: [
      { label: '电容器模型', value: getUniformEFieldModelLabel(fieldState.model) },
      { label: '极板间距 d', value: `${formatShort(distance)} m` },
      { label: '介电常数 εr', value: formatShort(fieldState.dielectric) },
      { label: '极板宽度 W', value: `${formatShort(width)} m` },
    ],
    metrics: [
      { label: '板间电压 U', value: formatMaybeNumberWithUnit(fieldState.voltage, 'V') },
      { label: '极板电荷 Q', value: formatMaybeNumberWithUnit(fieldState.plateCharge, 'C') },
      { label: '当前 E', value: `${formatShort(fieldState.effectiveE)} V/m` },
      { label: '电容 C', value: formatMaybeNumberWithUnit(fieldState.capacitance, 'F') },
      { label: 'W/d 比值', value: formatShort(ratio) },
    ],
  };
}

function buildElectricMotionSummary(
  particle: Entity,
  motion: MotionState | undefined,
  field: Entity,
  screens: Entity[],
): Partial<P08SceneSummary> {
  const fieldState = getUniformEFieldDerivedState(field);
  const charge = (particle.properties.charge as number) ?? 0;
  const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const voltage = fieldState.voltage ?? null;
  const effectiveE = fieldState.effectiveE;
  const direction = (field.properties.direction as Vec2) ?? { x: 1, y: 0 };
  const launch = getPointChargeLaunchState(particle);
  const initialVelocity = launch.velocity;
  const initialPosition = particle.transform.position;
  const speed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : Math.hypot(initialVelocity.x, initialVelocity.y);
  const acceleration = Math.abs(charge * effectiveE) / mass;
  const stoppedOnPlate = particle.properties.stoppedOnPlate === true;
  const stoppedOnScreen = particle.properties.stoppedOnScreen === true;
  const currentAcceleration = stoppedOnPlate || stoppedOnScreen ? 0 : acceleration;
  const gap = fieldState.gap;
  const plateLength = getEFieldPlateSpan(field);
  const fieldLength = Math.abs(direction.y) > Math.abs(direction.x) ? plateLength : gap;
  const isDeflection = Math.abs(initialVelocity.x) > 1e-6 && Math.abs(direction.y) > Math.abs(direction.x);
  const deflection = motion ? motion.position.y - initialPosition.y : 0;
  const deflectionAnalysis = isDeflection
    ? analyzeParallelPlateDeflection(particle, field, screens)
    : null;
  const exitSpeed = voltage != null
    ? Math.sqrt(Math.max(launch.speed * launch.speed + (2 * Math.abs(charge) * Math.abs(voltage)) / mass, 0))
    : Math.sqrt(Math.max(launch.speed * launch.speed + 2 * acceleration * gap, 0));
  const currentVelocity = motion?.velocity ?? initialVelocity;
  const angleDeg = Math.atan2(currentVelocity.y, currentVelocity.x) * 180 / Math.PI;
  const displayAngleDeg = stoppedOnScreen && deflectionAnalysis?.exitAngleDeg != null
    ? deflectionAnalysis.exitAngleDeg
    : angleDeg;
  const inField = stoppedOnPlate || stoppedOnScreen
    ? false
    : motion
      ? (
          motion.position.x >= field.transform.position.x &&
          motion.position.x <= field.transform.position.x + ((field.properties.width as number) ?? 0) &&
          motion.position.y >= field.transform.position.y &&
          motion.position.y <= field.transform.position.y + ((field.properties.height as number) ?? 0)
        )
      : true;
  const screenHitPoint = particle.properties.screenHitPoint as Vec2 | undefined;
  const predictedOutcome = deflectionAnalysis?.plateCollision
    ? '预计撞板'
    : deflectionAnalysis?.screenImpact
      ? `预计命中${deflectionAnalysis.screenImpact.screenLabel ?? '接收屏'}`
      : deflectionAnalysis?.exitPosition
        ? '预计穿出极板'
        : '—';
  const modelNote = fieldState.model === 'direct'
    ? '当前按直接设定 E 求解。'
    : fieldState.model === 'constant-charge'
      ? '当前偏转量和出口偏角由定电荷模型决定；这对应电容器与电源断开、Q 固定，调 Q 或 εr 都会改变 E。'
      : '当前偏转量和出口偏角由恒压模型决定；这对应电容器接电源、U 固定，调 εr 只改变 C 与 Q，不直接改变 E。';

  return {
    formula: isDeflection
      ? getElectricMotionFormula(fieldState.model, true)
      : getElectricMotionFormula(fieldState.model, false),
    explanation: isDeflection
      ? (
          stoppedOnScreen
            ? '粒子已离场并命中接收屏，可直接读取屏上落点位置。'
            : stoppedOnPlate
            ? '粒子已撞击极板并停在板面，后续不再继续偏转。'
            : deflectionAnalysis?.plateCollision
              ? `按当前参数，粒子预计会在 x=${formatShort(deflectionAnalysis.plateCollision.position.x)} m 处先撞上极板，无法穿出极板。`
              : inField
              ? '粒子当前仍在极板间受力偏转；离开电场区域后会保持离场瞬间速度，继续做匀速直线运动。'
              : deflectionAnalysis?.screenImpact
                ? `粒子已离开极板区域，并将沿离场速度命中${deflectionAnalysis.screenImpact.screenLabel ?? '接收屏'}。`
                : '粒子已离开极板区域，当前轨迹延长线即为离场后的匀速直线运动方向，可直接读取出口偏角。'
        ) + ` ${modelNote}`
      : (
          stoppedOnPlate
            ? '粒子已到达另一极板并停下，动画在撞板后结束。'
            : inField
              ? '粒子当前仍在加速区内，速度持续增大。'
              : '粒子已离开加速区，之后将保持离场速度做匀速直线运动。'
        ) + ` ${modelNote}`,
    keyParameters: [
      { label: '电荷量 q', value: `${formatSignedNumber(charge, 3)} C` },
      { label: '质量 m', value: `${formatShort(mass)} kg` },
      { label: '电容器模型', value: getUniformEFieldModelLabel(fieldState.model) },
      ...(voltage != null ? [{ label: '板间电压 U', value: `${formatShort(voltage)} V` }] : []),
      ...(fieldState.plateCharge != null ? [{ label: '极板电荷 Q', value: formatWithUnit(fieldState.plateCharge, 'C') }] : []),
      ...(fieldState.model !== 'direct' ? [{ label: '介电常数 εr', value: formatShort(fieldState.dielectric) }] : []),
      ...(gap > 0 ? [{ label: '极板间距 d', value: `${formatShort(gap)} m` }] : []),
      { label: '当前 E', value: `${formatShort(effectiveE)} V/m` },
      { label: '初速度 x 分量 v₀x', value: `${formatShort(initialVelocity.x)} m/s` },
      { label: '初速度 y 分量 v₀y', value: `${formatShort(initialVelocity.y)} m/s` },
      { label: '初始角度 θ₀', value: `${formatShort(launch.angleDeg)}°` },
      ...(isDeflection ? [{ label: '极板长度 L', value: `${formatShort(fieldLength)} m` }] : []),
    ],
    metrics: [
      { label: '当前速度', value: `${formatShort(speed)} m/s` },
      { label: '当前加速度', value: `${formatShort(currentAcceleration)} m/s²` },
      ...(isDeflection
        ? [
          { label: '预计结果', value: predictedOutcome },
          { label: inField ? '当前偏角' : '出口偏角', value: `${formatShort(displayAngleDeg)}°` },
          { label: '当前偏转量', value: `${formatShort(deflection)} m` },
          ...(deflectionAnalysis?.plateCollision
            ? [{ label: '预计撞板位置', value: `(${formatShort(deflectionAnalysis.plateCollision.position.x)}, ${formatShort(deflectionAnalysis.plateCollision.position.y)}) m` }]
            : deflectionAnalysis?.exitDeflection != null
              ? [{ label: '预计出口偏移', value: `${formatShort(deflectionAnalysis.exitDeflection)} m` }]
              : []),
          ...(stoppedOnScreen && screenHitPoint
            ? [{ label: '屏上落点', value: `(${formatShort(screenHitPoint.x)}, ${formatShort(screenHitPoint.y)}) m` }]
            : deflectionAnalysis?.screenImpact
              ? [{ label: '预计屏上落点', value: `(${formatShort(deflectionAnalysis.screenImpact.position.x)}, ${formatShort(deflectionAnalysis.screenImpact.position.y)}) m` }]
              : []),
        ]
        : [{ label: '理论出口速度', value: `${formatShort(exitSpeed)} m/s` }]),
      { label: '粒子状态', value: stoppedOnScreen ? '命中接收屏' : stoppedOnPlate ? '到板静止' : inField ? '场内受力' : '离场匀速' },
      { label: '当前位置', value: motion ? `(${formatShort(motion.position.x)}, ${formatShort(motion.position.y)}) m` : '—' },
    ],
  };
}

function buildTwoStageElectricSummary(
  particle: Entity,
  motion: MotionState | undefined,
  fields: Entity[],
  screens: Entity[],
  accelerationField: Entity,
  deflectionField: Entity,
): Partial<P08SceneSummary> {
  const analysis = analyzeTwoStageEField(particle, fields, screens);
  if (!analysis) {
    return {
      formula: 'qU₁ = ΔEk，v₁ = √(v₀² + 2qU₁ / m)，y = v₁y t + ½(qE₂ / m)t²',
      explanation: '当前两段式电场配置不完整，未能建立“先加速再偏转”的解析结果。',
      keyParameters: [],
      metrics: [],
    };
  }

  const charge = (particle.properties.charge as number) ?? 0;
  const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const launch = getPointChargeLaunchState(particle);
  const currentVelocity = motion?.velocity ?? launch.velocity;
  const currentSpeed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : launch.speed;
  const entrySpeed = analysis.accelerationExitVelocity
    ? Math.hypot(analysis.accelerationExitVelocity.x, analysis.accelerationExitVelocity.y)
    : null;
  const screenHitPoint = particle.properties.screenHitPoint as Vec2 | undefined;
  const stoppedOnPlate = particle.properties.stoppedOnPlate === true;
  const stoppedOnScreen = particle.properties.stoppedOnScreen === true;
  const currentAngle = Math.atan2(currentVelocity.y, currentVelocity.x) * 180 / Math.PI;
  const inAccelerationField = motion
    ? (
        motion.position.x >= accelerationField.transform.position.x &&
        motion.position.x <= accelerationField.transform.position.x + ((accelerationField.properties.width as number) ?? 0) &&
        motion.position.y >= accelerationField.transform.position.y &&
        motion.position.y <= accelerationField.transform.position.y + ((accelerationField.properties.height as number) ?? 0)
      )
    : true;
  const inDeflectionField = motion
    ? (
        motion.position.x >= deflectionField.transform.position.x &&
        motion.position.x <= deflectionField.transform.position.x + ((deflectionField.properties.width as number) ?? 0) &&
        motion.position.y >= deflectionField.transform.position.y &&
        motion.position.y <= deflectionField.transform.position.y + ((deflectionField.properties.height as number) ?? 0)
      )
    : false;
  const predictedOutcome = analysis.deflection?.plateCollision
    ? '预计撞板'
    : analysis.deflection?.screenImpact
      ? `预计命中${analysis.deflection.screenImpact.screenLabel ?? '接收屏'}`
      : analysis.accelerationExitBoundary === 'right'
        ? '预计穿出偏转区'
        : '无法进入偏转区';

  let explanation = '先用加速段把 qU₁ = ΔEk 转成入口速度，再把该入口速度带入偏转段比较出口偏角与屏上落点。';
  if (stoppedOnScreen && screenHitPoint) {
    explanation = '粒子已完成“加速段建立入口速度 + 偏转段产生偏移”两段链路，并命中接收屏。';
  } else if (stoppedOnPlate) {
    explanation = '粒子已在偏转极板上停下；当前参数下，加速段给出的入口速度不足以避免撞板。';
  } else if (analysis.accelerationExitBoundary !== 'right') {
    explanation = '当前参数下，粒子未从加速区右端出射，因此不会进入偏转区；这时两段链路会在第一段就中断。';
  } else if (analysis.deflection?.plateCollision) {
    explanation = `粒子已从加速区右端出射，并将以入口速度进入偏转区；按当前参数，预计会在 x=${formatShort(analysis.deflection.plateCollision.position.x)} m 处先撞板。`;
  } else if (analysis.deflection?.screenImpact) {
    explanation = `粒子先在加速区获得入口速度，再在偏转区形成出口偏角，并将命中${analysis.deflection.screenImpact.screenLabel ?? '接收屏'}。`;
  } else if (inAccelerationField) {
    explanation = '粒子当前仍在加速区内，速度正在建立；离开第一段后才会进入偏转区比较偏转量和出口偏角。';
  } else if (inDeflectionField) {
    explanation = '粒子已完成加速段，目前正在偏转区内受竖直电场作用；此时入口速度已经由第一段确定。';
  }

  return {
    formula: 'qU₁ = ΔEk，v₁ = √(v₀² + 2qU₁ / m)，y = v₁y t + ½(qE₂ / m)t²',
    explanation,
    keyParameters: [
      { label: '电荷量 q', value: `${formatSignedNumber(charge, 4)} C` },
      { label: '质量 m', value: `${formatShort(mass)} kg` },
      {
        label: '加速电压 U₁',
        value: analysis.accelerationState.voltage != null ? `${formatShort(analysis.accelerationState.voltage)} V` : '—',
      },
      { label: '加速区长度 L₁', value: `${formatShort(analysis.accelerationState.gap)} m` },
      {
        label: '偏转电压 U₂',
        value: analysis.deflectionState.voltage != null ? `${formatShort(analysis.deflectionState.voltage)} V` : '—',
      },
      { label: '板间距 d', value: `${formatShort(analysis.deflectionState.gap)} m` },
      { label: '极板长度 L₂', value: `${formatShort(getEFieldPlateSpan(deflectionField))} m` },
    ],
    metrics: [
      { label: '初速度 v₀', value: `${formatShort(launch.speed)} m/s` },
      { label: '进入偏转区速度 v₁', value: entrySpeed != null ? `${formatShort(entrySpeed)} m/s` : '—' },
      {
        label: '加速段飞行时间',
        value: analysis.accelerationExitTime != null ? `${formatShort(analysis.accelerationExitTime)} s` : '—',
      },
      { label: '预计结果', value: predictedOutcome },
      {
        label: inDeflectionField ? '当前偏角' : '出口偏角',
        value: analysis.deflection?.exitAngleDeg != null
          ? `${formatShort(stoppedOnScreen ? analysis.deflection.exitAngleDeg : (inDeflectionField ? currentAngle : analysis.deflection.exitAngleDeg))}°`
          : `${formatShort(currentAngle)}°`,
      },
      ...(analysis.deflection?.exitDeflection != null
        ? [{ label: '预计出口偏移', value: `${formatShort(analysis.deflection.exitDeflection)} m` }]
        : []),
      ...(stoppedOnScreen && screenHitPoint
        ? [{ label: '屏上落点', value: `(${formatShort(screenHitPoint.x)}, ${formatShort(screenHitPoint.y)}) m` }]
        : analysis.deflection?.screenImpact
          ? [{ label: '预计屏上落点', value: `(${formatShort(analysis.deflection.screenImpact.position.x)}, ${formatShort(analysis.deflection.screenImpact.position.y)}) m` }]
          : []),
      {
        label: '粒子状态',
        value: stoppedOnScreen
          ? '命中接收屏'
          : stoppedOnPlate
            ? '偏转段撞板'
            : inAccelerationField
              ? '加速段受力'
              : inDeflectionField
                ? '偏转段受力'
                : analysis.accelerationExitBoundary === 'right'
                  ? '段间 / 离场匀速'
                  : '未进入第二段',
      },
      { label: '当前位置', value: motion ? `(${formatShort(motion.position.x)}, ${formatShort(motion.position.y)}) m` : '—' },
      { label: '当前速度', value: `${formatShort(currentSpeed)} m/s` },
    ],
  };
}

function buildElectrogravityCircularSummary(
  particle: Entity,
  motion: MotionState | undefined,
  field: Entity,
): Partial<P08SceneSummary> {
  const config = getElectrogravityCircleConfig(particle, field);
  const particleProps = particle.properties as Record<string, unknown>;
  const detachedFromTrack = particleProps[ELECTROGRAVITY_DETACHED_FLAG] === true;
  const releaseAngle = readOptionalNumber(particleProps[ELECTROGRAVITY_RELEASE_ANGLE_FLAG]);
  const launch = getPointChargeLaunchState(particle);
  const currentSpeed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : launch.speed;
  const angle = motion ? angleFromCirclePosition(config, motion.position) : 0;
  const tension = motion
    ? detachedFromTrack
      ? 0
      : Math.max(tensionForCircle(config, currentSpeed, angle), 0)
    : null;
  const topCritical = criticalTopSpeed(config);
  const bottomCritical = criticalBottomSpeed(config);
  const relationToGravity = config.electricAccelerationY > 0
    ? '电场力向上，削弱重力'
    : config.electricAccelerationY < 0
      ? '电场力向下，增强重力'
      : '仅受重力';
  const predictedOutcome = classifyElectrogravityOutcome(config, launch.speed);
  const predictedOutcomeLabel = getElectrogravityOutcomeLabel(predictedOutcome);
  const statusLabel = detachedFromTrack
    ? getElectrogravityReleaseLabel(releaseAngle)
    : predictedOutcome === 'complete-circle'
      ? '绳保持拉紧，预计可完整过顶'
      : predictedOutcome === 'critical-top'
        ? '到顶附近恰好临界，绳张力会逼近 0'
        : '上半周会先松绳，随后转入斜抛';
  const currentPhase = detachedFromTrack
    ? '已脱离约束，进入斜抛段'
    : angle >= Math.PI - 0.12
      ? '接近最高点'
      : angle >= Math.PI / 2
        ? '上半周受约束运动'
        : '下半周受约束运动';

  return {
    formula: 'g_eff = g ± qE/m，v顶临界 = √(g_eff R)，v底临界 = √(5g_eff R)',
    explanation: detachedFromTrack
      ? '绳只能拉不能推；当绳张力降到 0 时，小球会沿脱离瞬间的切线方向飞出，随后只受重力和电场力共同作用，形成斜抛轨迹。'
      : predictedOutcome === 'complete-circle'
        ? '当前更适合当作“绳拴小球完整过顶”的课堂模型：绳始终提供向心约束，小球能完整绕行一周。'
        : predictedOutcome === 'critical-top'
          ? '当前处在“临界过顶”附近：到最高点时绳张力恰好逼近 0，是课堂上判断能否完整过顶的分界。'
          : '当前底端初速度低于完整过顶所需条件；小球会先做受约束圆周运动，随后因绳张力不足而松绳，并沿切线方向转入斜抛。',
    keyParameters: [
      { label: '圆轨道半径 R', value: `${formatShort(config.radius)} m` },
      { label: '底端初速度 v0', value: `${formatShort(launch.speed)} m/s` },
      { label: '荷质比 q/m', value: `${formatShort(config.charge / config.mass)} C/kg` },
      { label: '电场强度 E', value: `${formatShort(config.fieldMagnitude)} V/m` },
      { label: '电场与重力关系', value: relationToGravity },
    ],
    metrics: [
      { label: '预计结果', value: predictedOutcomeLabel },
      { label: '当前阶段', value: currentPhase },
      { label: '等效重力 g_eff', value: `${formatShort(config.effectiveDownwardAcceleration)} m/s²` },
      { label: '顶端临界速度', value: topCritical != null ? `${formatShort(topCritical)} m/s` : '—' },
      { label: '底端临界速度', value: bottomCritical != null ? `${formatShort(bottomCritical)} m/s` : '—' },
      { label: '当前绳拉力 T', value: tension != null ? detachedFromTrack ? '0 N（已脱离）' : `${formatShort(tension)} N` : '—' },
      { label: '判定', value: statusLabel },
    ],
  };
}

function buildStaticMagneticSummary(
  wire: Entity | undefined,
  solenoid: Entity | undefined,
): Partial<P08SceneSummary> {
  if (wire) {
    const current = Math.abs((wire.properties.current as number) ?? 0);
    const wireShape = (wire.properties.wireShape as string | undefined) ?? 'straight';
    if (wireShape === 'loop') {
      const radius = (wire.properties.loopRadius as number) ?? 1;
      const centerB = radius > 0 ? (MU_0 * current) / (2 * radius) : 0;
      return {
        formula: 'B₀ = μ₀I / 2R',
        explanation: `当前“电流方向”已直接映射到截面符号和磁感线箭头；${getLoopCenterFieldDirectionLabel(wire)}即为中心轴线上的磁场方向。`,
        keyParameters: [
          { label: '电流 I', value: `${formatShort(current)} A` },
          { label: '电流方向', value: getLoopCurrentDirectionLabel(wire) },
          { label: '线圈半径 R', value: `${formatShort(radius)} m` },
        ],
        metrics: [
          { label: '中心 B', value: `${formatWithUnit(centerB, 'T')}` },
          { label: '轴线 B 方向', value: getLoopCenterFieldDirectionLabel(wire) },
        ],
      };
    }

    const referenceB = MU_0 * current / (2 * Math.PI * 1);
    return {
      formula: 'B = μ₀I / 2πr',
      explanation: `当前结果按 r = 1 m 参考点给出；电流方向切换后，磁感线箭头会同步改为${getStraightWireFieldRotationLabel(wire)}。`,
      keyParameters: [
        { label: '电流 I', value: `${formatShort(current)} A` },
        { label: '电流方向', value: getStraightWireCurrentDirectionLabel(wire) },
        { label: '参考半径 r', value: '1.00 m' },
      ],
      metrics: [
        { label: '参考点 B', value: `${formatWithUnit(referenceB, 'T')}` },
        { label: '磁感线方向', value: getStraightWireFieldRotationLabel(wire) },
      ],
    };
  }

  if (solenoid) {
    const current = Math.abs((solenoid.properties.current as number) ?? 0);
    const turns = (solenoid.properties.turns as number) ?? 0;
    const length = Math.max((solenoid.properties.length as number) ?? 1, 1e-9);
    const turnsPerMeter = turns / length;
    const centerB = MU_0 * turnsPerMeter * current;
    return {
      formula: 'B ≈ μ₀nI',
      explanation: `当前“电流方向”会同时驱动上侧电流箭头和内部 B 箭头，方便直接比较右手定则下的内部磁场方向。`,
      keyParameters: [
        { label: '电流 I', value: `${formatShort(current)} A` },
        { label: '电流方向', value: getSolenoidCurrentDirectionLabel(solenoid) },
        { label: '匝数 N', value: `${turns.toFixed(0)} 匝` },
        { label: '长度 L', value: `${formatShort(length)} m` },
      ],
      metrics: [
        { label: '匝密度 n', value: `${formatShort(turnsPerMeter)} m⁻¹` },
        { label: '内部 B', value: `${formatWithUnit(centerB, 'T')}` },
        { label: '内部 B 方向', value: getSolenoidFieldDirectionLabel(solenoid) },
      ],
    };
  }

  return {};
}

function buildAmpereForceSummary(
  wire: Entity,
  fields: Entity[],
): Partial<P08SceneSummary> {
  const current = Math.abs(readNumber(wire.properties.current, 0));
  const length = Math.max(
    readNumber(wire.properties.length, readNumber(wire.properties.height, 0)),
    0,
  );
  const direction = normalizeVector(
    (wire.properties.wireDirection as Vec2 | undefined) ?? { x: 0, y: 1 },
  );
  const wireCenter = {
    x: wire.transform.position.x + readNumber(wire.properties.width, 0) / 2,
    y: wire.transform.position.y + readNumber(wire.properties.height, 0) / 2,
  };
  const fieldSample = sampleMagneticFieldAtPoint(wireCenter, fields);
  const forceDirection = normalizeVector({
    x: direction.y * fieldSample.signedBz,
    y: -direction.x * fieldSample.signedBz,
  });
  const forceMagnitude = current * length * fieldSample.magnitude;

  return {
    formula: 'F = BIL，方向由左手定则判定',
    explanation: '画布中的紫色脉冲箭头和半透明位移虚影会沿安培力方向周期性移动，用于提示导线将向该方向受力。',
    keyParameters: [
      { label: '电流方向', value: toVectorDirectionLabel(direction) },
      { label: '磁场方向', value: toMagneticDirectionLabel(fieldSample.direction) },
      { label: '导线有效长度 L', value: `${formatShort(length)} m` },
    ],
    metrics: [
      { label: '电流 I', value: `${formatShort(current)} A` },
      { label: '当前 B', value: `${formatShort(fieldSample.magnitude)} T` },
      { label: '安培力 F', value: `${formatShort(forceMagnitude)} N` },
      { label: '受力方向', value: toVectorDirectionLabel(forceDirection) },
    ],
  };
}

interface MagneticMotionSummaryInput {
  presetId: string;
  particles: Entity[];
  representativeParticle: Entity;
  representativeMotion: MotionState | undefined;
  motionStates: Map<string, MotionState> | undefined;
  fields: Entity[];
}

function buildMagneticMotionSummary({
  presetId,
  particles,
  representativeParticle: particle,
  representativeMotion: motion,
  motionStates,
  fields,
}: MagneticMotionSummaryInput): Partial<P08SceneSummary> {
  const charge = Math.abs((particle.properties.charge as number) ?? 0);
  const signedCharge = (particle.properties.charge as number) ?? 0;
  const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const launch = getPointChargeLaunchState(particle);
  const fallbackPosition = particle.transform.position;
  const position = motion?.position ?? fallbackPosition;
  const speed = motion ? Math.hypot(motion.velocity.x, motion.velocity.y) : launch.speed;
  const fieldSample = sampleMagneticFieldAtPoint(position, fields);
  const configuredB = Math.max((fields[0]?.properties.magnitude as number) ?? 0, 0);
  const effectiveB = fieldSample.magnitude || configuredB;
  const radius = charge > 0 && effectiveB > 0 ? (mass * Math.max(speed, 0)) / (charge * effectiveB) : null;
  const period = charge > 0 && effectiveB > 0 ? (2 * Math.PI * mass) / (charge * effectiveB) : null;
  const particleCount = particles.length;
  const boundaryRadius = (fields[0]?.properties.boundaryRadius as number | undefined) ?? radius;

  if (presetId === 'P02-EMF036-magnetic-divergence') {
    const speeds = particles.map((item) => {
      const currentMotion = motionStates?.get(item.id);
      return currentMotion
        ? Math.hypot(currentMotion.velocity.x, currentMotion.velocity.y)
        : getPointChargeLaunchState(item).speed;
    });
    const speedMin = speeds.length > 0 ? Math.min(...speeds) : 0;
    const speedMax = speeds.length > 0 ? Math.max(...speeds) : 0;
    const radiusMin = charge > 0 && effectiveB > 0 ? (mass * speedMin) / (charge * effectiveB) : null;
    const radiusMax = charge > 0 && effectiveB > 0 ? (mass * speedMax) / (charge * effectiveB) : null;

    return {
      formula: 'r = mv / (|q|B)',
      explanation: '场区圆半径固定取 baseSpeed 参考粒子的回旋半径；参考粒子与磁场圆相切匹配，其余粒子只改变速度，因此会围绕这条参考圆向内/向外发散。',
      keyParameters: [
        { label: '电荷量 q', value: `${formatSignedNumber(signedCharge, 3)} C` },
        { label: '质量 m', value: `${formatShort(mass)} kg` },
        { label: '参与粒子', value: `${particleCount} 个` },
        { label: '参考规则', value: '取 baseSpeed 参考粒子' },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '速度范围', value: `${formatShort(speedMin)} ~ ${formatShort(speedMax)} m/s` },
        { label: '场区圆半径', value: boundaryRadius != null ? `${formatShort(boundaryRadius)} m` : '—' },
        {
          label: '半径范围 r',
          value:
            radiusMin != null && radiusMax != null
              ? `${formatShort(radiusMin)} ~ ${formatShort(radiusMax)} m`
              : '—',
        },
        { label: '对比方式', value: '参考粒子匹配磁场圆' },
      ],
    };
  }

  if (presetId === 'P02-EMF033-magnetic-focusing') {
    const speeds = particles.map((item) => {
      const currentMotion = motionStates?.get(item.id);
      return currentMotion
        ? Math.hypot(currentMotion.velocity.x, currentMotion.velocity.y)
        : getPointChargeLaunchState(item).speed;
    });
    const speedRange = speeds.length > 0
      ? `${formatShort(Math.min(...speeds))} ~ ${formatShort(Math.max(...speeds))} m/s`
      : '—';
    return {
      formula: 'r = mv / (|q|B)，T = 2πm / (|q|B)',
      explanation: '场区圆半径取会聚粒子族中最小回旋半径的基准轨道；这条基准圆同时通过源点和焦点，其余粒子半径更大，但仍在同一磁场圆内汇聚到同一焦点。',
      keyParameters: [
        { label: '电荷量 q', value: `${formatSignedNumber(signedCharge, 3)} C` },
        { label: '质量 m', value: `${formatShort(mass)} kg` },
        { label: '参与粒子', value: `${particleCount} 个` },
        { label: '参考规则', value: '取最小会聚半径轨道' },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '速度范围', value: speedRange },
        { label: '场区圆半径', value: boundaryRadius != null ? `${formatShort(boundaryRadius)} m` : '—' },
        { label: '几何关系', value: '基准圆经过源点与焦点' },
        { label: '周期 T', value: period != null ? `${formatShort(period)} s` : '—' },
      ],
    };
  }

  if (presetId === 'P02-EMF037-translation-circle') {
    const yValues = particles.map((item) => item.transform.position.y).sort((a, b) => a - b);
    const spacing = yValues.length >= 2 ? yValues[1]! - yValues[0]! : 0;
    return {
      formula: 'r = mv / (|q|B)',
      explanation: '平移圆模型强调“同速度、同荷质比、不同入射点”时，各轨迹圆半径相同，只是整体平移，因此适合处理等半径轨迹族的几何拼接。',
      keyParameters: [
        { label: '共同速度 v', value: `${formatShort(speed)} m/s` },
        { label: '共同荷质比 q/m', value: `${formatShort(charge / mass)} C/kg` },
        { label: '参与粒子', value: `${particleCount} 个` },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '共同半径 r', value: radius != null ? `${formatShort(radius)} m` : '—' },
        { label: '入射点间距', value: `${formatShort(Math.abs(spacing))} m` },
        { label: '几何方法', value: '等半径平移圆' },
      ],
    };
  }

  if (presetId === 'P02-EMF038-rotation-circle') {
    const launchAngles = particles.map((item) => getPointChargeLaunchState(item).angleDeg);
    const angleRange = launchAngles.length > 0
      ? `${Math.min(...launchAngles).toFixed(0)}° ~ ${Math.max(...launchAngles).toFixed(0)}°`
      : '—';
    return {
      formula: 'r = mv / (|q|B)',
      explanation: '旋转圆模型强调“同一点、同速度、不同入射角”时，各轨迹圆半径相同，圆心随入射方向旋转分布，适合讲解从同一点发射的轨迹圆作图。',
      keyParameters: [
        { label: '共同速度 v', value: `${formatShort(speed)} m/s` },
        { label: '共同荷质比 q/m', value: `${formatShort(charge / mass)} C/kg` },
        { label: '参与粒子', value: `${particleCount} 个` },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '共同半径 r', value: radius != null ? `${formatShort(radius)} m` : '—' },
        { label: '入射角范围', value: angleRange },
        { label: '几何方法', value: '等半径旋转圆' },
      ],
    };
  }

  if (presetId === 'P02-EMF039-scaling-circle') {
    const speeds = particles.map((item) => getPointChargeLaunchState(item).speed);
    const radiusValues = particles
      .map((item) => {
        const launch = getPointChargeLaunchState(item);
        if (Math.abs(charge) < 1e-9 || effectiveB <= 1e-9) return null;
        return (mass * launch.speed) / (Math.abs(charge) * effectiveB);
      })
      .filter((value): value is number => value != null);
    const speedRange = speeds.length > 0
      ? `${formatShort(Math.min(...speeds))} ~ ${formatShort(Math.max(...speeds))} m/s`
      : '—';
    const radiusRange = radiusValues.length > 0
      ? `${formatShort(Math.min(...radiusValues))} ~ ${formatShort(Math.max(...radiusValues))} m`
      : '—';
    return {
      formula: 'r = mv / (|q|B)',
      explanation: '放缩圆模型强调“同一点、同方向”发射时，速度越大半径越大，轨迹圆保持同一切线方向并按半径成比例放缩。',
      keyParameters: [
        { label: '共同入射点', value: '同一点发射' },
        { label: '共同切线方向', value: `${formatShort(launch.angleDeg)}°` },
        { label: '参与粒子', value: `${particleCount} 个` },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '速度范围', value: speedRange },
        { label: '半径范围', value: radiusRange },
        { label: '几何方法', value: '放缩圆' },
      ],
    };
  }

  if (presetId === 'P02-EM003-cyclotron-motion') {
    return {
      formula: 'r = mv / (|q|B)，T = 2πm / (|q|B)',
      explanation: '先观察单粒子在匀强磁场中的标准圆周运动，再进入各类边界模型，会更容易理解半径、周期和偏转方向。',
      keyParameters: [
        { label: '电荷量 q', value: `${formatSignedNumber(signedCharge, 3)} C` },
        { label: '质量 m', value: `${formatShort(mass)} kg` },
        { label: '初速度 v₀', value: `${formatShort(launch.speed)} m/s` },
      ],
      metrics: [
        { label: '当前 B', value: `${formatShort(effectiveB)} T` },
        { label: '当前速度', value: `${formatShort(speed)} m/s` },
        { label: '圆周半径 r', value: radius != null ? `${formatShort(radius)} m` : '—' },
        { label: '周期 T', value: period != null ? `${formatShort(period)} s` : '—' },
      ],
    };
  }

  return {
    formula: 'r = mv / (|q|B)，T = 2πm / (|q|B)',
    explanation: fieldSample.inField
      ? '粒子当前仍在磁场区域内，可直接观察半径与周期随 q/m、B 的变化。'
      : '粒子离开磁场区域后将转为匀速直线运动，但圆周半径公式仍可用于回推入场阶段。',
    keyParameters: [
      { label: '电荷量 q', value: `${formatSignedNumber(signedCharge, 3)} C` },
      { label: '质量 m', value: `${formatShort(mass)} kg` },
      { label: '初速度 v₀', value: `${formatShort(launch.speed)} m/s` },
      ...(particleCount > 1 ? [{ label: '参与粒子', value: `${particleCount} 个` }] : []),
    ],
    metrics: [
      { label: '当前 B', value: `${formatShort(effectiveB)} T` },
      { label: '当前速度', value: `${formatShort(speed)} m/s` },
      { label: '圆周半径 r', value: radius != null ? `${formatShort(radius)} m` : '—' },
      { label: '周期 T', value: period != null ? `${formatShort(period)} s` : '—' },
    ],
  };
}

function buildCombinedFieldSummary(
  presetId: string,
  particle: Entity,
  motion: MotionState | undefined,
  efields: Entity[],
  bfields: Entity[],
  paramValues: ParamValues,
  resultTime: number,
): Partial<P08SceneSummary> {
  const charge = Math.abs((particle.properties.charge as number) ?? 0);
  const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const speed = motion
    ? Math.hypot(motion.velocity.x, motion.velocity.y)
    : getPointChargeLaunchState(particle).speed;
  const effectiveE = getEffectiveE(efields[0]!);
  const fieldSample = sampleMagneticFieldAtPoint(motion?.position ?? particle.transform.position, bfields);
  const effectiveB = fieldSample.magnitude || Math.max((bfields[0]?.properties.magnitude as number) ?? 0, 0);
  const selectorSpeed = effectiveB > 0 ? effectiveE / effectiveB : null;
  const electricForceMagnitude = charge * effectiveE;
  const magneticForceMagnitude = charge * speed * effectiveB;
  const balanceTolerance = Math.max(electricForceMagnitude, magneticForceMagnitude, 0.05) * 0.02;
  const radius = charge > 0 && effectiveB > 0 ? (mass * speed) / (charge * effectiveB) : null;
  const period = charge > 0 && effectiveB > 0 ? (2 * Math.PI * mass) / (charge * effectiveB) : null;

  if (presetId === 'P02-EMF042-cyclotron') {
    return {
      formula: 'T = 2πm / (|q|B)，r = mv / (|q|B)',
      explanation: '回旋加速器重点看速度增加后半径逐渐变大，而周期主要由 m、q、B 决定。',
      keyParameters: [
        { label: '交变电场 E', value: `${formatShort(effectiveE)} V/m` },
        { label: '磁感应强度 B', value: `${formatShort(effectiveB)} T` },
      ],
      metrics: [
        { label: '当前速度', value: `${formatShort(speed)} m/s` },
        { label: '当前半径 r', value: radius != null ? `${formatShort(radius)} m` : '—' },
        { label: '周期 T', value: period != null ? `${formatShort(period)} s` : '—' },
        { label: '当前 E', value: `${formatShort(effectiveE)} V/m` },
      ],
    };
  }

  if (presetId === 'P02-EMF043-em-flowmeter') {
    const flowmeterValues = getFlowmeterSceneValues([particle, ...efields, ...bfields], paramValues);
    const flowSpeed = flowmeterValues?.speed ?? Math.max((getPointChargeLaunchState(particle).velocity.x), 0);
    const pipeDiameter = flowmeterValues?.pipeDiameter ?? getEFieldGap(efields[0]!);
    const teachingState = getFlowmeterTeachingState({
      time: resultTime,
      speed: flowSpeed,
      magneticField: flowmeterValues?.magneticField ?? effectiveB,
      pipeDiameter,
    });
    return {
      formula: '过程：正负电荷分离 → 建立感应电场；平衡时 E = vB，U = BvL',
      explanation: teachingState.stageDescription,
      keyParameters: [
        { label: '过程阶段', value: teachingState.stageLabel },
        { label: '流速 v', value: `${formatShort(flowSpeed)} m/s` },
        { label: '磁感应强度 B', value: `${formatShort(effectiveB)} T` },
        { label: '管径 L', value: `${formatShort(pipeDiameter)} m` },
        { label: '平衡端电压 U', value: `${formatShort(teachingState.targetVoltage)} V` },
      ],
      metrics: [
        { label: '过程阶段', value: teachingState.stageLabel },
        { label: '流速 v', value: `${formatShort(flowSpeed)} m/s` },
        { label: '磁感应强度 B', value: `${formatShort(effectiveB)} T` },
        { label: '管径 L', value: `${formatShort(pipeDiameter)} m` },
        { label: '平衡端电压 U', value: `${formatShort(teachingState.targetVoltage)} V` },
        { label: '当前感应电场 E感', value: `${formatShort(teachingState.currentElectricField)} V/m` },
        { label: '当前感应电压 U感', value: `${formatShort(teachingState.currentVoltage)} V` },
        { label: '建立进度', value: `${formatShort(teachingState.buildupRatio * 100)} %` },
        { label: '未平衡量 vB-E感', value: `${formatShort(teachingState.balanceGap)} V/m` },
      ],
    };
  }

  const isBalanced =
    selectorSpeed != null &&
    Math.abs(electricForceMagnitude - magneticForceMagnitude) <= balanceTolerance;
  const magneticDominates = magneticForceMagnitude > electricForceMagnitude + balanceTolerance;
  const electricDominates = electricForceMagnitude > magneticForceMagnitude + balanceTolerance;
  const forceRelation = isBalanced
    ? 'FE = FB'
    : magneticDominates
      ? 'FB > FE'
      : electricDominates
        ? 'FE > FB'
        : 'FE ≈ FB';
  const motionOutcome = isBalanced
    ? '水平直线通过'
    : magneticDominates
      ? '向上偏转'
      : electricDominates
        ? '向下偏转'
        : '接近直线通过';
  const explanation = effectiveB <= 1e-9
    ? '当前磁场近似为零，只有电场力作用，不能形成速度选择。'
    : isBalanced
      ? '当前正电荷所受电场力向下、磁场力向上，二者大小相等且方向相反，所以粒子会水平直线通过。'
      : magneticDominates
        ? '当前正电荷所受磁场力向上且大于向下的电场力，因此合力向上，粒子会向上偏转。只有当两力大小相等、方向相反时，粒子才会直线通过。'
        : '当前正电荷所受电场力向下且大于向上的磁场力，因此合力向下，粒子会向下偏转。只有当两力大小相等、方向相反时，粒子才会直线通过。';

  return {
    formula: '直线通过条件：FE = FB，方向相反；qE = qvB → v = E / B',
    explanation,
    keyParameters: [
      { label: '电场强度 E', value: `${formatShort(effectiveE)} V/m` },
      { label: '磁感应强度 B', value: `${formatShort(effectiveB)} T` },
      { label: '电场方向', value: '向下' },
      { label: '磁场方向', value: '垂直纸面向里 ×' },
    ],
    metrics: [
      { label: '当前速度', value: `${formatShort(speed)} m/s` },
      { label: '选择速度 E/B', value: selectorSpeed != null ? `${formatShort(selectorSpeed)} m/s` : '—' },
      { label: '受力比较', value: forceRelation },
      { label: '运动结果', value: motionOutcome },
      { label: '电场力 FE', value: `${formatShort(electricForceMagnitude)} N` },
      { label: '磁场力 FB', value: `${formatShort(magneticForceMagnitude)} N` },
    ],
  };
}

function buildPotentialMeasurementSummary(
  charges: PointChargeSample[],
  potentialProbeA: Vec2 | null,
  potentialProbeB: Vec2 | null,
): PotentialMeasurementSummary {
  if (!potentialProbeA) {
    return {
      prompt: '点击画布依次放置 A / B 点，可直接测两点电势差。',
      rows: [],
    };
  }

  const potentialA = computePotentialAtPoint(potentialProbeA, charges);
  if (!potentialProbeB) {
    return {
      prompt: '已记录 A 点，继续点击画布放置 B 点。',
      rows: [
        { label: 'A 点坐标', value: `(${formatShort(potentialProbeA.x)}, ${formatShort(potentialProbeA.y)}) m` },
        { label: 'A 点电势 VA', value: `${formatPhysics(potentialA)} V` },
      ],
    };
  }

  const potentialB = computePotentialAtPoint(potentialProbeB, charges);
  const deltaV = potentialA - potentialB;
  return {
    prompt: '当前显示 ΔV = VA - VB。',
    rows: [
      { label: 'A 点电势 VA', value: `${formatPhysics(potentialA)} V` },
      { label: 'B 点电势 VB', value: `${formatPhysics(potentialB)} V` },
    ],
    deltaV: `${formatPhysics(deltaV)} V`,
  };
}

function buildPotentialMeasurementMetrics(
  charges: PointChargeSample[],
  potentialProbeA: Vec2 | null,
  potentialProbeB: Vec2 | null,
): P08SummaryRow[] {
  if (!potentialProbeA || !potentialProbeB) return [];

  const potentialA = computePotentialAtPoint(potentialProbeA, charges);
  const potentialB = computePotentialAtPoint(potentialProbeB, charges);
  return [
    { label: 'A 点电势 VA', value: `${formatPhysics(potentialA)} V` },
    { label: 'B 点电势 VB', value: `${formatPhysics(potentialB)} V` },
    { label: '两点电势差 ΔV', value: `${formatPhysics(potentialA - potentialB)} V` },
  ];
}

function mergeRows(primary: P08SummaryRow[], secondary: P08SummaryRow[]): P08SummaryRow[] {
  return [...primary, ...secondary].slice(0, 6);
}

function readOptionalNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedNumber(value: number, precision = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(precision)}`;
}

export function formatShort(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '-∞';
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) return value.toExponential(2);
  return value.toFixed(abs >= 100 ? 1 : 2);
}

export function formatPhysics(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '-∞';
  const abs = Math.abs(value);
  if (abs >= 1e5 || (abs > 0 && abs < 1e-2)) return value.toExponential(2);
  return value.toFixed(abs >= 100 ? 1 : 2);
}

function formatWithUnit(value: number, unit: string): string {
  return `${formatPhysics(value)} ${unit}`;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeVector(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-9) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function toVectorDirectionLabel(vector: Vec2): string {
  if (Math.abs(vector.x) < 1e-6 && Math.abs(vector.y) < 1e-6) return '—';
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? '向右' : '向左';
  }
  return vector.y >= 0 ? '向上' : '向下';
}

function toMagneticDirectionLabel(direction: 'into' | 'out' | null): string {
  if (direction === 'out') return '垂直纸面向外';
  if (direction === 'into') return '垂直纸面向内';
  return '—';
}
