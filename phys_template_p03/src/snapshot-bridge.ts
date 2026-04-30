const P03_TEMPLATE_KEY = 'p03' as const;
const P03_RUNTIME_KEY = 'phys-template-p03' as const;
const P03_BRIDGE_VERSION = '1.0.0' as const;
const P03_SNAPSHOT_SCHEMA_VERSION = 1 as const;

const MODULE_IDS = ['refraction', 'lens', 'doubleslit', 'diffraction', 'thinfilm'] as const;
const THEME_NAMES = ['light', 'dark', 'blueprint'] as const;

type P03ModuleId = typeof MODULE_IDS[number];
type P03ThemeName = typeof THEME_NAMES[number];

interface P03PresentationSnapshot {
  theme: P03ThemeName;
  rayThick: number;
}

interface P03ModulesSnapshot {
  refraction: Record<string, unknown>;
  lens: Record<string, unknown>;
  doubleslit: Record<string, unknown>;
  diffraction: Record<string, unknown>;
  thinfilm: Record<string, unknown>;
}

export interface P03SnapshotPayload {
  activeModule: P03ModuleId;
  presentation: P03PresentationSnapshot;
  modules: P03ModulesSnapshot;
}

export interface P03Snapshot {
  envelope: {
    templateKey: typeof P03_TEMPLATE_KEY;
    runtimeKey: typeof P03_RUNTIME_KEY;
    bridgeVersion: typeof P03_BRIDGE_VERSION;
    snapshotSchemaVersion: typeof P03_SNAPSHOT_SCHEMA_VERSION;
    createdAt: string;
    updatedAt: string;
  };
  payload: P03SnapshotPayload;
}

export interface P03SnapshotValidation {
  ok: boolean;
  errors: string[];
}

export interface P03BridgeOperationResult {
  ok: boolean;
  applied: number;
  errors: string[];
  warnings: string[];
  snapshot?: P03Snapshot;
}

interface P03BridgeState {
  active: P03ModuleId;
  theme: P03ThemeName;
  rayThick: number;
  refr: Record<string, unknown>;
  lens: Record<string, unknown>;
  dbl: Record<string, unknown>;
  diff: Record<string, unknown>;
  film: Record<string, unknown>;
}

interface P03BridgeConfig {
  defaults: P03ModulesSnapshot;
  getState: () => P03BridgeState;
  setPayload: (payload: P03SnapshotPayload) => void;
}

export interface P03TemplateBridge {
  getDefaultSnapshot: () => P03Snapshot;
  getSnapshot: () => P03Snapshot;
  getAiContext: () => Record<string, unknown>;
  applyOperations: (operations: unknown) => P03BridgeOperationResult;
  loadSnapshot: (snapshot: unknown) => P03SnapshotValidation;
  validateSnapshot: (snapshot: unknown) => P03SnapshotValidation;
}

type P03Operation = Record<string, unknown> & { type?: string; payload?: unknown };

interface P03ExperimentMeta {
  id: string;
  moduleId: P03ModuleId;
  title: string;
  summary?: string;
  category?: string;
  params?: Array<{
    key: string;
    label?: string;
    defaultValue?: unknown;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }>;
  defaults?: Record<string, unknown>;
  visualConfig?: Record<string, unknown>;
}

interface P03ScenarioPreset {
  experimentId: string;
  params?: Record<string, unknown>;
}

const SCENARIO_PRESETS: Record<string, P03ScenarioPreset> = {
  'parallel-interface-refraction': { experimentId: 'opt-001' },
  'snell-law': { experimentId: 'opt-001' },
  'total-internal-reflection': {
    experimentId: 'opt-001',
    params: { medium1N: 1.5, medium2N: 1, theta1Deg: 50, showAngles: true, showNormals: true },
  },
  'glass-slab-offset': { experimentId: 'opt-002' },
  'hemisphere-critical-angle': {
    experimentId: 'opt-003',
    params: { theta1Deg: 42, hemisphereMode: 'plane', showAngles: true, showNormals: true },
  },
  'fiber-total-reflection': { experimentId: 'opt-004' },
  'apparent-depth': {
    experimentId: 'opt-005',
    params: { apparentMode: 'depth', apparentObjectDepthCm: 5, apparentWaterN: 1.333 },
  },
  'apparent-height': {
    experimentId: 'opt-005',
    params: { apparentMode: 'height', apparentObjectDepthCm: 5, apparentWaterN: 1.333 },
  },
  'snell-window': { experimentId: 'opt-006' },
  'convex-lens-real-image': {
    experimentId: 'opt-011',
    params: { lensType: 'convex', focalLength: 10, objectDistance: 25, showScreen: true },
  },
  'convex-lens-magnifier': {
    experimentId: 'opt-011',
    params: { lensType: 'convex', focalLength: 10, objectDistance: 6, showScreen: false },
  },
  'concave-lens-virtual-image': { experimentId: 'opt-012' },
  'young-double-slit': { experimentId: 'opt-021' },
  'white-light-double-slit': { experimentId: 'opt-021', params: { whiteLight: true, showColor: true } },
  'single-slit-diffraction': { experimentId: 'opt-031' },
  'circular-aperture-airy': { experimentId: 'opt-032' },
  'soap-film-colors': { experimentId: 'opt-041' },
  'wedge-film-fringes': { experimentId: 'opt-042' },
  'newton-rings': { experimentId: 'opt-043' },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
}

function getWindowData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return ((window as any)[key] ?? fallback) as T;
}

function getExperimentLibrary(): Record<P03ModuleId, P03ExperimentMeta[]> {
  return getWindowData('P03_EXPERIMENTS', {
    refraction: [],
    lens: [],
    doubleslit: [],
    diffraction: [],
    thinfilm: [],
  }) as Record<P03ModuleId, P03ExperimentMeta[]>;
}

function getModuleLibrary(): Array<Record<string, unknown>> {
  return getWindowData('P03_MODULES', []).map((item: Record<string, unknown>) => ({
    id: item.id,
    num: item.num,
    short: item.short,
    full: item.full,
    desc: item.desc,
  }));
}

function findExperiment(experimentId: string): P03ExperimentMeta | undefined {
  const library = getExperimentLibrary();
  for (const moduleId of MODULE_IDS) {
    const experiment = library[moduleId].find((item) => item.id === experimentId);
    if (experiment) return experiment;
  }
  return undefined;
}

function findParamSpec(experiment: P03ExperimentMeta | undefined, key: string) {
  return experiment?.params?.find((item) => item.key === key);
}

function mergeExperimentSettings(
  base: Record<string, unknown>,
  experiment: P03ExperimentMeta,
  params?: Record<string, unknown>,
): Record<string, unknown> {
  const next = {
    ...base,
    ...(experiment.defaults || {}),
    ...(experiment.visualConfig || {}),
    ...(params || {}),
    experimentId: experiment.id,
  };
  if (experiment.moduleId !== 'refraction') return next;
  return normalizeRefractionAngles(next);
}

function normalizeIncidentAngleToSourceAngle(thetaDeg: number): number {
  return clamp(90 - thetaDeg, -85, 175);
}

function normalizeRefractionAngles(settings: Record<string, unknown>): Record<string, unknown> {
  const next = { ...settings };
  const theta1Deg = asNumber(next.theta1Deg) ?? asNumber(next.incidentAngleDeg) ?? asNumber(next.angleDeg);
  if (theta1Deg === undefined) return next;

  if (next.shape === 'snellwindow') {
    next.snellIncidentAngleDeg = clamp(theta1Deg, 5, 85);
  } else if (next.shape === 'apparent') {
    next.apparentRayAngleDeg = clamp(theta1Deg, 2, 80);
  } else {
    next.sourceAngleDeg = normalizeIncidentAngleToSourceAngle(theta1Deg);
  }
  delete next.theta1Deg;
  delete next.incidentAngleDeg;
  delete next.angleDeg;
  return next;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createEnvelope() {
  const stamp = nowIso();
  return {
    templateKey: P03_TEMPLATE_KEY,
    runtimeKey: P03_RUNTIME_KEY,
    bridgeVersion: P03_BRIDGE_VERSION,
    snapshotSchemaVersion: P03_SNAPSHOT_SCHEMA_VERSION,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function createSnapshot(payload: P03SnapshotPayload): P03Snapshot {
  return {
    envelope: createEnvelope(),
    payload: clone(payload),
  };
}

function coerceTheme(value: unknown): P03ThemeName {
  return THEME_NAMES.includes(value as P03ThemeName) ? value as P03ThemeName : 'light';
}

function coerceRayThick(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 2;
}

function withDefaults<T extends Record<string, unknown>>(defaults: T, value: unknown): T {
  return {
    ...clone(defaults),
    ...(isPlainObject(value) ? value : {}),
  } as T;
}

function normalizePayload(payload: P03SnapshotPayload, defaults: P03ModulesSnapshot): P03SnapshotPayload {
  return {
    activeModule: MODULE_IDS.includes(payload.activeModule) ? payload.activeModule : 'refraction',
    presentation: {
      theme: coerceTheme(payload.presentation?.theme),
      rayThick: coerceRayThick(payload.presentation?.rayThick),
    },
    modules: {
      refraction: withDefaults(defaults.refraction, payload.modules?.refraction),
      lens: withDefaults(defaults.lens, payload.modules?.lens),
      doubleslit: withDefaults(defaults.doubleslit, payload.modules?.doubleslit),
      diffraction: withDefaults(defaults.diffraction, payload.modules?.diffraction),
      thinfilm: withDefaults(defaults.thinfilm, payload.modules?.thinfilm),
    },
  };
}

function validateModuleSettings(moduleName: keyof P03ModulesSnapshot, value: unknown, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`payload.modules.${moduleName} must be an object`);
    return;
  }
  if (typeof value.experimentId !== 'string') {
    errors.push(`payload.modules.${moduleName}.experimentId must be a string`);
  }
}

export function validateP03Snapshot(snapshot: unknown): P03SnapshotValidation {
  const errors: string[] = [];

  if (!isPlainObject(snapshot)) {
    return { ok: false, errors: ['snapshot must be an object'] };
  }

  const envelope = snapshot.envelope;
  const payload = snapshot.payload;

  if (!isPlainObject(envelope)) {
    errors.push('envelope must be an object');
  } else {
    if (envelope.templateKey !== P03_TEMPLATE_KEY) errors.push('envelope.templateKey must be p03');
    if (envelope.runtimeKey !== P03_RUNTIME_KEY) errors.push('envelope.runtimeKey must be phys-template-p03');
    if (envelope.snapshotSchemaVersion !== P03_SNAPSHOT_SCHEMA_VERSION) {
      errors.push('envelope.snapshotSchemaVersion must be 1');
    }
  }

  if (!isPlainObject(payload)) {
    errors.push('payload must be an object');
    return { ok: false, errors };
  }

  if (!MODULE_IDS.includes(payload.activeModule as P03ModuleId)) {
    errors.push('payload.activeModule is invalid');
  }

  if (!isPlainObject(payload.presentation)) {
    errors.push('payload.presentation must be an object');
  } else {
    if (!THEME_NAMES.includes(payload.presentation.theme as P03ThemeName)) {
      errors.push('payload.presentation.theme is invalid');
    }
    if (typeof payload.presentation.rayThick !== 'number' || !Number.isFinite(payload.presentation.rayThick)) {
      errors.push('payload.presentation.rayThick must be a finite number');
    }
  }

  if (!isPlainObject(payload.modules)) {
    errors.push('payload.modules must be an object');
  } else {
    validateModuleSettings('refraction', payload.modules.refraction, errors);
    validateModuleSettings('lens', payload.modules.lens, errors);
    validateModuleSettings('doubleslit', payload.modules.doubleslit, errors);
    validateModuleSettings('diffraction', payload.modules.diffraction, errors);
    validateModuleSettings('thinfilm', payload.modules.thinfilm, errors);
  }

  return { ok: errors.length === 0, errors };
}

export function createP03Bridge(config: P03BridgeConfig): P03TemplateBridge {
  const getDefaultPayload = (): P03SnapshotPayload => ({
    activeModule: 'refraction',
    presentation: {
      theme: 'light',
      rayThick: 2,
    },
    modules: clone(config.defaults),
  });

  const getCurrentPayload = (): P03SnapshotPayload => {
    const state = config.getState();
    return {
      activeModule: state.active,
      presentation: {
        theme: state.theme,
        rayThick: state.rayThick,
      },
      modules: {
        refraction: state.refr,
        lens: state.lens,
        doubleslit: state.dbl,
        diffraction: state.diff,
        thinfilm: state.film,
      },
    };
  };

  const getModuleSettings = (payload: P03SnapshotPayload, moduleId: P03ModuleId): Record<string, unknown> => {
    return payload.modules[moduleId];
  };

  const setModuleSettings = (
    payload: P03SnapshotPayload,
    moduleId: P03ModuleId,
    settings: Record<string, unknown>,
  ): void => {
    payload.modules[moduleId] = settings;
  };

  const buildAiContext = (): Record<string, unknown> => {
    const payload = getCurrentPayload();
    const activeSettings = getModuleSettings(payload, payload.activeModule);
    const activeExperimentId = asString(activeSettings.experimentId);
    return {
      templateKey: P03_TEMPLATE_KEY,
      runtimeKey: P03_RUNTIME_KEY,
      activeModule: payload.activeModule,
      presentation: payload.presentation,
      activeExperimentId,
      currentModuleSettings: clone(activeSettings),
      modules: getModuleLibrary(),
      experiments: clone(getExperimentLibrary()),
      teachingScenarios: Object.keys(SCENARIO_PRESETS),
      materialReferences: getWindowData('P03_REFRACTION_MATERIAL_REFERENCES', []),
      visibleSpectrum: getWindowData('P03_VISIBLE_SPECTRUM', []),
    };
  };

  const normalizeParams = (
    experiment: P03ExperimentMeta | undefined,
    current: Record<string, unknown>,
    params: Record<string, unknown>,
    warnings: string[],
  ): Record<string, unknown> => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (!(key in current) && !findParamSpec(experiment, key)) {
        warnings.push(`未知参数 ${key} 已忽略`);
        continue;
      }
      const spec = findParamSpec(experiment, key);
      if (typeof value === 'number') {
        const normalizedKey = key === 'theta1Deg' || key === 'incidentAngleDeg' || key === 'angleDeg'
          ? 'sourceAngleDeg'
          : key;
        const normalizedValue = normalizedKey === 'sourceAngleDeg'
          ? normalizeIncidentAngleToSourceAngle(value)
          : clamp(value, spec?.min, spec?.max);
        next[normalizedKey] = normalizedValue;
        if (normalizedKey === 'sourceAngleDeg') {
          warnings.push('P03 折射模块已将入射角换算为光源方向角 sourceAngleDeg');
        } else if (normalizedValue !== value) {
          warnings.push(`${key} 已限制到允许范围`);
        }
        continue;
      }
      if (typeof value === 'string' || typeof value === 'boolean') {
        next[key] = value;
        continue;
      }
      warnings.push(`参数 ${key} 的值类型不支持，已忽略`);
    }
    return next;
  };

  const applySingleOperation = (
    payload: P03SnapshotPayload,
    operation: P03Operation,
    warnings: string[],
    errors: string[],
  ): boolean => {
    const body = { ...asObject(operation.payload), ...operation };
    delete body.payload;
    const type = asString(operation.type);

    if (!type) {
      errors.push('operation.type is required');
      return false;
    }

    if (type === 'setActiveModule') {
      const moduleId = asString(body.moduleId || body.activeModule || body.id);
      if (!MODULE_IDS.includes(moduleId as P03ModuleId)) {
        errors.push(`未知模块 ${moduleId || ''}`);
        return false;
      }
      payload.activeModule = moduleId as P03ModuleId;
      return true;
    }

    if (type === 'loadOpticsExperiment') {
      const experimentId = asString(body.experimentId || body.presetId || body.id);
      if (!experimentId) {
        errors.push('loadOpticsExperiment requires experimentId');
        return false;
      }
      const experiment = findExperiment(experimentId);
      if (!experiment) {
        errors.push(`未知光学实验 ${experimentId}`);
        return false;
      }
      const moduleId = experiment.moduleId;
      setModuleSettings(
        payload,
        moduleId,
        mergeExperimentSettings(getModuleSettings(payload, moduleId), experiment, asObject(body.params)),
      );
      payload.activeModule = moduleId;
      return true;
    }

    if (type === 'loadTeachingScenario') {
      const scenarioId = asString(body.scenarioId || body.presetId || body.id);
      if (!scenarioId) {
        errors.push('loadTeachingScenario requires scenarioId');
        return false;
      }
      const preset = SCENARIO_PRESETS[scenarioId];
      if (!preset) {
        errors.push(`未知教学场景 ${scenarioId}`);
        return false;
      }
      const experiment = findExperiment(preset.experimentId);
      if (!experiment) {
        errors.push(`教学场景 ${scenarioId} 引用的实验不存在`);
        return false;
      }
      const moduleId = experiment.moduleId;
      setModuleSettings(
        payload,
        moduleId,
        mergeExperimentSettings(getModuleSettings(payload, moduleId), experiment, preset.params),
      );
      payload.activeModule = moduleId;
      return true;
    }

    if (type === 'setModuleParams') {
      const moduleId = asString(body.moduleId || body.activeModule) as P03ModuleId | undefined;
      const targetModule = MODULE_IDS.includes(moduleId as P03ModuleId) ? moduleId as P03ModuleId : payload.activeModule;
      const current = getModuleSettings(payload, targetModule);
      const experimentId = asString(body.experimentId || current.experimentId);
      const experiment = experimentId ? findExperiment(experimentId) : undefined;
      const params = isPlainObject(body.params) ? body.params : body;
      const cleanParams = { ...params };
      delete cleanParams.type;
      delete cleanParams.moduleId;
      delete cleanParams.activeModule;
      delete cleanParams.experimentId;
      delete cleanParams.payload;
      const normalized = normalizeParams(experiment, current, cleanParams, warnings);
      if (Object.keys(normalized).length === 0) {
        warnings.push('没有可应用的参数');
        return false;
      }
      setModuleSettings(payload, targetModule, { ...current, ...normalized });
      payload.activeModule = targetModule;
      return true;
    }

    if (type === 'setRefractionMedia') {
      const current = payload.modules.refraction;
      const params: Record<string, unknown> = {};
      const medium1N = asNumber(body.medium1N || body.n1);
      const medium2N = asNumber(body.medium2N || body.n2);
      const theta1Deg = asNumber(body.theta1Deg || body.angleDeg || body.incidentAngleDeg);
      const material = asString(body.material);
      if (medium1N !== undefined) params.medium1N = medium1N;
      if (medium2N !== undefined) params.medium2N = medium2N;
      if (theta1Deg !== undefined) {
        if (current.shape === 'snellwindow') params.snellIncidentAngleDeg = theta1Deg;
        else if (current.shape === 'apparent') params.apparentRayAngleDeg = theta1Deg;
        else params.sourceAngleDeg = normalizeIncidentAngleToSourceAngle(theta1Deg);
      }
      if (material) params.material = material;
      const experiment = findExperiment(asString(current.experimentId) || 'opt-001');
      const normalized = normalizeParams(experiment, current, params, warnings);
      if (!Object.keys(normalized).length) return false;
      payload.modules.refraction = { ...current, ...normalized };
      payload.activeModule = 'refraction';
      return true;
    }

    if (type === 'setLensObject') {
      const current = payload.modules.lens;
      const params: Record<string, unknown> = {};
      for (const key of ['lensType', 'sourceType']) {
        const value = asString(body[key]);
        if (value) params[key] = value;
      }
      for (const key of ['focalLength', 'objectDistance', 'objectHeight']) {
        const value = asNumber(body[key]);
        if (value !== undefined) params[key] = value;
      }
      const experimentId = params.lensType === 'concave' ? 'opt-012' : asString(current.experimentId) || 'opt-011';
      const experiment = findExperiment(experimentId);
      const normalized = normalizeParams(experiment, current, params, warnings);
      if (!Object.keys(normalized).length) return false;
      payload.modules.lens = { ...current, ...normalized, experimentId };
      payload.activeModule = 'lens';
      return true;
    }

    if (type === 'setWaveParameters') {
      const moduleId = asString(body.moduleId || body.activeModule) as P03ModuleId | undefined;
      const targetModule = MODULE_IDS.includes(moduleId as P03ModuleId) ? moduleId as P03ModuleId : payload.activeModule;
      if (!['doubleslit', 'diffraction', 'thinfilm'].includes(targetModule)) {
        errors.push('setWaveParameters 只适用于双缝、衍射或薄膜干涉模块');
        return false;
      }
      const current = getModuleSettings(payload, targetModule);
      const params: Record<string, unknown> = {};
      for (const key of ['wavelength', 'screenDistance', 'slitSpacing', 'slitWidth', 'diameter', 'thickness', 'filmN', 'wedgeAngle', 'lensR']) {
        const value = asNumber(body[key]);
        if (value !== undefined) params[key] = value;
      }
      const whiteLight = asBoolean(body.whiteLight);
      if (whiteLight !== undefined) params.whiteLight = whiteLight;
      const experiment = findExperiment(asString(current.experimentId) || '');
      const normalized = normalizeParams(experiment, current, params, warnings);
      if (!Object.keys(normalized).length) return false;
      setModuleSettings(payload, targetModule, { ...current, ...normalized });
      payload.activeModule = targetModule;
      return true;
    }

    if (type === 'setDisplayOptions') {
      const targetModuleValue = asString(body.moduleId || body.activeModule);
      const targetModule = MODULE_IDS.includes(targetModuleValue as P03ModuleId) ? targetModuleValue as P03ModuleId : payload.activeModule;
      const current = getModuleSettings(payload, targetModule);
      const params: Record<string, unknown> = {};
      for (const key of ['showAngles', 'showNormals', 'showFormula', 'showColor', 'showIntensity', 'showRays', 'showScreen', 'whiteLight', 'compareMode']) {
        const value = asBoolean(body[key]);
        if (value !== undefined) params[key] = value;
      }
      if (!Object.keys(params).length) {
        warnings.push('没有可应用的显示项');
        return false;
      }
      setModuleSettings(payload, targetModule, { ...current, ...params });
      payload.activeModule = targetModule;
      return true;
    }

    if (type === 'setPresentationOptions') {
      const theme = asString(body.theme);
      const rayThick = asNumber(body.rayThick || body.lineWidth);
      if (theme) payload.presentation.theme = coerceTheme(theme);
      if (rayThick !== undefined) payload.presentation.rayThick = clamp(rayThick, 1, 4);
      return true;
    }

    errors.push(`不支持的 operation: ${type}`);
    return false;
  };

  const applyBridgeOperations = (operationsInput: unknown): P03BridgeOperationResult => {
    const operationList = Array.isArray(operationsInput)
      ? operationsInput
      : isPlainObject(operationsInput) && Array.isArray(operationsInput.operations)
        ? operationsInput.operations
        : [];
    if (!operationList.length) {
      return { ok: false, applied: 0, errors: ['operations must be a non-empty array'], warnings: [] };
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const payload = normalizePayload(getCurrentPayload(), config.defaults);
    let applied = 0;

    for (const operation of operationList) {
      if (!isPlainObject(operation)) {
        errors.push('operation must be an object');
        continue;
      }
      if (applySingleOperation(payload, operation as P03Operation, warnings, errors)) {
        applied += 1;
      }
    }

    if (errors.length) {
      return { ok: false, applied, errors, warnings };
    }

    config.setPayload(normalizePayload(payload, config.defaults));
    return {
      ok: true,
      applied,
      errors: [],
      warnings,
      snapshot: createSnapshot(normalizePayload(payload, config.defaults)),
    };
  };

  return {
    getDefaultSnapshot: () => createSnapshot(getDefaultPayload()),
    getSnapshot: () => createSnapshot(getCurrentPayload()),
    getAiContext: buildAiContext,
    applyOperations: applyBridgeOperations,
    validateSnapshot: validateP03Snapshot,
    loadSnapshot: (snapshot: unknown) => {
      const validation = validateP03Snapshot(snapshot);
      if (!validation.ok) return validation;

      const payload = (snapshot as P03Snapshot).payload;
      config.setPayload(normalizePayload(payload, config.defaults));
      return { ok: true, errors: [] };
    },
  };
}

export function installP03BridgeMessageListener(): () => void {
  const handler = (event: MessageEvent): void => {
    const message = event.data;
    if (!isPlainObject(message) || typeof message.type !== 'string') return;

    const bridge = (window as any).__EDUMIND_TEMPLATE_BRIDGE__ as P03TemplateBridge | undefined;
    if (!bridge) {
      if (message.namespace === 'edumind.templateBridge') {
        event.source?.postMessage({
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: message.requestId,
          success: false,
          error: 'bridge is not available',
        }, { targetOrigin: '*' });
      } else if (message.type.startsWith('edumind:')) {
        event.source?.postMessage({
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: false,
          errors: ['bridge is not available'],
        }, { targetOrigin: '*' });
      }
      return;
    }

    let response: unknown | undefined;
    try {
      if (message.namespace === 'edumind.templateBridge') {
        switch (message.type) {
          case 'getDefaultSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: true,
              payload: bridge.getDefaultSnapshot(),
            };
            break;
          case 'getSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: true,
              payload: bridge.getSnapshot(),
            };
            break;
          case 'getAiContext':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: true,
              payload: bridge.getAiContext(),
            };
            break;
          case 'applyOperations':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: true,
              payload: bridge.applyOperations(message.payload),
            };
            break;
          case 'validateSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: true,
              payload: bridge.validateSnapshot(message.payload),
            };
            break;
          case 'loadSnapshot': {
            const result = bridge.loadSnapshot(message.payload);
            response = result.ok
              ? {
                  namespace: 'edumind.templateBridge',
                  type: 'response',
                  requestId: message.requestId,
                  success: true,
                  payload: result,
                }
              : {
                  namespace: 'edumind.templateBridge',
                  type: 'response',
                  requestId: message.requestId,
                  success: false,
                  error: result.errors.join('; '),
                };
            break;
          }
          default:
            return;
        }
      }

      if (!response && !message.type.startsWith('edumind:')) return;

      if (message.type === 'edumind:getDefaultSnapshot') {
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: true,
          result: bridge.getDefaultSnapshot(),
        };
      }
      if (message.type === 'edumind:getSnapshot') {
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: true,
          result: bridge.getSnapshot(),
        };
      }
      if (message.type === 'edumind:getAiContext') {
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: true,
          result: bridge.getAiContext(),
        };
      }
      if (message.type === 'edumind:applyOperations') {
        const result = bridge.applyOperations(message.operations || message.payload);
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: result.ok,
          result,
          errors: result.errors,
        };
      }
      if (message.type === 'edumind:validateSnapshot') {
        const result = bridge.validateSnapshot(message.snapshot);
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: result.ok,
          result,
          errors: result.errors,
        };
      }
      if (message.type === 'edumind:loadSnapshot') {
        const result = bridge.loadSnapshot(message.snapshot);
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: result.ok,
          result,
          errors: result.errors,
        };
      }
    } catch (error) {
      if (message.namespace === 'edumind.templateBridge') {
        response = {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: message.requestId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      } else if (message.type.startsWith('edumind:')) {
        response = {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: false,
          errors: [error instanceof Error ? error.message : 'unknown bridge error'],
        };
      }
    }

    if (response) {
      event.source?.postMessage(response, { targetOrigin: '*' });
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
