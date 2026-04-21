// P-03 experiment data derived from PRD + 实验与参数数据文档.

const W = window as any;

const P03_MODULES: ModuleDef[] = [
  { id: 'refraction', num: '01', short: '折射/全反射', full: '折射与全反射', desc: '几何光学：折射定律、临界角、光导纤维' },
  { id: 'lens', num: '02', short: '透镜成像', full: '透镜与成像', desc: '凸/凹透镜成像规律与公式验证' },
  { id: 'doubleslit', num: '03', short: '双缝干涉', full: '双缝干涉', desc: '杨氏干涉条纹与缝参数关系' },
  { id: 'diffraction', num: '04', short: '单缝/圆孔衍射', full: '单缝与圆孔衍射', desc: '衍射图样与强度分布' },
  { id: 'thinfilm', num: '05', short: '薄膜干涉', full: '薄膜干涉', desc: '肥皂泡、楔形薄膜、牛顿环' },
];

const P03_REFRACTION_MATERIAL_REFERENCES = [
  { key: 'air', label: '真空 / 空气', n: 1.0, note: '高中近似相同' },
  { key: 'water', label: '水', n: 1.333, note: '常温' },
  { key: 'glass', label: '普通玻璃', n: 1.5, note: '常用值' },
  { key: 'crown', label: '冕牌玻璃', n: 1.52, note: '光学玻璃' },
  { key: 'flint', label: '火石玻璃', n: 1.65, note: '光学玻璃' },
  { key: 'diamond', label: '金刚石', n: 2.417, note: '全反射角小' },
  { key: 'ice', label: '冰', n: 1.309, note: '-' },
];

const P03_VISIBLE_SPECTRUM = [
  { color: '红', min: 620, max: 780, representative: 700, hex: '#FF0000' },
  { color: '橙', min: 590, max: 620, representative: 600, hex: '#FF8000' },
  { color: '黄', min: 570, max: 590, representative: 580, hex: '#FFFF00' },
  { color: '绿', min: 495, max: 570, representative: 530, hex: '#00FF00' },
  { color: '蓝', min: 450, max: 495, representative: 470, hex: '#0000FF' },
  { color: '紫', min: 380, max: 450, representative: 420, hex: '#8000FF' },
];

const P03_EXPERIMENTS: Record<ModuleId, ExperimentSpec[]> = {
  refraction: [
    {
      id: 'opt-001',
      moduleId: 'refraction',
      title: 'OPT-001 平行界面折射',
      summary: '独立调节两侧介质折射率，演示折射定律与临界角。',
      category: 'refraction',
      formulas: ['n1 sin θ1 = n2 sin θ2', 'sin θc = n2 / n1（当 n1 > n2 时）'],
      teachingPoints: ['折射角由两侧折射率共同决定', '当 n1 > n2 且入射角继续增大时会出现全反射'],
      params: [
        { key: 'theta1Deg', label: '入射角 θ1', defaultValue: 30, min: 0, max: 89, step: 1, unit: '°' },
        { key: 'medium1N', label: '介质1折射率 n1', defaultValue: 1.0, min: 1.0, max: 2.5, step: 0.01 },
        { key: 'medium2N', label: '介质2折射率 n2', defaultValue: 1.5, min: 1.0, max: 2.5, step: 0.01 },
      ],
      defaults: { experimentId: 'opt-001', shape: 'interface', theta1Deg: 30, medium1N: 1.0, medium2N: 1.5, wavelength: 550, material: 'glass' },
      visualConfig: { showAngles: true, showNormals: true, showColor: true },
    },
    {
      id: 'opt-002',
      moduleId: 'refraction',
      title: 'OPT-002 矩形玻璃砖',
      summary: '展示玻璃砖双界面折射后的平行出射与侧向位移。',
      category: 'refraction',
      formulas: ['n1 sin θ1 = n2 sin θ2', 'Δ = d sin(θ1 - θ2) / cos θ2'],
      teachingPoints: ['出射光线平行于入射光线', '厚度与折射率共同影响侧移量'],
      params: [
        { key: 'theta1Deg', label: '入射角 θ', defaultValue: 45, min: 0, max: 89, step: 1, unit: '°' },
        { key: 'slabIndex', label: '玻璃折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
        { key: 'slabThicknessCm', label: '玻璃砖厚度 d', defaultValue: 5, min: 1, max: 20, step: 0.5, unit: 'cm' },
      ],
      defaults: { experimentId: 'opt-002', shape: 'slab', theta1Deg: 45, slabIndex: 1.5, slabThicknessCm: 5, wavelength: 550, material: 'glass' },
      visualConfig: { showAngles: true, showNormals: true, showColor: true },
    },
    {
      id: 'opt-003',
      moduleId: 'refraction',
      title: 'OPT-003 半球形玻璃砖',
      summary: '区分球心入射和平面入射，重点演示曲面法线与临界角判定。',
      category: 'refraction',
      formulas: ['球心入射：曲面处入射角 = 0°', '平面入射：sin θc = 1 / n'],
      teachingPoints: ['球心入射法用于判断曲面处是否折射', '平面入射后到曲面可继续判断全反射'],
      params: [
        { key: 'theta1Deg', label: '入射角 θ', defaultValue: 30, min: 0, max: 89, step: 1, unit: '°' },
        { key: 'hemisphereIndex', label: '折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
        { key: 'hemisphereRadiusCm', label: '半径 R', defaultValue: 5, min: 2, max: 10, step: 0.5, unit: 'cm' },
      ],
      defaults: { experimentId: 'opt-003', shape: 'half', theta1Deg: 30, hemisphereIndex: 1.5, hemisphereRadiusCm: 5, hemisphereMode: 'plane', wavelength: 550, material: 'glass' },
      visualConfig: { showAngles: true, showNormals: true, showColor: true },
    },
    {
      id: 'opt-004',
      moduleId: 'refraction',
      title: 'OPT-004 光导纤维模型',
      summary: '演示纤芯-包层界面连续全反射与弯曲损耗趋势。',
      category: 'refraction',
      formulas: ['sin θc = n2 / n1', '光在纤芯-包层界面全反射'],
      teachingPoints: ['n1 必须大于 n2', '弯曲半径越小越容易漏光'],
      params: [
        { key: 'fiberCoreN', label: '纤芯折射率 n1', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
        { key: 'fiberCladdingN', label: '包层折射率 n2', defaultValue: 1.3, min: 1.0, max: 1.8, step: 0.01 },
        { key: 'fiberBendRadiusCm', label: '弯曲半径 R', defaultValue: 10, min: 2, max: 50, step: 1, unit: 'cm' },
      ],
      defaults: { experimentId: 'opt-004', shape: 'fiber', theta1Deg: 25, fiberCoreN: 1.5, fiberCladdingN: 1.3, fiberBendRadiusCm: 10, wavelength: 550, material: 'fiber' },
      visualConfig: { showAngles: true, showNormals: true, showColor: true },
    },
  ],
  lens: [
    {
      id: 'opt-011',
      moduleId: 'lens',
      title: 'OPT-011 凸透镜成像',
      summary: '演示物距变化下的像距、正倒、大小与虚实变化。',
      category: 'lens',
      formulas: ['1 / u + 1 / v = 1 / f'],
      teachingPoints: ['u > 2f：倒立缩小实像', 'f < u < 2f：倒立放大实像', 'u = f：不成像，出射光平行'],
      params: [
        { key: 'focalLength', label: '焦距 f', defaultValue: 10, min: 2, max: 30, step: 1, unit: 'cm' },
        { key: 'objectDistance', label: '物距 u', defaultValue: 25, min: 1, max: 100, step: 1, unit: 'cm' },
      ],
      defaults: { experimentId: 'opt-011', lensType: 'convex', focalLength: 10, objectDistance: 25, objectHeight: 40 },
      visualConfig: { showRays: true, showFormula: true },
    },
    {
      id: 'opt-012',
      moduleId: 'lens',
      title: 'OPT-012 凹透镜成像',
      summary: '凹透镜对实物始终成正立缩小虚像。',
      category: 'lens',
      formulas: ['1 / u + 1 / v = 1 / f（f < 0）'],
      teachingPoints: ['焦距取负值', '始终成正立缩小虚像'],
      params: [
        { key: 'focalLength', label: '焦距 |f|', defaultValue: 10, min: 2, max: 30, step: 1, unit: 'cm' },
        { key: 'objectDistance', label: '物距 u', defaultValue: 25, min: 1, max: 100, step: 1, unit: 'cm' },
      ],
      defaults: { experimentId: 'opt-012', lensType: 'concave', focalLength: 10, objectDistance: 25, objectHeight: 40 },
      visualConfig: { showRays: true, showFormula: true },
    },
  ],
  doubleslit: [
    {
      id: 'opt-021',
      moduleId: 'doubleslit',
      title: 'OPT-021 杨氏双缝干涉',
      summary: '展示双缝条纹随缝间距、波长和屏距变化的规律。',
      category: 'interference',
      formulas: ['Δy = λL / d', 'd sin θ = kλ', 'd sin θ = (k + 1/2)λ'],
      teachingPoints: ['d 增大时条纹变密', 'λ 或 L 增大时条纹变宽', '白光干涉中央为白色'],
      params: [
        { key: 'slitSpacing', label: '缝间距 d', defaultValue: 200, min: 50, max: 1000, step: 10, unit: 'μm' },
        { key: 'screenDistance', label: '屏距 L', defaultValue: 1.0, min: 0.1, max: 5.0, step: 0.1, unit: 'm' },
        { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      ],
      defaults: { experimentId: 'opt-021', slitSpacing: 200, slitWidth: 20, screenDistance: 1.0, wavelength: 550, whiteLight: false },
      visualConfig: { showColor: true, showIntensity: true, showFormula: true },
    },
  ],
  diffraction: [
    {
      id: 'opt-031',
      moduleId: 'diffraction',
      title: 'OPT-031 单缝衍射',
      summary: '演示缝宽与波长对中央明纹宽度的影响。',
      category: 'diffraction',
      formulas: ['2θ = 2λ / a', 'a sin θ = kλ'],
      teachingPoints: ['中央明纹最宽最亮', '缝宽减小 -> 条纹变宽', '波长增大 -> 条纹变宽'],
      params: [
        { key: 'slitWidth', label: '缝宽 a', defaultValue: 100, min: 10, max: 500, step: 5, unit: 'μm' },
        { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      ],
      defaults: { experimentId: 'opt-031', aperture: 'slit', slitWidth: 100, diameter: 200, wavelength: 550, screenDistance: 1.5 },
      visualConfig: { showColor: true, showIntensity: true, showFormula: true },
    },
    {
      id: 'opt-032',
      moduleId: 'diffraction',
      title: 'OPT-032 圆孔衍射',
      summary: '演示圆孔衍射的艾里斑大小随孔径与波长变化的规律。',
      category: 'diffraction',
      formulas: ['θ = 1.22 λ / D'],
      teachingPoints: ['孔径越小艾里斑越大', '波长越长艾里斑越大'],
      params: [
        { key: 'diameter', label: '孔径 D', defaultValue: 200, min: 20, max: 1000, step: 10, unit: 'μm' },
        { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      ],
      defaults: { experimentId: 'opt-032', aperture: 'circle', slitWidth: 100, diameter: 200, wavelength: 550, screenDistance: 1.5 },
      visualConfig: { showColor: true, showIntensity: true, showFormula: true },
    },
  ],
  thinfilm: [
    {
      id: 'opt-041',
      moduleId: 'thinfilm',
      title: 'OPT-041 肥皂泡干涉',
      summary: '膜厚不均匀时不同位置满足不同级次干涉条件，形成彩色条纹。',
      category: 'thin_film',
      formulas: ['2nd cos θ = kλ（明纹，反射光）'],
      teachingPoints: ['白光下不同波长满足条件的位置不同', '膜厚沿高度变化时会形成彩色条纹带'],
      params: [
        { key: 'thickness', label: '薄膜厚度 t', defaultValue: 600, min: 200, max: 1800, step: 20, unit: 'nm' },
        { key: 'filmN', label: '薄膜折射率 n', defaultValue: 1.33, min: 1.0, max: 1.6, step: 0.01 },
      ],
      defaults: { experimentId: 'opt-041', filmType: 'soap', thickness: 600, filmN: 1.33, wavelength: 550 },
      visualConfig: { showIntensity: true, showFormula: true },
    },
    {
      id: 'opt-042',
      moduleId: 'thinfilm',
      title: 'OPT-042 楔形薄膜干涉',
      summary: '等厚干涉形成近似平行等间距条纹。',
      category: 'thin_film',
      formulas: ['l = λ / (2n sin α)'],
      teachingPoints: ['楔角越小条纹越稀疏', '波长越长条纹间距越大'],
      params: [
        { key: 'wedgeAngle', label: '楔角 α', defaultValue: 1.0, min: 0.1, max: 10, step: 0.1, unit: '′' },
        { key: 'filmN', label: '薄膜折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
        { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      ],
      defaults: { experimentId: 'opt-042', filmType: 'wedge', wedgeAngle: 1.0, filmN: 1.5, wavelength: 550 },
      visualConfig: { showIntensity: true, showFormula: true },
    },
    {
      id: 'opt-043',
      moduleId: 'thinfilm',
      title: 'OPT-043 牛顿环',
      summary: '平凸透镜与平板间空气薄层干涉形成同心圆环。',
      category: 'thin_film',
      formulas: ['r_k = sqrt((k - 1/2)Rλ)', 'r_k = sqrt(kRλ)'],
      teachingPoints: ['中心为暗点', '图样应表现为同心圆环'],
      params: [
        { key: 'lensR', label: '曲率半径 R', defaultValue: 1.0, min: 0.1, max: 10, step: 0.1, unit: 'm' },
        { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      ],
      defaults: { experimentId: 'opt-043', filmType: 'newton', lensR: 1.0, filmN: 1.33, wavelength: 550 },
      visualConfig: { showIntensity: true, showFormula: true },
    },
  ],
};

function buildP03Defaults() {
  return {
    refraction: {
      material: 'glass',
      wavelength: 550,
      showAngles: true,
      showNormals: true,
      showFormula: true,
      showColor: true,
      rayThick: 2,
      medium1N: 1.0,
      medium2N: 1.5,
      slabIndex: 1.5,
      slabThicknessCm: 5,
      hemisphereIndex: 1.5,
      hemisphereRadiusCm: 5,
      hemisphereMode: 'plane',
      fiberCoreN: 1.5,
      fiberCladdingN: 1.3,
      fiberBendRadiusCm: 10,
      theta1Deg: 30,
      shape: 'interface',
      ...P03_EXPERIMENTS.refraction[0].defaults,
    },
    lens: {
      showRays: true,
      showFormula: true,
      rayThick: 1.8,
      objectHeight: 40,
      ...P03_EXPERIMENTS.lens[0].defaults,
    },
    doubleslit: {
      slitWidth: 20,
      whiteLight: false,
      showColor: true,
      showIntensity: true,
      showFormula: true,
      ...P03_EXPERIMENTS.doubleslit[0].defaults,
    },
    diffraction: {
      screenDistance: 1.5,
      showColor: true,
      showIntensity: true,
      showFormula: true,
      compareMode: false,
      ...P03_EXPERIMENTS.diffraction[0].defaults,
    },
    thinfilm: {
      thickness: 600,
      filmN: 1.33,
      lensR: 1.0,
      wedgeAngle: 1.0,
      showIntensity: true,
      showFormula: true,
      ...P03_EXPERIMENTS.thinfilm[2].defaults,
    },
  };
}

function getP03Experiment(moduleId: ModuleId, experimentId: string): ExperimentSpec | undefined {
  return P03_EXPERIMENTS[moduleId].find((item) => item.id === experimentId);
}

function getP03ParamSpec(moduleId: ModuleId, experimentId: string, key: string): ExperimentParamSpec | undefined {
  const experiment = getP03Experiment(moduleId, experimentId);
  return experiment?.params.find((item) => item.key === key);
}

Object.assign(W, {
  P03_MODULES,
  P03_EXPERIMENTS,
  P03_DEFAULTS: buildP03Defaults(),
  P03_REFRACTION_MATERIAL_REFERENCES,
  P03_VISIBLE_SPECTRUM,
  getP03Experiment,
  getP03ParamSpec,
});

export {};
