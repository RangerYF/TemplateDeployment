import type { GeometryType } from '@/types/geometry';

// ============================================
// 三级模板数据结构
// ============================================

export interface Template {
  id: string;
  name: string;
  status: 'available' | 'coming';
  geometryType?: GeometryType;
}

export interface Module {
  id: string;
  code: string;
  name: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'available' | 'coming';
  templates: Template[];
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  modules: Module[];
}

// ============================================
// 数学学科
// ============================================

const MATH_MODULES: Module[] = [
  {
    id: 'm01',
    code: 'M-01',
    name: '立体几何展示台',
    description: '3D 几何体交互展示、参数调节、标注与计算',
    priority: 'P0',
    status: 'available',
    templates: [
      { id: 'm01-cube', name: '正方体', status: 'available', geometryType: 'cube' },
      { id: 'm01-cuboid', name: '长方体', status: 'available', geometryType: 'cuboid' },
      { id: 'm01-prism', name: '正棱柱', status: 'available', geometryType: 'prism' },
      { id: 'm01-pyramid', name: '棱锥', status: 'available', geometryType: 'pyramid' },
      { id: 'm01-frustum', name: '棱台', status: 'available', geometryType: 'frustum' },
      { id: 'm01-cone', name: '圆锥', status: 'available', geometryType: 'cone' },
      { id: 'm01-truncatedCone', name: '圆台', status: 'available', geometryType: 'truncatedCone' },
      { id: 'm01-cylinder', name: '圆柱', status: 'available', geometryType: 'cylinder' },
      { id: 'm01-sphere', name: '球', status: 'available', geometryType: 'sphere' },
      { id: 'm01-regularTetrahedron', name: '正四面体', status: 'available', geometryType: 'regularTetrahedron' },
      { id: 'm01-cornerTetrahedron', name: '墙角四面体', status: 'available', geometryType: 'cornerTetrahedron' },
      { id: 'm01-isoscelesTetrahedron', name: '等腰四面体', status: 'available', geometryType: 'isoscelesTetrahedron' },
      { id: 'm01-orthogonalTetrahedron', name: '正交四面体', status: 'available', geometryType: 'orthogonalTetrahedron' },
    ],
  },
  {
    id: 'm02',
    code: 'M-02',
    name: '函数图像实验室',
    description: '函数图像绘制、参数滑块调节、多函数对比',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'm02-linear', name: '一次函数', status: 'coming' },
      { id: 'm02-quadratic', name: '二次函数', status: 'coming' },
      { id: 'm02-inverse', name: '反比例函数', status: 'coming' },
      { id: 'm02-exponential', name: '指数函数', status: 'coming' },
      { id: 'm02-logarithmic', name: '对数函数', status: 'coming' },
      { id: 'm02-trigonometric', name: '三角函数', status: 'coming' },
    ],
  },
  {
    id: 'm03',
    code: 'M-03',
    name: '解析几何画板',
    description: '圆锥曲线交互、焦点准线、动态轨迹',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'm03-circle', name: '圆', status: 'coming' },
      { id: 'm03-ellipse', name: '椭圆', status: 'coming' },
      { id: 'm03-hyperbola', name: '双曲线', status: 'coming' },
      { id: 'm03-parabola', name: '抛物线', status: 'coming' },
      { id: 'm03-line-circle', name: '直线与圆', status: 'coming' },
      { id: 'm03-focal-chord', name: '焦点弦', status: 'coming' },
    ],
  },
  {
    id: 'm04',
    code: 'M-04',
    name: '三角函数演示台',
    description: '单位圆、三角函数图像、正弦余弦定理',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'm04-unit-circle', name: '单位圆', status: 'coming' },
      { id: 'm04-trig-graph', name: '三角函数图像', status: 'coming' },
      { id: 'm04-sine-rule', name: '正弦定理', status: 'coming' },
      { id: 'm04-cosine-rule', name: '余弦定理', status: 'coming' },
      { id: 'm04-auxiliary-angle', name: '辅助角公式', status: 'coming' },
      { id: 'm04-identities', name: '三角恒等式', status: 'coming' },
    ],
  },
  {
    id: 'm05',
    code: 'M-05',
    name: '概率统计模拟器',
    description: '随机模拟、频率直方图、正态分布、回归分析',
    priority: 'P2',
    status: 'coming',
    templates: [
      { id: 'm05-dice', name: '掷骰子模拟', status: 'coming' },
      { id: 'm05-geometric-prob', name: '几何概率', status: 'coming' },
      { id: 'm05-histogram', name: '频率直方图', status: 'coming' },
      { id: 'm05-normal', name: '正态分布', status: 'coming' },
      { id: 'm05-regression', name: '线性回归', status: 'coming' },
      { id: 'm05-expectation', name: '期望与方差', status: 'coming' },
    ],
  },
  {
    id: 'm06',
    code: 'M-06',
    name: '向量运算演示台',
    description: '2D/3D 向量运算、点积叉积、投影与线性组合',
    priority: 'P2',
    status: 'coming',
    templates: [
      { id: 'm06-addition', name: '向量加法', status: 'coming' },
      { id: 'm06-subtraction', name: '向量减法', status: 'coming' },
      { id: 'm06-dot-product', name: '点积', status: 'coming' },
      { id: 'm06-cross-product', name: '叉积', status: 'coming' },
      { id: 'm06-3d-relation', name: '空间向量关系', status: 'coming' },
      { id: 'm06-linear-combo', name: '线性组合', status: 'coming' },
    ],
  },
];

// ============================================
// 物理学科
// ============================================

const PHYSICS_MODULES: Module[] = [
  {
    id: 'p01',
    code: 'P-01',
    name: '受力分析器',
    description: '受力模型、正交分解、合力计算',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p01-horizontal', name: '水平面模型', status: 'coming' },
      { id: 'p01-incline', name: '斜面模型', status: 'coming' },
      { id: 'p01-suspension', name: '悬挂模型', status: 'coming' },
      { id: 'p01-connected', name: '连接体模型', status: 'coming' },
      { id: 'p01-circular', name: '圆周运动模型', status: 'coming' },
      { id: 'p01-pulley', name: '滑轮系统', status: 'coming' },
    ],
  },
  {
    id: 'p02',
    code: 'P-02',
    name: '运动模拟器',
    description: '轨迹绘制、速度加速度向量、v-t/s-t 图联动',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p02-uniform-accel', name: '匀加速直线运动', status: 'coming' },
      { id: 'p02-incline-motion', name: '斜面运动', status: 'coming' },
      { id: 'p02-projectile', name: '平抛运动', status: 'coming' },
      { id: 'p02-vertical-circular', name: '竖直圆周运动', status: 'coming' },
      { id: 'p02-horizontal-circular', name: '水平圆周运动', status: 'coming' },
      { id: 'p02-comparison', name: '多物体对比', status: 'coming' },
    ],
  },
  {
    id: 'p03',
    code: 'P-03',
    name: '光学实验台',
    description: '折射全反射、透镜成像、干涉衍射',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'p03-refraction', name: '折射与全反射', status: 'coming' },
      { id: 'p03-lens', name: '透镜成像', status: 'coming' },
      { id: 'p03-double-slit', name: '双缝干涉', status: 'coming' },
      { id: 'p03-single-slit', name: '单缝衍射', status: 'coming' },
      { id: 'p03-thin-film', name: '薄膜干涉', status: 'coming' },
    ],
  },
  {
    id: 'p04',
    code: 'P-04',
    name: '电路搭建器',
    description: '拖拽搭建、自动电路分析、故障模拟',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p04-voltammeter', name: '伏安法测电阻', status: 'coming' },
      { id: 'p04-half-deflection', name: '半偏法测内阻', status: 'coming' },
      { id: 'p04-emf', name: '测电动势和内阻', status: 'coming' },
      { id: 'p04-ohmmeter', name: '欧姆表原理', status: 'coming' },
      { id: 'p04-wheatstone', name: '电桥法测电阻', status: 'coming' },
      { id: 'p04-free-build', name: '自由搭建', status: 'coming' },
    ],
  },
  {
    id: 'p05',
    code: 'P-05',
    name: '简谐运动与弹簧振子',
    description: '弹簧振子、单摆、x-t/v-t/a-t 图像联动',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'p05-vertical-spring', name: '竖直弹簧振子', status: 'coming' },
      { id: 'p05-horizontal-spring', name: '水平弹簧振子', status: 'coming' },
      { id: 'p05-pendulum', name: '单摆运动', status: 'coming' },
      { id: 'p05-coupled', name: '多摆耦合', status: 'coming' },
      { id: 'p05-damping', name: '阻尼对比', status: 'coming' },
    ],
  },
  {
    id: 'p06',
    code: 'P-06',
    name: '波动与振动演示台',
    description: '波形图与振动图、波叠加干涉、驻波、多普勒效应',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'p06-wave-propagation', name: '单列波传播', status: 'coming' },
      { id: 'p06-superposition', name: '波叠加干涉', status: 'coming' },
      { id: 'p06-standing-wave', name: '驻波', status: 'coming' },
      { id: 'p06-doppler', name: '多普勒效应', status: 'coming' },
      { id: 'p06-transverse-longitudinal', name: '横波与纵波', status: 'coming' },
    ],
  },
  {
    id: 'p07',
    code: 'P-07',
    name: '热力学与气体分子模拟器',
    description: '分子微观动画、三种变化过程、气缸模型',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'p07-molecular', name: '气体分子模拟', status: 'coming' },
      { id: 'p07-isothermal', name: '等温变化', status: 'coming' },
      { id: 'p07-isobaric', name: '等压变化', status: 'coming' },
      { id: 'p07-isochoric', name: '等容变化', status: 'coming' },
      { id: 'p07-liquid-column', name: '液柱密封模型', status: 'coming' },
      { id: 'p07-piston', name: '气缸模型', status: 'coming' },
    ],
  },
  {
    id: 'p08',
    code: 'P-08',
    name: '电场与磁场可视化器',
    description: '场线等势面、粒子偏转、洛伦兹力、复合场',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p08-electric-field', name: '静电场', status: 'coming' },
      { id: 'p08-deflection', name: '电场偏转', status: 'coming' },
      { id: 'p08-magnetic-field', name: '静磁场', status: 'coming' },
      { id: 'p08-lorentz', name: '洛伦兹力', status: 'coming' },
      { id: 'p08-velocity-selector', name: '速度选择器', status: 'coming' },
      { id: 'p08-cyclotron', name: '回旋加速器', status: 'coming' },
    ],
  },
  {
    id: 'p09',
    code: 'P-09',
    name: '天体运动与引力模拟器',
    description: '开普勒定律、卫星变轨、双星系统',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'p09-orbit', name: '单星轨道', status: 'coming' },
      { id: 'p09-transfer', name: '卫星变轨', status: 'coming' },
      { id: 'p09-binary', name: '双星系统', status: 'coming' },
      { id: 'p09-chase', name: '天体追及', status: 'coming' },
      { id: 'p09-kepler', name: '开普勒定律', status: 'coming' },
      { id: 'p09-escape', name: '宇宙速度', status: 'coming' },
    ],
  },
  {
    id: 'p11',
    code: 'P-11',
    name: '核物理与放射性衰变',
    description: '衰变动画、半衰期、光电效应、玻尔模型',
    priority: 'P2',
    status: 'coming',
    templates: [
      { id: 'p11-decay', name: '放射性衰变', status: 'coming' },
      { id: 'p11-half-life', name: '半衰期', status: 'coming' },
      { id: 'p11-photoelectric', name: '光电效应', status: 'coming' },
      { id: 'p11-bohr', name: '玻尔模型', status: 'coming' },
    ],
  },
  {
    id: 'p12',
    code: 'P-12',
    name: '动量定理及动量守恒',
    description: '碰撞模型、反冲、人船模型、动量可视化',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p12-inelastic', name: '完全非弹性碰撞', status: 'coming' },
      { id: 'p12-partial-elastic', name: '部分弹性碰撞', status: 'coming' },
      { id: 'p12-elastic', name: '完全弹性碰撞', status: 'coming' },
      { id: 'p12-climb', name: '爬坡模型', status: 'coming' },
      { id: 'p12-boat', name: '人船模型', status: 'coming' },
      { id: 'p12-explosion', name: '爆炸分离', status: 'coming' },
    ],
  },
  {
    id: 'p13',
    code: 'P-13',
    name: '电磁感应',
    description: '楞次定律、单棒双棒模型、终态分析',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p13-lenz', name: '楞次定律', status: 'coming' },
      { id: 'p13-flux', name: '磁通量变化', status: 'coming' },
      { id: 'p13-single-bar', name: '单棒模型', status: 'coming' },
      { id: 'p13-double-bar', name: '双棒模型', status: 'coming' },
      { id: 'p13-vertical-rail', name: '竖直导轨', status: 'coming' },
      { id: 'p13-capacitor', name: '含电容电源', status: 'coming' },
    ],
  },
  {
    id: 'p14',
    code: 'P-14',
    name: '机械能守恒',
    description: '能量条形图、自由落体、轻杆圆周、弹簧振子',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'p14-free-fall', name: '自由落体', status: 'coming' },
      { id: 'p14-pulley', name: '定滑轮双物体', status: 'coming' },
      { id: 'p14-incline', name: '斜面滑块', status: 'coming' },
      { id: 'p14-rod-circle', name: '轻杆圆周', status: 'coming' },
      { id: 'p14-spring-energy', name: '弹簧能量', status: 'coming' },
      { id: 'p14-pendulum', name: '单摆能量', status: 'coming' },
    ],
  },
];

// ============================================
// 化学学科
// ============================================

const CHEMISTRY_MODULES: Module[] = [
  {
    id: 'c02',
    code: 'C-02',
    name: '分子结构查看器',
    description: '3D 分子模型、键长键角、VSEPR 构型',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'c02-diatomic', name: '双原子分子', status: 'coming' },
      { id: 'c02-triatomic', name: '三原子分子', status: 'coming' },
      { id: 'c02-tetratomic', name: '四原子分子', status: 'coming' },
      { id: 'c02-pentatomic', name: '五原子及以上', status: 'coming' },
      { id: 'c02-organic', name: '有机小分子', status: 'coming' },
      { id: 'c02-ion', name: '复杂离子', status: 'coming' },
    ],
  },
  {
    id: 'c03',
    code: 'C-03',
    name: '化学方程式配平器',
    description: '方程式输入纠错、配平演示、守恒验证',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'c03-observation', name: '观察法配平', status: 'coming' },
      { id: 'c03-lcm', name: '最小公倍数法', status: 'coming' },
      { id: 'c03-odd-even', name: '奇数倍增法', status: 'coming' },
      { id: 'c03-undetermined', name: '待定系数法', status: 'coming' },
      { id: 'c03-redox', name: '氧化还原配平', status: 'coming' },
      { id: 'c03-ionic', name: '离子方程式', status: 'coming' },
    ],
  },
  {
    id: 'c04',
    code: 'C-04',
    name: '元素周期表交互平台',
    description: '118 元素信息、分类配色、性质趋势',
    priority: 'P0',
    status: 'coming',
    templates: [
      { id: 'c04-alkali', name: '碱金属族', status: 'coming' },
      { id: 'c04-alkaline-earth', name: '碱土金属族', status: 'coming' },
      { id: 'c04-nonmetal', name: '主族非金属', status: 'coming' },
      { id: 'c04-transition', name: '过渡金属', status: 'coming' },
      { id: 'c04-halogen', name: '卤素族', status: 'coming' },
      { id: 'c04-noble-gas', name: '稀有气体', status: 'coming' },
    ],
  },
  {
    id: 'c05',
    code: 'C-05',
    name: '化学键与晶体结构',
    description: '3D 晶体结构、离子键、共价键、金属键',
    priority: 'P1',
    status: 'coming',
    templates: [
      { id: 'c05-molecular-crystal', name: '分子晶体', status: 'coming' },
      { id: 'c05-atomic-crystal', name: '原子晶体', status: 'coming' },
      { id: 'c05-ionic-crystal', name: '离子晶体', status: 'coming' },
      { id: 'c05-metallic-crystal', name: '金属晶体', status: 'coming' },
      { id: 'c05-ionic-bond', name: '离子键', status: 'coming' },
      { id: 'c05-covalent-bond', name: '共价键', status: 'coming' },
    ],
  },
  {
    id: 'c06',
    code: 'C-06',
    name: '电化学演示台',
    description: '原电池、电解池、氧化还原、极板反应',
    priority: 'P2',
    status: 'coming',
    templates: [
      { id: 'c06-galvanic', name: '原电池', status: 'coming' },
      { id: 'c06-electrolysis', name: '电解池', status: 'coming' },
      { id: 'c06-hydrogen-oxygen', name: '析氢析氧', status: 'coming' },
      { id: 'c06-electroplating', name: '电镀', status: 'coming' },
      { id: 'c06-corrosion', name: '电化学腐蚀', status: 'coming' },
      { id: 'c06-fuel-cell', name: '燃料电池', status: 'coming' },
    ],
  },
  {
    id: 'c07',
    code: 'C-07',
    name: '化学反应速率与平衡',
    description: '反应速率、勒夏特列原理、平衡常数',
    priority: 'P2',
    status: 'coming',
    templates: [
      { id: 'c07-concentration', name: '浓度影响', status: 'coming' },
      { id: 'c07-temperature', name: '温度影响', status: 'coming' },
      { id: 'c07-catalyst', name: '催化剂作用', status: 'coming' },
      { id: 'c07-equilibrium', name: '平衡常数', status: 'coming' },
      { id: 'c07-le-chatelier', name: '勒夏特列原理', status: 'coming' },
      { id: 'c07-conversion', name: '转化率与产率', status: 'coming' },
    ],
  },
  {
    id: 'c08',
    code: 'C-08',
    name: '酸碱滴定与 pH 模拟器',
    description: '滴定过程动画、pH 曲线、指示剂变色',
    priority: 'P3',
    status: 'coming',
    templates: [
      { id: 'c08-strong-strong', name: '强酸强碱滴定', status: 'coming' },
      { id: 'c08-weak-strong', name: '弱酸强碱滴定', status: 'coming' },
      { id: 'c08-ph-curve', name: 'pH 变化曲线', status: 'coming' },
      { id: 'c08-indicator', name: '指示剂选择', status: 'coming' },
    ],
  },
  {
    id: 'c09',
    code: 'C-09',
    name: '有机化学反应路径图',
    description: '官能团转化、反应条件、合成路线',
    priority: 'P3',
    status: 'coming',
    templates: [
      { id: 'c09-alkane', name: '烷烃反应', status: 'coming' },
      { id: 'c09-alkene', name: '烯烃反应', status: 'coming' },
      { id: 'c09-alkyne', name: '炔烃反应', status: 'coming' },
      { id: 'c09-aromatic', name: '芳烃反应', status: 'coming' },
      { id: 'c09-functional-group', name: '官能团转化', status: 'coming' },
      { id: 'c09-synthesis', name: '合成路线', status: 'coming' },
    ],
  },
];

// ============================================
// 学科列表（导出）
// ============================================

export const SUBJECTS: Subject[] = [
  {
    id: 'math',
    name: '数学',
    icon: 'ruler',
    modules: MATH_MODULES,
  },
  {
    id: 'physics',
    name: '物理',
    icon: 'atom',
    modules: PHYSICS_MODULES,
  },
  {
    id: 'chemistry',
    name: '化学',
    icon: 'flask-conical',
    modules: CHEMISTRY_MODULES,
  },
];
