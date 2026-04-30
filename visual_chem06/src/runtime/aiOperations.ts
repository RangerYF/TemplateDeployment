import { ELECTROCHEM_MODELS } from '@/data/electrochemModels';
import { useElectrochemStore, type FamilyFilter, type SpeedOption } from '@/store/electrochemStore';

type Operation = {
  type?: string;
  [key: string]: unknown;
};

export interface ApplyOperationsResult {
  ok: boolean;
  applied: number;
  warnings: string[];
}

const FAMILY_FILTERS = new Set<FamilyFilter>(['all', 'galvanic', 'electrolytic']);
const SPEEDS = new Set<SpeedOption>([0.5, 1, 2]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s/g, '');
}

function findModelId(op: Record<string, unknown>): string | null {
  const id = asString(op.modelId) ?? asString(op.id);
  if (id) {
    const normalizedId = id.toLowerCase();
    const match = ELECTROCHEM_MODELS.find((model) => model.id.toLowerCase() === normalizedId);
    if (match) return match.id;
  }

  const name = asString(op.title) ?? asString(op.name) ?? asString(op.modelName);
  if (name) {
    const normalizedName = normalizeText(name);
    const matches = ELECTROCHEM_MODELS.filter((model) =>
      normalizeText(model.title) === normalizedName ||
      normalizeText(model.title).includes(normalizedName) ||
      normalizeText(model.subtype).includes(normalizedName) ||
      model.tags.some((tag) => normalizeText(tag).includes(normalizedName)),
    );
    if (matches.length === 1) return matches[0].id;
    return null;
  }

  const family = asString(op.family);
  const subtype = asString(op.subtype);
  if (family || subtype) {
    const matches = ELECTROCHEM_MODELS.filter((model) =>
      (!family || model.family === family) &&
      (!subtype || model.subtype.includes(subtype)),
    );
    if (matches.length === 1) return matches[0].id;
  }

  return null;
}

function findScenarioId(modelId: string, op: Record<string, unknown>): string | null {
  const model = ELECTROCHEM_MODELS.find((item) => item.id === modelId);
  if (!model) return null;
  const id = asString(op.scenarioId) ?? asString(op.id);
  if (id) {
    const normalizedId = id.toLowerCase();
    const match = model.scenarios.find((scenario) => scenario.id.toLowerCase() === normalizedId);
    if (match) return match.id;
  }
  const label = asString(op.label) ?? asString(op.name);
  if (label) {
    const normalizedLabel = normalizeText(label);
    const matches = model.scenarios.filter((scenario) =>
      normalizeText(scenario.label) === normalizedLabel ||
      normalizeText(scenario.label).includes(normalizedLabel),
    );
    if (matches.length === 1) return matches[0].id;
  }
  return null;
}

function findKeyframeProgress(op: Record<string, unknown>, warnings: string[]): number | null {
  const state = useElectrochemStore.getState();
  const model = ELECTROCHEM_MODELS.find((item) => item.id === state.selectedModelId);
  const scenario = model?.scenarios.find((item) => item.id === state.selectedScenarioId);
  if (!scenario) return null;

  const index = asNumber(op.index) ?? asNumber(op.keyframeIndex);
  if (index !== undefined) {
    if (Number.isInteger(index) && index >= 0 && index < scenario.keyframes.length) {
      return scenario.keyframes[index].at;
    }
    warnings.push(`关键帧索引 ${index} 不在当前场景范围内。`);
    return null;
  }

  const title = asString(op.title) ?? asString(op.keyframeTitle) ?? asString(op.name);
  if (title) {
    const normalizedTitle = normalizeText(title);
    const matches = scenario.keyframes.filter((keyframe) =>
      normalizeText(keyframe.title) === normalizedTitle ||
      normalizeText(keyframe.title).includes(normalizedTitle) ||
      normalizeText(keyframe.description).includes(normalizedTitle),
    );
    if (matches.length === 1) return matches[0].at;
    if (matches.length > 1) {
      warnings.push('匹配到多个关键帧，请使用 keyframeIndex 精确指定。');
      return null;
    }
  }

  const focus = asString(op.focus);
  if (focus) {
    const matches = scenario.keyframes.filter((keyframe) => keyframe.focus === focus);
    if (matches.length === 1) return matches[0].at;
    if (matches.length > 1) {
      warnings.push('当前场景中该 focus 匹配多个关键帧，请使用 title 或 keyframeIndex。');
      return null;
    }
  }

  return null;
}

function applyPreset(presetId: string, warnings: string[]) {
  const presets: Record<string, Operation[]> = {
    'zn-cu-single': [{ type: 'selectElectrochemModel', modelId: 'C06-G01' }],
    'zn-cu-salt-bridge': [{ type: 'selectElectrochemModel', modelId: 'C06-G02' }],
    'lead-acid-discharge': [
      { type: 'selectElectrochemModel', modelId: 'C06-G03' },
      { type: 'setScenario', scenarioId: 'discharge' },
    ],
    'lead-acid-charge': [
      { type: 'selectElectrochemModel', modelId: 'C06-G03' },
      { type: 'setScenario', scenarioId: 'charge' },
    ],
    'acid-fuel-cell': [{ type: 'selectElectrochemModel', modelId: 'C06-G04' }],
    'alkaline-fuel-cell': [{ type: 'selectElectrochemModel', modelId: 'C06-G05' }],
    'lithium-ion-discharge': [
      { type: 'selectElectrochemModel', modelId: 'C06-G06' },
      { type: 'setScenario', scenarioId: 'discharge' },
    ],
    'lithium-ion-charge': [
      { type: 'selectElectrochemModel', modelId: 'C06-G06' },
      { type: 'setScenario', scenarioId: 'charge' },
    ],
    'concentration-cell': [{ type: 'selectElectrochemModel', modelId: 'C06-G07' }],
    'water-electrolysis': [{ type: 'selectElectrochemModel', modelId: 'C06-E01' }],
    'brine-electrolysis': [{ type: 'selectElectrochemModel', modelId: 'C06-E02' }],
    'copper-refining': [{ type: 'selectElectrochemModel', modelId: 'C06-E03' }],
    'molten-nacl': [{ type: 'selectElectrochemModel', modelId: 'C06-E04' }],
    'alumina-electrolysis': [{ type: 'selectElectrochemModel', modelId: 'C06-E05' }],
    electroplating: [{ type: 'selectElectrochemModel', modelId: 'C06-E06' }],
  };

  const operations = presets[presetId];
  if (!operations) {
    warnings.push(`未知 C06 电化学预设: ${presetId}`);
    return 0;
  }
  return applyChem06Operations(operations).applied;
}

function applyTeachingScenario(scenarioId: string, warnings: string[]) {
  const scenarioToPreset: Record<string, string> = {
    'basic-galvanic-cell': 'zn-cu-single',
    'salt-bridge-migration': 'zn-cu-salt-bridge',
    'lead-acid-discharge': 'lead-acid-discharge',
    'lead-acid-charge': 'lead-acid-charge',
    'fuel-cell-acid-vs-alkaline': 'acid-fuel-cell',
    'lithium-ion-charge-discharge': 'lithium-ion-discharge',
    'concentration-cell-trend': 'concentration-cell',
    'water-electrolysis-ph': 'water-electrolysis',
    'chlor-alkali-process': 'brine-electrolysis',
    'copper-electrorefining': 'copper-refining',
    'molten-salt-electrolysis': 'molten-nacl',
    'aluminum-smelting': 'alumina-electrolysis',
    electroplating: 'electroplating',
  };
  const presetId = scenarioToPreset[scenarioId];
  if (!presetId) {
    warnings.push(`未知 C06 教学场景: ${scenarioId}`);
    return 0;
  }
  return applyPreset(presetId, warnings);
}

function applyOneOperation(operation: Operation, warnings: string[]): boolean {
  const op = asRecord(operation);
  const type = asString(op.type);
  const store = useElectrochemStore.getState();

  switch (type) {
    case 'selectElectrochemModel': {
      const modelId = findModelId(op);
      if (!modelId) {
        warnings.push('未找到唯一电化学模型，请提供有效 modelId、标题或类型。');
        return false;
      }
      store.selectModel(modelId);
      return true;
    }
    case 'setScenario': {
      const modelId = findModelId(op) ?? useElectrochemStore.getState().selectedModelId;
      if (modelId !== useElectrochemStore.getState().selectedModelId) {
        store.selectModel(modelId);
      }
      const scenarioId = findScenarioId(modelId, op);
      if (!scenarioId) {
        warnings.push('未找到当前模型下的有效场景，请提供 scenarioId 或场景 label。');
        return false;
      }
      useElectrochemStore.getState().setScenario(scenarioId);
      return true;
    }
    case 'setModelFilter': {
      const searchQuery = asString(op.searchQuery) ?? asString(op.query);
      const familyFilter = asString(op.familyFilter) ?? asString(op.family);
      if (searchQuery !== undefined) store.setSearchQuery(searchQuery);
      if (familyFilter !== undefined) {
        if (!FAMILY_FILTERS.has(familyFilter as FamilyFilter)) {
          warnings.push(`无效模型类型筛选: ${familyFilter}`);
          return searchQuery !== undefined;
        }
        store.setFamilyFilter(familyFilter as FamilyFilter);
      }
      if (searchQuery === undefined && familyFilter === undefined) {
        warnings.push('setModelFilter 需要 searchQuery/query 或 familyFilter/family。');
        return false;
      }
      return true;
    }
    case 'setPlayback': {
      const playing = asBoolean(op.playing);
      const speed = asNumber(op.speed);
      if (playing !== undefined) useElectrochemStore.setState({ playing });
      if (speed !== undefined) {
        if (!SPEEDS.has(speed as SpeedOption)) {
          warnings.push('播放速度仅支持 0.5、1、2。');
        } else {
          store.setSpeed(speed as SpeedOption);
        }
      }
      if (playing === undefined && speed === undefined) {
        warnings.push('setPlayback 需要 playing 或 speed。');
        return false;
      }
      return true;
    }
    case 'setProgress': {
      const progress = asNumber(op.progress) ?? asNumber(op.value);
      if (progress === undefined) {
        warnings.push('setProgress 需要 progress。');
        return false;
      }
      store.setProgress(progress);
      useElectrochemStore.setState({ playing: false });
      return true;
    }
    case 'stepForward':
      store.stepForward();
      return true;
    case 'setKeyframe': {
      const progress = findKeyframeProgress(op, warnings);
      if (progress === null) {
        warnings.push('未找到唯一关键帧，请提供 title、focus 或 keyframeIndex。');
        return false;
      }
      store.setProgress(progress);
      useElectrochemStore.setState({ playing: false });
      return true;
    }
    case 'resetAnimation':
      store.reset();
      return true;
    case 'setDisplayOptions': {
      const showIonLabels = asBoolean(op.showIonLabels);
      const ionLabelFontSize = asNumber(op.ionLabelFontSize);
      if (showIonLabels !== undefined) store.setShowIonLabels(showIonLabels);
      if (ionLabelFontSize !== undefined) store.setIonLabelFontSize(ionLabelFontSize);
      if (showIonLabels === undefined && ionLabelFontSize === undefined) {
        warnings.push('setDisplayOptions 需要 showIonLabels 或 ionLabelFontSize。');
        return false;
      }
      return true;
    }
    case 'loadElectrochemPreset': {
      const presetId = asString(op.presetId) ?? asString(op.id);
      if (!presetId) {
        warnings.push('loadElectrochemPreset 需要 presetId。');
        return false;
      }
      return applyPreset(presetId, warnings) > 0;
    }
    case 'loadTeachingScenario': {
      const scenarioId = asString(op.scenarioId) ?? asString(op.presetId);
      if (!scenarioId) {
        warnings.push('loadTeachingScenario 需要 scenarioId。');
        return false;
      }
      return applyTeachingScenario(scenarioId, warnings) > 0;
    }
    default:
      warnings.push(`未知 operation: ${type ?? 'undefined'}`);
      return false;
  }
}

export function applyChem06Operations(operations: unknown): ApplyOperationsResult {
  const warnings: string[] = [];
  if (!Array.isArray(operations)) {
    return { ok: false, applied: 0, warnings: ['operations 必须是数组。'] };
  }

  let applied = 0;
  for (const operation of operations) {
    if (applyOneOperation(operation as Operation, warnings)) applied += 1;
  }

  return {
    ok: warnings.length === 0,
    applied,
    warnings,
  };
}
