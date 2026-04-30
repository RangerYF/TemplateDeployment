# V0.2 架构设计文档

> 本文档是 V0.2 编辑器架构重构的蓝图，覆盖七个核心系统的职责、接口契约、数据流、目录结构与迁移映射。
> 所有后续实现阶段（1-8）以本文档为准，偏离时先回此文档修订。

---

## 设计哲学

以下原则指导本架构的所有设计决策。当具体方案出现分歧时，以这些原则为裁决依据。

### P1 统一性原则——"大不了加个 property，换来全局统一"

不要因为事物表面的差异就在模型层引入分裂。几何体顶点和用户创建的点、几何体棱线和用户画的线段、几何体面和截面——它们在交互层面的行为是一致的（都可选中、可编辑属性、可被引用、可 undo/redo），就应该是同一种 Entity，通过属性（`builtIn`）或判别器（`source`）区分来源差异。

**推论**：双代码路径是架构债务。每多一个"分类"，所有涉及该分类的功能都要写两套逻辑，维护成本随功能数量线性增长。一个属性消化差异，好过一个分裂贯穿全局。

### P2 显式优于隐式——"所有对象都是一等公民"

场景中的所有可交互对象都应创建为显式 Entity，不允许"隐式存在"的数据。隐式创建的对象无法被选中、无法被其他实体引用、无法进入 undo/redo 栈，会成为系统中的暗物质。

**实例**：截面多边形的交点必须创建为显式 Point Entity，而非仅作为 Face 的内部计算数据。显式化后，这些交点可被线段连接、被外接圆选用、可独立重命名。

### P3 系统自决策——"不要把复杂度推给用户"

当系统有足够信息做出正确判断时，不应弹窗询问用户。删除实体时，系统可以通过引用查询判断子实体是否孤立——无引用则自动清理，有引用则自动保留。既不会误删，也不会打扰用户。

### P4 从未来交互反推当前模型

评估方案时，始终站在"未来会有更多功能"的角度。"当前够用"不是充分理由——如果一个分裂在当前只引入 2 条双路径，但未来每个新功能都要再加 2 条，那这个分裂现在就应该消除。用最小机制（一个属性、一个查询方法）换取长期统一。

---

## 目录

1. [架构总览](#1-架构总览)
2. [Entity 系统](#2-entity-系统)
3. [Command 系统](#3-command-系统)
4. [Event/Signal 系统](#4-eventsignal-系统)
5. [Tool 系统](#5-tool-系统)
6. [Selection 系统](#6-selection-系统)
7. [Property/Inspector 系统](#7-propertyinspector-系统)
8. [Renderer 系统](#8-renderer-系统)
9. [数据流全链路](#9-数据流全链路)
10. [目录结构规范](#10-目录结构规范)
11. [旧代码迁移映射](#11-旧代码迁移映射)
12. [V0.3 扩展路径验证](#12-v03-扩展路径验证)
13. [决策记录](#13-决策记录)

---

## 1. 架构总览

### 1.1 分层架构

```
┌───────────────────────────────────────────────────────┐
│                    呈现层                              │
│   Renderer（实体→视觉）    Property（选中→属性面板）    │
├───────────────────────────────────────────────────────┤
│                    交互层                              │
│   Tool（交互模式）          Selection（选中管理）       │
├───────────────────────────────────────────────────────┤
│                    通信层                              │
│   Signal（发布-订阅，系统间解耦）                      │
├───────────────────────────────────────────────────────┤
│                    变更层                              │
│   Command（可逆操作 + undo/redo 栈）                   │
├───────────────────────────────────────────────────────┤
│                    数据层                              │
│   EntityStore（统一实体模型 + 实体间引用 + 依赖更新）   │
├───────────────────────────────────────────────────────┤
│                    计算层（不动）                       │
│   engine/（纯函数：builders / math / unfolding /       │
│           projection）                                 │
└───────────────────────────────────────────────────────┘
```

### 1.2 依赖方向约束

```
呈现层 → 交互层 → 通信层 → 变更层 → 数据层 → 计算层
          ↑_____________________________|（Signal 回调）
```

- 上层可依赖下层，下层不依赖上层
- 系统间解耦通过 Signal 实现（下层发事件，上层监听）
- 计算层（`engine/`）保持纯函数，不依赖任何编辑器系统

### 1.3 Store 结构

从 ~40 个散落字段 → 3 个核心 Store + 1 个独立状态：

| Store | 职责 | Zustand |
|-------|------|---------|
| EntityStore | `entities: Map<string, Entity>` + CRUD + 查询 | ✅ |
| ToolStore | `activeTool` + 工具状态 | ✅ |
| HistoryStore | `undoStack` / `redoStack` + CommandProcessor | ✅ |
| SelectionStore | `selectedIds: Set<string>` + `primaryId` | ✅（独立 Store） |

**选择独立 SelectionStore 的理由**：Selection 同时被 Tool、Renderer、Property 三个系统读取，且变更频率高（每次点击都触发），独立 Store 避免与 Entity 数据变更耦合，减少不必要的重渲染。

---

## 2. Entity 系统

### 2.1 核心设计原则：统一实体模型

**场景中所有可交互对象都是 Entity**——包括几何体本身、几何体的顶点/棱线/面，以及用户创建的点/线段/截面等。通过 `builtIn` 属性区分"几何体自带的"和"用户创建的"，但交互模型完全统一：同一套选中、属性面板、undo/redo 逻辑。

### 2.2 基础接口

```typescript
/** 实体基础接口 */
interface Entity {
  /** 全局递增 ID（如 "1", "2", "3"...） */
  id: string;
  /** 实体类型标识 */
  type: EntityType;
  /** 实体类型特定的属性（纯数据，可 JSON 序列化） */
  properties: Record<string, unknown>;
  /** 是否可见 */
  visible: boolean;
}

/** 实体类型枚举 */
type EntityType =
  | 'geometry'          // 几何体（长方体/正方体/棱锥/圆锥/圆柱/球），场景核心对象
  | 'point'             // 点（几何体顶点 + 用户创建的棱上点/曲线上点 + 截面交点），统一交互模型
  | 'segment'           // 线段（几何体棱线 + 用户画的辅助线），统一交互模型
  | 'face'              // 面（几何体的面 + 截面），统一面模型，通过 source 区分来源
  | 'coordinateSystem'  // 坐标系（Singleton，选顶点为原点，显示 XYZ 轴 + 坐标值）
  | 'circumSphere'      // 外接球（Singleton，半透明球面 + 半径）
  | 'circumCircle';     // 外接圆（选 3 点定义，显示圆 + 半径）
```

### 2.3 Geometry 实体

```typescript
interface GeometryProperties {
  /** 几何体子类型 */
  geometryType: GeometryType; // 'cube' | 'cuboid' | 'pyramid' | 'cone' | 'cylinder' | 'sphere'
  /** 几何参数（与现有 GeometryParams 对应的具体子类型参数） */
  params: CubeParams | CuboidParams | PyramidParams | ConeParams | CylinderParams | SphereParams;
}
```

**设计说明**：
- Geometry 实体只存几何体自身的参数，不再承载顶点标签/位置/棱线命名等附属数据
- 顶点标签 → Point Entity 的 `label`
- 顶点拖拽位置 → Point Entity 的 `positionOverride`
- 棱线命名 → Segment Entity 的 `label`
- `params` 使用与现有 `GeometryParams` 相同的结构，保持 engine/ 计算接口不变

### 2.4 Point 实体（统一点模型）

```typescript
interface PointProperties {
  /** 是否为几何体自带的点（true=顶点/特征点，false=用户创建） */
  builtIn: boolean;
  /** 所属几何体 ID */
  geometryId: string;
  /** 点的约束类型（决定位置如何计算） */
  constraint:
    | { type: 'vertex'; vertexIndex: number }                                      // 几何体顶点（位置从 BuilderResult 计算）
    | { type: 'edge'; edgeStart: number; edgeEnd: number; t: number }              // 棱上点（沿棱滑动）
    | { type: 'curve'; lineIndex: number; t: number }                              // 曲线上点（沿曲线滑动）
    | { type: 'coordinate'; coordSystemId: string; coords: [number, number, number] }  // 坐标输入点（V0.3）
    | { type: 'free'; position: [number, number, number] };                        // 自由点（V0.3）
  /** 标签 */
  label: string;
  /** 位置覆盖（拖拽偏移，仅 builtIn 顶点使用） */
  positionOverride?: [number, number, number];
}
```

**关键设计**：
- **builtIn=true 的点**（几何体顶点/特征点）：随几何体创建自动生成，随几何体删除/类型切换自动清除
- **builtIn=false 的点**（用户创建）：通过右键菜单取点、画线中间点等方式创建
- **位置计算统一**：所有点的位置都从 constraint 参数 + BuilderResult 计算而来，不存绝对位置（positionOverride 仅为拖拽偏移）
- **交互统一**：所有点都支持选中、重命名、作为引用目标（坐标系原点、线段端点、外接圆选点等）

### 2.5 Segment 实体（统一线段模型）

```typescript
interface SegmentProperties {
  /** 是否为几何体自带的棱线（true=棱线，false=用户画的线段） */
  builtIn: boolean;
  /** 所属几何体 ID */
  geometryId: string;
  /** 起点 Entity ID（Point 实体） */
  startPointId: string;
  /** 终点 Entity ID（Point 实体） */
  endPointId: string;
  /** 样式 */
  style: { color: string; dashed: boolean };
  /** 标签（棱线命名/线段命名） */
  label?: string;
}
```

**设计说明**：
- **builtIn=true 的线段**（几何体棱线）：随几何体创建自动生成，使用默认黑色实线样式
- **builtIn=false 的线段**（用户画的）：通过 DrawSegmentTool 创建，用户可选颜色和虚实
- **端点引用统一**：`startPointId` / `endPointId` 都是 Point Entity 的 ID，不再有 PointRef 联合类型
- **曲面体说明**：曲面体的母线/底圆等渲染线条不创建 Segment Entity（它们是 BuilderResult.lines 的视觉表达，非拓扑棱线），由 GeometryEntityRenderer 直接渲染

### 2.6 Face 实体（统一面模型）

```typescript
interface FaceProperties {
  /** 是否为几何体自带的面（true=几何体面，false=截面等用户创建的面） */
  builtIn: boolean;
  /** 所属几何体 ID */
  geometryId: string;
  /** 构成面的 Point Entity ID 列表（有序，定义多边形边界） */
  pointIds: string[];
  /** 面的来源（决定面的生成方式和渲染样式） */
  source:
    | { type: 'geometry'; faceIndex: number }           // 几何体自带的面（来自 BuilderResult.faces）
    | { type: 'crossSection'; definingPointIds: string[] }  // 截面（用户选 3+ 点定义截面平面）
    | { type: 'custom' };                               // 自定义面（V0.3 预留）
}
```

**设计说明**：
- **几何体面**（`builtIn=true, source.type='geometry'`）：由几何体创建时自动生成，`pointIds` 指向 builtIn Point Entity
- **截面**（`builtIn=false, source.type='crossSection'`）：用户通过 CrossSectionTool 选定 ≥3 个 Point Entity 定义截面平面，`computeCrossSection()` 计算截面多边形与几何体的交点，每个交点创建为显式 Point Entity（constraint.type='edge'，t 值由计算得出），`pointIds` 指向这些交点 Point Entity，`definingPointIds` 保存用户选定的定义点（用于重算）
- **截面交点的响应式更新**：当定义点移动或几何体参数变化时，重新调用 `computeCrossSection()` → 更新交点 Point Entity 的 constraint.t → 更新 Face 的 pointIds
- **级联删除**：删除截面 Face 时，检查其 pointIds 中每个交点 Point Entity 是否被其他实体引用，若无其他引用则一并删除（见 §2.12 引用查询与级联删除）
- 曲面体（圆锥/圆柱/球）暂不创建 Face Entity（曲面不是多边形面）
- V0.3 扩展面交互时，只需注册 FaceInspector + 在 SelectTool 中增加面命中检测

### 2.7 CoordinateSystem 实体（Singleton）

```typescript
interface CoordinateSystemProperties {
  /** 原点 Point Entity ID */
  originPointId: string;
  /** 关联的几何体 ID */
  geometryId: string;
}
```

**Singleton 约束**：场景中最多一个。EntityStore 提供 `getCoordinateSystem()` 快捷方法。
**运行时数据**：坐标轴方向、各顶点坐标值等由 `buildCoordinateSystem()` 纯函数实时计算，不存在 Entity properties 中。

### 2.8 CircumSphere 实体（Singleton）

```typescript
interface CircumSphereProperties {
  /** 关联的几何体 ID */
  geometryId: string;
}
```

**运行时数据**：球心、半径由 `computeCircumscribedSphere()` 纯函数计算。

### 2.9 CircumCircle 实体

```typescript
interface CircumCircleProperties {
  /** 选定的 3 个点 Entity ID */
  pointIds: [string, string, string];
  /** 关联的几何体 ID */
  geometryId: string;
}
```

**运行时数据**：圆心、半径、法向量由 `computeCircumscribedCircle()` 纯函数计算。

### 2.10 实体间引用关系图

```
geometry ←── point.geometryId          （几何体拥有其顶点/特征点/截面交点）
         ←── segment.geometryId        （几何体拥有其棱线）
         ←── face.geometryId           （几何体拥有其面，含截面）
         ←── coordinateSystem.geometryId
         ←── circumSphere.geometryId
         ←── circumCircle.geometryId

point    ←── segment.startPointId / endPointId           （线段引用端点）
         ←── face.pointIds                               （面引用构成顶点/截面交点）
         ←── face.source.definingPointIds                （截面引用定义点）
         ←── coordinateSystem.originPointId              （坐标系引用原点）
         ←── circumCircle.pointIds                       （外接圆引用 3 个点）
```

**引用全部使用 Entity ID（字符串）**，不再有 PointRef 联合类型。

### 2.11 EntityStore 接口

```typescript
interface EntityStore {
  /** 所有实体 */
  entities: Map<string, Entity>;
  /** 下一个 ID（递增） */
  nextId: number;
  /** 当前操作的几何体 ID（V0.2 单几何体，但不硬编码） */
  activeGeometryId: string | null;

  // ─── CRUD ───
  createEntity(type: EntityType, properties: Record<string, unknown>): Entity;
  deleteEntity(id: string): void;
  updateProperties(id: string, patch: Record<string, unknown>): void;
  getEntity(id: string): Entity | undefined;

  // ─── 查询快捷方法 ───
  getActiveGeometry(): Entity | undefined;
  getCoordinateSystem(): Entity | undefined;
  getCircumSphere(): Entity | undefined;
  getEntitiesByType(type: EntityType): Entity[];
  /** 获取几何体的所有 builtIn 子实体（点/线/面） */
  getBuiltInEntities(geometryId: string): Entity[];
  /** 获取几何体的所有关联实体（含 builtIn + 用户创建） */
  getRelatedEntities(geometryId: string): Entity[];

  // ─── 引用查询 ───
  /** 查询所有引用了指定实体 ID 的实体（遍历所有实体的 properties 中的 ID 引用字段） */
  getReferencingEntities(entityId: string): Entity[];

  // ─── 级联删除 ───
  /**
   * 删除实体并级联清理孤立子实体。
   * 逻辑：删除目标实体后，检查其 pointIds / startPointId / endPointId 等引用的子实体，
   * 若子实体不再被任何其他存活实体引用，则一并删除。
   * 返回所有被删除的实体列表（用于 undo 恢复）。
   */
  cascadeDelete(entityId: string): Entity[];

  // ─── 批量操作 ───
  /** 几何体创建后，同步创建所有 builtIn 子实体 */
  createBuiltInEntities(geometryId: string, builderResult: BuilderResult): void;
  /** 几何体类型切换 / 拓扑变化时，重建 builtIn 子实体 */
  rebuildBuiltInEntities(geometryId: string, builderResult: BuilderResult): void;
}
```

### 2.12 引用查询与级联删除

**引用查询**（`getReferencingEntities`）：遍历所有实体，检查其 properties 中是否包含目标实体 ID。检查的字段包括：
- `segment.startPointId` / `segment.endPointId`
- `face.pointIds` / `face.source.definingPointIds`
- `coordinateSystem.originPointId`
- `circumCircle.pointIds`

**级联删除逻辑**：

```
删除实体 E
  │
  ▼
收集 E 引用的子实体 ID 列表（如 face.pointIds）
  │
  ▼
从 EntityStore 中删除 E
  │
  ▼
对每个子实体 C：
  ├── 调用 getReferencingEntities(C.id)
  ├── 若返回空（无其他实体引用 C）→ 删除 C（递归级联）
  └── 若返回非空（还有其他实体引用 C）→ 保留 C
  │
  ▼
返回所有被删除的实体列表（含 E + 所有被级联删除的子实体）
```

**典型场景**：
- 删除截面 Face → 截面的交点 Point 若不被其他线段/面引用 → 一并删除
- 删除用户线段 Segment → 若端点 Point 不被其他实体引用 → 一并删除
- 删除几何体面 Face → 其构成的 builtIn Point 仍被棱线 Segment 引用 → 不会被删除

### 2.13 builtIn 实体生命周期与截面生命周期

```
几何体创建
  → buildGeometry() 获取 BuilderResult
  → createBuiltInEntities()：
    - 多面体：创建 N 个 Point(vertex) + M 个 Segment(edge) + K 个 Face
    - 曲面体：创建特征点 Point(vertex)（不创建 Segment/Face）

参数变化（不改拓扑，如长宽高）
  → BuilderResult 重算
  → 零 Entity 变更（渲染器从 BuilderResult 重新计算位置）

参数变化（改拓扑，如棱锥边数 4→5）
  → rebuildBuiltInEntities()：
    1. 删除所有 builtIn=true 的 Point/Segment/Face
    2. 删除所有 builtIn=false 但引用了旧顶点的 Point/Segment（级联清理）
    3. 根据新 BuilderResult 重新创建 builtIn 子实体

几何体类型切换
  → ChangeGeometryTypeCommand：
    1. 快照所有关联实体
    2. 删除所有关联实体（builtIn + 用户创建）
    3. 更新 geometry.geometryType + geometry.params
    4. createBuiltInEntities()
    5. undo 时恢复快照

截面创建（Face + 交点 Points）
  → CrossSectionTool 选定 ≥3 个 Point Entity 作为定义点
  → computeCrossSection() 计算截面多边形与几何体的交点
  → BatchCommand：
    1. 为每个交点创建 Point Entity（builtIn=false, constraint={ type:'edge', edgeStart, edgeEnd, t }）
    2. 创建 Face Entity（builtIn=false, source={ type:'crossSection', definingPointIds }, pointIds=交点 IDs）
  → undo 时删除 Face + 所有交点 Point

截面响应式更新（定义点移动 / 几何体参数变化）
  → 重新 computeCrossSection()
  → 更新交点 Point Entity 的 constraint.t 值
  → 更新 Face Entity 的 pointIds（交点数量可能变化）
  → 封装为 UpdateCrossSectionCommand

截面删除
  → cascadeDelete(faceId)
  → 交点 Point 若无其他引用 → 一并删除
  → 交点 Point 若被其他线段/外接圆引用 → 保留
```

### 2.14 实体数量评估

| 几何体 | builtIn 点 | builtIn 线 | builtIn 面 | 小计 |
|--------|-----------|-----------|-----------|------|
| 正方体 | 8 | 12 | 6 | 27 |
| 长方体 | 8 | 12 | 6 | 27 |
| 棱锥(4边) | 5 | 8 | 5 | 19 |
| 棱锥(8边) | 9 | 16 | 9 | 35 |
| 圆锥 | 2 | 0 | 0 | 3 |
| 圆柱 | 2 | 0 | 0 | 3 |
| 球 | 0 | 0 | 0 | 1 |

加上用户创建的点/线段/截面等，最大场景约 **40~50 个实体**，全量重算无性能问题。

### 2.15 依赖更新策略

**全量重算**：场景实体数量少（≤50 个），不建 Dependency Graph。

触发时机：
1. **几何体参数变化（不改拓扑）** → BuilderResult 重算 → 渲染器从新 BuilderResult 重新计算所有点/线/面位置
2. **Point 约束参数变化**（如 t 值改变）→ 引用该 Point 的 Segment 等渲染器读取新位置
3. **几何体拓扑变化 / 类型切换** → rebuildBuiltInEntities / 完整快照+重建

实现方式：Renderer 组件读取 Entity properties + BuilderResult，在 `useMemo` 中计算最终位置，React 的响应式更新自然处理依赖关系。

---

## 3. Command 系统

### 3.1 Command 接口

```typescript
interface Command {
  /** 命令类型标识 */
  type: string;
  /** 人类可读描述（用于 undo/redo 提示） */
  label: string;
  /** 执行 */
  execute(): void;
  /** 撤销 */
  undo(): void;
}
```

### 3.2 CommandProcessor

```typescript
interface CommandProcessor {
  /** 执行命令并压入 undo 栈 */
  execute(command: Command): void;
  /** 撤销 */
  undo(): void;
  /** 重做 */
  redo(): void;
  /** undo 栈是否非空 */
  canUndo: boolean;
  /** redo 栈是否非空 */
  canRedo: boolean;
}
```

**HistoryStore** 内嵌 CommandProcessor 逻辑：
- `undoStack: Command[]`
- `redoStack: Command[]`
- 执行新 Command 时清空 redoStack
- 栈深度上限：50 条

### 3.3 V0.2 Command 清单

| Command | 描述 | undo 数据 |
|---------|------|-----------|
| `CreateEntityCommand` | 创建实体 | 记录 entity id，undo 时删除 |
| `DeleteEntityCommand` | 删除实体 | 记录完整 entity 快照，undo 时恢复 |
| `UpdatePropertiesCommand` | 更新实体属性（通用） | 记录 oldProperties 片段 |
| `ChangeGeometryTypeCommand` | 切换几何体类型 | 记录旧类型/参数 + 所有关联实体快照 |
| `UpdateGeometryParamsCommand` | 更新几何体参数 | 记录旧 params（含拓扑变化时的 builtIn 实体快照） |
| `MovePointCommand` | 拖拽点（统一） | 记录旧 positionOverride |
| `RenameEntityCommand` | 重命名实体（统一） | 记录旧 label |
| `CreateCrossSectionCommand` | 创建截面（Face + 交点 Points 打包） | BatchCommand 包装的创建操作列表 |
| `UpdateCrossSectionCommand` | 截面响应式更新（交点 t 值 + pointIds） | 旧交点快照 |
| `DeleteEntityCascadeCommand` | 删除实体并级联清理孤立子实体 | 所有被删除的实体快照列表 |
| `BatchCommand` | 组合多个 Command | 子 Command 列表 |

**统一化收益**：`MovePointCommand` 和 `RenameEntityCommand` 不再区分顶点/自定义点，对所有 Point Entity 通用。`DeleteEntityCascadeCommand` 统一处理"删除实体 + 清理无引用子实体"的逻辑。

### 3.4 连续操作的 Command 粒度

```
拖拽/滑块操作：
  mousedown → 记录 beforeState
  mousemove → 实时更新 Entity properties（不产生 Command）
  mouseup   → 生成 Command(beforeState, afterState) 压入 undo 栈

非连续操作（按钮点击、切换等）：
  立即生成 Command 并执行
```

### 3.5 几何体类型切换处理

几何体类型切换是"重置性操作"：
1. 快照所有关联实体（builtIn points/segments/faces + 用户创建的 points/segments/faces(截面) + circumSphere + circumCircle + coordinateSystem）
2. 删除所有关联实体
3. 更新 geometry 实体的 geometryType + params
4. 根据新 BuilderResult 创建新的 builtIn 子实体
5. undo 时恢复所有关联实体 + 旧 geometryType + params

封装为 `ChangeGeometryTypeCommand`，内部使用完整状态快照。

---

## 4. Event/Signal 系统

### 4.1 Signal 设计

```typescript
/** 类型安全的 Signal */
class Signal<T = void> {
  private listeners: Set<(data: T) => void>;

  subscribe(listener: (data: T) => void): () => void;
  emit(data: T): void;
  clear(): void;
}
```

### 4.2 Signal 实例清单

```typescript
const signals = {
  // 实体生命周期
  entityCreated:  new Signal<{ entity: Entity }>(),
  entityUpdated:  new Signal<{ entity: Entity; changes: string[] }>(),
  entityDeleted:  new Signal<{ entity: Entity }>(),

  // 选中变更
  selectionChanged: new Signal<{ selectedIds: Set<string>; primaryId: string | null }>(),

  // 工具变更
  toolChanged: new Signal<{ toolId: string }>(),

  // 命令历史
  commandExecuted: new Signal<{ command: Command; direction: 'do' | 'undo' | 'redo' }>(),

  // 几何体重建（参数/类型变化后 BuilderResult 更新）
  geometryRebuilt: new Signal<{ geometryId: string }>(),
};
```

### 4.3 Signal 使用场景

| 发布方 | Signal | 订阅方 | 用途 |
|--------|--------|--------|------|
| EntityStore | entityCreated/Updated/Deleted | Renderer | 触发视觉更新 |
| SelectionStore | selectionChanged | Property 面板 | 刷新属性面板 |
| SelectionStore | selectionChanged | Renderer | 更新选中高亮 |
| HistoryStore | commandExecuted | UI (undo/redo 按钮) | 更新按钮状态 |
| useGeometryBuilder | geometryRebuilt | 依赖几何体数据的 Renderer | 重算位置 |

**实际实现说明**：由于使用 Zustand，多数场景可通过 `store.subscribe` 或 React 的 selector 机制实现响应式更新。Signal 主要用于跨 Store 的通知（如 EntityStore 变更通知到 Renderer 中不直接订阅 EntityStore 的组件）。V0.2 初期可以简化实现：仅在 Zustand subscribe 不够用的地方引入 Signal，避免过度抽象。

---

## 5. Tool 系统

### 5.1 Tool 接口

```typescript
interface Tool {
  /** 工具唯一标识 */
  id: string;
  /** 工具名称（显示用） */
  label: string;
  /** 工具激活时调用 */
  onActivate?(): void;
  /** 工具停用时调用（清理状态） */
  onDeactivate?(): void;
  /** 鼠标/触屏事件 */
  onPointerDown?(event: ToolPointerEvent): void;
  onPointerMove?(event: ToolPointerEvent): void;
  onPointerUp?(event: ToolPointerEvent): void;
  /** 键盘事件 */
  onKeyDown?(event: KeyboardEvent): void;
  /** 工具的临时可视化（如画线预览） */
  renderOverlay?(): React.ReactNode;
}

interface ToolPointerEvent {
  /** 原始事件 */
  nativeEvent: PointerEvent;
  /** 射线投射结果 */
  intersection?: THREE.Intersection;
  /** 命中的实体 ID（如果有） */
  hitEntityId?: string;
  /** 命中的实体类型（如果有） */
  hitEntityType?: EntityType;
}
```

**简化说明**：由于所有可交互对象都是 Entity，`ToolPointerEvent` 不再需要 `hitSubElement`。命中顶点时 `hitEntityId` 就是该 Point Entity 的 ID，命中棱线时就是该 Segment Entity 的 ID。

### 5.2 ToolStore

```typescript
interface ToolStore {
  /** 当前激活的工具 ID */
  activeToolId: string;
  /** 已注册的工具映射 */
  tools: Map<string, Tool>;
  /** 切换工具 */
  setActiveTool(toolId: string): void;
  /** 注册工具 */
  registerTool(tool: Tool): void;
  /** 获取当前工具 */
  getActiveTool(): Tool;
}
```

### 5.3 V0.2 Tool 清单

| Tool ID | 名称 | 迁移来源 | 职责 |
|---------|------|----------|------|
| `select` | 选择工具（默认） | useInteraction.selectVertex | 选中点/线段/面实体；拖拽点 |
| `drawSegment` | 画线工具 | drawingMode='segment' | 两次点击 Point Entity 创建线段 |
| `crossSection` | 截面工具 | drawingMode='crossSection' | 多次点击 Point Entity 选定截面定义点 → 创建 Face(crossSection) + 交点 Points |
| `coordSystem` | 坐标系工具 | coordinateSystemEnabled + originIndex | 点击 Point Entity 选择坐标系原点 |

### 5.4 工具互斥与切换规则

- 同一时刻只有一个活跃工具
- Escape 键统一回到 `select` 工具
- 工具切换时：先调用当前工具的 `onDeactivate()`（清理临时状态），再调用新工具的 `onActivate()`
- 坐标系工具在原点选定后自动退回 `select` 工具

---

## 6. Selection 系统

### 6.1 SelectionStore

```typescript
interface SelectionStore {
  /** 选中的实体 ID 集合（V0.2 只支持单选，但数据结构预留多选） */
  selectedIds: Set<string>;
  /** 主选中实体 ID（用于属性面板显示） */
  primaryId: string | null;

  // ─── Actions ───
  select(entityId: string): void;
  deselect(entityId: string): void;
  clear(): void;
  toggle(entityId: string): void;
}
```

### 6.2 设计说明

- **统一模型的收益**：不再需要 `SubSelection`。几何体顶点是 Point Entity，棱线是 Segment Entity，面是 Face Entity，全部通过 `select(entityId)` 选中，一套代码路径处理所有情况。
- **与 Tool 的关系**：Tool 负责决定"什么时候/怎么选中"，SelectionStore 负责"存储选中状态"。
- **广播**：选中变更时通过 Zustand subscribe 或 Signal 通知 Property 面板和 Renderer。

---

## 7. Property/Inspector 系统

### 7.1 设计概念

```typescript
/** 属性面板注册表 */
type InspectorRegistry = Map<EntityType, React.ComponentType<{ entity: Entity }>>;
```

当选中实体时，根据 `entity.type` 从注册表中查找对应的属性面板组件进行渲染。

### 7.2 V0.2 属性面板

| 实体类型 | 面板组件 | 迁移来源 | 可编辑属性 |
|----------|----------|----------|------------|
| geometry | GeometryInspector | ParameterPanel | geometryType, params (滑块) |
| point | PointInspector | — (新增) | label, constraint.t (棱上点/曲线点滑动) |
| segment | SegmentInspector | AuxiliaryTools 线段列表 | style.color, style.dashed, label |
| face | FaceInspector | AuxiliaryTools 截面区 + V0.2 占位 | source=geometry 时显示面索引（只读）；source=crossSection 时显示定义点、面积、交点列表 |
| coordinateSystem | CoordSystemInspector | AuxiliaryTools 坐标系区 | originPointId (重选按钮) |
| circumSphere | CircumSphereInspector | AuxiliaryTools 外接球区 | 显示半径（只读） |
| circumCircle | CircumCircleInspector | AuxiliaryTools 外接圆区 | pointIds (选择3点) |

### 7.3 V0.2 面板布局策略

V0.2 的右侧面板采用混合策略：

- **上半部分**：固定面板（几何体类型选择 + 参数滑块 + 辅助功能开关）——始终可见，不依赖选中状态
- **下半部分**：动态 Inspector（根据选中实体显示对应属性面板）

**理由**：V0.1 的用户体验是"所有控制始终可见"，V0.2 不改变用户体验，因此不能完全替换为"选中才显示"。辅助功能（坐标系开关、外接球开关、画线按钮等）仍作为固定面板存在。Inspector 作为补充，在选中具体实体时显示其可编辑属性。

---

## 8. Renderer 系统

### 8.1 渲染器注册

```typescript
/** 渲染器注册表 */
type RendererRegistry = Map<EntityType, React.ComponentType<{ entity: Entity }>>;
```

SceneContent 遍历 EntityStore 中的所有可见实体，根据 `entity.type` 从注册表中查找渲染器组件。

### 8.2 V0.2 渲染器清单

| 实体类型 | 渲染器 | 迁移来源 |
|----------|--------|----------|
| geometry | GeometryEntityRenderer | GeometryRenderer（曲面体几何 + 母线/轮廓线，不渲染面） |
| point | PointEntityRenderer | VertexLabels + CustomPointsRenderer + CurveCustomPointsRenderer |
| segment | SegmentEntityRenderer | 棱线渲染（Line 组件）+ CustomSegments + 不可见命中体积（迁移自 LineHitboxes，userData 携带 entityId 供 raycasting） |
| face | FaceEntityRenderer | 半透明面统一渲染（builtIn 几何体面 + 截面，根据 source 类型区分样式；从 GeometryRenderer 面渲染拆出 + CrossSection 合并） |
| coordinateSystem | CoordSystemRenderer | CoordinateAxes + VertexCoordLabels |
| circumSphere | CircumSphereRenderer | CircumSphere |
| circumCircle | CircumCircleRenderer | CircumCircle |

### 8.3 GeometryEntityRenderer 说明

统一实体模型下，GeometryEntityRenderer 的职责简化：
1. 调用 `buildGeometry()` 获取 BuilderResult
2. 根据 `result.kind` 渲染几何体自身（多面体半透明面 / 曲面体 Three.js 几何体 + 母线/轮廓线）
3. **不再直接渲染顶点标签、棱线、自定义点**——这些已是独立 Entity，由各自的 Renderer 渲染

**决策**：多面体的半透明面由 FaceEntityRenderer 统一渲染（遍历 builtIn Face Entity + crossSection Face Entity），GeometryEntityRenderer 不渲染面。理由：符合 P1 统一性原则，面的选中高亮、样式区分等逻辑只需在 FaceEntityRenderer 中维护一套。

### 8.4 BuilderResult 缓存

BuilderResult 不存在 Entity properties 中（不可序列化），作为运行时缓存：

```typescript
/** 运行时缓存：geometry entity id → BuilderResult */
const builderResultCache = new Map<string, BuilderResult>();

/**
 * 获取几何体的 BuilderResult（缓存 + 按需重建）
 * 在 geometry 实体的 params 变化时失效
 */
function getBuilderResult(geometry: Entity): BuilderResult | null;
```

实现方式：使用 React 的 `useMemo` 或独立的缓存管理器，当 geometry properties 变化时重新计算。

---

## 9. 数据流全链路

### 9.1 主链路

```
用户操作
  │
  ▼
Tool 捕获事件（onPointerDown/Move/Up, onKeyDown）
  │
  ▼
Tool 构造 Command（如 CreateEntityCommand, UpdatePropertiesCommand）
  │
  ▼
CommandProcessor.execute(command)
  ├── command.execute() → EntityStore 变更
  ├── 压入 undoStack，清空 redoStack
  └── emit(commandExecuted)
       │
       ▼
Zustand 响应式更新 / Signal 通知
  ├── Renderer 组件重渲染（读取最新 Entity 数据）
  ├── Property 面板刷新（读取选中实体属性）
  └── UI 状态更新（undo/redo 按钮状态）
```

### 9.2 典型操作流程

#### 9.2.1 拖拽顶点

```
SelectTool.onPointerDown
  → hitEntityId 指向一个 Point Entity（builtIn=true, constraint.type='vertex'）
  → 记录 beforeState = point.properties.positionOverride

SelectTool.onPointerMove
  → 实时更新该 Point Entity 的 positionOverride（直接 EntityStore.updateProperties，不产生 Command）
  → PointEntityRenderer 重渲染，顶点跟随鼠标
  → 引用该顶点的 Segment/Face Renderer 也自动重渲染

SelectTool.onPointerUp
  → afterState = point.properties.positionOverride
  → CommandProcessor.execute(new MovePointCommand(pointId, beforeState, afterState))
  → 压入 undo 栈
```

#### 9.2.2 画自定义线段

```
用户激活 DrawSegmentTool
  → ToolStore.setActiveTool('drawSegment')
  → SelectTool.onDeactivate()
  → DrawSegmentTool.onActivate()

第一次点击：
  → DrawSegmentTool.onPointerDown
  → hitEntityId 是一个 Point Entity → 记录 startPointId
  → renderOverlay() 显示预览线

第二次点击：
  → DrawSegmentTool.onPointerDown
  → hitEntityId 是另一个 Point Entity → endPointId
  → CommandProcessor.execute(new CreateEntityCommand('segment', {
      builtIn: false, geometryId, startPointId, endPointId, style
    }))
  → 清除 startPointId，准备下一条线段
```

#### 9.2.3 几何体类型切换

```
用户在 TopBar 点击新几何体类型
  → 构造 ChangeGeometryTypeCommand
     → execute():
       1. 快照所有关联实体（builtIn + 用户创建的 points/segments/faces + 辅助实体）
       2. 删除所有关联实体
       3. 更新 geometry.geometryType + geometry.params
       4. BuilderResult 缓存失效 → 重算
       5. createBuiltInEntities() 创建新几何体的 builtIn 子实体
     → undo():
       1. 删除当前 builtIn 子实体
       2. 恢复 geometry.geometryType + geometry.params
       3. 恢复所有关联实体快照
  → CommandProcessor.execute(command)
```

#### 9.2.4 Undo/Redo

```
用户按 Ctrl+Z
  → CommandProcessor.undo()
  → command = undoStack.pop()
  → command.undo() → EntityStore 恢复到变更前状态
  → redoStack.push(command)
  → emit(commandExecuted, { direction: 'undo' })
  → UI 更新

用户按 Ctrl+Y
  → CommandProcessor.redo()
  → command = redoStack.pop()
  → command.execute() → EntityStore 重新应用变更
  → undoStack.push(command)
  → emit(commandExecuted, { direction: 'redo' })
```

#### 9.2.5 滑块调参（连续操作）

```
滑块 onValueChange（mousemove 持续触发）
  → 首次触发时记录 beforeParams
  → 直接 EntityStore.updateProperties(geometryId, { params: newParams })
  → BuilderResult 重算 → 所有 Renderer 实时更新

滑块 onValueCommit（mouseup / pointerup）
  → afterParams = 当前 params
  → 如果拓扑变化（如棱锥边数改变）：rebuildBuiltInEntities()
  → CommandProcessor.execute(new UpdateGeometryParamsCommand(beforeParams, afterParams, builtInSnapshot?))
  → 压入 undo 栈
```

#### 9.2.6 创建截面

```
用户激活 CrossSectionTool
  → ToolStore.setActiveTool('crossSection')

连续点击 Point Entity 选定定义点（≥3 个）：
  → CrossSectionTool 维护 definingPointIds 临时列表
  → renderOverlay() 高亮已选定义点

确认创建（点击确认按钮 / 选满后自动触发）：
  → 从 EntityStore 获取 geometry Entity 和 BuilderResult
  → 调用 computeCrossSection(definingPoints, builderResult)
  → 返回截面多边形交点列表：[{ edgeStart, edgeEnd, t, position }]
  → 构造 CreateCrossSectionCommand（内部为 BatchCommand）：
    1. 为每个交点创建 Point Entity：
       { builtIn: false, geometryId, constraint: { type: 'edge', edgeStart, edgeEnd, t }, label: 自动编号 }
    2. 创建 Face Entity：
       { builtIn: false, geometryId, pointIds: 交点 IDs,
         source: { type: 'crossSection', definingPointIds } }
  → CommandProcessor.execute(command)
  → CrossSectionTool 清理临时状态
```

#### 9.2.7 删除实体（级联）

```
用户选中一个实体 → 按 Delete 键
  → 构造 DeleteEntityCascadeCommand(entityId)
  → execute():
    1. 调用 EntityStore.cascadeDelete(entityId)
    2. 记录所有被删除的实体快照（用于 undo）
  → undo():
    1. 按原顺序恢复所有快照实体
  → CommandProcessor.execute(command)

典型场景：
  - 删除截面 Face → 交点 Point 无其他引用 → 全部删除
  - 删除用户线段 → 端点若是 builtIn 顶点 → 保留（被棱线引用）
  - 删除用户线段 → 端点若是用户创建的棱上点且无其他引用 → 删除
```

---

## 10. 目录结构规范

### 10.1 推进策略（方案 C）

采用"新目录开发 + 旧代码保持可运行"策略（详见 `推进方案.md`）：

| 阶段 | 操作范围 | 旧代码状态 | 验证手段 |
|------|----------|-----------|----------|
| 阶段 1-3 | 纯新增 `src/editor/` | 不碰，应用可正常运行 | `pnpm tsc --noEmit` |
| 阶段 4-6 | 改造 `src/components/` 接入新系统 | 逐步替换引用 | 浏览器运行 + 功能回归 |
| 阶段 7-8 | 删除旧 store/hooks/types | 清理完毕 | `pnpm lint` + `tsc` + 全功能验证 |

### 10.2 新增 `src/editor/` 目录

```
src/
├── editor/                          # 编辑器核心系统（V0.2 新增）
│   ├── entities/                    # Entity 类型定义
│   │   ├── types.ts                 # Entity, EntityType, 各 Properties 接口
│   │   └── index.ts
│   ├── store/                       # 核心 Store
│   │   ├── entityStore.ts           # EntityStore（Zustand）
│   │   ├── selectionStore.ts        # SelectionStore（Zustand）
│   │   ├── historyStore.ts          # HistoryStore + CommandProcessor（Zustand）
│   │   ├── toolStore.ts             # ToolStore（Zustand）
│   │   └── index.ts
│   ├── commands/                    # Command 实现
│   │   ├── types.ts                 # Command 接口
│   │   ├── createEntity.ts
│   │   ├── deleteEntity.ts
│   │   ├── updateProperties.ts
│   │   ├── changeGeometryType.ts
│   │   ├── updateGeometryParams.ts
│   │   ├── movePoint.ts
│   │   ├── renameEntity.ts
│   │   ├── createCrossSection.ts
│   │   ├── updateCrossSection.ts
│   │   ├── deleteEntityCascade.ts
│   │   ├── batch.ts
│   │   └── index.ts
│   ├── tools/                       # Tool 实现
│   │   ├── types.ts                 # Tool, ToolPointerEvent 接口
│   │   ├── selectTool.ts
│   │   ├── drawSegmentTool.ts
│   │   ├── crossSectionTool.ts
│   │   ├── coordSystemTool.ts
│   │   └── index.ts
│   ├── signals.ts                   # Signal 类 + 全局 Signal 实例
│   └── index.ts                     # 编辑器初始化（注册 Tools、Renderers）
│
├── engine/                          # 计算引擎（不动）
│   ├── types.ts
│   ├── builders/
│   ├── math/
│   ├── unfolding/
│   └── projection/
│
├── components/                      # UI 层
│   ├── scene/                       # 3D 场景
│   │   ├── Scene3D.tsx              # Canvas 容器（改造：遍历 EntityStore 渲染）
│   │   ├── renderers/               # 实体渲染器（V0.2 新增子目录）
│   │   │   ├── GeometryEntityRenderer.tsx
│   │   │   ├── PointEntityRenderer.tsx
│   │   │   ├── SegmentEntityRenderer.tsx
│   │   │   ├── FaceEntityRenderer.tsx
│   │   │   ├── CoordSystemRenderer.tsx
│   │   │   ├── CircumSphereRenderer.tsx
│   │   │   ├── CircumCircleRenderer.tsx
│   │   │   └── index.ts             # RendererRegistry
│   │   ├── VertexLabels.tsx          # 可删除或改造为 PointEntityRenderer 内部使用
│   │   ├── LineHitboxes.tsx          # 可删除或改造为 SegmentEntityRenderer 内部使用
│   │   └── ContextMenu3D.tsx         # 改造：通过 Command 执行操作
│   ├── panels/                      # 右侧面板
│   │   ├── FixedPanel.tsx           # 固定面板（几何体选择 + 参数 + 辅助功能开关）
│   │   ├── inspectors/              # 属性面板（V0.2 新增子目录）
│   │   │   ├── GeometryInspector.tsx
│   │   │   ├── PointInspector.tsx
│   │   │   ├── SegmentInspector.tsx
│   │   │   ├── FaceInspector.tsx
│   │   │   └── index.ts             # InspectorRegistry
│   │   └── InspectorPanel.tsx       # 动态属性面板容器
│   ├── info/                        # 度量信息（保留）
│   ├── layout/                      # 布局容器（保留）
│   ├── views/                       # 展开图/三视图（保留）
│   └── ui/                          # UI 基础组件（保留）
│
├── hooks/                           # 改造
│   ├── useGeometryBuilder.ts        # 改造：从 EntityStore 读取 geometry 实体
│   └── useInteraction.ts            # 删除（逻辑迁移到 Tool 系统）
│
├── store/
│   └── useGeometryStore.ts          # 删除（迁移到 editor/store/）
│
├── types/
│   ├── geometry.ts                  # 保留（GeometryType, GeometryParams 等）
│   └── scene.ts                     # 大幅简化（PointRef 删除，CustomPoint/SelectionTarget 迁移到 entities/types.ts）
│
└── utils/
    ├── pointRef.ts                  # 改造（resolvePointRef → resolvePointPosition，输入改为 Point Entity）
    └── curveProjection.ts           # 保留
```

### 10.3 边界说明

| 模块 | 可依赖 | 不可依赖 |
|------|--------|----------|
| `engine/` | 无外部依赖（纯函数） | 不依赖 editor/、components/、store/ |
| `editor/entities/` | `engine/types` | 不依赖 editor/ 其他子模块 |
| `editor/store/` | `editor/entities/` | 不依赖 components/ |
| `editor/commands/` | `editor/store/`、`editor/entities/` | 不依赖 components/ |
| `editor/tools/` | `editor/store/`、`editor/commands/`、`editor/signals` | 不依赖 components/ |
| `components/scene/renderers/` | `editor/store/`、`engine/` | 不依赖 editor/tools/ |
| `components/panels/inspectors/` | `editor/store/`、`editor/commands/` | 不依赖 editor/tools/ |

### 10.4 文件命名规范

- Entity 类型定义：`camelCase.ts`（如 `types.ts`）
- Store 文件：`camelCaseStore.ts`（如 `entityStore.ts`）
- Command 文件：`camelCase.ts`（如 `createEntity.ts`）
- Tool 文件：`camelCaseTool.ts`（如 `selectTool.ts`）
- React 组件：`PascalCase.tsx`（如 `GeometryEntityRenderer.tsx`）

---

## 11. 旧代码迁移映射

### 11.1 Store 字段迁移

| 旧字段 (useGeometryStore) | 迁移目标 | 说明 |
|---------------------------|----------|------|
| `currentType` | `geometry.properties.geometryType` | Entity 属性 |
| `params` | `geometry.properties.params` | Entity 属性 |
| `labelOverrides` | 各 Point Entity 的 `label` | 不再集中存储，分散到各顶点 Entity |
| `positionOverrides` | 各 Point Entity 的 `positionOverride` | 不再集中存储，分散到各顶点 Entity |
| `customPoints` | 独立 Point Entity（builtIn=false） | 每个 CustomPoint → 1 个 Point Entity |
| `edgeLabels` | 各 Segment Entity 的 `label` | 不再集中存储，分散到各棱线 Entity |
| `selection` | SelectionStore.select(entityId) | 统一为 Entity ID 选中 |
| `isDragging` | SelectTool 内部状态 | Tool 私有状态 |
| `contextMenu` | 组件局部状态 | 不再在全局 Store |
| `coordinateSystemEnabled` | CoordinateSystem Entity 是否存在 | 创建/删除 Entity |
| `coordinateOriginIndex` | CoordinateSystem.properties.originPointId | Point Entity ID |
| `circumSphereEnabled` | CircumSphere Entity 是否存在 | 创建/删除 Entity |
| `circumCircleEnabled` | CircumCircle Entity 是否存在 | 创建/删除 Entity |
| `circumCircleVertices` + `circumCircleCustomIds` | CircumCircle.properties.pointIds | 统一为 Point Entity ID |
| `customSegments` | 独立 Segment Entity（builtIn=false） | 每个 CustomSegment → 1 个 Segment Entity |
| `drawingMode` | ToolStore.activeToolId | Tool 系统 |
| `drawingStartRef` | DrawSegmentTool 内部状态 | Tool 私有状态 |
| `crossSectionPoints` | Face(crossSection).source.definingPointIds | Point Entity ID 列表 |
| `crossSectionEnabled` | Face(crossSection) Entity 是否存在 | 创建/删除 Face Entity |
| `unfoldingEnabled` | UI 局部状态 / 固定面板状态 | 不关联 Entity |
| `threeViewEnabled` | UI 局部状态 / 固定面板状态 | 不关联 Entity |

### 11.2 组件迁移

| 旧组件 | 迁移方式 | 迁移阶段 |
|--------|----------|----------|
| `GeometryRenderer.tsx` | 拆分：几何体自身渲染 → `GeometryEntityRenderer.tsx`；顶点/棱线/面渲染 → 各自 EntityRenderer | 阶段4-5 |
| `VertexLabels.tsx` | 合并到 `PointEntityRenderer.tsx` | 阶段4 |
| `LineHitboxes.tsx` | 合并到 `SegmentEntityRenderer.tsx` | 阶段4 |
| `CustomSegments.tsx` | 合并到 `SegmentEntityRenderer.tsx`（统一处理 builtIn 和用户线段） | 阶段4 |
| `CoordinateAxes.tsx` | 重写为 `CoordSystemRenderer.tsx` | 阶段5 |
| `CircumSphere.tsx` | 重写为 `CircumSphereRenderer.tsx` | 阶段5 |
| `CircumCircle.tsx` | 重写为 `CircumCircleRenderer.tsx` | 阶段5 |
| `CrossSection.tsx` | 合并到 `FaceEntityRenderer.tsx`（截面渲染由 Face source=crossSection 处理） | 阶段5 |
| `ContextMenu3D.tsx` | 改造：操作通过 Command 执行 | 阶段4 |
| `ParameterPanel.tsx` | 合并到 FixedPanel / GeometryInspector | 阶段6 |
| `AuxiliaryTools.tsx` | 拆分到 FixedPanel + 各 Inspector | 阶段6 |
| `LabelingTools.tsx` | 合并到 FixedPanel / PointInspector | 阶段6 |
| `Scene3D.tsx` | 改造：遍历 EntityStore 渲染 | 阶段4 |
| `TopBar.tsx` | 改造：几何体切换通过 Command | 阶段4 |
| `AppLayout.tsx` | 基本保留 | 阶段6 |

### 11.3 Hook 迁移

| 旧 Hook | 迁移目标 | 说明 |
|---------|----------|------|
| `useGeometryBuilder` | 保留但改造 | 从 EntityStore 读取 geometry 实体的 params |
| `useInteraction` | 删除 | 逻辑拆分到 SelectTool + DrawSegmentTool + CrossSectionTool |
| `edgeKey()` | 可删除 | 棱线已是 Segment Entity，用 Entity ID 标识 |

### 11.4 类型迁移

| 旧类型 (types/scene.ts) | 迁移目标 | 说明 |
|-------------------------|----------|------|
| `PointRef` | **删除** | 统一为 Entity ID（string） |
| `CustomPoint` | **删除** | 迁移为 Point Entity（builtIn=false） |
| `SelectionTarget` | **删除** | 迁移为 SelectionStore.select(entityId) |
| `ContextMenuTarget` / `ContextMenuState` | 组件局部类型 | 移到 ContextMenu3D 内部 |
| `CustomSegment` | **删除** | 迁移为 Segment Entity（builtIn=false） |
| `DrawingMode` | **删除** | 迁移为 ToolStore.activeToolId |
| `AnnotationState` | **删除** | 各字段分散到对应 Entity |

### 11.5 不变模块

以下模块在 V0.2 中**不修改**：

- `src/engine/builders/` — 所有 6 个 Builder
- `src/engine/math/` — 所有计算器（calculators, coordinates, crossSection, circumscribed*, symbolic）
- `src/engine/unfolding/` — 展开图算法
- `src/engine/projection/` — 三视图投影
- `src/engine/types.ts` — BuilderResult 等类型
- `src/types/geometry.ts` — GeometryType, GeometryParams, DEFAULT_PARAMS
- `src/components/ui/` — 所有基础 UI 组件
- `src/components/views/` — UnfoldingPanel, ThreeViewPanel
- `src/components/info/` — MeasurementDisplay, CalcStepsModal
- `src/styles/` — tokens 等

---

## 12. V0.3 扩展路径验证

### 12.1 角度度量

```
扩展步骤：
1. 新增 EntityType: 'angleMeasurement'
2. 定义 AngleMeasurementProperties: { pointIds: [string, string, string] }
3. 注册 AngleMeasurementRenderer（渲染角度弧线 + 数值标签）
4. 注册 AngleMeasurementInspector（显示角度值）
5. 编写 AngleTool（选 3 个 Point Entity 创建角度标注）

不需修改框架代码 ✅
pointIds 直接引用 Point Entity ID，无论是 builtIn 顶点还是用户创建的点 ✅
```

### 12.2 面上取点

```
扩展步骤：
1. Point.constraint 新增类型: { type: 'face'; faceEntityId: string; u: number; v: number }
2. PointEntityRenderer 增加面上点的位置计算逻辑
3. SelectTool 增加面命中检测（点击 Face Entity → 在面上创建 Point Entity）

不需修改框架代码 ✅
Face 已是 Entity，点击即可获得 hitEntityId ✅
```

### 12.3 新几何体

```
扩展步骤：
1. engine/builders/ 新增 Builder
2. types/geometry.ts 新增 GeometryType + Params
3. 注册到 buildGeometry() 的 builders 映射表
4. createBuiltInEntities() 自动根据 BuilderResult 创建 builtIn 子实体

不需修改框架代码 ✅（builtIn 实体创建逻辑从 BuilderResult 通用派生）
```

### 12.4 面交互（面选中/面属性）

```
扩展步骤：
1. SelectTool 增加面命中检测（raycast 到面 → hitEntityId = Face Entity ID）
2. FaceInspector 增加面的可编辑属性（如颜色、透明度）
3. FaceEntityRenderer 增加选中高亮

不需修改框架代码 ✅
Face 已是 Entity，Selection/Inspector/Renderer 机制全部复用 ✅
```

### 12.5 验证结论

四条路径均只需 **"注册新实体类型 / 扩展 constraint / 注册渲染器 / 编写 Tool+Inspector"**，不需修改框架代码。统一实体模型带来的扩展性优势在 V0.3 面交互场景尤为突出。

---

## 13. 决策记录

### D1: BuilderResult 缓存策略

| 选项 | 优劣 |
|------|------|
| A. 存在 Entity properties 中 | ❌ 不可 JSON 序列化（含 Float32Array 等），违反序列化约束 |
| B. 运行时计算缓存（useMemo / Map） | ✅ 简单直接，参数变化自动失效 |

**决策**：B — 运行时 useMemo 缓存。

### D2: 依赖更新策略

| 选项 | 优劣 |
|------|------|
| A. 同步全量重算 | ✅ 简单，实体 ≤50 时无性能问题 |
| B. 标记脏位延迟更新 | ❌ 增加复杂度，当前场景无必要 |

**决策**：A — 全量重算。依赖关系通过 React useMemo 的响应式更新自然处理。

### D3: 多几何体预留

| 选项 | 优劣 |
|------|------|
| A. 硬编码单几何体（全局 `geometry` 变量） | ❌ 阻塞 V0.3 扩展 |
| B. EntityStore 中用 `activeGeometryId` 指向当前操作的几何体 | ✅ 多几何体就是多个 geometry Entity + 切换 activeGeometryId |

**决策**：B — 使用 `activeGeometryId`。V0.2 中初始化时创建一个 geometry Entity 并设为 active。

### D4: Selection 状态归属

| 选项 | 优劣 |
|------|------|
| A. EntityStore 的一部分 | ❌ Entity CRUD 和 Selection 变更混合，频繁触发不必要重渲染 |
| B. 独立 SelectionStore | ✅ 职责清晰，独立变更频率，减少重渲染 |

**决策**：B — 独立 SelectionStore。

### D5: 事件通信方案

| 选项 | 优劣 |
|------|------|
| A. 自建 Signal 系统 | 可在非 React 环境使用，但增加概念 |
| B. Zustand subscribe + React selector | 已有机制，简单直接 |
| C. 混合方案：主要用 Zustand，必要时补 Signal | ✅ 最务实，避免过度抽象 |

**决策**：C — 混合方案。Zustand subscribe 处理绝大多数场景，仅在跨 Store 通知时使用轻量 Signal。

### D6: 几何体子元素（顶点/棱线/面）是否为独立 Entity

| 选项 | 优劣 |
|------|------|
| A. 不是 Entity，通过 PointRef 联合类型 + SubSelection + labelOverrides/positionOverrides 间接管理 | 每个涉及"点"的功能需要双代码路径（vertex index vs entity ID），新功能开发持续付出额外成本 |
| B. **全部是 Entity**，通过 `builtIn` 属性区分几何体自带 vs 用户创建 | ✅ 统一交互模型：一套选中、属性面板、undo/redo、引用机制；PointRef 退化为纯 Entity ID；SubSelection 删除 |

**决策**：B — **几何体顶点、棱线、面全部创建为 Entity**（`builtIn=true`）。用 `builtIn` 属性区分来源，用统一的 Entity ID 引用。代价是几何体创建时同步创建 ~20-30 个子 Entity，但实体总量 ≤50，全量重算无压力。这个决策用一个属性换来了全局交互模型的统一。

### D7: contextMenu 状态存放位置

| 选项 | 优劣 |
|------|------|
| A. 全局 Store | 增加全局状态复杂度 |
| B. 组件局部 state | ✅ 右键菜单是纯 UI 状态，生命周期完全在组件内 |

**决策**：B — 组件局部状态。ContextMenu3D 自行管理 open/position/target，操作执行通过 Command 系统。

### D8: unfoldingEnabled / threeViewEnabled 归属

| 选项 | 优劣 |
|------|------|
| A. Entity 属性 | ❌ 不是场景数据，是 UI 偏好 |
| B. UI 局部状态 / 独立的 UIStore | ✅ 与场景数据解耦 |

**决策**：B — 放在一个轻量的 UIStore 或组件局部状态中，不污染 EntityStore。

### D9: 截面是否作为独立 EntityType

| 选项 | 优劣 |
|------|------|
| A. 独立 `crossSection` EntityType | 多一个实体类型，截面与面的渲染/选中/属性面板各自独立代码 |
| B. **合并到 `face` EntityType**，通过 `source` 字段区分来源 | ✅ 截面本质上就是一个面；统一渲染器和属性面板；减少实体类型数量；截面交点创建为显式 Point Entity，可被其他功能复用 |

**决策**：B — 截面合并为 Face 实体（`source.type='crossSection'`）。截面多边形的交点创建为显式 Point Entity（constraint.type='edge'），可被线段、外接圆等其他功能引用。删除截面时通过引用查询级联清理孤立交点。

### D10: 实体删除时子实体的处理策略

| 选项 | 优劣 |
|------|------|
| A. 始终级联删除所有子实体 | 简单但粗暴，可能误删被其他实体共享引用的子实体 |
| B. 始终保留所有子实体 | 导致孤立实体堆积 |
| C. **引用查询级联删除**：查询子实体是否被其他存活实体引用，无引用则删除，有引用则保留 | ✅ 精确控制，不多删不遗漏 |

**决策**：C — 引用查询级联删除。通过 `getReferencingEntities()` 在删除前查询引用关系，确保不误删共享子实体。

---

## 附录 A: 引用机制简化

V0.1 中使用 `PointRef` 联合类型引用点：

```typescript
// V0.1（已废弃）
type PointRef =
  | { type: 'vertex'; index: number }
  | { type: 'customPoint'; id: string };
```

V0.2 中统一为 Entity ID：

```typescript
// V0.2
type PointId = string;  // Point Entity 的 ID
```

所有引用点的地方（线段端点、外接圆选点、截面定义点、坐标系原点）都直接使用 Entity ID。

`resolvePointRef()` 改造为 `resolvePointPosition(pointId: string): Vec3 | null`，从 EntityStore 获取 Point Entity，根据 constraint 类型 + BuilderResult 计算位置。

## 附录 B: 初始化流程

应用启动时的编辑器初始化：

```
1. 创建 EntityStore / SelectionStore / HistoryStore / ToolStore
2. 注册所有 Tool（select, drawSegment, crossSection, coordSystem）
3. 注册所有 Renderer（各实体类型对应的渲染组件）
4. 注册所有 Inspector（各实体类型对应的属性面板组件）
5. 创建初始 Geometry Entity（type: 'cube', params: DEFAULT_PARAMS.cube）
6. 设置 activeGeometryId
7. buildGeometry() → BuilderResult
8. createBuiltInEntities()：创建 8 个 Point + 12 个 Segment + 6 个 Face
9. 激活 SelectTool 为默认工具
10. 绑定全局快捷键（Ctrl+Z, Ctrl+Y, Escape）
```

## 附录 C: 全局快捷键

| 快捷键 | 动作 |
|--------|------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `Escape` | 退回 SelectTool + 清除选中 |
| `Delete` / `Backspace` | 删除选中实体（仅 builtIn=false，V0.3 扩展） |
