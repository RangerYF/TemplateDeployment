export type ModelCategory = 'kepler' | 'orbit_change' | 'binary' | 'chase';

export interface ParameterSpec {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  displayScale?: 'linear' | 'scientific';
}

export interface FormulaSpec {
  label: string;
  expression: string;
  note: string;
}

export interface AnimationSpec {
  mode: string;
  defaultSpeed: number;
  highlight: string[];
}

export interface CelestialModel {
  id: string;
  name_cn: string;
  shortName: string;
  category: ModelCategory;
  params: ParameterSpec[];
  formulas: FormulaSpec[];
  animations: AnimationSpec;
  teaching_points: string[];
}

export interface DataSource {
  id: string;
  item: string;
  value: string;
  source: string;
  url: string;
  usage: string;
}

export const DISPLAY_CONFIG = {
  centerColor: '#FF9800',
  satelliteColor: '#2196F3',
  secondaryColor: '#F9D65C',
  circularOrbitColor: '#FFFFFF',
  ellipseOrbitColor: '#FFEB3B',
  transferOrbitColor: '#F44336',
  velocityArrowColor: '#4CAF50',
  accelerationArrowColor: '#FF9800',
  areaSectorColor: 'rgba(255,235,59,0.3)',
  barycenterColor: '#FFFFFF',
  background: '#050A18',
};

export const CONSTANTS = {
  gravitationalConstant: 6.674e-11,
  gravitationalConstantNist: 6.6743e-11,
  earthGravity: 9.8,
  earthGM: 3.986e14,
  secondsPerDay: 86400,
};

export const BODY_REFERENCES = [
  {
    id: 'earth',
    name_cn: '地球',
    massKg: 5.97e24,
    radiusKm: 6371,
    orbitRadiusKm: 1.496e8,
  },
  {
    id: 'moon',
    name_cn: '月球',
    massKg: 7.35e22,
    radiusKm: 1737,
    orbitRadiusKm: 3.844e5,
  },
  {
    id: 'sun',
    name_cn: '太阳',
    massKg: 1.99e30,
    radiusKm: 696000,
    orbitRadiusKm: null,
  },
  {
    id: 'leo',
    name_cn: '近地卫星',
    massKg: null,
    radiusKm: null,
    orbitRadiusKm: 6800,
  },
  {
    id: 'geo',
    name_cn: '地球同步轨道',
    massKg: null,
    radiusKm: null,
    orbitRadiusKm: 42164,
  },
];

export const CELESTIAL_MODELS: CelestialModel[] = [
  {
    id: 'CEL-001',
    name_cn: '圆轨道运行',
    shortName: '圆轨道',
    category: 'kepler',
    params: [
      { key: 'centralMassKg', label: '中心天体质量 M', defaultValue: 6.0e24, min: 1e22, max: 1e30, step: 1e22, unit: 'kg', displayScale: 'scientific' },
      { key: 'orbitRadiusM', label: '轨道半径 r', defaultValue: 6.8e6, min: 1e6, max: 1e9, step: 1e5, unit: 'm', displayScale: 'scientific' },
    ],
    formulas: [
      { label: '速度', expression: 'v=\\sqrt{\\frac{GM}{r}}', note: 'r 越大，v 越小' },
      { label: '角速度', expression: '\\omega=\\sqrt{\\frac{GM}{r^3}}', note: 'r 越大，omega 越小' },
      { label: '周期', expression: 'T=2\\pi\\sqrt{\\frac{r^3}{GM}}', note: 'r 越大，T 越大' },
      { label: '加速度', expression: 'a=\\frac{GM}{r^2}', note: 'r 越大，a 越小' },
    ],
    animations: { mode: 'uniform-circular', defaultSpeed: 1, highlight: ['速度箭头恒长', '高轨低速大周期'] },
    teaching_points: ['拖动半径，观察速度减小、周期增大。', '引力提供向心力：GMm/r^2 = mv^2/r。'],
  },
  {
    id: 'CEL-002',
    name_cn: '椭圆轨道运行',
    shortName: '椭圆轨道',
    category: 'kepler',
    params: [
      { key: 'semiMajorAxisKm', label: '半长轴 a', defaultValue: 1.5e8, min: 1e7, max: 1e9, step: 1e7, unit: 'km', displayScale: 'scientific' },
      { key: 'eccentricity', label: '离心率 e', defaultValue: 0.3, min: 0.01, max: 0.95, step: 0.01, unit: '' },
      { key: 'centralMassKg', label: '中心天体质量 M', defaultValue: 1.99e30, min: 1e24, max: 1e31, step: 1e24, unit: 'kg', displayScale: 'scientific' },
    ],
    formulas: [
      { label: '第一定律', expression: '轨道为椭圆，中心天体位于椭圆的一个焦点。', note: '文字表述开普勒第一定律' },
      { label: '第二定律', expression: '\\frac{dA}{dt}=\\text{constant}', note: '等时间扫过等面积' },
      { label: '第三定律', expression: '\\frac{T^2}{a^3}=\\frac{4\\pi^2}{GM}', note: '同一中心天体下为常数' },
      { label: '速度比', expression: '\\frac{v_{near}}{v_{far}}=\\frac{1+e}{1-e}', note: '角动量守恒' },
    ],
    animations: { mode: 'kepler-equation', defaultSpeed: 1, highlight: ['近日点速度大', '远日点速度小', '面积扇形相等'] },
    teaching_points: ['暂停观察等时间面积扇形。', '调节离心率，观察近日点/远日点速度差异。'],
  },
  {
    id: 'CEL-011',
    name_cn: '霍曼转移轨道',
    shortName: '霍曼转移',
    category: 'orbit_change',
    params: [
      { key: 'lowOrbitRadiusM', label: '低轨半径 r1', defaultValue: 6.8e6, min: 6.4e6, max: 1e7, step: 1e4, unit: 'm', displayScale: 'scientific' },
      { key: 'highOrbitRadiusM', label: '高轨半径 r2', defaultValue: 4.2e7, min: 1e7, max: 1e8, step: 1e5, unit: 'm', displayScale: 'scientific' },
      { key: 'earthMassKg', label: '地球质量 M', defaultValue: 6.0e24, min: 6.0e24, max: 6.0e24, step: 1, unit: 'kg', displayScale: 'scientific' },
    ],
    formulas: [
      { label: '低圆轨道', expression: 'v_1=\\sqrt{\\frac{GM}{r_1}}', note: '低轨圆周速度' },
      { label: '高圆轨道', expression: 'v_2=\\sqrt{\\frac{GM}{r_2}}', note: '高轨圆周速度' },
      { label: '转移近地点', expression: 'v_A=\\sqrt{GM\\left(\\frac{2}{r_1}-\\frac{1}{a_t}\\right)}', note: '第一次点火后速度' },
      { label: '转移远地点', expression: 'v_B=\\sqrt{GM\\left(\\frac{2}{r_2}-\\frac{1}{a_t}\\right)}', note: '第二次点火前速度' },
    ],
    animations: { mode: 'hohmann-transfer', defaultSpeed: 0.8, highlight: ['近地点点火', '远地点再点火', 'vA > v1 > v2 > vB'] },
    teaching_points: ['在近地点点击点火加速，进入椭圆转移轨道。', '到远地点再次点火，进入高圆轨道。', '高轨半径更大但圆轨道速度更小。', '高轨阶段可继续点击减速，演示反向霍曼降轨。'],
  },
  {
    id: 'CEL-012',
    name_cn: '三宇宙速度',
    shortName: '宇宙速度',
    category: 'orbit_change',
    params: [
      { key: 'launchSpeedKms', label: '发射速度 v', defaultValue: 7.9, min: 3, max: 18, step: 0.1, unit: 'km/s' },
    ],
    formulas: [
      { label: '第一宇宙速度', expression: 'v_1=\\sqrt{gR}\\approx 7.9\\,\\mathrm{km/s}', note: '近地圆轨道速度' },
      { label: '第二宇宙速度', expression: 'v_2=\\sqrt{2}\\,v_1\\approx 11.2\\,\\mathrm{km/s}', note: '逃逸速度' },
      { label: '第三宇宙速度', expression: 'v_3\\approx 16.7\\,\\mathrm{km/s}', note: '逃出太阳系' },
    ],
    animations: { mode: 'escape-speed', defaultSpeed: 1, highlight: ['落回地面', '圆轨道', '椭圆轨道', '抛物/双曲逃逸'] },
    teaching_points: ['调节初速度，观察轨道类型突变。', '第二宇宙速度是第一宇宙速度的 sqrt(2) 倍。'],
  },
  {
    id: 'CEL-021',
    name_cn: '双星绕转',
    shortName: '双星系统',
    category: 'binary',
    params: [
      { key: 'm1Kg', label: '星1质量 m1', defaultValue: 2.0e30, min: 1e28, max: 1e32, step: 1e28, unit: 'kg', displayScale: 'scientific' },
      { key: 'm2Kg', label: '星2质量 m2', defaultValue: 1.0e30, min: 1e28, max: 1e32, step: 1e28, unit: 'kg', displayScale: 'scientific' },
      { key: 'separationKm', label: '两星距离 L', defaultValue: 1e8, min: 1e6, max: 1e10, step: 1e6, unit: 'km', displayScale: 'scientific' },
    ],
    formulas: [
      { label: '质心条件', expression: 'm_1r_1=m_2r_2,\\quad r_1+r_2=L', note: '质量大的星更靠近质心' },
      { label: '轨道半径', expression: 'r_1=\\frac{m_2L}{m_1+m_2},\\quad r_2=\\frac{m_1L}{m_1+m_2}', note: '半径比与质量比相反' },
      { label: '共同周期', expression: 'T=2\\pi\\sqrt{\\frac{L^3}{G(m_1+m_2)}}', note: '两星角速度相同' },
    ],
    animations: { mode: 'binary-analytic', defaultSpeed: 1, highlight: ['质心固定', '角速度相同', '质量比联动轨道半径'] },
    teaching_points: ['设置 m1:m2 = 1:2，可观察 r1:r2 = 2:1。', '双星不是一颗绕另一颗转，而是共同绕质心转。'],
  },
  {
    id: 'CEL-031',
    name_cn: '不同轨道追及',
    shortName: '天体追及',
    category: 'chase',
    params: [
      { key: 'innerRadiusM', label: '内轨半径 r1', defaultValue: 6.8e6, min: 1e6, max: 9.99e7, step: 1e5, unit: 'm', displayScale: 'scientific' },
      { key: 'outerRadiusM', label: '外轨半径 r2', defaultValue: 1.0e7, min: 1.1e6, max: 1e8, step: 1e5, unit: 'm', displayScale: 'scientific' },
      { key: 'initialAngleDeg', label: '初始角度差 Δθ', defaultValue: 60, min: 0, max: 350, step: 1, unit: 'deg' },
      { key: 'centralMassKg', label: '中心天体质量 M', defaultValue: 6.0e24, min: 1e22, max: 1e30, step: 1e22, unit: 'kg', displayScale: 'scientific' },
    ],
    formulas: [
      { label: '角速度差', expression: '\\omega_1>\\omega_2', note: '内轨角速度更大' },
      { label: '追及条件', expression: '(\\omega_1-\\omega_2)t=2k\\pi+\\Delta\\theta', note: '相对角位移达到整圈加初始角差' },
      { label: '最短追及', expression: 't=\\frac{\\Delta\\theta}{\\omega_1-\\omega_2}', note: '第一次相遇' },
      { label: '星下点追击', expression: '(\\omega_1-\\omega_E)t=2k\\pi', note: '示意考虑地球自转后的卫星过站周期' },
    ],
    animations: { mode: 'relative-angular', defaultSpeed: 1, highlight: ['内轨更快', '相遇点标注', '追及时间计算'] },
    teaching_points: ['同一中心天体下，高轨角速度更小。', '初始角差越大，第一次相遇所需时间越长。', '地面站标记用于演示星下点追击与地球自转影响。'],
  },
];

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'SRC-P09-MODEL',
    item: 'P09 场景参数、公式、显示色彩',
    value: 'CEL-001/CEL-002/CEL-011/CEL-012/CEL-021/CEL-031',
    source: '项目需求文档：P09 天体运动与引力模拟器 · 模型数据',
    url: 'docs/需求文档md/P09 天体运动与引力模拟器 · 模型数据.md',
    usage: '模型列表、参数默认值/范围、公式、动画配置、显示参数',
  },
  {
    id: 'SRC-P09-PRD',
    item: 'P09 功能与验收标准',
    value: '开普勒、变轨、双星、三宇宙速度、追及',
    source: '项目 PRD：P物理教具产品线 · 产品需求文档',
    url: 'docs/需求文档md/P物理教具产品线 · 产品需求文档.md',
    usage: '功能范围、布局建议、验收检查条目',
  },
  {
    id: 'SRC-NASA-EARTH',
    item: '地球质量、半径、日地距离',
    value: '5.97e24 kg, 6371 km, 1.496e8 km',
    source: 'NASA / NSSDC Earth Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
    usage: '天体参数参考表与默认地球相关计算核验',
  },
  {
    id: 'SRC-NASA-MOON',
    item: '月球质量、半径、轨道半径',
    value: '7.35e22 kg, 1737 km, 3.844e5 km',
    source: 'NASA / NSSDC Moon Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    usage: '天体参数参考表',
  },
  {
    id: 'SRC-NASA-SUN',
    item: '太阳质量、半径',
    value: '1.99e30 kg, 696000 km',
    source: 'NASA / NSSDC Sun Fact Sheet',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
    usage: '天体参数参考表与椭圆轨道中心天体默认值',
  },
  {
    id: 'SRC-NIST-G',
    item: '万有引力常量 G',
    value: '6.67430e-11 m^3 kg^-1 s^-2',
    source: 'NIST CODATA recommended values',
    url: 'https://physics.nist.gov/cgi-bin/cuu/Value?bg',
    usage: '物理计算核验；页面计算按需求文档值 6.674e-11 展示',
  },
];

export function getDefaultParams(model: CelestialModel): Record<string, number> {
  return Object.fromEntries(model.params.map((param) => [param.key, param.defaultValue]));
}
