import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { ThermoState, SceneModule, StateDisplayData, CalcStep } from '../types';
import { clamp } from '../params';
import { PistonScene3D } from './three/PistonScene3D';
import { canvasBg, getTheme } from '../themeMode';
import { speedToColor } from '../theme';

const g = 9.8;

// ── Three.js overlay (lazy singleton) ───────────────────────────────────────
let scene3d: PistonScene3D | null = null;
function ensure3D(container: HTMLElement): PistonScene3D {
  if (!scene3d) scene3d = new PistonScene3D(container);
  return scene3d;
}

// ── World geometry constants ────────────────────────────────────────────────
const R = 1.6;        // cylinder radius (world units)
const HALF = 5;       // half cylinder length
const SPAN = 2 * HALF; // full length

// ── Physics ─────────────────────────────────────────────────────────────────
interface PCResult {
  P1: number; P2: number; L2: number; V1: number; V2: number;
  L2Left: number; L2Right: number;
}

function solvePC(
  mode: string, orientation: string,
  T1: number, T2: number, pistonMass: number,
  S: number, L1: number, P0: number,
  params: Record<string, number | string | boolean>,
): PCResult {
  if (mode === '中间活塞') {
    // Horizontal cylinder, closed both ends, ONE free middle piston coupling
    // two gas columns. Pressure balance (horizontal) → P_left = P_right = P.
    // Total length conserved: L_left + L_right = 2·L1.
    const heatPos = String(params.pcHeatPosition) || '左';
    const P1 = P0; // initial fill pressure (both gases start equal at L1)
    let L2Left: number, L2Right: number, P2: number;
    if (heatPos === '两侧') {
      P2 = P1 * T2 / T1;
      L2Left = L1;
      L2Right = L1;
    } else {
      // one side heated to T2, the other stays at T1
      P2 = P1 * (T1 + T2) / (2 * T1);
      const Lhot = 2 * L1 * T2 / (T1 + T2);
      const Lcold = 2 * L1 * T1 / (T1 + T2);
      if (heatPos === '左') { L2Left = Lhot; L2Right = Lcold; }
      else { L2Left = Lcold; L2Right = Lhot; }
    }
    const V1 = 2 * L1 * S;
    const V2 = (L2Left + L2Right) * S;
    return { P1, P2, L2: (L2Left + L2Right) / 2, V1, V2, L2Left, L2Right };
  }

  // Single piston
  let P1: number;
  if (orientation === '竖直') {
    const mgOverS = (pistonMass * g) / (S * 1e-4) / 1000; // kPa
    P1 = P0 + mgOverS;
  } else {
    P1 = P0;
  }
  const P2 = P1;                 // free piston → isobaric
  const L2 = L1 * T2 / T1;       // V/T const
  return { P1, P2, L2, V1: L1 * S, V2: L2 * S, L2Left: L2, L2Right: L2 };
}

// ── Temperature → color ──────────────────────────────────────────────────────
function tempColor(T: number): THREE.Color {
  const f = clamp((T - 250) / 350, 0, 1); // 250K→0, 600K→1
  return new THREE.Color().setHSL((1 - f) * 0.62, 0.7, 0.55); // blue→red
}

// ── 3D part references (rebuilt on layout change) ────────────────────────────
interface Parts {
  key: string;
  rig: THREE.Group;
  leftGas: THREE.Mesh;
  rightGas: THREE.Mesh | null;
  leftParticles: THREE.InstancedMesh;
  rightParticles: THREE.InstancedMesh | null;
  piston: THREE.Group;       // for single, the only piston; for middle, the middle piston
  leftLabel: CSS2DObject;
  rightLabel: CSS2DObject | null;
  heatGlow: THREE.PointLight;
}
let parts: Parts | null = null;

function labelCss(): string {
  // NOTE: must include position:absolute — CSS2DObject sets it on the element,
  // but we overwrite cssText on theme change, so it has to be re-declared here
  // (otherwise the div reverts to a full-width block).
  const base = 'position:absolute;user-select:none;padding:3px 9px;border-radius:9px;'
    + 'font:600 12px Inter,system-ui,sans-serif;white-space:nowrap;pointer-events:none;';
  return base + (getTheme() === 'dark'
    ? 'color:#e2e8f0;background:rgba(17,24,39,0.82);border:1px solid rgba(255,255,255,0.18);box-shadow:0 1px 4px rgba(0,0,0,0.45)'
    : 'color:#1a2740;background:rgba(255,255,255,0.86);border:1px solid rgba(80,110,150,0.30);box-shadow:0 1px 4px rgba(0,0,0,0.12)');
}

function makeLabelDiv(): HTMLDivElement {
  const d = document.createElement('div');
  d.style.cssText = labelCss();
  return d;
}

function makeMetalTube(): THREE.Mesh {
  // open glass-metal tube along Y
  return new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, SPAN, 56, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0x7f93ab, metalness: 0.6, roughness: 0.22,
      transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, envMapIntensity: 1,
    }),
  );
}

function makeCap(yPos: number): THREE.Mesh {
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.3, 56),
    new THREE.MeshStandardMaterial({ color: 0x55626f, metalness: 0.85, roughness: 0.3 }),
  );
  cap.position.y = yPos;
  return cap;
}

function makePiston(): THREE.Group {
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.06, R - 0.06, 0.5, 56),
    new THREE.MeshStandardMaterial({ color: 0xd8dee6, metalness: 0.95, roughness: 0.12 }),
  );
  grp.add(disc);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R - 0.06, 0.07, 12, 56),
    new THREE.MeshStandardMaterial({ color: 0x8a96a4, metalness: 0.9, roughness: 0.25 }),
  );
  rim.rotation.x = Math.PI / 2;
  grp.add(rim);
  return grp;
}

function makeGas(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.1, R - 0.1, 1, 48, 1, false),
    new THREE.MeshPhysicalMaterial({
      color: 0x42a5f5, transparent: true, opacity: 0.22,
      transmission: 0.4, roughness: 0.5, depthWrite: false,
    }),
  );
  return m;
}

// Bouncing gas molecules (InstancedMesh) — agitation ∝ temperature.
function makeParticles(count: number): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.13, 10, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x223046, emissiveIntensity: 0.35, roughness: 0.4 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const seeds = new Float32Array(count * 6);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const freq = 1.2 + Math.random() * 3;
    seeds[i * 6 + 0] = Math.random();            // along-axis base [0,1]
    seeds[i * 6 + 1] = (Math.random() - 0.5);    // radial x
    seeds[i * 6 + 2] = (Math.random() - 0.5);    // radial z
    seeds[i * 6 + 3] = freq;                     // freq
    seeds[i * 6 + 4] = Math.random() * 6.28;     // phase 1
    seeds[i * 6 + 5] = Math.random() * 6.28;     // phase 2
    // Cosmetic per-instance "speed" tint (faster agitation → warmer), matching
    // the 2D scenes' palette. Purely visual — no effect on motion/physics.
    col.set(speedToColor(clamp((freq - 1.2) / 3, 0, 1)));
    mesh.setColorAt(i, col);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.seeds = seeds;
  return mesh;
}

const _pm = new THREE.Matrix4();
function updateParticles(mesh: THREE.InstancedMesh, y0: number, y1: number, tempFrac: number, time: number): void {
  const seeds = mesh.userData.seeds as Float32Array;
  const n = mesh.count;
  const amp = 0.12 + tempFrac * 0.45;
  const rad = (R - 0.35);
  const span = Math.max(0.2, y1 - y0);
  for (let i = 0; i < n; i++) {
    const base = seeds[i * 6 + 0], rx = seeds[i * 6 + 1], rz = seeds[i * 6 + 2];
    const f = seeds[i * 6 + 3], p1 = seeds[i * 6 + 4], p2 = seeds[i * 6 + 5];
    const y = clamp(y0 + (base * 0.84 + 0.08) * span + Math.sin(time * f + p1) * amp * span * 0.12, y0 + 0.15, y1 - 0.15);
    const x = clamp(rx * rad * 1.7 + Math.cos(time * f * 0.8 + p2) * amp, -rad, rad);
    const z = clamp(rz * rad * 1.7 + Math.sin(time * f * 0.7 + p1) * amp, -rad, rad);
    _pm.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, _pm);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Build the rig for the given layout. axisHorizontal rotates the whole rig. */
function buildLayout(view: PistonScene3D, key: string, horizontal: boolean, middle: boolean): Parts {
  PistonScene3D.disposeGroup(view.dyn);

  const rig = new THREE.Group();
  view.dyn.add(rig);
  if (horizontal) rig.rotation.z = Math.PI / 2; // Y axis → X axis

  rig.add(makeMetalTube());
  // caps: closed bottom always; closed top only for middle (both ends sealed)
  rig.add(makeCap(-HALF));
  if (middle) rig.add(makeCap(HALF));

  const leftGas = makeGas();
  rig.add(leftGas);
  const leftParticles = makeParticles(28);
  rig.add(leftParticles);
  let rightGas: THREE.Mesh | null = null;
  let rightParticles: THREE.InstancedMesh | null = null;
  if (middle) {
    rightGas = makeGas(); rig.add(rightGas);
    rightParticles = makeParticles(28); rig.add(rightParticles);
  }

  const piston = makePiston();
  rig.add(piston);

  // labels
  const leftDiv = makeLabelDiv();
  const leftLabel = new CSS2DObject(leftDiv);
  view.dyn.add(leftLabel);
  let rightLabel: CSS2DObject | null = null;
  if (middle) {
    const rd = makeLabelDiv();
    rightLabel = new CSS2DObject(rd);
    view.dyn.add(rightLabel);
  }

  // heat glow light (positioned at heated end during update)
  const heatGlow = new THREE.PointLight(0xff5522, 0, 14);
  view.dyn.add(heatGlow);

  // camera framing
  view.camera.position.set(horizontal ? 0 : 7, horizontal ? 7 : 2, 14);
  view.controls.target.set(0, 0, 0);
  view.controls.update();

  return { key, rig, leftGas, rightGas, leftParticles, rightParticles, piston, leftLabel, rightLabel, heatGlow };
}

/** Position a gas mesh to span [y0, y1] along the local Y axis. */
function spanGas(mesh: THREE.Mesh, y0: number, y1: number, color: THREE.Color): void {
  const len = Math.max(0.01, y1 - y0);
  mesh.scale.y = len;
  mesh.position.y = (y0 + y1) / 2;
  (mesh.material as THREE.MeshPhysicalMaterial).color.copy(color);
}

// map a gas column length (cm) to a fraction of the tube
function lenFrac(L: number, Lref: number): number {
  return clamp(L / Lref, 0.04, 0.96);
}

// ── Scene module ─────────────────────────────────────────────────────────────
export const pistonCylinderScene: SceneModule = {
  createInitialState() {
    return { t: 0, animProgress: 0 };
  },

  createStepFn() {
    return (_t: number, dt: number, state: ThermoState): ThermoState => {
      const s: ThermoState = { ...state, t: state.t + dt };
      if (s.animProgress < 1) s.animProgress = Math.min(1, s.animProgress + dt * 0.7);
      return s;
    };
  },

  render(_t, state, rctx, params) {
    const { cm } = rctx;
    const bg = canvasBg();
    cm.clear(bg);
    const container = cm.canvas.parentElement;
    if (!container) return;
    const view = ensure3D(container);
    view.setBackground(bg);
    view.show();

    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const middle = mode === '中间活塞';
    const horizontal = middle || orientation === '水平';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;
    const heatPos = String(params.pcHeatPosition) || '左';
    const anim = clamp(state.animProgress || 0, 0, 1);

    const result = solvePC(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);

    const key = `${mode}|${orientation}|${middle ? heatPos : ''}`;
    if (!parts || parts.key !== key) {
      parts = buildLayout(view, key, horizontal, middle);
    }

    if (middle) {
      const Lref = Math.max(L1, result.L2Left, result.L2Right) * 2.1;
      const lL = L1 + (result.L2Left - L1) * anim;
      const lR = L1 + (result.L2Right - L1) * anim;
      const fL = lenFrac(lL, Lref);
      // piston position: boundary between left and right gas
      const total = fL + lenFrac(lR, Lref);
      const pistonY = -HALF + (fL / total) * SPAN;
      const leftHot = heatPos === '左' || heatPos === '两侧';
      const rightHot = heatPos === '右' || heatPos === '两侧';
      const tL = leftHot ? T1 + (T2 - T1) * anim : T1;
      const tR = rightHot ? T1 + (T2 - T1) * anim : T1;
      spanGas(parts.leftGas, -HALF, pistonY - 0.25, tempColor(tL));
      if (parts.rightGas) spanGas(parts.rightGas, pistonY + 0.25, HALF, tempColor(tR));
      updateParticles(parts.leftParticles, -HALF, pistonY - 0.25, clamp((tL - 250) / 350, 0, 1), state.t);
      if (parts.rightParticles) updateParticles(parts.rightParticles, pistonY + 0.25, HALF, clamp((tR - 250) / 350, 0, 1), state.t);
      parts.piston.position.set(0, pistonY, 0);
      // labels at the gas centres (world space via rig transform)
      setLabel(parts.leftLabel, parts.rig, (-HALF + pistonY) / 2, `L左=${lL.toFixed(1)}cm`);
      if (parts.rightLabel) setLabel(parts.rightLabel, parts.rig, (pistonY + HALF) / 2, `L右=${lR.toFixed(1)}cm`);
      // heat glow at heated side
      const glowY = leftHot && !rightHot ? -HALF + 0.6 : rightHot && !leftHot ? HALF - 0.6 : 0;
      parts.heatGlow.intensity = T2 > T1 ? 1.6 * anim : 0;
      placeAlongRig(parts.heatGlow, parts.rig, glowY, R + 1.2);
    } else {
      const Lref = Math.max(L1, result.L2) * 1.7;
      const L = L1 + (result.L2 - L1) * anim;
      const f = lenFrac(L, Lref);
      const pistonY = -HALF + f * SPAN;
      const T = T1 + (T2 - T1) * anim;
      spanGas(parts.leftGas, -HALF, pistonY - 0.25, tempColor(T));
      updateParticles(parts.leftParticles, -HALF, pistonY - 0.25, clamp((T - 250) / 350, 0, 1), state.t);
      parts.piston.position.set(0, pistonY, 0);
      setLabel(parts.leftLabel, parts.rig, (-HALF + pistonY) / 2, `L=${L.toFixed(1)}cm`);
      parts.heatGlow.intensity = T2 > T1 ? 1.6 * anim : 0;
      placeAlongRig(parts.heatGlow, parts.rig, -HALF + 0.6, R + 1.2);
    }
  },

  onLeave() {
    scene3d?.hide();
  },

  onThemeChange() {
    scene3d?.refreshTheme();
    // Restyle existing label divs (they are only rebuilt on a layout change).
    if (parts) {
      parts.leftLabel.element.style.cssText = labelCss();
      if (parts.rightLabel) parts.rightLabel.element.style.cssText = labelCss();
    }
  },

  getStateDisplay(params): StateDisplayData {
    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;
    const r = solvePC(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);
    const entries: { label: string; value: string; highlight?: boolean }[] = [
      { label: 'P₁', value: `${r.P1.toFixed(2)} kPa` },
      { label: 'P₂', value: `${r.P2.toFixed(2)} kPa`, highlight: mode === '中间活塞' },
    ];
    if (mode === '中间活塞') {
      entries.push({ label: 'L左₂', value: `${r.L2Left.toFixed(2)} cm`, highlight: true });
      entries.push({ label: 'L右₂', value: `${r.L2Right.toFixed(2)} cm`, highlight: true });
    } else {
      entries.push({ label: 'L₂', value: `${r.L2.toFixed(2)} cm`, highlight: true });
    }
    entries.push({ label: 'V₂', value: `${r.V2.toFixed(1)} cm³` });
    return {
      p: r.P1, V: r.V1, T: T1,
      pvOverT: r.P1 * r.V1 / T1,
      customEntries: entries,
    };
  },

  getCalcSteps(params): CalcStep[] {
    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;
    return buildCalcSteps(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);
  },
};

// ── label / glow helpers (operate in rig-local Y, account for rig rotation) ───
function localToWorld(rig: THREE.Group, y: number, radialOffset: number): THREE.Vector3 {
  const v = new THREE.Vector3(radialOffset, y, 0);
  return v.applyMatrix4(rig.matrixWorld);
}
function setLabel(label: CSS2DObject, rig: THREE.Group, y: number, text: string): void {
  (label.element as HTMLDivElement).textContent = text;
  rig.updateWorldMatrix(true, false);
  label.position.copy(localToWorld(rig, y, R + 0.6));
}
function placeAlongRig(obj: THREE.Object3D, rig: THREE.Group, y: number, radialOffset: number): void {
  rig.updateWorldMatrix(true, false);
  obj.position.copy(localToWorld(rig, y, radialOffset));
}

// ── Calc steps ────────────────────────────────────────────────────────────────
function buildCalcSteps(
  mode: string, orientation: string,
  T1: number, T2: number, pistonMass: number,
  S: number, L1: number, P0: number,
  params: Record<string, number | string | boolean>,
): CalcStep[] {
  const steps: CalcStep[] = [];
  const r = solvePC(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);

  if (mode === '中间活塞') {
    const heatPos = String(params.pcHeatPosition) || '左';
    steps.push({ text: '中间活塞 · 两段气体被自由活塞耦合' });
    steps.push({ text: `初始: 两段各 L₁=${L1}cm, 均压 P₁=${P0}kPa` });
    steps.push({ text: `加热位置: ${heatPos}` });
    steps.push({ text: '' });
    steps.push({ text: '① 压强平衡(水平): P左 = P右 = P₂' });
    steps.push({ text: '② 总长守恒: L左+L右 = 2L₁' });
    steps.push({ text: '③ 各段状态方程 PL/T = 常数' });
    steps.push({ text: '' });
    if (heatPos === '两侧') {
      steps.push({ text: '两侧同热 → 对称, 活塞不动' });
      steps.push({ text: `P₂ = P₁·T₂/T₁ = ${r.P2.toFixed(2)} kPa`, highlight: true });
      steps.push({ text: `L左=L右=L₁=${L1} cm` });
    } else {
      steps.push({ text: `联立解得 P₂ = P₁(T₁+T₂)/(2T₁)` });
      steps.push({ text: `  = ${P0}×(${T1}+${T2})/(2×${T1})` });
      steps.push({ text: `  = ${r.P2.toFixed(2)} kPa`, highlight: true });
      steps.push({ text: '' });
      steps.push({ text: `L热 = 2L₁T₂/(T₁+T₂) = ${Math.max(r.L2Left, r.L2Right).toFixed(2)} cm`, highlight: true });
      steps.push({ text: `L冷 = 2L₁T₁/(T₁+T₂) = ${Math.min(r.L2Left, r.L2Right).toFixed(2)} cm`, highlight: true });
    }
    steps.push({ text: '' });
    steps.push({ text: '验证: 两侧压强相等 ✓' });
    return steps;
  }

  steps.push({ text: `单活塞 · ${orientation}放置` });
  steps.push({ text: `P₀=${P0}kPa, m=${pistonMass}kg, S=${S}cm²` });
  steps.push({ text: '' });
  if (orientation === '竖直') {
    const mgOverS = (pistonMass * g) / (S * 1e-4) / 1000;
    steps.push({ text: 'P = P₀ + mg/S' });
    steps.push({ text: `  = ${P0} + ${pistonMass}×${g}/(${S}×10⁻⁴)/1000` });
    steps.push({ text: `  = ${P0} + ${mgOverS.toFixed(2)} = ${r.P1.toFixed(2)} kPa`, highlight: true });
  } else {
    steps.push({ text: `P = P₀ = ${P0} kPa (水平, 重力不影响)` });
  }
  steps.push({ text: '' });
  steps.push({ text: '活塞自由 → 等压过程' });
  steps.push({ text: `L₂ = L₁·T₂/T₁ = ${L1}×${T2}/${T1}` });
  steps.push({ text: `   = ${r.L2.toFixed(2)} cm`, highlight: true });
  steps.push({ text: `V₂ = L₂·S = ${r.V2.toFixed(1)} cm³`, highlight: true });
  return steps;
}
