import { BUFFER_SYSTEMS } from '@/data/bufferSystems';
import { INDICATORS } from '@/data/indicators';
import { TITRATION_PRESETS, type TitrationType } from '@/data/titrationPresets';
import { useBufferStore, useComparisonStore, useTitrationStore, useUIStore } from '@/store';
import type { ActiveTab } from '@/store/uiStore';

type Operation = Record<string, unknown>;

export interface ApplyOperationsResult {
  ok: boolean;
  applied: string[];
  warnings: string[];
}

const VALID_TABS = new Set<ActiveTab>(['curve', 'comparison', 'buffer']);
const VALID_TITRATION_TYPES = new Set<TitrationType>(TITRATION_PRESETS.map((preset) => preset.type));
const VALID_INDICATOR_IDS = new Set(INDICATORS.map((indicator) => indicator.id));
const VALID_BUFFER_IDS = new Set(BUFFER_SYSTEMS.map((buffer) => buffer.id));

const TITRATION_PRESETS_BY_ID: Record<string, { tab: ActiveTab; type: TitrationType; indicators?: string[] }> = {
  'strong-acid-strong-base': { tab: 'curve', type: 'strongAcid_strongBase', indicators: ['phenolphthalein', 'methylOrange'] },
  'strong-base-strong-acid': { tab: 'curve', type: 'strongBase_strongAcid', indicators: ['phenolphthalein', 'methylOrange'] },
  'weak-acid-strong-base': { tab: 'curve', type: 'strongBase_weakAcid', indicators: ['phenolphthalein'] },
  'weak-base-strong-acid': { tab: 'curve', type: 'strongAcid_weakBase', indicators: ['methylOrange'] },
  'indicator-choice': { tab: 'curve', type: 'strongBase_weakAcid', indicators: ['phenolphthalein', 'methylOrange', 'methylRed'] },
  'titration-comparison': { tab: 'comparison', type: 'strongAcid_strongBase' },
  'buffer-acetate': { tab: 'buffer', type: 'strongBase_weakAcid' },
  'buffer-ammonia': { tab: 'buffer', type: 'strongAcid_weakBase' },
  'blood-buffer': { tab: 'buffer', type: 'strongAcid_strongBase' },
};

const SCENARIOS: Record<string, Operation[]> = {
  'strong-acid-base-equivalence': [
    { type: 'loadTitrationPreset', presetId: 'strong-acid-strong-base' },
  ],
  'weak-acid-strong-base': [
    { type: 'loadTitrationPreset', presetId: 'weak-acid-strong-base' },
  ],
  'weak-base-strong-acid': [
    { type: 'loadTitrationPreset', presetId: 'weak-base-strong-acid' },
  ],
  'indicator-selection': [
    { type: 'loadTitrationPreset', presetId: 'indicator-choice' },
  ],
  'curve-comparison': [
    { type: 'setActiveTab', tab: 'comparison' },
    { type: 'setComparisonTypes', types: ['strongAcid_strongBase', 'strongBase_weakAcid', 'strongAcid_weakBase'] },
  ],
  'buffer-capacity-acid': [
    { type: 'setActiveTab', tab: 'buffer' },
    { type: 'setBufferSystem', bufferId: 'acetate' },
    { type: 'setBufferAddition', addType: 'acid', addedAmount: 0.001 },
  ],
  'buffer-capacity-base': [
    { type: 'setActiveTab', tab: 'buffer' },
    { type: 'setBufferSystem', bufferId: 'ammonia' },
    { type: 'setBufferAddition', addType: 'base', addedAmount: 0.001 },
  ],
  'blood-buffer': [
    { type: 'setActiveTab', tab: 'buffer' },
    { type: 'setBufferSystem', bufferId: 'blood' },
  ],
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && value > 0 ? value : fallback;
}

function warnIfInvalidPositive(value: number | undefined, label: string, warnings: string[]): void {
  if (value !== undefined && value <= 0) warnings.push(`${label} 必须为正数，已保留当前值。`);
}

function warnIfInvalidNonNegative(value: number | undefined, label: string, warnings: string[]): void {
  if (value !== undefined && value < 0) warnings.push(`${label} 不能为负数，已保留当前值。`);
}

function resolveTitrationType(op: Operation): TitrationType | null {
  const raw = asString(op.titrationTypeId) ?? asString(op.typeId) ?? asString(op.titrationType) ?? asString(op.type);
  if (raw && VALID_TITRATION_TYPES.has(raw as TitrationType)) return raw as TitrationType;
  const text = [asString(op.label), asString(op.name), asString(op.instruction)].filter(Boolean).join(' ');
  const preset = TITRATION_PRESETS.find((item) => text.includes(item.label));
  return preset?.type ?? null;
}

function resolveBufferId(op: Operation): string | null {
  const raw = asString(op.bufferId) ?? asString(op.id) ?? asString(op.name);
  if (raw && VALID_BUFFER_IDS.has(raw)) return raw;
  const text = [asString(op.name), asString(op.components), asString(op.formula)].filter(Boolean).join(' ');
  const buffer = BUFFER_SYSTEMS.find((item) => text.includes(item.name) || item.components.some((component) => text.includes(component)));
  return buffer?.id ?? null;
}

function setSelectedIndicators(ids: string[], warnings: string[]): void {
  const validIds = ids.filter((id) => VALID_INDICATOR_IDS.has(id));
  if (validIds.length !== ids.length) warnings.push('部分指示剂 id 不存在，已忽略。');
  useTitrationStore.getState().loadSnapshot({
    ...useTitrationStore.getState().getSnapshot(),
    selectedIndicatorIds: validIds,
  });
}

function setComparisonTypes(types: string[], warnings: string[]): void {
  const validTypes = types.filter((type): type is TitrationType => VALID_TITRATION_TYPES.has(type as TitrationType));
  if (validTypes.length !== types.length) warnings.push('部分滴定类型不存在，已忽略。');
  if (validTypes.length === 0) {
    warnings.push('setComparisonTypes 至少需要一个有效滴定类型。');
    return;
  }
  useComparisonStore.getState().loadSnapshot({ selectedTypes: validTypes });
}

function applyPreset(presetId: string, warnings: string[]): boolean {
  const preset = TITRATION_PRESETS_BY_ID[presetId];
  if (!preset) {
    warnings.push(`未知滴定预设：${presetId}`);
    return false;
  }
  useUIStore.getState().setActiveTab(preset.tab);
  useTitrationStore.getState().setTitrationType(preset.type);
  if (preset.indicators) setSelectedIndicators(preset.indicators, warnings);
  if (presetId === 'titration-comparison') {
    setComparisonTypes(['strongAcid_strongBase', 'strongBase_weakAcid'], warnings);
  }
  if (presetId === 'buffer-acetate') useBufferStore.getState().setSelectedBuffer('acetate');
  if (presetId === 'buffer-ammonia') useBufferStore.getState().setSelectedBuffer('ammonia');
  if (presetId === 'blood-buffer') useBufferStore.getState().setSelectedBuffer('blood');
  return true;
}

function applyOne(op: Operation, applied: string[], warnings: string[]): void {
  const type = asString(op.type);
  if (!type) {
    warnings.push('operation 缺少 type。');
    return;
  }

  switch (type) {
    case 'setActiveTab': {
      const tab = asString(op.tab) ?? asString(op.activeTab);
      if (!tab || !VALID_TABS.has(tab as ActiveTab)) {
        warnings.push('setActiveTab 需要 tab 为 curve、comparison 或 buffer。');
        return;
      }
      useUIStore.getState().setActiveTab(tab as ActiveTab);
      applied.push(type);
      return;
    }

    case 'setTitrationType': {
      const titrationType = resolveTitrationType(op);
      if (!titrationType) {
        warnings.push('setTitrationType 无法识别滴定类型。');
        return;
      }
      useUIStore.getState().setActiveTab('curve');
      useTitrationStore.getState().setTitrationType(titrationType);
      applied.push(type);
      return;
    }

    case 'setTitrationParameters': {
      const store = useTitrationStore.getState();
      const snapshot = store.getSnapshot();
      const titrantConc = asNumber(op.titrantConc) ?? asNumber(op.titrantConcentration);
      const analyteConc = asNumber(op.analyteConc) ?? asNumber(op.analyteConcentration);
      const analyteVol = asNumber(op.analyteVol) ?? asNumber(op.analyteVolume);
      warnIfInvalidPositive(titrantConc, '滴定剂浓度', warnings);
      warnIfInvalidPositive(analyteConc, '被测液浓度', warnings);
      warnIfInvalidPositive(analyteVol, '被测液体积', warnings);
      store.loadSnapshot({
        ...snapshot,
        titrantConc: positive(titrantConc, snapshot.titrantConc),
        analyteConc: positive(analyteConc, snapshot.analyteConc),
        analyteVol: positive(analyteVol, snapshot.analyteVol),
      });
      useUIStore.getState().setActiveTab('curve');
      applied.push(type);
      return;
    }

    case 'setIndicators': {
      const ids = asStringArray(op.indicatorIds) ?? asStringArray(op.ids);
      if (!ids) {
        warnings.push('setIndicators 需要 indicatorIds。');
        return;
      }
      setSelectedIndicators(ids, warnings);
      useUIStore.getState().setActiveTab('curve');
      applied.push(type);
      return;
    }

    case 'setComparisonTypes': {
      const types = asStringArray(op.types) ?? asStringArray(op.titrationTypes);
      if (!types) {
        warnings.push('setComparisonTypes 需要 types。');
        return;
      }
      setComparisonTypes(types, warnings);
      useUIStore.getState().setActiveTab('comparison');
      applied.push(type);
      return;
    }

    case 'setBufferSystem': {
      const bufferId = resolveBufferId(op);
      if (!bufferId) {
        warnings.push('setBufferSystem 无法识别缓冲体系。');
        return;
      }
      useBufferStore.getState().setSelectedBuffer(bufferId);
      useUIStore.getState().setActiveTab('buffer');
      applied.push(type);
      return;
    }

    case 'setBufferAddition': {
      const store = useBufferStore.getState();
      const snapshot = store.getSnapshot();
      const addType = asString(op.addType) ?? asString(op.typeValue);
      const addedAmount = asNumber(op.addedAmount) ?? asNumber(op.amount);
      const bufferConc = asNumber(op.bufferConc) ?? asNumber(op.concentration);
      const bufferVol = asNumber(op.bufferVol) ?? asNumber(op.volume);
      warnIfInvalidNonNegative(addedAmount, '加入物质的量', warnings);
      warnIfInvalidPositive(bufferConc, '缓冲液浓度', warnings);
      warnIfInvalidPositive(bufferVol, '缓冲液体积', warnings);
      store.loadSnapshot({
        ...snapshot,
        addType: addType === 'base' ? 'base' : addType === 'acid' ? 'acid' : snapshot.addType,
        addedAmount: addedAmount !== undefined && addedAmount > 0 ? addedAmount : snapshot.addedAmount,
        bufferConc: positive(bufferConc, snapshot.bufferConc),
        bufferVol: positive(bufferVol, snapshot.bufferVol),
      });
      if (addedAmount === 0) useBufferStore.getState().setAddedAmount(0);
      useUIStore.getState().setActiveTab('buffer');
      applied.push(type);
      return;
    }

    case 'setBufferDisplayMode': {
      const mode = asString(op.displayMode) ?? asString(op.mode);
      if (mode !== 'delta' && mode !== 'absolute') {
        warnings.push('setBufferDisplayMode 需要 displayMode 为 delta 或 absolute。');
        return;
      }
      useBufferStore.getState().setDisplayMode(mode);
      useUIStore.getState().setActiveTab('buffer');
      applied.push(type);
      return;
    }

    case 'loadTitrationPreset': {
      const presetId = asString(op.presetId) ?? asString(op.id);
      if (!presetId) {
        warnings.push('loadTitrationPreset 需要 presetId。');
        return;
      }
      if (applyPreset(presetId, warnings)) applied.push(type);
      return;
    }

    case 'loadTeachingScenario': {
      const scenarioId = asString(op.scenarioId) ?? asString(op.presetId);
      if (!scenarioId) {
        warnings.push('loadTeachingScenario 需要 scenarioId。');
        return;
      }
      const operations = SCENARIOS[scenarioId];
      if (!operations) {
        warnings.push(`未知教学场景：${scenarioId}`);
        return;
      }
      for (const item of operations) applyOne(item, applied, warnings);
      applied.push(type);
      return;
    }

    default:
      warnings.push(`不支持的 operation：${type}`);
  }
}

export function applyChem08Operations(input: unknown): ApplyOperationsResult {
  const operations = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { operations?: unknown }).operations)
      ? (input as { operations: unknown[] }).operations
      : null;

  const applied: string[] = [];
  const warnings: string[] = [];
  if (!operations) return { ok: false, applied, warnings: ['operations 必须是数组。'] };

  for (const op of operations) {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      warnings.push('operation 必须是对象。');
      continue;
    }
    applyOne(op as Operation, applied, warnings);
  }

  return { ok: warnings.length === 0, applied, warnings };
}
