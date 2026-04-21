# 阶段4：Preset Schema 与视角层设计

> 目标：定义预设 JSON 文件的完整字段规范，以及视角层的绑定和切换机制，使"加一个新预设 = 加一个 JSON 文件"成为可能。

---

## 设计约束与前置条件

### 已确定的接口基础（阶段2+3产出）

阶段4的设计基于已定稿的两层接口：

**阶段2 · 类型系统（51个接口）**：
- `Entity<T>`、`Relation<T>` — 泛型实体/关系
- `ParamSchema`（Discriminated Union：Slider | Input | Toggle | Select）、`ParamGroup`、`ParamValues`
- `PhysicsResult`（Map 索引）、`ForceAnalysis`、`MotionState`、`EnergyState`
- `ViewportType`、`ViewportState`、`ViewportData`（Tagged Union，6种视角数据）
- `VisualStyle`、`ForceVisualMap`、`PhysicsVisualMap`

**阶段3 · 注册与引擎（28个接口）**：
- `PresetData`、`PresetEntityDef`、`PresetRelationDef` — 预设 JSON 的骨架已定义
- `SolverPattern`（结构化对象匹配）、`SolverRegistration`、`SolverFunction`（四参数统一签名）
- `ViewportRenderer`、`EntityRenderer` — 渲染器签名已定义
- `EventDetector`、`EventActionMapping` — 事件检测机制已定义
- `Simulator.loadPreset(preset: PresetData)` — 加载入口已定义
- 渲染管线：实体按 `RenderLayer` 排序绘制 → 主视角不透明 → 叠加视角 0.3 透明度

### 本阶段与前序阶段的关系

阶段3已定义了 `PresetData` 的骨架结构（字段名和类型），本阶段需要：
1. **细化字段规范**：每个字段的合法值域、必填/可选、约束条件
2. **编写完整示例**：用 3 个典型预设验证 Schema 表达力
3. **设计视角层行为**：切换/叠加/密度调节的完整行为规范
4. **设计视角层数据流**：从 `PhysicsResult` → `extractViewportData()` → `ViewportRenderer` 的提取逻辑
5. **编写预设开发指南**：开发者新增预设的标准流程 checklist

---

## 需要设计的内容清单

### 1. Preset JSON Schema 字段规范

**场景需求**（产品方案 4.1、7.5、讨论记录第十八条）：
- 预设 = 实体 + 关系 + 参数 + 视角 + 功能开关，完整自描述
- 参数面板由 schema 驱动：UI 组件读取预设中的参数定义自动渲染
- 求解器通过实体类型和关系类型自动匹配，不需要在预设中指定用哪个求解器

**已有骨架（阶段3 PresetData）**：
```typescript
interface PresetData {
  // 元信息
  id: string;
  name: string;
  description: string;
  category: string;
  supportedViewports: ViewportType[];
  defaultViewport: ViewportType;
  // 场景数据
  entities: PresetEntityDef[];
  relations: PresetRelationDef[];
  paramGroups: ParamGroup[];
  paramValues: ParamValues;
  // 求解配置
  solveMode: SolveMode;
  duration: number;
  solverQualifier?: Record<string, string>;
  eventActions?: EventActionMapping[];
}
```

**需要细化**：
- `category` 的分类体系定义（与 PRD 模块对齐）
- `entities` 中 `PresetEntityDef` 的每个字段的合法值域和约束
- `relations` 中 `PresetRelationDef` 的属性字段规范
- `paramGroups` 中参数与实体属性的映射规则（`targetEntityId` 使用 ref 还是生成后的 id？）
- `duration` 的合理范围（不同场景的典型模拟时长）
- `eventActions` 的常见配置模式

**设计关注点**：
- 预设 JSON 中的 `paramGroups` 里 `targetEntityId` 字段：阶段3设计了 ref 映射机制（预设用 ref，加载后映射为真实 EntityId），参数 schema 中的引用也需要用 ref
- 预设 JSON 是否需要声明版本号？（后续 Schema 变更时的兼容性）
- 是否需要 `displayConfig` 字段控制画布初始视角（缩放、平移、原点位置）？

### 2. 分类体系设计

**场景需求**（产品方案 4.1 三级预设组织）：
- L1 物理模型：斜面、圆周、碰撞、电场偏转、洛伦兹力…
- L2 典型场景：斜面-匀速上滑、洛伦兹力-直线边界…
- L3 经典例题：精确参数的具体题目

**需要设计**：
- `category` 字段直接使用 PRD 模块编号（P-01 ~ P-14）
- 预设库浏览组件需要的数据结构（`PresetCatalog`，按 PRD 模块组织）

**设计关注点**：
- 分类体系是硬编码在代码中还是由 JSON 配置文件定义？
- L3 经典例题与 L2 典型场景的预设 JSON 结构是否相同？（L3 只是参数不同）

### 3. 典型预设完整示例

**验收要求**：Schema 能完整表达产品方案维度五中的 3 个完整示例。

**示例1：斜面受力分析**（纯力学，解析解）
- 实体：物块 + 斜面
- 关系：接触（含摩擦）
- 参数：质量、角度、摩擦因数、光滑/粗糙 toggle
- 视角：受力（默认）、运动、能量
- 事件：物块到达斜面底端

**示例2：平抛运动**（力学，解析解，多视角）
- 实体：小球 + 水平面
- 关系：（无关系，自由运动）
- 参数：初速度、抛出高度
- 视角：运动（默认）、受力、能量
- 事件：落地

**示例3：洛伦兹力圆周运动**（电磁域，解析解）
- 实体：带电粒子 + 匀强磁场区域
- 关系：场作用
- 参数：电荷量、质量、初速度、磁感应强度、磁场方向
- 视角：场（默认）、受力、运动
- 事件：粒子离开磁场区域

**补充验证**：电磁感应单棒（数值积分场景，已在阶段3验证流程，此处补充预设 JSON 完整性）

**设计关注点**：
- 每个示例需要完整到"复制这个 JSON，放进 presets/ 目录，系统就能跑"的程度
- 参数 schema 的 min/max/step 是否符合物理直觉（如角度 0-90°、质量 0.1-100kg）

### 4. 视角层与预设的绑定机制

**场景需求**（产品方案 1.4、3.2）：
- 预设声明支持的视角列表（`supportedViewports`）
- 并非所有预设都支持全部 6 种视角
- 预设声明默认主视角（`defaultViewport`）

**需要设计**：
- 视角与预设的绑定规则：什么决定了一个预设支持哪些视角？
  - 是否与求解器输出的数据有关？（求解器不输出 energyStates 时，能量视角不可用）
  - 还是由预设显式声明？
- 视角禁用时的 UI 表现（按钮灰化？隐藏？）
- 切换预设时视角状态如何重置

**设计关注点**：
- 如果求解器的 `PhysicsResult` 中 `energyStates` 是 optional（阶段2设计），那"是否支持能量视角"是由求解器能力决定的，而非预设声明的
- 但预设也需要显式声明，因为有些场景虽然理论上可以计算能量，但教学上没有意义（如纯受力分析场景展示能量图没有价值）
- 结论倾向：预设显式声明 `supportedViewports`，这是教学设计决策而非技术限制

### 5. 视角切换和叠加的行为规范

**场景需求**（产品方案 3.2）：
- 点击视角按钮：切换主视角，只显示该视角的物理量，其余全关
- 勾选叠加复选框：在当前主视角基础上叠加显示其他物理量（降低透明度 0.3）
- 切换主视角时，叠加层自动清除
- 场景中实体超过 3 个时，自动切换到"简洁"密度
- 场区域自动用半透明底色标识范围

**需要设计**：
- `ViewportState` 的状态转换规则（完整状态机）
  - 切换主视角 → 清除所有 overlays → 重置 density 为 standard
  - 添加叠加层 → 如果叠加数 > 2 → 自动降为 compact
  - 实体数 > 3 → 自动降为 compact（覆盖手动设置？还是仅建议？）
- 视角切换时的过渡效果（立即切换？淡入淡出？）
- 信息密度切换时影响的具体渲染元素
  - compact：只有箭头/图形，不标注数值
  - standard：箭头 + 数值标注（如 "G=19.6N"）
  - detailed：箭头 + 数值 + 公式（如 "G=mg=2×9.8=19.6N"，Phase 1 用文本）

### 6. 视角层数据流设计

**场景需求**：
- 阶段3渲染管线已定义：`extractViewportData(viewportType, result)` → `ViewportRenderer(data, entities, ctx)`
- 需要设计 `extractViewportData` 的具体逻辑：如何从 `PhysicsResult` 中提取各视角需要的数据

**需要设计**：
- `extractViewportData` 函数的完整实现逻辑（6种视角各自的提取规则）
  - 受力视角：`result.forceAnalyses` → `ForceViewportData`
  - 运动视角：`result.motionStates` + `resultHistory` → `MotionViewportData`（含 v-t/s-t 图表数据）
  - 能量视角：`result.energyStates` → `EnergyViewportData`（含系统总能量）
  - 动量视角：从 `motionStates` 计算 p=mv → `MomentumViewportData`
  - 场视角：从 scene 中的 field 类实体提取 → `FieldViewportData`
  - 电路视角：从求解器特定输出提取 → `CircuitViewportData`
- 图表数据的构造逻辑
  - v-t 图：从 `resultHistory` 中提取每帧的速度分量 → `Array<{t: number, v: number}>`
  - s-t 图：从 `resultHistory` 中提取每帧的位移 → `Array<{t: number, s: number}>`
  - 能量条形图：当前帧的 `EnergyState` → `{Ek, Ep_gravity, Ep_elastic, ...}`
- 信息面板的实时数值数据来源

**设计关注点**：
- 运动视角的图表数据需要从 `resultHistory` 积累，解析解场景和数值积分场景的积累方式不同
- 场视角的数据大部分是静态的（场区域不变），只有场强可能随参数变化
- 电路视角的数据结构较特殊（EMF、电流、电压），可能需要求解器在 `PhysicsResult` 中扩展自定义字段

### 7. 预设开发指南

**验收要求**：开发者看完就知道"加一个新功能要创建什么文件、填什么字段"。

**需要编写**：
- 新增预设的标准流程 checklist（Step 1-N）
- 预设 JSON 模板（带注释的空壳文件）
- 常见场景的参数 schema 设计模式（力学场景通用参数、电磁场景通用参数）
- 求解器与预设的关联方式（何时需要新求解器、何时复用已有求解器）
- 视角配置的选择指南（什么场景该支持哪些视角）
- 事件配置的常见模式（离开表面、进入场区域、到达终态）
- 调试和验证方法（如何确认预设加载正确、求解器匹配成功、渲染正常）

---

## 子任务执行顺序

```
1. ✅ 细化 PresetData 字段规范 → 预设Schema与视角层设计.md §1
2. ✅ 设计分类体系 → 预设Schema与视角层设计.md §2
3. ✅ 设计视角绑定机制 → 预设Schema与视角层设计.md §3
4. ✅ 设计视角切换/叠加行为规范 → 预设Schema与视角层设计.md §4
5. ✅ 设计视角层数据流 → 预设Schema与视角层设计.md §5
6. ✅ 编写示例1：斜面受力分析完整预设 JSON → 预设Schema与视角层设计.md §6.1
7. ✅ 编写示例2：平抛运动完整预设 JSON → 预设Schema与视角层设计.md §6.2
8. ✅ 编写示例3：洛伦兹力圆周运动完整预设 JSON → 预设Schema与视角层设计.md §6.3
9. ✅ 编写预设开发指南 → 预设Schema与视角层设计.md §7
10. ✅ 输出完整 Schema 规范 + 视角层设计文档 → 预设Schema与视角层设计.md §8
```

## 完成状态：✅ 全部完成（2026-03-17）

## 验收标准

✅ Schema 能完整表达产品方案维度五中的 3 个完整示例（斜面题、平抛运动、洛伦兹力圆周）
✅ 每个示例的预设 JSON 完整到"复制到 presets/ 目录系统就能跑"的程度
✅ 参数 schema 字段能驱动参数面板自动渲染（不需要为每个预设写 UI 代码）
✅ 视角层切换/叠加行为与产品方案维度三（3.2）的设计一致
✅ `extractViewportData` 的 6 种视角提取逻辑均已明确
✅ 分类体系与产品方案 4.1 的三级预设组织对齐
✅ 预设开发指南清晰到开发者看完就能照着做"新增一个预设"

## 参考文档

- 注册机制与引擎设计.md — 阶段3产出，PresetData/ViewportRenderer/EventDetector 已定义
- 核心类型系统-接口设计.md — 阶段2产出，ViewportData/ParamSchema/PhysicsResult 已定义
- 产品方案 V2 · 维度三（3.1 物理量视觉语言、3.2 视角层交互、3.3 页面布局）
- 产品方案 V2 · 维度四（4.1 预设库设计-三级组织、4.2 场景搭建两种模式、4.3 快捷操作、4.4 场景保存）
- 产品方案 V2 · 维度五（5.1 斜面题示例、5.2 跨域综合题、5.3 电磁感应题）
- 产品方案 V2 · 维度七（7.5 预设 Schema 设计原则）
- 产品讨论记录 V2 · 第十八条（预设 Schema 与功能点组织方式）

## 产出

- **预设Schema与视角层设计.md** — 完整的 Schema 规范 + 视角层行为规范 + 3个完整预设示例 + 预设开发指南
- 第5阶段将基于以上所有设计产出（阶段1-4）初始化项目骨架并编写实际代码
