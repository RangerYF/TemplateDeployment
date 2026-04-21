# 阶段5：悬挂体系

> 任务ID：03-19-18-00-P01-stage5-suspension
> 风险等级：L1（常规风险，全部在力学域内新增代码，无公共代码修改）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**✅ 已完成（2026-03-19）**

## 目标

新增 `pivot`、`rope`、`rod` 三种实体及渲染器，实现 4 个悬挂场景预设（单绳竖直、双绳对称、双绳不对称、绳+杆混合），覆盖高中受力分析中的悬挂类典型题型。

## 前置依赖（阶段1~4产出）

- ✅ block 实体 + block-renderer（含旋转支持）
- ✅ force-viewport + 标签防重叠 + 正交分解动画
- ✅ motion-viewport + v-t / x-t 图表
- ✅ 交互系统（实体选中、力箭头浮动菜单、drawOutline 注册）
- ✅ `connection` RelationType 在类型系统中已定义
- ✅ `connector` EntityCategory 已定义
- ✅ `constraint` EntityCategory 已定义
- ✅ `tension` ForceType 已定义（颜色 #27AE60 绿色）

## 公共代码影响评估

**本阶段预计不需要修改公共代码**：
- 三种新实体类型、渲染器、求解器全部在 `src/domains/mechanics/` 内
- `EntityCategory` 已有 `connector` 和 `constraint`，无需追加
- `ForceType` 已有 `tension`，无需追加
- `RelationType` 为 string 类型，`connection` 无需注册
- `drawOutline` 已有注册机制，新实体直接提供即可

## 子任务清单（串行）

---

### 子任务5.1：注册 `pivot` 实体类型

**文件**：`src/domains/mechanics/entities/pivot.ts`（新增）

**实体定义**：
| 字段 | 值 | 说明 |
|------|------|------|
| type | `'pivot'` | 固定悬挂点 |
| category | `'constraint'` | 约束源 |
| label | `'固定点'` | 默认标签 |

**defaultProperties**：
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `radius` | number | 0.05 | 绘制半径（m），纯视觉用 |

**渲染（可内联或独立文件）**：
- 实心圆点（深灰 `#2D3748`，屏幕半径 6px）
- 上方三角形固定标记（教材风格，3 条短斜线向上发散）

**hitTest**：
- 使用 `pointInCircle(point, position, radius + 0.1)`

**drawOutline**：
- 以 position 为圆心，屏幕半径 10px 的圆

**坐标约定**：
- `transform.position` = 悬挂点位置（物理坐标）
- pivot 是固定不动的，求解器不更新其位置

---

### 子任务5.2：注册 `rope` 实体类型 + 渲染器

**文件**：
- `src/domains/mechanics/entities/rope.ts`（新增）
- `src/domains/mechanics/renderers/rope-renderer.ts`（新增）

**实体定义**：
| 字段 | 值 |
|------|------|
| type | `'rope'` |
| category | `'connector'` |
| label | `'轻绳'` |

**defaultProperties**：
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `length` | number | 1.0 | 绳长（m） |

**渲染**：
- 直线段，从一端到另一端
- 颜色：`#4A5568`（深灰，与 surface 一致）
- 线宽：1.5px
- 样式：实线
- **端点位置**：渲染器需要知道绳的两端坐标。方案：
  - 方案A：渲染器从关系中查找 source/target 实体的位置
  - 方案B：求解器通过 MotionState 设置绳实体的端点
  - **推荐方案B**：求解器计算绳的端点并写入 MotionState，渲染器从 entity transform + 额外属性中读取。但 rope 本身无 MotionState...
  - **最终方案**：渲染器接收 `(entity, result, ctx)` 参数，从 result 或 scene 中查找关联实体的位置。具体：
    1. rope 实体不记录端点——端点由关联的 pivot 和 block 的位置决定
    2. 渲染器通过 `ctx` 中的实体列表（需要从 render-loop 获取）找到关联实体
    3. **简化方案**：rope 的 `properties` 中存 `startRef` 和 `endRef`（预设中的 ref），但运行时这些 ref 已被替换为 entityId。渲染器通过 `properties.startEntityId` 和 `endEntityId` 找到关联实体位置

> **关键设计决策**：rope/rod 渲染器如何获取两端实体的位置？
>
> 当前 `EntityRenderer` 签名：`(entity: Entity, result: PhysicsResult | null, ctx: RenderContext) => void`
>
> `ctx` 中无法直接访问其他实体。但 render-loop 中 `entities` Map 可通过闭包或 ctx 扩展传入。
>
> **方案**：在预设加载时，将 rope 的 `properties` 中写入 `startEntityId` 和 `endEntityId`（替换 ref 为实际 entityId）。渲染器从 `result.motionStates` 获取关联实体的实时位置。如果 result 为 null（未开始模拟），从 `entity.properties` 中的默认端点坐标渲染。
>
> **更简洁的方案**：rope/rod 的 `properties` 存储 `fromPos` 和 `toPos`（物理坐标），由求解器每帧更新到 MotionState 中。渲染器直接读取实体当前的 transform.position 作为一端，`properties.endPos` 作为另一端。
>
> **最终确定**：由于连接件本身需要知道两端位置才能绘制，且求解器已经计算了物块位置，**求解器将绳/杆的端点坐标写入其 MotionState**：
> - `MotionState.position` = 绳的起点（pivot 端）
> - `MotionState.velocity` = 绳的终点（block 端）—— **不！这是误用**
>
> **正确方案**：为 rope/rod 实体的 properties 新增 `endPos: Vec2`，求解器每帧通过 PhysicsResult 更新。但 PhysicsResult 只有 MotionState（position, velocity, acceleration）。
>
> **真正最终方案**：
> 1. rope 实体的 `transform.position` = pivot 位置（固定端）
> 2. rope 实体的 `properties.endPos` = block 位置（自由端），由**预设 JSON 指定初始值**
> 3. render-loop 中已有"用 MotionState.position 更新实体 transform.position"的机制
> 4. 求解器为 rope 输出 MotionState，其中 `position = pivotPos`（不变），并在 `properties` 中更新 endPos——但 MotionState 不能更新 properties
>
> **最简方案（推荐）**：
> - rope 不产生 MotionState
> - rope 渲染器接收所有实体引用（通过扩展渲染上下文或通过 rope 的 properties 存储端点实体 ID）
> - **在渲染时从 result.motionStates 读取对应物块的位置**作为绳的自由端
> - 固定端从 rope 的 `properties.pivotEntityId` 查找 pivot 实体的 transform.position
>
> 具体实现：
> ```typescript
> const ropeRenderer: EntityRenderer = (entity, result, ctx) => {
>   const pivotId = entity.properties.pivotEntityId as string;
>   const blockId = entity.properties.blockEntityId as string;
>   // 从 render-loop 传入的 entities Map 获取（需要 ctx 扩展或全局）
>   // 问题：ctx 没有 entities！
> }
> ```
>
> **ctx 扩展问题**：当前 RenderContext 中没有 entities Map。需要追加。这是公共代码修改。
>
> **备选：避免公共代码修改**：
> - 使用模块级变量缓存 entities Map（类似 force-viewport 缓存力箭头坐标）
> - 在 `registerMechanicsDomain()` 初始化时设置，或在 force-viewport/motion-viewport 渲染时更新
> - 更好：在 render-loop 中已有 entities Map，只需将其附加到 RenderContext
>
> **最终决策**：**向 RenderContext 追加 `entities` 字段**（⚠️ 公共代码，只追加不修改已有字段）。
> 这是一个很自然的扩展——渲染器经常需要引用其他实体。当前 ViewportRenderer 已经接收 entities 参数，但 EntityRenderer 没有。

**⚠️ 公共代码微量修改**：
- `core/types.ts`：RenderContext 追加 `entities: Map<EntityId, Entity>`
- `renderer/render-loop.ts`：构建 renderCtx 时传入 entities

---

### 子任务5.3：注册 `rod` 实体类型 + 渲染器

**文件**：
- `src/domains/mechanics/entities/rod.ts`（新增）
- `src/domains/mechanics/renderers/rod-renderer.ts`（新增）

**实体定义**：
| 字段 | 值 |
|------|------|
| type | `'rod'` |
| category | `'connector'` |
| label | `'轻杆'` |

**defaultProperties**：
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `length` | number | 1.0 | 杆长（m） |

**渲染**：
- 粗直线段（与 rope 区分）
- 颜色：`#2D3748`（更深灰）
- 线宽：4px（rope 为 1.5px）
- 两端小圆点表示铰接
- 端点获取方式与 rope 相同（从 entities Map 中读取关联实体位置）

**drawOutline**：
- 线段 ± 4px 的矩形轮廓

---

### 子任务5.4：实现单绳悬挂求解器 + 预设

**文件**：
- `src/domains/mechanics/solvers/single-rope-suspension.ts`（新增）
- `src/domains/mechanics/presets/single-rope-suspension.json`（新增）

**物理模型**：
```
    ▽ pivot
    |
    | rope (length L)
    |
    ■ block (mass m)
```

- 二力平衡：G + T = 0
- T = mg，方向竖直向上（沿绳方向）
- 物块位置 = pivot.position + (0, -L)

**力列表**：
| 力 | type | label | 方向 | 大小 |
|----|------|-------|------|------|
| 重力 | `gravity` | `G` | (0, −1) | mg |
| 张力 | `tension` | `T` | (0, +1) | mg |

**合力** = 0

**求解器注册**：
```
id: 'mech-single-rope-suspension'
pattern: { entityTypes: ['block', 'pivot', 'rope'], relationType: 'connection' }
qualifier: { suspension: 'single-rope' }
solveMode: 'analytical'
duration: 0 （静力分析）
```

**预设 JSON**：
```
id: "P01-FM021-single-rope"
name: "单绳竖直悬挂"
description: "物块由一根轻绳竖直悬挂，分析重力和张力的二力平衡"
entities: pivot-1 (position: {x:0, y:2}), rope-1 (length:1.5, pivotEntityId, blockEntityId), block-A (mass:1)
relations: [{ type: 'connection', source: block-A, target: pivot-1, properties: { connector: rope-1 } }]
paramGroups: [{ key: 'block-params', params: [mass slider] }]
supportedViewports: ["force"]
duration: 0
```

**手算验证**：
```
m = 1 kg
→ G = 9.8 N
→ T = 9.8 N
→ 合力 = 0
```

---

### 子任务5.5：实现双绳悬挂求解器 + 预设（2 个）

**文件**：
- `src/domains/mechanics/solvers/double-rope-suspension.ts`（新增）
- `src/domains/mechanics/presets/double-rope-symmetric.json`（新增）
- `src/domains/mechanics/presets/double-rope-asymmetric.json`（新增）

**物理模型**：
```
  ▽ pivot-1       ▽ pivot-2
    \             /
  T₁ \ θ₁    θ₂/ T₂
      \       /
       \     /
        ■ block
```

- 三力平衡：G + T₁ + T₂ = 0
- 水平：T₁sinθ₁ = T₂sinθ₂
- 竖直：T₁cosθ₁ + T₂cosθ₂ = mg
- 联立求解：
  - T₁ = mg·sinθ₂ / sin(θ₁+θ₂)
  - T₂ = mg·sinθ₁ / sin(θ₁+θ₂)
  - （拉密定理）

**力列表**：
| 力 | type | label | 方向 | 大小 |
|----|------|-------|------|------|
| 重力 | `gravity` | `G` | (0, −1) | mg |
| 张力1 | `tension` | `T₁` | (−sinθ₁, cosθ₁) | T₁ |
| 张力2 | `tension` | `T₂` | (sinθ₂, cosθ₂) | T₂ |

> **注意**：T₁ 方向为从物块指向 pivot-1，T₂ 方向为从物块指向 pivot-2

**参数面板**：
| key | label | type | min | max | step | default | unit |
|-----|-------|------|-----|-----|------|---------|------|
| `mass` | 质量 | slider | 0.5 | 10 | 0.1 | 1 | kg |
| `angle1` | 左绳角度 | slider | 5 | 85 | 1 | 30 | ° |
| `angle2` | 右绳角度 | slider | 5 | 85 | 1 | 60 | ° |

**物块位置计算**：
- 两根绳的交点即物块位置
- 给定 pivot-1 位置 P₁、pivot-2 位置 P₂、角度 θ₁、θ₂
- 物块在两绳交点，几何计算：
  - 设 P₁ = (x₁, y₁)，P₂ = (x₂, y₂)
  - 绳1 方向：从 P₁ 向右下方 (sinθ₁, −cosθ₁)
  - 绳2 方向：从 P₂ 向左下方 (−sinθ₂, −cosθ₂)
  - 求两射线交点即为 block 位置
  - 或简化：block 的 y 位置由几何关系确定

**求解器注册**：
```
id: 'mech-double-rope-suspension'
pattern: { entityTypes: ['block', 'pivot', 'rope'], relationType: 'connection' }
qualifier: { suspension: 'double-rope' }
```

**预设1（对称）**：angle1=45°, angle2=45° → T₁=T₂=mg/(2cos45°)
**预设2（不对称）**：angle1=30°, angle2=60° → 拉密定理

**手算验证**：
```
对称：m=1kg, θ₁=θ₂=45°
→ T₁ = T₂ = mg/(2cos45°) = 9.8/(2×0.707) = 6.93 N

不对称：m=1kg, θ₁=30°, θ₂=60°
→ T₁ = mg·sin60°/sin90° = 9.8×0.866/1 = 8.49 N
→ T₂ = mg·sin30°/sin90° = 9.8×0.5/1 = 4.9 N
→ 验证水平平衡：T₁sin30° = 8.49×0.5 = 4.25, T₂sin60° = 4.9×0.866 = 4.24 ≈ ✓
```

---

### 子任务5.6：实现绳+杆混合悬挂求解器 + 预设

**文件**：
- `src/domains/mechanics/solvers/rope-rod-suspension.ts`（新增）
- `src/domains/mechanics/presets/rope-rod-suspension.json`（新增）

**物理模型**：
```
  ▽ pivot-1       ▽ pivot-2
    \             /
  T  \ θ₁    θ₂/ F_rod
(绳) \       / (杆)
      \     /
       ■ block
```

- 绳只能拉（T > 0），杆可拉可压（F_rod 正/负）
- 三力平衡同双绳，但 F_rod 可能为压力（方向反转）
- 计算公式同双绳，但标签不同：
  - 绳：`T`（tension 类型，绿色）
  - 杆：`F杆`（custom 类型或 tension 类型，根据方向判断）

**力列表**：
| 力 | type | label | 方向 | 大小 |
|----|------|-------|------|------|
| 重力 | `gravity` | `G` | (0, −1) | mg |
| 绳张力 | `tension` | `T` | 沿绳向上 | T |
| 杆力 | `tension` | `F杆` | 沿杆方向（可正可负） | |F_rod|| |

> 注意：杆力为压力时（F_rod < 0），方向从 block 指向 pivot（推），label 标注"F杆(压)"

**参数面板**：
| key | label | type | min | max | step | default | unit |
|-----|-------|------|-----|-----|------|---------|------|
| `mass` | 质量 | slider | 0.5 | 10 | 0.1 | 1 | kg |
| `ropeAngle` | 绳角度 | slider | 5 | 85 | 1 | 30 | ° |
| `rodAngle` | 杆角度 | slider | 5 | 85 | 1 | 60 | ° |

**手算验证**：
```
m=1kg, θ_rope=30°, θ_rod=60°
→ 同双绳计算
→ T = mg·sin60°/sin90° = 8.49 N
→ F_rod = mg·sin30°/sin90° = 4.9 N（拉力）

特殊情况：θ_rod=90°（杆水平）
→ 杆只能提供水平力
→ T·cosθ_rope = mg → T = mg/cosθ_rope
→ F_rod = T·sinθ_rope（水平分量由杆承担）
```

---

### 子任务5.7：注册 + 回归验证

**文件**：`src/domains/mechanics/index.ts`

**新增注册**：
```typescript
// 实体
registerPivotEntity();
registerRopeEntity();
registerRodEntity();
// 渲染器
registerPivotRenderer();  // 可能内联在 entity 中
registerRopeRenderer();
registerRodRenderer();
// 求解器
registerSingleRopeSuspensionSolver();
registerDoubleRopeSuspensionSolver();
registerRopeRodSuspensionSolver();
// 预设
presetRegistry.register(singleRopePreset);
presetRegistry.register(doubleRopeSymmetricPreset);
presetRegistry.register(doubleRopeAsymmetricPreset);
presetRegistry.register(ropeRodPreset);
```

**回归门禁**：
```bash
pnpm lint && pnpm tsc --noEmit
```

**如修改了公共代码**：更新 `docs/public-api-changelog.md`

---

## 文件变更清单

| 操作 | 文件路径 | 归属 | 说明 |
|------|----------|------|------|
| 修改 | `src/core/types.ts` | ⚠️ 公共 | RenderContext 追加 `entities` 字段（只追加） |
| 修改 | `src/renderer/render-loop.ts` | ⚠️ 公共 | 构建 renderCtx 时传入 entities |
| 新增 | `src/domains/mechanics/entities/pivot.ts` | 力学域 | 固定悬挂点实体 |
| 新增 | `src/domains/mechanics/entities/rope.ts` | 力学域 | 轻绳实体 |
| 新增 | `src/domains/mechanics/entities/rod.ts` | 力学域 | 轻杆实体 |
| 新增 | `src/domains/mechanics/renderers/pivot-renderer.ts` | 力学域 | 固定点渲染器 |
| 新增 | `src/domains/mechanics/renderers/rope-renderer.ts` | 力学域 | 轻绳渲染器 |
| 新增 | `src/domains/mechanics/renderers/rod-renderer.ts` | 力学域 | 轻杆渲染器 |
| 新增 | `src/domains/mechanics/solvers/single-rope-suspension.ts` | 力学域 | 单绳悬挂求解器 |
| 新增 | `src/domains/mechanics/solvers/double-rope-suspension.ts` | 力学域 | 双绳悬挂求解器 |
| 新增 | `src/domains/mechanics/solvers/rope-rod-suspension.ts` | 力学域 | 绳+杆混合求解器 |
| 新增 | `src/domains/mechanics/presets/single-rope-suspension.json` | 力学域 | 单绳竖直悬挂预设 |
| 新增 | `src/domains/mechanics/presets/double-rope-symmetric.json` | 力学域 | 双绳对称悬挂预设 |
| 新增 | `src/domains/mechanics/presets/double-rope-asymmetric.json` | 力学域 | 双绳不对称悬挂预设 |
| 新增 | `src/domains/mechanics/presets/rope-rod-suspension.json` | 力学域 | 绳+杆混合悬挂预设 |
| 修改 | `src/domains/mechanics/index.ts` | 力学域 | 追加全部注册 |
| 修改 | `docs/public-api-changelog.md` | — | 记录 RenderContext.entities 变更 |

## 验收标准

- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] pivot 渲染为实心圆点 + 固定标记
- [ ] rope 渲染为细直线段，从 pivot 到 block
- [ ] rod 渲染为粗直线段，与 rope 视觉区分明显
- [ ] 单绳悬挂：T = mg = 9.8N（m=1kg），力箭头沿绳向上
- [ ] 双绳对称：T₁ = T₂，调整角度后实时更新
- [ ] 双绳不对称：T₁ ≠ T₂，手算验证通过（拉密定理）
- [ ] 绳+杆：杆力方向正确（拉力/压力），标签标注正确
- [ ] 调整角度参数后，绳/杆长度和物块位置正确更新
- [ ] 合力为零（静力平衡，所有悬挂场景）
- [ ] 所有新实体有 drawOutline 注册，支持选中高亮
- [ ] 力箭头可点击查看详情（复用阶段3交互系统）
- [ ] 已有 8 个预设无回归问题
- [ ] 公共代码变更日志已更新

## 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| rope/rod 端点获取 | RenderContext 追加 entities Map | 渲染器天然需要引用其他实体，ViewportRenderer 已有此参数 |
| rope 渲染方式 | 从关联实体实时读取位置 | 避免冗余存储，角度变化时自动同步 |
| 杆力 ForceType | `tension`（与绳统一） | Phase 1 不追加新 ForceType；标签区分（T vs F杆） |
| 悬挂场景运动视角 | 不支持（duration=0） | 静力分析，无运动过程 |
| pivot 渲染器 | 独立文件 | 与 rope/rod 渲染风格不同（实心点 vs 线段） |
| 物块位置计算 | 求解器几何计算交点 | 由角度和 pivot 位置唯一确定 |

## 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| rope/rod 渲染器需要其他实体引用 | 需要 RenderContext 追加 entities | 只追加字段，向后兼容 |
| 双绳交点计算精度 | 低 | 解析解，无数值问题 |
| 角度参数范围导致绳交叉 | 中 | 限制 angle1+angle2 < 180° |
| getEdgeStart 对无 width/height 的 block | 低 | block 始终有 width/height |
