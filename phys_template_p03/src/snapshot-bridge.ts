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
  loadSnapshot: (snapshot: unknown) => P03SnapshotValidation;
  validateSnapshot: (snapshot: unknown) => P03SnapshotValidation;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

  return {
    getDefaultSnapshot: () => createSnapshot(getDefaultPayload()),
    getSnapshot: () => createSnapshot(getCurrentPayload()),
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
  const postToSource = (event: MessageEvent, response: unknown): void => {
    event.source?.postMessage(response, { targetOrigin: '*' });
  };

  const handler = (event: MessageEvent): void => {
    const message = event.data;
    if (!isPlainObject(message) || typeof message.type !== 'string') return;

    const bridge = (window as any).__EDUMIND_TEMPLATE_BRIDGE__ as P03TemplateBridge | undefined;
    if (!bridge) {
      if (message.namespace === 'edumind.templateBridge') {
        postToSource(event, {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: message.requestId,
          success: false,
          error: 'bridge is not available',
        });
      } else if (message.type.startsWith('edumind:')) {
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: false,
          errors: ['bridge is not available'],
        });
      }
      return;
    }

    try {
      if (message.namespace === 'edumind.templateBridge') {
        if (message.type === 'getDefaultSnapshot') {
          postToSource(event, {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: message.requestId,
            success: true,
            payload: bridge.getDefaultSnapshot(),
          });
          return;
        }
        if (message.type === 'getSnapshot') {
          postToSource(event, {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: message.requestId,
            success: true,
            payload: bridge.getSnapshot(),
          });
          return;
        }
        if (message.type === 'validateSnapshot') {
          postToSource(event, {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: message.requestId,
            success: true,
            payload: bridge.validateSnapshot(message.payload),
          });
          return;
        }
        if (message.type === 'loadSnapshot') {
          const result = bridge.loadSnapshot(message.payload);
          if (!result.ok) {
            postToSource(event, {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: message.requestId,
              success: false,
              error: result.errors.join('; '),
            });
            return;
          }
          postToSource(event, {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: message.requestId,
            success: true,
          });
          return;
        }
      }

      if (!message.type.startsWith('edumind:')) return;

      if (message.type === 'edumind:getDefaultSnapshot') {
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: true,
          result: bridge.getDefaultSnapshot(),
        });
      }
      if (message.type === 'edumind:getSnapshot') {
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: true,
          result: bridge.getSnapshot(),
        });
      }
      if (message.type === 'edumind:validateSnapshot') {
        const result = bridge.validateSnapshot(message.snapshot);
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: result.ok,
          result,
          errors: result.errors,
        });
      }
      if (message.type === 'edumind:loadSnapshot') {
        const result = bridge.loadSnapshot(message.snapshot);
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: result.ok,
          result,
          errors: result.errors,
        });
      }
    } catch (error) {
      if (message.namespace === 'edumind.templateBridge') {
        postToSource(event, {
          namespace: 'edumind.templateBridge',
          type: 'response',
          requestId: message.requestId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } else if (message.type.startsWith('edumind:')) {
        postToSource(event, {
          type: 'edumind:bridgeResponse',
          requestId: message.requestId,
          ok: false,
          errors: [error instanceof Error ? error.message : 'unknown bridge error'],
        });
      }
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
