# 预设 Schema 与视角层设计

> 阶段4产出。基于阶段2的51个TypeScript接口和阶段3的28个API类型，定义预设JSON完整字段规范、分类体系、视角层行为规范、数据流设计，并编写3个完整预设示例和预设开发指南。

---

## 1. Preset JSON Schema 字段规范

### 1.1 PresetData 完整字段定义

基于阶段3骨架，补充值域、约束、规则：

```typescript
interface PresetData {
  // ─── 元信息 ───

  /** 预设唯一标识。格式：`${模块号}-${模型ID}-${变体}`
   *  模块号：PRD 模块编号去掉连字符（P01, P02, ...）
   *  模型ID：PRD 模型编号去掉连字符（FM001, MOT003, EMF031, ...）
   *  变体：场景变体名（小写连字符）
   *  示例：'P01-FM002-sliding-down', 'P02-MOT003-basic', 'P08-EMF031-circular'
   *  约束：全局唯一 */
  id: string;

  /** Schema 版本号。用于后续 Schema 变更时的兼容性处理
   *  格式：语义版本号 `${major}.${minor}`
   *  当前版本：'1.0'
   *  规则：major 变更表示不兼容，minor 变更表示向后兼容 */
  version: string;

  /** 预设名称（中文），用于 UI 展示
   *  示例："斜面·从静止下滑"、"平抛运动"
   *  约束：不超过 20 个字符 */
  name: string;

  /** 描述文本（中文），说明该预设对应的物理场景
   *  示例："物块在粗糙斜面上从静止开始下滑，分析受力、运动和能量"
   *  约束：不超过 100 个字符 */
  description: string;

  /** 所属模块。值为 PRD 模块编号
   *  枚举：'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05' | 'P-06' | 'P-07' | 'P-08' | 'P-09' | 'P-12' | 'P-13' | 'P-14'
   *  示例：'P-01'（受力分析器）, 'P-08'（电磁场可视化器）
   *  详见 §2 分类体系设计 */
  category: string;

  // level 字段已在阶段7发散审查中删除（PRD 无预设难度分级需求）

  /** 支持的视角列表。由预设显式声明（教学设计决策，非技术能力推断）
   *  约束：必须是 ViewportType 的子集，至少 1 个
   *  UI 行为：未列入的视角按钮显示为灰色不可点击 */
  supportedViewports: ViewportType[];

  /** 默认主视角。打开预设后的初始视角
   *  约束：必须在 supportedViewports 中 */
  defaultViewport: ViewportType;

  // ─── 画布初始配置 ───

  /** 画布显示配置（可选）。控制初始视角的缩放和平移
   *  不配置时使用智能默认值：自动缩放适配所有实体 */
  displayConfig?: {
    /** 物理坐标到像素的缩放比（px/m）
     *  典型值：力学场景 100-200，电磁场景 50-100（微观粒子需要大缩放） */
    scale?: number;

    /** 物理坐标原点在画布上的位置（像素坐标）
     *  不配置时默认画布中心偏左下（给运动留空间） */
    origin?: Vec2;
  };

  // ─── 场景数据 ───

  /** 实体定义列表。详见 §1.2 PresetEntityDef 字段规范 */
  entities: PresetEntityDef[];

  /** 关系定义列表。详见 §1.3 PresetRelationDef 字段规范 */
  relations: PresetRelationDef[];

  /** 参数分组定义。详见 §1.4 参数映射规则 */
  paramGroups: ParamGroup[];

  /** 参数默认值。key 与 paramGroups 中各 param 的 key 一一对应
   *  约束：每个 paramGroups 中声明的 param.key 都必须在此有对应值 */
  paramValues: ParamValues;

  // ─── 求解配置 ───

  /** 求解模式。决定 Simulator 如何调用求解器
   *  'analytical'：解析解，给定 t 直接计算
   *  'numerical'：数值积分，逐帧迭代 */
  solveMode: SolveMode;

  /** 模拟总时长（秒）
   *  约束：> 0，合理范围见下表
   *  | 场景类型 | 典型时长 | 说明 |
   *  |---------|---------|------|
   *  | 纯受力分析（静态） | 1-5 | 无运动，只看力 |
   *  | 匀加速直线运动 | 3-10 | 斜面下滑等 |
   *  | 平抛运动 | 2-5 | 落地即停 |
   *  | 圆周运动 | 5-10 | 至少完整一圈 |
   *  | 数值积分（ODE） | 5-20 | 需要看到趋近终态 |
   */
  duration: number;

  /** 求解器 qualifier（可选）。用于在多个匹配的求解器中精确选择
   *  示例：{ model: 'single-bar-induction' }
   *  大多数预设不需要此字段（通过 entityTypes + relationType 即可唯一匹配） */
  solverQualifier?: Record<string, string>;

  /** 事件-动作映射（可选）。定义物理事件触发后的系统响应
   *  详见 §1.5 事件配置模式 */
  eventActions?: EventActionMapping[];
}
```

### 1.2 PresetEntityDef 字段规范

```typescript
interface PresetEntityDef {
  /** 预设内部引用标识。用于 relations 和 paramGroups 中引用本实体
   *  格式建议：`${type}-${标识}`，如 'block-A', 'slope-1', 'bfield-1'
   *  约束：预设内唯一，不是最终 EntityId（加载时自动生成真实 id）
   *  约束：只允许小写字母、数字、连字符 */
  ref: string;

  /** 实体类型标识。必须已在 EntityRegistry 中注册
   *  力学域：'block' | 'ball' | 'slope' | 'horizontal-surface' | 'arc-track' | 'spring' | 'rope'
   *  电磁域：'charged-particle' | 'efield' | 'bfield' | 'conductor-bar' | 'rail' | 'resistor'
   *  约束：PresetLoader 会校验该类型是否已注册 */
  type: EntityType;

  /** 属性值。覆盖 EntityRegistration.defaultProperties 中的对应字段
   *  只需列出与默认值不同的属性
   *  约束：属性名必须与注册时的 defaultProperties 中的 key 一致 */
  properties: Record<string, unknown>;

  /** 初始位姿（可选）。不配置时使用原点 { position: {x:0, y:0}, rotation: 0 }
   *  position: 物理坐标（米），不是像素坐标
   *  rotation: 弧度，逆时针为正 */
  transform?: Transform;

  /** 显示名称（可选）。用于 UI 中标注该实体
   *  示例："物块"、"物体A"、"斜面"、"匀强磁场"
   *  不配置时使用 EntityRegistration.label */
  label?: string;
}
```

### 1.3 PresetRelationDef 字段规范

```typescript
interface PresetRelationDef {
  /** 关系类型
   *  已定义的类型：
   *  | type | 语义 | source → target |
   *  |------|------|-----------------|
   *  | 'contact' | 接触 | 物体 → 表面 |
   *  | 'connection' | 连接 | 物体 → 连接件 |
   *  | 'field-effect' | 场作用 | 场 → 受作用物体 |
   *  | 'containment' | 包含 | 容器 → 被包含物体 |
   */
  type: RelationType;

  /** 主动方引用。对应 PresetEntityDef.ref
   *  约束：必须在 entities 中存在对应 ref 的实体 */
  sourceRef: string;

  /** 被动方引用。对应 PresetEntityDef.ref */
  targetRef: string;

  /** 关系属性。不同关系类型有不同的属性字段：
   *
   *  contact（接触关系）:
   *    friction: number        — 动摩擦因数 μ（0-1）
   *    normalDirection?: Vec2  — 法线方向（指向物体一侧），可选，由求解器自动计算
   *
   *  connection（连接关系）:
   *    connectorType: string   — 连接件类型 'spring' | 'rope' | 'rod'
   *    naturalLength?: number  — 自然长度（弹簧用）
   *    stiffness?: number      — 劲度系数（弹簧用）
   *
   *  field-effect（场作用关系）:
   *    无额外属性（场参数在场实体的 properties 中定义）
   *
   *  containment（包含关系）:
   *    无额外属性
   */
  properties: Record<string, unknown>;
}
```

### 1.4 参数映射规则

预设 JSON 中 `paramGroups` 的参数如何映射到实体属性：

```
参数面板操作
    ↓
ParamSchema.key → paramValues[key] = newValue
    ↓
ParamSchema.targetEntityId（ref）→ 找到目标实体
ParamSchema.targetProperty → 更新实体 properties 中的对应字段
    ↓
Simulator.updateParam() → 触发重新求解
```

**关键规则**：

1. `targetEntityId` 在预设 JSON 中使用 **ref**（如 `"block-A"`），PresetLoader 加载时替换为真实 EntityId
2. 不是所有参数都映射到实体属性。有些参数（如 `friction-toggle`）控制的是行为开关，由求解器从 `scene.paramValues` 中直接读取
3. 没有 `targetEntityId` 的参数，求解器通过 `scene.paramValues[key]` 直接访问其值
4. 参数的 `group` 字段（在 ParamSchemaBase 中）可省略——参数已经通过 `ParamGroup` 结构组织了分组

**toggle 联动模式**：

摩擦 toggle 控制摩擦因数 slider 的可见性：
```jsonc
{
  "key": "friction-toggle", "type": "toggle",
  "default": true, "labelOn": "粗糙", "labelOff": "光滑"
}
// 当 friction-toggle = false 时，UI 隐藏 friction-coeff slider
// 求解器从 paramValues 中读取 friction-toggle，为 false 时令 μ=0
```

这个联动逻辑在 Phase 1 由参数面板组件（`ParameterPanel`）内置处理：当某个 toggle 的 key 以 `-toggle` 结尾，且存在同 group 中 key 为去掉 `-toggle` 后缀加 `-coeff` 的 slider，则 toggle 控制该 slider 的显隐。这是一个简单的命名约定。（`ParamLinkage` 接口已在阶段7发散审查中删除）

### 1.5 事件配置模式

常见的事件配置模式：

```typescript
// 模式1：到达边界时停止
{
  eventType: 'reach-boundary',
  entityId: 'block-A',  // 使用 ref，加载时替换
  action: { type: 'stop' }
}

// 模式2：进入场区域时标记状态
{
  eventType: 'enter-region',
  entityId: 'particle-1',
  action: { type: 'mark-state', label: '进入磁场' }
}

// 模式3：离开场区域时通知
{
  eventType: 'leave-region',
  entityId: 'particle-1',
  action: { type: 'notify', message: '粒子离开磁场区域' }
}

// 模式4：到达终态时停止（数值积分场景）
{
  eventType: 'reach-terminal',
  action: { type: 'stop' }
}
```

**注意**：`eventActions` 中的 `entityId` 也使用 ref，PresetLoader 加载时替换。`entityId` 为可选——不指定时匹配所有实体的该类型事件。

---

## 2. 分类体系设计

### 2.1 分类规范

**`category` 字段直接使用 PRD 模块编号**，不另设分类层级。PRD 已完成模块划分和模型枚举，分类体系直接复用。

```
P-01  受力分析器           FM-XXX   （13种受力模型）
P-02  运动模拟器           MOT-XXX  （6种运动场景）
P-03  光学实验台           OPT-XXX  （5种光学实验）
P-04  电路搭建器           CIR-XXX  （电路搭建 + 五大实验模板）
P-05  简谐运动与弹簧振子   SHM-XXX  （4种振动模型）
P-06  波动与振动演示台     WAV-XXX  （6种波动演示）
P-07  热力学与气体分子模拟器 THM-XXX（热力学模型）
P-08  电场与磁场可视化器   EMF-XXX  （5类场景）
P-09  天体运动与引力模拟器 AST-XXX  （天体模型）
P-12  动量定理及动量守恒   MOM-XXX  （碰撞 + 类碰撞模型）
P-13  电磁感应             EMI-XXX  （电磁感应模型）
P-14  机械能守恒           ENE-XXX  （机械能模型）
```

**预设 id 格式**：`${模块号}-${模型ID}-${变体}`
- 示例：`P01-FM002-sliding-down`（P-01受力分析器 → FM-002斜面运动 → 从静止下滑）
- 示例：`P02-MOT003-basic`（P-02运动模拟器 → MOT-003平抛运动 → 基础场景）
- 示例：`P08-EMF031-circular`（P-08电磁场可视化器 → EMF-031洛伦兹力圆周 → 基础场景）

**优先级分组**（来自 PRD）：
- P0（首批交付）：P-01, P-02, P-04, P-08, P-12, P-13, P-14
- P1：P-03, P-05, P-06, P-07, P-09
- P2（可选）：P-11

### 2.2 预设库浏览数据结构

```typescript
/** 预设目录 —— 用于预设库浏览组件 */
interface PresetCatalog {
  /** 按 PRD 模块组织 */
  byModule: PresetModuleGroup[];

  /** 所有预设的平铺列表 */
  all: PresetEntry[];
}

interface PresetModuleGroup {
  /** PRD 模块编号，如 'P-01' */
  moduleId: string;
  /** 模块中文名，如 '受力分析器' */
  label: string;
  /** 优先级，如 'P0' | 'P1' | 'P2' */
  priority: string;
  /** 该模块下的所有预设 */
  presets: PresetEntry[];
}

interface PresetEntry {
  id: string;
  name: string;
  description: string;
  category: string;    // PRD 模块编号
  // level 已删除（阶段7发散审查）
  supportedViewports: ViewportType[];
}
```

**构建规则**：`PresetCatalog` 在应用启动时从所有已加载的预设 JSON 中自动构建，不需要单独维护目录配置文件。预设 JSON 的 `category`（模块编号）提供分类信息，模块元信息（中文名、优先级）从硬编码的模块注册表中获取。

---

## 3. 视角层与预设的绑定机制

### 3.1 设计决策

**预设显式声明 `supportedViewports`，这是教学设计决策而非技术能力推断。**

理由：
- 有些场景虽然技术上可以计算能量（求解器能输出 `energyStates`），但教学上展示能量没有意义（如纯受力分析场景）
- 有些场景的某个视角数据不完整（如无摩擦斜面的能量视角虽有意义但不是教学重点），预设作者可以选择不启用
- 预设作者是物理教师/教研人员，他们对"这个场景应该展示哪些视角"有教学判断

### 3.2 绑定规则

```
预设 JSON 声明 supportedViewports
    ↓
PresetLoader 加载时校验：
  1. defaultViewport ∈ supportedViewports ？
  2. supportedViewports 中每种视角，求解器能否提供对应数据？
     - force：求解器输出 forceAnalyses（必有）→ 总是可用
     - motion：求解器输出 motionStates（必有）→ 总是可用
     - energy：求解器输出 energyStates（可选）→ 需要求解器支持
     - momentum：从 motionStates 计算 p=mv → 总是可用
     - field：场景中有 field 类实体 → 需要场景包含场实体
     - circuit：求解器输出电路数据 → 需要求解器支持
  3. 如果预设声明了 'energy' 但求解器不输出 energyStates → 校验警告（不阻塞加载）
    ↓
UI 行为：
  - supportedViewports 中的视角：按钮正常可点击
  - 不在 supportedViewports 中的视角：按钮灰色不可点击，hover 提示"此场景不支持该视角"
```

### 3.3 切换预设时的视角重置

```
用户切换预设（从预设A → 预设B）
    ↓
1. 重置主视角为 presetB.defaultViewport
2. 清除所有叠加层 overlays = []
3. 重置信息密度为 'standard'
4. 更新视角按钮可用状态（按 presetB.supportedViewports）
```

---

## 4. 视角切换和叠加的行为规范

### 4.1 ViewportState 状态机

```typescript
interface ViewportState {
  primary: ViewportType;      // 当前主视角
  overlays: ViewportType[];   // 叠加层列表
  density: InfoDensity;       // 信息密度
}
```

**状态转换规则：**

```
╔══════════════════════════════════════════════════════════════╗
║                   ViewportState 状态机                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  [切换主视角]                                                 ║
║    触发：用户点击视角按钮（如从"受力"点到"运动"）               ║
║    效果：                                                     ║
║      1. primary = 新视角                                      ║
║      2. overlays = []（清空所有叠加层）                        ║
║      3. density = 'standard'（重置为标准密度）                 ║
║    理由：切换主视角是"换一个全新的视角看场景"，需要干净状态     ║
║                                                              ║
║  [添加叠加层]                                                 ║
║    触发：用户勾选叠加复选框                                    ║
║    前置条件：叠加的视角 ∈ supportedViewports                   ║
║    前置条件：叠加的视角 ≠ primary（不能叠加自己）              ║
║    效果：                                                     ║
║      1. overlays.push(新视角)                                 ║
║      2. if (overlays.length > 2) → density = 'compact'       ║
║    约束：最多叠加 3 个视角（超出时最早的自动移除）             ║
║                                                              ║
║  [移除叠加层]                                                 ║
║    触发：用户取消勾选叠加复选框                                ║
║    效果：                                                     ║
║      1. overlays = overlays.filter(v => v !== 移除的视角)     ║
║      2. 不自动恢复 density（用户手动切回）                    ║
║                                                              ║
║  [切换信息密度]                                               ║
║    触发：用户点击密度按钮                                      ║
║    效果：density = 用户选择的密度                              ║
║    约束：叠加层 > 2 时不允许选 'detailed'（强制 compact）     ║
║                                                              ║
║  [实体数自动降密]                                             ║
║    触发：场景中实体数 > 3                                     ║
║    效果：加载预设时 density 默认为 'compact' 而非 'standard'  ║
║    说明：不覆盖用户手动选择（只影响初始值）                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### 4.2 信息密度对渲染元素的影响

| 渲染元素 | compact | standard | detailed |
|---------|---------|----------|----------|
| 力箭头 | ✓ 有 | ✓ 有 | ✓ 有 |
| 力的数值标注 | ✗ 无 | ✓ "G=19.6N" | ✓ "G=mg=2×9.8=19.6N" |
| 速度/加速度箭头 | ✓ 有 | ✓ 有 | ✓ 有 |
| 速度数值标注 | ✗ 无 | ✓ "v=3.2m/s" | ✓ "v=v₀+at=..." |
| 能量条形图 | ✓ 简化 | ✓ 带数值 | ✓ 带数值+公式 |
| 轨迹线 | ✓ 有 | ✓ 有 | ✓ 有 |
| 场符号阵列 | ✓ 稀疏 | ✓ 标准密度 | ✓ 密集+场强标注 |
| 正交分解虚线 | ✗ 无 | ✓ 有 | ✓ 有+分量标注 |

### 4.3 视角切换的过渡效果

**Phase 1：立即切换，无过渡动画。**

理由：
- 教学场景中老师需要即时看到结果，动画反而是干扰
- 简化实现复杂度
- 与 PhET 等成熟教学工具的行为一致

---

## 5. 视角层数据流设计

### 5.1 数据流概览

```
PhysicsResult（求解器输出，每帧更新）
    ↓
extractViewportData(viewportType, result, scene, resultHistory)
    ↓
ViewportData（Tagged Union，6种类型之一）
    ↓
ViewportRenderer(data, entities, ctx)
    ↓
Canvas 绘制
```

### 5.2 extractViewportData 实现逻辑

```typescript
function extractViewportData(
  viewportType: ViewportType,
  result: PhysicsResult,
  scene: SceneDefinition,
  resultHistory: PhysicsResult[],
): ViewportData {
  switch (viewportType) {
    case 'force':
      return extractForceData(result);
    case 'motion':
      return extractMotionData(result, resultHistory);
    case 'energy':
      return extractEnergyData(result);
    case 'momentum':
      return extractMomentumData(result, scene);
    case 'field':
      return extractFieldData(scene);
    case 'circuit':
      return extractCircuitData(result);
  }
}
```

### 5.3 六种视角的提取规则

#### 受力视角 (force)

```typescript
function extractForceData(result: PhysicsResult): ViewportData {
  return {
    type: 'force',
    data: {
      analyses: Array.from(result.forceAnalyses.values()),
    },
  };
}
```

- **数据来源**：`result.forceAnalyses`（Map → Array）
- **渲染内容**：每个实体的力箭头 + 合力 + 正交分解（如有）
- **实时性**：每帧更新（参数变更后力的大小/方向变化）

#### 运动视角 (motion)

```typescript
function extractMotionData(
  result: PhysicsResult,
  resultHistory: PhysicsResult[],
): ViewportData {
  return {
    type: 'motion',
    data: {
      motionStates: Array.from(result.motionStates.values()),
      // 图表数据从 resultHistory 中提取
      // 由渲染器在绘制时按需构建，而非提前构造
    },
  };
}
```

- **数据来源**：`result.motionStates` + `resultHistory`
- **渲染内容**：速度箭头 + 加速度箭头 + 轨迹线 + v-t/s-t 图表
- **图表数据构造**：

```typescript
// v-t 图数据：从 resultHistory 提取
function buildVtChart(
  entityId: EntityId,
  resultHistory: PhysicsResult[],
): Array<{ t: number; vx: number; vy: number; v: number }> {
  return resultHistory.map(r => {
    const motion = r.motionStates.get(entityId);
    if (!motion) return { t: r.time, vx: 0, vy: 0, v: 0 };
    return {
      t: r.time,
      vx: motion.velocity.x,
      vy: motion.velocity.y,
      v: Math.hypot(motion.velocity.x, motion.velocity.y),
    };
  });
}

// s-t 图数据：从 resultHistory 提取位移
function buildStChart(
  entityId: EntityId,
  resultHistory: PhysicsResult[],
): Array<{ t: number; sx: number; sy: number; s: number }> {
  if (resultHistory.length === 0) return [];
  const origin = resultHistory[0].motionStates.get(entityId)?.position;
  if (!origin) return [];
  return resultHistory.map(r => {
    const motion = r.motionStates.get(entityId);
    if (!motion) return { t: r.time, sx: 0, sy: 0, s: 0 };
    const dx = motion.position.x - origin.x;
    const dy = motion.position.y - origin.y;
    return { t: r.time, sx: dx, sy: dy, s: Math.hypot(dx, dy) };
  });
}
```

- **解析解 vs 数值积分的差异**：
  - 解析解：`resultHistory` 由 Simulator 按采样率（60fps）调用 `solver.solve(t)` 逐帧生成，或从 `precomputedResults` 中取
  - 数值积分：`resultHistory` 在 Simulator 主循环中自然累积
  - 对 extractViewportData 而言无差异，都从 `resultHistory` 读取

#### 能量视角 (energy)

```typescript
function extractEnergyData(result: PhysicsResult): ViewportData {
  const energyStates = result.energyStates
    ? Array.from(result.energyStates.values())
    : [];

  // 计算系统总能量
  const systemTotalEnergy = energyStates.reduce(
    (sum, es) => sum + es.totalEnergy, 0
  );

  return {
    type: 'energy',
    data: {
      energyStates,
      systemTotalEnergy,
    },
  };
}
```

- **数据来源**：`result.energyStates`（可选字段）
- **渲染内容**：能量条形图（Ek、Ep_gravity、Ep_elastic...）+ 系统总能量参考线
- **注意**：如果求解器没有输出 `energyStates`（如纯受力分析场景），能量视角显示空态提示

#### 动量视角 (momentum)

```typescript
function extractMomentumData(
  result: PhysicsResult,
  scene: SceneDefinition,
): ViewportData {
  const momenta: MomentumViewportData['momenta'] = [];
  let totalPx = 0, totalPy = 0;

  for (const [entityId, motion] of result.motionStates) {
    const entity = scene.entities.get(entityId);
    if (!entity || entity.category !== 'object') continue;

    const mass = (entity.properties as { mass?: number }).mass ?? 0;
    const px = mass * motion.velocity.x;
    const py = mass * motion.velocity.y;

    momenta.push({
      entityId,
      momentum: { x: px, y: py },
      label: `p=${(Math.hypot(px, py)).toFixed(2)}kg·m/s`,
    });

    totalPx += px;
    totalPy += py;
  }

  return {
    type: 'momentum',
    data: {
      momenta,
      systemTotalMomentum: { x: totalPx, y: totalPy },
    },
  };
}
```

- **数据来源**：`result.motionStates`（速度）+ `scene.entities`（质量）→ 计算 p=mv
- **渲染内容**：动量箭头 + 系统总动量 + 碰撞前后对比

#### 场视角 (field)

```typescript
function extractFieldData(scene: SceneDefinition): ViewportData {
  const fieldEntities: FieldViewportData['fieldEntities'] = [];

  for (const [entityId, entity] of scene.entities) {
    if (entity.category !== 'field') continue;

    const props = entity.properties as Record<string, unknown>;
    fieldEntities.push({
      entityId,
      fieldType: mapEntityTypeToFieldType(entity.type),
      region: props.region as Rect,
      direction: props.direction as Vec2 ?? { x: 0, y: 0 },
      magnitude: props.magnitude as number ?? 0,
    });
  }

  return {
    type: 'field',
    data: { fieldEntities },
  };
}

function mapEntityTypeToFieldType(entityType: EntityType): string {
  switch (entityType) {
    case 'efield': return 'electric';
    case 'bfield': return 'magnetic';
    default: return 'gravitational';
  }
}
```

- **数据来源**：`scene.entities` 中 category='field' 的实体（静态数据）
- **渲染内容**：场区域高亮（半透明底色）+ 场线/符号阵列 + 场强标注
- **特点**：大部分数据是静态的，只有场强可能随参数变化

#### 电路视角 (circuit)

```typescript
function extractCircuitData(result: PhysicsResult): ViewportData {
  // 电路数据由求解器在 PhysicsResult 中通过自定义扩展提供
  // 求解器在 result 上附加 circuitData 字段（通过类型扩展）
  const circuitData = (result as PhysicsResult & {
    circuitData?: CircuitViewportData;
  }).circuitData;

  return {
    type: 'circuit',
    data: circuitData ?? {}, // 空对象表示无电路数据
  };
}
```

- **数据来源**：求解器在 `PhysicsResult` 上的扩展字段 `circuitData`
- **渲染内容**：EMF 标注 + 电流方向箭头 + 电流大小 + 电压标注
- **扩展方式**：电磁感应求解器在返回 `PhysicsResult` 时，附加 `circuitData` 字段。这是通过 TypeScript 的类型兼容性实现的——`PhysicsResult` 接口允许额外字段

**PhysicsResult 电路数据扩展设计**：

```typescript
// 电磁感应求解器返回的扩展 PhysicsResult
interface EmInductionResult extends PhysicsResult {
  circuitData: CircuitViewportData;
}

// 求解器实现中：
function emInductionSolver(scene, time, dt, prev): EmInductionResult {
  // ... 计算物理量 ...
  return {
    time,
    forceAnalyses: ...,
    motionStates: ...,
    // 扩展字段
    circuitData: {
      emf: B * L * v,
      current: B * L * v / R,
      currentDirection: { x: 0, y: 1 },
    },
  };
}
```

### 5.4 信息面板的实时数值数据

右侧信息面板的"实时数值"区域从 `currentResult` 和 `scene` 中提取：

```typescript
interface RealtimeValues {
  time: number;                          // 当前时刻
  selectedEntity?: {
    label: string;                       // 实体名称
    velocity?: { magnitude: number; direction: Vec2 };
    acceleration?: { magnitude: number; direction: Vec2 };
    kineticEnergy?: number;
    potentialEnergy?: number;
    netForce?: { magnitude: number; direction: Vec2 };
  };
}

function extractRealtimeValues(
  result: PhysicsResult | null,
  selectedEntityId: EntityId | null,
  scene: SceneDefinition,
): RealtimeValues {
  if (!result) return { time: 0 };
  if (!selectedEntityId) return { time: result.time };

  const entity = scene.entities.get(selectedEntityId);
  const motion = result.motionStates.get(selectedEntityId);
  const forces = result.forceAnalyses.get(selectedEntityId);
  const energy = result.energyStates?.get(selectedEntityId);

  return {
    time: result.time,
    selectedEntity: {
      label: entity?.label ?? entity?.type ?? '',
      velocity: motion ? {
        magnitude: Math.hypot(motion.velocity.x, motion.velocity.y),
        direction: motion.velocity,
      } : undefined,
      acceleration: motion ? {
        magnitude: Math.hypot(motion.acceleration.x, motion.acceleration.y),
        direction: motion.acceleration,
      } : undefined,
      kineticEnergy: energy?.kineticEnergy,
      potentialEnergy: energy?.potentialEnergies.reduce((s, e) => s + e.value, 0),
      netForce: forces ? {
        magnitude: forces.resultant.magnitude,
        direction: forces.resultant.direction,
      } : undefined,
    },
  };
}
```

---

## 6. 完整预设示例

### 6.1 示例1：斜面受力分析

```jsonc
{
  "id": "P01-FM002-sliding-down",
  "version": "1.0",
  "name": "斜面·从静止下滑",
  "description": "物块在粗糙斜面上从静止开始下滑，分析受力、运动和能量",
  "category": "P-01",
  "supportedViewports": ["force", "motion", "energy"],
  "defaultViewport": "force",

  "displayConfig": {
    "scale": 150,
    "origin": { "x": 200, "y": 500 }
  },

  "entities": [
    {
      "ref": "block-A",
      "type": "block",
      "properties": {
        "mass": 2,
        "width": 0.5,
        "height": 0.5
      },
      "transform": {
        "position": { "x": 2.0, "y": 1.5 },
        "rotation": 0
      },
      "label": "物块"
    },
    {
      "ref": "slope-1",
      "type": "slope",
      "properties": {
        "angle": 0.5236,
        "length": 4,
        "baseWidth": 3.46,
        "height": 2.0
      },
      "transform": {
        "position": { "x": 0, "y": 0 },
        "rotation": 0
      },
      "label": "斜面"
    }
  ],

  "relations": [
    {
      "type": "contact",
      "sourceRef": "block-A",
      "targetRef": "slope-1",
      "properties": {
        "friction": 0.3
      }
    }
  ],

  "paramGroups": [
    {
      "key": "block-params",
      "label": "物体属性",
      "params": [
        {
          "key": "mass",
          "label": "质量",
          "type": "slider",
          "min": 0.1,
          "max": 10,
          "step": 0.1,
          "default": 2,
          "unit": "kg",
          "targetEntityId": "block-A",
          "targetProperty": "mass"
        }
      ]
    },
    {
      "key": "slope-params",
      "label": "斜面属性",
      "params": [
        {
          "key": "angle",
          "label": "倾斜角",
          "type": "slider",
          "min": 5,
          "max": 85,
          "step": 1,
          "default": 30,
          "unit": "°",
          "targetEntityId": "slope-1",
          "targetProperty": "angle"
        },
        {
          "key": "friction-toggle",
          "label": "摩擦",
          "type": "toggle",
          "default": true,
          "labelOn": "粗糙",
          "labelOff": "光滑"
        },
        {
          "key": "friction-coeff",
          "label": "动摩擦因数",
          "type": "slider",
          "min": 0.01,
          "max": 1.0,
          "step": 0.01,
          "default": 0.3,
          "unit": ""
        }
      ]
    }
  ],

  "paramValues": {
    "mass": 2,
    "angle": 30,
    "friction-toggle": true,
    "friction-coeff": 0.3
  },

  "solveMode": "analytical",
  "duration": 5,

  "eventActions": [
    {
      "eventType": "reach-boundary",
      "entityId": "block-A",
      "action": { "type": "stop" }
    }
  ]
}
```

**求解器匹配**：entityTypes=['block','slope'] + relationType='contact' → `slope-contact-solver`

**参数面板渲染**：
- "物体属性" 组：质量 slider (0.1-10kg, step 0.1)
- "斜面属性" 组：倾斜角 slider (5-85°, step 1) + 摩擦 toggle + 动摩擦因数 slider (0.01-1.0)
- friction-toggle = false 时，friction-coeff slider 隐藏，求解器令 μ=0

**视角行为**：
- 受力（默认）：显示 G、N、f、F合，可切换正交分解
- 运动：显示速度/加速度箭头 + 轨迹 + v-t/s-t 图
- 能量：显示 Ek、Ep(重力)、总能量（有摩擦时总能递减）

### 6.2 示例2：平抛运动

```jsonc
{
  "id": "P02-MOT003-basic",
  "version": "1.0",
  "name": "平抛运动",
  "description": "物体从一定高度以水平初速度抛出，分析抛物线轨迹和运动分解",
  "category": "P-02",
  "supportedViewports": ["motion", "force", "energy"],
  "defaultViewport": "motion",

  "displayConfig": {
    "scale": 100,
    "origin": { "x": 150, "y": 100 }
  },

  "entities": [
    {
      "ref": "ball-1",
      "type": "ball",
      "properties": {
        "mass": 1,
        "radius": 0.15,
        "initialVelocity": { "x": 5, "y": 0 }
      },
      "transform": {
        "position": { "x": 0, "y": 5 },
        "rotation": 0
      },
      "label": "小球"
    },
    {
      "ref": "ground-1",
      "type": "horizontal-surface",
      "properties": {
        "length": 12,
        "friction": 0
      },
      "transform": {
        "position": { "x": -1, "y": 0 },
        "rotation": 0
      },
      "label": "地面"
    }
  ],

  "relations": [],

  "paramGroups": [
    {
      "key": "ball-params",
      "label": "小球属性",
      "params": [
        {
          "key": "mass",
          "label": "质量",
          "type": "slider",
          "min": 0.1,
          "max": 10,
          "step": 0.1,
          "default": 1,
          "unit": "kg",
          "targetEntityId": "ball-1",
          "targetProperty": "mass"
        },
        {
          "key": "v0",
          "label": "初速度",
          "type": "slider",
          "min": 1,
          "max": 20,
          "step": 0.5,
          "default": 5,
          "unit": "m/s",
          "targetEntityId": "ball-1",
          "targetProperty": "initialVelocity.x"
        }
      ]
    },
    {
      "key": "position-params",
      "label": "初始条件",
      "params": [
        {
          "key": "height",
          "label": "抛出高度",
          "type": "slider",
          "min": 1,
          "max": 20,
          "step": 0.5,
          "default": 5,
          "unit": "m",
          "targetEntityId": "ball-1",
          "targetProperty": "position.y"
        }
      ]
    }
  ],

  "paramValues": {
    "mass": 1,
    "v0": 5,
    "height": 5
  },

  "solveMode": "analytical",
  "duration": 3,

  "eventActions": [
    {
      "eventType": "reach-boundary",
      "entityId": "ball-1",
      "action": { "type": "stop" }
    }
  ]
}
```

**求解器匹配**：entityTypes=['ball'] + 无关系 → `projectile-solver`

**注意**：平抛运动没有关系（自由运动），SolverPattern 对此的处理：
- 求解器注册时 `relationType` 可以为特殊值 `'none'`（表示无关系）
- 或者用 `relationType: 'gravity-only'`（隐含重力场关系）

**设计决策**：引入 `'none'` 作为特殊 relationType，表示该求解器处理的是无关系的自由运动场景。PresetLoader 匹配时，如果场景无关系且 pattern.relationType === 'none'，则匹配成功。

**`targetProperty` 嵌套路径**：
- `"targetProperty": "initialVelocity.x"` 表示更新 `entity.properties.initialVelocity.x`
- `"targetProperty": "position.y"` 表示更新 `entity.transform.position.y`（特殊处理：以 `position.` 开头的路径映射到 `transform.position`）
- PresetLoader / updateParam 实现中用简单的点号分割处理嵌套路径

**视角行为**：
- 运动（默认）：水平/竖直速度分解箭头 + 合速度箭头 + 抛物线轨迹 + v-t 图（vx 水平线 + vy 直线增长）
- 受力：只有重力 G 向下
- 能量：Ek 增大 + Ep 减小 + 总能守恒（无摩擦）

### 6.3 示例3：洛伦兹力圆周运动

```jsonc
{
  "id": "P08-EMF031-circular",
  "version": "1.0",
  "name": "洛伦兹力·匀速圆周",
  "description": "带电粒子在匀强磁场中做匀速圆周运动，分析圆周半径和周期",
  "category": "P-08",
  "supportedViewports": ["field", "force", "motion"],
  "defaultViewport": "field",

  "displayConfig": {
    "scale": 80,
    "origin": { "x": 500, "y": 400 }
  },

  "entities": [
    {
      "ref": "particle-1",
      "type": "charged-particle",
      "properties": {
        "mass": 1.67e-27,
        "charge": 1.6e-19,
        "radius": 5,
        "initialVelocity": { "x": 1e6, "y": 0 }
      },
      "transform": {
        "position": { "x": 0, "y": 0 },
        "rotation": 0
      },
      "label": "质子"
    },
    {
      "ref": "bfield-1",
      "type": "bfield",
      "properties": {
        "magnitude": 0.1,
        "direction": "into",
        "region": { "x": -3, "y": -3, "width": 6, "height": 6 }
      },
      "transform": {
        "position": { "x": -3, "y": -3 },
        "rotation": 0
      },
      "label": "匀强磁场"
    }
  ],

  "relations": [
    {
      "type": "field-effect",
      "sourceRef": "bfield-1",
      "targetRef": "particle-1",
      "properties": {}
    }
  ],

  "paramGroups": [
    {
      "key": "particle-params",
      "label": "粒子属性",
      "params": [
        {
          "key": "particle-type",
          "label": "粒子类型",
          "type": "select",
          "options": [
            { "value": "proton", "label": "质子" },
            { "value": "electron", "label": "电子" },
            { "value": "alpha", "label": "α粒子" },
            { "value": "custom", "label": "自定义" }
          ],
          "default": "proton"
        },
        {
          "key": "charge",
          "label": "电荷量",
          "type": "input",
          "min": 1e-20,
          "max": 1e-17,
          "default": 1.6e-19,
          "unit": "C",
          "precision": 2,
          "targetEntityId": "particle-1",
          "targetProperty": "charge"
        },
        {
          "key": "particle-mass",
          "label": "质量",
          "type": "input",
          "min": 1e-31,
          "max": 1e-25,
          "default": 1.67e-27,
          "unit": "kg",
          "precision": 2,
          "targetEntityId": "particle-1",
          "targetProperty": "mass"
        },
        {
          "key": "v0",
          "label": "初速度",
          "type": "slider",
          "min": 1e4,
          "max": 1e7,
          "step": 1e4,
          "default": 1e6,
          "unit": "m/s",
          "targetEntityId": "particle-1",
          "targetProperty": "initialVelocity.x"
        }
      ]
    },
    {
      "key": "field-params",
      "label": "磁场属性",
      "params": [
        {
          "key": "B",
          "label": "磁感应强度",
          "type": "slider",
          "min": 0.01,
          "max": 1.0,
          "step": 0.01,
          "default": 0.1,
          "unit": "T",
          "targetEntityId": "bfield-1",
          "targetProperty": "magnitude"
        },
        {
          "key": "field-direction",
          "label": "磁场方向",
          "type": "select",
          "options": [
            { "value": "into", "label": "垂直纸面向内 ×" },
            { "value": "out", "label": "垂直纸面向外 ·" }
          ],
          "default": "into",
          "targetEntityId": "bfield-1",
          "targetProperty": "direction"
        }
      ]
    }
  ],

  "paramValues": {
    "particle-type": "proton",
    "charge": 1.6e-19,
    "particle-mass": 1.67e-27,
    "v0": 1e6,
    "B": 0.1,
    "field-direction": "into"
  },

  "solveMode": "analytical",
  "duration": 8,

  "eventActions": [
    {
      "eventType": "leave-region",
      "entityId": "particle-1",
      "action": {
        "type": "mark-state",
        "label": "粒子离开磁场区域"
      }
    }
  ]
}
```

**求解器匹配**：entityTypes=['charged-particle','bfield'] + relationType='field-effect' → `lorentz-circular-solver`

**select 联动说明**：
- `particle-type` select 的变化会联动更新 `charge` 和 `particle-mass` 的值
- 这个联动在 Phase 1 通过求解器内部处理：求解器检查 `paramValues['particle-type']`，如果为预设粒子类型则覆盖 mass/charge 为物理常数值
- 选择 'custom' 时使用用户设置的 charge 和 mass

**视角行为**：
- 场（默认）：磁场区域半透明底色 + ×/· 符号阵列 + B 值标注 + 粒子圆周轨迹
- 受力：洛伦兹力箭头（品红，⊥v，指向圆心）
- 运动：速度箭头（沿切线）+ 完整圆周轨迹 + r=mv/qB 标注

---

## 7. 预设开发指南

### 7.1 新增预设的标准流程

```
Step 1: 确定物理场景
  └── 明确实体类型、实体间关系、可调参数、支持的视角

Step 2: 检查求解器
  └── 查看 SolverRegistry 中是否已有匹配的求解器
  └── 如果有 → 直接复用，跳到 Step 4
  └── 如果没有 → 需要先实现求解器（Step 3）

Step 3: 实现求解器（如需要）
  └── 在 modules/${moduleId}/solvers/ 下新建文件
  └── 实现 SolverFunction（四参数统一签名）
  └── 注册到 SolverRegistry（指定 pattern + solveMode + integrator）
  └── 如需事件检测，一并注册 EventDetector

Step 4: 编写预设 JSON
  └── 在 modules/${moduleId}/presets/ 下新建 JSON 文件
  └── 按 PresetData Schema 填写所有字段
  └── 参照本指南 §7.3 的字段模板

Step 5: 验证
  └── PresetLoader.validate() 通过？
  └── 求解器能正确匹配？
  └── 参数面板正确渲染？
  └── 各视角数据正确展示？
  └── 事件检测正常触发？

Step 6: 验证分类
  └── 确认 category 对应正确的 PRD 模块编号
```

### 7.2 求解器与预设的关联方式

```
何时复用已有求解器？
  └── 新预设的实体类型 + 关系类型组合已有对应求解器
  └── 例：所有"物块在斜面上"的预设（匀加速下滑、匀速下滑、减速上滑）
       都复用同一个 slope-contact-solver，只是参数不同

何时需要新求解器？
  └── 新预设的实体类型 + 关系类型组合没有已有求解器
  └── 例：首次实现"弹簧振子"预设时，需要新建 spring-oscillation-solver
  └── 或者：同一 pattern 但物理方程完全不同，需要用 qualifier 区分

求解器的粒度原则：
  └── 一个求解器 = 一类完整物理场景的全部计算
  └── 包含：受力分析 + 运动求解 + 能量计算（如有）
  └── 不按力拆分（不做"重力求解器""摩擦力求解器"）
```

### 7.3 预设 JSON 模板

```jsonc
{
  // ─── 元信息（必填） ───
  "id": "${模块号}-${模型ID}-${变体}",  // 如 "P01-FM002-sliding-down"
  "version": "1.0",
  "name": "中文名称（≤20字）",
  "description": "中文描述（≤100字）",
  "category": "P-XX",  // PRD 模块编号，如 "P-01"

  // ─── 元信息（可选） ───

  // ─── 视角配置（必填） ───
  "supportedViewports": ["force", "motion"],
  "defaultViewport": "force",

  // ─── 画布配置（可选） ───
  "displayConfig": {
    "scale": 100,
    "origin": { "x": 200, "y": 400 }
  },

  // ─── 实体（必填） ───
  "entities": [
    {
      "ref": "实体引用名",
      "type": "已注册的实体类型",
      "properties": { /* 属性值 */ },
      "transform": { "position": { "x": 0, "y": 0 }, "rotation": 0 },
      "label": "显示名称"
    }
  ],

  // ─── 关系（可为空数组） ───
  "relations": [
    {
      "type": "关系类型",
      "sourceRef": "主动方ref",
      "targetRef": "被动方ref",
      "properties": { /* 关系属性 */ }
    }
  ],

  // ─── 参数面板（必填） ───
  "paramGroups": [
    {
      "key": "group-key",
      "label": "分组标题",
      "params": [
        // slider 模板
        {
          "key": "param-key",
          "label": "参数名",
          "type": "slider",
          "min": 0, "max": 10, "step": 0.1,
          "default": 1,
          "unit": "单位",
          "targetEntityId": "实体ref",
          "targetProperty": "属性名"
        },
        // toggle 模板
        {
          "key": "xxx-toggle",
          "label": "开关名",
          "type": "toggle",
          "default": true,
          "labelOn": "开启文本",
          "labelOff": "关闭文本"
        },
        // select 模板
        {
          "key": "xxx-select",
          "label": "选择名",
          "type": "select",
          "options": [
            { "value": "v1", "label": "选项1" },
            { "value": "v2", "label": "选项2" }
          ],
          "default": "v1"
        },
        // input 模板（用于极大/极小数值）
        {
          "key": "xxx-input",
          "label": "数值名",
          "type": "input",
          "min": 1e-31, "max": 1e-25,
          "default": 9.1e-31,
          "unit": "单位",
          "precision": 2
        }
      ]
    }
  ],

  // ─── 参数初始值（必填，每个 param.key 都要有对应值） ───
  "paramValues": {
    "param-key": 1,
    "xxx-toggle": true,
    "xxx-select": "v1"
  },

  // ─── 求解配置（必填） ───
  "solveMode": "analytical",
  "duration": 5,

  // ─── 求解器限定（可选） ───
  "solverQualifier": { "model": "特定模型标识" },

  // ─── 事件（可选） ───
  "eventActions": [
    {
      "eventType": "事件类型",
      "entityId": "实体ref",
      "action": { "type": "动作类型" }
    }
  ]
}
```

### 7.4 常见场景的参数设计模式

#### 力学场景通用参数

| 参数 | 类型 | 范围 | 步长 | 默认值 | 单位 |
|------|------|------|------|--------|------|
| 质量 | slider | 0.1-10 | 0.1 | 1 | kg |
| 斜面角度 | slider | 5-85 | 1 | 30 | ° |
| 动摩擦因数 | slider | 0.01-1.0 | 0.01 | 0.3 | |
| 初速度 | slider | 0-20 | 0.5 | 0 | m/s |
| 弹簧劲度系数 | slider | 10-500 | 10 | 100 | N/m |
| 高度 | slider | 0.5-20 | 0.5 | 5 | m |

#### 电磁场景通用参数

| 参数 | 类型 | 范围 | 步长 | 默认值 | 单位 |
|------|------|------|------|--------|------|
| 电荷量 | input | 1e-20 ~ 1e-17 | — | 1.6e-19 | C |
| 粒子质量 | input | 1e-31 ~ 1e-25 | — | 1.67e-27 | kg |
| 磁感应强度 | slider | 0.01-1.0 | 0.01 | 0.1 | T |
| 电场强度 | slider | 100-10000 | 100 | 1000 | V/m |
| 导轨间距 | slider | 0.1-2.0 | 0.1 | 1.0 | m |
| 电阻 | slider | 0.1-100 | 0.1 | 10 | Ω |

### 7.5 视角配置选择指南

| 场景类型 | 推荐视角 | 默认视角 | 说明 |
|---------|---------|---------|------|
| 纯受力分析（静力学） | force | force | 核心是力的分析 |
| 运动场景（有位移） | force, motion, energy | motion | 轨迹和 v-t 图是重点 |
| 能量守恒/转化 | force, motion, energy | energy | 能量条形图是重点 |
| 碰撞/动量 | force, motion, momentum | momentum | 动量守恒是重点 |
| 电磁场景（有场） | field, force, motion | field | 场区域可视化是重点 |
| 电磁感应 | field, force, motion, circuit | circuit | 电路参数是重点 |

### 7.6 事件配置选择指南

| 场景特征 | 推荐事件 | 推荐动作 |
|---------|---------|---------|
| 物体在有限表面上运动 | reach-boundary | stop |
| 平抛落地 | reach-boundary | stop |
| 粒子进出场区域 | enter-region / leave-region | mark-state |
| 数值积分趋近稳态 | reach-terminal | stop |
| 圆周运动完整一圈 | phase-change | mark-state |

### 7.7 调试和验证清单

```
□ PresetLoader.validate() 返回 valid=true，无 errors
□ 求解器匹配成功（SolverRegistry.match() 返回至少一个结果）
□ 参数面板正确渲染所有 paramGroups
□ 修改每个参数后，求解结果正确更新
□ 所有 supportedViewports 中的视角都能正确渲染
□ 默认视角的渲染结果符合物理直觉
□ 事件检测正常触发（如有配置）
□ 时间轴拖拽在不同时刻的渲染结果正确
□ t=0 时刻的初始状态正确
□ 手算验证：至少验证 t=0 时刻的受力分析数值
```

---

## 8. Schema 设计总结

### 8.1 相对阶段3骨架的变更

| 变更 | 说明 |
|------|------|
| 新增 `version` 字段 | Schema 版本号，用于后续兼容性处理 |
| 新增 `displayConfig` 字段 | 画布初始缩放和原点配置 |
| 删除 `tags` 字段 | 非 PRD 需求，已移除 |
| 删除 `textbookSections` 字段 | 非 PRD 需求，已移除 |
| ~~新增 `level` 字段~~ | ~~预设层级（L1/L2/L3）~~ — 已在阶段7发散审查中删除 |
| 明确 `category` 格式 | PRD 模块编号（如 `P-01`） |
| 明确 `duration` 范围 | 按场景类型给出典型时长参考 |
| 明确 `targetProperty` 嵌套路径 | 支持 `x.y` 格式访问嵌套属性 |
| 引入 relationType='none' | 支持无关系的自由运动场景（如平抛） |
| 明确 eventActions 中 entityId 使用 ref | 与 entities/relations 一致，加载时替换 |

### 8.2 新增类型定义清单

| 类型 | 来源 | 说明 |
|------|------|------|
| `PresetCatalog` | §2.4 | 预设库浏览数据结构 |
| `PresetModuleGroup` | §2.4 | 按 PRD 模块分组 |
| `PresetEntry` | §2.4 | 预设条目（浏览列表用） |
| `RealtimeValues` | §5.4 | 信息面板实时数值 |

### 8.3 验收对照

| 验收标准 | 状态 | 说明 |
|---------|------|------|
| Schema 能完整表达3个示例 | ✅ | §6 斜面/平抛/洛伦兹力完整JSON |
| 预设 JSON 完整到"放进 presets/ 就能跑" | ✅ | 3个示例包含全部必填字段 |
| 参数 schema 驱动面板自动渲染 | ✅ | slider/toggle/select/input 四种控件 |
| 视角层切换/叠加行为与产品方案一致 | ✅ | §4 完整状态机 |
| extractViewportData 6种提取逻辑已明确 | ✅ | §5 每种视角的提取规则和代码 |
| 分类体系与 PRD 模块对齐 | ✅ | §2 按 PRD 模块（P-01~P-14）组织 |
| 预设开发指南清晰可操作 | ✅ | §7 完整流程+模板+参数参考+验证清单 |
