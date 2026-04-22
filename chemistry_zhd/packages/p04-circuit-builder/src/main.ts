import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, CanvasManager,
} from '@physics/core';

// --- MNA Circuit Solver ---
interface CircuitNode { id: number; voltage: number; }
interface CircuitElement {
  type: 'resistor' | 'battery' | 'wire' | 'slider';
  node1: number; node2: number;
  value: number; // resistance in Ω or EMF in V
  current: number;
  label: string;
  // Visual position
  x1: number; y1: number; x2: number; y2: number;
}

function solveCircuit(elements: CircuitElement[], numNodes: number, groundNode: number): void {
  // Modified Nodal Analysis (MNA)
  // For resistors: G matrix contribution
  // For voltage sources: extra row/col

  const voltageSources = elements.filter(e => e.type === 'battery');
  const n = numNodes + voltageSources.length;

  // Build G matrix and I vector
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const I: number[] = new Array(n).fill(0);

  for (const el of elements) {
    if (el.type === 'resistor' || el.type === 'slider') {
      if (el.value <= 0) continue;
      const g = 1 / el.value;
      G[el.node1][el.node1] += g;
      G[el.node2][el.node2] += g;
      G[el.node1][el.node2] -= g;
      G[el.node2][el.node1] -= g;
    }
  }

  // Voltage sources
  for (let vi = 0; vi < voltageSources.length; vi++) {
    const vs = voltageSources[vi];
    const row = numNodes + vi;
    G[vs.node1][row] += 1;
    G[vs.node2][row] -= 1;
    G[row][vs.node1] += 1;
    G[row][vs.node2] -= 1;
    I[row] = vs.value;
  }

  // Ground node: set voltage = 0
  // Replace ground row with identity
  for (let j = 0; j < n; j++) {
    G[groundNode][j] = 0;
    G[j][groundNode] = 0;
  }
  G[groundNode][groundNode] = 1;
  I[groundNode] = 0;

  // Gaussian elimination
  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(G[row][col]) > Math.abs(G[maxRow][col])) maxRow = row;
    }
    [G[col], G[maxRow]] = [G[maxRow], G[col]];
    [I[col], I[maxRow]] = [I[maxRow], I[col]];

    const pivot = G[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = G[row][col] / pivot;
      for (let j = col; j < n; j++) G[row][j] -= factor * G[col][j];
      I[row] -= factor * I[col];
    }
  }

  // Back substitution
  const X = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = I[row];
    for (let j = row + 1; j < n; j++) sum -= G[row][j] * X[j];
    X[row] = Math.abs(G[row][row]) > 1e-12 ? sum / G[row][row] : 0;
  }

  // Extract node voltages
  const voltages = X.slice(0, numNodes);

  // Calculate currents through each element
  for (const el of elements) {
    if (el.type === 'resistor' || el.type === 'slider') {
      const dv = voltages[el.node1] - voltages[el.node2];
      el.current = el.value > 0 ? dv / el.value : 0;
    }
  }
  for (let vi = 0; vi < voltageSources.length; vi++) {
    voltageSources[vi].current = X[numNodes + vi];
  }
}

// --- Linear regression helper ---
function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-15) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// --- App ---
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-04 电路搭建器');

const ALL_TEMPLATES = [
  '串联电路', '并联电路', '混联电路', '惠斯通电桥', '滑动变阻器',
  '伏安法测电阻', '测电源EMF和内阻', '半偏法测电流计内阻', '欧姆表原理',
];

const SCENE_BASIC = ['串联电路', '并联电路', '混联电路', '滑动变阻器'];
const SCENE_BRIDGE = ['惠斯通电桥'];
const SCENE_VA = ['伏安法测电阻'];
const SCENE_EMF = ['测电源EMF和内阻'];
const SCENE_HALF = ['半偏法测电流计内阻'];
const SCENE_OHM = ['欧姆表原理'];

const paramDefs = defineParams([
  { key: 'template', label: '电路模板', type: 'select', default: '串联电路',
    options: ALL_TEMPLATES },
  { key: 'R1', label: 'R₁', unit: 'Ω', min: 1, max: 100, step: 1, default: 10,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE] },
  { key: 'R2', label: 'R₂', unit: 'Ω', min: 1, max: 100, step: 1, default: 20,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE] },
  { key: 'R3', label: 'R₃', unit: 'Ω', min: 1, max: 100, step: 1, default: 30,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE] },
  { key: 'R4', label: 'R₄', unit: 'Ω', min: 1, max: 100, step: 1, default: 40,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE] },
  { key: 'EMF', label: '电源EMF', unit: 'V', min: 1, max: 24, step: 0.5, default: 12,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE, ...SCENE_VA, ...SCENE_EMF, ...SCENE_HALF] },
  { key: 'rInternal', label: '内阻 r', unit: 'Ω', min: 0, max: 5, step: 0.1, default: 1,
    scenes: [...SCENE_BASIC, ...SCENE_BRIDGE, ...SCENE_VA, ...SCENE_EMF] },
  { key: 'sliderPos', label: '滑动变阻器位置', unit: '%', min: 0, max: 100, step: 1, default: 50,
    scenes: ['滑动变阻器'] },
  // V-A method params
  { key: 'Rx', label: 'R待测', unit: 'Ω', min: 1, max: 1000, step: 1, default: 50,
    scenes: SCENE_VA },
  { key: 'Ra', label: 'R安培表', unit: 'Ω', min: 0.1, max: 10, step: 0.1, default: 0.5,
    scenes: SCENE_VA },
  { key: 'Rv', label: 'R伏特表', unit: 'Ω', min: 500, max: 50000, step: 100, default: 5000,
    scenes: SCENE_VA },
  { key: 'vaMode', label: '伏安法接法', type: 'select', default: '安培表内接法',
    options: ['安培表内接法', '安培表外接法'],
    scenes: SCENE_VA },
  // EMF/internal-r measurement params
  { key: 'Rext', label: 'R外 (变阻器)', unit: 'Ω', min: 1, max: 100, step: 0.5, default: 10,
    scenes: SCENE_EMF },
  // Half-deflection params
  { key: 'R1decade', label: 'R₁ (电阻箱)', unit: 'Ω', min: 100, max: 100000, step: 100, default: 10000,
    scenes: SCENE_HALF },
  { key: 'R2half', label: 'R₂ (并联)', unit: 'Ω', min: 1, max: 5000, step: 1, default: 200,
    scenes: SCENE_HALF },
  { key: 'Rg', label: 'R_G (电流计)', unit: 'Ω', min: 10, max: 2000, step: 1, default: 200,
    scenes: SCENE_HALF },
  // Ohmmeter params
  { key: 'RxOhm', label: 'R_x (待测)', unit: 'Ω', min: 0, max: 5000, step: 10, default: 500,
    scenes: SCENE_OHM },
  { key: 'RgOhm', label: 'R_G (表头)', unit: 'Ω', min: 50, max: 2000, step: 10, default: 500,
    scenes: SCENE_OHM },
  { key: 'EmfOhm', label: 'E (电池)', unit: 'V', min: 0.5, max: 9, step: 0.5, default: 1.5,
    scenes: SCENE_OHM },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });

// Info panel
const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'flex:1; padding:16px; color:#e2e8f0; font-size:15px; line-height:1.8; overflow-y:auto; font-family:monospace;';
layout.bottomPanel.appendChild(infoDiv);

// --- EMF measurement data collection ---
let emfDataPoints: { I: number; U: number }[] = [];
let lastEmfRext = -1;

function buildCircuit(): { elements: CircuitElement[]; numNodes: number } {
  const template = panel.getValue<string>('template');
  const R1 = panel.getValue<number>('R1');
  const R2 = panel.getValue<number>('R2');
  const R3 = panel.getValue<number>('R3');
  const R4 = panel.getValue<number>('R4');
  const EMF = panel.getValue<number>('EMF');
  const r = panel.getValue<number>('rInternal');
  const sliderPct = panel.getValue<number>('sliderPos') / 100;

  const elements: CircuitElement[] = [];

  switch (template) {
    case '串联电路': {
      // nodes: 0=ground, battery 0→1 (EMF), r:1→2, R1:2→3, R2:3→0
      elements.push({ type: 'battery', node1: 1, node2: 0, value: EMF, current: 0, label: `E=${EMF}V`, x1: 1, y1: 1, x2: 1, y2: 4 });
      elements.push({ type: 'resistor', node1: 1, node2: 2, value: r, current: 0, label: `r=${r}Ω`, x1: 1, y1: 4, x2: 4, y2: 4 });
      elements.push({ type: 'resistor', node1: 2, node2: 3, value: R1, current: 0, label: `R₁=${R1}Ω`, x1: 4, y1: 4, x2: 7, y2: 4 });
      elements.push({ type: 'resistor', node1: 3, node2: 0, value: R2, current: 0, label: `R₂=${R2}Ω`, x1: 7, y1: 4, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 1, x2: 1, y2: 1 });
      return { elements, numNodes: 4 };
    }
    case '并联电路': {
      // 0=ground, battery 0→1, R1:1→0, R2:1→0 (parallel)
      elements.push({ type: 'battery', node1: 1, node2: 0, value: EMF, current: 0, label: `E=${EMF}V`, x1: 1, y1: 1, x2: 1, y2: 4 });
      elements.push({ type: 'resistor', node1: 1, node2: 2, value: r, current: 0, label: `r=${r}Ω`, x1: 1, y1: 4, x2: 3, y2: 4 });
      elements.push({ type: 'resistor', node1: 2, node2: 0, value: R1, current: 0, label: `R₁=${R1}Ω`, x1: 5, y1: 5, x2: 7, y2: 5 });
      elements.push({ type: 'resistor', node1: 2, node2: 0, value: R2, current: 0, label: `R₂=${R2}Ω`, x1: 5, y1: 3, x2: 7, y2: 3 });
      elements.push({ type: 'wire', node1: 2, node2: 2, value: 0, current: 0, label: '', x1: 3, y1: 4, x2: 5, y2: 5 });
      elements.push({ type: 'wire', node1: 2, node2: 2, value: 0, current: 0, label: '', x1: 3, y1: 4, x2: 5, y2: 3 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 5, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 3, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 1, x2: 1, y2: 1 });
      return { elements, numNodes: 3 };
    }
    case '混联电路': {
      // R1 in series with (R2 || R3), with internal resistance r
      elements.push({ type: 'battery', node1: 1, node2: 0, value: EMF, current: 0, label: `E=${EMF}V`, x1: 1, y1: 1, x2: 1, y2: 4 });
      elements.push({ type: 'resistor', node1: 1, node2: 2, value: r, current: 0, label: `r=${r}Ω`, x1: 1, y1: 4, x2: 2.5, y2: 4 });
      elements.push({ type: 'resistor', node1: 2, node2: 3, value: R1, current: 0, label: `R₁=${R1}Ω`, x1: 2.5, y1: 4, x2: 4, y2: 4 });
      elements.push({ type: 'resistor', node1: 3, node2: 0, value: R2, current: 0, label: `R₂=${R2}Ω`, x1: 5, y1: 5, x2: 7, y2: 5 });
      elements.push({ type: 'resistor', node1: 3, node2: 0, value: R3, current: 0, label: `R₃=${R3}Ω`, x1: 5, y1: 3, x2: 7, y2: 3 });
      // Wires: junction from R1 to R2/R3 branches, and return to battery
      elements.push({ type: 'wire', node1: 3, node2: 3, value: 0, current: 0, label: '', x1: 4, y1: 4, x2: 5, y2: 5 });
      elements.push({ type: 'wire', node1: 3, node2: 3, value: 0, current: 0, label: '', x1: 4, y1: 4, x2: 5, y2: 3 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 5, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 3, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 1, x2: 1, y2: 1 });
      return { elements, numNodes: 4 };
    }
    case '惠斯通电桥': {
      // Four resistors in bridge config, with internal resistance r
      // Nodes: 0=ground, 1=top, 2=left, 3=right, 4=after r
      elements.push({ type: 'battery', node1: 4, node2: 0, value: EMF, current: 0, label: `E=${EMF}V`, x1: 4, y1: 1, x2: 4, y2: 5 });
      elements.push({ type: 'resistor', node1: 4, node2: 1, value: r, current: 0, label: `r=${r}Ω`, x1: 4, y1: 5, x2: 4, y2: 5.8 });
      elements.push({ type: 'resistor', node1: 1, node2: 2, value: R1, current: 0, label: `R₁=${R1}Ω`, x1: 4, y1: 5.8, x2: 2, y2: 3 });
      elements.push({ type: 'resistor', node1: 2, node2: 0, value: R3, current: 0, label: `R₃=${R3}Ω`, x1: 2, y1: 3, x2: 4, y2: 1 });
      elements.push({ type: 'resistor', node1: 1, node2: 3, value: R2, current: 0, label: `R₂=${R2}Ω`, x1: 4, y1: 5.8, x2: 6, y2: 3 });
      elements.push({ type: 'resistor', node1: 3, node2: 0, value: R4, current: 0, label: `R₄=${R4}Ω`, x1: 6, y1: 3, x2: 4, y2: 1 });
      // Galvanometer between 2 and 3
      elements.push({ type: 'resistor', node1: 2, node2: 3, value: 1, current: 0, label: 'G', x1: 2, y1: 3, x2: 6, y2: 3 });
      return { elements, numNodes: 5 };
    }
    case '滑动变阻器': {
      const Rslider = R1 * sliderPct;
      elements.push({ type: 'battery', node1: 1, node2: 0, value: EMF, current: 0, label: `E=${EMF}V`, x1: 1, y1: 1, x2: 1, y2: 4 });
      if (r > 0.01) {
        elements.push({ type: 'resistor', node1: 1, node2: 3, value: r, current: 0, label: `r=${r}Ω`, x1: 1, y1: 4, x2: 2.5, y2: 4 });
        elements.push({ type: 'slider', node1: 3, node2: 2, value: Rslider || 0.01, current: 0, label: `R₁=${Rslider.toFixed(1)}Ω`, x1: 2.5, y1: 4, x2: 4, y2: 4 });
      } else {
        elements.push({ type: 'slider', node1: 1, node2: 2, value: Rslider || 0.01, current: 0, label: `R₁=${Rslider.toFixed(1)}Ω`, x1: 1, y1: 4, x2: 4, y2: 4 });
      }
      elements.push({ type: 'resistor', node1: 2, node2: 0, value: R2, current: 0, label: `R₂=${R2}Ω`, x1: 5, y1: 4, x2: 7, y2: 4 });
      elements.push({ type: 'wire', node1: 2, node2: 2, value: 0, current: 0, label: '', x1: 4, y1: 4, x2: 5, y2: 4 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 4, x2: 7, y2: 1 });
      elements.push({ type: 'wire', node1: 0, node2: 0, value: 0, current: 0, label: '', x1: 7, y1: 1, x2: 1, y2: 1 });
      return { elements, numNodes: r > 0.01 ? 4 : 3 };
    }
  }
  return { elements, numNodes: 2 };
}

// Cache circuit solution - only recompute when parameters change
let cachedElements: CircuitElement[] = [];
let cachedNumNodes = 0;
let needsResolve = true;
let animTime = 0;

let originX = 0;
let originY = 0;

function updateOrigin(): void {
  originX = cm.getWidth() * 0.5;
  originY = cm.getHeight() * 0.5;
}

// --- Auto-wire connection graph ---
// A connection links two non-wire element endpoints that should be connected by a wire
interface WireConn {
  elemA: number; endA: 'start' | 'end';
  elemB: number; endB: 'start' | 'end';
}
let cachedConnections: WireConn[] = [];

function buildConnections(elements: CircuitElement[]): WireConn[] {
  const eps = 0.01;
  type EP = { elem: number; end: 'start' | 'end'; x: number; y: number };
  const endpoints: EP[] = [];

  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type === 'wire') continue;
    endpoints.push({ elem: i, end: 'start', x: elements[i].x1, y: elements[i].y1 });
    endpoints.push({ elem: i, end: 'end', x: elements[i].x2, y: elements[i].y2 });
  }

  function posKey(x: number, y: number) { return `${Math.round(x * 100)},${Math.round(y * 100)}`; }

  const posMap = new Map<string, EP[]>();
  for (const ep of endpoints) {
    const k = posKey(ep.x, ep.y);
    if (!posMap.has(k)) posMap.set(k, []);
    posMap.get(k)!.push(ep);
  }

  const connections: WireConn[] = [];
  const added = new Set<string>();

  function addConn(a: EP, b: EP) {
    if (a.elem === b.elem) return;
    const key = a.elem < b.elem
      ? `${a.elem}:${a.end}-${b.elem}:${b.end}`
      : `${b.elem}:${b.end}-${a.elem}:${a.end}`;
    if (added.has(key)) return;
    added.add(key);
    connections.push({ elemA: a.elem, endA: a.end, elemB: b.elem, endB: b.end });
  }

  // Direct connections: non-wire endpoints at same position
  for (const [, eps_list] of posMap) {
    for (let i = 0; i < eps_list.length; i++) {
      for (let j = i + 1; j < eps_list.length; j++) {
        addConn(eps_list[i], eps_list[j]);
      }
    }
  }

  // Wire-mediated connections: trace through wire chains
  function findReachableEndpoints(startX: number, startY: number, visitedWires: Set<number>): EP[] {
    const k = posKey(startX, startY);
    const result: EP[] = [];
    const here = posMap.get(k);
    if (here) result.push(...here);

    // Follow wires from this position
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].type !== 'wire' || visitedWires.has(i)) continue;
      const w = elements[i];
      if (Math.abs(w.x1 - startX) < eps && Math.abs(w.y1 - startY) < eps) {
        visitedWires.add(i);
        result.push(...findReachableEndpoints(w.x2, w.y2, visitedWires));
      } else if (Math.abs(w.x2 - startX) < eps && Math.abs(w.y2 - startY) < eps) {
        visitedWires.add(i);
        result.push(...findReachableEndpoints(w.x1, w.y1, visitedWires));
      }
    }
    return result;
  }

  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type !== 'wire') continue;
    const w = elements[i];
    const fromStart = findReachableEndpoints(w.x1, w.y1, new Set([i]));
    const fromEnd = findReachableEndpoints(w.x2, w.y2, new Set([i]));
    for (const a of fromStart) {
      for (const b of fromEnd) {
        addConn(a, b);
      }
    }
  }

  return connections;
}

function resolveCircuit(): void {
  const result = buildCircuit();
  cachedElements = result.elements;
  cachedNumNodes = result.numNodes;
  solveCircuit(cachedElements, cachedNumNodes, 0);
  cachedConnections = buildConnections(cachedElements);
  needsResolve = false;
}

// --- Drag-and-drop for basic circuit templates ---
const DRAG_SCALE = 60;
const DRAG_OX = 80;
const DRAG_OY = 60;
const DRAG_HIT_THRESHOLD = 18; // pixels

let dragIndex = -1;
let dragStartX = 0;
let dragStartY = 0;
let dragOrigX1 = 0;
let dragOrigY1 = 0;
let dragOrigX2 = 0;
let dragOrigY2 = 0;

function isBasicTemplate(): boolean {
  const t = panel.getValue<string>('template');
  return ['串联电路', '并联电路', '混联电路', '滑动变阻器'].includes(t);
}

/** Distance from point (px,py) to line segment (ax,ay)-(bx,by) in pixels */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

function pixelToGrid(px: number, py: number): [number, number] {
  return [(px - DRAG_OX) / DRAG_SCALE, (py - DRAG_OY) / DRAG_SCALE];
}

/** Get screen position of an element endpoint */
function getEndpoint(el: CircuitElement, end: 'start' | 'end'): [number, number] {
  return end === 'start' ? [el.x1, el.y1] : [el.x2, el.y2];
}

const canvas = cm.ctx.canvas;

canvas.addEventListener('mousedown', (e: MouseEvent) => {
  if (!isBasicTemplate() || cachedElements.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let bestDist = DRAG_HIT_THRESHOLD;
  let bestIdx = -1;
  for (let i = 0; i < cachedElements.length; i++) {
    const el = cachedElements[i];
    if (el.type === 'wire') continue;
    const sx1 = DRAG_OX + el.x1 * DRAG_SCALE;
    const sy1 = DRAG_OY + el.y1 * DRAG_SCALE;
    const sx2 = DRAG_OX + el.x2 * DRAG_SCALE;
    const sy2 = DRAG_OY + el.y2 * DRAG_SCALE;
    const d = distToSegment(mx, my, sx1, sy1, sx2, sy2);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    dragIndex = bestIdx;
    const [gx, gy] = pixelToGrid(mx, my);
    dragStartX = gx;
    dragStartY = gy;
    const el = cachedElements[bestIdx];
    dragOrigX1 = el.x1; dragOrigY1 = el.y1;
    dragOrigX2 = el.x2; dragOrigY2 = el.y2;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
});

canvas.addEventListener('mousemove', (e: MouseEvent) => {
  if (dragIndex < 0) {
    if (!isBasicTemplate() || cachedElements.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hovering = false;
    for (let i = 0; i < cachedElements.length; i++) {
      const el = cachedElements[i];
      if (el.type === 'wire') continue;
      const sx1 = DRAG_OX + el.x1 * DRAG_SCALE;
      const sy1 = DRAG_OY + el.y1 * DRAG_SCALE;
      const sx2 = DRAG_OX + el.x2 * DRAG_SCALE;
      const sy2 = DRAG_OY + el.y2 * DRAG_SCALE;
      if (distToSegment(mx, my, sx1, sy1, sx2, sy2) < DRAG_HIT_THRESHOLD) {
        hovering = true;
        break;
      }
    }
    canvas.style.cursor = hovering ? 'grab' : 'default';
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const [gx, gy] = pixelToGrid(mx, my);
  const ddx = gx - dragStartX;
  const ddy = gy - dragStartY;

  const snap = (v: number) => Math.round(v * 2) / 2;
  const el = cachedElements[dragIndex];
  el.x1 = snap(dragOrigX1 + ddx);
  el.y1 = snap(dragOrigY1 + ddy);
  el.x2 = snap(dragOrigX2 + ddx);
  el.y2 = snap(dragOrigY2 + ddy);

  e.preventDefault();
});

canvas.addEventListener('mouseup', () => {
  if (dragIndex >= 0) {
    dragIndex = -1;
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('mouseleave', () => {
  if (dragIndex >= 0) {
    dragIndex = -1;
    canvas.style.cursor = 'default';
  }
});

// =====================================================================
//  Drawing helpers for experiment scenes
// =====================================================================

function drawMeterCircle(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number,
  letter: string, color: string,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.font = `bold ${radius}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, cy);
}

function drawResistorH(
  ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, label: string, color = '#60a5fa',
): void {
  const mx1 = x1 + (x2 - x1) * 0.25;
  const mx2 = x1 + (x2 - x1) * 0.75;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(mx1, y);
  const numZig = 6;
  const amp = 8;
  for (let i = 0; i <= numZig; i++) {
    const frac = i / numZig;
    const x = mx1 + (mx2 - mx1) * frac;
    const side = (i % 2 === 0 ? 1 : -1) * amp;
    ctx.lineTo(x, y + side);
  }
  ctx.lineTo(mx2, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, (x1 + x2) / 2, y - 12);
  }
}

function drawResistorV(
  ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, label: string, color = '#60a5fa',
): void {
  const my1 = y1 + (y2 - y1) * 0.25;
  const my2 = y1 + (y2 - y1) * 0.75;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, my1);
  const numZig = 6;
  const amp = 8;
  for (let i = 0; i <= numZig; i++) {
    const frac = i / numZig;
    const yy = my1 + (my2 - my1) * frac;
    const side = (i % 2 === 0 ? 1 : -1) * amp;
    ctx.lineTo(x + side, yy);
  }
  ctx.lineTo(x, my2);
  ctx.lineTo(x, y2);
  ctx.stroke();
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 14, (y1 + y2) / 2);
  }
}

function drawBatteryV(
  ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, label: string,
): void {
  const my = (y1 + y2) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(251,191,36,0.4)';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, my - 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, my + 6); ctx.lineTo(x, y2); ctx.stroke();
  // Long plate (+)
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 12, my - 6); ctx.lineTo(x + 12, my - 6); ctx.stroke();
  // Short plate (-)
  ctx.beginPath(); ctx.moveTo(x - 7, my + 6); ctx.lineTo(x + 7, my + 6); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fbbf24';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 16, my);
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('+', x + 14, my - 12);
  ctx.fillText('−', x + 14, my + 12);
}

function drawWireH(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.3)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

function drawWireV(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.3)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.restore();
}

function drawSwitch(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, label: string, closed: boolean): void {
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x1, y, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x2, y, 3, 0, Math.PI * 2);
  ctx.stroke();
  if (closed) {
    ctx.beginPath(); ctx.moveTo(x1 + 3, y); ctx.lineTo(x2 - 3, y); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x1 + 3, y); ctx.lineTo(x2 - 3, y - 14); ctx.stroke();
  }
  ctx.fillStyle = '#4ade80';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, (x1 + x2) / 2, y - 16);
}

function drawNode(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// =====================================================================
//  Experiment 1: 伏安法测电阻 (V-A method for resistance measurement)
// =====================================================================

function renderVAMethod(): void {
  const ctx = cm.ctx;
  const Rx = panel.getValue<number>('Rx');
  const Ra = panel.getValue<number>('Ra');
  const Rv = panel.getValue<number>('Rv');
  const EMF = panel.getValue<number>('EMF');
  const r = panel.getValue<number>('rInternal');
  const mode = panel.getValue<string>('vaMode');
  const isInternal = mode === '安培表内接法';

  // --- Compute actual circuit ---
  let trueI: number, trueU: number;
  let measI: number, measU: number;

  if (isInternal) {
    // Ammeter in series with Rx, voltmeter across (Rx + Ra)
    // Voltmeter in parallel with series(Ra, Rx)
    const RaRx = Ra + Rx;
    const Rparallel = (RaRx * Rv) / (RaRx + Rv);
    const Itotal = EMF / (r + Rparallel);
    const Uparallel = Itotal * Rparallel;
    const Ithrough = Uparallel / RaRx; // current through ammeter+Rx
    trueI = Ithrough;
    trueU = Ithrough * Rx;
    measI = Ithrough; // ammeter reads correctly
    measU = Uparallel; // voltmeter reads across Rx+Ra
  } else {
    // Ammeter external: ammeter measures total, voltmeter across Rx only
    // Rv parallel Rx, ammeter in series
    const Rparallel = (Rx * Rv) / (Rx + Rv);
    const Itotal = EMF / (r + Rparallel);
    const URx = Itotal * Rparallel;
    trueI = URx / Rx;
    trueU = URx;
    measI = Itotal; // ammeter reads I_R + I_V
    measU = URx; // voltmeter reads correctly
  }

  const measR = measU / measI;
  const absError = measR - Rx;
  const relError = (Math.abs(absError) / Rx) * 100;

  // --- Draw circuit diagram ---
  const ox = 100, oy = 80;

  // Battery on the left
  drawBatteryV(ctx, ox, oy + 30, oy + 150, `E=${EMF}V`);
  drawResistorV(ctx, ox, oy + 150, oy + 220, `r=${r}Ω`, '#fbbf24');

  // Top wire
  drawWireH(ctx, ox, oy + 30, ox + 350);
  // Bottom wire
  drawWireV(ctx, ox, oy + 220, oy + 280);
  drawWireH(ctx, ox, oy + 280, ox + 350);

  if (isInternal) {
    // Internal: A in series with Rx, V across both
    // Top → A → Rx → right → bottom
    drawWireH(ctx, ox + 350, oy + 30, ox + 350, );
    drawWireV(ctx, ox + 350, oy + 30, oy + 80);

    // Ammeter
    drawMeterCircle(ctx, ox + 350, oy + 100, 18, 'A', '#f87171');
    drawWireV(ctx, ox + 350, oy + 118, oy + 140);

    // Rx
    drawResistorV(ctx, ox + 350, oy + 140, oy + 220, `Rx=${Rx}Ω`, '#60a5fa');
    drawWireV(ctx, ox + 350, oy + 220, oy + 280);

    // Voltmeter across A+Rx (from junction above A to junction below Rx)
    drawWireH(ctx, ox + 350, oy + 80, ox + 500);
    drawWireV(ctx, ox + 500, oy + 80, oy + 140);
    drawMeterCircle(ctx, ox + 500, oy + 160, 18, 'V', '#60a5fa');
    drawWireV(ctx, ox + 500, oy + 178, oy + 220);
    drawWireH(ctx, ox + 350, oy + 220, ox + 500);

    // Labels
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('安培表内接法', ox + 130, oy + 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('V 测量 U(Rx) + U(Ra) → 测量值偏大', ox + 130, oy + 320);
    ctx.fillText('适用条件: Rx >> Ra (大电阻)', ox + 130, oy + 340);
  } else {
    // External: V directly across Rx, A measures total I
    drawWireH(ctx, ox + 350, oy + 30, ox + 350);
    drawWireV(ctx, ox + 350, oy + 30, oy + 60);

    // Ammeter in main line (before junction)
    drawWireH(ctx, ox, oy + 30, ox + 150);
    // Redraw: ammeter at top between battery and junction
    drawMeterCircle(ctx, ox + 180, oy + 30, 18, 'A', '#f87171');
    drawWireH(ctx, ox + 198, oy + 30, ox + 280);
    drawNode(ctx, ox + 280, oy + 30);

    // Rx branch: junction → Rx → bottom
    drawWireV(ctx, ox + 280, oy + 30, oy + 60);
    drawResistorV(ctx, ox + 280, oy + 60, oy + 180, `Rx=${Rx}Ω`, '#60a5fa');
    drawWireV(ctx, ox + 280, oy + 180, oy + 280);

    // V branch: junction → V → bottom
    drawWireH(ctx, ox + 280, oy + 30, ox + 430);
    drawWireV(ctx, ox + 430, oy + 30, oy + 80);
    drawMeterCircle(ctx, ox + 430, oy + 100, 18, 'V', '#60a5fa');
    drawWireV(ctx, ox + 430, oy + 118, oy + 280);
    drawWireH(ctx, ox + 280, oy + 280, ox + 430);

    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('安培表外接法', ox + 130, oy + 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('A 测量 I(Rx) + I(Rv) → 测量值偏小', ox + 100, oy + 320);
    ctx.fillText('适用条件: Rx << Rv (小电阻)', ox + 100, oy + 340);
  }

  // --- Measurement results ---
  const rx = 620, ry = oy + 40;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('测量结果', rx, ry);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#e2e8f0';
  const lines = [
    `真实电阻 Rx = ${Rx.toFixed(1)} Ω`,
    `安培表内阻 Ra = ${Ra.toFixed(1)} Ω`,
    `伏特表内阻 Rv = ${Rv.toFixed(0)} Ω`,
    ``,
    `电流表读数 I = ${(measI * 1000).toFixed(2)} mA`,
    `电压表读数 U = ${measU.toFixed(3)} V`,
    ``,
    `测量值 R = U/I = ${measR.toFixed(2)} Ω`,
    `真实值 R = ${Rx.toFixed(1)} Ω`,
    `绝对误差 = ${absError.toFixed(2)} Ω`,
    `相对误差 = ${relError.toFixed(2)}%`,
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = lines[i].startsWith('测量值') || lines[i].startsWith('相对误差')
      ? '#fbbf24' : '#e2e8f0';
    ctx.fillText(lines[i], rx, ry + 28 + i * 22);
  }

  // Selection criterion
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  const criterion = Rx > Math.sqrt(Ra * Rv)
    ? '→ Rx > √(Ra·Rv), 应选内接法'
    : '→ Rx < √(Ra·Rv), 应选外接法';
  ctx.fillText(`√(Ra·Rv) = ${Math.sqrt(Ra * Rv).toFixed(1)} Ω`, rx, ry + 28 + lines.length * 22 + 10);
  ctx.fillText(criterion, rx, ry + 28 + lines.length * 22 + 32);

  // Formula box
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx - 10, ry + 28 + lines.length * 22 + 50, 310, 60);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('内接: R测 = Rx + Ra > Rx (偏大)', rx, ry + 28 + lines.length * 22 + 70);
  ctx.fillText('外接: R测 = RxRv/(Rx+Rv) < Rx (偏小)', rx, ry + 28 + lines.length * 22 + 90);

  // Info panel
  infoDiv.innerHTML = `<b>伏安法测电阻 - ${mode}</b><br>` +
    `公式: R = U/I<br>` +
    `${isInternal ? '内接法: V测U偏大 (含Ra两端电压), R测偏大' : '外接法: A测I偏大 (含Iv), R测偏小'}<br>` +
    `测量值 ${measR.toFixed(2)}Ω vs 真实值 ${Rx}Ω, 误差 ${relError.toFixed(2)}%`;
}

// =====================================================================
//  Experiment 2: 测电源EMF和内阻
// =====================================================================

function renderEMFMeasurement(): void {
  const ctx = cm.ctx;
  const EMF = panel.getValue<number>('EMF');
  const r = panel.getValue<number>('rInternal');
  const Rext = panel.getValue<number>('Rext');

  // Solve: I = EMF / (r + Rext), U = EMF - I*r
  const I_total = EMF / (r + Rext);
  const U_terminal = EMF - I_total * r;

  // Collect data point (only when Rext changes)
  if (Rext !== lastEmfRext) {
    lastEmfRext = Rext;
    // Avoid duplicate points
    const exists = emfDataPoints.some(p => Math.abs(p.I - I_total) < 1e-6);
    if (!exists && emfDataPoints.length < 20) {
      emfDataPoints.push({ I: I_total, U: U_terminal });
      emfDataPoints.sort((a, b) => a.I - b.I);
    }
  }

  // --- Draw circuit ---
  const ox = 60, oy = 60;
  drawBatteryV(ctx, ox + 30, oy + 20, oy + 120, `ε=${EMF}V`);
  drawResistorV(ctx, ox + 30, oy + 120, oy + 200, `r=${r}Ω`, '#fbbf24');

  // Top wire
  drawWireH(ctx, ox + 30, oy + 20, ox + 260);
  // Bottom wire
  drawWireV(ctx, ox + 30, oy + 200, oy + 270);
  drawWireH(ctx, ox + 30, oy + 270, ox + 260);

  // Ammeter in series
  drawMeterCircle(ctx, ox + 130, oy + 20, 16, 'A', '#f87171');
  drawWireH(ctx, ox + 146, oy + 20, ox + 260);

  // Variable resistor R
  drawResistorV(ctx, ox + 260, oy + 20, oy + 130, `R=${Rext}Ω`, '#c084fc');
  // Slider indicator
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(ox + 274, oy + 60);
  ctx.lineTo(ox + 284, oy + 55);
  ctx.lineTo(ox + 284, oy + 65);
  ctx.fill();

  drawWireV(ctx, ox + 260, oy + 130, oy + 270);

  // Voltmeter across R
  drawWireH(ctx, ox + 260, oy + 20, ox + 360);
  drawWireV(ctx, ox + 360, oy + 20, oy + 100);
  drawMeterCircle(ctx, ox + 360, oy + 120, 16, 'V', '#60a5fa');
  drawWireV(ctx, ox + 360, oy + 136, oy + 270);
  drawWireH(ctx, ox + 260, oy + 270, ox + 360);

  // Current reading display
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`I = ${I_total.toFixed(3)} A`, ox + 80, oy + 310);
  ctx.fillText(`U = ${U_terminal.toFixed(3)} V`, ox + 250, oy + 310);
  ctx.fillText(`R = ${Rext.toFixed(1)} Ω`, ox + 250, oy + 335);

  // --- U-I graph ---
  const gx = 460, gy = 30, gw = 440, gh = 260;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(gx, gy, gw, gh);
  ctx.fillStyle = '#111827';
  ctx.fillRect(gx + 1, gy + 1, gw - 2, gh - 2);

  // Axes
  const padL = 50, padB = 35, padT = 25, padR = 20;
  const plotX = gx + padL;
  const plotY = gy + padT;
  const plotW = gw - padL - padR;
  const plotH = gh - padT - padB;

  // Determine scale from data
  const maxI = EMF / r; // theoretical max
  const Iscale = Math.min(maxI * 1.1, EMF / 0.5);
  const Uscale = EMF * 1.15;

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotX, plotY);
  ctx.lineTo(plotX, plotY + plotH);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('I / A', plotX + plotW / 2, plotY + plotH + 28);
  ctx.save();
  ctx.translate(plotX - 35, plotY + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('U / V', 0, 0);
  ctx.restore();

  // Grid and tick marks
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let ti = 0; ti <= 5; ti++) {
    const frac = ti / 5;
    // I axis
    const tx = plotX + plotW * frac;
    ctx.beginPath(); ctx.moveTo(tx, plotY); ctx.lineTo(tx, plotY + plotH); ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((Iscale * frac).toFixed(2), tx, plotY + plotH + 14);
    // U axis
    const ty = plotY + plotH * (1 - frac);
    ctx.beginPath(); ctx.moveTo(plotX, ty); ctx.lineTo(plotX + plotW, ty); ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText((Uscale * frac).toFixed(1), plotX - 5, ty + 4);
  }

  // Theoretical line: U = EMF - I*r
  ctx.strokeStyle = 'rgba(96,165,250,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const i0 = 0, u0 = EMF;
  const i1 = EMF / r, u1 = 0;
  ctx.moveTo(plotX + (i0 / Iscale) * plotW, plotY + plotH * (1 - u0 / Uscale));
  ctx.lineTo(plotX + (i1 / Iscale) * plotW, plotY + plotH * (1 - u1 / Uscale));
  ctx.stroke();
  ctx.setLineDash([]);

  // Plot data points
  for (const p of emfDataPoints) {
    const px = plotX + (p.I / Iscale) * plotW;
    const py = plotY + plotH * (1 - p.U / Uscale);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Current point highlighted
  {
    const px = plotX + (I_total / Iscale) * plotW;
    const py = plotY + plotH * (1 - U_terminal / Uscale);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Linear fit from collected data
  if (emfDataPoints.length >= 2) {
    const xs = emfDataPoints.map(p => p.I);
    const ys = emfDataPoints.map(p => p.U);
    const fit = linearFit(xs, ys);
    const fitEMF = fit.intercept;
    const fitR = -fit.slope;

    // Draw fit line
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const fi0 = 0, fu0 = fit.intercept;
    const fi1 = Iscale, fu1 = fit.intercept + fit.slope * Iscale;
    ctx.moveTo(plotX + (fi0 / Iscale) * plotW, plotY + plotH * (1 - fu0 / Uscale));
    ctx.lineTo(plotX + (fi1 / Iscale) * plotW, plotY + plotH * (1 - fu1 / Uscale));
    ctx.stroke();

    // Fit results
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`拟合结果 (${emfDataPoints.length}个数据点):`, gx + 10, gy + gh + 30);
    ctx.font = '13px monospace';
    ctx.fillText(`ε = ${fitEMF.toFixed(3)} V (真实: ${EMF} V)`, gx + 10, gy + gh + 50);
    ctx.fillText(`r = ${fitR.toFixed(3)} Ω (真实: ${r} Ω)`, gx + 10, gy + gh + 70);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`U = ε − Ir → 截距=ε, 斜率=−r`, gx + 10, gy + gh + 90);
  }

  // Graph title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('U-I 特性曲线', gx + gw / 2, gy + 16);

  // Legend
  ctx.fillStyle = 'rgba(96,165,250,0.6)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('--- 理论线', gx + gw - 100, gy + 16);
  ctx.fillStyle = '#4ade80';
  ctx.fillText('—— 拟合线', gx + gw - 100, gy + 30);

  // Data table
  let info = '<b>测电源EMF和内阻</b><br>';
  info += '公式: U = ε − Ir<br><br>';
  info += '<table style="border-collapse:collapse; font-size:13px;">';
  info += '<tr><th style="border:1px solid #475569;padding:2px 8px;">I (A)</th><th style="border:1px solid #475569;padding:2px 8px;">U (V)</th></tr>';
  for (const p of emfDataPoints) {
    const hl = Math.abs(p.I - I_total) < 1e-6 ? ' style="background:#1e3a5f;"' : '';
    info += `<tr${hl}><td style="border:1px solid #475569;padding:2px 8px;">${p.I.toFixed(4)}</td><td style="border:1px solid #475569;padding:2px 8px;">${p.U.toFixed(3)}</td></tr>`;
  }
  info += '</table>';
  info += '<br><span style="color:#94a3b8">调节滑动变阻器R采集数据点 (最多20个)</span>';
  infoDiv.innerHTML = info;
}

// =====================================================================
//  Experiment 3: 半偏法测电流计内阻
// =====================================================================

function renderHalfDeflection(): void {
  const ctx = cm.ctx;
  const EMF = panel.getValue<number>('EMF');
  const R1 = panel.getValue<number>('R1decade');
  const R2 = panel.getValue<number>('R2half');
  const Rg = panel.getValue<number>('Rg');

  // Step 1: S1 closed, S2 open → I_full = EMF / (R1 + Rg)
  const I_full = EMF / (R1 + Rg);

  // Step 2: S1 closed, S2 closed → parallel(Rg, R2), galvanometer reads half
  const Rp = (Rg * R2) / (Rg + R2);
  const I_total_s2 = EMF / (R1 + Rp);
  const I_galv_s2 = I_total_s2 * R2 / (Rg + R2); // current through G

  // For half-deflection: we want I_galv_s2 = I_full / 2
  // Solving: R2/(R1*Rg + R1*R2 + Rg*R2) = 1/(2*(R1+Rg))
  // → R2*(R1+Rg) = R1*Rg → R2 = R1*Rg/(R1+Rg)
  const R2_half_exact = Rg * R1 / (R1 + Rg);

  // The measured Rg ≈ R2 (when R1 >> R2)
  const measuredRg = R2;
  const actualRatio = I_galv_s2 / I_full; // should be 0.5 at half deflection

  // Error analysis
  const errorAbs = measuredRg - Rg;
  const errorRel = (Math.abs(errorAbs) / Rg) * 100;

  // --- Draw circuit ---
  const ox = 60, oy = 50;

  // Battery
  drawBatteryV(ctx, ox + 40, oy + 30, oy + 120, `E=${EMF}V`);

  // Top wire from battery to S1
  drawWireH(ctx, ox + 40, oy + 30, ox + 100);
  drawSwitch(ctx, ox + 100, oy + 30, ox + 140, 'S₁', true);
  drawWireH(ctx, ox + 140, oy + 30, ox + 200);

  // R1 (decade box)
  drawResistorH(ctx, ox + 200, oy + 30, ox + 380, `R₁=${R1}Ω`, '#c084fc');

  // Junction point A
  drawNode(ctx, ox + 380, oy + 30);
  drawWireV(ctx, ox + 380, oy + 30, oy + 80);

  // Galvanometer branch (top)
  drawWireH(ctx, ox + 380, oy + 80, ox + 420);
  drawMeterCircle(ctx, ox + 450, oy + 80, 16, 'G', '#f87171');
  drawWireH(ctx, ox + 466, oy + 80, ox + 540);

  // R2 branch with S2 (bottom)
  drawWireV(ctx, ox + 380, oy + 80, oy + 150);
  drawSwitch(ctx, ox + 380, oy + 150, ox + 420, 'S₂', true);
  drawResistorH(ctx, ox + 420, oy + 150, ox + 540, `R₂=${R2}Ω`, '#60a5fa');
  drawWireV(ctx, ox + 540, oy + 80, oy + 150);

  // Junction point B
  drawNode(ctx, ox + 540, oy + 110);

  // Bottom wire back to battery
  drawWireV(ctx, ox + 540, oy + 150, oy + 220);
  drawWireH(ctx, ox + 40, oy + 220, ox + 540);
  drawWireV(ctx, ox + 40, oy + 120, oy + 220);

  // Galvanometer deflection indicator
  const meterCx = ox + 450, meterCy = oy + 250;
  const meterR = 50;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(meterCx, meterCy, meterR, Math.PI, 0);
  ctx.stroke();

  // Scale marks
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI - (i / 10) * Math.PI;
    const inner = meterR - 6;
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(meterCx + Math.cos(angle) * inner, meterCy - Math.sin(angle) * inner);
    ctx.lineTo(meterCx + Math.cos(angle) * meterR, meterCy - Math.sin(angle) * meterR);
    ctx.stroke();
  }

  // Needle showing current fraction
  const fraction = Math.min(actualRatio * 2, 1); // normalized: 1 = full, 0.5 = half
  const needleAngle = Math.PI - fraction * Math.PI;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(meterCx, meterCy);
  ctx.lineTo(meterCx + Math.cos(needleAngle) * (meterR - 10), meterCy - Math.sin(needleAngle) * (meterR - 10));
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('0', meterCx - meterR - 8, meterCy + 4);
  ctx.fillText('满', meterCx + meterR + 10, meterCy + 4);
  ctx.fillText(`${(actualRatio * 100).toFixed(1)}%`, meterCx, meterCy + 18);

  // --- Results panel ---
  const rx = 620, ry = oy + 20;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('半偏法测电流计内阻', rx, ry);

  ctx.font = '13px monospace';
  const results = [
    `真实 R_G = ${Rg} Ω`,
    ``,
    `步骤1: 闭合S₁, 调R₁使G满偏`,
    `  I_满 = E/(R₁+Rg)`,
    `       = ${(I_full * 1000).toFixed(3)} mA`,
    ``,
    `步骤2: 闭合S₂, 调R₂使G半偏`,
    `  此时 R_G ≈ R₂`,
    ``,
    `R₂ = ${R2} Ω`,
    `精确半偏R₂ = ${R2_half_exact.toFixed(1)} Ω`,
    `G实际偏转 = ${(actualRatio * 100).toFixed(1)}%`,
    ``,
    `测量值 R_G = ${measuredRg} Ω`,
    `绝对误差 = ${errorAbs.toFixed(1)} Ω`,
    `相对误差 = ${errorRel.toFixed(1)}%`,
  ];
  for (let i = 0; i < results.length; i++) {
    ctx.fillStyle = results[i].startsWith('测量值') ? '#fbbf24' :
      results[i].startsWith('  ') ? '#94a3b8' : '#e2e8f0';
    ctx.fillText(results[i], rx, ry + 24 + i * 20);
  }

  // Error analysis box
  const bx = rx, by = ry + 24 + results.length * 20 + 10;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 5, by - 5, 320, 70);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('误差分析:', bx, by + 10);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('闭合S₂后总电阻减小, 总电流增大', bx, by + 28);
  ctx.fillText('→ R₂ < 实际R_G, 测量值偏小', bx, by + 44);
  ctx.fillText('要求 R₁ >> R₂ ≈ Rg 以减小误差', bx, by + 60);

  infoDiv.innerHTML = `<b>半偏法测电流计内阻</b><br>` +
    `原理: 闭合S₁调R₁满偏, 再闭合S₂调R₂半偏, 则R_G≈R₂<br>` +
    `当前: R₂=${R2}Ω, 真实Rg=${Rg}Ω, 偏转${(actualRatio * 100).toFixed(1)}%<br>` +
    `误差原因: 闭S₂后总R↓ → 总I↑ → R₂ &lt; 实际Rg, 测量值偏小`;
}

// =====================================================================
//  Experiment 4: 惠斯通电桥 (enhanced)
// =====================================================================

function renderWheatstone(): void {
  const ctx = cm.ctx;
  const R1 = panel.getValue<number>('R1');
  const R2 = panel.getValue<number>('R2');
  const R3 = panel.getValue<number>('R3');
  const R4 = panel.getValue<number>('R4');
  const EMF = panel.getValue<number>('EMF');
  const r = panel.getValue<number>('rInternal');

  // Use MNA solver for bridge circuit
  // Nodes: 0=bottom(gnd), 1=top, 2=left, 3=right, 4=after internal r
  const elements: CircuitElement[] = [];
  elements.push({ type: 'battery', node1: 4, node2: 0, value: EMF, current: 0, label: `E`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 4, node2: 1, value: r, current: 0, label: `r`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 1, node2: 2, value: R1, current: 0, label: `R1`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 2, node2: 0, value: R3, current: 0, label: `R3`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 1, node2: 3, value: R2, current: 0, label: `R2`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 3, node2: 0, value: R4, current: 0, label: `R4`, x1: 0, y1: 0, x2: 0, y2: 0 });
  elements.push({ type: 'resistor', node1: 2, node2: 3, value: 100, current: 0, label: `G`, x1: 0, y1: 0, x2: 0, y2: 0 }); // galvanometer ~100Ω

  solveCircuit(elements, 5, 0);

  const Ig = elements[6].current;
  const ratioLeft = R1 / R3;
  const ratioRight = R2 / R4;
  const isBalanced = Math.abs(Ig) < 0.0005;

  // --- Draw bridge diagram ---
  const cx = 280, cy = 240; // center of diamond
  const dx = 150, dy = 120;

  // Diamond nodes: top, bottom, left, right
  const top = { x: cx, y: cy - dy };
  const bot = { x: cx, y: cy + dy };
  const left = { x: cx - dx, y: cy };
  const right = { x: cx + dx, y: cy };

  // R1: top → left
  drawResistorDiag(ctx, top.x, top.y, left.x, left.y, `R₁=${R1}Ω`, '#60a5fa');
  // R2: top → right
  drawResistorDiag(ctx, top.x, top.y, right.x, right.y, `R₂=${R2}Ω`, '#60a5fa');
  // R3: left → bottom
  drawResistorDiag(ctx, left.x, left.y, bot.x, bot.y, `R₃=${R3}Ω`, '#60a5fa');
  // R4: right → bottom
  drawResistorDiag(ctx, right.x, right.y, bot.x, bot.y, `R₄=${R4}Ω`, '#60a5fa');

  // Galvanometer: left → right
  drawMeterCircle(ctx, cx, cy, 18, 'G', isBalanced ? '#4ade80' : '#f87171');
  ctx.strokeStyle = isBalanced ? '#4ade80' : '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(cx - 18, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 18, cy); ctx.lineTo(right.x, right.y); ctx.stroke();

  // Battery: bottom to top (external)
  drawWireV(ctx, cx, bot.y, bot.y + 40);
  drawBatteryV(ctx, cx - 80, bot.y + 40, top.y - 30, `E=${EMF}V`);
  drawWireH(ctx, cx, bot.y + 40, cx - 80);
  drawWireV(ctx, cx - 80, top.y - 30, top.y);
  drawWireH(ctx, cx - 80, top.y, cx);
  drawResistorH(ctx, cx - 80, top.y - 15, cx - 30, `r=${r}Ω`, '#fbbf24');

  // Nodes
  drawNode(ctx, top.x, top.y);
  drawNode(ctx, bot.x, bot.y);
  drawNode(ctx, left.x, left.y);
  drawNode(ctx, right.x, right.y);

  // --- Balance indicator ---
  const rx = 520, ry = 40;

  // Large balance status
  if (isBalanced) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('电桥平衡!', rx, ry + 10);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 10, ry - 18, 200, 40);
  } else {
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('电桥不平衡', rx, ry + 10);
  }

  ctx.font = '14px monospace';
  ctx.fillStyle = '#e2e8f0';
  const blines = [
    ``,
    `平衡条件: R₁/R₃ = R₂/R₄`,
    ``,
    `R₁/R₃ = ${R1}/${R3} = ${ratioLeft.toFixed(4)}`,
    `R₂/R₄ = ${R2}/${R4} = ${ratioRight.toFixed(4)}`,
    ``,
    `电流计电流 Ig = ${(Ig * 1000).toFixed(3)} mA`,
    ``,
    `R₁·R₄ = ${(R1 * R4).toFixed(0)}`,
    `R₂·R₃ = ${(R2 * R3).toFixed(0)}`,
  ];
  for (let i = 0; i < blines.length; i++) {
    ctx.fillStyle = blines[i].startsWith('平衡条件') ? '#fbbf24' : '#e2e8f0';
    ctx.fillText(blines[i], rx, ry + 30 + i * 22);
  }

  // Galvanometer bar indicator
  const barX = rx, barY = ry + 30 + blines.length * 22 + 20;
  const barW = 300, barH = 20;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(barX, barY, barW, barH);
  // Center line
  ctx.strokeStyle = '#4ade80';
  ctx.beginPath(); ctx.moveTo(barX + barW / 2, barY); ctx.lineTo(barX + barW / 2, barY + barH); ctx.stroke();
  // Needle
  const maxIg = 0.1; // max display range
  const needlePos = Math.max(-1, Math.min(1, Ig / maxIg));
  const nx = barX + barW / 2 + needlePos * barW / 2;
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.moveTo(nx, barY);
  ctx.lineTo(nx - 4, barY - 8);
  ctx.lineTo(nx + 4, barY - 8);
  ctx.fill();
  ctx.fillRect(nx - 1, barY, 2, barH);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('−Ig', barX + 10, barY + barH + 14);
  ctx.fillText('0', barX + barW / 2, barY + barH + 14);
  ctx.fillText('+Ig', barX + barW - 10, barY + barH + 14);

  // Hint
  const R4balanced = R2 * R3 / R1;
  ctx.fillStyle = '#4ade80';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`平衡时 R₄ = R₂R₃/R₁ = ${R4balanced.toFixed(1)} Ω`, rx, barY + barH + 40);

  infoDiv.innerHTML = `<b>惠斯通电桥</b><br>` +
    `平衡条件: R₁/R₃ = R₂/R₄ (即 R₁R₄ = R₂R₃)<br>` +
    `Ig = ${(Ig * 1000).toFixed(3)} mA ${isBalanced ? '(平衡!)' : ''}<br>` +
    `调节R₄至 ${R4balanced.toFixed(1)}Ω 可达平衡`;
}

function drawResistorDiag(
  ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number,
  label: string, color = '#60a5fa',
): void {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const zigStart = 0.25, zigEnd = 0.75;
  const numZig = 6;
  const amp = 8;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * len * zigStart, y1 + uy * len * zigStart);
  for (let i = 0; i <= numZig; i++) {
    const frac = zigStart + (zigEnd - zigStart) * (i / numZig);
    const side = (i % 2 === 0 ? 1 : -1) * amp;
    ctx.lineTo(x1 + ux * len * frac + px * side, y1 + uy * len * frac + py * side);
  }
  ctx.lineTo(x1 + ux * len * zigEnd, y1 + uy * len * zigEnd);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();

  if (label) {
    const mx = (x1 + x2) / 2 + px * 18;
    const my = (y1 + y2) / 2 + py * 18;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my);
  }
}

// =====================================================================
//  Experiment 5: 欧姆表原理
// =====================================================================

function renderOhmmeter(): void {
  const ctx = cm.ctx;
  const E = panel.getValue<number>('EmfOhm');
  const Rg = panel.getValue<number>('RgOhm');
  const Rx = panel.getValue<number>('RxOhm');

  // Internal total resistance = Rg (we use Rg as the total internal R for simplicity,
  // which includes battery internal r and adjusting resistor)
  // Full-scale current: Ig = E / Rg (when Rx=0, terminals shorted)
  const Ig = E / Rg;
  // Current with Rx: I = E / (Rg + Rx)
  const I_rx = E / (Rg + Rx);
  // Deflection fraction
  const deflection = I_rx / Ig; // 1.0 = full scale = 0Ω, 0.0 = no deflection = ∞

  // Mid-scale resistance (center of meter reads this)
  const R_mid = Rg; // when Rx = Rg, deflection = 0.5

  // --- Draw internal circuit diagram ---
  const ox = 60, oy = 50;

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('欧姆表内部电路', ox, oy);

  // Battery
  drawBatteryV(ctx, ox + 30, oy + 30, oy + 100, `E=${E}V`);

  // Internal resistance (Rg = r + R_adjust + R_galv)
  drawResistorH(ctx, ox + 30, oy + 30, ox + 160, `R内=${Rg}Ω`, '#fbbf24');

  // Galvanometer
  drawWireH(ctx, ox + 160, oy + 30, ox + 200);
  drawMeterCircle(ctx, ox + 230, oy + 30, 16, 'G', '#f87171');
  drawWireH(ctx, ox + 246, oy + 30, ox + 320);

  // Terminals
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('红', ox + 320, oy + 24);
  ctx.fillText('黑', ox + 30, oy + 160);

  // External Rx
  if (Rx > 0) {
    drawResistorH(ctx, ox + 30, oy + 140, ox + 320, `Rx=${Rx}Ω`, '#c084fc');
  } else {
    drawWireH(ctx, ox + 30, oy + 140, ox + 320);
    ctx.fillStyle = '#4ade80';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('短接 (调零)', ox + 130, oy + 132);
  }

  drawWireV(ctx, ox + 320, oy + 30, oy + 140);
  drawWireV(ctx, ox + 30, oy + 100, oy + 140);

  // --- Draw meter face ---
  const meterCx = 520, meterCy = 220, meterR = 140;

  // Meter background
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(meterCx, meterCy, meterR + 5, Math.PI, 0);
  ctx.lineTo(meterCx + meterR + 5, meterCy + 10);
  ctx.lineTo(meterCx - meterR - 5, meterCy + 10);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(meterCx, meterCy, meterR + 5, Math.PI, 0);
  ctx.stroke();

  // Non-linear ohm scale
  // Deflection = Rg/(Rg+Rx), so Rx = Rg*(1/deflection - 1)
  // At full deflection (right) = 0Ω, at zero deflection (left) = ∞
  const scaleValues = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  for (const rv of scaleValues) {
    const def = Rg / (Rg + rv); // deflection for this resistance
    const angle = Math.PI - def * Math.PI; // left=π (∞), right=0 (0Ω)
    const innerR = meterR - 20;
    const outerR = meterR - 8;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = rv % 10 === 0 || rv <= 5 ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(meterCx + Math.cos(angle) * innerR, meterCy - Math.sin(angle) * innerR);
    ctx.lineTo(meterCx + Math.cos(angle) * outerR, meterCy - Math.sin(angle) * outerR);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelR = meterR - 30;
    const lstr = rv >= 1000 ? `${rv / 1000}k` : `${rv}`;
    ctx.fillText(lstr, meterCx + Math.cos(angle) * labelR, meterCy - Math.sin(angle) * labelR);
  }

  // ∞ mark on far left
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  const infAngle = Math.PI - 0.02;
  ctx.fillText('∞', meterCx + Math.cos(infAngle) * (meterR - 30), meterCy - Math.sin(infAngle) * (meterR - 30));

  // 0 mark on far right
  ctx.fillText('0', meterCx + Math.cos(0.02) * (meterR - 30), meterCy - Math.sin(0.02) * (meterR - 30));

  // "Ω" label
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Ω', meterCx, meterCy - meterR + 45);

  // Needle
  const needleAngle = Math.PI - deflection * Math.PI;
  ctx.strokeStyle = '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(meterCx, meterCy);
  ctx.lineTo(
    meterCx + Math.cos(needleAngle) * (meterR - 15),
    meterCy - Math.sin(needleAngle) * (meterR - 15),
  );
  ctx.stroke();

  // Needle pivot
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(meterCx, meterCy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Reading value display
  const readingR = Rx === 0 ? 0 : Rg * (1 / deflection - 1);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`读数: ${readingR.toFixed(1)} Ω`, meterCx, meterCy + 35);

  // --- Teaching annotations ---
  const tx = 700, ty = 50;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('欧姆表原理', tx, ty);

  ctx.font = '13px monospace';
  const tlines = [
    `E = ${E} V`,
    `R内 = Rg = ${Rg} Ω`,
    `Rx = ${Rx} Ω`,
    ``,
    `I = E/(Rg+Rx)`,
    `  = ${E}/(${Rg}+${Rx})`,
    `  = ${(I_rx * 1000).toFixed(3)} mA`,
    ``,
    `满偏电流 Ig = ${(Ig * 1000).toFixed(3)} mA`,
    `偏转比 = ${(deflection * 100).toFixed(1)}%`,
    ``,
    `中值电阻 = Rg = ${Rg} Ω`,
    `(偏转50%对应的电阻)`,
  ];
  for (let i = 0; i < tlines.length; i++) {
    ctx.fillStyle = tlines[i].startsWith('  ') ? '#94a3b8' :
      tlines[i].startsWith('中值') ? '#4ade80' : '#e2e8f0';
    ctx.fillText(tlines[i], tx, ty + 24 + i * 20);
  }

  // Key teaching points
  const ky = ty + 24 + tlines.length * 20 + 15;
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 1;
  ctx.strokeRect(tx - 5, ky - 5, 260, 100);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('关键考点:', tx, ky + 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('1. 刻度盘左∞右0 (反向)', tx, ky + 30);
  ctx.fillText('2. 刻度不均匀 (非线性)', tx, ky + 48);
  ctx.fillText('3. 使用前需调零 (短接红黑)', tx, ky + 66);
  ctx.fillText('4. 换挡后必须重新调零', tx, ky + 84);

  infoDiv.innerHTML = `<b>欧姆表原理</b><br>` +
    `I = E/(Rg+Rx) = ${(I_rx * 1000).toFixed(3)}mA<br>` +
    `偏转: ${(deflection * 100).toFixed(1)}%, 读数: ${readingR.toFixed(1)}Ω<br>` +
    `注意: 刻度反向且不均匀, 中值电阻=${Rg}Ω`;
}

// =====================================================================
//  Main render dispatcher
// =====================================================================

function render(): void {
  const ctx = cm.ctx;
  cm.clear('#070b14');
  updateOrigin();

  const template = panel.getValue<string>('template');

  // Dispatch to experiment-specific renderers
  switch (template) {
    case '伏安法测电阻':
      renderVAMethod();
      return;
    case '测电源EMF和内阻':
      renderEMFMeasurement();
      return;
    case '半偏法测电流计内阻':
      renderHalfDeflection();
      return;
    case '惠斯通电桥':
      renderWheatstone();
      return;
    case '欧姆表原理':
      renderOhmmeter();
      return;
  }

  // --- Original circuit templates ---
  if (needsResolve) resolveCircuit();
  const elements = cachedElements;

  const scale = DRAG_SCALE;
  const ox = DRAG_OX, oy = DRAG_OY;

  // Drag hint
  ctx.fillStyle = '#475569';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('拖动元件可调整布局', cm.getWidth() - 16, cm.getHeight() - 12);

  // --- Auto-draw connection wires between elements ---
  for (const conn of cachedConnections) {
    const elA = elements[conn.elemA];
    const elB = elements[conn.elemB];
    const [ax, ay] = getEndpoint(elA, conn.endA);
    const [bx, by] = getEndpoint(elB, conn.endB);
    const sx1 = ox + ax * scale;
    const sy1 = oy + ay * scale;
    const sx2 = ox + bx * scale;
    const sy2 = oy + by * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    // Manhattan routing: pick the L-shape that keeps wires cleaner
    const adx = Math.abs(sx2 - sx1), ady = Math.abs(sy2 - sy1);
    if (adx < 1 || ady < 1) {
      // Straight line (same row or column)
      ctx.lineTo(sx2, sy2);
    } else {
      // L-shape: go vertical first then horizontal (keeps wires along edges)
      ctx.lineTo(sx1, sy2);
      ctx.lineTo(sx2, sy2);
    }
    ctx.stroke();
    ctx.restore();
  }

  // --- Draw circuit elements (skip wires, they're auto-generated) ---
  for (const el of elements) {
    if (el.type === 'wire') continue;

    const sx1 = ox + el.x1 * scale;
    const sy1 = oy + el.y1 * scale;
    const sx2 = ox + el.x2 * scale;
    const sy2 = oy + el.y2 * scale;

    // Highlight dragged element
    const isDragging = (dragIndex >= 0 && cachedElements.indexOf(el) === dragIndex);
    if (isDragging) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,0.3)';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
      ctx.restore();
    }

    // Line to element
    const mx = (sx1 + sx2) / 2;
    const my = (sy1 + sy2) / 2;

    if (el.type === 'battery') {
      ctx.save();
      ctx.shadowColor = 'rgba(251,191,36,0.4)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(mx, my); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(sx2, sy2); ctx.stroke();

      // Battery symbol
      const angle = Math.atan2(sy2 - sy1, sx2 - sx1);
      const perpX = -Math.sin(angle), perpY = Math.cos(angle);
      ctx.lineWidth = 3;
      // Long plate (+)
      ctx.beginPath();
      ctx.moveTo(mx - 5 + perpX * 12, my - 5 + perpY * 12);
      ctx.lineTo(mx - 5 - perpX * 12, my - 5 - perpY * 12);
      ctx.stroke();
      // Short plate (-)
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mx + 5 + perpX * 7, my + 5 + perpY * 7);
      ctx.lineTo(mx + 5 - perpX * 7, my + 5 - perpY * 7);
      ctx.stroke();
      ctx.restore();
    } else {
      // Resistor zigzag
      const rColor = el.type === 'slider' ? '#c084fc' : '#60a5fa';
      ctx.save();
      ctx.shadowColor = rColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = rColor;
      ctx.lineWidth = 2;
      const dx = sx2 - sx1, dy = sy2 - sy1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux; // perpendicular
      const zigStart = 0.3, zigEnd = 0.7;
      const numZig = 6;
      const amp = 8;

      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx1 + ux * len * zigStart, sy1 + uy * len * zigStart);
      for (let i = 0; i <= numZig; i++) {
        const frac = zigStart + (zigEnd - zigStart) * (i / numZig);
        const side = (i % 2 === 0 ? 1 : -1) * amp;
        ctx.lineTo(sx1 + ux * len * frac + px * side, sy1 + uy * len * frac + py * side);
      }
      ctx.lineTo(sx1 + ux * len * zigEnd, sy1 + uy * len * zigEnd);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      ctx.restore();

      // Slider arrow for slider type
      if (el.type === 'slider') {
        const sliderPct = panel.getValue<number>('sliderPos') / 100;
        const spos = zigStart + (zigEnd - zigStart) * sliderPct;
        const arrowX = sx1 + ux * len * spos;
        const arrowY = sy1 + uy * len * spos;
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(arrowX, arrowY - 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 7);
        ctx.lineTo(arrowX, arrowY + 3);
        ctx.stroke();
      }
    }

    // Label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const lx = mx + (el.type === 'battery' ? 25 : 0);
    const ly = my - 15;
    ctx.fillText(el.label, lx, ly);

    // Current value
    if (el.current !== 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`I=${Math.abs(el.current).toFixed(3)}A`, lx, ly + 30);
    }
  }

  // Current flow animation dots
  ctx.fillStyle = 'rgba(251,191,36,0.8)';
  animTime += 1 / 60;
  for (const el of elements) {
    if (el.type === 'wire' || Math.abs(el.current) < 0.001) continue;
    const sx1 = ox + el.x1 * scale;
    const sy1 = oy + el.y1 * scale;
    const sx2 = ox + el.x2 * scale;
    const sy2 = oy + el.y2 * scale;
    const numDots = 3;
    for (let d = 0; d < numDots; d++) {
      const frac = ((animTime * Math.abs(el.current) * 2 + d / numDots) % 1);
      const dx = sx1 + (sx2 - sx1) * frac;
      const dy = sy1 + (sy2 - sy1) * frac;
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw connection nodes at element endpoints
  const drawnNodes = new Set<string>();
  for (const el of elements) {
    if (el.type === 'wire') continue;
    for (const [px, py] of [[el.x1, el.y1], [el.x2, el.y2]]) {
      const key = `${Math.round(px*10)},${Math.round(py*10)}`;
      if (drawnNodes.has(key)) continue;
      drawnNodes.add(key);
      drawNode(ctx, ox + px * scale, oy + py * scale);
    }
  }

  // Info panel
  let info = `<b>${template}</b><br>`;
  for (const el of elements) {
    if (el.type === 'wire') continue;
    if (el.type === 'battery') {
      info += `${el.label}: I = ${Math.abs(el.current).toFixed(3)} A<br>`;
    } else {
      const V = Math.abs(el.current * el.value);
      info += `${el.label}: I = ${Math.abs(el.current).toFixed(3)} A, U = ${V.toFixed(2)} V, P = ${(V * Math.abs(el.current)).toFixed(3)} W<br>`;
    }
  }

  // Total circuit info
  const battery = elements.find(e => e.type === 'battery');
  if (battery) {
    const totalI = Math.abs(battery.current);
    const totalP = panel.getValue<number>('EMF') * totalI;
    info += `<br>总电流 I = ${totalI.toFixed(3)} A<br>`;
    info += `总功率 P = ${totalP.toFixed(2)} W<br>`;
  }

  infoDiv.innerHTML = info;
}

panel.setOnChange(() => {
  needsResolve = true;
  // Reset EMF data when switching templates or changing EMF/r
  const template = panel.getValue<string>('template');
  if (template !== '测电源EMF和内阻') {
    emfDataPoints = [];
    lastEmfRext = -1;
  }
  render();
});
render();

// Animate current dots
function animate() {
  render();
  requestAnimationFrame(animate);
}
animate();

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
