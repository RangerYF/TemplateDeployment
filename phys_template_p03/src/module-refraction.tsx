// Module 1: Refraction & Total Internal Reflection — rebuilt around a single source + single medium object.
const React = (window as any).React;

interface Material { n: number; label: string; nLabel: string; }
type MaterialKey = 'air' | 'water' | 'glass' | 'crown' | 'flint' | 'diamond' | 'ice' | 'fiber';
type ShapeKind = 'interface' | 'slab' | 'half' | 'fiber' | 'apparent' | 'snellwindow';
type RefractionExperimentId = 'opt-001' | 'opt-002' | 'opt-003' | 'opt-004' | 'opt-005' | 'opt-006';
type HemisphereMode = 'center' | 'plane';
type DragTarget = 'source' | 'element' | 'pan' | null;

interface RefractionSettings {
  experimentId: RefractionExperimentId;
  shape: ShapeKind;
  material: MaterialKey;
  wavelength: number;
  sourceAnchorX: number;
  sourceY?: number;
  sourceAngleDeg?: number;
  elementCenterX: number;
  elementCenterY?: number;
  canvasPanX?: number;
  canvasPanY?: number;
  canvasZoom?: number;
  medium1N: number;
  medium2N: number;
  slabIndex: number;
  slabThicknessCm: number;
  hemisphereIndex: number;
  hemisphereRadiusCm: number;
  hemisphereMode: HemisphereMode;
  fiberCoreN: number;
  fiberCladdingN: number;
  fiberBendRadiusCm: number;
  apparentMode: 'depth' | 'height';
  apparentObjectDepthCm: number;
  apparentWaterN: number;
  apparentRayAngleDeg: number;
  snellSourceDepthCm: number;
  snellWaterN: number;
  snellIncidentAngleDeg: number;
  snellViewMode: '3d' | '2d' | 'topview';
  showAngles: boolean;
  showNormals: boolean;
  showFormula: boolean;
  showColor: boolean;
  rayThick: number;
}

interface Point { x: number; y: number; }
interface RaySegment { from: Point; to: Point; kind: 'incident' | 'refracted' | 'reflected' | 'exit' | 'leak' | 'virtual'; }
interface AngleMark { at: Point; normalAngleDeg: number; rayAngleDeg: number; label: string; radius: number; side?: 'left' | 'right'; }

interface SolveResult {
  segments: RaySegment[];
  angleMarks: AngleMark[];
  normals: [Point, Point][];
  hitPoint?: Point;
  status: string;
  pathMode: string;
  firstEdge?: BoundaryHit['edge'] | 'interface' | null;
  lastEdge?: BoundaryHit['edge'] | 'interface' | null;
  criticalDeg?: number | null;
  incidentDeg?: number | null;
  refractedDeg?: number | null;
  reflectedDeg?: number | null;
  exitDeg?: number | null;
  shiftCm?: number | null;
  coreDeg?: number | null;
  effectiveWallDeg?: number | null;
  apparentDepthCm?: number | null;
  realDepthCm?: number | null;
  virtualImagePoint?: Point;
  objectPoint?: Point;
}

interface BoundaryHit {
  point: Point;
  normal: Point;
  edge: 'top' | 'bottom' | 'left' | 'right' | 'arc';
  distance: number;
}

interface ShapeOption {
  id: ShapeKind;
  label: string;
  desc: string;
  experimentId: RefractionExperimentId;
}

const MATERIALS: Record<string, Material> = ((window as any).P03_REFRACTION_MATERIAL_REFERENCES || []).reduce(
  (acc: Record<string, Material>, item: { key: string; label: string; n: number }) => {
    acc[item.key] = { n: item.n, label: item.label, nLabel: `n = ${item.n.toFixed(3)}` };
    return acc;
  },
  {
    air: { n: 1.0, label: '真空 / 空气', nLabel: 'n = 1.000' },
    water: { n: 1.333, label: '水', nLabel: 'n = 1.333' },
    glass: { n: 1.5, label: '普通玻璃', nLabel: 'n = 1.500' },
    crown: { n: 1.52, label: '冕牌玻璃', nLabel: 'n = 1.520' },
    flint: { n: 1.65, label: '火石玻璃', nLabel: 'n = 1.650' },
    diamond: { n: 2.417, label: '金刚石', nLabel: 'n = 2.417' },
    ice: { n: 1.309, label: '冰', nLabel: 'n = 1.309' },
    fiber: { n: 1.5, label: '光纤纤芯', nLabel: 'n = 1.500' },
  }
);

const SHAPES: ShapeOption[] = [
  { id: 'interface', label: '单平面界面', desc: '单次界面折射、反射、临界角、全反射', experimentId: 'opt-001' },
  { id: 'slab', label: '玻璃砖', desc: '双界面折射、平行出射、侧移', experimentId: 'opt-002' },
  { id: 'half', label: '半球介质', desc: '平面入射 / 球心入射 / 曲面法线', experimentId: 'opt-003' },
  { id: 'fiber', label: '光纤', desc: '导光、弯曲、漏光趋势', experimentId: 'opt-004' },
  { id: 'apparent', label: '视深与视高', desc: '水中看浅、水下看高、虚像位置', experimentId: 'opt-005' },
  { id: 'snellwindow', label: '水下光源 3D', desc: '斯涅尔窗、临界角锥、全反射 (Three.js)', experimentId: 'opt-006' },
];

const BASE_SHAPE_PRESETS: Record<ShapeKind, Partial<RefractionSettings>> = {
  interface: { experimentId: 'opt-001', shape: 'interface', sourceAnchorX: 180, sourceY: 86, sourceAngleDeg: 56, elementCenterX: 500, elementCenterY: 250, medium1N: 1.0, medium2N: 1.5 },
  slab: { experimentId: 'opt-002', shape: 'slab', sourceAnchorX: 170, sourceY: 88, sourceAngleDeg: 56, elementCenterX: 500, elementCenterY: 248, slabIndex: 1.5, slabThicknessCm: 6 },
  half: { experimentId: 'opt-003', shape: 'half', sourceAnchorX: 180, sourceY: 92, sourceAngleDeg: 62, elementCenterX: 520, elementCenterY: 266, hemisphereIndex: 1.5, hemisphereRadiusCm: 6, hemisphereMode: 'plane' },
  fiber: { experimentId: 'opt-004', shape: 'fiber', sourceAnchorX: 130, sourceY: 270, sourceAngleDeg: 8, elementCenterX: 560, elementCenterY: 290, fiberCoreN: 1.5, fiberCladdingN: 1.3, fiberBendRadiusCm: 14 },
  apparent: { experimentId: 'opt-005', shape: 'apparent', sourceAnchorX: 500, sourceY: 90, sourceAngleDeg: -90, elementCenterX: 500, elementCenterY: 260, apparentMode: 'depth' as const, apparentObjectDepthCm: 5, apparentWaterN: 1.333, apparentRayAngleDeg: 20, rayThick: 1.2 },
  snellwindow: { experimentId: 'opt-006', shape: 'snellwindow', sourceAnchorX: 500, sourceY: 90, elementCenterX: 500, elementCenterY: 260, snellSourceDepthCm: 8, snellWaterN: 1.333, snellIncidentAngleDeg: 30, snellViewMode: '3d' as const },
};

const deg = (r: number): number => r * 180 / Math.PI;
const rad = (d: number): number => d * Math.PI / 180;
const fmt = (v: number | null | undefined, digits: number = 2): string => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
function sub(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
function mul(a: Point, s: number): Point { return { x: a.x * s, y: a.y * s }; }
function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y; }
function len(a: Point): number { return Math.hypot(a.x, a.y); }
function norm(a: Point): Point {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
function pointFromAngle(angleDeg: number): Point {
  const a = rad(angleDeg);
  return { x: Math.cos(a), y: Math.sin(a) };
}
function angleFromVector(v: Point): number {
  return deg(Math.atan2(v.y, v.x));
}
function angleAgainstNormal(dir: Point, normal: Point): number {
  return deg(Math.acos(clamp(Math.abs(dot(norm(dir), norm(normal))), -1, 1)));
}
function reflect(dir: Point, normal: Point): Point {
  const oriented = dot(dir, normal) > 0 ? mul(normal, -1) : normal;
  return norm(sub(dir, mul(oriented, 2 * dot(dir, oriented))));
}
function refract(dir: Point, normal: Point, n1: number, n2: number): { dir: Point | null; tir: boolean } {
  let n = dot(dir, normal) > 0 ? mul(normal, -1) : normal;
  const cosI = -dot(n, dir);
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return { dir: null, tir: true };
  return { dir: norm(add(mul(dir, eta), mul(n, eta * cosI - Math.sqrt(k)))), tir: false };
}
function extendRay(start: Point, dir: Point, length: number = 1400): RaySegment {
  return { from: start, to: add(start, mul(norm(dir), length)), kind: 'incident' };
}

function intersectRayHorizontal(start: Point, dir: Point, y: number, xMin: number, xMax: number): Point | null {
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (y - start.y) / dir.y;
  if (t <= 1e-6) return null;
  const x = start.x + dir.x * t;
  return x >= xMin && x <= xMax ? { x, y } : null;
}
function intersectRayVertical(start: Point, dir: Point, x: number, yMin: number, yMax: number): Point | null {
  if (Math.abs(dir.x) < 1e-6) return null;
  const t = (x - start.x) / dir.x;
  if (t <= 1e-6) return null;
  const y = start.y + dir.y * t;
  return y >= yMin && y <= yMax ? { x, y } : null;
}
function intersectRayCircle(start: Point, dir: Point, center: Point, radius: number, predicate?: (p: Point) => boolean): Point | null {
  const d = norm(dir);
  const f = sub(start, center);
  const a = dot(d, d);
  const b = 2 * dot(f, d);
  const c = dot(f, f) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].filter((t) => t > 1e-6).sort((m, n) => m - n);
  for (const t of roots) {
    const p = add(start, mul(d, t));
    if (!predicate || predicate(p)) return p;
  }
  return null;
}

function pointInRect(point: Point, left: number, right: number, top: number, bottom: number): boolean {
  return point.x > left && point.x < right && point.y > top && point.y < bottom;
}

function pointInHalfDisk(point: Point, center: Point, radius: number): boolean {
  return point.y >= center.y && len(sub(point, center)) < radius;
}

function uniqueBoundaryHits(hits: BoundaryHit[]): BoundaryHit[] {
  const out: BoundaryHit[] = [];
  hits.forEach((hit) => {
    const exists = out.some((item) => len(sub(item.point, hit.point)) < 0.8);
    if (!exists) out.push(hit);
  });
  return out.sort((a, b) => a.distance - b.distance);
}

function intersectRayRectBoundary(start: Point, dir: Point, left: number, right: number, top: number, bottom: number): BoundaryHit | null {
  const begin = add(start, mul(norm(dir), 0.001));
  const candidates: BoundaryHit[] = [];
  const topHit = intersectRayHorizontal(begin, dir, top, left, right);
  if (topHit) candidates.push({ point: topHit, normal: { x: 0, y: -1 }, edge: 'top', distance: len(sub(topHit, start)) });
  const bottomHit = intersectRayHorizontal(begin, dir, bottom, left, right);
  if (bottomHit) candidates.push({ point: bottomHit, normal: { x: 0, y: 1 }, edge: 'bottom', distance: len(sub(bottomHit, start)) });
  const leftHit = intersectRayVertical(begin, dir, left, top, bottom);
  if (leftHit) candidates.push({ point: leftHit, normal: { x: -1, y: 0 }, edge: 'left', distance: len(sub(leftHit, start)) });
  const rightHit = intersectRayVertical(begin, dir, right, top, bottom);
  if (rightHit) candidates.push({ point: rightHit, normal: { x: 1, y: 0 }, edge: 'right', distance: len(sub(rightHit, start)) });
  const deduped = uniqueBoundaryHits(candidates);
  return deduped[0] || null;
}

function intersectRayHalfBoundary(start: Point, dir: Point, center: Point, radius: number): BoundaryHit | null {
  const begin = add(start, mul(norm(dir), 0.001));
  const candidates: BoundaryHit[] = [];
  const flat = intersectRayHorizontal(begin, dir, center.y, center.x - radius, center.x + radius);
  if (flat) candidates.push({ point: flat, normal: { x: 0, y: -1 }, edge: 'top', distance: len(sub(flat, start)) });
  const arc = intersectRayCircle(begin, dir, center, radius, (p) => p.y >= center.y - 0.5);
  if (arc) candidates.push({ point: arc, normal: norm(sub(arc, center)), edge: 'arc', distance: len(sub(arc, start)) });
  const deduped = uniqueBoundaryHits(candidates);
  return deduped[0] || null;
}

function makeArcMark(at: Point, normal: Point, rayDir: Point, label: string, radius: number): AngleMark {
  const n = dot(rayDir, normal) >= 0 ? normal : mul(normal, -1);
  return {
    at,
    normalAngleDeg: angleFromVector(n),
    rayAngleDeg: angleFromVector(rayDir),
    label,
    radius,
  };
}

function edgeLabel(edge: SolveResult['firstEdge']): string {
  if (edge === 'interface') return '单界面';
  if (edge === 'top') return '上边界';
  if (edge === 'bottom') return '下边界';
  if (edge === 'left') return '左边界';
  if (edge === 'right') return '右边界';
  if (edge === 'arc') return '曲面';
  return '—';
}

function buildRefractionFormulaNotes(settings: RefractionSettings, result: SolveResult): string[] {
  if (settings.shape === 'interface') {
    if (result.pathMode === '单界面全反射') {
      return [
        '当前路径：主光线先命中单界面，并在该界面发生全反射。',
        '判定条件：入射介质折射率更大，且当前入射角超过临界角。',
        `临界角关系：sin θc = n₂ / n₁ = ${settings.medium2N.toFixed(3)} / ${settings.medium1N.toFixed(3)}`,
      ];
    }
    return [
      '当前路径：主光线命中单界面后，一次折射进入另一介质。',
      '界面只有一条，因此不会像玻璃砖那样出现二次边界作用。',
      `斯涅尔定律：${settings.medium1N.toFixed(3)} × sin θ₁ = ${settings.medium2N.toFixed(3)} × sin θ₂`,
    ];
  }

  if (settings.shape === 'slab') {
    if (result.pathMode.includes('全反射')) {
      return [
        `当前路径：主光线先命中 ${edgeLabel(result.firstEdge)}，进入玻璃砖后在 ${edgeLabel(result.lastEdge)} 发生全反射。`,
        '因为玻璃砖是双界面对象，边界全反射后系统会继续追迹下一次命中的边界。',
        `临界角关系：sin θc = 1 / n = 1 / ${settings.slabIndex.toFixed(3)}`,
      ];
    }
    if (result.pathMode.includes('射出')) {
      return [
        `当前路径：主光线先命中 ${edgeLabel(result.firstEdge)}，折射进入玻璃砖，再从 ${edgeLabel(result.lastEdge)} 射出。`,
        '玻璃砖的核心不是只算一次边界，而是按真实命中的边界顺序连续求交。',
        result.shiftCm != null ? `侧移近似：Δ = ${fmt(result.shiftCm, 2)} cm` : '侧移公式：Δ = d sin(θ₁ - θ₂) / cos θ₂',
      ];
    }
    return [
      '当前路径：主光线尚未稳定形成“进入 + 射出”的完整玻璃砖路径。',
      '系统会继续根据当前命中的边界重新计算后续传播。',
      '若想形成标准玻璃砖演示，可让光线先命中上表面。',
    ];
  }

  if (settings.shape === 'half') {
    if (settings.hemisphereMode === 'center') {
      return [
        '当前模式：球心入射。',
        '教学含义：经过球心到达曲面时，半径方向就是法线，因此曲面处入射角为 0°。',
        '这个模式更偏教学专用展示，不是一般入射的通用情况。',
      ];
    }
    if (result.pathMode.includes('全反射')) {
      return [
        `当前路径：主光线先命中 ${edgeLabel(result.firstEdge)}，进入半球后在 ${edgeLabel(result.lastEdge)} 发生全反射。`,
        '半球会同时判断平面和曲面谁先被射线命中，再按该边界法线计算。',
        `曲面临界角：sin θc = 1 / n = 1 / ${settings.hemisphereIndex.toFixed(3)}`,
      ];
    }
    if (result.pathMode.includes('射出')) {
      return [
        `当前路径：主光线先命中 ${edgeLabel(result.firstEdge)}，再从 ${edgeLabel(result.lastEdge)} 射出半球。`,
        '半球与玻璃砖不同之处在于曲面法线取决于交点到球心的半径方向。',
        '因此曲面出射时，入射角和出射角都要按局部法线重新计算。',
      ];
    }
    return [
      '当前路径：半球对象正在根据实时命中的边界继续追迹。',
      '它不是只固定“先过平面”，而是允许先命中平面或曲面。',
      '若想复现标准教材情形，可让光线先打到上方平面。',
    ];
  }

  if (settings.shape === 'fiber') {
    if (result.pathMode.includes('漏光')) {
      return [
        '当前路径：主光线进入纤芯后，在壁面处不再满足全反射条件，因此出现漏光。',
        `临界角关系：sin θc = n₂ / n₁ = ${settings.fiberCladdingN.toFixed(3)} / ${settings.fiberCoreN.toFixed(3)}`,
        '当壁面入射角减小到临界角以下，光线将不再稳定导光。',
      ];
    }
    return [
      '当前路径：主光线先进入纤芯，再与上下壁面持续相互作用。',
      `导光条件：n₁ > n₂，即 ${settings.fiberCoreN.toFixed(3)} > ${settings.fiberCladdingN.toFixed(3)}`,
      '只要壁面处持续满足全反射条件，光就可以沿光纤传播。',
    ];
  }

  if (settings.shape === 'apparent') {
    const mode = settings.apparentMode ?? 'depth';
    if (mode === 'depth') {
      return [
        '当前模式：视深 — 从空气俯视水中物体。',
        '近轴近似：虚像深度 h\' = h / n（浅于实物）。',
        `水的折射率 n = ${(settings.apparentWaterN ?? 1.333).toFixed(3)}`,
      ];
    }
    return [
      '当前模式：视高 — 从水中仰视空气中物体。',
      '近轴近似：虚像高度 h\' = h × n（高于实物）。',
      `水的折射率 n = ${(settings.apparentWaterN ?? 1.333).toFixed(3)}`,
    ];
  }

  if (settings.shape === 'snellwindow') {
    const nW = settings.snellWaterN ?? 1.333;
    const critAngle = deg(Math.asin(Math.min(1, 1 / nW)));
    const depth = settings.snellSourceDepthCm ?? 8;
    const windowR = depth * Math.tan(rad(critAngle));
    return [
      `水下光源深度 h = ${depth.toFixed(1)} cm，水折射率 n = ${nW.toFixed(3)}。`,
      `临界角 θc = arcsin(1/n) = ${critAngle.toFixed(2)}°`,
      `斯涅尔窗半径 r = h × tan(θc) = ${windowR.toFixed(2)} cm`,
      '临界角锥内的光线折射出水面，锥外全部全反射回水中。',
    ];
  }

  return ['当前路径暂无专门公式说明。'];
}

function solveInterface(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 56));
  const lineY = settings.elementCenterY ?? 260;
  const mediumLeft = (settings.elementCenterX ?? 500) - 360;
  const mediumRight = (settings.elementCenterX ?? 500) + 360;
  const hit = intersectRayHorizontal(source, dir, lineY, mediumLeft, mediumRight);
  if (!hit) {
    return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '射线未命中介质', pathMode: '未命中', firstEdge: null, lastEdge: null, criticalDeg: settings.medium1N > settings.medium2N ? deg(Math.asin(settings.medium2N / settings.medium1N)) : null };
  }

  const sourceAbove = source.y < lineY;
  const normal = sourceAbove ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const nIn = sourceAbove ? settings.medium1N : settings.medium2N;
  const nOut = sourceAbove ? settings.medium2N : settings.medium1N;
  const refr = refract(dir, normal, nIn, nOut);
  const reflected = reflect(dir, normal);
  const criticalDeg = nIn > nOut ? deg(Math.asin(clamp(nOut / nIn, 0, 1))) : null;
  const marks: AngleMark[] = [
    makeArcMark(hit, normal, mul(dir, -1), `${fmt(angleAgainstNormal(dir, normal), 1)}°`, 28),
    makeArcMark(hit, normal, reflected, `${fmt(angleAgainstNormal(reflected, normal), 1)}°`, 44),
  ];
  const segments: RaySegment[] = [{ from: source, to: hit, kind: 'incident' }];

  if (refr.tir || !refr.dir) {
    segments.push({ from: hit, to: add(hit, mul(reflected, 1400)), kind: 'reflected' });
    return {
      segments,
      angleMarks: marks,
      normals: [[add(hit, { x: 0, y: -130 }), add(hit, { x: 0, y: 130 })]],
      hitPoint: hit,
      status: '发生全反射',
      pathMode: '单界面全反射',
      firstEdge: 'interface',
      lastEdge: 'interface',
      criticalDeg,
      incidentDeg: angleAgainstNormal(dir, normal),
      reflectedDeg: angleAgainstNormal(reflected, normal),
      refractedDeg: null,
    };
  }

  marks.push(makeArcMark(hit, mul(normal, -1), refr.dir, `${fmt(angleAgainstNormal(refr.dir, normal), 1)}°`, 36));
  segments.push({ from: hit, to: add(hit, mul(refr.dir, 1400)), kind: 'refracted' });
  segments.push({ from: hit, to: add(hit, mul(reflected, 520)), kind: 'reflected' });
  return {
    segments,
    angleMarks: marks,
    normals: [[add(hit, { x: 0, y: -130 }), add(hit, { x: 0, y: 130 })]],
    hitPoint: hit,
    status: '折射成立',
    pathMode: '单界面折射',
    firstEdge: 'interface',
    lastEdge: 'interface',
    criticalDeg,
    incidentDeg: angleAgainstNormal(dir, normal),
    reflectedDeg: angleAgainstNormal(reflected, normal),
    refractedDeg: angleAgainstNormal(refr.dir, mul(normal, -1)),
  };
}

function solveSlab(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 56));
  const centerX = settings.elementCenterX ?? 500;
  const topY = settings.elementCenterY ?? 250;
  const width = 520;
  const height = settings.slabThicknessCm * 20;
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const bottomY = topY + height;
  const sourceInside = pointInRect(source, left, right, topY, bottomY);
  let currentPos = source;
  let currentDir = dir;
  let inside = sourceInside;
  let currentKind: RaySegment['kind'] = inside ? 'refracted' : 'incident';
  const segments: RaySegment[] = [];
  const angleMarks: AngleMark[] = [];
  const normals: [Point, Point][] = [];
  let guard = 8;
  let status = '射线未命中玻璃砖';
  let firstIncidentDeg: number | null = null;
  let firstRefractedDeg: number | null = null;
  let lastExitDeg: number | null = null;
  let lastReflectedDeg: number | null = null;
  let firstEdge: BoundaryHit['edge'] | null = null;
  let lastEdge: BoundaryHit['edge'] | null = null;

  while (guard-- > 0) {
    const hit = intersectRayRectBoundary(currentPos, currentDir, left, right, topY, bottomY);
    if (!hit) {
      if (segments.length === 0) {
        return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '射线未命中玻璃砖', pathMode: '未命中', firstEdge: null, lastEdge: null, shiftCm: null };
      }
      segments.push({ from: currentPos, to: add(currentPos, mul(currentDir, 1400)), kind: currentKind });
      break;
    }

    segments.push({ from: currentPos, to: hit.point, kind: currentKind });
    normals.push([hit.point, add(hit.point, mul(hit.normal, 120))]);

    const n1 = inside ? settings.slabIndex : 1;
    const n2 = inside ? 1 : settings.slabIndex;
    const incidentDeg = angleAgainstNormal(currentDir, hit.normal);
    if (firstIncidentDeg === null) firstIncidentDeg = incidentDeg;
    if (firstEdge === null) firstEdge = hit.edge;
    lastEdge = hit.edge;
    angleMarks.push(makeArcMark(hit.point, hit.normal, mul(currentDir, -1), `${fmt(incidentDeg, 1)}°`, 24));

    const next = refract(currentDir, hit.normal, n1, n2);
    if (next.tir || !next.dir) {
      const reflected = reflect(currentDir, hit.normal);
      lastReflectedDeg = angleAgainstNormal(reflected, hit.normal);
      angleMarks.push(makeArcMark(hit.point, hit.normal, reflected, `${fmt(lastReflectedDeg, 1)}°`, 40));
      currentPos = hit.point;
      currentDir = reflected;
      inside = true;
      currentKind = 'reflected';
      status = '边界全反射';
      continue;
    }

    const outgoingDeg = angleAgainstNormal(next.dir, mul(hit.normal, -1));
    angleMarks.push(makeArcMark(hit.point, mul(hit.normal, -1), next.dir, `${fmt(outgoingDeg, 1)}°`, 34));
    const after = add(hit.point, mul(next.dir, 2));
    const nextInside = pointInRect(after, left, right, topY, bottomY);

    if (!inside && nextInside) {
      firstRefractedDeg = outgoingDeg;
      currentPos = hit.point;
      currentDir = next.dir;
      inside = true;
      currentKind = 'refracted';
      status = '进入玻璃砖';
      continue;
    }

    if (inside && !nextInside) {
      lastExitDeg = outgoingDeg;
      segments.push({ from: hit.point, to: add(hit.point, mul(next.dir, 1400)), kind: 'exit' });
      status = '射出玻璃砖';
      break;
    }

    currentPos = hit.point;
    currentDir = next.dir;
    inside = nextInside;
    currentKind = nextInside ? 'refracted' : 'exit';
    status = nextInside ? '继续在玻璃砖内传播' : '射出玻璃砖';
  }

  const shiftCm = firstIncidentDeg !== null && firstRefractedDeg !== null
    ? settings.slabThicknessCm * Math.sin(rad(firstIncidentDeg) - rad(firstRefractedDeg)) / Math.max(0.02, Math.cos(rad(firstRefractedDeg)))
    : null;

  return {
    segments,
    angleMarks,
    normals,
    status,
    pathMode: status.includes('全反射') ? '多边界追迹 / 全反射' : status.includes('射出') ? '进入介质后再次射出' : status,
    firstEdge,
    lastEdge,
    incidentDeg: firstIncidentDeg,
    refractedDeg: firstRefractedDeg,
    reflectedDeg: lastReflectedDeg,
    exitDeg: lastExitDeg,
    shiftCm,
    criticalDeg: deg(Math.asin(1 / settings.slabIndex)),
  };
}

function solveHemisphere(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 60));
  const center: Point = { x: settings.elementCenterX ?? 520, y: settings.elementCenterY ?? 270 };
  const R = settings.hemisphereRadiusCm * 24;

  if (settings.hemisphereMode === 'center') {
    const target = center;
    const insideDir = norm(sub(target, source));
    const exit = intersectRayCircle(target, insideDir, center, R, (p) => p.y >= center.y - 0.5);
    if (!exit) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '未命中半球' };
    const out = add(exit, mul(insideDir, 1400));
    return {
      segments: [{ from: source, to: target, kind: 'incident' }, { from: target, to: exit, kind: 'refracted' }, { from: exit, to: out, kind: 'exit' }],
      angleMarks: [makeArcMark(exit, norm(sub(exit, center)), mul(insideDir, -1), '0.0°', 26)],
      normals: [[center, exit]],
      hitPoint: exit,
      status: '球心入射，曲面处垂直出射',
      pathMode: '球心入射专用模式',
      firstEdge: 'arc',
      lastEdge: 'arc',
      incidentDeg: 0,
      refractedDeg: 0,
    };
  }

  const sourceInside = pointInHalfDisk(source, center, R);
  let currentPos = source;
  let currentDir = dir;
  let inside = sourceInside;
  let currentKind: RaySegment['kind'] = inside ? 'refracted' : 'incident';
  const segments: RaySegment[] = [];
  const angleMarks: AngleMark[] = [];
  const normals: [Point, Point][] = [];
  let guard = 10;
  let status = '射线未命中半球';
  let firstIncidentDeg: number | null = null;
  let firstRefractedDeg: number | null = null;
  let lastExitDeg: number | null = null;
  let lastReflectedDeg: number | null = null;
  let lastHitPoint: Point | undefined;
  let firstEdge: BoundaryHit['edge'] | null = null;
  let lastEdge: BoundaryHit['edge'] | null = null;

  while (guard-- > 0) {
    const hit = intersectRayHalfBoundary(currentPos, currentDir, center, R);
    if (!hit) {
      if (segments.length === 0) {
        return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '射线未命中半球', pathMode: '未命中', firstEdge: null, lastEdge: null };
      }
      segments.push({ from: currentPos, to: add(currentPos, mul(currentDir, 1400)), kind: currentKind });
      break;
    }

    segments.push({ from: currentPos, to: hit.point, kind: currentKind });
    normals.push([hit.point, add(hit.point, mul(hit.normal, hit.edge === 'arc' ? 100 : 120))]);
    lastHitPoint = hit.point;

    const n1 = inside ? settings.hemisphereIndex : 1;
    const n2 = inside ? 1 : settings.hemisphereIndex;
    const incidentDeg = angleAgainstNormal(currentDir, hit.normal);
    if (firstIncidentDeg === null) firstIncidentDeg = incidentDeg;
    if (firstEdge === null) firstEdge = hit.edge;
    lastEdge = hit.edge;
    angleMarks.push(makeArcMark(hit.point, hit.normal, mul(currentDir, -1), `${fmt(incidentDeg, 1)}°`, 24));

    const next = refract(currentDir, hit.normal, n1, n2);
    if (next.tir || !next.dir) {
      const reflected = reflect(currentDir, hit.normal);
      lastReflectedDeg = angleAgainstNormal(reflected, hit.normal);
      angleMarks.push(makeArcMark(hit.point, hit.normal, reflected, `${fmt(lastReflectedDeg, 1)}°`, 40));
      currentPos = hit.point;
      currentDir = reflected;
      inside = true;
      currentKind = 'reflected';
      status = '边界全反射';
      continue;
    }

    const outgoingDeg = angleAgainstNormal(next.dir, mul(hit.normal, -1));
    angleMarks.push(makeArcMark(hit.point, mul(hit.normal, -1), next.dir, `${fmt(outgoingDeg, 1)}°`, 34));
    const after = add(hit.point, mul(next.dir, 2));
    const nextInside = pointInHalfDisk(after, center, R);

    if (!inside && nextInside) {
      firstRefractedDeg = outgoingDeg;
      currentPos = hit.point;
      currentDir = next.dir;
      inside = true;
      currentKind = 'refracted';
      status = '进入半球';
      continue;
    }

    if (inside && !nextInside) {
      lastExitDeg = outgoingDeg;
      segments.push({ from: hit.point, to: add(hit.point, mul(next.dir, 1400)), kind: 'exit' });
      status = '射出半球';
      break;
    }

    currentPos = hit.point;
    currentDir = next.dir;
    inside = nextInside;
    currentKind = nextInside ? 'refracted' : 'exit';
    status = nextInside ? '继续在半球内传播' : '射出半球';
  }

  return {
    segments,
    angleMarks,
    normals,
    hitPoint: lastHitPoint,
    status,
    pathMode: status.includes('全反射') ? '多边界追迹 / 全反射' : status.includes('射出') ? '进入半球后再次射出' : status,
    firstEdge,
    lastEdge,
    criticalDeg: deg(Math.asin(1 / settings.hemisphereIndex)),
    incidentDeg: firstIncidentDeg,
    refractedDeg: firstRefractedDeg,
    exitDeg: lastExitDeg,
    reflectedDeg: lastReflectedDeg,
  };
}

function solveFiber(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 8));
  const center: Point = { x: settings.elementCenterX ?? 560, y: settings.elementCenterY ?? 290 };
  const left = center.x - 260;
  const right = center.x + 260;
  const top = center.y - 18;
  const bottom = center.y + 18;

  const enter = intersectRayVertical(source, dir, left, top, bottom);
  if (!enter) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '射线未命中光纤入口', pathMode: '未命中', firstEdge: null, lastEdge: null };

  const refrIn = refract(dir, { x: -1, y: 0 }, 1, settings.fiberCoreN);
  if (!refrIn.dir) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '入口未形成有效入射', pathMode: '未进入纤芯', firstEdge: 'left', lastEdge: 'left' };

  const segments: RaySegment[] = [{ from: source, to: enter, kind: 'incident' }];
  const angleMarks: AngleMark[] = [makeArcMark(enter, { x: -1, y: 0 }, mul(dir, -1), `${fmt(angleAgainstNormal(dir, { x: -1, y: 0 }), 1)}°`, 24)];
  const normals: [Point, Point][] = [[add(enter, { x: -100, y: 0 }), add(enter, { x: 100, y: 0 })]];

  let pos = enter;
  let insideDir = refrIn.dir;
  let guard = 18;
  const criticalDeg = deg(Math.asin(clamp(settings.fiberCladdingN / settings.fiberCoreN, 0, 1)));
  let effectiveWallDeg: number | null = null;

  while (guard-- > 0) {
    const hitTop = intersectRayHorizontal(pos, insideDir, top, left, right);
    const hitBottom = intersectRayHorizontal(pos, insideDir, bottom, left, right);
    const hitRight = intersectRayVertical(pos, insideDir, right, top, bottom);
    const candidates = [hitTop, hitBottom, hitRight]
      .filter(Boolean)
      .map((p) => ({ p: p as Point, t: len(sub(p as Point, pos)) }))
      .sort((a, b) => a.t - b.t);
    if (candidates.length === 0) {
      segments.push({ from: pos, to: add(pos, mul(insideDir, 1400)), kind: 'refracted' });
      break;
    }
    const hit = candidates[0].p;
    if (Math.abs(hit.x - right) < 0.5) {
      segments.push({ from: pos, to: hit, kind: 'refracted' });
      segments.push({ from: hit, to: add(hit, mul(insideDir, 1400)), kind: 'exit' });
      break;
    }
    const wallNormal = Math.abs(hit.y - top) < 0.5 ? { x: 0, y: -1 } : { x: 0, y: 1 };
    effectiveWallDeg = angleAgainstNormal(insideDir, wallNormal);
    segments.push({ from: pos, to: hit, kind: 'refracted' });
    if (effectiveWallDeg <= criticalDeg) {
      const leakDir = refract(insideDir, wallNormal, settings.fiberCoreN, settings.fiberCladdingN).dir || reflect(insideDir, wallNormal);
      segments.push({ from: hit, to: add(hit, mul(leakDir, 1200)), kind: 'leak' });
      angleMarks.push(makeArcMark(hit, wallNormal, mul(insideDir, -1), `${fmt(angleAgainstNormal(insideDir, wallNormal), 1)}°`, 24));
      return {
        segments,
        angleMarks,
        normals,
        hitPoint: hit,
        status: '可能漏光',
        pathMode: '进入纤芯后漏光',
        firstEdge: 'left',
        lastEdge: Math.abs(hit.y - top) < 0.5 ? 'top' : 'bottom',
        criticalDeg,
        coreDeg: angleAgainstNormal(refrIn.dir, { x: -1, y: 0 }),
        effectiveWallDeg,
      };
    }
    angleMarks.push(makeArcMark(hit, wallNormal, mul(insideDir, -1), `${fmt(angleAgainstNormal(insideDir, wallNormal), 1)}°`, 24));
    insideDir = reflect(insideDir, wallNormal);
    pos = hit;
  }

  return {
    segments,
    angleMarks,
    normals,
    hitPoint: pos,
    status: '持续导光',
    pathMode: '进入纤芯并持续导光',
    firstEdge: 'left',
    lastEdge: 'right',
    criticalDeg,
    coreDeg: angleAgainstNormal(refrIn.dir, { x: -1, y: 0 }),
    effectiveWallDeg,
  };
}

function solveApparentDepth(settings: RefractionSettings): SolveResult {
  const surfaceY = settings.elementCenterY ?? 260;
  const cx = settings.elementCenterX ?? 500;
  const mode = settings.apparentMode ?? 'depth';
  const depthCm = settings.apparentObjectDepthCm ?? 5;
  const nWater = settings.apparentWaterN ?? 1.333;
  const depthPx = depthCm * 20;

  let objectPos: Point;
  let n1: number, n2: number;
  if (mode === 'depth') {
    objectPos = { x: cx, y: surfaceY + depthPx };
    n1 = nWater;
    n2 = 1.0;
  } else {
    objectPos = { x: cx, y: surfaceY - depthPx };
    n1 = 1.0;
    n2 = nWater;
  }

  const segments: RaySegment[] = [];
  const angleMarks: AngleMark[] = [];
  const normals: [Point, Point][] = [];
  const rayAngle = settings.apparentRayAngleDeg ?? 20;
  const spreadAngles = [-rayAngle, 0, rayAngle];
  const surfaceNormal: Point = { x: 0, y: -1 };
  const virtualLen = Math.max(160, depthPx * 1.4);

  for (const angleDeg of spreadAngles) {
    const baseAngle = mode === 'depth' ? -90 : 90;
    const rayDir = pointFromAngle(baseAngle + angleDeg);
    const hit = intersectRayHorizontal(objectPos, rayDir, surfaceY, -2000, 4000);
    if (!hit) continue;

    const refrResult = refract(rayDir, surfaceNormal, n1, n2);
    segments.push({ from: objectPos, to: hit, kind: 'incident' });

    if (refrResult.tir || !refrResult.dir) {
      const reflDir = reflect(rayDir, surfaceNormal);
      segments.push({ from: hit, to: add(hit, mul(reflDir, 400)), kind: 'reflected' });
    } else {
      segments.push({ from: hit, to: add(hit, mul(refrResult.dir, 280)), kind: 'refracted' });
      const backDir = mul(refrResult.dir, -1);
      segments.push({ from: hit, to: add(hit, mul(backDir, virtualLen)), kind: 'virtual' });

      if (angleDeg === rayAngle) {
        const incAngle = angleAgainstNormal(rayDir, surfaceNormal);
        angleMarks.push(makeArcMark(hit, surfaceNormal, mul(rayDir, -1), `θ₁=${fmt(incAngle, 1)}°`, 32));
        const refrAngle = angleAgainstNormal(refrResult.dir, mul(surfaceNormal, -1));
        angleMarks.push(makeArcMark(hit, mul(surfaceNormal, -1), refrResult.dir, `θ₂=${fmt(refrAngle, 1)}°`, 42));
        normals.push([add(hit, { x: 0, y: -110 }), add(hit, { x: 0, y: 110 })]);
      }
    }
  }

  const apparentCm = mode === 'depth' ? depthCm / nWater : depthCm * nWater;
  const apparentPx = apparentCm * 20;
  const virtualImagePos: Point = mode === 'depth'
    ? { x: cx, y: surfaceY + apparentPx }
    : { x: cx, y: surfaceY - apparentPx };

  return {
    segments,
    angleMarks,
    normals,
    hitPoint: virtualImagePos,
    status: mode === 'depth' ? '视深：虚像比实物浅' : '视高：虚像比实物高',
    pathMode: mode === 'depth' ? '视深模型' : '视高模型',
    firstEdge: 'interface',
    lastEdge: 'interface',
    criticalDeg: nWater > 1 ? deg(Math.asin(1 / nWater)) : null,
    apparentDepthCm: apparentCm,
    realDepthCm: depthCm,
    virtualImagePoint: virtualImagePos,
    objectPoint: objectPos,
  };
}

function solveRefraction(settings: RefractionSettings): SolveResult {
  const source: Point = { x: clamp(settings.sourceAnchorX, 40, 920), y: clamp(settings.sourceY ?? 90, 20, 320) };
  if (settings.shape === 'interface') return solveInterface(settings, source);
  if (settings.shape === 'slab') return solveSlab(settings, source);
  if (settings.shape === 'half') return solveHemisphere(settings, source);
  if (settings.shape === 'fiber') return solveFiber(settings, source);
  if (settings.shape === 'apparent') return solveApparentDepth(settings);
  if (settings.shape === 'snellwindow') {
    const nW = settings.snellWaterN ?? 1.333;
    const critDeg = deg(Math.asin(Math.min(1, 1 / nW)));
    return { segments: [], angleMarks: [], normals: [], status: '3D 场景', pathMode: '3D', firstEdge: null, lastEdge: null, criticalDeg: critDeg };
  }
  return { segments: [extendRay(source, pointFromAngle(settings.sourceAngleDeg ?? 56))], angleMarks: [], normals: [], status: '当前形状尚未启用', pathMode: '未启用', firstEdge: null, lastEdge: null };
}

function applyShapePreset(settings: RefractionSettings, shape: ShapeKind): RefractionSettings {
  const experiment = BASE_SHAPE_PRESETS[shape] || BASE_SHAPE_PRESETS.interface;
  return {
    ...settings,
    ...experiment,
    canvasPanX: 0,
    canvasPanY: 0,
    canvasZoom: 1,
    showAngles: true,
    showNormals: true,
    showFormula: true,
    showColor: true,
    lightMode: 'single',
  };
}

function SnellWindow3DModule({ settings }: { settings: RefractionSettings }) {
  const SnellWindowScene = (window as any).SnellWindowScene;
  const result = solveRefraction(settings);
  const nW = settings.snellWaterN ?? 1.333;
  const depth = settings.snellSourceDepthCm ?? 8;
  const critAngle = Math.asin(Math.min(1, 1 / nW));
  const windowR = depth * Math.tan(critAngle);

  if (!SnellWindowScene) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)' }}>3D 场景加载中…</div>;
  }

  return (
    <>
      <div className="snell-3d-container">
        <SnellWindowScene
          depthCm={depth}
          waterN={nW}
          incidentAngleDeg={settings.snellIncidentAngleDeg ?? 30}
          viewMode={settings.snellViewMode ?? '3d'}
          wavelength={settings.wavelength}
          showColor={settings.showColor}
        />
      </div>
      <div className="hud ref-hud-floating">
        <span className="chip"><span className="dot" />θc = {fmt(deg(critAngle), 2)}°</span>
        <span className="chip"><span className="dot" />窗口半径 r = {fmt(windowR, 2)} cm</span>
        <span className="chip"><span className="dot" />n = {nW.toFixed(3)}</span>
      </div>
    </>
  );
}

function RefractionModule({ settings }: { settings: RefractionSettings }) {
  if (settings.shape === 'snellwindow') return <SnellWindow3DModule settings={settings} />;

  const result = solveRefraction(settings);
  const rayColor = settings.showColor ? (window as any).wavelengthToColor(settings.wavelength) : 'var(--accent-strong)';
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const dragRef = React.useRef<{ kind: DragTarget; startX: number; startY: number; prev: RefractionSettings } | null>(null);
  const [dragTarget, setDragTarget] = React.useState<DragTarget>(null);
  const canvasPanX = settings.canvasPanX ?? 0;
  const canvasPanY = settings.canvasPanY ?? 0;
  const canvasZoom = clamp(settings.canvasZoom ?? 1, 0.65, 2.2);
  const W = 1000;
  const H = 620;

  React.useEffect(() => {
    if (!dragTarget || !dragRef.current) return;
    const apply = (window as any).__refrSetSettings as ((updater: (prev: RefractionSettings) => RefractionSettings) => void) | undefined;
    if (!apply) return;

    const onMove = (event: PointerEvent): void => {
      const info = dragRef.current;
      if (!info) return;
      const dx = event.clientX - info.startX;
      const dy = event.clientY - info.startY;
      const localDx = dx / (info.prev.canvasZoom ?? 1);
      const localDy = dy / (info.prev.canvasZoom ?? 1);

      if (info.kind === 'pan') {
        apply((prev: RefractionSettings) => ({ ...prev, canvasPanX: (info.prev.canvasPanX ?? 0) + dx, canvasPanY: (info.prev.canvasPanY ?? 0) + dy }));
        return;
      }
      if (info.kind === 'source') {
        apply((prev: RefractionSettings) => ({
          ...prev,
          sourceAnchorX: clamp((info.prev.sourceAnchorX ?? 180) + localDx, 20, 960),
          sourceY: clamp((info.prev.sourceY ?? 90) + localDy, 10, 360),
        }));
        return;
      }
      apply((prev: RefractionSettings) => ({
        ...prev,
        elementCenterX: clamp((info.prev.elementCenterX ?? 520) + localDx, 120, 880),
        elementCenterY: clamp((info.prev.elementCenterY ?? 260) + localDy, 120, 500),
      }));
    };

    const onUp = (): void => {
      dragRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget]);

  const beginDrag = (kind: DragTarget) => (event: React.PointerEvent): void => {
    event.stopPropagation();
    dragRef.current = { kind, startX: event.clientX, startY: event.clientY, prev: settings };
    setDragTarget(kind);
  };

  const handleStageDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    const target = event.target as SVGElement;
    if (target.closest('[data-ref-no-pan="true"]')) return;
    dragRef.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, prev: settings };
    setDragTarget('pan');
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>): void => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    (window as any).__refrSetSettings((prev: RefractionSettings) => ({ ...prev, canvasZoom: clamp((prev.canvasZoom ?? 1) + delta, 0.65, 2.2) }));
  };

  return (
    <>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" onPointerDown={handleStageDown} onWheel={handleWheel}>
        <GridBg w={W} h={H} />
        <g transform={`translate(${canvasPanX} ${canvasPanY}) scale(${canvasZoom})`}>
          <MediumShape settings={settings} onPointerDown={beginDrag('element')} />
          {settings.shape !== 'apparent' && <LaserSource settings={settings} onPointerDown={beginDrag('source')} />}
          {settings.showNormals && result.normals.map((line, idx) => (
            <line key={idx} className="normal-line" x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} />
          ))}
          {result.segments.map((segment, index) => (
            <RenderedRay key={index} segment={segment} color={rayColor} thick={settings.rayThick} />
          ))}
          {settings.showAngles && result.angleMarks.map((mark, index) => <AngleMarkView key={index} mark={mark} />)}
        </g>
      </svg>

      <div className="legend">
        <div className="legend-title">图例</div>
        <div className="legend-row"><span className="swatch" style={{ background: rayColor }} /><span className="label">主光线</span></div>
        <div className="legend-row"><span className="swatch dashed" /><span className="label">法线</span></div>
        <div className="legend-row"><span className="swatch" style={{ background: 'rgba(52, 122, 110, 0.78)' }} /><span className="label">介质边界</span></div>
      </div>

      <div className="hud ref-hud-floating">
        <span className="chip"><span className="dot" />状态 = {result.status}</span>
        {result.criticalDeg !== undefined && <span className="chip"><span className="dot" />θc = {fmt(result.criticalDeg, 2)}°</span>}
        {result.shiftCm !== undefined && result.shiftCm !== null && <span className="chip"><span className="dot" />Δ = {fmt(result.shiftCm, 2)} cm</span>}
      </div>
    </>
  );
}

function MediumShape({ settings, onPointerDown }: { settings: RefractionSettings; onPointerDown: (e: React.PointerEvent) => void }) {
  if (settings.shape === 'interface') {
    const y = settings.elementCenterY ?? 260;
    const x = settings.elementCenterX ?? 500;
    return (
      <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
        <rect
          x={-2000}
          y={y}
          width={4000}
          height={1600}
          fill={Math.abs(settings.medium2N - MATERIALS.water.n) < 0.05 ? 'rgba(129, 171, 228, 0.12)' : 'rgba(187, 221, 214, 0.14)'}
          stroke="none"
        />
        <line className="interface" x1={-2000} y1={y} x2={2000} y2={y} />
      </g>
    );
  }
  if (settings.shape === 'slab') {
    const x = settings.elementCenterX ?? 500;
    const y = settings.elementCenterY ?? 250;
    const h = settings.slabThicknessCm * 20;
    return (
      <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
        <rect className="glass" x={x - 260} y={y} width={520} height={h} rx={0} />
        <line className="interface" x1={x - 260} y1={y} x2={x + 260} y2={y} />
        <line className="interface" x1={x - 260} y1={y + h} x2={x + 260} y2={y + h} />
      </g>
    );
  }
  if (settings.shape === 'half') {
    const center: Point = { x: settings.elementCenterX ?? 520, y: settings.elementCenterY ?? 270 };
    const R = settings.hemisphereRadiusCm * 24;
    return (
      <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
        <path className="glass" d={`M ${center.x - R} ${center.y} L ${center.x + R} ${center.y} A ${R} ${R} 0 0 1 ${center.x - R} ${center.y} Z`} />
        <line className="interface" x1={center.x - R - 40} y1={center.y} x2={center.x + R + 40} y2={center.y} />
      </g>
    );
  }
  if (settings.shape === 'fiber') {
    const center: Point = { x: settings.elementCenterX ?? 560, y: settings.elementCenterY ?? 290 };
    return (
      <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
        <rect x={center.x - 268} y={center.y - 24} width={536} height={48} fill="rgba(150, 177, 172, 0.10)" stroke="rgba(120, 140, 136, 0.35)" strokeWidth="1.2" />
        <rect className="glass" x={center.x - 260} y={center.y - 18} width={520} height={36} />
        <rect x={center.x - 252} y={center.y - 8} width={504} height={16} fill="rgba(255,255,255,0.10)" />
      </g>
    );
  }
  if (settings.shape === 'apparent') {
    const surfaceY = settings.elementCenterY ?? 260;
    const cx = settings.elementCenterX ?? 500;
    const mode = settings.apparentMode ?? 'depth';
    const depthCm = settings.apparentObjectDepthCm ?? 5;
    const depthPx = depthCm * 20;
    const nWater = settings.apparentWaterN ?? 1.333;
    const apparentCm = mode === 'depth' ? depthCm / nWater : depthCm * nWater;
    const apparentPx = apparentCm * 20;
    const objectY = mode === 'depth' ? surfaceY + depthPx : surfaceY - depthPx;
    const virtualY = mode === 'depth' ? surfaceY + apparentPx : surfaceY - apparentPx;
    const dimLeftX = cx - 180;
    const dimRightX = cx + 180;
    return (
      <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown}>
        <rect x={-2000} y={surfaceY} width={4000} height={1600} fill="rgba(129, 171, 228, 0.10)" />
        <line className="interface" x1={-2000} y1={surfaceY} x2={2000} y2={surfaceY} />
        <text className="label-txt dim" x={cx + 240} y={surfaceY - 6} style={{ pointerEvents: 'none', fontSize: 13 }}>水面</text>
        <text className="label-txt dim" x={cx + 240} y={surfaceY - 26} style={{ pointerEvents: 'none', fontSize: 13 }}>空气 n = 1.0</text>
        <text className="label-txt dim" x={cx + 240} y={surfaceY + 20} style={{ pointerEvents: 'none', fontSize: 13 }}>水 n = {nWater.toFixed(3)}</text>
        {/* 实物：右侧标签 */}
        <circle cx={cx} cy={objectY} r={5} fill="oklch(0.60 0.22 150)" />
        <circle cx={cx} cy={objectY} r={10} fill="none" stroke="oklch(0.60 0.22 150 / 0.25)" />
        <text className="label-txt" x={cx + 16} y={objectY + 4} style={{ pointerEvents: 'none', fontSize: 13 }} fill="oklch(0.60 0.22 150)">实物</text>
        {/* 虚像：左侧标签，避免重叠 */}
        <circle cx={cx} cy={virtualY} r={5} fill="none" stroke="oklch(0.55 0.18 280)" strokeWidth={1.6} strokeDasharray="3 2" />
        <text className="label-txt" x={cx - 16} y={virtualY + 4} textAnchor="end" fill="oklch(0.55 0.18 280)" style={{ pointerEvents: 'none', fontSize: 13 }}>虚像</text>
        {/* 左侧标注：实际深度 h */}
        <line x1={dimLeftX} y1={surfaceY} x2={dimLeftX} y2={objectY} stroke="var(--ink-3)" strokeWidth={0.8} strokeDasharray="4 3" />
        <line x1={dimLeftX - 4} y1={surfaceY} x2={dimLeftX + 4} y2={surfaceY} stroke="var(--ink-3)" strokeWidth={0.8} />
        <line x1={dimLeftX - 4} y1={objectY} x2={dimLeftX + 4} y2={objectY} stroke="var(--ink-3)" strokeWidth={0.8} />
        <text className="label-txt dim" x={dimLeftX - 8} y={(surfaceY + objectY) / 2} textAnchor="end" dominantBaseline="middle" style={{ pointerEvents: 'none', fontSize: 13 }}>h = {depthCm.toFixed(1)} cm</text>
        {/* 右侧标注：视深/视高 h' */}
        <line x1={dimRightX} y1={surfaceY} x2={dimRightX} y2={virtualY} stroke="oklch(0.55 0.18 280)" strokeWidth={0.8} strokeDasharray="3 2" />
        <line x1={dimRightX - 4} y1={surfaceY} x2={dimRightX + 4} y2={surfaceY} stroke="oklch(0.55 0.18 280)" strokeWidth={0.8} />
        <line x1={dimRightX - 4} y1={virtualY} x2={dimRightX + 4} y2={virtualY} stroke="oklch(0.55 0.18 280)" strokeWidth={0.8} />
        <text className="label-txt" x={dimRightX + 8} y={(surfaceY + virtualY) / 2} fill="oklch(0.55 0.18 280)" dominantBaseline="middle" style={{ pointerEvents: 'none', fontSize: 13 }}>h' = {apparentCm.toFixed(2)} cm</text>
      </g>
    );
  }
  return null;
}

function LaserSource({ settings, onPointerDown }: { settings: RefractionSettings; onPointerDown: (e: React.PointerEvent) => void }) {
  const angle = settings.sourceAngleDeg ?? 56;
  const x = settings.sourceAnchorX;
  const y = settings.sourceY ?? 90;
  return (
    <g data-ref-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={onPointerDown} transform={`translate(${x}, ${y}) rotate(${angle})`}>
      <text className="label-txt dim" x="-88" y="-16">主光源</text>
      <rect x="-62" y="-5.5" width="46" height="11" rx="5.5" fill="rgba(41, 47, 49, 0.96)" />
      <rect x="-55" y="-3.6" width="22" height="7.2" rx="3.6" fill="rgba(255,255,255,0.10)" />
      <rect x="-16" y="-3.8" width="10" height="7.6" rx="3.8" fill="rgba(23, 29, 30, 0.96)" />
      <circle cx="-5" cy="0" r="5.1" fill="rgba(24, 31, 32, 0.98)" />
      <circle cx="-1.2" cy="0" r="3.6" fill="rgba(255, 160, 70, 0.35)" filter="url(#ref-soft-glow)" />
      <circle cx="-1.2" cy="0" r="1.2" fill="rgba(255,245,225,0.98)" />
    </g>
  );
}

function RenderedRay({ segment, color, thick }: { segment: RaySegment; color: string; thick: number }) {
  if (segment.kind === 'virtual') {
    return (
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke="oklch(0.55 0.16 280)" strokeWidth={Math.max(1, thick - 0.3)} strokeDasharray="6 4" opacity={0.6} />
    );
  }
  const stroke = segment.kind === 'reflected' ? 'oklch(0.60 0.16 28)' : segment.kind === 'leak' ? 'oklch(0.66 0.17 35)' : color;
  return (
    <g>
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={stroke} strokeWidth={thick + 2.6} opacity={0.18} filter="url(#ref-soft-glow)" />
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={stroke} strokeWidth={thick + 0.9} opacity={0.42} />
      <line className="ray" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke={stroke} strokeWidth={Math.max(1, thick - 0.15)} opacity={0.98} />
    </g>
  );
}

function AngleMarkView({ mark }: { mark: AngleMark }) {
  const tau = Math.PI * 2;
  const normalize = (a: number): number => {
    let out = a % tau;
    if (out < 0) out += tau;
    return out;
  };
  const normalAngle = normalize(rad(mark.normalAngleDeg));
  const rayAngle = normalize(rad(mark.rayAngleDeg));
  let delta = rayAngle - normalAngle;
  while (delta <= -Math.PI) delta += tau;
  while (delta > Math.PI) delta -= tau;

  const startAngle = normalAngle;
  const endAngle = normalAngle + delta;
  const start = { x: mark.at.x + Math.cos(startAngle) * mark.radius, y: mark.at.y + Math.sin(startAngle) * mark.radius };
  const end = { x: mark.at.x + Math.cos(endAngle) * mark.radius, y: mark.at.y + Math.sin(endAngle) * mark.radius };
  const sweep = delta >= 0 ? 1 : 0;
  const mid = startAngle + delta / 2;
  const lx = mark.at.x + Math.cos(mid) * (mark.radius + 12);
  const ly = mark.at.y + Math.sin(mid) * (mark.radius + 12);
  return (
    <g>
      <path d={`M ${start.x} ${start.y} A ${mark.radius} ${mark.radius} 0 0 ${sweep} ${end.x} ${end.y}`} fill="none" stroke="var(--accent)" strokeWidth="1.1" />
      <text className="label-txt" x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--accent)" style={{ paintOrder: 'stroke fill', stroke: 'rgba(255,255,255,0.95)', strokeWidth: 3.4 }}>{mark.label}</text>
    </g>
  );
}

function GridBg({ w, h, step = 24 }: { w: number; h: number; step?: number }) {
  const lines: any[] = [];
  for (let x = 0; x <= w; x += step) lines.push(<line key={`gx-${x}`} className={`grid-line${x % 120 === 0 ? ' strong' : ''}`} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = 0; y <= h; y += step) lines.push(<line key={`gy-${y}`} className={`grid-line${y % 120 === 0 ? ' strong' : ''}`} x1={0} y1={y} x2={w} y2={y} />);
  return <g>{lines}</g>;
}

function RefractionControls({ settings, setSettings }: { settings: RefractionSettings; setSettings: (s: RefractionSettings | ((prev: RefractionSettings) => RefractionSettings)) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const SegSelect = (window as any).SegSelect;
  const activeShape = SHAPES.find((item) => item.id === settings.shape) || SHAPES[0];

  (window as any).__refrSetSettings = (updater: (prev: RefractionSettings) => RefractionSettings): void => {
    setSettings(updater);
  };

  return (
    <>
      <SectionTitle aside="OBJECT">介质对象</SectionTitle>
      <div className="seg vertical">
        {SHAPES.map((shape) => (
          <button key={shape.id} className={settings.shape === shape.id ? 'seg-item active' : 'seg-item'} onClick={() => setSettings(applyShapePreset(settings, shape.id))}>
            {shape.label}
          </button>
        ))}
      </div>

      <div className="ref-panel-note">
        <strong>{activeShape.label}</strong>
        <span>{activeShape.desc}</span>
      </div>

      {settings.shape !== 'apparent' && settings.shape !== 'snellwindow' && (
        <>
          <SectionTitle aside="SOURCE">主光源</SectionTitle>
          <Slider label="光线角 α" value={settings.sourceAngleDeg ?? 56} onChange={(v: number) => setSettings({ ...settings, sourceAngleDeg: v })} min={-85} max={175} step={1} unit="°" hint="光源方向独立于介质位置" />
        </>
      )}

      <SectionTitle aside="MEDIUM">介质参数</SectionTitle>
      {settings.shape === 'interface' && (
        <>
          <Slider label="n₁" value={settings.medium1N} onChange={(v: number) => setSettings({ ...settings, medium1N: v })} min={1.0} max={2.5} step={0.01} unit="" />
          <Slider label="n₂" value={settings.medium2N} onChange={(v: number) => setSettings({ ...settings, medium2N: v })} min={1.0} max={2.5} step={0.01} unit="" />
        </>
      )}
      {settings.shape === 'slab' && (
        <>
          <Slider label="玻璃折射率 n" value={settings.slabIndex} onChange={(v: number) => setSettings({ ...settings, slabIndex: v })} min={1.3} max={2.0} step={0.01} unit="" />
          <Slider label="厚度 d" value={settings.slabThicknessCm} onChange={(v: number) => setSettings({ ...settings, slabThicknessCm: v })} min={1} max={20} step={0.5} unit="cm" />
        </>
      )}
      {settings.shape === 'half' && (
        <>
          <SegSelect value={settings.hemisphereMode} onChange={(v: HemisphereMode) => setSettings({ ...settings, hemisphereMode: v })} options={[{ value: 'plane', label: '平面入射' }, { value: 'center', label: '球心入射' }]} />
          <Slider label="折射率 n" value={settings.hemisphereIndex} onChange={(v: number) => setSettings({ ...settings, hemisphereIndex: v })} min={1.3} max={2.0} step={0.01} unit="" />
          <Slider label="半径 R" value={settings.hemisphereRadiusCm} onChange={(v: number) => setSettings({ ...settings, hemisphereRadiusCm: v })} min={2} max={10} step={0.5} unit="cm" />
        </>
      )}
      {settings.shape === 'fiber' && (
        <>
          <Slider label="纤芯 n₁" value={settings.fiberCoreN} onChange={(v: number) => setSettings({ ...settings, fiberCoreN: Math.max(v, settings.fiberCladdingN + 0.01) })} min={1.3} max={2.0} step={0.01} unit="" />
          <Slider label="包层 n₂" value={settings.fiberCladdingN} onChange={(v: number) => setSettings({ ...settings, fiberCladdingN: Math.min(v, settings.fiberCoreN - 0.01) })} min={1.0} max={1.8} step={0.01} unit="" />
          <Slider label="弯曲半径 R" value={settings.fiberBendRadiusCm} onChange={(v: number) => setSettings({ ...settings, fiberBendRadiusCm: v })} min={2} max={50} step={1} unit="cm" />
        </>
      )}
      {settings.shape === 'apparent' && (
        <>
          <SegSelect value={settings.apparentMode ?? 'depth'} onChange={(v: string) => setSettings({ ...settings, apparentMode: v as 'depth' | 'height' })} options={[{ value: 'depth', label: '视深（俯视）' }, { value: 'height', label: '视高（仰视）' }]} />
          <Slider label="物体深度 h" value={settings.apparentObjectDepthCm ?? 5} onChange={(v: number) => setSettings({ ...settings, apparentObjectDepthCm: v })} min={1} max={15} step={0.5} unit="cm" />
          <Slider label="水折射率 n" value={settings.apparentWaterN ?? 1.333} onChange={(v: number) => setSettings({ ...settings, apparentWaterN: v })} min={1.1} max={1.8} step={0.01} unit="" />
          <Slider label="光线张角" value={settings.apparentRayAngleDeg ?? 20} onChange={(v: number) => setSettings({ ...settings, apparentRayAngleDeg: v })} min={2} max={80} step={1} unit="°" hint="超过临界角时可观察全反射" />
        </>
      )}
      {settings.shape === 'snellwindow' && (
        <>
          <Slider label="入射角 θ₁" value={settings.snellIncidentAngleDeg ?? 30} onChange={(v: number) => setSettings({ ...settings, snellIncidentAngleDeg: v })} min={5} max={85} step={1} unit="°" hint={`临界角 ${(Math.asin(Math.min(1, 1 / (settings.snellWaterN ?? 1.333))) * 180 / Math.PI).toFixed(1)}°`} />
          <Slider label="水折射率 n" value={settings.snellWaterN ?? 1.333} onChange={(v: number) => setSettings({ ...settings, snellWaterN: v })} min={1.1} max={1.8} step={0.01} unit="" />
          <Slider label="水深 h" value={settings.snellSourceDepthCm ?? 8} onChange={(v: number) => setSettings({ ...settings, snellSourceDepthCm: v })} min={2} max={20} step={0.5} unit="cm" />
          <SegSelect value={settings.snellViewMode ?? '3d'} onChange={(v: string) => setSettings({ ...settings, snellViewMode: v as '3d' | '2d' | 'topview' })} options={[{ value: '3d', label: '3D' }, { value: '2d', label: '2D 截面' }, { value: 'topview', label: '俯视' }]} />
        </>
      )}

      {settings.shape !== 'snellwindow' && (
        <>
          <SectionTitle aside="OBJECT">介质位置</SectionTitle>
          <div className="ref-panel-note">
            <strong>直接拖动对象</strong>
            <span>画布中可直接拖动主光源和介质对象，滚轮缩放、空白处拖动画布。</span>
          </div>

          <SectionTitle aside="CANVAS">画布</SectionTitle>
          <Slider label="缩放" value={settings.canvasZoom ?? 1} onChange={(v: number) => setSettings({ ...settings, canvasZoom: v })} min={0.65} max={2.2} step={0.05} unit="x" />
          <div className="preset-row">
            <button className="preset-btn" onClick={() => setSettings({ ...settings, canvasPanX: 0, canvasPanY: 0 })}>居中画布</button>
            <button className="preset-btn" onClick={() => setSettings(applyShapePreset(settings, settings.shape))}>重置对象</button>
          </div>
        </>
      )}

      <SectionTitle aside="WAVELENGTH">波长</SectionTitle>
      <Slider label="波长 λ" value={settings.wavelength} onChange={(v: number) => setSettings({ ...settings, wavelength: v })} min={380} max={780} step={5} unit="nm" />

      <SectionTitle aside="DISPLAY">显示</SectionTitle>
      <Toggle label="角度标注" checked={settings.showAngles} onChange={(v: boolean) => setSettings({ ...settings, showAngles: v })} />
      <Toggle label="法线显示" checked={settings.showNormals} onChange={(v: boolean) => setSettings({ ...settings, showNormals: v })} />
      <Toggle label="颜色显示" checked={settings.showColor} onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="公式验证" checked={settings.showFormula} onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />

    </>
  );
}

function RefractionReadouts({ settings }: { settings: RefractionSettings }) {
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;
  const result = solveRefraction(settings);
  const formulaNotes = buildRefractionFormulaNotes(settings, result);

  const shapeLabel = SHAPES.find((shape) => shape.id === settings.shape)?.label || '介质';

  return (
    <>
      <SectionTitle aside="MODEL">对象说明</SectionTitle>
      <div className="formula ref-readout-summary">
        {settings.shape === 'interface' && (
          <>
            <span className="step"><span className="lhs">单平面界面</span><span className="eq">=</span><span className="rhs">只有一条介质分界面</span></span>
            <span className="step">`n₁` 和 `n₂` 分别表示界面两侧介质的折射率，因此只发生一次界面折射。</span>
          </>
        )}
        {settings.shape === 'slab' && (
          <>
            <span className="step"><span className="lhs">玻璃砖</span><span className="eq">=</span><span className="rhs">两条平行界面</span></span>
            <span className="step">系统会先判断射线首先命中哪条边，再继续追迹后续边界，因此可以处理侧边入射和全反射后的再次传播。</span>
          </>
        )}
        {settings.shape === 'half' && (
          <>
            <span className="step"><span className="lhs">半球介质</span><span className="eq">=</span><span className="rhs">平面 + 曲面</span></span>
            <span className="step">系统会同时判断先命中平面还是曲面，并根据对应边界法线继续追迹后续折射或全反射。</span>
          </>
        )}
        {settings.shape === 'fiber' && (
          <>
            <span className="step"><span className="lhs">光纤</span><span className="eq">=</span><span className="rhs">细长导光通道</span></span>
            <span className="step">当前版本按入口进入后与上下壁面持续作用来解释导光与漏光，仍是模块 1 里最专用的一类对象。</span>
          </>
        )}
        {settings.shape === 'apparent' && (
          <>
            <span className="step"><span className="lhs">视深与视高</span><span className="eq">=</span><span className="rhs">折射导致的虚像偏移</span></span>
            <span className="step">{(settings.apparentMode ?? 'depth') === 'depth' ? '从空气中俯视水中物体，虚像位置比实物更浅。' : '从水中仰视空气中物体，虚像位置比实物更高。'}</span>
          </>
        )}
        {settings.shape === 'snellwindow' && (
          <>
            <span className="step"><span className="lhs">水下光源</span><span className="eq">=</span><span className="rhs">斯涅尔窗 + 全反射 3D</span></span>
            <span className="step">水下光源向各方向发射光线，临界角锥内折射出水面形成斯涅尔窗，锥外光线全部全反射回水中。</span>
          </>
        )}
      </div>

      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">
        <Readout label="当前对象" value={shapeLabel} unit="" />
        {settings.shape !== 'snellwindow' && (
          <>
            <Readout label="状态" value={result.status} unit="" />
            <Readout label="路径模式" value={result.pathMode} unit="" />
            <Readout label="首次命中边界" value={edgeLabel(result.firstEdge)} unit="" />
            <Readout label="最后命中边界" value={edgeLabel(result.lastEdge)} unit="" />
            <Readout label="入射角" value={fmt(result.incidentDeg, 2)} unit={result.incidentDeg == null ? '' : '°'} />
            <Readout label="折射角" value={fmt(result.refractedDeg, 2)} unit={result.refractedDeg == null ? '' : '°'} hi />
            <Readout label="反射角" value={fmt(result.reflectedDeg, 2)} unit={result.reflectedDeg == null ? '' : '°'} />
            {result.exitDeg !== undefined && <Readout label="出射角" value={fmt(result.exitDeg, 2)} unit={result.exitDeg == null ? '' : '°'} />}
            {result.criticalDeg !== undefined && <Readout label="临界角" value={fmt(result.criticalDeg, 2)} unit={result.criticalDeg == null ? '' : '°'} />}
            {result.shiftCm !== undefined && <Readout label="侧向位移" value={fmt(result.shiftCm, 2)} unit={result.shiftCm == null ? '' : 'cm'} />}
            {result.coreDeg !== undefined && <Readout label="纤芯传播角" value={fmt(result.coreDeg, 2)} unit={result.coreDeg == null ? '' : '°'} />}
            {result.effectiveWallDeg !== undefined && <Readout label="壁面入射角" value={fmt(result.effectiveWallDeg, 2)} unit={result.effectiveWallDeg == null ? '' : '°'} />}
            {result.realDepthCm != null && <Readout label={(settings.apparentMode ?? 'depth') === 'depth' ? '实际深度 h' : '实际高度 h'} value={fmt(result.realDepthCm, 1)} unit="cm" />}
            {result.apparentDepthCm != null && <Readout label={(settings.apparentMode ?? 'depth') === 'depth' ? '视深 h\'' : '视高 h\''} value={fmt(result.apparentDepthCm, 2)} unit="cm" hi />}
          </>
        )}
        {settings.shape === 'snellwindow' && (() => {
          const nW = settings.snellWaterN ?? 1.333;
          const depth = settings.snellSourceDepthCm ?? 8;
          const incDeg = settings.snellIncidentAngleDeg ?? 30;
          const critAngle = deg(Math.asin(Math.min(1, 1 / nW)));
          const windowR = depth * Math.tan(rad(critAngle));
          const sinR = Math.sin(rad(incDeg)) * nW;
          const isTIR = sinR > 1;
          const refractedDeg = isTIR ? null : deg(Math.asin(sinR));
          return (
            <>
              <Readout label="入射角 θ₁" value={incDeg.toFixed(0)} unit="°" />
              <Readout label="折射角 θ₂" value={isTIR ? '全反射' : refractedDeg!.toFixed(1)} unit={isTIR ? '' : '°'} hi />
              <Readout label="临界角 θc" value={critAngle.toFixed(1)} unit="°" />
              <Readout label="水折射率 n" value={nW.toFixed(3)} unit="" />
              <Readout label="水深 h" value={depth.toFixed(1)} unit="cm" />
              <Readout label="斯涅尔窗半径 r" value={windowR.toFixed(2)} unit="cm" hi />
            </>
          );
        })()}
      </div>

      {settings.showFormula && (
        <>
          <SectionTitle aside="FORMULA">公式验证</SectionTitle>
          <FormulaBlock>
            {formulaNotes.map((line, index) => (
              <span key={`note-${index}`} className="step">{line}</span>
            ))}
            {settings.shape === 'interface' && (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">n₁ sin θ₁</span><span className="eq">=</span><span className="rhs">n₂ sin θ₂</span></span>
                <span className="step mono">{settings.medium1N.toFixed(3)} × sin θ₁ = {settings.medium2N.toFixed(3)} × sin θ₂</span>
              </>
            )}
            {settings.shape === 'slab' && (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">Δ</span><span className="eq">=</span><span className="rhs">d sin(θ₁ - θ₂) / cos θ₂</span></span>
                <span className="step mono">d = {settings.slabThicknessCm.toFixed(1)} cm</span>
              </>
            )}
            {settings.shape === 'half' && (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">平面入射后</span><span className="eq">→</span><span className="rhs">到曲面判断是否全反射</span></span>
                <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">1 / n</span></span>
              </>
            )}
            {settings.shape === 'fiber' && (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">n₂ / n₁</span></span>
                <span className="step mono">{settings.fiberCladdingN.toFixed(3)} / {settings.fiberCoreN.toFixed(3)}</span>
              </>
            )}
            {settings.shape === 'apparent' && (
              <>
                <span className="step">---</span>
                <span className="step"><span className="lhs">h'</span><span className="eq">=</span><span className="rhs">{(settings.apparentMode ?? 'depth') === 'depth' ? 'h / n' : 'h × n'}</span></span>
                <span className="step mono">{(settings.apparentMode ?? 'depth') === 'depth' ? `${(settings.apparentObjectDepthCm ?? 5).toFixed(1)} / ${(settings.apparentWaterN ?? 1.333).toFixed(3)}` : `${(settings.apparentObjectDepthCm ?? 5).toFixed(1)} × ${(settings.apparentWaterN ?? 1.333).toFixed(3)}`}</span>
                <span className="step"><span className="lhs">h'</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(result.apparentDepthCm, 2)} cm</span></span></span>
              </>
            )}
            {settings.shape === 'snellwindow' && (() => {
              const nW = settings.snellWaterN ?? 1.333;
              const depth = settings.snellSourceDepthCm ?? 8;
              const incDeg = settings.snellIncidentAngleDeg ?? 30;
              const critAngle = deg(Math.asin(Math.min(1, 1 / nW)));
              const windowR = depth * Math.tan(rad(critAngle));
              const sinR = Math.sin(rad(incDeg)) * nW;
              const isTIR = sinR > 1;
              return (
                <>
                  <span className="step">---</span>
                  <span className="step"><span className="lhs">n₁ sin θ₁</span><span className="eq">=</span><span className="rhs">n₂ sin θ₂</span></span>
                  <span className="step mono">{nW.toFixed(3)} × sin({incDeg}°) = 1 × sin θ₂</span>
                  <span className="step mono">sin θ₂ = {sinR.toFixed(4)}{isTIR ? ' > 1 → 全反射' : ` → θ₂ = ${deg(Math.asin(sinR)).toFixed(1)}°`}</span>
                  <span className="step">---</span>
                  <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">1 / n = 1 / {nW.toFixed(3)}</span></span>
                  <span className="step"><span className="lhs">θc</span><span className="eq">=</span><span className="rhs"><span className="hi">{critAngle.toFixed(1)}°</span></span></span>
                  <span className="step"><span className="lhs">r</span><span className="eq">=</span><span className="rhs">h tan θc = {depth.toFixed(1)} × tan({critAngle.toFixed(1)}°) = <span className="hi">{windowR.toFixed(2)} cm</span></span></span>
                </>
              );
            })()}
          </FormulaBlock>
        </>
      )}
    </>
  );
}

Object.assign(window, { RefractionModule, RefractionControls, RefractionReadouts, MATERIALS });

export {};
