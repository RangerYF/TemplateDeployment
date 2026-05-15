import type { ParameterPanel } from '@physics/core';
import type { SimLoop } from '@physics/core';
import type {
  ThermoState, TemplateSnapshot, SnapshotPayload, SnapshotValidationResult, SceneName,
} from './types';
import {
  TEMPLATE_KEY, RUNTIME_KEY, BRIDGE_VERSION, SNAPSHOT_SCHEMA_VERSION, ENGINE_VERSION,
} from './types';
import { paramDefs } from './params';
import { sceneRegistry } from './scenes';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createEnvelope(createdAt?: string): TemplateSnapshot['envelope'] {
  const now = new Date().toISOString();
  return {
    templateKey: TEMPLATE_KEY,
    runtimeKey: RUNTIME_KEY,
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

function getDefaultParams(): Record<string, number | string | boolean> {
  const values: Record<string, number | string | boolean> = {};
  for (const def of paramDefs) values[def.key] = def.default;
  return values;
}

export function getDefaultSnapshot(): TemplateSnapshot {
  return {
    envelope: createEnvelope(),
    payload: {
      params: getDefaultParams(),
      sim: { t: 0, speed: 1, seed: 1, engineVersion: ENGINE_VERSION },
      results: {},
    },
  };
}

export function getSnapshot(
  panel: ParameterPanel,
  sim: SimLoop<ThermoState>,
  currentSeed: number,
  currentScene: SceneName,
): TemplateSnapshot {
  return {
    envelope: createEnvelope(),
    payload: {
      params: { ...panel.getValues(), scene: currentScene },
      sim: {
        t: sim.getTime(),
        speed: sim.getSpeed(),
        seed: currentSeed,
        engineVersion: ENGINE_VERSION,
      },
      results: {},
    },
  };
}

export function validateSnapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(snapshot)) return { ok: false, errors: ['snapshot must be an object'] };

  const envelope = snapshot.envelope;
  const payload = snapshot.payload;
  if (!isPlainObject(envelope)) errors.push('envelope must be an object');
  if (!isPlainObject(payload)) errors.push('payload must be an object');
  if (!isPlainObject(envelope) || !isPlainObject(payload)) return { ok: false, errors };

  if (envelope.templateKey !== TEMPLATE_KEY) errors.push(`envelope.templateKey must be ${TEMPLATE_KEY}`);
  if (typeof envelope.runtimeKey !== 'string') errors.push('envelope.runtimeKey must be a string');
  if (typeof envelope.bridgeVersion !== 'string') errors.push('envelope.bridgeVersion must be a string');
  if (envelope.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`envelope.snapshotSchemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}`);
  }

  if (!isPlainObject(payload.params)) {
    errors.push('payload.params must be an object');
  } else {
    for (const def of paramDefs) {
      const value = payload.params[def.key];
      if (value === undefined) continue;
      if (def.type === 'select') {
        if (typeof value !== 'string' || !def.options?.includes(value)) {
          errors.push(`payload.params.${def.key} is invalid`);
        }
      } else if (def.type === 'checkbox') {
        if (typeof value !== 'boolean') errors.push(`payload.params.${def.key} must be boolean`);
      } else if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`payload.params.${def.key} must be number`);
      }
    }
  }

  if (!isPlainObject(payload.sim)) {
    errors.push('payload.sim must be an object');
  } else {
    if (typeof payload.sim.t !== 'number') errors.push('payload.sim.t must be number');
    if (typeof payload.sim.speed !== 'number') errors.push('payload.sim.speed must be number');
    if (payload.sim.state === undefined && typeof payload.sim.seed !== 'number') {
      errors.push('payload.sim.seed must be integer');
    }
  }

  if (!isPlainObject(payload.results)) errors.push('payload.results must be an object');

  return { ok: errors.length === 0, errors };
}

export function loadSnapshot(
  snapshot: unknown,
  panel: ParameterPanel,
  sim: SimLoop<ThermoState>,
  onSceneChange: (scene: SceneName) => void,
  setSeed: (seed: number) => void,
): SnapshotValidationResult {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return validation;

  const typed = snapshot as TemplateSnapshot;
  const { payload } = typed;
  const seed = typeof payload.sim.seed === 'number' ? payload.sim.seed >>> 0 : Date.now() >>> 0;
  setSeed(seed);

  const scene = (payload.params.scene as SceneName) || '气体分子微观模拟';
  for (const def of paramDefs) {
    const val = payload.params[def.key];
    if (val !== undefined) panel.setValue(def.key, val);
  }
  onSceneChange(scene);

  if (payload.sim.state) {
    sim.loadState(payload.sim.t, { ...payload.sim.state });
  } else {
    const sceneModule = sceneRegistry[scene];
    if (sceneModule) {
      const state = sceneModule.createInitialState(payload.params, seed);
      const stepFn = sceneModule.createStepFn(payload.params);
      const dt = 1 / 60;
      let t = 0;
      let s = state;
      const steps = Math.min(60 * 60 * 10, Math.round(payload.sim.t / dt));
      for (let i = 0; i < steps; i++) {
        s = stepFn(t, dt, s);
        t += dt;
      }
      sim.loadState(t, s);
    }
  }

  sim.setSpeed(payload.sim.speed);
  return { ok: true, errors: [] };
}

export function setupMessageHandler(
  panel: ParameterPanel,
  sim: SimLoop<ThermoState>,
  getCurrentScene: () => SceneName,
  getCurrentSeed: () => number,
  onSceneChange: (scene: SceneName) => void,
  setSeed: (seed: number) => void,
): void {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!isPlainObject(message) || message.source !== 'EDUMIND_HOST' || typeof message.requestId !== 'string') return;

    const respond = (payload: unknown, ok = true): void => {
      event.source?.postMessage({
        source: 'EDUMIND_TEMPLATE',
        requestId: message.requestId,
        type: `${String(message.type)}:response`,
        ok,
        payload,
      }, { targetOrigin: event.origin });
    };

    try {
      switch (message.type) {
        case 'getDefaultSnapshot':
          respond(getDefaultSnapshot());
          break;
        case 'getSnapshot':
          respond(getSnapshot(panel, sim, getCurrentSeed(), getCurrentScene()));
          break;
        case 'loadSnapshot': {
          const result = loadSnapshot(message.snapshot, panel, sim, onSceneChange, setSeed);
          respond(result, result.ok);
          break;
        }
        case 'validateSnapshot':
          respond(validateSnapshot(message.snapshot));
          break;
        default:
          respond({ errors: [`Unsupported bridge message type: ${String(message.type)}`] }, false);
      }
    } catch (error) {
      respond({ errors: [error instanceof Error ? error.message : String(error)] }, false);
    }
  });
}
