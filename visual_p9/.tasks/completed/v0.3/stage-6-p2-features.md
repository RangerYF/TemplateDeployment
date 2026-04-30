# V0.3 阶段6：P2 功能扩展 — 侧棱长参数 + 截面切割 + 距离度量

> **阶段目标**：完成 P2 优先级的三项功能扩展，提升产品在高考立体几何解题场景中的完整度
> **前置条件**：阶段5（角度度量）已完成，面交互 / 截面 / Entity 框架成熟可复用
> **BACKLOG 覆盖**：F17（侧棱长参数）、F18（实体列表面板，原截面切割可视化已调整）、F19（距离度量）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F17/F18/F19 完整定义）
> - 角度度量参考：`.tasks/active/v0.3/stage-5-angle-measurement.md`（F19 对标参考）

---

## 代码现状摘要

| 模块 | 现状 | 需要做什么 |
|------|------|-----------|
| `PyramidParams` | `{ sides, sideLength, height }` 三参数 | 新增 `lateralEdgeLength` 可选参数 + 模式切换 |
| `ParameterPanel` | `PARAM_FIELDS` 静态配置，支持滑块/数字输入 | 棱锥参数增加"高⇄侧棱长"模式切换 UI |
| Entity 管理 | entityStore 管理所有实体，Entity 有 `visible` 字段 | 新增 `locked` 字段 + 左侧实体列表面板 |
| 布局 | AppLayout = Scene3D + 可选中间列 + RightPanel | 新增左侧 EntityListPanel |
| `EntityType` | 8 种（含 angleMeasurement） | 新增 `'distanceMeasurement'` |
| Tool 系统 | 6 个工具（含 angle） | 新增 `distanceTool` |
| `angleCalculator` | 角度计算 + 精确值 + 弧线可视化 | 距离度量对标同模式，新建 `distanceCalculator` |

---

## 子任务清单（可并行执行 T6.1/T6.2，T6.3 依赖 T6.2 完成后集成验证——距离度量实体需在列表中展示）

### T6.1 棱锥侧棱长参数 ⏱️ 0.5天

**目标**：棱锥参数面板支持"高"和"侧棱长"两种定义模式切换，自动换算。

**数学关系**：
```
R = sideLength / (2 × sin(π/n))     // 底面外接圆半径
lateralEdgeLength = √(height² + R²)  // 高 → 侧棱长
height = √(lateralEdgeLength² - R²)  // 侧棱长 → 高（需 lateralEdgeLength > R）
```

**要做的事**：

1. **`src/types/geometry.ts`** — 扩展 PyramidParams：
   ```ts
   export interface PyramidParams {
     sides: number;
     sideLength: number;
     height: number;
     /** 侧棱长（可选，与 height 互斥输入） */
     lateralEdgeLength?: number;
     /** 当前参数模式 */
     paramMode?: 'height' | 'lateralEdge';
   }
   ```

2. **`src/components/panels/ParameterPanel.tsx`** — 参数面板改动：
   - 棱锥类型检测：当 `geometryType === 'pyramid'` 时渲染模式切换按钮
   - 模式切换 UI：两个按钮组 `[高度] [侧棱长]`，高亮当前模式
   - 模式A（默认）：显示 `height` 滑块
   - 模式B：显示 `lateralEdgeLength` 滑块（min = R + 0.01，max 合理上限）
   - 切换时自动换算：A→B 计算 `lateralEdgeLength = √(h² + R²)`，B→A 计算 `height = √(l² - R²)`
   - 调整侧棱长时实时换算 height，调用现有的 `updateProperties` 更新

3. **`src/engine/builders/pyramid.ts`** — Builder 入口兼容：
   - 如果 `paramMode === 'lateralEdge'` 且提供了 `lateralEdgeLength`，先换算为 height
   - Builder 内部逻辑不变，始终基于 height 计算

4. **`src/components/panels/inspectors/GeometryInspector.tsx`** — PARAM_LABELS 新增：
   ```ts
   lateralEdgeLength: '侧棱长',
   ```

**约束校验**：
- 侧棱长必须 > R（底面外接圆半径），否则无法形成有效棱锥
- 切换底面边数 `sides` 或边长 `sideLength` 时，R 变化，需重新校验侧棱长合法性
- 不合法时自动调整为最小合法值 R + 0.01

**涉及文件**：
- `src/types/geometry.ts` — PyramidParams 扩展
- `src/components/panels/ParameterPanel.tsx` — 模式切换 UI + 换算逻辑
- `src/engine/builders/pyramid.ts` — 兼容侧棱长输入
- `src/components/panels/inspectors/GeometryInspector.tsx` — 标签

**验收**：
- [ ] 棱锥参数面板出现 [高度] [侧棱长] 模式切换
- [ ] 切换到侧棱长模式后，滑块控制侧棱长，height 自动换算
- [ ] 切换回高度模式后，height 滑块恢复，值保持一致
- [ ] 修改底面边数后侧棱长约束更新正确
- [ ] 侧棱长 < R 时自动修正
- [ ] TypeScript 编译通过

---

### T6.2 实体列表面板（Entity List Panel） ⏱️ 1.5天

**目标**：在编辑器左侧新增实体列表面板，按类型分组展示所有实体，支持选中、隐藏、锁定操作。完善编辑器的实体管理能力，同时解决"面隐藏后无法恢复"的问题。

> **设计变更说明**：原 T6.2 为"截面切割可视化"（Inspector radio 控制面隐藏）。经讨论，截面创建时已自动拆分面，用户可直接选中拆分面后 Delete 删除，无需独立切割工具。面的隐藏/恢复通过实体列表面板统一管理更合理。

**交互设计**：
```
左侧面板（可折叠/展开）：
┌─────────────────────┐
│ ▼ 点 (8)            │
│   A  B  C  D        │  ← 点击选中；hover 出现 👁🔒
│   A' B' C' D'       │
│ ▼ 线段 (12)         │
│   AB  BC  CD  DA    │
│   AA' BB' CC' DD'   │
│   A'B' B'C' C'D' D'A' │
│ ▼ 面 (6)            │
│   ABCD  A'B'C'D'    │
│   ABB'A' BCC'B'     │
│   CDD'C' DAA'D'     │
│ ▼ 截面 (1)          │
│   截面1              │
│ ▼ 角度度量 (2)       │
│   ∠ABC  ∠A'BC       │
└─────────────────────┘
```

**核心功能**：
1. **分组展示**：按实体类型分组（点、线段、面、截面、坐标系、外接球/圆、角度度量），每组可折叠
2. **点击选中**：点击实体名 → 在 3D 场景中选中该实体（调用 selectionStore.select）
3. **隐藏切换**：hover 时出现眼睛图标 👁，点击 toggle `visible` 属性；已隐藏的实体在列表中显示为灰色/半透明
4. **锁定切换**：hover 时出现锁图标 🔒，点击 toggle `locked` 属性；已锁定的实体在 3D 场景中不可被鼠标选中/拖拽，但仍然可见
5. **显示名称**：
   - Point：使用 `label` 属性（如 A、B、C）
   - Segment：使用两端点的 label 拼接（如 AB、A'B'）
   - Face：使用所有顶点 label 拼接（如 ABCD、ABB'A'）；截面面显示为"截面N"
   - AngleMeasurement：使用角度标签
   - 其他：使用类型名 + 序号

**技术方案**：

1. **`src/editor/entities/types.ts`** — Entity 接口扩展：
   ```ts
   interface Entity<T extends EntityType = EntityType> {
     id: string;
     type: T;
     properties: EntityPropertiesMap[T];
     visible: boolean;    // 已有，控制渲染可见性
     locked?: boolean;    // 新增，控制场景中的可交互性
   }
   ```

2. **`src/editor/store/entityStore.ts`** — 新增方法：
   ```ts
   toggleVisible(id: string): void;   // 切换 visible
   toggleLocked(id: string): void;    // 切换 locked
   ```

3. **`src/components/panels/EntityListPanel.tsx`** — 新建，实体列表面板：
   - 从 entityStore 订阅 entities，按 type 分组
   - 仅显示当前活跃几何体（activeGeometryId）的关联实体
   - 每个分组使用 PanelSection 组件（可折叠）
   - 每行：实体名 + hover 时显示的隐藏/锁定图标按钮
   - 选中高亮：当前 selectedIds 中的实体高亮显示
   - 已隐藏实体：灰色文字 + 删除线样式
   - 已锁定实体：锁图标常驻显示

4. **`src/components/layout/AppLayout.tsx`** — 布局调整：
   - 在 Scene3D 左侧添加 EntityListPanel
   - 面板可折叠（点击边缘 toggle），默认展开
   - 宽度约 200px，不影响 3D 场景响应式

5. **场景交互适配**：
   - 各 Renderer 的 pointer 事件处理中检查 `locked` 状态，locked 实体跳过 hit-test
   - `src/editor/tools/` 中的选择逻辑检查 locked 状态

**实体显示名称生成逻辑**：
```ts
function getEntityDisplayName(entity: Entity, store: EntityStore): string {
  switch (entity.type) {
    case 'point':
      return entity.properties.label || `点${entity.id}`;
    case 'segment': {
      const start = store.getEntity(entity.properties.startPointId);
      const end = store.getEntity(entity.properties.endPointId);
      const startLabel = start?.properties?.label || '?';
      const endLabel = end?.properties?.label || '?';
      return `${startLabel}${endLabel}`;
    }
    case 'face': {
      if (entity.properties.source?.type === 'crossSection') {
        return `截面`;  // 后续可加序号
      }
      const labels = entity.properties.pointIds
        .map(pid => store.getEntity(pid)?.properties?.label || '?')
        .join('');
      return labels;
    }
    case 'angleMeasurement':
      return entity.properties.angleLatex || `角度${entity.id}`;
    case 'coordinateSystem':
      return '坐标系';
    case 'circumSphere':
      return '外接球';
    case 'circumCircle':
      return '外接圆';
    default:
      return `${entity.type}#${entity.id}`;
  }
}
```

**涉及文件**：
- `src/editor/entities/types.ts` — Entity 接口新增 `locked` 字段
- `src/editor/store/entityStore.ts` — toggleVisible / toggleLocked 方法
- `src/components/panels/EntityListPanel.tsx` — 🆕 新建实体列表面板
- `src/components/layout/AppLayout.tsx` — 布局调整，加入左侧面板
- `src/components/scene/renderers/PointEntityRenderer.tsx` — locked 检查
- `src/components/scene/renderers/SegmentEntityRenderer.tsx` — locked 检查
- `src/components/scene/renderers/FaceEntityRenderer.tsx` — locked 检查

**验收**：
- [ ] 左侧出现实体列表面板，按类型分组
- [ ] 点击实体名在 3D 场景中选中对应实体
- [ ] hover 出现隐藏/锁定图标按钮
- [ ] 点击隐藏按钮后实体从 3D 场景消失，列表中显示为灰色
- [ ] 再次点击隐藏按钮恢复可见
- [ ] 点击锁定按钮后实体在场景中不可被鼠标选中
- [ ] 再次点击锁定按钮恢复可交互
- [ ] 面板可折叠/展开
- [ ] 切换几何体后列表更新
- [ ] TypeScript 编译通过

---

### T6.3 距离度量 ⏱️ 2天

**目标**：实现点到面距离和异面直线距离的度量，输出精确值并在 3D 场景中可视化垂线段/公垂线。

**距离度量的两种类型**：

#### 1. 点到面距离（Point-Face Distance）

**数学定义**：点 P 到平面的垂直距离。

**交互输入**：先选一个点（Point Entity），再选一个面（Face Entity）

**计算方法**：
```
n = 面的单位法向量
P₀ = 面上任一点
d = |dot(P - P₀, n)|
垂足 F = P - dot(P - P₀, n) × n
```

**可视化**：从点 P 到垂足 F 画虚线段 + 直角标记 + 距离标签

#### 2. 异面直线距离（Line-Line Distance / Skew Lines）

**数学定义**：两条异面直线的公垂线段长度。

**交互输入**：选择两条线段（Segment Entity）

**计算方法**：
```
d₁ = 线段1方向向量，d₂ = 线段2方向向量
n = cross(d₁, d₂)       // 公垂线方向
|n| = 0 时为平行线，公垂线退化
distance = |dot(P₁ - P₂, n)| / |n|

公垂线端点（参数求解）：
线1: P₁ + t₁ × d₁
线2: P₂ + t₂ × d₂
解方程组求 t₁, t₂ → 两个最近点
```

**可视化**：公垂线段（虚线）+ 两端直角标记 + 距离标签

---

**交互设计**（对标 AngleTool 两步交互）：

```
进入距离工具后：
1. 点击一个点 → 进入"选第二个元素"状态：
   a. 点击一个面 → 点到面距离
2. 点击一条线段 → 进入"选第二个元素"状态：
   a. 点击另一条线段 → 线到线距离（异面直线）
```

**状态机**：
```
idle → [点击 point] → waitSecond(firstType='point')
idle → [点击 segment] → waitSecond(firstType='segment')
waitSecond(point) → [点击 face] → 创建点面距离 → idle
waitSecond(segment) → [点击 segment] → 创建线线距离 → idle
waitSecond → [Escape] → idle
```

**ModeIndicator 步骤提示**：
- idle: `「距离度量 — 选择点或线段」`
- waitSecond(point): `「距离度量 — 点击面测量点面距离」`
- waitSecond(segment): `「距离度量 — 点击另一条线段测量异面直线距离」`

---

**要做的事**：

1. **`src/editor/entities/types.ts`** — 新增类型：
   ```ts
   // EntityType 新增
   | 'distanceMeasurement'

   export type DistanceMeasurementKind = 'pointFace' | 'lineLine';

   export interface DistanceMeasurementProperties {
     geometryId: string;
     kind: DistanceMeasurementKind;
     entityIds: string[];
     // pointFace: [pointId, faceId]
     // lineLine: [segmentId1, segmentId2]
     distanceValue: number;
     distanceLatex: string;
     distanceApprox: string;  // 近似值字符串（如 "≈ 2.83"）
   }
   ```

2. **`src/engine/math/distanceCalculator.ts`** — 新建，距离计算引擎：
   ```ts
   export interface DistanceResult {
     value: number;
     latex: string;
     approxStr: string;
   }

   export function calculatePointFaceDistance(
     point: Vec3, facePoints: Vec3[]
   ): DistanceResult;

   export function calculateLineLineDistance(
     line1Start: Vec3, line1End: Vec3,
     line2Start: Vec3, line2End: Vec3,
   ): DistanceResult;

   // 可视化数据
   export interface PointFaceVisData {
     point: Vec3;         // 垂线起点
     foot: Vec3;          // 垂足（面上投影点）
     distance: number;
   }

   export interface LineLineVisData {
     point1: Vec3;        // 公垂线在线1上的端点
     point2: Vec3;        // 公垂线在线2上的端点
     distance: number;
   }

   export function getPointFaceVisData(point: Vec3, facePoints: Vec3[]): PointFaceVisData;
   export function getLineLineVisData(
     line1Start: Vec3, line1End: Vec3,
     line2Start: Vec3, line2End: Vec3
   ): LineLineVisData;
   ```

3. **精确值识别逻辑**（类比 angleCalculator 的 KNOWN_ANGLES）：
   ```ts
   // 常见精确距离值（基于几何体参数的常见倍数）
   // 距离通常是参数的线性组合，精确值更多是 √n 形式
   // 策略：检测 value² 是否为简单有理数/分数，若是则输出 √ 形式
   function matchExactDistance(value: number): string | null {
     const v2 = value * value;
     // 检查是否为整数
     if (Math.abs(v2 - Math.round(v2)) < 1e-8) {
       const n = Math.round(v2);
       if (n === 0) return '0';
       const sqrtN = Math.sqrt(n);
       if (Math.abs(sqrtN - Math.round(sqrtN)) < 1e-8) return String(Math.round(sqrtN));
       return `\\sqrt{${n}}`;
     }
     // 检查简单分数 p/q（q ≤ 12）
     for (let q = 2; q <= 12; q++) {
       const p = Math.round(v2 * q);
       if (Math.abs(v2 - p / q) < 1e-8) {
         return `\\dfrac{\\sqrt{${p}}}{\\sqrt{${q}}}`;
         // 或化简后输出
       }
     }
     return null;
   }
   ```

4. **`src/editor/tools/distanceTool.ts`** — 新建，距离度量工具：
   - Tool 接口实现（id: 'distance'）
   - 两步交互状态机
   - `onActivate` / `onDeactivate` 清理状态
   - `onPointerDown` 分支处理
   - `onKeyDown` 处理 Escape / Backspace

5. **`src/editor/tools/index.ts`** — registerAllTools 新增 distanceTool

6. **`src/components/scene/ToolBar.tsx`** — TOOLS 数组新增距离按钮：
   ```ts
   { id: 'distance', label: '距离', Icon: Ruler }  // lucide-react Ruler 图标
   ```

7. **`src/components/scene/renderers/DistanceMeasurementRenderer.tsx`** — 新建：
   - 根据 `kind` 渲染不同类型的距离可视化
   - `PointFaceDistanceVis`：虚线垂线段 + 垂足处直角标记 + 距离标签
   - `LineLineDistanceVis`：虚线公垂线段 + 两端直角标记 + 距离标签
   - 虚线实现：`<Line dashed dashSize={0.05} gapSize={0.05} />`
   - 直角标记：小正方形/L形，表示 90° 关系
   - 距离标签：`@react-three/drei` 的 `Html` 组件
   - TubeGeometry 命中体积（对标 AngleMeasurementRenderer）
   - 注册：`registerRenderer('distanceMeasurement', DistanceMeasurementRenderer)`

8. **`src/components/panels/inspectors/DistanceMeasurementInspector.tsx`** — 新建：
   - 显示距离类型（点到面 / 异面直线）
   - 显示精确值（LaTeX 渲染）
   - 显示近似值
   - 显示关联元素标签
   - 删除按钮
   - 注册：`registerInspector('distanceMeasurement', DistanceMeasurementInspector)`

9. **`src/editor/store/entityStore.ts`** — 确认 distanceMeasurement 的 collectChildIds / entityReferences 覆盖

**涉及文件**：
- `src/editor/entities/types.ts` — Entity 类型扩展
- `src/engine/math/distanceCalculator.ts` — 新建
- `src/editor/tools/distanceTool.ts` — 新建
- `src/editor/tools/index.ts` — 注册
- `src/components/scene/ToolBar.tsx` — 按钮
- `src/components/scene/renderers/DistanceMeasurementRenderer.tsx` — 新建
- `src/components/panels/inspectors/DistanceMeasurementInspector.tsx` — 新建
- `src/components/panels/inspectors/index.ts` — side-effect import
- `src/components/scene/Scene3D.tsx` — side-effect import
- `src/editor/store/entityStore.ts` — collectChildIds 支持

**验收**：
- [ ] 工具栏出现距离度量按钮
- [ ] 选择一个点 + 一个面 → 计算并显示点面距离
- [ ] 选择两条线段 → 计算并显示异面直线距离
- [ ] 平行线段给出距离 = 两线间距（退化处理）
- [ ] 3D 场景显示虚线垂线段/公垂线 + 距离标签
- [ ] 选中距离实体后右侧面板显示详情
- [ ] 精确值正确（正方体顶点到对面距离 = 边长）
- [ ] 支持 Undo/Redo
- [ ] 切换几何体后距离度量被清理
- [ ] Escape 可退出工具
- [ ] ModeIndicator 正确显示步骤提示
- [ ] TypeScript 编译通过

---

## 涉及文件预估

| 文件 | T6.1 | T6.2 | T6.3 |
|------|------|------|------|
| `src/types/geometry.ts` | ✏️ | — | — |
| `src/engine/builders/pyramid.ts` | ✏️ | — | — |
| `src/components/panels/ParameterPanel.tsx` | ✏️ | — | — |
| `src/components/panels/inspectors/GeometryInspector.tsx` | ✏️ | — | — |
| `src/editor/entities/types.ts` | — | ✏️ | ✏️ |
| `src/editor/store/entityStore.ts` | — | ✏️ | ✏️ |
| `src/components/panels/EntityListPanel.tsx` | — | 🆕 | — |
| `src/components/layout/AppLayout.tsx` | — | ✏️ | — |
| `src/components/scene/renderers/PointEntityRenderer.tsx` | — | ✏️ | — |
| `src/components/scene/renderers/SegmentEntityRenderer.tsx` | — | ✏️ | — |
| `src/components/scene/renderers/FaceEntityRenderer.tsx` | — | ✏️ | — |
| `src/engine/math/distanceCalculator.ts` | — | — | 🆕 |
| `src/editor/tools/distanceTool.ts` | — | — | 🆕 |
| `src/components/scene/renderers/DistanceMeasurementRenderer.tsx` | — | — | 🆕 |
| `src/components/panels/inspectors/DistanceMeasurementInspector.tsx` | — | — | 🆕 |
| `src/editor/tools/index.ts` | — | — | ✏️ |
| `src/components/scene/ToolBar.tsx` | — | — | ✏️ |
| `src/components/scene/Scene3D.tsx` | — | — | ✏️ |
| `src/components/panels/inspectors/index.ts` | — | — | ✏️ |

**新建文件**：5（EntityListPanel + distanceCalculator + distanceTool + DistanceMeasurementRenderer + DistanceMeasurementInspector）
**修改文件**：约 14 个

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/engine/` 数学计算 → 追加手算验证（附录F）：
- 正方体(a=2)：顶点到对面距离 = 2
- 正方体(a=2)：对棱距离 = √2 × a / √2 = 2（相邻面对角线异面距离）
- 正四面体(a=2)：顶点到对面距离 = a × √(2/3) = 2√6/3

---

## 风险与注意事项

1. **T6.1 参数模式切换**：切换 `sides` 或 `sideLength` 时 R 变化，侧棱长可能变得无效（< R）。需要在 `sideLength`/`sides` 变更的回调中重新校验 lateralEdgeLength。实现建议：始终内部用 height 为主参数，侧棱长仅作为 UI 输入层的转换。

2. **T6.2 实体列表面板布局**：左侧面板新增会压缩 3D 场景区域。需确保面板可折叠，且不影响响应式布局。建议面板宽度 200px 左右，可通过点击边缘或按钮折叠。

3. **T6.2 locked 状态传递**：locked 属性需要在所有 hit-test 路径中检查（Renderer pointer 事件、Tool 选择逻辑）。遗漏会导致锁定失效。需逐一排查所有可交互入口。

4. **T6.3 公垂线端点可能在线段延长线上**：两条线段的最近点可能不在线段范围内（在延长线上）。需要 clamp 到线段范围，此时公垂线可能不垂直于两条线段。建议：若最近点不在线段上，允许延长并标注提示。

5. **T6.3 平行线段**：`cross(d1, d2)` = 0 时为平行线，距离退化为点到线的距离。需要特殊处理：取其中一条线段端点到另一条线段的垂直距离。

6. **T6.3 距离精确值匹配**：距离的精确值形式比角度更多样（n√m / k 形式），匹配策略需要覆盖常见的 √2, √3, √6, 2√3/3 等表达式。

---

*创建时间：2026-03-11*
*完成时间：2026-03-11*
*状态：✅ 已完成*

---

## 实际实现变更记录

### T6.1 变更
- **原计划**：高度/侧棱长模式切换按钮
- **实际实现**：同时显示两个字段，联动同步，"↕ 高度与侧棱长联动"视觉标记，绿色边框

### T6.2 变更
- **新增**：搜索功能（按显示名过滤）
- **新增**：所有8种分类始终显示，空分类显示"暂无xx"
- **新增**：距离度量实体可读名称（如 `A → 面DCBA`、`线AB → 线CD`）
- **locked 实现**：集中在 `ToolEventDispatcher.findTargetHit` 过滤，而非各 Renderer 分散检查

### T6.3 变更
- **原计划**：2种距离（点面 + 线线）
- **实际实现**：5种距离（点点 + 点线 + 点面 + 线线 + 线面）
- **线面距离**：需平行约束，不平行时提示"线段与面不平行，无法测量线面距离"
- **精确值**：√n 简化、a√b 化简、分数有理化（√(p/q) → √(pq)/q）、GCD 约分

### 涉及文件（实际）
| 文件 | 操作 |
|------|------|
| `src/types/geometry.ts` | ✏️ PyramidParams 扩展 |
| `src/engine/builders/pyramid.ts` | ✏️ lateralEdge→height 转换 |
| `src/components/panels/ParameterPanel.tsx` | ✏️ 联动同步 UI |
| `src/components/panels/inspectors/GeometryInspector.tsx` | ✏️ PARAM_LABELS + 过滤非数值 |
| `src/editor/entities/types.ts` | ✏️ locked + distanceMeasurement（5种kind） |
| `src/editor/store/entityStore.ts` | ✏️ toggleVisible/toggleLocked |
| `src/components/panels/EntityListPanel.tsx` | 🆕 实体列表面板（搜索+分组+可读名称） |
| `src/components/layout/AppLayout.tsx` | ✏️ 左侧面板布局 |
| `src/components/scene/ToolEventDispatcher.tsx` | ✏️ locked 过滤 |
| `src/engine/math/distanceCalculator.ts` | 🆕 5种距离计算+可视化数据 |
| `src/editor/tools/distanceTool.ts` | 🆕 5种交互分支 |
| `src/editor/tools/index.ts` | ✏️ 注册 distanceTool |
| `src/components/scene/ToolBar.tsx` | ✏️ 距离按钮 |
| `src/components/scene/renderers/DistanceMeasurementRenderer.tsx` | 🆕 5种可视化 |
| `src/components/panels/inspectors/DistanceMeasurementInspector.tsx` | 🆕 5种类型面板 |
| `src/components/panels/inspectors/index.ts` | ✏️ side-effect import |
| `src/components/scene/Scene3D.tsx` | ✏️ side-effect import + TYPE_ORDER |
