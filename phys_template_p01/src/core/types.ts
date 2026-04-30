/**
 * 核心类型系统 — 阶段2定义的全部51个 TypeScript 接口/类型
 *
 * 8个模块：基础几何、实体、关系、参数Schema、物理结果、模拟状态、视角层、渲染
 */

// ═══════════════════════════════════════════════
// 模块 1：基础向量与几何类型
// ═══════════════════════════════════════════════

/** 二维向量 */
export interface Vec2 {
  x: number;
  y: number;
}

/** 矩形区域（用于场区域、命中检测、边界框） */
export interface Rect {
  x: number; // 左上角 x
  y: number; // 左上角 y
  width: number;
  height: number;
}

/** 空间变换（实体在场景中的位姿） */
export interface Transform {
  position: Vec2; // 物理坐标系下的位置
  rotation: number; // 弧度，逆时针为正
}

// ═══════════════════════════════════════════════
// 模块 2：Entity 基础接口
// ═══════════════════════════════════════════════

/** 实体标识 */
export type EntityId = string;

/** 实体类型标识 */
export type EntityType = string;

/** 实体类别 */
export type EntityCategory =
  | 'object' // 物体：物块、小球、小车、带电粒子、导体棒
  | 'surface' // 表面：水平面、斜面、弧形轨道、导轨
  | 'connector' // 连接件：弹簧、轻绳、轻杆、滑轮
  | 'field' // 场：重力场、匀强电场、匀强磁场
  | 'constraint' // 约束源：铰接点、固定点、滑动轨道
  | 'instrument'; // 观测工具：速度传感器、能量计、电压表

/** 实体基础接口 */
export interface Entity<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly id: EntityId;
  readonly type: EntityType;
  readonly category: EntityCategory;
  transform: Transform;
  properties: TProps;
  label?: string; // 场景中显示的名称
}

// ═══════════════════════════════════════════════
// 模块 3：Relation 接口
// ═══════════════════════════════════════════════

/** 关系标识 */
export type RelationId = string;

/** 关系类型标识 */
export type RelationType = string;

/** 关系基础接口 */
export interface Relation<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly id: RelationId;
  readonly type: RelationType;
  readonly sourceEntityId: EntityId; // 关系的主动方
  readonly targetEntityId: EntityId; // 关系的被动方
  properties: TProps;
}

// ═══════════════════════════════════════════════
// 模块 4：参数 Schema 类型
// ═══════════════════════════════════════════════

/** 参数控件类型 */
export type ParamControlType = 'slider' | 'input' | 'toggle' | 'select';

export interface ParamVisibilityRule {
  key: string;
  equals?: number | boolean | string;
  notEquals?: number | boolean | string;
}

/** 参数 Schema 基础接口 */
export interface ParamSchemaBase {
  key: string; // 参数的程序标识
  label: string; // 面板显示名称
  group?: string; // 所属分组名
  targetEntityId?: EntityId; // 该参数影响哪个实体
  targetProperty?: string; // 映射到实体 properties 中的字段名
  visibleWhen?: ParamVisibilityRule[]; // 满足全部规则时才显示
}

/** 滑块参数 */
export interface SliderParamSchema extends ParamSchemaBase {
  type: 'slider';
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  precision?: number; // 显示小数位数
  inputMax?: number; // 数字输入框允许的最大值（可大于 slider max，用于自定义输入）
}

/** 输入框参数 */
export interface InputParamSchema extends ParamSchemaBase {
  type: 'input';
  min?: number;
  max?: number;
  default: number;
  unit: string;
  precision?: number;
}

/** 开关参数 */
export interface ToggleParamSchema extends ParamSchemaBase {
  type: 'toggle';
  default: boolean;
  labelOn?: string; // 开启时显示文本
  labelOff?: string; // 关闭时显示文本
}

/** 选择参数 */
export interface SelectParamSchema extends ParamSchemaBase {
  type: 'select';
  options: Array<{ value: string; label: string }>;
  default: string;
}

/** 参数 Schema 联合类型 */
export type ParamSchema =
  | SliderParamSchema
  | InputParamSchema
  | ToggleParamSchema
  | SelectParamSchema;

/** 参数分组（驱动面板分区渲染） */
export interface ParamGroup {
  key: string; // 分组标识
  label: string; // 分组标题
  params: ParamSchema[];
}

/** 参数值运行时容器 */
export type ParamValues = Record<string, number | boolean | string>;

// ═══════════════════════════════════════════════
// 模块 5：PhysicsResult 接口
// ═══════════════════════════════════════════════

/** 力的类型标识（用于颜色映射） */
export type ForceType =
  | 'gravity' // 重力 G — 深红 #C0392B
  | 'normal' // 支持力 N — 蓝色 #2980B9
  | 'friction' // 摩擦力 f — 橙色 #E67E22
  | 'tension' // 弹力/绳张力 T — 绿色 #27AE60
  | 'electric' // 电场力 qE — 金色 #F39C12
  | 'lorentz' // 洛伦兹力 qvB — 品红 #9B59B6
  | 'ampere' // 安培力 BIL — 品红 #9B59B6
  | 'resultant' // 合力 F合 — 紫色 #8E44AD
  | 'spring' // 弹簧弹力 — 绿色 #27AE60
  | 'custom'; // 域扩展的自定义力

/** 单个力 */
export interface Force {
  type: ForceType;
  label: string; // 标注文本
  magnitude: number; // 大小（N）
  direction: Vec2; // 单位方向向量
  applicationPoint?: Vec2; // 力的作用点（物理坐标），默认实体中心
  displayMagnitude?: number; // 用于箭头长度缩放的显示量级（不影响标签数值）
}

/** 正交分解结果 */
export interface OrthogonalDecomposition {
  axis1: Vec2; // 第一个轴方向
  axis2: Vec2; // 第二个轴方向
  components: Array<{
    force: Force; // 原始力
    component1: number; // 在 axis1 方向的分量大小（带符号）
    component2: number; // 在 axis2 方向的分量大小（带符号）
  }>;
}

/** 单个实体的受力分析 */
export interface ForceAnalysis {
  entityId: EntityId;
  forces: Force[]; // 所有独立力
  resultant: Force; // 合力
  decomposition?: OrthogonalDecomposition; // 正交分解（仅非正交场景需要）
}

/** 单个实体的运动状态 */
export interface MotionState {
  entityId: EntityId;
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;
  rotation?: number; // 实体朝向（弧度），覆盖 transform.rotation
  angularVelocity?: number; // rad/s
  trajectory?: Vec2[]; // 历史轨迹点
  entityPropsPatch?: Record<string, unknown>; // 将运行时属性同步回实体，供 UI / seek / reset 使用
}

/** 单个实体的能量状态 */
export interface EnergyState {
  entityId: EntityId;
  kineticEnergy: number; // 动能 Ek
  potentialEnergies: Array<{
    type: string; // 如 'gravitational' | 'elastic' | 'electric'
    label: string;
    value: number;
  }>;
  totalEnergy: number; // 总机械能
  workDone?: Array<{
    forceType: ForceType;
    label: string;
    value: number;
  }>;
}

/** 求解器完整输出（某一时刻） */
export interface PhysicsResult {
  time: number; // 当前时刻 t（秒）
  forceAnalyses: Map<EntityId, ForceAnalysis>;
  motionStates: Map<EntityId, MotionState>;
  energyStates?: Map<EntityId, EnergyState>; // 仅能量视角需要时计算
}

// ═══════════════════════════════════════════════
// 模块 6：SimulationState 接口
// ═══════════════════════════════════════════════

/** 模拟状态枚举 */
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'finished';

/** 求解模式 */
export type SolveMode = 'analytical' | 'numerical';

/** 积分器类型 */
export type IntegratorType =
  | 'semi-implicit-euler'
  | 'velocity-verlet'
  | 'rk4';

/** 时间轴状态 */
export interface TimelineState {
  currentTime: number; // 当前时刻（秒）
  duration: number; // 模拟总时长（秒）
  playbackRate: number; // 播放速率
  dt: number; // 时间步长（秒）
}

/** 场景定义（静态数据，预设加载后不变） */
export interface SceneDefinition {
  entities: Map<EntityId, Entity>;
  relations: Relation[];
  paramGroups: ParamGroup[];
  paramValues: ParamValues;
}

/** 模拟全局状态 */
export interface SimulationState {
  status: SimulationStatus;
  solveMode: SolveMode;
  integrator: IntegratorType;
  timeline: TimelineState;
  scene: SceneDefinition;
  currentResult: PhysicsResult | null;
  resultHistory: PhysicsResult[];
}

// ═══════════════════════════════════════════════
// 模块 7：视角层类型
// ═══════════════════════════════════════════════

/** 视角类型 */
export type ViewportType =
  | 'force'
  | 'motion'
  | 'energy'
  | 'momentum'
  | 'field'
  | 'circuit';

/** 信息密度 */
export type InfoDensity = 'compact' | 'standard' | 'detailed';

/** P-08 场线密度 */
export type FieldLineDensity = 'sparse' | 'standard' | 'dense';

/** 视角层状态 */
export interface ViewportState {
  primary: ViewportType; // 当前主视角
  overlays: ViewportType[]; // 叠加层列表
  density: InfoDensity;
}

/** 受力视角数据 */
export interface ForceViewportData {
  analyses: ForceAnalysis[];
}

/** 运动视角数据 */
export interface MotionViewportData {
  motionStates: MotionState[];
  analyses?: ForceAnalysis[];
}

/** 能量视角数据 */
export interface EnergyViewportData {
  energyStates: EnergyState[];
  systemTotalEnergy?: number;
}

/** 动量视角数据 */
export interface MomentumViewportData {
  momenta: Array<{
    entityId: EntityId;
    momentum: Vec2;
    label: string;
  }>;
  systemTotalMomentum?: Vec2;
}

/** 场视角数据 */
export interface FieldViewportData {
  fieldEntities: Array<{
    entityId: EntityId;
    fieldType: string;
    region: Rect;
    direction: Vec2;
    magnitude: number;
  }>;
}

/** 电路视角数据 */
export interface CircuitViewportData {
  emf?: number;
  current?: number;
  currentDirection?: Vec2;
  voltages?: Array<{
    label: string;
    value: number;
  }>;
}

/** 视角数据联合类型 */
export type ViewportData =
  | { type: 'force'; data: ForceViewportData }
  | { type: 'motion'; data: MotionViewportData }
  | { type: 'energy'; data: EnergyViewportData }
  | { type: 'momentum'; data: MomentumViewportData }
  | { type: 'field'; data: FieldViewportData }
  | { type: 'circuit'; data: CircuitViewportData };

// ═══════════════════════════════════════════════
// 模块 8：渲染相关类型
// ═══════════════════════════════════════════════

/** 坐标变换参数 */
export interface CoordinateTransform {
  scale: number; // 物理单位到像素的缩放比
  origin: Vec2; // 物理坐标原点在画布上的像素位置
}

/** 渲染上下文 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  coordinateTransform: CoordinateTransform;
  viewport: ViewportState;
  selectedEntityId: EntityId | null;
  relations?: Relation[];
  dt: number; // 帧间隔
}

/** 命中检测结果 */
export interface HitTestResult {
  entityId: EntityId;
  entityType: EntityType;
  hitPoint: Vec2; // 命中位置（物理坐标）
  distance: number; // 命中点到实体中心/边界的距离
}

// ═══════════════════════════════════════════════
// 模块 8a：预设 Schema 类型
// ═══════════════════════════════════════════════

/** 预设中的实体定义（比 Entity 接口更简洁） */
export interface PresetEntityDef {
  /** 预设内部引用标识，用于 relations 和 paramGroups 中引用本实体 */
  ref: string;
  /** 实体类型标识（必须已在 EntityRegistry 中注册） */
  type: EntityType;
  /** 属性值（覆盖 EntityRegistration.defaultProperties） */
  properties: Record<string, unknown>;
  /** 初始位姿（可选，默认原点） */
  transform?: Transform;
  /** 显示名称（可选） */
  label?: string;
}

/** 预设中的关系定义 */
export interface PresetRelationDef {
  /** 关系类型 */
  type: RelationType;
  /** 主动方引用（对应 PresetEntityDef.ref） */
  sourceRef: string;
  /** 被动方引用 */
  targetRef: string;
  /** 关系属性 */
  properties: Record<string, unknown>;
}

/** 事件触发后的动作 */
export type EventAction =
  | { type: 'stop' }
  | { type: 'switch-solver'; solverId: string }
  | { type: 'mark-state'; label: string }
  | { type: 'notify'; message: string };

/** 事件-动作映射 */
export interface EventActionMapping {
  eventType: string;
  entityId?: string; // 可选：只匹配特定实体的事件（使用 ref，加载时替换）
  action: EventAction;
}

/** 预设数据（预设 JSON 文件的完整类型） */
export interface PresetData {
  /** 预设唯一标识 */
  id: string;
  /** Schema 版本号 */
  version: string;
  /** 预设名称 */
  name: string;
  /** 描述文本 */
  description: string;
  /** 所属模块（PRD 模块编号） */
  category: string;
  /** 支持的视角列表 */
  supportedViewports: ViewportType[];
  /** 默认主视角 */
  defaultViewport: ViewportType;
  /** 画布显示配置 */
  displayConfig?: {
    scale?: number;
    origin?: Vec2;
  };
  /** 实体定义列表 */
  entities: PresetEntityDef[];
  /** 关系定义列表 */
  relations: PresetRelationDef[];
  /** 参数分组定义 */
  paramGroups: ParamGroup[];
  /** 参数默认值 */
  paramValues: ParamValues;
  /** 求解模式 */
  solveMode: SolveMode;
  /** 模拟总时长（秒） */
  duration: number;
  /** 求解器 qualifier（可选） */
  solverQualifier?: Record<string, string>;
  /** 事件-动作映射（可选） */
  eventActions?: EventActionMapping[];
}

/** 预设校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 模拟器事件类型 */
export type SimulatorEvent =
  | 'frame'
  | 'finished'
  | 'preset-loaded'
  | 'reset'
  | 'physics-event';

/** 物理事件 */
export interface PhysicsEvent {
  type: string;
  time: number;
  entityId?: EntityId;
  description: string;
  data?: Record<string, unknown>;
}

/** 模拟器事件处理器 */
export type SimulatorEventHandler = (data: unknown) => void;

// ═══════════════════════════════════════════════
// 模块 9：渲染相关类型
// ═══════════════════════════════════════════════

/** 箭头样式 */
export type ArrowHeadStyle = 'solid' | 'hollow';

/** 线条样式 */
export type LineStyle = 'solid' | 'dashed';

/** 物理量视觉样式 */
export interface VisualStyle {
  color: string; // 十六进制颜色
  lineWidth: number;
  lineStyle: LineStyle;
  arrowHead: ArrowHeadStyle;
  opacity: number; // 0-1
}

/** 力的视觉语言映射表 */
export type ForceVisualMap = Record<ForceType, VisualStyle>;

/** 物理量视觉语言映射表 */
export interface PhysicsVisualMap {
  forces: ForceVisualMap;
  velocity: VisualStyle;
  acceleration: VisualStyle;
  momentum: VisualStyle;
}
