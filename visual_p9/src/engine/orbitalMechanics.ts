import { CONSTANTS } from '@/data/celestialData';

const TAU = Math.PI * 2;
const EARTH_RADIUS_M = 6.371e6;
const EARTH_RADIUS_PX = 28;
const ORBIT_SCALE_M_PER_PX = 3.0e5;

export interface Vec2 {
  x: number;
  y: number;
}

export interface BodyRenderState {
  id: string;
  label: string;
  hideLabel?: boolean;
  position: Vec2;
  velocity?: Vec2;
  acceleration?: Vec2;
  radiusPx: number;
  color: string;
}

export interface OrbitPath {
  id: string;
  label: string;
  points: Vec2[];
  color: string;
  dashed?: boolean;
}

export interface AreaSector {
  id: string;
  points: Vec2[];
  color: string;
  areaLabel: string;
}

export interface SimulationMetrics {
  modelId: string;
  title: string;
  values: Array<{ label: string; value: string; note?: string }>;
  insight: string;
}

export interface SceneFrame {
  scaleLabel: string;
  legend?: Array<{ label: string; color: string }>;
  center: Vec2;
  bodies: BodyRenderState[];
  paths: OrbitPath[];
  sectors: AreaSector[];
  vectors: Array<{ from: Vec2; to: Vec2; color: string; label: string }>;
  markers: Array<{ position: Vec2; label: string; color: string; cross?: boolean; labelOffset?: Vec2 }>;
  metrics: SimulationMetrics;
}

export type HohmannPhase = 'low' | 'transfer' | 'high' | 'transferDown';

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, unit = '', digits = 3): string {
  if (!Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const formatted = abs >= 1e5 || (abs > 0 && abs < 1e-2)
    ? value.toExponential(2)
    : value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
}

function normalizeAngle(rad: number): number {
  const value = rad % TAU;
  return value < 0 ? value + TAU : value;
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let eccentricAnomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI;
  for (let i = 0; i < 10; i += 1) {
    const f = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly;
    const fp = 1 - eccentricity * Math.cos(eccentricAnomaly);
    eccentricAnomaly -= f / fp;
  }
  return eccentricAnomaly;
}

function circularPoints(radius: number, count = 240): Vec2[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const theta = (index / count) * TAU;
    return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
  });
}

function ellipsePoints(a: number, b: number, cx: number, count = 320): Vec2[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const theta = (index / count) * TAU;
    return { x: cx + a * Math.cos(theta), y: b * Math.sin(theta) };
  });
}

function rotatePoint(point: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function arrowFrom(position: Vec2, vector: Vec2, lengthPx: number): Vec2 {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return position;
  return {
    x: position.x + (vector.x / length) * lengthPx,
    y: position.y + (vector.y / length) * lengthPx,
  };
}

function orbitalRadiusToPx(radiusM: number): number {
  return EARTH_RADIUS_PX + (radiusM - EARTH_RADIUS_M) / ORBIT_SCALE_M_PER_PX;
}

function hohmannRadiusToPx(radiusM: number): number {
  return EARTH_RADIUS_PX * (radiusM / EARTH_RADIUS_M);
}

function scaledRadiusPx(value: number, minValue: number, maxValue: number, minPx: number, maxPx: number): number {
  const safeMin = Math.max(minValue, 1e-9);
  const safeMax = Math.max(maxValue, safeMin * 1.000001);
  const normalized = (Math.log(Math.max(value, safeMin)) - Math.log(safeMin)) / (Math.log(safeMax) - Math.log(safeMin));
  return minPx + (maxPx - minPx) * clampNumber(normalized, 0, 1);
}

function speedToArrowLength(speed: number, minSpeed: number, maxSpeed: number, minLength = 28, maxLength = 64): number {
  return minLength + (maxLength - minLength) * clampNumber((speed - minSpeed) / Math.max(maxSpeed - minSpeed, 1e-6), 0, 1);
}

export function computeCircularMetrics(params: Record<string, number>): SimulationMetrics {
  const M = params.centralMassKg;
  const mu = CONSTANTS.gravitationalConstant * M;
  const earthSpin = TAU / CONSTANTS.secondsPerDay;
  const nearRadiusM = params.lowOrbitRadiusM;
  const syncRadiusM = Math.cbrt(mu / earthSpin ** 2);
  const highRadiusM = params.highOrbitRadiusM;
  const nearSpeed = Math.sqrt(mu / nearRadiusM);
  const syncSpeed = Math.sqrt(mu / syncRadiusM);
  const highSpeed = Math.sqrt(mu / highRadiusM);
  const nearPeriod = TAU * Math.sqrt(nearRadiusM ** 3 / mu);
  const syncPeriod = TAU * Math.sqrt(syncRadiusM ** 3 / mu);
  const highPeriod = TAU * Math.sqrt(highRadiusM ** 3 / mu);

  return {
    modelId: 'CEL-001',
    title: '圆轨道三卫星对比',
    insight: '三颗卫星共享同一中心天体：轨道越高，速度越小，周期越大。',
    values: [
      { label: '近地卫星速度', value: formatNumber(nearSpeed / 1000, 'km/s'), note: `T=${formatNumber(nearPeriod / 3600, 'h')}` },
      { label: '同步卫星速度', value: formatNumber(syncSpeed / 1000, 'km/s'), note: `T=${formatNumber(syncPeriod / 3600, 'h')}` },
      { label: '高轨卫星速度', value: formatNumber(highSpeed / 1000, 'km/s'), note: `T=${formatNumber(highPeriod / 3600, 'h')}` },
      { label: '同步轨道半径', value: formatNumber(syncRadiusM, 'm'), note: syncRadiusM > highRadiusM ? '超出当前高轨范围' : undefined },
      { label: '可调高轨半径', value: formatNumber(highRadiusM, 'm') },
    ],
  };
}

export function buildCircularFrame(params: Record<string, number>, time: number): SceneFrame {
  const M = params.centralMassKg;
  const mu = CONSTANTS.gravitationalConstant * M;
  const nearRadiusM = params.lowOrbitRadiusM;
  const earthSpin = TAU / CONSTANTS.secondsPerDay;
  const syncRadiusM = Math.cbrt(mu / earthSpin ** 2);
  const highRadiusM = params.highOrbitRadiusM;
  const earthTheta = normalizeAngle(time * earthSpin);
  const satellites = [
    { id: 'near', label: '低轨卫星', orbitRadiusM: nearRadiusM, radiusPx: orbitalRadiusToPx(nearRadiusM), color: '#64B5F6', phaseOffset: 0.95 },
    { id: 'sync', label: '同步卫星', orbitRadiusM: syncRadiusM, radiusPx: orbitalRadiusToPx(syncRadiusM), color: '#A7F3D0', phaseOffset: 0 },
    { id: 'high', label: '高轨卫星', orbitRadiusM: highRadiusM, radiusPx: orbitalRadiusToPx(highRadiusM), color: '#F9D65C', phaseOffset: 1.7 },
  ].map((satellite) => {
    const omega = Math.sqrt(mu / satellite.orbitRadiusM ** 3);
    const theta = normalizeAngle(time * omega + satellite.phaseOffset);
    const speed = Math.sqrt(mu / satellite.orbitRadiusM);
    const period = TAU / omega;
    const position = { x: Math.cos(theta) * satellite.radiusPx, y: Math.sin(theta) * satellite.radiusPx };
    const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
    const inward = { x: -Math.cos(theta), y: -Math.sin(theta) };
    return { ...satellite, theta, speed, period, position, tangent, inward };
  });
  const speedMin = Math.min(...satellites.map((satellite) => satellite.speed));
  const speedMax = Math.max(...satellites.map((satellite) => satellite.speed));
  const speedArrowLength = (speed: number) => speedToArrowLength(speed, speedMin, speedMax);
  const earthRotationLine = [
    rotatePoint({ x: -30, y: 0 }, earthTheta),
    rotatePoint({ x: 30, y: 0 }, earthTheta),
  ];

  return {
    scaleLabel: `近地 T=${formatNumber(satellites[0].period / 3600, 'h')} · 同步 T=${formatNumber(satellites[1].period / 3600, 'h')} · 高轨 T=${formatNumber(satellites[2].period / 3600, 'h')}`,
    center: { x: 0, y: 0 },
    paths: [
      { id: 'earth-spin', label: '地球自转参考线', points: earthRotationLine, color: '#64B5F6' },
      { id: 'near-orbit', label: '近地轨道', points: circularPoints(satellites[0].radiusPx), color: '#64B5F6' },
      { id: 'sync-orbit', label: '同步轨道', points: circularPoints(satellites[1].radiusPx), color: '#A7F3D0', dashed: true },
      { id: 'high-orbit', label: '高轨轨道', points: circularPoints(satellites[2].radiusPx), color: '#F9D65C', dashed: true },
    ],
    legend: [
      { label: '地球', color: '#FF9800' },
      ...satellites.map((satellite) => ({ label: satellite.label, color: satellite.color })),
    ],
    sectors: [],
    bodies: [
      { id: 'earth', label: '地球', hideLabel: true, position: { x: 0, y: 0 }, radiusPx: EARTH_RADIUS_PX, color: '#FF9800' },
      ...satellites.map((satellite) => ({
        id: satellite.id,
        label: satellite.label,
        hideLabel: true,
        position: satellite.position,
        velocity: satellite.tangent,
        acceleration: satellite.inward,
        radiusPx: 7,
        color: satellite.color,
      })),
    ],
    vectors: satellites.flatMap((satellite) => [
      { from: satellite.position, to: arrowFrom(satellite.position, satellite.tangent, speedArrowLength(satellite.speed)), color: '#4CAF50', label: `v ${formatNumber(satellite.speed / 1000, 'km/s', 2)}` },
      { from: satellite.position, to: arrowFrom(satellite.position, satellite.inward, 22), color: '#FF9800', label: 'a' },
    ]),
    markers: [
      { position: rotatePoint({ x: 36, y: 0 }, earthTheta), label: '', color: '#64B5F6' },
      { position: { x: satellites[2].radiusPx, y: 0 }, label: `高轨 r=${formatNumber(highRadiusM / EARTH_RADIUS_M, 'R⊕', 1)}`, color: '#F9D65C' },
    ],
    metrics: computeCircularMetrics(params),
  };
}

export function computeEllipseMetrics(params: Record<string, number>): SimulationMetrics {
  const rNear = params.periapsisRadiusM;
  const rFar = params.apoapsisRadiusM;
  const aM = (rNear + rFar) / 2;
  const e = (rFar - rNear) / (rFar + rNear);
  const M = params.centralMassKg;
  const mu = CONSTANTS.gravitationalConstant * M;
  const period = TAU * Math.sqrt(aM ** 3 / mu);
  const vNear = Math.sqrt(mu * (2 / rNear - 1 / aM));
  const vFar = Math.sqrt(mu * (2 / rFar - 1 / aM));
  const thirdLaw = period ** 2 / aM ** 3;

  return {
    modelId: 'CEL-002',
    title: '开普勒三定律',
    insight: '近日点半径更小，速度更大；固定等时间扇形的面积保持相等。',
    values: [
      { label: '近日点 r近', value: formatNumber(rNear / 1000, 'km') },
      { label: '远日点 r远', value: formatNumber(rFar / 1000, 'km') },
      { label: 'v近 / v远', value: (vNear / vFar).toFixed(3), note: '近日点最大，远地点最小' },
      { label: '离心率 e', value: e.toFixed(3) },
      { label: '周期 T', value: formatNumber(period / CONSTANTS.secondsPerDay, 'd') },
      { label: 'T^2/a^3', value: formatNumber(thirdLaw, 's^2/m^3') },
    ],
  };
}

export function buildEllipseFrame(params: Record<string, number>, time: number): SceneFrame {
  const rNearM = params.periapsisRadiusM;
  const rFarM = params.apoapsisRadiusM;
  const aM = (rNearM + rFarM) / 2;
  const e = (rFarM - rNearM) / (rFarM + rNearM);
  const aPx = (orbitalRadiusToPx(rNearM) + orbitalRadiusToPx(rFarM)) / 2;
  const bPx = aPx * Math.sqrt(1 - e ** 2);
  const focusXPx = -aPx * e;
  const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
  const period = TAU * Math.sqrt(aM ** 3 / mu);
  const meanAnomaly = normalizeAngle((time / period) * TAU);
  const E = solveKepler(meanAnomaly, e);
  const position = { x: -aPx * Math.cos(E), y: bPx * Math.sin(E) };
  const fromFocus = { x: position.x - focusXPx, y: position.y };
  const velocityScale = 1 / Math.max(1 - e * Math.cos(E), 1e-6);
  const velocity = { x: Math.sin(E) * velocityScale, y: Math.sqrt(1 - e ** 2) * Math.cos(E) * velocityScale };
  const rM = aM * (1 - e * Math.cos(E));
  const speed = Math.sqrt(mu * (2 / rM - 1 / aM));
  const speedNear = Math.sqrt(mu * (2 / rNearM - 1 / aM));
  const speedFar = Math.sqrt(mu * (2 / rFarM - 1 / aM));
  const velocityArrowLength = speedToArrowLength(speed, speedFar, speedNear);
  const sectorSpanMeanAnomaly = 0.08 * TAU;
  const sectorAreaPx2 = (aPx * bPx * sectorSpanMeanAnomaly) / 2;
  const sectors: AreaSector[] = [];
  const sectorStarts = [0.02, 0.27, 0.52, 0.77].map((ratio) => ratio * TAU);

  for (let i = 0; i < sectorStarts.length; i += 1) {
    const startM = sectorStarts[i];
    const points = [{ x: focusXPx, y: 0 }];
    const steps = 28;
    for (let step = 0; step <= steps; step += 1) {
      const m = startM + sectorSpanMeanAnomaly * (step / steps);
      const localE = solveKepler(normalizeAngle(m), e);
      points.push({ x: -aPx * Math.cos(localE), y: bPx * Math.sin(localE) });
    }
    sectors.push({
      id: `sector-${i}`,
      points,
      color: 'rgba(255,235,59,0.34)',
      areaLabel: `ΔA${i + 1}=${sectorAreaPx2.toFixed(0)}px²`,
    });
  }

  return {
    scaleLabel: `a=${formatNumber(aM / 1000, 'km')} · e=${e.toFixed(3)}`,
    center: { x: 0, y: 0 },
    paths: [{ id: 'ellipse', label: '椭圆轨道', points: ellipsePoints(aPx, bPx, 0), color: '#FFEB3B', dashed: true }],
    sectors,
    bodies: [
      { id: 'center', label: '中心天体', hideLabel: true, position: { x: focusXPx, y: 0 }, radiusPx: 19, color: '#FF9800' },
      { id: 'satellite', label: '行星', position, velocity, acceleration: { x: -fromFocus.x, y: -fromFocus.y }, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [
      { from: position, to: arrowFrom(position, velocity, velocityArrowLength), color: '#4CAF50', label: 'v' },
      { from: position, to: arrowFrom(position, { x: -fromFocus.x, y: -fromFocus.y }, 34), color: '#FF9800', label: 'a' },
      { from: { x: -aPx, y: 0 }, to: arrowFrom({ x: -aPx, y: 0 }, { x: 0, y: 1 }, speedToArrowLength(speedNear, speedFar, speedNear)), color: '#8BC34A', label: `v近 ${formatNumber(speedNear / 1000, 'km/s', 2)}` },
      { from: { x: aPx, y: 0 }, to: arrowFrom({ x: aPx, y: 0 }, { x: 0, y: -1 }, speedToArrowLength(speedFar, speedFar, speedNear)), color: '#9CA3AF', label: `v远 ${formatNumber(speedFar / 1000, 'km/s', 2)}` },
    ],
    markers: [],
    metrics: computeEllipseMetrics(params),
  };
}

export function computeHohmannMetrics(params: Record<string, number>, phase: HohmannPhase = 'low'): SimulationMetrics {
  const r1 = params.lowOrbitRadiusM;
  const r2 = params.highOrbitRadiusM;
  const mu = CONSTANTS.gravitationalConstant * params.earthMassKg;
  const transferA = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vA = Math.sqrt(mu * (2 / r1 - 1 / transferA));
  const vB = Math.sqrt(mu * (2 / r2 - 1 / transferA));
  const transferTime = Math.PI * Math.sqrt(transferA ** 3 / mu);

  const allValues = [
      { label: '低轨速度 v1', value: formatNumber(v1 / 1000, 'km/s') },
      { label: '转移近地点 vA', value: formatNumber(vA / 1000, 'km/s'), note: 'vA > v1' },
      { label: '高轨速度 v2', value: formatNumber(v2 / 1000, 'km/s') },
      { label: '转移远地点 vB', value: formatNumber(vB / 1000, 'km/s'), note: 'v2 > vB' },
      { label: '半个转移周期', value: formatNumber(transferTime / 3600, 'h') },
    ];
  const phaseValues = phase === 'low'
    ? [
        { label: '低轨速度 v1', value: formatNumber(v1 / 1000, 'km/s'), note: '点火前圆轨道速度' },
        { label: '第一次点火后 vA', value: formatNumber(vA / 1000, 'km/s'), note: `Δv=${formatNumber((vA - v1) / 1000, 'km/s', 2)}` },
      ]
      : phase === 'transfer'
      ? [
          { label: '转移近地点 vA', value: formatNumber(vA / 1000, 'km/s'), note: '刚进入转移椭圆时速度' },
          { label: '转移远地点 vB', value: formatNumber(vB / 1000, 'km/s'), note: '到达高轨前速度' },
          { label: '高轨速度 v2', value: formatNumber(v2 / 1000, 'km/s'), note: `第二次点火 Δv=${formatNumber((v2 - vB) / 1000, 'km/s', 2)}` },
        ]
      : phase === 'high'
        ? [
            { label: '高轨速度 v2', value: formatNumber(v2 / 1000, 'km/s'), note: '入高轨后的圆轨道速度' },
            { label: '转移远地点 vB', value: formatNumber(vB / 1000, 'km/s'), note: `降轨需减速 Δv=${formatNumber((v2 - vB) / 1000, 'km/s', 2)}` },
          ]
        : [
            { label: '转移远地点 vB', value: formatNumber(vB / 1000, 'km/s'), note: '降轨转移起点，速度较小' },
            { label: '转移近地点 vA', value: formatNumber(vA / 1000, 'km/s'), note: '到达低轨前速度最大' },
            { label: '低轨速度 v1', value: formatNumber(v1 / 1000, 'km/s'), note: `低轨圆化需减速 Δv=${formatNumber((vA - v1) / 1000, 'km/s', 2)}` },
          ];

  return {
    modelId: 'CEL-011',
    title: '霍曼转移速度关系',
    insight: '速度数值移至侧边栏显示，画布只展示轨道与点火位置。',
    values: [...phaseValues, ...allValues.filter((item) => !phaseValues.some((phaseItem) => phaseItem.label === item.label))],
  };
}

export function buildHohmannFrame(
  params: Record<string, number>,
  time: number,
  phase: HohmannPhase,
  ignitionAngle = 0,
): SceneFrame {
  const r1 = params.lowOrbitRadiusM;
  const r2 = params.highOrbitRadiusM;
  const r1Px = hohmannRadiusToPx(r1);
  const r2Px = hohmannRadiusToPx(r2);
  const mu = CONSTANTS.gravitationalConstant * params.earthMassKg;
  const transferAM = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vA = Math.sqrt(mu * (2 / r1 - 1 / transferAM));
  const vB = Math.sqrt(mu * (2 / r2 - 1 / transferAM));
  const speedMin = Math.min(v1, v2, vA, vB);
  const speedMax = Math.max(v1, v2, vA, vB);
  const velocityLength = (speed: number) => 28 + 36 * clampNumber((speed - speedMin) / Math.max(speedMax - speedMin, 1e-6), 0, 1);
  const transferE = (r2 - r1) / (r1 + r2);
  const transferAPx = (r1Px + r2Px) / 2;
  const transferCPx = (r2Px - r1Px) / 2;
  const transferBPx = Math.sqrt(r1Px * r2Px);
  const omegaLow = Math.sqrt(mu / r1 ** 3);
  const omegaHigh = Math.sqrt(mu / r2 ** 3);
  const nTransfer = Math.sqrt(mu / transferAM ** 3);
  const isLowering = phase === 'transferDown';
  const ellipseAngle = isLowering ? ignitionAngle - Math.PI : ignitionAngle;
  const lowProgress = normalizeAngle(time * omegaLow);
  const highProgress = normalizeAngle(time * omegaHigh);
  const transferMeanAnomaly = (time * nTransfer) % Math.PI;
  const transferEccentricAngle = solveKepler(isLowering ? Math.PI + transferMeanAnomaly : transferMeanAnomaly, transferE);
  const currentLowAngle = ignitionAngle + lowProgress;
  const highAngle = ignitionAngle + Math.PI + highProgress;
  const transferLocalPoint = {
    x: -transferCPx + transferAPx * Math.cos(transferEccentricAngle),
    y: transferBPx * Math.sin(transferEccentricAngle),
  };
  const transferLocalTangent = {
    x: -transferAPx * Math.sin(transferEccentricAngle),
    y: transferBPx * Math.cos(transferEccentricAngle),
  };
  const position = phase === 'transfer'
    ? rotatePoint(transferLocalPoint, ellipseAngle)
    : phase === 'transferDown'
      ? rotatePoint(transferLocalPoint, ellipseAngle)
    : phase === 'high'
      ? { x: Math.cos(highAngle) * r2Px, y: Math.sin(highAngle) * r2Px }
      : { x: Math.cos(currentLowAngle) * r1Px, y: Math.sin(currentLowAngle) * r1Px };
  const transferRadiusM = transferAM * (1 - transferE * Math.cos(transferEccentricAngle));
  const currentSpeed = phase === 'transfer' || phase === 'transferDown'
    ? Math.sqrt(mu * (2 / clampNumber(transferRadiusM, r1, r2) - 1 / transferAM))
    : phase === 'high'
      ? v2
      : v1;
  const tangent = phase === 'transfer'
    ? rotatePoint(transferLocalTangent, ellipseAngle)
    : phase === 'transferDown'
      ? rotatePoint(transferLocalTangent, ellipseAngle)
    : phase === 'high'
      ? { x: -Math.sin(highAngle), y: Math.cos(highAngle) }
      : { x: -Math.sin(currentLowAngle), y: Math.cos(currentLowAngle) };
  const transferPath = ellipsePoints(transferAPx, transferBPx, -transferCPx).map((point) => rotatePoint(point, ellipseAngle));
  const raiseFirstBurn = rotatePoint({ x: r1Px, y: 0 }, phase === 'low' ? currentLowAngle : ignitionAngle);
  const raiseSecondBurn = rotatePoint({ x: -r2Px, y: 0 }, ignitionAngle);
  const lowerFirstBurn = rotatePoint({ x: -r2Px, y: 0 }, ellipseAngle);
  const lowerSecondBurn = rotatePoint({ x: r1Px, y: 0 }, ellipseAngle);
  const outwardLabelOffset = (point: Vec2, distance = 34): Vec2 => {
    const length = Math.max(Math.hypot(point.x, point.y), 1e-6);
    return { x: (point.x / length) * distance, y: (point.y / length) * distance };
  };
  const paths: OrbitPath[] = [
    { id: 'low', label: '低圆轨道', points: circularPoints(r1Px), color: '#FFFFFF' },
    { id: 'high', label: '高圆轨道', points: circularPoints(r2Px), color: '#A7F3D0' },
  ];
  if (phase !== 'low') {
    paths.push({ id: 'transfer', label: '椭圆转移轨道', points: transferPath, color: '#F44336', dashed: true });
  }
  const markers = phase === 'low'
    ? [{ position: raiseFirstBurn, label: '当前位置点火', color: '#F44336', labelOffset: outwardLabelOffset(raiseFirstBurn) }]
    : phase === 'transferDown'
      ? [
          { position: lowerFirstBurn, label: '高轨减速点火', color: '#F44336', labelOffset: outwardLabelOffset(lowerFirstBurn) },
          { position: lowerSecondBurn, label: '低轨再点火目标', color: '#F44336', labelOffset: outwardLabelOffset(lowerSecondBurn) },
        ]
    : [
        { position: raiseFirstBurn, label: '第一次点火', color: '#F44336', labelOffset: outwardLabelOffset(raiseFirstBurn) },
        { position: raiseSecondBurn, label: phase === 'transfer' ? '第二次点火目标' : '第二次点火', color: '#F44336', labelOffset: outwardLabelOffset(raiseSecondBurn) },
      ];

  return {
    scaleLabel: `r1=${formatNumber(r1 / 1000, 'km')} · r2=${formatNumber(r2 / 1000, 'km')}`,
    center: { x: 0, y: 0 },
    paths,
    sectors: [],
    bodies: [
      { id: 'earth', label: '地球', position: { x: 0, y: 0 }, radiusPx: 22, color: '#FF9800' },
      { id: 'satellite', label: phase === 'transfer' || phase === 'transferDown' ? '转移轨道卫星' : '卫星', position, velocity: tangent, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [{ from: position, to: arrowFrom(position, tangent, velocityLength(currentSpeed)), color: '#4CAF50', label: '' }],
    markers,
    metrics: computeHohmannMetrics(params, phase),
  };
}

export function computeEscapeMetrics(params: Record<string, number>): SimulationMetrics {
  const speed = params.launchSpeedKms;
  const circularThreshold = 0.08;
  let type = '落回地面';
  if (speed >= 16.7) type = '第三宇宙速度：逃出太阳系';
  else if (speed >= 11.2) type = speed === 11.2 ? '第二宇宙速度：抛物线逃逸' : '双曲线逃逸';
  else if (Math.abs(speed - 7.9) <= circularThreshold) type = '第一宇宙速度：近地圆轨道';
  else if (speed > 7.9) type = '绕地椭圆轨道';

  return {
    modelId: 'CEL-012',
    title: '三宇宙速度情景',
    insight: `当前速度对应：${type}`,
    values: [
      { label: '发射速度 v', value: formatNumber(speed, 'km/s') },
      { label: '第一宇宙速度', value: '7.9 km/s', note: '圆轨道' },
      { label: '第二宇宙速度', value: '11.2 km/s', note: '逃逸速度' },
      { label: '第三宇宙速度', value: '16.7 km/s', note: '逃出太阳系' },
      { label: '轨道判定', value: type },
    ],
  };
}

export function buildEscapeFrame(params: Record<string, number>, time: number): SceneFrame {
  const speed = params.launchSpeedKms;
  const points: Vec2[] = [];
  const earth = { x: -120, y: 0 };
  const earthRadiusPx = 24;
  const launchRadiusPx = 142;
  const circularThreshold = 0.08;
  const speedRatio = speed / 7.9;
  const mu = launchRadiusPx;
  const h = launchRadiusPx * speedRatio;
  const energy = speedRatio ** 2 / 2 - mu / launchRadiusPx;
  const eccentricity = Math.sqrt(Math.max(0, 1 + (2 * energy * h ** 2) / mu ** 2));
  const p = h ** 2 / mu;
  const speedSamples: number[] = [];
  const pushOrbitPoint = (point: Vec2, radius: number) => {
    points.push(point);
    speedSamples.push(Math.sqrt(Math.max(0, 2 / radius - 1 / launchRadiusPx)));
  };
  if (speed < 7.9 - circularThreshold) {
    const endCos = clampNumber((1 - p / earthRadiusPx) / Math.max(eccentricity, 1e-6), -1, 1);
    const endAngle = Math.acos(endCos);
    for (let i = 0; i <= 180; i += 1) {
      const theta = (i / 180) * endAngle;
      const r = p / Math.max(1 - eccentricity * Math.cos(theta), 1e-6);
      pushOrbitPoint({ x: earth.x + Math.cos(theta) * r, y: earth.y - Math.sin(theta) * r }, r);
    }
  } else if (Math.abs(speed - 7.9) <= circularThreshold) {
    for (let i = 0; i <= 240; i += 1) {
      const theta = (i / 240) * TAU;
      pushOrbitPoint({ x: earth.x + Math.cos(theta) * launchRadiusPx, y: earth.y - Math.sin(theta) * launchRadiusPx }, launchRadiusPx);
    }
  } else if (speed < 11.2) {
    for (let i = 0; i <= 320; i += 1) {
      const theta = (i / 320) * TAU;
      const r = p / Math.max(1 + eccentricity * Math.cos(theta), 1e-6);
      pushOrbitPoint({ x: earth.x + Math.cos(theta) * r, y: earth.y - Math.sin(theta) * r }, r);
    }
  } else {
    const maxRadiusPx = speed >= 16.7 ? 460 : 360;
    const maxCos = clampNumber((p / maxRadiusPx - 1) / Math.max(eccentricity, 1e-6), -1, 1);
    const thetaMax = Math.min(Math.acos(maxCos), Math.PI * 0.92);
    for (let i = 0; i <= 220; i += 1) {
      const theta = (i / 220) * thetaMax;
      const r = p / Math.max(1 + eccentricity * Math.cos(theta), 1e-6);
      pushOrbitPoint({ x: earth.x + Math.cos(theta) * r, y: earth.y - Math.sin(theta) * r }, r);
    }
  }
  const cumulative: number[] = [];
  let cumulativeTotal = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const nextPoint = points[(index + 1) % points.length] ?? current;
    const segmentLength = Math.hypot(nextPoint.x - current.x, nextPoint.y - current.y);
    const localSpeed = speedSamples[index] || 1;
    cumulativeTotal += segmentLength / Math.max(localSpeed, 1e-6);
    cumulative.push(cumulativeTotal);
  }
  const travel = (time * 8) % Math.max(cumulativeTotal, 1);
  const foundIndex = cumulative.findIndex((value) => value >= travel);
  const idx = foundIndex < 0 ? Math.max(0, points.length - 1) : Math.min(points.length - 1, foundIndex);
  const segmentStartTime = idx > 0 ? cumulative[idx - 1] : 0;
  const segmentEndTime = cumulative[idx] ?? segmentStartTime;
  const segmentRatio = clampNumber((travel - segmentStartTime) / Math.max(segmentEndTime - segmentStartTime, 1e-6), 0, 1);
  const previous = points[idx > 0 ? idx - 1 : idx] ?? earth;
  const next = points[idx] ?? previous;
  const position = {
    x: previous.x + (next.x - previous.x) * segmentRatio,
    y: previous.y + (next.y - previous.y) * segmentRatio,
  };
  const directionTarget = points[Math.min(points.length - 1, idx + 1)] ?? next;
  const isCircular = Math.abs(speed - 7.9) <= circularThreshold;
  const currentSpeed = speedSamples[idx] ?? 1;
  const minSpeed = Math.min(...speedSamples);
  const maxSpeed = Math.max(...speedSamples);

  return {
    scaleLabel: '近地点速度最大，远地点速度最小；轨迹为教学比例示意',
    center: { x: 0, y: 0 },
    paths: [{ id: 'escape-path', label: '轨迹', points, color: speed >= 11.2 ? '#F44336' : isCircular ? '#A7F3D0' : '#FFEB3B', dashed: speed < 7.9 }],
    sectors: [],
    bodies: [
      { id: 'earth', label: '地球', position: earth, radiusPx: earthRadiusPx, color: '#FF9800' },
      { id: 'probe', label: '探测器', position, velocity: { x: directionTarget.x - previous.x, y: directionTarget.y - previous.y }, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [{ from: position, to: arrowFrom(position, { x: directionTarget.x - previous.x, y: directionTarget.y - previous.y }, speedToArrowLength(currentSpeed, minSpeed, maxSpeed)), color: '#4CAF50', label: 'v' }],
    markers: speed < 7.9 - circularThreshold
      ? [{ position: points[points.length - 1], label: '落回地面', color: '#F44336', cross: true }]
      : isCircular
        ? [{ position: { x: earth.x + launchRadiusPx, y: earth.y }, label: '近地圆轨道', color: '#A7F3D0' }]
        : [],
    metrics: computeEscapeMetrics(params),
  };
}

export function computeBinaryMetrics(params: Record<string, number>): SimulationMetrics {
  const m1 = params.m1Kg;
  const m2 = params.m2Kg;
  const Lm = params.separationKm * 1000;
  const r1 = (m2 * Lm) / (m1 + m2);
  const r2 = (m1 * Lm) / (m1 + m2);
  const period = TAU * Math.sqrt(Lm ** 3 / (CONSTANTS.gravitationalConstant * (m1 + m2)));

  return {
    modelId: 'CEL-021',
    title: '双星质心关系',
    insight: '质量比越悬殊，重星越靠近质心，轻星轨道越大。',
    values: [
      { label: 'r1', value: formatNumber(r1 / 1000, 'km') },
      { label: 'r2', value: formatNumber(r2 / 1000, 'km') },
      { label: 'r1:r2', value: `${(r1 / r2).toFixed(3)}:1`, note: '应等于 m2:m1' },
      { label: 'm1r1 - m2r2', value: formatNumber(m1 * r1 - m2 * r2) },
      { label: '共同周期 T', value: formatNumber(period / CONSTANTS.secondsPerDay, 'd') },
    ],
  };
}

export function buildBinaryFrame(params: Record<string, number>, time: number): SceneFrame {
  const m1 = params.m1Kg;
  const m2 = params.m2Kg;
  const total = m1 + m2;
  const separationPx = scaledRadiusPx(params.separationKm, 1e6, 1e10, 90, 320);
  const r1Px = Math.max(12, (m2 / total) * separationPx);
  const r2Px = Math.max(12, (m1 / total) * separationPx);
  const Lm = params.separationKm * 1000;
  const omega = Math.sqrt(CONSTANTS.gravitationalConstant * total / Lm ** 3);
  const theta = time * omega;
  const p1 = { x: Math.cos(theta) * r1Px, y: Math.sin(theta) * r1Px };
  const p2 = { x: -Math.cos(theta) * r2Px, y: -Math.sin(theta) * r2Px };

  return {
    scaleLabel: `两星距离 L=${formatNumber(params.separationKm, 'km')}`,
    center: { x: 0, y: 0 },
    paths: [
      { id: 'star1-orbit', label: '星1轨道', points: circularPoints(r1Px), color: '#FF9800' },
      { id: 'star2-orbit', label: '星2轨道', points: circularPoints(r2Px), color: '#2196F3' },
    ],
    sectors: [],
    bodies: [
      { id: 'star1', label: '星1', position: p1, radiusPx: 18, color: '#FF9800' },
      { id: 'star2', label: '星2', position: p2, radiusPx: 15, color: '#2196F3' },
    ],
    vectors: [],
    markers: [{ position: { x: 0, y: 0 }, label: '质心', color: '#FFFFFF', cross: true }],
    metrics: computeBinaryMetrics(params),
  };
}

export function computeChaseMetrics(params: Record<string, number>): SimulationMetrics {
  const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
  const omega1 = Math.sqrt(mu / params.innerRadiusM ** 3);
  const omega2 = Math.sqrt(mu / params.outerRadiusM ** 3);
  const delta = (params.initialAngleDeg * Math.PI) / 180;
  const firstMeet = delta / Math.max(omega1 - omega2, 1e-12);
  const fullCatch = (TAU + delta) / Math.max(omega1 - omega2, 1e-12);

  return {
    modelId: 'CEL-031',
    title: '追及与相遇',
    insight: '内轨半径更小，因此角速度更大，会从后方追上外轨卫星。',
    values: [
      { label: 'omega1', value: formatNumber(omega1, 'rad/s') },
      { label: 'omega2', value: formatNumber(omega2, 'rad/s') },
      { label: '第一次相遇', value: formatNumber(firstMeet / 60, 'min') },
      { label: '追一圈后相遇', value: formatNumber(fullCatch / 60, 'min') },
      { label: '初始角度差', value: `${params.initialAngleDeg.toFixed(0)} deg` },
    ],
  };
}

export function buildChaseFrame(params: Record<string, number>, time: number): SceneFrame {
  const r1Px = Math.max(EARTH_RADIUS_PX + 16, orbitalRadiusToPx(params.innerRadiusM));
  const r2Px = Math.max(r1Px + 36, orbitalRadiusToPx(params.outerRadiusM));
  const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
  const omega1 = Math.sqrt(mu / params.innerRadiusM ** 3);
  const omega2 = Math.sqrt(mu / params.outerRadiusM ** 3);
  const theta1 = normalizeAngle(time * omega1);
  const theta2 = normalizeAngle((params.initialAngleDeg * Math.PI) / 180 + time * omega2);
  const p1 = { x: Math.cos(theta1) * r1Px, y: Math.sin(theta1) * r1Px };
  const p2 = { x: Math.cos(theta2) * r2Px, y: Math.sin(theta2) * r2Px };
  const meetTime = ((params.initialAngleDeg * Math.PI) / 180) / Math.max(omega1 - omega2, 1e-12);
  const meetTheta = normalizeAngle(meetTime * omega1);

  return {
    scaleLabel: `r1=${formatNumber(params.innerRadiusM, 'm')} · r2=${formatNumber(params.outerRadiusM, 'm')}`,
    center: { x: 0, y: 0 },
    paths: [
      { id: 'inner', label: '内轨', points: circularPoints(r1Px), color: '#FFFFFF' },
      { id: 'outer', label: '外轨', points: circularPoints(r2Px), color: '#FFEB3B', dashed: true },
    ],
    sectors: [],
    bodies: [
      { id: 'center', label: '中心天体', position: { x: 0, y: 0 }, radiusPx: 20, color: '#FF9800' },
      { id: 'inner-sat', label: '内轨卫星', position: p1, radiusPx: 8, color: '#2196F3' },
      { id: 'outer-sat', label: '外轨卫星', position: p2, radiusPx: 8, color: '#F9D65C' },
    ],
    vectors: [],
    markers: [
      { position: { x: Math.cos(meetTheta) * r1Px, y: Math.sin(meetTheta) * r1Px }, label: '第一次相遇角位', color: '#4CAF50' },
    ],
    metrics: computeChaseMetrics(params),
  };
}

export function buildFrame(
  modelId: string,
  params: Record<string, number>,
  time: number,
  phase: HohmannPhase,
  hohmannIgnitionAngle = 0,
): SceneFrame {
  switch (modelId) {
    case 'CEL-001':
      return buildCircularFrame(params, time);
    case 'CEL-002':
      return buildEllipseFrame(params, time);
    case 'CEL-011':
      return buildHohmannFrame(params, time, phase, hohmannIgnitionAngle);
    case 'CEL-012':
      return buildEscapeFrame(params, time);
    case 'CEL-021':
      return buildBinaryFrame(params, time);
    case 'CEL-031':
      return buildChaseFrame(params, time);
    default:
      return buildCircularFrame(params, time);
  }
}
