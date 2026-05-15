import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, PlaybackControls,
  SimLoop, CanvasManager, SyncedGraph,
} from '@physics/core';
import type { GraphTrace } from '@physics/core';
import type { ThermoState, SceneName, RenderContext, LiveEntry } from './types';
import { paramDefs, sceneParamMap, sceneNames, isTiltedLiquidColumn, clamp } from './params';
import { sceneRegistry } from './scenes';
import { getPistonDragInfo } from './scenes/gasParticles';
import { sceneConfigs } from './sceneConfig';
import { TeachingPanel } from './teachingPanel';
import { ModelPanel } from './modelPanel';
import {
  getDefaultSnapshot, getSnapshot, validateSnapshot, loadSnapshot, setupMessageHandler,
} from './bridge';

const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-07 热力学模拟器');

// --- State ---
let currentScene: SceneName = '气体分子微观模拟';
let currentSeed = Date.now() >>> 0;

// --- Top tab bar ---
const sceneTabs: HTMLButtonElement[] = [];
for (const name of sceneNames) {
  const tab = document.createElement('button');
  tab.className = 'scene-tab';
  tab.textContent = sceneConfigs[name].tabLabel;
  tab.addEventListener('click', () => switchScene(name));
  layout.tabBar.appendChild(tab);
  sceneTabs.push(tab);
}

// --- Subtitle line ---
function updateSubtitle(): void {
  const config = sceneConfigs[currentScene];
  layout.subtitleLine.innerHTML = '';
  const idBadge = document.createElement('span');
  idBadge.className = 'title-model-id';
  idBadge.textContent = config.modelId;
  const desc = document.createElement('span');
  desc.className = 'title-scene-description';
  desc.textContent = config.description;
  layout.subtitleLine.appendChild(idBadge);
  layout.subtitleLine.appendChild(desc);
}

// --- Left sidebar: model panel (top) + parameter panel (below) ---
const modelPanel = new ModelPanel(layout.leftSidebar);

const paramSection = document.createElement('div');
paramSection.className = 'sidebar-section';
const paramHeader = document.createElement('div');
paramHeader.className = 'sidebar-section-title';
paramHeader.innerHTML = '参数调节 <span class="en-label">PARAMS</span>';
paramSection.appendChild(paramHeader);
layout.leftSidebar.appendChild(paramSection);

const panel = new ParameterPanel(paramSection, paramDefs);

// --- Right sidebar: teaching panel ---
const teachingPanel = new TeachingPanel(layout.rightSidebar);

// --- Canvas + Graph ---
const cm = new CanvasManager({ container: layout.canvas });

const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer,
  title: '分子速率分布：温度越高，曲线越向右展宽',
  xLabel: '速率 v',
  yLabel: '概率密度 f(v)',
  height: 220,
});

// --- Playback controls ---
const controls = new PlaybackControls(layout.controlBar);

// --- Tab highlight ---
function updateSceneTabs(): void {
  sceneTabs.forEach((tab, i) => {
    tab.classList.toggle('active', sceneNames[i] === currentScene);
  });
}

function sceneShowsPlaybackControls(scene: SceneName): boolean {
  return scene === '气体分子微观模拟' || scene === '布朗运动';
}

function sceneShouldAutoPlay(scene: SceneName): boolean {
  return true;
}

function updatePlaybackVisibility(): void {
  const showControls = sceneShowsPlaybackControls(currentScene);
  layout.controlBar.classList.toggle('hidden', !showControls);
  if (!showControls) {
    controls.setPlaying(false);
  }
}

// --- Param visibility (scene-specific) ---
function updateParamVisibility(): void {
  const visibleKeys = new Set(sceneParamMap[currentScene] ?? []);
  const tubeOrientation = panel.getValue<string>('tubeOrientation');
  const showTiltAngle = currentScene === '液柱密封模型' && isTiltedLiquidColumn(tubeOrientation);
  const pcMode = panel.getValue<string>('pcMode');
  const showCylOrientation = currentScene === '气缸/双活塞模型' && pcMode === '单活塞';
  const isDual = pcMode === '双活塞';

  const rows = paramSection.querySelectorAll('.param-row');
  for (const row of rows) {
    const input = row.querySelector('[data-key]') as HTMLElement | null;
    if (!input) continue;
    const key = input.dataset.key!;
    let isVisible = visibleKeys.has(key);
    if (key === 'lcAngle') isVisible = isVisible && showTiltAngle;
    if (key === 'cylinderOrientation') isVisible = isVisible && showCylOrientation;
    if (key === 'pcPistonMass') isVisible = isVisible && !isDual;
    if (key === 'pcPistonMassLeft' || key === 'pcPistonMassRight' || key === 'pcHeatPosition') {
      isVisible = isVisible && isDual;
    }
    (row as HTMLElement).style.display = isVisible ? '' : 'none';
  }
}

// --- Model panel callbacks ---
modelPanel.onModelSelect = (variant) => {
  for (const [k, v] of Object.entries(variant.paramOverrides)) {
    panel.setValue(k, v);
  }
  const config = sceneConfigs[currentScene];
  const matchedModel = config.models.find(m => m.id === variant.id);
  if (matchedModel) {
    config.modelId = variant.id;
    updateSubtitle();
  }
  updateParamVisibility();
  previousParams = panel.getValues();
  resetSim();
  playIfSceneWantsMotion();
};

modelPanel.onPresetSelect = (preset) => {
  for (const [k, v] of Object.entries(preset.params)) {
    panel.setValue(k, v);
  }
  updateParamVisibility();
  previousParams = panel.getValues();
  resetSim();
  playIfSceneWantsMotion();
};

modelPanel.onToggleChange = (key, value) => {
  panel.setValue(key, value);
  previousParams = panel.getValues();
  renderScene(sim.getTime(), sim.getState());
};

// --- Render + Step ---
function createRenderContext(): RenderContext {
  return {
    cm,
    graph,
    canvasWidth: cm.getWidth(),
    canvasHeight: cm.getHeight(),
  };
}

function syncSurfaceSizes(showGraph: boolean): void {
  graphContainer.style.display = showGraph ? '' : 'none';
  layout.bottomPanel.classList.toggle('hidden', !showGraph);

  const canvasW = layout.canvas.clientWidth;
  const canvasH = layout.canvas.clientHeight;
  if (canvasW > 0 && canvasH > 0) {
    cm.resize(canvasW, canvasH);
  }
  if (showGraph) {
    const graphW = graphContainer.clientWidth || layout.bottomPanel.clientWidth;
    if (graphW > 0) graph.resize(graphW);
  }
}

function renderScene(t: number, state: ThermoState): void {
  const sceneModule = sceneRegistry[currentScene];
  if (!sceneModule) return;
  const params = panel.getValues();
  const traces: GraphTrace[] = sceneModule.getGraphTraces?.(params, state) ?? [];
  const showGraph = traces.length > 0;
  syncSurfaceSizes(showGraph);

  const rctx = createRenderContext();
  sceneModule.render(t, state, rctx, params);

  graph.setTraces(traces);
  graph.updateCurrentTime(t);
  if (showGraph) graph.render();

  // Update teaching live values
  const liveEntries: LiveEntry[] = [];
  const stateData = sceneModule.getStateDisplay?.(params, state);
  if (stateData) {
    if (stateData.p !== undefined) liveEntries.push({ label: '压强 p', value: `${stateData.p.toFixed(2)} ${stateData.pUnit ?? 'kPa'}` });
    if (stateData.V !== undefined) liveEntries.push({ label: '体积 V', value: `${stateData.V.toFixed(1)}${stateData.VUnit ? ` ${stateData.VUnit}` : ''}` });
    if (stateData.T !== undefined) liveEntries.push({ label: '温度 T', value: `${stateData.T.toFixed(0)} K` });
    if (stateData.invariant !== undefined) {
      const invariantValue = typeof stateData.invariant.value === 'number'
        ? stateData.invariant.value.toFixed(4)
        : stateData.invariant.value;
      liveEntries.push({
        label: stateData.invariant.label,
        value: invariantValue,
        highlight: stateData.invariant.highlight ?? true,
      });
    } else if (stateData.pvOverT !== undefined) {
      liveEntries.push({ label: 'pV/T 验证', value: stateData.pvOverT.toFixed(4), highlight: true });
    }
    if (stateData.customEntries) {
      for (const e of stateData.customEntries) {
        liveEntries.push(e);
      }
    }
  }
  teachingPanel.updateLiveValues(liveEntries);
  teachingPanel.updateCoreValues(params);

  // Update calc steps
  const calcSteps = sceneModule.getCalcSteps?.(params, state) ?? [];
  teachingPanel.updateCalcSteps(calcSteps);

  controls.updateTime(state.t);
}

function createStepFn() {
  const sceneModule = sceneRegistry[currentScene];
  if (!sceneModule) return (_t: number, dt: number, s: ThermoState) => ({ ...s, t: s.t + dt });
  return sceneModule.createStepFn(panel.getValues());
}

function createInitialState(): ThermoState {
  const sceneModule = sceneRegistry[currentScene];
  if (!sceneModule) return { t: 0 };
  return sceneModule.createInitialState(panel.getValues(), currentSeed);
}

function resetSim(): void {
  currentSeed = Date.now() >>> 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
}

function playIfSceneWantsMotion(): void {
  if (sceneShouldAutoPlay(currentScene)) {
    sim.play();
    controls.setPlaying(sceneShowsPlaybackControls(currentScene));
  } else {
    controls.setPlaying(false);
  }
}

function switchScene(scene: SceneName): void {
  if (scene === currentScene) return;
  currentScene = scene;
  const config = sceneConfigs[scene];

  updateSceneTabs();
  updateSubtitle();
  modelPanel.setScene(config);
  teachingPanel.setScene(config);
  updateParamVisibility();
  updatePlaybackVisibility();
  resetSim();
  previousParams = panel.getValues();
  playIfSceneWantsMotion();
}

// --- SimLoop ---
const sim = new SimLoop<ThermoState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: createInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => { resetSim(); controls.setPlaying(false); };
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

let suppressReset = false;
let previousParams = panel.getValues();

function rescaleGasParticleTemperature(prevT: number, nextT: number): void {
  if (prevT <= 0 || nextT <= 0) return;
  const state = sim.getState();
  const n = Number(state.nParticles) || 0;
  if (n <= 0) return;
  const factor = Math.sqrt(nextT / prevT);
  for (let i = 0; i < n; i++) {
    state[`vx${i}`] = (Number(state[`vx${i}`]) || 0) * factor;
    state[`vy${i}`] = (Number(state[`vy${i}`]) || 0) * factor;
  }
  sim.updateStepFn(createStepFn());
  sim.replaceState(state);
}

function isOnlyGasTemperatureChange(
  prev: Record<string, number | string | boolean>,
  next: Record<string, number | string | boolean>,
): boolean {
  if (currentScene !== '气体分子微观模拟') return false;
  const gasKeys = sceneParamMap['气体分子微观模拟'];
  return gasKeys.every(key => key === 'temperature' || prev[key] === next[key])
    && prev.temperature !== next.temperature;
}

function isOnlyGasDisplayChange(
  prev: Record<string, number | string | boolean>,
  next: Record<string, number | string | boolean>,
): boolean {
  if (currentScene !== '气体分子微观模拟') return false;
  const displayKeys = new Set(['showVelocity', 'showDistribution']);
  const gasKeys = sceneParamMap['气体分子微观模拟'];
  return gasKeys.every(key => displayKeys.has(key) || prev[key] === next[key])
    && gasKeys.some(key => displayKeys.has(key) && prev[key] !== next[key]);
}

panel.setOnChange((values) => {
  updateParamVisibility();
  if (!suppressReset) {
    if (isOnlyGasTemperatureChange(previousParams, values)) {
      rescaleGasParticleTemperature(Number(previousParams.temperature) || 300, Number(values.temperature) || 300);
    } else if (isOnlyGasDisplayChange(previousParams, values)) {
      renderScene(sim.getTime(), sim.getState());
    } else {
      resetSim();
      playIfSceneWantsMotion();
    }
  }
  previousParams = { ...values };
});

// --- Draggable piston for gas particles ---
let pistonDragging = false;
let resumeAfterPistonDrag = false;
cm.canvas.addEventListener('pointerdown', (e) => {
  if (currentScene !== '气体分子微观模拟') return;
  const info = getPistonDragInfo();
  if (!info) return;
  const rect = cm.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (Math.abs(mx - info.screenX) < 16 && my >= info.screenY && my <= info.screenY + info.screenH) {
    pistonDragging = true;
    resumeAfterPistonDrag = sim.isPlaying();
    if (resumeAfterPistonDrag) {
      sim.pause();
      controls.setPlaying(false);
    }
    cm.canvas.style.cursor = 'col-resize';
    cm.canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
});
cm.canvas.addEventListener('pointermove', (e) => {
  if (!pistonDragging) {
    if (currentScene === '气体分子微观模拟') {
      const info = getPistonDragInfo();
      if (info) {
        const rect = cm.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        if (Math.abs(mx - info.screenX) < 16 && my >= info.screenY && my <= info.screenY + info.screenH) {
          cm.canvas.style.cursor = 'col-resize';
        }
      }
    }
    return;
  }
  const info = getPistonDragInfo();
  if (!info) return;
  const rect = cm.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const newW = clamp((mx - info.ox) / info.scale, info.minW, info.maxW);
  const state = sim.getState();
  state.boxW = newW;
  const n = Number(state.nParticles) || 0;
  for (let i = 0; i < n; i++) {
    const px = Number(state[`px${i}`]) || 0;
    if (px > newW - 0.12) state[`px${i}`] = newW - 0.12;
  }
  suppressReset = true;
  panel.setValue('containerW', Math.round(newW * 25));
  suppressReset = false;
  previousParams = panel.getValues();
  sim.replaceState(state);
});
cm.canvas.addEventListener('pointerup', (e) => {
  if (pistonDragging) {
    pistonDragging = false;
    cm.canvas.releasePointerCapture?.(e.pointerId);
    cm.canvas.style.cursor = 'default';
    sim.updateStepFn(createStepFn());
    if (resumeAfterPistonDrag) {
      sim.play();
      controls.setPlaying(true);
    }
    resumeAfterPistonDrag = false;
  }
});
cm.canvas.addEventListener('pointercancel', (e) => {
  if (pistonDragging) {
    pistonDragging = false;
    cm.canvas.releasePointerCapture?.(e.pointerId);
    cm.canvas.style.cursor = 'default';
    sim.updateStepFn(createStepFn());
    if (resumeAfterPistonDrag) {
      sim.play();
      controls.setPlaying(true);
    }
    resumeAfterPistonDrag = false;
  }
});

// --- Bridge ---
window.__EDUMIND_TEMPLATE_BRIDGE__ = {
  getDefaultSnapshot,
  getSnapshot: () => getSnapshot(panel, sim, currentSeed, currentScene),
  loadSnapshot: (snapshot: unknown) => loadSnapshot(
    snapshot, panel, sim,
    (scene) => switchScene(scene),
    (seed) => { currentSeed = seed; },
  ),
  validateSnapshot,
};

setupMessageHandler(
  panel, sim,
  () => currentScene,
  () => currentSeed,
  (scene) => switchScene(scene),
  (seed) => { currentSeed = seed; },
);

// --- Init ---
const initConfig = sceneConfigs[currentScene];
updateSceneTabs();
updateSubtitle();
modelPanel.setScene(initConfig);
teachingPanel.setScene(initConfig);
updateParamVisibility();
updatePlaybackVisibility();

renderScene(0, createInitialState());

window.setTimeout(() => {
  if (!sceneShouldAutoPlay(currentScene)) return;
  sim.play();
  controls.setPlaying(sceneShowsPlaybackControls(currentScene));
}, 100);
