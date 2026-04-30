import type { Entity, ParamValues } from '@/core/types';
import { resolveMeterConversionBuilderAnalysis } from './template-analysis';

export interface BuilderTemplateEntityPatch {
  entityType: string;
  propertyKey: string;
  value: number | boolean | string;
  match?: 'first' | 'all';
}

export type BuilderInstrumentEntityType = 'ammeter' | 'voltmeter' | 'galvanometer';

export interface BuilderInstrumentSlotDefinition {
  id: string;
  label: string;
  description: string;
  allowedEntityTypes: BuilderInstrumentEntityType[];
  matchEntityTypes?: BuilderInstrumentEntityType[];
  occurrence?: number;
  activityRole?: 'current' | 'voltage';
}

export interface BuilderTemplateVariant {
  id: string;
  label: string;
  shortLabel?: string;
  description: string;
  presetId: string;
  entityPatches?: BuilderTemplateEntityPatch[];
  instrumentSlots?: BuilderInstrumentSlotDefinition[];
  requiredEntityTypes?: string[];
  protectedEntityTypes?: string[];
}

export interface BuilderTemplateFamily {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  title: string;
  subtitle: string;
  description: string;
  structureLabel: string;
  adjustableParts: string[];
  lockedParts: string[];
  recommendedVariantId?: string;
  status?: 'ready' | 'planned';
  instrumentSlots?: BuilderInstrumentSlotDefinition[];
  requiredEntityTypes?: string[];
  protectedEntityTypes?: string[];
  variants: BuilderTemplateVariant[];
}

export interface BuilderInstrumentSlotBinding {
  slot: BuilderInstrumentSlotDefinition;
  entity?: Entity;
}

export const BUILDER_TEMPLATE_FAMILIES: BuilderTemplateFamily[] = [
  {
    id: 'voltammetry',
    categoryKey: 'resistance',
    categoryLabel: '测电阻',
    title: '伏安法测电阻',
    subtitle: '模板起步，内外接快速切换',
    description: '适合教材中的 Rx 测量实验，先选接法，再调整仪表和被测电阻参数。',
    structureLabel: '接法',
    adjustableParts: ['被测电阻 Rx', '电流表量程/内阻', '电压表量程/内阻', '电源参数'],
    lockedParts: ['主回路骨架', '电压表并联测量节点', '教材标准布局'],
    recommendedVariantId: 'internal',
    status: 'ready',
    requiredEntityTypes: ['dc-source', 'fixed-resistor', 'ammeter', 'voltmeter'],
    instrumentSlots: [
      {
        id: 'main-current-meter',
        label: '主电流表槽位',
        description: '串联在主回路中，负责当前电流判读。',
        allowedEntityTypes: ['ammeter', 'galvanometer'],
        matchEntityTypes: ['ammeter', 'galvanometer'],
        occurrence: 0,
        activityRole: 'current',
      },
      {
        id: 'main-voltmeter',
        label: '主电压表槽位',
        description: '并联在被测支路上，负责电压判读。',
        allowedEntityTypes: ['voltmeter'],
        occurrence: 0,
        activityRole: 'voltage',
      },
    ],
    variants: [
      {
        id: 'internal',
        label: '内接法',
        shortLabel: '内接',
        description: '电流表与被测电阻串联后整体处于电压表内侧，电压表跨 A+Rx 两端，测得电阻偏大。',
        presetId: 'P04-CIR-EXP001-voltammetry-internal',
      },
      {
        id: 'external',
        label: '外接法',
        shortLabel: '外接',
        description: '电流表在干路上测总电流，电压表只并联在被测电阻 Rx 两端，测得电阻偏小。',
        presetId: 'P04-CIR-EXP002-voltammetry-external',
      },
    ],
  },
];

export function getBuilderTemplateFamily(familyId: string): BuilderTemplateFamily | undefined {
  return BUILDER_TEMPLATE_FAMILIES.find((family) => family.id === familyId);
}

export function getBuilderTemplateVariant(
  familyId: string,
  variantId: string,
): BuilderTemplateVariant | undefined {
  return getBuilderTemplateFamily(familyId)?.variants.find((variant) => variant.id === variantId);
}

export function getBuilderTemplateInstrumentSlots(
  familyId: string,
  variantId: string,
): BuilderInstrumentSlotDefinition[] {
  const family = getBuilderTemplateFamily(familyId);
  const variant = family?.variants.find((item) => item.id === variantId);
  return variant?.instrumentSlots ?? family?.instrumentSlots ?? [];
}

export function resolveBuilderInstrumentSlotBindings(params: {
  familyId: string;
  variantId: string;
  entities: Map<string, Entity>;
}): BuilderInstrumentSlotBinding[] {
  const slots = getBuilderTemplateInstrumentSlots(params.familyId, params.variantId);
  const sortedEntities = Array.from(params.entities.values()).sort((left, right) => {
    const xDelta = left.transform.position.x - right.transform.position.x;
    if (Math.abs(xDelta) > 1e-6) return xDelta;

    const yDelta = left.transform.position.y - right.transform.position.y;
    if (Math.abs(yDelta) > 1e-6) return yDelta;

    return left.id.localeCompare(right.id);
  });

  return slots.map((slot) => {
    const matchTypes = slot.matchEntityTypes ?? slot.allowedEntityTypes;
    const candidates = sortedEntities.filter((entity) =>
      matchTypes.includes(entity.type as BuilderInstrumentEntityType),
    );

    return {
      slot,
      entity: candidates[slot.occurrence ?? 0],
    };
  });
}

export function getBuilderTemplateCategories(): Array<{
  key: string;
  label: string;
  families: BuilderTemplateFamily[];
}> {
  const categoryOrder = new Map<string, { key: string; label: string; families: BuilderTemplateFamily[] }>();

  for (const family of BUILDER_TEMPLATE_FAMILIES) {
    const existing = categoryOrder.get(family.categoryKey);
    if (existing) {
      existing.families.push(family);
    } else {
      categoryOrder.set(family.categoryKey, {
        key: family.categoryKey,
        label: family.categoryLabel,
        families: [family],
      });
    }
  }

  return Array.from(categoryOrder.values());
}

export function validateBuilderTemplateContext(params: {
  familyId: string;
  variantId: string;
  entities: Map<string, Entity>;
  activeCurrentMeterId?: string;
  activeVoltmeterId?: string;
  builderParamValues?: ParamValues;
}): { errors: string[]; warnings: string[] } {
  const family = getBuilderTemplateFamily(params.familyId);
  const variant = getBuilderTemplateVariant(params.familyId, params.variantId);
  if (!family || !variant) {
    return { errors: ['当前模板配置不存在，请重新选择模板'], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredEntityTypes = variant.requiredEntityTypes ?? family.requiredEntityTypes ?? [];
  const sceneTypes = new Set(Array.from(params.entities.values()).map((entity) => entity.type));

  for (const requiredType of requiredEntityTypes) {
    if (!sceneTypes.has(requiredType)) {
      errors.push(`缺少关键元件：${requiredType}`);
    }
  }

  const slotBindings = resolveBuilderInstrumentSlotBindings({
    familyId: params.familyId,
    variantId: params.variantId,
    entities: params.entities,
  });

  for (const binding of slotBindings) {
    if (!binding.entity) {
      errors.push(`模板槽位缺失：${binding.slot.label}`);
    }
  }

  for (const binding of slotBindings) {
    if (!binding.entity) continue;

    if (binding.slot.activityRole === 'current' && params.activeCurrentMeterId && binding.entity.id !== params.activeCurrentMeterId) {
      warnings.push(`当前主判读电流表不是 ${binding.slot.label}`);
    }
    if (binding.slot.activityRole === 'voltage' && params.activeVoltmeterId && binding.entity.id !== params.activeVoltmeterId) {
      warnings.push(`当前主判读电压表不是 ${binding.slot.label}`);
    }
  }

  if (params.familyId === 'meter-conversion') {
    const analysis = resolveMeterConversionBuilderAnalysis({
      variantId: params.variantId,
      entities: params.entities,
      builderParamValues: params.builderParamValues ?? {},
    });

    if (!analysis) {
      errors.push('电表改装模板缺少表头、改装电阻或改装后仪表');
    } else {
      if (!Number.isFinite(analysis.result.targetRange) || analysis.result.targetRange <= analysis.result.originalFullScale) {
        errors.push('改装后的目标量程必须大于原表头满偏量程');
      }
      if (Math.abs(analysis.result.fullScaleErrorPercent) >= 1) {
        warnings.push(
          `当前改装电阻会让满量程示值${analysis.result.fullScaleErrorPercent > 0 ? '偏大' : '偏小'}约 ${Math.abs(analysis.result.fullScaleErrorPercent).toFixed(2)}%`,
        );
      }
      if (analysis.result.isUnsafe) {
        warnings.push('当前工作点已让表头超过额定满偏值，存在过载风险');
      } else if (analysis.result.isOverRange) {
        warnings.push('当前工作点已超出改装后量程，指针只能停在满刻度附近');
      }
    }
  }

  return { errors, warnings };
}

export function getProtectedBuilderEntityIds(params: {
  familyId: string;
  variantId: string;
  entities: Map<string, Entity>;
}): Set<string> {
  const protectedIds = new Set<string>();
  const source = Array.from(params.entities.values()).find((entity) => entity.type === 'dc-source');
  if (source) {
    protectedIds.add(source.id);
  }

  const slotBindings = resolveBuilderInstrumentSlotBindings({
    familyId: params.familyId,
    variantId: params.variantId,
    entities: params.entities,
  });

  for (const binding of slotBindings) {
    if (binding.entity) {
      protectedIds.add(binding.entity.id);
    }
  }

  const family = getBuilderTemplateFamily(params.familyId);
  const variant = getBuilderTemplateVariant(params.familyId, params.variantId);
  const protectedTypes = new Set([
    ...(family?.protectedEntityTypes ?? []),
    ...(variant?.protectedEntityTypes ?? []),
  ]);

  if (protectedTypes.size > 0) {
    for (const entity of params.entities.values()) {
      if (protectedTypes.has(entity.type)) {
        protectedIds.add(entity.id);
      }
    }
  }

  return protectedIds;
}
