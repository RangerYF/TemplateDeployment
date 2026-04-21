// Module 1: Refraction & Total Internal Reflection
const React = (window as any).React;

interface Material { n: number; label: string; nLabel: string; }
type MaterialKey = 'air' | 'water' | 'glass' | 'crown' | 'flint' | 'diamond' | 'ice' | 'fiber';
type ShapeKind = 'interface' | 'slab' | 'half' | 'sphere' | 'hollow' | 'fiber';
type RefractionExperimentId = 'opt-001' | 'opt-002' | 'opt-003' | 'opt-004';
type HemisphereMode = 'center' | 'plane';

interface RefractionSettings {
  experimentId: RefractionExperimentId;
  shape: ShapeKind;
  material: MaterialKey;
  theta1Deg: number;
  wavelength: number;
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
  showAngles: boolean;
  showNormals: boolean;
  showFormula: boolean;
  showColor: boolean;
  rayThick: number;
}

interface Point { x: number; y: number; }
interface SnellResult { theta2: number; tir: boolean; }
interface AnyTrace {
  incident?: [Point, Point];
  reflectedTop?: [Point, Point];
  refracted?: [Point, Point];
  exit?: [Point, Point] | null;
  tirReflected?: [Point, Point] | null;
  theta2?: number;
}

interface InterfaceTrace extends AnyTrace {
  theta2: number;
  criticalDeg: number | null;
  tir: boolean;
}

interface SlabTrace extends AnyTrace {
  theta2: number;
  thetaExit: number;
  shiftCm: number;
  tirBottom: boolean;
  criticalDeg: number;
}

interface HemisphereTrace extends AnyTrace {
  exitIncidenceDeg: number | null;
  criticalDeg: number | null;
  mode: HemisphereMode;
  noRefractionAtCurve: boolean;
  tir: boolean;
}

interface FiberTrace {
  incident: [Point, Point];
  path: Point[];
  exit: [Point, Point] | null;
  leak: [Point, Point] | null;
  thetaCoreDeg: number;
  criticalDeg: number;
  wallIncidenceDeg: number;
  effectiveWallIncidenceDeg: number;
  tirOccurs: boolean;
  bendPenaltyDeg: number;
}

const MATERIALS: Record<string, Material> = ((window as any).P03_REFRACTION_MATERIAL_REFERENCES || []).reduce(
  (acc: Record<string, Material>, item: { key: string; label: string; n: number }) => {
    acc[item.key] = { n: item.n, label: item.label, nLabel: `n = ${item.n.toFixed(3)}` };
    return acc;
  },
  {
    air: { n: 1.0, label: '空气 Air', nLabel: 'n = 1.000' },
    water: { n: 1.333, label: '水 Water', nLabel: 'n = 1.333' },
    glass: { n: 1.5, label: '普通玻璃', nLabel: 'n = 1.500' },
    crown: { n: 1.52, label: '冕牌玻璃', nLabel: 'n = 1.520' },
    flint: { n: 1.65, label: '火石玻璃', nLabel: 'n = 1.650' },
    diamond: { n: 2.417, label: '金刚石', nLabel: 'n = 2.417' },
    ice: { n: 1.309, label: '冰', nLabel: 'n = 1.309' },
    fiber: { n: 1.5, label: '光纤纤芯', nLabel: 'n = 1.500' },
  }
);

const REFRACTION_EXPERIMENTS: { id: RefractionExperimentId; label: string; shape: ShapeKind }[] =
  (((window as any).P03_EXPERIMENTS?.refraction || []) as ExperimentSpec[]).map((item) => ({
    id: item.id as RefractionExperimentId,
    label: item.title,
    shape: item.id === 'opt-001' ? 'interface' : item.id === 'opt-002' ? 'slab' : item.id === 'opt-003' ? 'half' : 'fiber',
  }));

const deg = (r: number): number => r * 180 / Math.PI;
const rad = (d: number): number => d * Math.PI / 180;
const fmt = (v: number, digits: number = 2): string => Number.isFinite(v) ? v.toFixed(digits) : '—';
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const norm = (a: Point): Point => {
  const len = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / len, y: a.y / len };
};

function snellRefract(theta1: number, n1: number, n2: number): SnellResult {
  const s = (n1 / n2) * Math.sin(theta1);
  if (Math.abs(s) > 1) return { theta2: NaN, tir: true };
  return { theta2: Math.asin(s), tir: false };
}

function pickRayColor(settings: RefractionSettings): string {
  return settings.showColor ? (window as any).wavelengthToColor(settings.wavelength) : 'var(--accent-strong)';
}

function traceInterface(theta1: number, n1: number, n2: number): InterfaceTrace {
  const rayLen = 150;
  const p1: Point = { x: 0, y: 0 };
  const incidentStart: Point = { x: -Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const reflectedEnd: Point = { x: Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const { theta2, tir } = snellRefract(theta1, n1, n2);
  const criticalDeg = n1 > n2 ? deg(Math.asin(n2 / n1)) : null;
  const refrEnd: Point = tir
    ? { x: 0, y: 0 }
    : { x: Math.sin(theta2) * rayLen, y: Math.cos(theta2) * rayLen };
  return {
    incident: [incidentStart, p1],
    reflectedTop: [p1, reflectedEnd],
    refracted: tir ? undefined : [p1, refrEnd],
    exit: null,
    tirReflected: null,
    theta2,
    criticalDeg,
    tir,
  };
}

function traceSlab(theta1: number, n2: number, slabThicknessCm: number): SlabTrace | null {
  const n1 = 1;
  const H = slabThicknessCm * 18;
  const rayLen = 140;
  const p1: Point = { x: 0, y: 0 };
  const incidentStart: Point = { x: -Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const reflectedEnd: Point = { x: Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const first = snellRefract(theta1, n1, n2);
  if (first.tir) return null;
  const p2: Point = {
    x: Math.sin(first.theta2) * H / Math.cos(first.theta2),
    y: H,
  };
  const second = snellRefract(first.theta2, n2, n1);
  const exitEnd: Point = second.tir
    ? p2
    : { x: p2.x + Math.sin(second.theta2) * rayLen, y: H + Math.cos(second.theta2) * rayLen };
  const tirEnd: Point = { x: p2.x + Math.sin(first.theta2) * rayLen, y: H - Math.cos(first.theta2) * rayLen };
  const shiftCm = slabThicknessCm * Math.sin(theta1 - first.theta2) / Math.max(0.02, Math.cos(first.theta2));
  return {
    incident: [incidentStart, p1],
    reflectedTop: [p1, reflectedEnd],
    refracted: [p1, p2],
    exit: second.tir ? null : [p2, exitEnd],
    tirReflected: second.tir ? [p2, tirEnd] : null,
    theta2: first.theta2,
    thetaExit: second.theta2,
    shiftCm,
    tirBottom: second.tir,
    criticalDeg: deg(Math.asin(1 / n2)),
  };
}

function traceHemisphereCenter(theta1: number, R: number): HemisphereTrace {
  const center: Point = { x: 0, y: 0 };
  const exitPt: Point = { x: Math.sin(theta1) * R, y: Math.cos(theta1) * R };
  const insideStart: Point = { x: -Math.sin(theta1) * 50, y: -Math.cos(theta1) * 50 };
  const outsideEnd: Point = { x: exitPt.x + Math.sin(theta1) * 120, y: exitPt.y + Math.cos(theta1) * 120 };
  return {
    incident: [insideStart, center],
    refracted: [center, exitPt],
    exit: [exitPt, outsideEnd],
    theta2: theta1,
    exitIncidenceDeg: 0,
    criticalDeg: null,
    mode: 'center',
    noRefractionAtCurve: true,
    tir: false,
  };
}

function traceHemispherePlane(theta1: number, nGlass: number, radiusCm: number): HemisphereTrace | null {
  const R = radiusCm * 22;
  const rayLen = 150;
  const entryX = -0.42 * R;
  const p1: Point = { x: entryX, y: 0 };
  const incidentStart: Point = { x: entryX - Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const reflectedEnd: Point = { x: entryX + Math.sin(theta1) * rayLen, y: -Math.cos(theta1) * rayLen };
  const first = snellRefract(theta1, 1, nGlass);
  if (first.tir) return null;
  const dir = norm({ x: Math.sin(first.theta2), y: Math.cos(first.theta2) });
  const B = 2 * dot(p1, dir);
  const C = dot(p1, p1) - R * R;
  const disc = B * B - 4 * C;
  if (disc <= 0) return null;
  const s = (-B + Math.sqrt(disc)) / 2;
  const exitPt: Point = { x: p1.x + dir.x * s, y: p1.y + dir.y * s };
  const normal = norm(exitPt);
  const exitIncidence = Math.acos(clamp(dot(dir, normal), -1, 1));
  const second = snellRefract(exitIncidence, nGlass, 1);
  const criticalDeg = deg(Math.asin(1 / nGlass));

  if (second.tir) {
    const projection = 2 * dot(dir, normal);
    const refl = { x: dir.x - projection * normal.x, y: dir.y - projection * normal.y };
    return {
      incident: [incidentStart, p1],
      reflectedTop: [p1, reflectedEnd],
      refracted: [p1, exitPt],
      exit: null,
      tirReflected: [exitPt, { x: exitPt.x + refl.x * 120, y: exitPt.y + refl.y * 120 }],
      theta2: first.theta2,
      exitIncidenceDeg: deg(exitIncidence),
      criticalDeg,
      mode: 'plane',
      noRefractionAtCurve: false,
      tir: true,
    };
  }

  const eta = nGlass / 1;
  const cosI = dot(dir, normal);
  const cosT = Math.cos(second.theta2);
  const outDir = norm({
    x: eta * dir.x + (eta * cosI - cosT) * normal.x,
    y: eta * dir.y + (eta * cosI - cosT) * normal.y,
  });

  return {
    incident: [incidentStart, p1],
    reflectedTop: [p1, reflectedEnd],
    refracted: [p1, exitPt],
    exit: [exitPt, { x: exitPt.x + outDir.x * 120, y: exitPt.y + outDir.y * 120 }],
    tirReflected: null,
    theta2: first.theta2,
    exitIncidenceDeg: deg(exitIncidence),
    criticalDeg,
    mode: 'plane',
    noRefractionAtCurve: false,
    tir: false,
  };
}

function traceFiber(theta1: number, coreN: number, cladN: number, bendRadiusCm: number): FiberTrace | null {
  const rayLen = 120;
  const L = 420;
  const W = 68;
  const enter: Point = { x: 0, y: 0 };
  const incidentStart: Point = { x: -Math.cos(theta1) * rayLen, y: -Math.sin(theta1) * rayLen };
  const entry = snellRefract(theta1, 1, coreN);
  if (entry.tir) return null;
  const thetaCore = entry.theta2;
  let dir: Point = { x: Math.cos(thetaCore), y: Math.sin(thetaCore) };
  let pos: Point = { ...enter };
  const points: Point[] = [{ ...pos }];
  const criticalDeg = deg(Math.asin(clamp(cladN / coreN, 0, 1)));
  const wallIncidenceDeg = 90 - deg(thetaCore);
  const bendPenaltyDeg = Math.min(16, 34 / Math.max(2, bendRadiusCm));
  const effectiveWallIncidenceDeg = wallIncidenceDeg - bendPenaltyDeg;
  const tirOccurs = effectiveWallIncidenceDeg > criticalDeg;
  let guard = 28;
  let leak: [Point, Point] | null = null;

  while (guard-- > 0) {
    const tRight = dir.x !== 0 ? (L - pos.x) / dir.x : Infinity;
    const targetY = dir.y > 0 ? W / 2 : -W / 2;
    const tWall = dir.y !== 0 ? (targetY - pos.y) / dir.y : Infinity;

    if (tRight <= tWall) {
      pos = { x: pos.x + dir.x * tRight, y: pos.y + dir.y * tRight };
      points.push(pos);
      break;
    }

    pos = { x: pos.x + dir.x * tWall, y: pos.y + dir.y * tWall };
    points.push(pos);
    if (!tirOccurs) {
      leak = [pos, { x: pos.x + dir.x * 100, y: pos.y + dir.y * 100 }];
      break;
    }
    dir = { x: dir.x, y: -dir.y };
  }

  const exit: [Point, Point] | null = points[points.length - 1].x >= L - 0.5
    ? [points[points.length - 1], { x: L + 80, y: points[points.length - 1].y + dir.y * 80 }]
    : null;

  return {
    incident: [incidentStart, enter],
    path: points,
    exit,
    leak,
    thetaCoreDeg: deg(thetaCore),
    criticalDeg,
    wallIncidenceDeg,
    effectiveWallIncidenceDeg,
    tirOccurs,
    bendPenaltyDeg,
  };
}

function RefractionModule({ settings }: { settings: RefractionSettings }) {
  const rayColor = pickRayColor(settings);
  const showNormals = settings.showNormals;
  const showAngles = settings.showAngles;
  const VW = 800;
  const VH = 520;
  const origin: Point = { x: VW * 0.5, y: VH * 0.36 };

  let geometry: any = null;
  let placardName = '';
  let placardDesc = '';
  let hudChips: any[] = [];

  if (settings.experimentId === 'opt-001') {
    const trace = traceInterface(rad(settings.theta1Deg), settings.medium1N, settings.medium2N);
    placardName = '平行界面折射';
    placardDesc = '支持独立调节 n1 / n2。若 n1 > n2 且入射角超过临界角，则不再出现折射光。';
    geometry = (
      <g transform={`translate(${origin.x}, ${origin.y + 20})`}>
        <rect className="glass" x={-300} y={0} width={600} height={180} rx={2} />
        <line className="interface" x1={-300} y1={0} x2={300} y2={0} />
        {showNormals && <line className="normal-line" x1={0} y1={-130} x2={0} y2={180} />}
        <text className="label-txt dim" x={-284} y={-10}>介质 1 · n₁ = {settings.medium1N.toFixed(3)}</text>
        <text className="label-txt dim" x={-284} y={94}>介质 2 · n₂ = {settings.medium2N.toFixed(3)}</text>
        <RayDraw trace={trace} color={rayColor} thick={settings.rayThick} />
        {showAngles && !trace.tir && (
          <AngleArcs points={[
            { vx: 0, vy: 0, a1: -Math.PI / 2, a2: -Math.PI / 2 + rad(settings.theta1Deg), label: `θ₁=${fmt(settings.theta1Deg, 1)}°`, r: 26 },
            { vx: 0, vy: 0, a1: Math.PI / 2, a2: Math.PI / 2 - trace.theta2, label: `θ₂=${fmt(deg(trace.theta2), 1)}°`, r: 36 },
          ]} />
        )}
      </g>
    );
    hudChips = [
      <span key="a" className="chip"><span className="dot" />n₁ / n₂ = {settings.medium1N.toFixed(2)} / {settings.medium2N.toFixed(2)}</span>,
      <span key="b" className="chip"><span className="dot" />波长 λ = {settings.wavelength} nm</span>,
      trace.criticalDeg !== null && (
        <span key="c" className={`chip ${settings.theta1Deg >= trace.criticalDeg ? 'warn' : 'ok'}`}>
          <span className="dot" />临界角 θc = {fmt(trace.criticalDeg, 2)}°
        </span>
      ),
    ].filter(Boolean);
  }

  if (settings.experimentId === 'opt-002') {
    const trace = traceSlab(rad(settings.theta1Deg), settings.slabIndex, settings.slabThicknessCm);
    placardName = '矩形玻璃砖';
    placardDesc = '两次折射后出射光与入射光平行，但会产生侧向位移；厚度越大、折射率越高，偏移更明显。';
    geometry = trace && (
      <g transform={`translate(${origin.x}, ${origin.y})`}>
        <rect className="glass" x={-260} y={0} width={520} height={settings.slabThicknessCm * 18} rx={2} />
        <line className="interface" x1={-260} y1={0} x2={260} y2={0} />
        <line className="interface" x1={-260} y1={settings.slabThicknessCm * 18} x2={260} y2={settings.slabThicknessCm * 18} />
        {showNormals && (
          <>
            <line className="normal-line" x1={0} y1={-120} x2={0} y2={settings.slabThicknessCm * 18 + 120} />
            <line className="normal-line" x1={trace.refracted![1].x} y1={-20} x2={trace.refracted![1].x} y2={settings.slabThicknessCm * 18 + 120} />
          </>
        )}
        <text className="label-txt dim" x={-248} y={settings.slabThicknessCm * 9 + 4}>玻璃砖 · n = {settings.slabIndex.toFixed(3)}</text>
        <RayDraw trace={trace} color={rayColor} thick={settings.rayThick} />
        {showAngles && (
          <AngleArcs points={[
            { vx: 0, vy: 0, a1: -Math.PI / 2, a2: -Math.PI / 2 + rad(settings.theta1Deg), label: `θ₁=${fmt(settings.theta1Deg, 1)}°`, r: 24 },
            { vx: 0, vy: 0, a1: Math.PI / 2, a2: Math.PI / 2 - trace.theta2, label: `θ₂=${fmt(deg(trace.theta2), 1)}°`, r: 34 },
          ]} />
        )}
      </g>
    );
    hudChips = trace ? [
      <span key="a" className="chip"><span className="dot" />厚度 d = {settings.slabThicknessCm.toFixed(1)} cm</span>,
      <span key="b" className="chip"><span className="dot" />折射率 n = {settings.slabIndex.toFixed(2)}</span>,
      <span key="c" className="chip ok"><span className="dot" />侧移 Δ = {fmt(trace.shiftCm, 2)} cm</span>,
    ] : [];
  }

  if (settings.experimentId === 'opt-003') {
    const R = settings.hemisphereRadiusCm * 22;
    const trace = settings.hemisphereMode === 'center'
      ? traceHemisphereCenter(rad(settings.theta1Deg), R)
      : traceHemispherePlane(rad(settings.theta1Deg), settings.hemisphereIndex, settings.hemisphereRadiusCm);
    placardName = settings.hemisphereMode === 'center' ? '半球形玻璃砖 · 球心入射' : '半球形玻璃砖 · 平面入射';
    placardDesc = settings.hemisphereMode === 'center'
      ? '光线穿过球心到达曲面时沿法线方向出射，曲面处不发生偏折。'
      : '先在平面折射进入玻璃，再到达曲面；当内部入射角大于临界角时，在曲面发生全反射。';
    geometry = trace && (
      <g transform={`translate(${origin.x}, ${origin.y - 10})`}>
        <path className="glass" d={`M ${-R} 0 L ${R} 0 A ${R} ${R} 0 0 1 ${-R} 0 Z`} />
        <line className="interface" x1={-R - 40} y1={0} x2={R + 40} y2={0} />
        {showNormals && settings.hemisphereMode === 'plane' && trace.refracted && (
          <>
            <line className="normal-line" x1={trace.incident![1].x} y1={-110} x2={trace.incident![1].x} y2={R + 40} />
            <line className="normal-line" x1={trace.refracted[1].x} y1={trace.refracted[1].y}
              x2={trace.refracted[1].x + trace.refracted[1].x * 0.35}
              y2={trace.refracted[1].y + trace.refracted[1].y * 0.35} />
          </>
        )}
        {showNormals && settings.hemisphereMode === 'center' && (
          <line className="normal-line" x1={0} y1={0} x2={trace.exit![0].x} y2={trace.exit![0].y} />
        )}
        <text className="label-txt dim" x={-R + 10} y={R * 0.56}>玻璃 · n = {settings.hemisphereIndex.toFixed(3)}</text>
        <RayDraw trace={trace} color={rayColor} thick={settings.rayThick} />
      </g>
    );
    hudChips = trace ? [
      <span key="a" className="chip"><span className="dot" />半径 R = {settings.hemisphereRadiusCm.toFixed(1)} cm</span>,
      <span key="b" className="chip"><span className="dot" />折射率 n = {settings.hemisphereIndex.toFixed(2)}</span>,
      settings.hemisphereMode === 'plane' && trace.criticalDeg !== null && (
        <span key="c" className={`chip ${trace.tir ? 'warn' : 'ok'}`}>
          <span className="dot" />曲面临界角 θc = {fmt(trace.criticalDeg, 2)}°
        </span>
      ),
    ].filter(Boolean) : [];
  }

  if (settings.experimentId === 'opt-004') {
    const fiber = traceFiber(rad(settings.theta1Deg), settings.fiberCoreN, settings.fiberCladdingN, settings.fiberBendRadiusCm);
    placardName = '光导纤维模型';
    placardDesc = '光先从空气射入纤芯，再在芯-包层界面多次全反射传播。弯曲半径越小，等效入射裕量越少，更容易漏光。';
    geometry = fiber && (
      <g transform={`translate(${(VW - 420) / 2}, ${VH / 2})`}>
        <rect className="glass" x={0} y={-34} width={420} height={68} rx={3} />
        <rect fill="none" stroke="var(--border-strong)" strokeDasharray="4 4" x={-6} y={-42} width={432} height={84} rx={8} />
        {showNormals && (
          <>
            <line className="normal-line" x1={0} y1={-70} x2={0} y2={70} />
            <line className="normal-line" x1={120} y1={-34} x2={120} y2={34} />
          </>
        )}
        <path d={`M 300 -80 A ${Math.max(24, settings.fiberBendRadiusCm * 4)} ${Math.max(24, settings.fiberBendRadiusCm * 4)} 0 0 1 380 -10`}
          fill="none" stroke="var(--ink-3)" strokeDasharray="4 4" opacity="0.5" />
        <text className="label-txt dim" x={300} y={-88}>弯曲半径 R ≈ {settings.fiberBendRadiusCm.toFixed(0)} cm</text>
        <text className="label-txt dim" x={10} y={-46}>纤芯 n₁ = {settings.fiberCoreN.toFixed(3)}</text>
        <text className="label-txt dim" x={10} y={54}>包层 n₂ = {settings.fiberCladdingN.toFixed(3)}</text>
        <line className="ray" x1={fiber.incident[0].x} y1={fiber.incident[0].y}
          x2={fiber.incident[1].x} y2={fiber.incident[1].y}
          stroke={rayColor} strokeWidth={settings.rayThick} />
        <polyline className="ray"
          points={fiber.path.map((p) => `${p.x},${p.y}`).join(' ')}
          stroke={rayColor} strokeWidth={settings.rayThick} fill="none" />
        {fiber.exit && (
          <line className="ray" x1={fiber.exit[0].x} y1={fiber.exit[0].y}
            x2={fiber.exit[1].x} y2={fiber.exit[1].y}
            stroke={rayColor} strokeWidth={settings.rayThick} />
        )}
        {fiber.leak && (
          <line className="ray" x1={fiber.leak[0].x} y1={fiber.leak[0].y}
            x2={fiber.leak[1].x} y2={fiber.leak[1].y}
            stroke="oklch(0.68 0.17 35)" strokeWidth={settings.rayThick + 0.3} />
        )}
      </g>
    );
    hudChips = fiber ? [
      <span key="a" className="chip"><span className="dot" />θ纤芯 = {fmt(fiber.thetaCoreDeg, 2)}°</span>,
      <span key="b" className={`chip ${fiber.tirOccurs ? 'ok' : 'warn'}`}>
        <span className="dot" />壁面入射 {fmt(fiber.effectiveWallIncidenceDeg, 2)}° / 临界角 {fmt(fiber.criticalDeg, 2)}°
      </span>,
      <span key="c" className="chip"><span className="dot" />弯曲惩罚 ≈ {fmt(fiber.bendPenaltyDeg, 1)}°</span>,
    ] : [];
  }

  return (
    <>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <GridBg w={VW} h={VH} />
        {geometry}
      </svg>

      <div className="legend">
        <div className="legend-title">图例 Legend</div>
        <div className="legend-row"><span className="swatch" style={{ background: rayColor }} /><span className="label">光线</span></div>
        <div className="legend-row"><span className="swatch dashed" /><span className="label">法线</span></div>
        <div className="legend-row"><span className="swatch" style={{ background: 'var(--glass-stroke)' }} /><span className="label">介质 / 界面</span></div>
      </div>

      <div className="placard">
        <div className="name">{placardName}</div>
        <div className="desc">{placardDesc}</div>
      </div>

      <div className="hud">{hudChips}</div>
    </>
  );
}

function RayDraw({ trace, color, thick }: { trace: AnyTrace; color: string; thick: number }) {
  const seg = (s: [Point, Point] | null | undefined, stroke: string = color) => s && (
    <line className="ray" x1={s[0].x} y1={s[0].y} x2={s[1].x} y2={s[1].y} stroke={stroke} strokeWidth={thick} />
  );
  return (
    <>
      {seg(trace.incident)}
      {seg(trace.reflectedTop, 'oklch(0.62 0.17 25)')}
      {seg(trace.refracted)}
      {seg(trace.exit)}
      {seg(trace.tirReflected, 'oklch(0.68 0.17 35)')}
    </>
  );
}

interface ArcSpec { vx: number; vy: number; a1: number; a2: number; label: string; r?: number; }
function AngleArcs({ points }: { points: ArcSpec[] }) {
  return (
    <>
      {points.map((p, i) => {
        const r = p.r || 24;
        const x1 = p.vx + r * Math.cos(p.a1);
        const y1 = p.vy + r * Math.sin(p.a1);
        const x2 = p.vx + r * Math.cos(p.a2);
        const y2 = p.vy + r * Math.sin(p.a2);
        const large = Math.abs(p.a2 - p.a1) > Math.PI ? 1 : 0;
        const sweep = p.a2 > p.a1 ? 1 : 0;
        const lx = p.vx + (r + 14) * Math.cos((p.a1 + p.a2) / 2);
        const ly = p.vy + (r + 14) * Math.sin((p.a1 + p.a2) / 2);
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`} fill="none" stroke="var(--accent)" strokeWidth="1.3" />
            <text className="label-txt" x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--accent)">{p.label}</text>
          </g>
        );
      })}
    </>
  );
}

function GridBg({ w, h, step = 20 }: { w: number; h: number; step?: number }) {
  const lines: any[] = [];
  for (let x = 0; x <= w; x += step) lines.push(<line key={'vx' + x} className={`grid-line${x % 100 === 0 ? ' strong' : ''}`} x1={x} y1={0} x2={x} y2={h} />);
  for (let y = 0; y <= h; y += step) lines.push(<line key={'hy' + y} className={`grid-line${y % 100 === 0 ? ' strong' : ''}`} x1={0} y1={y} x2={w} y2={y} />);
  return <g>{lines}</g>;
}

function nearestMaterialLabel(n: number): string {
  let best = MATERIALS.glass.label;
  let delta = Infinity;
  for (const value of Object.values(MATERIALS)) {
    const d = Math.abs(value.n - n);
    if (d < delta) {
      delta = d;
      best = value.label;
    }
  }
  return best;
}

function applyRefractionExperiment(settings: RefractionSettings, experimentId: RefractionExperimentId): RefractionSettings {
  const experiment = (window as any).getP03Experiment('refraction', experimentId) as ExperimentSpec | undefined;
  if (!experiment) return settings;
  return {
    ...settings,
    ...experiment.defaults,
    experimentId,
  } as RefractionSettings;
}

function RefractionControls({ settings, setSettings }: { settings: RefractionSettings; setSettings: (s: RefractionSettings) => void }) {
  const SectionTitle = (window as any).SectionTitle;
  const Slider = (window as any).Slider;
  const Toggle = (window as any).Toggle;
  const SegSelect = (window as any).SegSelect;
  const getParamSpec = (key: string): ExperimentParamSpec | undefined => (window as any).getP03ParamSpec('refraction', settings.experimentId, key);
  const materialOptions = (Object.entries(MATERIALS) as [MaterialKey, Material][])
    .filter(([k]) => k !== 'fiber' && k !== 'air');

  return (
    <>
      <SectionTitle aside="EXPERIMENT">实验选择</SectionTitle>
      <div className="seg vertical">
        {REFRACTION_EXPERIMENTS.map((item) => (
          <button
            key={item.id}
            className={settings.experimentId === item.id ? 'seg-item active' : 'seg-item'}
            onClick={() => setSettings(applyRefractionExperiment(settings, item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>

      {settings.experimentId === 'opt-001' && (
        <>
          <SectionTitle aside="MEDIA">介质参数</SectionTitle>
          <Slider label="入射角 θ₁" value={settings.theta1Deg}
            onChange={(v: number) => setSettings({ ...settings, theta1Deg: v })}
            min={getParamSpec('theta1Deg')?.min ?? 0} max={getParamSpec('theta1Deg')?.max ?? 89} step={getParamSpec('theta1Deg')?.step ?? 0.5} unit="°" />
          <Slider label="介质 1 折射率 n₁" value={settings.medium1N}
            onChange={(v: number) => setSettings({ ...settings, medium1N: v })}
            min={getParamSpec('medium1N')?.min ?? 1.0} max={getParamSpec('medium1N')?.max ?? 2.5} step={getParamSpec('medium1N')?.step ?? 0.01} unit="" />
          <Slider label="介质 2 折射率 n₂" value={settings.medium2N}
            onChange={(v: number) => setSettings({ ...settings, medium2N: v })}
            min={getParamSpec('medium2N')?.min ?? 1.0} max={getParamSpec('medium2N')?.max ?? 2.5} step={getParamSpec('medium2N')?.step ?? 0.01} unit="" />
        </>
      )}

      {settings.experimentId === 'opt-002' && (
        <>
          <SectionTitle aside="BLOCK">玻璃砖参数</SectionTitle>
          <Slider label="入射角 θ" value={settings.theta1Deg}
            onChange={(v: number) => setSettings({ ...settings, theta1Deg: v })}
            min={getParamSpec('theta1Deg')?.min ?? 0} max={getParamSpec('theta1Deg')?.max ?? 89} step={getParamSpec('theta1Deg')?.step ?? 0.5} unit="°" />
          <Slider label="玻璃折射率 n" value={settings.slabIndex}
            onChange={(v: number) => setSettings({ ...settings, slabIndex: v })}
            min={getParamSpec('slabIndex')?.min ?? 1.3} max={getParamSpec('slabIndex')?.max ?? 2.0} step={getParamSpec('slabIndex')?.step ?? 0.01} unit="" />
          <Slider label="玻璃砖厚度 d" value={settings.slabThicknessCm}
            onChange={(v: number) => setSettings({ ...settings, slabThicknessCm: v })}
            min={getParamSpec('slabThicknessCm')?.min ?? 1} max={getParamSpec('slabThicknessCm')?.max ?? 20} step={getParamSpec('slabThicknessCm')?.step ?? 0.5} unit="cm" />
        </>
      )}

      {settings.experimentId === 'opt-003' && (
        <>
          <SectionTitle aside="HEMISPHERE">入射方式</SectionTitle>
          <SegSelect value={settings.hemisphereMode}
            onChange={(v: HemisphereMode) => setSettings({ ...settings, hemisphereMode: v })}
            options={[
              { value: 'plane', label: '平面入射' },
              { value: 'center', label: '球心入射' },
            ]} />
          <Slider label="入射角 θ" value={settings.theta1Deg}
            onChange={(v: number) => setSettings({ ...settings, theta1Deg: v })}
            min={getParamSpec('theta1Deg')?.min ?? 0} max={getParamSpec('theta1Deg')?.max ?? 89} step={getParamSpec('theta1Deg')?.step ?? 0.5} unit="°"
            hint={settings.hemisphereMode === 'center' ? '该模式用于演示曲面处法线与半径重合' : undefined} />
          <Slider label="折射率 n" value={settings.hemisphereIndex}
            onChange={(v: number) => setSettings({ ...settings, hemisphereIndex: v })}
            min={getParamSpec('hemisphereIndex')?.min ?? 1.3} max={getParamSpec('hemisphereIndex')?.max ?? 2.0} step={getParamSpec('hemisphereIndex')?.step ?? 0.01} unit="" />
          <Slider label="半径 R" value={settings.hemisphereRadiusCm}
            onChange={(v: number) => setSettings({ ...settings, hemisphereRadiusCm: v })}
            min={getParamSpec('hemisphereRadiusCm')?.min ?? 2} max={getParamSpec('hemisphereRadiusCm')?.max ?? 10} step={getParamSpec('hemisphereRadiusCm')?.step ?? 0.5} unit="cm" />
        </>
      )}

      {settings.experimentId === 'opt-004' && (
        <>
          <SectionTitle aside="FIBER">光纤参数</SectionTitle>
          <Slider label="入射角 θ" value={settings.theta1Deg}
            onChange={(v: number) => setSettings({ ...settings, theta1Deg: v })}
            min={0} max={60} step={0.5} unit="°" />
          <Slider label="纤芯折射率 n₁" value={settings.fiberCoreN}
            onChange={(v: number) => setSettings({ ...settings, fiberCoreN: Math.max(v, settings.fiberCladdingN + 0.01) })}
            min={getParamSpec('fiberCoreN')?.min ?? 1.3} max={getParamSpec('fiberCoreN')?.max ?? 2.0} step={getParamSpec('fiberCoreN')?.step ?? 0.01} unit="" />
          <Slider label="包层折射率 n₂" value={settings.fiberCladdingN}
            onChange={(v: number) => setSettings({ ...settings, fiberCladdingN: Math.min(v, settings.fiberCoreN - 0.01) })}
            min={getParamSpec('fiberCladdingN')?.min ?? 1.0} max={getParamSpec('fiberCladdingN')?.max ?? 1.8} step={getParamSpec('fiberCladdingN')?.step ?? 0.01} unit="" />
          <Slider label="弯曲半径 R" value={settings.fiberBendRadiusCm}
            onChange={(v: number) => setSettings({ ...settings, fiberBendRadiusCm: v })}
            min={getParamSpec('fiberBendRadiusCm')?.min ?? 2} max={getParamSpec('fiberBendRadiusCm')?.max ?? 50} step={getParamSpec('fiberBendRadiusCm')?.step ?? 1} unit="cm" />
        </>
      )}

      <SectionTitle aside="WAVELENGTH">波长 / 颜色</SectionTitle>
      <Slider label="波长 λ" value={settings.wavelength}
        onChange={(v: number) => setSettings({ ...settings, wavelength: v })}
        min={380} max={780} step={5} unit="nm"
        hint={nearestMaterialLabel(settings.experimentId === 'opt-001' ? settings.medium2N : settings.experimentId === 'opt-002' ? settings.slabIndex : settings.experimentId === 'opt-003' ? settings.hemisphereIndex : settings.fiberCoreN)} />

      <SectionTitle aside="DISPLAY">显示选项</SectionTitle>
      <Toggle label="角度标注" checked={settings.showAngles}
        onChange={(v: boolean) => setSettings({ ...settings, showAngles: v })} />
      <Toggle label="法线显示" checked={settings.showNormals}
        onChange={(v: boolean) => setSettings({ ...settings, showNormals: v })} />
      <Toggle label="颜色显示" checked={settings.showColor}
        onChange={(v: boolean) => setSettings({ ...settings, showColor: v })} />
      <Toggle label="公式验证" checked={settings.showFormula}
        onChange={(v: boolean) => setSettings({ ...settings, showFormula: v })} />

      <SectionTitle aside="MATERIAL">常用介质</SectionTitle>
      <div className="preset-row">
        {materialOptions.map(([key, value]) => (
          <button
            key={key}
            className="preset-btn"
            onClick={() => {
              if (settings.experimentId === 'opt-001') {
                setSettings({ ...settings, material: key, medium2N: value.n });
              } else if (settings.experimentId === 'opt-002') {
                setSettings({ ...settings, material: key, slabIndex: value.n });
              } else if (settings.experimentId === 'opt-003') {
                setSettings({ ...settings, material: key, hemisphereIndex: value.n });
              } else {
                setSettings({ ...settings, material: key, fiberCoreN: Math.max(value.n, settings.fiberCladdingN + 0.01) });
              }
            }}
          >
            {value.label}
          </button>
        ))}
      </div>
    </>
  );
}

function RefractionReadouts({ settings }: { settings: RefractionSettings }) {
  const SectionTitle = (window as any).SectionTitle;
  const Readout = (window as any).Readout;
  const FormulaBlock = (window as any).FormulaBlock;

  let readouts: any = null;
  let formulas: any = null;

  if (settings.experimentId === 'opt-001') {
    const trace = traceInterface(rad(settings.theta1Deg), settings.medium1N, settings.medium2N);
    readouts = (
      <>
        <Readout label="入射角 θ₁" value={fmt(settings.theta1Deg, 1)} unit="°" />
        <Readout label="折射角 θ₂" value={trace.tir ? '全反射' : fmt(deg(trace.theta2), 2)} unit={trace.tir ? '' : '°'} hi />
        <Readout label="介质 1 折射率 n₁" value={settings.medium1N.toFixed(3)} unit="" />
        <Readout label="介质 2 折射率 n₂" value={settings.medium2N.toFixed(3)} unit="" />
        <Readout label="临界角 θc" value={trace.criticalDeg === null ? '—' : fmt(trace.criticalDeg, 2)} unit="°" />
      </>
    );
    formulas = (
      <>
        <FormulaBlock>
          <span className="step"><span className="lhs">n₁ sin θ₁</span><span className="eq">=</span><span className="rhs">n₂ sin θ₂</span></span>
          <span className="step mono">{settings.medium1N.toFixed(3)} × sin({fmt(settings.theta1Deg, 1)}°) = {settings.medium2N.toFixed(3)} × sin θ₂</span>
          <span className="step"><span className="lhs">θ₂</span><span className="eq">=</span><span className="rhs"><span className="hi">{trace.tir ? 'TIR' : `${fmt(deg(trace.theta2), 2)}°`}</span></span></span>
        </FormulaBlock>
        {trace.criticalDeg !== null && (
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">n₂ / n₁</span></span>
            <span className="step mono">= {settings.medium2N.toFixed(3)} / {settings.medium1N.toFixed(3)}</span>
            <span className="step"><span className="lhs">θc</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(trace.criticalDeg, 2)}°</span></span></span>
          </FormulaBlock>
        )}
      </>
    );
  }

  if (settings.experimentId === 'opt-002') {
    const trace = traceSlab(rad(settings.theta1Deg), settings.slabIndex, settings.slabThicknessCm);
    if (trace) {
      readouts = (
        <>
          <Readout label="玻璃折射率 n" value={settings.slabIndex.toFixed(3)} unit="" />
          <Readout label="厚度 d" value={settings.slabThicknessCm.toFixed(1)} unit="cm" />
          <Readout label="折射角 θ₂" value={fmt(deg(trace.theta2), 2)} unit="°" />
          <Readout label="侧向位移 Δ" value={fmt(trace.shiftCm, 2)} unit="cm" hi />
          <Readout label="出射关系" value={trace.tirBottom ? '底面全反射' : '与入射光平行'} unit="" />
        </>
      );
      formulas = (
        <>
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θ₂</span><span className="eq">=</span><span className="rhs">sin θ₁ / n</span></span>
            <span className="step mono">= sin({fmt(settings.theta1Deg, 1)}°) / {settings.slabIndex.toFixed(3)}</span>
            <span className="step"><span className="lhs">θ₂</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(deg(trace.theta2), 2)}°</span></span></span>
          </FormulaBlock>
          <FormulaBlock>
            <span className="step"><span className="lhs">Δ</span><span className="eq">=</span><span className="rhs">d sin(θ₁ - θ₂) / cos θ₂</span></span>
            <span className="step"><span className="lhs">Δ</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(trace.shiftCm, 2)} cm</span></span></span>
          </FormulaBlock>
        </>
      );
    }
  }

  if (settings.experimentId === 'opt-003') {
    const trace = settings.hemisphereMode === 'center'
      ? traceHemisphereCenter(rad(settings.theta1Deg), settings.hemisphereRadiusCm * 22)
      : traceHemispherePlane(rad(settings.theta1Deg), settings.hemisphereIndex, settings.hemisphereRadiusCm);
    if (trace) {
      readouts = (
        <>
          <Readout label="半径 R" value={settings.hemisphereRadiusCm.toFixed(1)} unit="cm" />
          <Readout label="折射率 n" value={settings.hemisphereIndex.toFixed(3)} unit="" />
          <Readout label="模式" value={settings.hemisphereMode === 'center' ? '球心入射' : '平面入射'} unit="" />
          <Readout label="曲面入射角" value={trace.exitIncidenceDeg === null ? '0.00' : fmt(trace.exitIncidenceDeg, 2)} unit="°" hi />
          <Readout label="曲面临界角" value={trace.criticalDeg === null ? '—' : fmt(trace.criticalDeg, 2)} unit="°" />
        </>
      );
      formulas = settings.hemisphereMode === 'center' ? (
        <FormulaBlock>
          <span className="step"><span className="lhs">半径</span><span className="eq">=</span><span className="rhs">曲面法线</span></span>
          <span className="step">光线经过球心到达曲面时，入射方向与法线重合。</span>
          <span className="step"><span className="lhs">θ入射(曲面)</span><span className="eq">=</span><span className="rhs"><span className="hi">0°</span></span></span>
        </FormulaBlock>
      ) : (
        <>
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θ₂</span><span className="eq">=</span><span className="rhs">sin θ / n</span></span>
            <span className="step"><span className="lhs">平面折射后</span><span className="eq">→</span><span className="rhs">到达曲面判断是否全反射</span></span>
          </FormulaBlock>
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">1 / n</span></span>
            <span className="step"><span className="lhs">θc</span><span className="eq">=</span><span className="rhs"><span className="hi">{trace.criticalDeg === null ? '—' : `${fmt(trace.criticalDeg, 2)}°`}</span></span></span>
            <span className="step"><span className="lhs">当前曲面入射角</span><span className="eq">=</span><span className="rhs"><span className="hi">{trace.exitIncidenceDeg === null ? '—' : `${fmt(trace.exitIncidenceDeg, 2)}°`}</span></span></span>
          </FormulaBlock>
        </>
      );
    }
  }

  if (settings.experimentId === 'opt-004') {
    const trace = traceFiber(rad(settings.theta1Deg), settings.fiberCoreN, settings.fiberCladdingN, settings.fiberBendRadiusCm);
    if (trace) {
      readouts = (
        <>
          <Readout label="纤芯折射率 n₁" value={settings.fiberCoreN.toFixed(3)} unit="" />
          <Readout label="包层折射率 n₂" value={settings.fiberCladdingN.toFixed(3)} unit="" />
          <Readout label="纤芯传播角" value={fmt(trace.thetaCoreDeg, 2)} unit="°" />
          <Readout label="等效壁面入射角" value={fmt(trace.effectiveWallIncidenceDeg, 2)} unit="°" hi />
          <Readout label="判定" value={trace.tirOccurs ? '多次全反射' : '可能漏光'} unit="" />
        </>
      );
      formulas = (
        <>
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θ纤芯</span><span className="eq">=</span><span className="rhs">sin θ空气 / n₁</span></span>
            <span className="step"><span className="lhs">θ纤芯</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(trace.thetaCoreDeg, 2)}°</span></span></span>
          </FormulaBlock>
          <FormulaBlock>
            <span className="step"><span className="lhs">sin θc</span><span className="eq">=</span><span className="rhs">n₂ / n₁</span></span>
            <span className="step"><span className="lhs">θc</span><span className="eq">=</span><span className="rhs"><span className="hi">{fmt(trace.criticalDeg, 2)}°</span></span></span>
            <span className="step mono">等效壁面入射角 = {fmt(trace.wallIncidenceDeg, 2)}° − {fmt(trace.bendPenaltyDeg, 1)}°</span>
          </FormulaBlock>
        </>
      );
    }
  }

  return (
    <>
      <SectionTitle aside="LIVE">实时数值</SectionTitle>
      <div className="readouts">{readouts}</div>
      {settings.showFormula && (
        <>
          <SectionTitle aside="FORMULA">公式验证</SectionTitle>
          {formulas}
        </>
      )}
    </>
  );
}

Object.assign(window, {
  RefractionModule,
  RefractionControls,
  RefractionReadouts,
  MATERIALS,
});

export {};
