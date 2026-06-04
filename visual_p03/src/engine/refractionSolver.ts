import type { RefractionSettings, SolveResult, Point, AngleMark, RaySegment, BoundaryHit } from '@/data/refractionData';
import { MATERIALS } from '@/data/refractionData';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import {
  deg, rad, fmt, clamp,
  add, sub, mul, dot, len, norm,
  pointFromAngle, angleFromVector, angleAgainstNormal,
  reflect, refract, extendRay,
  intersectRayHorizontal, intersectRayVertical, intersectRayCircle,
  intersectRayRectBoundary, intersectRayHalfBoundary,
  pointInRect, pointInHalfDisk, pointInFiberCore,
  makeFiberGeometry, fiberCenterY, fiberBoundaryY, fiberBoundaryNormal,
  findFiberBoundaryHit, uniqueBoundaryHits, makeArcMark,
} from './refractionGeometry';

// ── Stage constants ─────────────────────────────────────────────────

const REFRACTION_STAGE_W = 1000;
const REFRACTION_STAGE_H = 620;
const SOURCE_MIN_X = 20;
const SOURCE_MAX_X = REFRACTION_STAGE_W - 40;
const SOURCE_MIN_Y = 10;
const SOURCE_MAX_Y = REFRACTION_STAGE_H - 30;

// ── Edge label helper ───────────────────────────────────────────────

function edgeLabel(edge: SolveResult['firstEdge']): string {
  if (edge === 'interface') return '单界面';
  if (edge === 'top') return '上边界';
  if (edge === 'bottom') return '下边界';
  if (edge === 'left') return '左边界';
  if (edge === 'right') return '右边界';
  if (edge === 'arc') return '曲面';
  return '—';
}

// ── Formula notes builder ───────────────────────────────────────────

export function buildRefractionFormulaNotes(settings: RefractionSettings, result: SolveResult): string[] {
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
      '当前路径：主光线尚未稳定形成"进入 + 射出"的完整玻璃砖路径。',
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
      '它不是只固定"先过平面"，而是允许先命中平面或曲面。',
      '若想复现标准教材情形，可让光线先打到上方平面。',
    ];
  }

  if (settings.shape === 'fiber') {
    const modelLabel = (settings.fiberModel ?? 'straight') === 'bent' ? '弯曲光纤' : '直光纤';
    if (result.pathMode.includes('漏光')) {
      return [
        `当前路径：${modelLabel}中，主光线在壁面处不再满足全反射条件，因此出现漏光。`,
        `临界角关系：sin θc = n₂ / n₁ = ${settings.fiberCladdingN.toFixed(3)} / ${settings.fiberCoreN.toFixed(3)}`,
        '当壁面入射角减小到临界角以下，光线将不再稳定导光。',
      ];
    }
    return [
      `当前路径：主光线在${modelLabel}纤芯中与上下壁面持续相互作用。`,
      `导光条件：n₁ > n₂，即 ${settings.fiberCoreN.toFixed(3)} > ${settings.fiberCladdingN.toFixed(3)}`,
      (settings.fiberModel ?? 'straight') === 'bent'
        ? '弯曲半径越小，外侧边界处越容易不满足全反射条件。'
        : '直光纤适合先观察连续全反射的基本路径。',
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
    const sourceShape = settings.snellSourceShape ?? 'point';
    const sourceLabel = sourceShape === 'line' ? '线光源' : sourceShape === 'polygon' ? '多边形光源' : '点光源';
    return [
      `${sourceLabel}深度 h = ${depth.toFixed(1)} cm，水折射率 n = ${nW.toFixed(3)}。`,
      `临界角 θc = arcsin(1/n) = ${critAngle.toFixed(2)}°`,
      `斯涅尔窗半径 r = h × tan(θc) = ${windowR.toFixed(2)} cm`,
      sourceShape === 'point'
        ? '临界角锥内的光线折射出水面，锥外全部全反射回水中。'
        : '扩展光源可看作多个点光源的叠加，因此水面上会出现多个斯涅尔窗范围的叠加。',
    ];
  }

  return ['当前路径暂无专门公式说明。'];
}

// ── Single flat boundary ────────────────────────────────────────────

export function solveInterface(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 56));
  const lineY = settings.elementCenterY ?? 260;
  const mediumLeft = -2000;
  const mediumRight = 4000;
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

// ── Glass slab (double boundary) ────────────────────────────────────

export function solveSlab(settings: RefractionSettings, source: Point): SolveResult {
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
    normals.push([add(hit.point, mul(hit.normal, -120)), add(hit.point, mul(hit.normal, 120))]);

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

// ── Hemisphere ──────────────────────────────────────────────────────

export function solveHemisphere(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 60));
  const center: Point = { x: settings.elementCenterX ?? 520, y: settings.elementCenterY ?? 270 };
  const R = settings.hemisphereRadiusCm * 24;

  if (settings.hemisphereMode === 'center') {
    const target = center;
    const insideDir = norm(sub(target, source));
    const exit = intersectRayCircle(target, insideDir, center, R, (p) => p.y >= center.y - 0.5);
    if (!exit) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '未命中半球', pathMode: '未命中', firstEdge: null, lastEdge: null };
    const out = add(exit, mul(insideDir, 1400));
    return {
      segments: [{ from: source, to: target, kind: 'incident' }, { from: target, to: exit, kind: 'refracted' }, { from: exit, to: out, kind: 'exit' }],
      angleMarks: [makeArcMark(exit, norm(sub(exit, center)), mul(insideDir, -1), '0.0°', 26)],
      normals: [[center, add(exit, mul(norm(sub(exit, center)), 100))]],
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
    const nLen = hit.edge === 'arc' ? 100 : 120;
    normals.push([add(hit.point, mul(hit.normal, -nLen)), add(hit.point, mul(hit.normal, nLen))]);
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

// ── Optical fiber ───────────────────────────────────────────────────

export function solveFiber(settings: RefractionSettings, source: Point): SolveResult {
  const dir = norm(pointFromAngle(settings.sourceAngleDeg ?? 8));
  const geom = makeFiberGeometry(settings);
  const sourceInside = pointInFiberCore(source, geom);
  const entranceTop = fiberBoundaryY(geom, geom.left, 'top');
  const entranceBottom = fiberBoundaryY(geom, geom.left, 'bottom');
  const enter = sourceInside ? source : intersectRayVertical(source, dir, geom.left, entranceTop, entranceBottom);
  if (!enter) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '射线未命中光纤入口', pathMode: '未命中', firstEdge: null, lastEdge: null };

  const refrIn = sourceInside ? { dir, tir: false } : refract(dir, { x: -1, y: 0 }, 1, settings.fiberCoreN);
  if (!refrIn.dir) return { segments: [extendRay(source, dir)], angleMarks: [], normals: [], status: '入口未形成有效入射', pathMode: '未进入纤芯', firstEdge: 'left', lastEdge: 'left' };

  const segments: RaySegment[] = sourceInside ? [] : [{ from: source, to: enter, kind: 'incident' }];
  const angleMarks: AngleMark[] = sourceInside ? [] : [makeArcMark(enter, { x: -1, y: 0 }, mul(dir, -1), `${fmt(angleAgainstNormal(dir, { x: -1, y: 0 }), 1)}°`, 24)];
  const normals: [Point, Point][] = sourceInside ? [] : [[add(enter, { x: -100, y: 0 }), add(enter, { x: 100, y: 0 })]];

  let pos = enter;
  let insideDir = refrIn.dir;
  let guard = 18;
  const criticalDeg = deg(Math.asin(clamp(settings.fiberCladdingN / settings.fiberCoreN, 0, 1)));
  let effectiveWallDeg: number | null = null;
  let lastEdge: BoundaryHit['edge'] | 'interface' | null = sourceInside ? null : 'left';

  while (guard-- > 0) {
    const rightTop = fiberBoundaryY(geom, geom.right, 'top');
    const rightBottom = fiberBoundaryY(geom, geom.right, 'bottom');
    const hitTop = findFiberBoundaryHit(pos, insideDir, geom, 'top');
    const hitBottom = findFiberBoundaryHit(pos, insideDir, geom, 'bottom');
    const hitRight = intersectRayVertical(pos, insideDir, geom.right, rightTop, rightBottom);
    const candidates = [
      hitTop,
      hitBottom,
      hitRight ? { point: hitRight, normal: { x: 1, y: 0 }, edge: 'right' as const, distance: len(sub(hitRight, pos)) } : null,
    ].filter(Boolean).sort((a, b) => (a as BoundaryHit).distance - (b as BoundaryHit).distance) as BoundaryHit[];
    if (candidates.length === 0) {
      segments.push({ from: pos, to: add(pos, mul(insideDir, 1400)), kind: 'refracted' });
      break;
    }
    const hit = candidates[0];
    if (hit.edge === 'right') {
      segments.push({ from: pos, to: hit.point, kind: 'refracted' });
      segments.push({ from: hit.point, to: add(hit.point, mul(insideDir, 1400)), kind: 'exit' });
      lastEdge = 'right';
      break;
    }
    const wallNormal = hit.normal;
    effectiveWallDeg = angleAgainstNormal(insideDir, wallNormal);
    segments.push({ from: pos, to: hit.point, kind: 'refracted' });
    normals.push([add(hit.point, mul(wallNormal, -70)), add(hit.point, mul(wallNormal, 70))]);
    if (effectiveWallDeg <= criticalDeg) {
      const leakDir = refract(insideDir, wallNormal, settings.fiberCoreN, settings.fiberCladdingN).dir || reflect(insideDir, wallNormal);
      segments.push({ from: hit.point, to: add(hit.point, mul(leakDir, 1200)), kind: 'leak' });
      angleMarks.push(makeArcMark(hit.point, wallNormal, mul(insideDir, -1), `${fmt(angleAgainstNormal(insideDir, wallNormal), 1)}°`, 24));
      return {
        segments,
        angleMarks,
        normals,
        hitPoint: hit.point,
        status: '可能漏光',
        pathMode: sourceInside ? '纤芯内发光后漏光' : '进入纤芯后漏光',
        firstEdge: sourceInside ? null : 'left',
        lastEdge: hit.edge,
        criticalDeg,
        coreDeg: angleAgainstNormal(refrIn.dir, { x: -1, y: 0 }),
        effectiveWallDeg,
      };
    }
    angleMarks.push(makeArcMark(hit.point, wallNormal, mul(insideDir, -1), `${fmt(angleAgainstNormal(insideDir, wallNormal), 1)}°`, 24));
    insideDir = reflect(insideDir, wallNormal);
    pos = hit.point;
    lastEdge = hit.edge;
  }

  return {
    segments,
    angleMarks,
    normals,
    hitPoint: pos,
    status: sourceInside ? '纤芯内发光并持续导光' : '持续导光',
    pathMode: sourceInside ? '纤芯内发光 / 连续全反射' : '进入纤芯并持续导光',
    firstEdge: sourceInside ? null : 'left',
    lastEdge,
    criticalDeg,
    coreDeg: angleAgainstNormal(refrIn.dir, { x: -1, y: 0 }),
    effectiveWallDeg,
  };
}

// ── Apparent depth / height ─────────────────────────────────────────

export function solveApparentDepth(settings: RefractionSettings): SolveResult {
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

// ── Main dispatcher ─────────────────────────────────────────────────

export function solveRefraction(settings: RefractionSettings): SolveResult {
  const source: Point = {
    x: clamp(settings.sourceAnchorX, SOURCE_MIN_X, SOURCE_MAX_X),
    y: clamp(settings.sourceY ?? 90, SOURCE_MIN_Y, SOURCE_MAX_Y),
  };
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
