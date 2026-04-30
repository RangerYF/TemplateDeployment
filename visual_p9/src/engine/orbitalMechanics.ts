import { CONSTANTS } from '@/data/celestialData';

const TAU = Math.PI * 2;

export interface Vec2 {
  x: number;
  y: number;
}

export interface BodyRenderState {
  id: string;
  label: string;
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
  center: Vec2;
  bodies: BodyRenderState[];
  paths: OrbitPath[];
  sectors: AreaSector[];
  vectors: Array<{ from: Vec2; to: Vec2; color: string; label: string }>;
  markers: Array<{ position: Vec2; label: string; color: string; cross?: boolean }>;
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

export function computeCircularMetrics(params: Record<string, number>): SimulationMetrics {
  const M = params.centralMassKg;
  const r = params.orbitRadiusM;
  const mu = CONSTANTS.gravitationalConstant * M;
  const v = Math.sqrt(mu / r);
  const omega = Math.sqrt(mu / r ** 3);
  const period = TAU * Math.sqrt(r ** 3 / mu);
  const acceleration = mu / r ** 2;

  return {
    modelId: 'CEL-001',
    title: '圆轨道物理量',
    insight: '半径增大时，速度和角速度下降，周期增大。',
    values: [
      { label: '轨道半径 r', value: formatNumber(r, 'm') },
      { label: '速度 v', value: formatNumber(v, 'm/s') },
      { label: '角速度 omega', value: formatNumber(omega, 'rad/s') },
      { label: '周期 T', value: formatNumber(period / 3600, 'h') },
      { label: '向心加速度 a', value: formatNumber(acceleration, 'm/s^2') },
    ],
  };
}

export function buildCircularFrame(params: Record<string, number>, time: number): SceneFrame {
  const M = params.centralMassKg;
  const r = params.orbitRadiusM;
  const mu = CONSTANTS.gravitationalConstant * M;
  const omega = Math.sqrt(mu / r ** 3);
  const theta = normalizeAngle(time * omega);
  const orbitRadiusPx = 170;
  const position = { x: Math.cos(theta) * orbitRadiusPx, y: Math.sin(theta) * orbitRadiusPx };
  const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
  const inward = { x: -Math.cos(theta), y: -Math.sin(theta) };

  return {
    scaleLabel: `1 px ≈ ${formatNumber(r / orbitRadiusPx, 'm')}`,
    center: { x: 0, y: 0 },
    paths: [{ id: 'circle', label: '圆轨道', points: circularPoints(orbitRadiusPx), color: '#FFFFFF' }],
    sectors: [],
    bodies: [
      { id: 'center', label: '中心天体', position: { x: 0, y: 0 }, radiusPx: 20, color: '#FF9800' },
      { id: 'satellite', label: '卫星', position, velocity: tangent, acceleration: inward, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [
      { from: position, to: arrowFrom(position, tangent, 44), color: '#4CAF50', label: 'v' },
      { from: position, to: arrowFrom(position, inward, 36), color: '#FF9800', label: 'a' },
    ],
    markers: [],
    metrics: computeCircularMetrics(params),
  };
}

export function computeEllipseMetrics(params: Record<string, number>): SimulationMetrics {
  const aM = params.semiMajorAxisKm * 1000;
  const e = params.eccentricity;
  const M = params.centralMassKg;
  const mu = CONSTANTS.gravitationalConstant * M;
  const period = TAU * Math.sqrt(aM ** 3 / mu);
  const rNear = aM * (1 - e);
  const rFar = aM * (1 + e);
  const speedRatio = (1 + e) / (1 - e);
  const thirdLaw = period ** 2 / aM ** 3;

  return {
    modelId: 'CEL-002',
    title: '开普勒三定律',
    insight: '近日点半径更小，速度更大；固定等时间扇形的面积保持相等。',
    values: [
      { label: '近日点 r近', value: formatNumber(rNear / 1000, 'km') },
      { label: '远日点 r远', value: formatNumber(rFar / 1000, 'km') },
      { label: 'v近 / v远', value: speedRatio.toFixed(3), note: '(1+e)/(1-e)' },
      { label: '周期 T', value: formatNumber(period / CONSTANTS.secondsPerDay, 'd') },
      { label: 'T^2/a^3', value: formatNumber(thirdLaw, 's^2/m^3') },
    ],
  };
}

export function buildEllipseFrame(params: Record<string, number>, time: number): SceneFrame {
  const aPx = 220;
  const e = params.eccentricity;
  const bPx = aPx * Math.sqrt(1 - e ** 2);
  const focusXPx = -aPx * e;
  const aM = params.semiMajorAxisKm * 1000;
  const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
  const period = TAU * Math.sqrt(aM ** 3 / mu);
  const meanAnomaly = normalizeAngle((time / period) * TAU);
  const E = solveKepler(meanAnomaly, e);
  const position = { x: aPx * Math.cos(E), y: bPx * Math.sin(E) };
  const fromFocus = { x: position.x - focusXPx, y: position.y };
  const velocity = { x: -Math.sin(E), y: Math.sqrt(1 - e ** 2) * Math.cos(E) };
  const rPx = Math.hypot(fromFocus.x, fromFocus.y);
  const speedNorm = Math.sqrt(Math.max(0, 2 / rPx - 1 / aPx));
  const speedNear = Math.sqrt(2 / (aPx * (1 - e)) - 1 / aPx);
  const speedFar = Math.sqrt(2 / (aPx * (1 + e)) - 1 / aPx);
  const velocityArrowLength = 32 + 34 * clampNumber((speedNorm - speedFar) / Math.max(speedNear - speedFar, 1e-6), 0, 1);
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
      points.push({ x: aPx * Math.cos(localE), y: bPx * Math.sin(localE) });
    }
    sectors.push({
      id: `sector-${i}`,
      points,
      color: 'rgba(255,235,59,0.34)',
      areaLabel: `ΔA${i + 1}=${sectorAreaPx2.toFixed(0)}px²`,
    });
  }

  return {
    scaleLabel: `半长轴 ${formatNumber(params.semiMajorAxisKm, 'km')}`,
    center: { x: 0, y: 0 },
    paths: [{ id: 'ellipse', label: '椭圆轨道', points: ellipsePoints(aPx, bPx, 0), color: '#FFEB3B', dashed: true }],
    sectors,
    bodies: [
      { id: 'center', label: '中心天体', position: { x: focusXPx, y: 0 }, radiusPx: 19, color: '#FF9800' },
      { id: 'satellite', label: '行星', position, velocity, acceleration: { x: -fromFocus.x, y: -fromFocus.y }, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [
      { from: position, to: arrowFrom(position, velocity, velocityArrowLength), color: '#4CAF50', label: 'v' },
      { from: position, to: arrowFrom(position, { x: -fromFocus.x, y: -fromFocus.y }, 34), color: '#FF9800', label: 'a' },
    ],
    markers: [
      { position: { x: -aPx, y: 0 }, label: '近日点', color: '#FFEB3B' },
      { position: { x: aPx, y: 0 }, label: '远日点', color: '#FFEB3B' },
    ],
    metrics: computeEllipseMetrics(params),
  };
}

export function computeHohmannMetrics(params: Record<string, number>): SimulationMetrics {
  const r1 = params.lowOrbitRadiusM;
  const r2 = params.highOrbitRadiusM;
  const mu = CONSTANTS.gravitationalConstant * params.earthMassKg;
  const transferA = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vA = Math.sqrt(mu * (2 / r1 - 1 / transferA));
  const vB = Math.sqrt(mu * (2 / r2 - 1 / transferA));
  const transferTime = Math.PI * Math.sqrt(transferA ** 3 / mu);

  return {
    modelId: 'CEL-011',
    title: '霍曼转移速度关系',
    insight: '近地点第一次点火增速，远地点第二次点火后进入更高但更慢的圆轨道。',
    values: [
      { label: '低轨速度 v1', value: formatNumber(v1 / 1000, 'km/s') },
      { label: '转移近地点 vA', value: formatNumber(vA / 1000, 'km/s'), note: 'vA > v1' },
      { label: '高轨速度 v2', value: formatNumber(v2 / 1000, 'km/s') },
      { label: '转移远地点 vB', value: formatNumber(vB / 1000, 'km/s'), note: 'v2 > vB' },
      { label: '半个转移周期', value: formatNumber(transferTime / 3600, 'h') },
    ],
  };
}

export function buildHohmannFrame(
  params: Record<string, number>,
  time: number,
  phase: HohmannPhase,
  ignitionAngle = 0,
): SceneFrame {
  const r1Px = 105;
  const r2Px = 230;
  const transferAPx = (r1Px + r2Px) / 2;
  const transferCPx = (r2Px - r1Px) / 2;
  const transferBPx = Math.sqrt(r1Px * r2Px);
  const isLowering = phase === 'transferDown';
  const ellipseAngle = isLowering ? ignitionAngle - Math.PI : ignitionAngle;
  const phaseProgress = normalizeAngle(time * 0.18);
  const transferProgress = (time * 0.06) % 1;
  const transferEccentricAngle = isLowering ? Math.PI + Math.PI * transferProgress : Math.PI * transferProgress;
  const currentLowAngle = ignitionAngle + phaseProgress;
  const highAngle = ignitionAngle + Math.PI + phaseProgress;
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
  const paths: OrbitPath[] = [
    { id: 'low', label: '低圆轨道', points: circularPoints(r1Px), color: '#FFFFFF' },
    { id: 'high', label: '高圆轨道', points: circularPoints(r2Px), color: '#A7F3D0' },
  ];
  if (phase !== 'low') {
    paths.push({ id: 'transfer', label: '椭圆转移轨道', points: transferPath, color: '#F44336', dashed: true });
  }
  const markers = phase === 'low'
    ? [{ position: raiseFirstBurn, label: '当前位置点火', color: '#F44336' }]
    : phase === 'transferDown'
      ? [
          { position: lowerFirstBurn, label: '高轨减速点火', color: '#F44336' },
          { position: lowerSecondBurn, label: '低轨再点火目标', color: '#F44336' },
        ]
    : [
        { position: raiseFirstBurn, label: '第一次点火', color: '#F44336' },
        { position: raiseSecondBurn, label: phase === 'transfer' ? '第二次点火目标' : '第二次点火', color: '#F44336' },
      ];

  return {
    scaleLabel: `r1=${formatNumber(params.lowOrbitRadiusM, 'm')} · r2=${formatNumber(params.highOrbitRadiusM, 'm')}`,
    center: { x: 0, y: 0 },
    paths,
    sectors: [],
    bodies: [
      { id: 'earth', label: '地球', position: { x: 0, y: 0 }, radiusPx: 22, color: '#FF9800' },
      { id: 'satellite', label: phase === 'transfer' || phase === 'transferDown' ? '转移轨道卫星' : '卫星', position, velocity: tangent, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [{ from: position, to: arrowFrom(position, tangent, 42), color: '#4CAF50', label: 'v' }],
    markers,
    metrics: computeHohmannMetrics(params),
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
  if (speed < 7.9 - circularThreshold) {
    const endCos = clampNumber((1 - p / earthRadiusPx) / Math.max(eccentricity, 1e-6), -1, 1);
    const endAngle = Math.acos(endCos);
    for (let i = 0; i <= 180; i += 1) {
      const theta = (i / 180) * endAngle;
      const r = p / Math.max(1 - eccentricity * Math.cos(theta), 1e-6);
      points.push({ x: earth.x + Math.cos(theta) * r, y: earth.y - Math.sin(theta) * r });
    }
  } else if (Math.abs(speed - 7.9) <= circularThreshold) {
    for (let i = 0; i <= 240; i += 1) {
      const theta = (i / 240) * TAU;
      points.push({ x: earth.x + Math.cos(theta) * launchRadiusPx, y: earth.y + Math.sin(theta) * launchRadiusPx });
    }
  } else if (speed < 11.2) {
    for (let i = 0; i <= 320; i += 1) {
      const theta = (i / 320) * TAU;
      const r = p / Math.max(1 + eccentricity * Math.cos(theta), 1e-6);
      points.push({ x: earth.x + Math.cos(theta) * r, y: earth.y + Math.sin(theta) * r });
    }
  } else {
    const maxRadiusPx = speed >= 16.7 ? 460 : 360;
    const maxCos = clampNumber((p / maxRadiusPx - 1) / Math.max(eccentricity, 1e-6), -1, 1);
    const thetaMax = Math.min(Math.acos(maxCos), Math.PI * 0.92);
    for (let i = 0; i <= 220; i += 1) {
      const theta = (i / 220) * thetaMax;
      const r = p / Math.max(1 + eccentricity * Math.cos(theta), 1e-6);
      points.push({ x: earth.x + Math.cos(theta) * r, y: earth.y - Math.sin(theta) * r });
    }
  }
  const idx = Math.min(points.length - 1, Math.floor((time * 35) % points.length));
  const position = points[idx];
  const next = points[Math.min(points.length - 1, idx + 1)];
  const isCircular = Math.abs(speed - 7.9) <= circularThreshold;

  return {
    scaleLabel: '速度情景示意，不按真实比例绘制',
    center: { x: 0, y: 0 },
    paths: [{ id: 'escape-path', label: '轨迹', points, color: speed >= 11.2 ? '#F44336' : isCircular ? '#A7F3D0' : '#FFEB3B', dashed: speed < 7.9 }],
    sectors: [],
    bodies: [
      { id: 'earth', label: '地球', position: earth, radiusPx: earthRadiusPx, color: '#FF9800' },
      { id: 'probe', label: '探测器', position, velocity: { x: next.x - position.x, y: next.y - position.y }, radiusPx: 8, color: '#2196F3' },
    ],
    vectors: [{ from: position, to: arrowFrom(position, { x: next.x - position.x, y: next.y - position.y }, 45), color: '#4CAF50', label: 'v' }],
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
  const r1Px = Math.max(12, (m2 / total) * 260);
  const r2Px = Math.max(12, (m1 / total) * 260);
  const theta = time * 0.45;
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
  const earthSpin = TAU / (24 * 3600);
  const groundPass = TAU / Math.max(omega1 - earthSpin, 1e-12);

  return {
    modelId: 'CEL-031',
    title: '追及与相遇',
    insight: '内轨半径更小，因此角速度更大，会从后方追上外轨卫星。',
    values: [
      { label: 'omega1', value: formatNumber(omega1, 'rad/s') },
      { label: 'omega2', value: formatNumber(omega2, 'rad/s') },
      { label: '第一次相遇', value: formatNumber(firstMeet / 60, 'min') },
      { label: '追一圈后相遇', value: formatNumber(fullCatch / 60, 'min') },
      { label: '星下点重合', value: formatNumber(groundPass / 60, 'min'), note: '考虑地球自转示意' },
      { label: '初始角度差', value: `${params.initialAngleDeg.toFixed(0)} deg` },
    ],
  };
}

export function buildChaseFrame(params: Record<string, number>, time: number): SceneFrame {
  const r1Px = 145;
  const r2Px = 225;
  const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
  const omega1 = Math.sqrt(mu / params.innerRadiusM ** 3);
  const omega2 = Math.sqrt(mu / params.outerRadiusM ** 3);
  const theta1 = normalizeAngle(time * omega1);
  const theta2 = normalizeAngle((params.initialAngleDeg * Math.PI) / 180 + time * omega2);
  const earthSpin = TAU / (24 * 3600);
  const groundTheta = normalizeAngle(time * earthSpin);
  const p1 = { x: Math.cos(theta1) * r1Px, y: Math.sin(theta1) * r1Px };
  const p2 = { x: Math.cos(theta2) * r2Px, y: Math.sin(theta2) * r2Px };
  const meetTime = ((params.initialAngleDeg * Math.PI) / 180) / Math.max(omega1 - omega2, 1e-12);
  const meetTheta = normalizeAngle(meetTime * omega1);
  const surfaceRadiusPx = 34;
  const groundStation = { x: Math.cos(groundTheta) * surfaceRadiusPx, y: Math.sin(groundTheta) * surfaceRadiusPx };
  const subSatellitePoint = { x: Math.cos(theta1) * surfaceRadiusPx, y: Math.sin(theta1) * surfaceRadiusPx };

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
      { id: 'ground', label: '地面站', position: groundStation, radiusPx: 5, color: '#4CAF50' },
      { id: 'subpoint', label: '当前星下点', position: subSatellitePoint, radiusPx: 4, color: '#A7F3D0' },
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
