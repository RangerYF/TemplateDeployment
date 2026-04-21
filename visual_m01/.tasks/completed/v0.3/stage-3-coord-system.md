# V0.3 阶段3：坐标系重构 + 坐标输入点

> **阶段目标**：重构坐标系交互流程（选面定轴 + 任意点建系），新增坐标输入点功能
> **前置条件**：阶段2.1（曲面体交互补全）已完成，面可被选中
> **BACKLOG 覆盖**：F01（坐标系重构）、F11（输入坐标显示新点）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划，8个阶段串行）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F01-F19 完整功能定义与优先级）

---

## 代码现状摘要

| 模块 | 现状 | 需要做什么 |
|------|------|-----------|
| `CoordinateSystemProperties` | 只有 `originPointId` + `geometryId`，无轴方向信息 | 新增轴方向字段 |
| `CoordinateSystem`（engine） | `{ originIndex, origin, axes, vertexCoords }`，用顶点索引定位原点 | 改为用 3D 坐标 + 用户指定轴方向 |
| `coordSystemTool.ts` | 单步交互：点击 Point → 创建/更新 → 退回 SelectTool。仅支持 vertex 点 | 多步骤重写：选原点 → 选面定 Z → 选方向定 X |
| `coordinates.ts` | `buildCoordinateSystem(type, result, originIndex)` 按几何体类型自动推断轴方向 | 改为接受用户指定的轴方向，保留自动推断作为默认值 |
| `CoordSystemRenderer.tsx` | 硬编码 `constraint.type !== 'vertex'` → return null；只渲染 vertex 坐标标签 | 支持任意点类型作原点；渲染用户指定轴方向 |
| `CoordSystemInspector.tsx` | 只显示原点标签 + 重选/删除按钮 | 增加坐标输入 UI（F11） |
| `usePointPosition.ts` | `case 'coordinate': return constraint.coords` 直接返回裸坐标值 | 改为 `origin + x·axisX + y·axisY + z·axisZ` 变换 |
| `ModeIndicator.tsx` | 静态 `Record<string, string>` 映射 toolId → 文案 | 支持多步骤动态文案 |

---

## 子任务清单（串行执行）

### T3.1 Entity 类型扩展 ⏱️ 0.5天

**目标**：扩展 `CoordinateSystemProperties` 和 engine `CoordinateSystem` 接口，为多步骤建系提供数据基础。

**现状分析**：

`src/editor/entities/types.ts:71-74`：
```ts
export interface CoordinateSystemProperties {
  originPointId: string;
  geometryId: string;
}
```

`src/engine/math/types.ts:34-42`：
```ts
export interface CoordinateSystem {
  originIndex: number;   // 顶点索引 → 需要改为更通用的原点标识
  origin: Vec3;
  axes: [Vec3, Vec3, Vec3]; // X, Y, Z
  vertexCoords: Vec3[];
}
```

**要做的事**：

1. `CoordinateSystemProperties` 新增字段：
   ```ts
   export interface CoordinateSystemProperties {
     originPointId: string;
     geometryId: string;
     /** 用户选定的 Z 轴面 Entity ID（法向 → Z 轴方向） */
     zFaceId?: string;
     /** 用户选定的 X 轴参考点 Entity ID（原点→该点方向投影到 Z⊥平面 → X 轴） */
     xRefPointId?: string;
     /** 最终计算出的轴方向（缓存，也用于 coordinate 约束点的位置计算） */
     axes?: [[number, number, number], [number, number, number], [number, number, number]];
   }
   ```
   - `zFaceId` + `xRefPointId` 记录用户的选择决策，支持 Undo/Redo 和重新计算
   - `axes` 存储最终计算结果，供 `usePointPosition` 的 coordinate 约束直接读取（避免每帧重算）
   - 所有新字段 optional，向后兼容现有坐标系

2. engine `CoordinateSystem` 接口调整（可选）：
   - `originIndex` 改为 optional（非 vertex 原点时不需要）
   - 或保持不变，在 Renderer 层适配

**涉及文件**：
- `src/editor/entities/types.ts` — `CoordinateSystemProperties` 扩展
- `src/engine/math/types.ts` — 可能微调 `CoordinateSystem` 接口

**验收**：
- [x]TypeScript 编译通过
- [x]现有坐标系功能不受影响（新字段均 optional）

---

### T3.2 CoordSystemTool 多步骤交互重写 ⏱️ 1天

**目标**：将坐标系工具从单步点击改为三步交互流程。

**现状分析**：

`src/editor/tools/coordSystemTool.ts`（65行）：
- `onPointerDown`：点击 Point Entity → 创建/更新 CoordinateSystem Entity → 切回 SelectTool
- 只接受 `event.hitEntityType === 'point'`
- 无内部状态管理

**交互流程设计**：

```
步骤1：选原点
  - 点击任意 Point Entity（vertex / edge / curve / face / free 均可）
  - ModeIndicator：「坐标系模式 — 点击选择原点」
  - 选中后进入步骤2

步骤2：选面定 Z 轴
  - 点击 Face Entity，该面的法向量确定 Z 轴方向
  - Z 轴方向：法向量朝上（确保 Z 分量 ≥ 0，否则取反）
  - ModeIndicator：「坐标系模式 — 点击选择一个面确定 Z 轴方向」
  - 选中后进入步骤3

步骤3：选方向定 X 轴
  - 点击一个 Point Entity（不能是原点自身）
  - X 轴 = 原点→该点方向 投影到 Z⊥平面，归一化
  - Y 轴 = Z × X（右手定则）
  - ModeIndicator：「坐标系模式 — 点击选择一个点确定 X 轴方向」
  - 选中后创建/更新 CoordinateSystem Entity，切回 SelectTool
```

**要做的事**：

1. 为 `coordSystemTool` 增加内部状态机：
   ```ts
   type CoordStep = 'selectOrigin' | 'selectZFace' | 'selectXDir';
   let currentStep: CoordStep = 'selectOrigin';
   let pendingOriginPointId: string | null = null;
   let pendingZFaceId: string | null = null;
   ```

2. `onPointerDown` 按 `currentStep` 分支处理：
   - `selectOrigin`：接受 point hit → 记录 originPointId → 步骤前进
   - `selectZFace`：接受 face hit → 记录 faceId → 步骤前进
   - `selectXDir`：接受 point hit（排除原点自身）→ 计算 axes → 创建/更新 Entity

3. `onKeyDown` 处理：
   - Escape：任何步骤 → 清除状态 → 切回 SelectTool

4. 在 `toolStore` 中增加工具步骤状态暴露（供 ModeIndicator 读取）：
   ```ts
   // toolStore 新增
   toolStepInfo: string | null;  // 当前工具步骤提示文案
   setToolStepInfo: (info: string | null) => void;
   ```

5. `ModeIndicator.tsx` 读取 `toolStepInfo`，优先显示步骤文案。

6. 轴方向计算辅助函数（可放在 coordSystemTool 或 coordinates.ts）：
   ```ts
   function computeAxesFromFaceAndRef(
     origin: Vec3,
     faceNormal: Vec3,    // → Z 轴
     refPoint: Vec3 | null // → X 轴参考
   ): [Vec3, Vec3, Vec3]
   ```

**涉及文件**：
- `src/editor/tools/coordSystemTool.ts` — 核心重写
- `src/editor/store/toolStore.ts` — 新增 `toolStepInfo` 状态
- `src/components/scene/ModeIndicator.tsx` — 读取步骤文案

**验收**：
- [x]三步流程完整可走通：选原点 → 选面 → 选方向 → 建系成功
- [x]Escape 任何步骤可退出
- [x]ModeIndicator 随步骤动态切换文案
- [x]已存在坐标系时，重新走流程更新坐标系（通过 UpdatePropertiesCommand）

---

### T3.3 coordinates.ts 重构 ⏱️ 0.5天

**目标**：坐标计算适配新的轴方向定义方式，支持任意点原点 + 用户指定轴方向。

**现状分析**：

`src/engine/math/coordinates.ts`（181行）：
- `buildCoordinateSystem(type, result, originIndex)` — 以顶点索引定位原点，按几何体类型自动推断轴方向
- 内部三个分支函数：`buildCuboidCoordinateSystem`、`buildPyramidCoordinateSystem`、`buildSurfaceCoordinateSystem`
- 返回 `CoordinateSystem { originIndex, origin, axes, vertexCoords }`

**要做的事**：

1. 新增主入口函数，接受用户指定的轴方向：
   ```ts
   export function buildCoordinateSystemFromAxes(
     origin: Vec3,
     axes: [Vec3, Vec3, Vec3],
     result: BuilderResult,
   ): CoordinateSystem
   ```
   - 计算各顶点/特征点在此坐标系下的坐标
   - 不依赖几何体类型，通用逻辑

2. 保留现有 `buildCoordinateSystem` 作为向后兼容/默认推断路径（但 CoordSystemRenderer 后续可能不再调用它）

3. 新增面法向量计算辅助函数（如果不放在 coordSystemTool 中）：
   ```ts
   export function computeFaceNormal(
     facePointPositions: Vec3[],
   ): Vec3
   ```

**涉及文件**：
- `src/engine/math/coordinates.ts` — 新增函数

**验收**：
- [x]`buildCoordinateSystemFromAxes` 对正方体顶点坐标计算正确
- [x]棱锥、圆柱等几何体的特征点坐标计算正确

---

### T3.4 CoordSystemRenderer 更新 ⏱️ 0.5天

**目标**：Renderer 适配新的 CoordinateSystemProperties，支持任意点原点和用户指定轴方向。

**现状分析**：

`src/components/scene/renderers/CoordSystemRenderer.tsx`（177行）：
- 第53行：`if (constraint.type !== 'vertex') return null;` — **硬编码只接受 vertex**
- 第54行：`buildCoordinateSystem(geometryType, result, constraint.vertexIndex)` — 用旧 API
- `vertexCoordData` 只遍历 vertex 类型的点

**要做的事**：

1. 移除 `constraint.type !== 'vertex'` 硬编码限制
2. 用 `computePointPosition` 获取原点 3D 位置（支持任意约束类型）
3. 从 `CoordinateSystemProperties.axes` 读取轴方向（如果有），否则走旧的自动推断作为 fallback
4. 调用新的 `buildCoordinateSystemFromAxes(origin, axes, result)` 计算坐标
5. `vertexCoordData` 扩展：不仅显示 vertex 点的坐标，也显示其他类型点（edge/curve/face/coordinate/free）的坐标标签
6. 确认轴方向缓存逻辑：axes 存储在 entity properties 中，Renderer 直接读取

**涉及文件**：
- `src/components/scene/renderers/CoordSystemRenderer.tsx` — 核心修改

**验收**：
- [x]以非顶点（如棱上点、面上点）为原点建系，Renderer 正确渲染三轴
- [x]轴方向与用户选择的面法向/X 方向一致
- [x]各顶点和非顶点的坐标标签正确显示
- [x]Z 轴默认朝上（视觉上竖直向上）

---

### T3.5 坐标输入点功能（F11）⏱️ 1天

**目标**：坐标系建立后，用户可在 Inspector 中输入 (x, y, z) 坐标创建新点。

**现状分析**：

`CoordSystemInspector.tsx`（58行）：只有原点标签 + 重选/删除按钮，无坐标输入 UI。

`usePointPosition.ts:85-86`：
```ts
case 'coordinate':
  return constraint.coords;  // 直接返回裸坐标值！
```
**问题**：`constraint.coords` 存储的是用户输入的坐标系下的局部坐标 `(x, y, z)`，但这里直接当作世界坐标返回。应该做变换：`worldPos = origin + x·axisX + y·axisY + z·axisZ`。

**要做的事**：

1. **CoordSystemInspector 增加坐标输入 UI**：
   - 三个数字输入框（x, y, z），默认值 0
   - "添加坐标点"按钮
   - 点击按钮 → 创建 Point Entity：
     ```ts
     new CreateEntityCommand('point', {
       builtIn: false,
       geometryId,
       constraint: {
         type: 'coordinate',
         coordSystemId: csEntity.id,
         coords: [x, y, z],
       },
       label: autoGenerateLabel(), // 自动分配下一个可用字母
     })
     ```
   - 输入框支持小数和负数
   - 已创建的坐标点列表显示（可选，如果时间允许）

2. **usePointPosition.ts 修复 coordinate 约束位置计算**：
   ```ts
   case 'coordinate': {
     const csEntity = useEntityStore.getState().getEntity(constraint.coordSystemId);
     if (!csEntity || csEntity.type !== 'coordinateSystem') return constraint.coords;
     const csProps = csEntity.properties as CoordinateSystemProperties;
     if (!csProps.axes) return constraint.coords; // fallback

     // 获取原点 3D 位置
     const originEntity = useEntityStore.getState().getEntity(csProps.originPointId);
     if (!originEntity || originEntity.type !== 'point') return constraint.coords;
     const originPos = computePointPosition(originEntity.properties as PointProperties, result);
     if (!originPos) return constraint.coords;

     const [ax, ay, az] = csProps.axes;
     const [cx, cy, cz] = constraint.coords;
     return [
       originPos[0] + cx * ax[0] + cy * ay[0] + cz * az[0],
       originPos[1] + cx * ax[1] + cy * ay[1] + cz * az[1],
       originPos[2] + cx * ax[2] + cy * ay[2] + cz * az[2],
     ];
   }
   ```

3. **自动标签生成**：
   - 检查现有 point entity 的 label 集合，找到下一个可用字母（如 P₁, P₂, ...）
   - 或沿用现有的标签命名规则

4. **验证坐标点功能完整性**：
   - 坐标点可被选中、可 hover
   - 坐标点可作为画线端点
   - 坐标点可参与截面定义
   - 坐标点可参与外接圆
   - 切换几何体时坐标点随坐标系一起被清理

**涉及文件**：
- `src/components/panels/inspectors/CoordSystemInspector.tsx` — 坐标输入 UI
- `src/components/scene/renderers/usePointPosition.ts` — coordinate 约束位置变换
- `src/editor/store/entityStore.ts` — 可能需要辅助方法（如自动标签生成）

**验收**：
- [x]建系后左侧面板坐标系区域显示坐标输入框
- [x]输入 (1, 0, 0) → 3D 场景中在原点沿 X 轴方向 1 个单位处显示点
- [x]输入 (0, 0, 1) → 点出现在 Z 轴方向 1 个单位处（竖直向上）
- [x]坐标点显示标签和坐标值
- [x]坐标点可被选中、可画线、可参与截面
- [x]坐标点支持 Undo/Redo
- [x]切换几何体后坐标点被正确清理

---

## 决策记录

| 编号 | 决策项 | 状态 | 说明 |
|------|--------|------|------|
| D3.1 | 轴方向存储方式 | ✅ 已确认 | 存在 `CoordinateSystemProperties.axes` 中，创建/更新时计算一次 |
| D3.2 | Z 轴方向确定规则 | ✅ 已确认 | 面法向量，确保 Y 分量 ≥ 0（朝上），否则取反 |
| D3.3 | 默认轴方向（跳过选面/选方向时） | ✅ 已确认 | Z=[0,1,0]（竖直向上），X 自动推断 |
| D3.4 | 坐标输入点标签规则 | ✅ 已确认 | 采用 P₁/P₂/P₃... 序列 |

---

## 涉及文件预估

| 文件 | T3.1 | T3.2 | T3.3 | T3.4 | T3.5 |
|------|------|------|------|------|------|
| `src/editor/entities/types.ts` | ✏️ | — | — | — | — |
| `src/engine/math/types.ts` | ✏️ | — | — | — | — |
| `src/editor/tools/coordSystemTool.ts` | — | ✏️ | — | — | — |
| `src/editor/store/toolStore.ts` | — | ✏️ | — | — | — |
| `src/components/scene/ModeIndicator.tsx` | — | ✏️ | — | — | — |
| `src/engine/math/coordinates.ts` | — | — | ✏️ | — | — |
| `src/components/scene/renderers/CoordSystemRenderer.tsx` | — | — | — | ✏️ | — |
| `src/components/panels/inspectors/CoordSystemInspector.tsx` | — | — | — | — | ✏️ |
| `src/components/scene/renderers/usePointPosition.ts` | — | — | — | — | ✏️ |

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/` 变更 → 执行最小回归门禁（CLAUDE.md 附录F）。

---

## 风险与注意事项

1. **T3.2 状态机复杂度**：三步交互需要处理多种退出路径（Escape、工具切换、点击空白处）。建议每次步骤切换时选中当前已选的实体（视觉反馈），并在退出时彻底清理中间状态。
2. **T3.4 非 vertex 原点兼容**：现有 `buildCoordinateSystem` 依赖 `originIndex`（顶点索引），非 vertex 原点需要完全不同的调用路径。Renderer 需要根据 `csProps.axes` 是否存在来选择新旧路径。
3. **T3.5 coordinate 约束递归依赖**：`usePointPosition` 计算 coordinate 类型点的位置时需要读取坐标系 Entity 的 axes 和原点位置。如果原点本身也是 coordinate 类型（理论上不应该，但需要防御），可能产生循环依赖。建议在创建坐标点时校验原点不能是 coordinate 类型。
4. **axes 缓存一致性**：axes 存在 entity properties 中，如果用户移动了原点或参考点，axes 不会自动更新。当前设计中原点和参考点都是不可移动的（vertex/edge/curve/face 约束的位置由几何体参数决定），所以 axes 在几何体参数变化时不需要重算。但如果未来支持自由点移动，需要引入 axes 重算逻辑。
5. **性能**：坐标输入点的位置计算依赖坐标系 entity 的 axes，每次渲染时会读取 entityStore。由于坐标点数量预期很少（≤10），性能不是瓶颈。

---

*创建时间：2026-03-10*
*状态：✅ 已完成（2026-03-10）*
