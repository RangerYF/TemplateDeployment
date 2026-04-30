import type {
  Entity,
  ParamGroup,
  ParamSchema,
  ParamValues,
  Relation,
  SceneDefinition,
  SliderParamSchema,
  SelectParamSchema,
  ToggleParamSchema,
  ViewportType,
} from '@/core/types';
import type { SimulatorSceneLoadConfig } from '@/core/engine/simulator';
import { entityRegistry } from '@/core/registries/entity-registry';
import {
  getPointChargeLaunchState,
  velocityFromSpeedAndAngle,
} from '../logic/point-charge-kinematics';
import { DETECTOR_SCREEN_TYPE } from '../logic/detector-screen';
import {
  getEffectiveE,
  getUniformEFieldDerivedState,
  getUniformEFieldModelLabel,
} from '../logic/electric-force';
import { syncParticleEmitters } from '../logic/particle-emitter';
import { isDynamicPointCharge, isSourcePointCharge } from '../logic/point-charge-role';

export const P08_FIELD_BUILDER_SCENE_ID = 'P08-BUILDER';
const BUILDER_INTERNAL_FLAG = 'builderInternal';
const BUILDER_EMITTER_POOL_SIZE = 12;

export type P08BuilderEntityKind =
  | 'point-charge-source'
  | 'point-charge-particle'
  | 'particle-emitter'
  | 'uniform-efield'
  | 'uniform-bfield'
  | 'detector-screen'
  | 'straight-wire'
  | 'circular-current'
  | 'solenoid';

export interface P08BuilderPaletteItem {
  kind: P08BuilderEntityKind;
  label: string;
  description: string;
}

export const P08_FIELD_BUILDER_PALETTE: readonly P08BuilderPaletteItem[] = [
  {
    kind: 'point-charge-source',
    label: '点电荷',
    description: '静电场场源，支持拖拽和调电荷量。',
  },
  {
    kind: 'point-charge-particle',
    label: '带电粒子',
    description: '用于电场/磁场/复合场中的运动演示。',
  },
  {
    kind: 'particle-emitter',
    label: '粒子源',
    description: '一次发射多粒子，支持平移圆、旋转圆、放缩圆、磁聚焦与磁发散。',
  },
  {
    kind: 'uniform-efield',
    label: '匀强电场',
    description: '支持平行板恒压/定电荷模型，也可切回直接设定 E。',
  },
  {
    kind: 'uniform-bfield',
    label: '匀强磁场',
    description: '可调磁感应强度、方向和区域尺寸。',
  },
  {
    kind: 'detector-screen',
    label: '接收屏',
    description: '用于观察粒子离场后的落点位置。',
  },
  {
    kind: 'straight-wire',
    label: '长直导线',
    description: '静磁场磁感线演示，电流方向可切换。',
  },
  {
    kind: 'circular-current',
    label: '圆形电流',
    description: '圆形电流磁场，支持半径与电流方向。',
  },
  {
    kind: 'solenoid',
    label: '螺线管',
    description: '内部 B 方向随电流方向同步变化。',
  },
] as const;

export function createP08BuilderEntity(
  kind: P08BuilderEntityKind,
  index: number,
): Entity {
  const offset = {
    x: (index % 3) * 0.7,
    y: -Math.floor(index / 3) * 0.6,
  };

  switch (kind) {
    case 'point-charge-source':
      return createEntity('point-charge', {
        transform: { position: { x: -1.4 + offset.x, y: 0.8 + offset.y }, rotation: 0 },
        properties: {
          pointChargeRole: 'source',
          charge: 1,
          mass: 1,
          initialVelocity: { x: 0, y: 0 },
          radius: 0.16,
        },
        label: '点电荷',
      });
    case 'point-charge-particle':
      return createEntity('point-charge', {
        transform: { position: { x: -2.4 + offset.x, y: 0 + offset.y }, rotation: 0 },
        properties: {
          pointChargeRole: 'particle',
          charge: 0.002,
          mass: 0.05,
          initialSpeed: 8,
          initialDirectionDeg: 0,
          initialVelocity: velocityFromSpeedAndAngle(8, 0),
          radius: 0.12,
        },
        label: '带电粒子',
      });
    case 'particle-emitter':
      return createEntity('particle-emitter', {
        transform: { position: { x: 0.2 + offset.x, y: 0 + offset.y }, rotation: 0 },
        properties: {
          pattern: 'translation-circle',
          particleCount: 5,
          launchAngleDeg: 0,
          baseSpeed: 2,
          angleSpreadDeg: 84,
          speedSpread: 2.2,
          entrySpacing: 1.2,
          focusDistance: 4.8,
          focusSpread: 1.8,
          charge: 0.1,
          mass: 0.1,
          particleRadius: 0.11,
          showParticleLabels: false,
          radius: 0.24,
        },
        label: '粒子源',
      });
    case 'uniform-efield':
      return createEntity('uniform-efield', {
        transform: { position: { x: -1.5 + offset.x, y: -1 + offset.y }, rotation: 0 },
        properties: {
          magnitude: 120,
          direction: { x: 0, y: -1 },
          fieldDirectionMode: 'downward',
          width: 4,
          height: 2,
          showPlates: true,
          capacitorModel: 'constant-voltage',
          voltage: 120,
          plateCharge: 2.13e-9,
          dielectric: 1,
        },
        label: '匀强电场',
      });
    case 'uniform-bfield':
      return createEntity('uniform-bfield', {
        transform: { position: { x: -1.8 + offset.x, y: -1.5 + offset.y }, rotation: 0 },
        properties: {
          magnitude: 0.6,
          direction: 'into',
          width: 4,
          height: 3,
        },
        label: '匀强磁场',
      });
    case 'detector-screen':
      return createEntity(DETECTOR_SCREEN_TYPE, {
        transform: { position: { x: 3.8 + offset.x, y: -1.8 + offset.y }, rotation: 0 },
        properties: {
          width: 0.18,
          height: 3.6,
        },
        label: '接收屏',
      });
    case 'straight-wire':
      return createEntity('current-wire', {
        transform: { position: { x: -0.05 + offset.x, y: -2 + offset.y }, rotation: 0 },
        properties: {
          current: 5,
          length: 4,
          height: 4,
          width: 0.1,
          wireShape: 'straight',
          wireDirection: { x: 0, y: 1 },
          currentDirectionMode: 'up',
        },
        label: '长直导线',
      });
    case 'circular-current':
      return createEntity('current-wire', {
        transform: { position: { x: 0 + offset.x, y: 0 + offset.y }, rotation: 0 },
        properties: {
          current: 5,
          wireShape: 'loop',
          loopRadius: 1,
          currentDirectionMode: 'counterclockwise',
          width: 2,
          height: 2,
        },
        label: '圆形电流',
      });
    case 'solenoid':
      return createEntity('solenoid', {
        transform: { position: { x: -1.5 + offset.x, y: -0.6 + offset.y }, rotation: 0 },
        properties: {
          current: 2,
          currentDirectionMode: 'rightward',
          turns: 500,
          length: 3,
          width: 3,
          height: 1.2,
        },
        label: '螺线管',
      });
  }
}

export function createP08BuilderSceneLoadConfig(
  entities: Iterable<Entity>,
  preferredViewport?: ViewportType,
): SimulatorSceneLoadConfig {
  const scene = buildSceneDefinition(entities);
  const entityList = Array.from(scene.entities.values());
  const dynamicParticles = entityList.filter(isDynamicPointCharge);
  const staticCharges = entityList.filter(isSourcePointCharge);
  const hasEField = entityList.some((entity) => entity.type === 'uniform-efield');
  const hasBField = entityList.some((entity) => entity.type === 'uniform-bfield');

  let solveMode: SimulatorSceneLoadConfig['solveMode'] = 'analytical';
  let duration = 0;
  let solverQualifier: Record<string, string> | undefined;
  let defaultViewport = preferredViewport ?? 'field';

  if (dynamicParticles.length > 0 && hasEField && hasBField) {
    solveMode = 'numerical';
    duration = 12;
    solverQualifier = { interaction: 'combined' };
    defaultViewport = preferredViewport ?? 'motion';
  } else if (dynamicParticles.length > 0 && hasEField) {
    solveMode = 'numerical';
    duration = 12;
    solverQualifier = { interaction: 'electric' };
    defaultViewport = preferredViewport ?? 'motion';
  } else if (dynamicParticles.length > 0 && hasBField) {
    solveMode = 'numerical';
    duration = 12;
    solverQualifier = { interaction: 'magnetic' };
    defaultViewport = preferredViewport ?? 'motion';
  } else if (staticCharges.length > 0 && !hasEField && !hasBField) {
    solveMode = 'analytical';
    duration = 0;
    solverQualifier = { interaction: 'electrostatic' };
    defaultViewport = preferredViewport ?? 'field';
  }

  return {
    scene,
    solveMode,
    duration,
    defaultViewport,
    supportedViewports: ['field', 'motion', 'force'],
    solverQualifier,
  };
}

function buildSceneDefinition(entities: Iterable<Entity>): SceneDefinition {
  const builderEntities = Array.from(entities).filter((entity) => !isP08BuilderInternalEntity(entity));
  const entityMap = new Map(Array.from(builderEntities, (entity) => [entity.id, entity] as const));
  const paramGroups: ParamGroup[] = [];
  const paramValues: ParamValues = {};

  for (const entity of builderEntities) {
    const params = buildEntityParamSchemas(entity);
    if (params.length === 0) continue;
    paramGroups.push({
      key: `builder-${entity.id}`,
      label: entity.label ?? entity.type,
      params,
    });
    for (const schema of params) {
      paramValues[schema.key] = readSchemaValue(schema, entity);
    }
  }

  const hasLoopWire = Array.from(entityMap.values()).some(
    (entity) =>
      entity.type === 'current-wire' &&
      ((entity.properties.wireShape as string | undefined) ?? 'straight') === 'loop',
  );

  if (hasLoopWire) {
    paramValues.loopViewMode ??= 'isometric';
    paramValues.loopShowAuxiliaryLabels ??= true;
  }

  appendEmitterParticlePool(entityMap);

  const scene: SceneDefinition = {
    entities: entityMap,
    relations: buildSceneRelations(entityMap.values()),
    paramGroups,
    paramValues,
  };

  syncParticleEmitters(scene);
  return scene;
}

function buildSceneRelations(entities: Iterable<Entity>): Relation[] {
  const entityList = Array.from(entities);
  const particles = entityList.filter(
    (entity) => entity.type === 'point-charge' && !isSourcePointCharge(entity),
  );
  const fieldEntities = entityList.filter(
    (entity) => entity.type === 'uniform-efield' || entity.type === 'uniform-bfield',
  );
  const relations: Relation[] = [];

  for (const emitter of entityList.filter((entity) => entity.type === 'particle-emitter')) {
    for (const particle of particles.filter(
      (candidate) => candidate.properties.builderParentEntityId === emitter.id,
    )) {
      relations.push({
        id: `builder-emits-${emitter.id}-${particle.id}`,
        type: 'emits',
        sourceEntityId: emitter.id,
        targetEntityId: particle.id,
        properties: {},
      });
    }
  }

  for (const field of fieldEntities) {
    for (const particle of particles) {
      relations.push({
        id: `builder-rel-${field.id}-${particle.id}`,
        type: 'field-effect',
        sourceEntityId: field.id,
        targetEntityId: particle.id,
        properties: {},
      });
    }
  }

  return relations;
}

function buildEntityParamSchemas(entity: Entity): ParamSchema[] {
  if (entity.type === 'point-charge') {
    return isSourcePointCharge(entity)
      ? [
        slider(entity, 'charge', '电荷量 Q', -10, 10, 0.1, 'μC', 1),
      ]
      : [
        slider(entity, 'charge', '电荷量 q', -1, 1, 0.001, 'C', 3),
        slider(entity, 'mass', '质量 m', 0.001, 0.1, 0.001, 'kg', 3),
        slider(entity, 'initialSpeed', '初速度大小', 0, 20, 0.5, 'm/s', 1),
        slider(entity, 'initialDirectionDeg', '初速度方向', 0, 360, 5, '°', 0),
      ];
  }

  if (entity.type === 'particle-emitter') {
    const patternKey = paramKey(entity, 'pattern');
    return [
      select(entity, 'pattern', '发射模式', [
        { value: 'translation-circle', label: '平移圆' },
        { value: 'rotation-circle', label: '旋转圆' },
        { value: 'scaling-circle', label: '放缩圆' },
        { value: 'focusing', label: '磁聚焦' },
        { value: 'divergence', label: '磁发散' },
      ]),
      slider(entity, 'particleCount', '粒子数', 1, BUILDER_EMITTER_POOL_SIZE, 1, '个', 0),
      slider(entity, 'charge', '电荷量 q', 0.02, 0.4, 0.01, 'C', 2),
      slider(entity, 'mass', '质量 m', 0.02, 0.4, 0.01, 'kg', 2),
      slider(entity, 'particleRadius', '粒子半径', 0.05, 0.2, 0.01, 'm', 2),
      slider(entity, 'launchAngleDeg', '中心发射方向', 0, 360, 5, '°', 0),
      {
        ...slider(entity, 'baseSpeed', '基准速度', 0.5, 5, 0.1, 'm/s', 1),
        visibleWhen: [{ key: patternKey, notEquals: 'focusing' }],
      },
      {
        ...slider(entity, 'entrySpacing', '入射点间距', 0.4, 2, 0.1, 'm', 1),
        visibleWhen: [{ key: patternKey, equals: 'translation-circle' }],
      },
      {
        ...slider(entity, 'angleSpreadDeg', '入射角张角', 0, 360, 2, '°', 0),
        visibleWhen: [{ key: patternKey, equals: 'rotation-circle' }],
      },
      {
        ...slider(entity, 'speedSpread', '速度跨度', 0.2, 4, 0.1, 'm/s', 1),
        visibleWhen: [
          { key: patternKey, notEquals: 'translation-circle' },
          { key: patternKey, notEquals: 'rotation-circle' },
          { key: patternKey, notEquals: 'focusing' },
        ],
      },
      {
        ...slider(entity, 'focusDistance', '会聚距离', 1.5, 7, 0.1, 'm', 1),
        visibleWhen: [{ key: patternKey, equals: 'focusing' }],
      },
      {
        ...slider(entity, 'focusSpread', '会聚张开量', 0.2, 3, 0.1, 'm', 1),
        visibleWhen: [{ key: patternKey, equals: 'focusing' }],
      },
      toggle(entity, 'showParticleLabels', '显示粒子标签', '显示', '隐藏'),
    ];
  }

  if (entity.type === 'uniform-efield') {
    const showPlatesKey = paramKey(entity, 'showPlates');
    const capacitorModelKey = paramKey(entity, 'capacitorModel');

    return [
      toggle(entity, 'showPlates', '显示极板', '显示', '隐藏'),
      {
        ...select(entity, 'capacitorModel', '电容器模型', [
          { value: 'constant-voltage', label: '恒压' },
          { value: 'constant-charge', label: '定电荷' },
        ]),
        visibleWhen: [{ key: showPlatesKey, equals: true }],
      },
      {
        ...slider(entity, 'magnitude', '直接设定 E', 20, 2000, 10, 'V/m', 0),
        visibleWhen: [{ key: showPlatesKey, equals: false }],
      },
      {
        ...slider(entity, 'voltage', '极板电压 U', 20, 600, 10, 'V', 0),
        visibleWhen: [
          { key: showPlatesKey, equals: true },
          { key: capacitorModelKey, equals: 'constant-voltage' },
        ],
      },
      {
        ...slider(entity, 'plateCharge', '极板电荷 Q', 0, 2e-8, 1e-10, 'C', 3),
        visibleWhen: [
          { key: showPlatesKey, equals: true },
          { key: capacitorModelKey, equals: 'constant-charge' },
        ],
      },
      {
        ...slider(entity, 'dielectric', '相对介电常数 εr', 1, 8, 0.1, '', 1),
        visibleWhen: [{ key: showPlatesKey, equals: true }],
      },
      select(entity, 'fieldDirectionMode', '电场方向', [
        { value: 'rightward', label: '向右' },
        { value: 'leftward', label: '向左' },
        { value: 'upward', label: '向上' },
        { value: 'downward', label: '向下' },
      ]),
      slider(entity, 'width', '极板宽度 / 区域宽度', 1, 10, 0.5, 'm', 1),
      slider(entity, 'height', '极板间距 / 区域高度', 0.5, 8, 0.5, 'm', 1),
    ];
  }

  if (entity.type === 'uniform-bfield') {
    return [
      slider(entity, 'magnitude', '磁感应强度', 0.05, 2, 0.05, 'T', 2),
      select(entity, 'direction', '磁场方向', [
        { value: 'into', label: '垂直纸面向内' },
        { value: 'out', label: '垂直纸面向外' },
      ]),
      slider(entity, 'width', '区域宽度', 1, 10, 0.5, 'm', 1),
      slider(entity, 'height', '区域高度', 1, 8, 0.5, 'm', 1),
    ];
  }

  if (entity.type === DETECTOR_SCREEN_TYPE) {
    return [
      slider(entity, 'width', '屏宽', 0.1, 1, 0.05, 'm', 2),
      slider(entity, 'height', '屏高', 1, 8, 0.2, 'm', 1),
    ];
  }

  if (entity.type === 'current-wire') {
    const wireShape = (entity.properties.wireShape as string | undefined) ?? 'straight';
    if (wireShape === 'loop') {
      return [
        slider(entity, 'current', '电流大小', 0.5, 20, 0.5, 'A', 1),
        select(entity, 'currentDirectionMode', '电流方向', [
          { value: 'counterclockwise', label: '逆时针' },
          { value: 'clockwise', label: '顺时针' },
        ]),
        slider(entity, 'loopRadius', '线圈半径', 0.5, 3, 0.1, 'm', 1),
      ];
    }

    return [
      slider(entity, 'current', '电流大小', 0.5, 20, 0.5, 'A', 1),
      select(entity, 'currentDirectionMode', '电流方向', [
        { value: 'up', label: '向上' },
        { value: 'down', label: '向下' },
      ]),
      slider(entity, 'length', '导线长度', 1, 8, 0.5, 'm', 1),
    ];
  }

  if (entity.type === 'solenoid') {
    return [
      slider(entity, 'current', '电流大小', 0.5, 10, 0.5, 'A', 1),
      select(entity, 'currentDirectionMode', '电流方向', [
        { value: 'rightward', label: '上侧向右' },
        { value: 'leftward', label: '上侧向左' },
      ]),
      slider(entity, 'turns', '匝数', 50, 2000, 50, '匝', 0),
      slider(entity, 'length', '螺线管长度', 1.5, 6, 0.5, 'm', 1),
    ];
  }

  return [];
}

function slider(
  entity: Entity,
  property: string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string,
  precision: number,
): SliderParamSchema {
  return {
    key: paramKey(entity, property),
    label,
    type: 'slider',
    min,
    max,
    step,
    default: readNumber(readEntityProperty(entity, property, min), min),
    unit,
    precision,
    targetEntityId: entity.id,
    targetProperty: property,
  };
}

function select(
  entity: Entity,
  property: string,
  label: string,
  options: SelectParamSchema['options'],
): SelectParamSchema {
  const currentValue = readEntityProperty(entity, property, options[0]?.value ?? '');
  return {
    key: paramKey(entity, property),
    label,
    type: 'select',
    options,
    default: String(currentValue),
    targetEntityId: entity.id,
    targetProperty: property,
  };
}

function toggle(
  entity: Entity,
  property: string,
  label: string,
  labelOn?: string,
  labelOff?: string,
): ToggleParamSchema {
  const currentValue = readEntityProperty(entity, property, false);
  return {
    key: paramKey(entity, property),
    label,
    type: 'toggle',
    default: Boolean(currentValue),
    labelOn,
    labelOff,
    targetEntityId: entity.id,
    targetProperty: property,
  };
}

function paramKey(entity: Entity, property: string): string {
  return `builder.${entity.id}.${property}`;
}

function readSchemaValue(schema: ParamSchema, entity: Entity): ParamValues[string] {
  if (schema.targetProperty) {
    return readEntityProperty(entity, schema.targetProperty, schema.default);
  }
  return schema.default;
}

function readEntityProperty(entity: Entity, propertyPath: string, fallback: ParamValues[string]): ParamValues[string] {
  if (propertyPath === 'initialSpeed' || propertyPath === 'initialDirectionDeg') {
    const launch = getPointChargeLaunchState(entity);
    return propertyPath === 'initialSpeed' ? launch.speed : launch.angleDeg;
  }

  if (propertyPath === 'fieldDirectionMode') {
    const configured = entity.properties.fieldDirectionMode;
    if (typeof configured === 'string') return configured;
    const direction = (entity.properties.direction as { x: number; y: number } | undefined) ?? { x: 0, y: -1 };
    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      return direction.x >= 0 ? 'rightward' : 'leftward';
    }
    return direction.y >= 0 ? 'upward' : 'downward';
  }

  if (propertyPath === 'currentDirectionMode' && entity.type === 'current-wire') {
    const configured = entity.properties.currentDirectionMode;
    if (typeof configured === 'string') return configured;
    const wireShape = (entity.properties.wireShape as string | undefined) ?? 'straight';
    if (wireShape === 'loop') {
      return 'counterclockwise';
    }
    const wireDirection = (entity.properties.wireDirection as { x: number; y: number } | undefined) ?? { x: 0, y: 1 };
    return wireDirection.y >= 0 ? 'up' : 'down';
  }

  if (propertyPath === 'currentDirectionMode' && entity.type === 'solenoid') {
    const configured = entity.properties.currentDirectionMode;
    return typeof configured === 'string' ? configured : 'rightward';
  }

  if (propertyPath.startsWith('transform.')) {
    const value = propertyPath.split('.').slice(1).reduce<unknown>((current, key) => {
      if (current == null || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[key];
    }, entity.transform as unknown);
    return value as ParamValues[string] ?? fallback;
  }

  const value = propertyPath.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, entity.properties as unknown);

  return value as ParamValues[string] ?? fallback;
}

function createEntity(
  type: string,
  overrides: Parameters<NonNullable<ReturnType<typeof entityRegistry.get>>['createEntity']>[0],
): Entity {
  const registration = entityRegistry.get(type);
  if (!registration) {
    throw new Error(`实体类型 "${type}" 未注册`);
  }
  return registration.createEntity(overrides);
}

export function getEntityDisplayName(entity: Entity): string {
  if (entity.type === 'point-charge') {
    return isSourcePointCharge(entity) ? '点电荷' : '带电粒子';
  }
  if (entity.type === 'particle-emitter') {
    return '粒子源';
  }
  if (entity.type === 'current-wire') {
    return ((entity.properties.wireShape as string | undefined) ?? 'straight') === 'loop'
      ? '圆形电流'
      : '长直导线';
  }
  return entity.label ?? entity.type;
}

export function getEntityMetaText(entity: Entity): string {
  if (entity.type === 'point-charge') {
    if (isSourcePointCharge(entity)) {
      return `Q=${readNumber(entity.properties.charge, 0).toFixed(1)} μC`;
    }
    const launch = getPointChargeLaunchState(entity);
    return `q=${readNumber(entity.properties.charge, 0).toFixed(3)} C · v0=${launch.speed.toFixed(1)} m/s`;
  }
  if (entity.type === 'particle-emitter') {
    const pattern = getEmitterPatternLabel(entity.properties.pattern);
    const count = readNumber(entity.properties.particleCount, 0).toFixed(0);
    return `${pattern} · ${count} 粒子`;
  }
  if (entity.type === 'uniform-efield') {
    const state = getUniformEFieldDerivedState(entity);
    if (state.model === 'direct') {
      return `E=${formatBuilderScalar(getEffectiveE(entity))} V/m`;
    }
    return `${getUniformEFieldModelLabel(state.model)} · E=${formatBuilderScalar(Math.abs(state.effectiveE))} V/m`;
  }
  if (entity.type === 'uniform-bfield') {
    return `B=${readNumber(entity.properties.magnitude, 0).toFixed(2)} T`;
  }
  if (entity.type === DETECTOR_SCREEN_TYPE) {
    return `W=${readNumber(entity.properties.width, 0).toFixed(2)} m · H=${readNumber(entity.properties.height, 0).toFixed(1)} m`;
  }
  if (entity.type === 'current-wire') {
    return `I=${readNumber(entity.properties.current, 0).toFixed(1)} A`;
  }
  if (entity.type === 'solenoid') {
    return `I=${readNumber(entity.properties.current, 0).toFixed(1)} A · N=${readNumber(entity.properties.turns, 0).toFixed(0)}`;
  }
  return entity.type;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatBuilderScalar(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) return value.toExponential(2);
  return value.toFixed(abs >= 100 ? 0 : 1);
}

export function isP08BuilderInternalEntity(entity: Entity): boolean {
  return entity.properties[BUILDER_INTERNAL_FLAG] === true;
}

function appendEmitterParticlePool(entityMap: Map<string, Entity>): void {
  const emitters = Array.from(entityMap.values()).filter((entity) => entity.type === 'particle-emitter');
  for (const emitter of emitters) {
    const particleCount = Math.max(1, Math.min(
      BUILDER_EMITTER_POOL_SIZE,
      Math.round(readNumber(emitter.properties.particleCount, 1)),
    ));
    const baseSpeed = readNumber(emitter.properties.baseSpeed, 2);
    const launchAngleDeg = readNumber(emitter.properties.launchAngleDeg, 0);
    for (let index = 0; index < BUILDER_EMITTER_POOL_SIZE; index += 1) {
      const particleBase = createEntity('point-charge', {
        transform: {
          position: { ...emitter.transform.position },
          rotation: 0,
        },
        properties: {
          pointChargeRole: 'particle',
          particleActive: index < particleCount,
          charge: readNumber(emitter.properties.charge, 0.1),
          mass: readNumber(emitter.properties.mass, 0.1),
          initialVelocity: velocityFromSpeedAndAngle(baseSpeed, launchAngleDeg),
          initialSpeed: baseSpeed,
          initialDirectionDeg: launchAngleDeg,
          radius: readNumber(emitter.properties.particleRadius, 0.11),
          builderParentEntityId: emitter.id,
          [BUILDER_INTERNAL_FLAG]: true,
        },
      });
      const particle: Entity = {
        ...particleBase,
        id: `${emitter.id}__particle-${index + 1}`,
        label: undefined,
      };
      entityMap.set(particle.id, particle);
    }
  }
}

function getEmitterPatternLabel(pattern: unknown): string {
  switch (pattern) {
    case 'translation-circle':
      return '平移圆';
    case 'rotation-circle':
      return '旋转圆';
    case 'scaling-circle':
      return '放缩圆';
    case 'focusing':
      return '磁聚焦';
    case 'divergence':
      return '磁发散';
    default:
      return '粒子源';
  }
}
