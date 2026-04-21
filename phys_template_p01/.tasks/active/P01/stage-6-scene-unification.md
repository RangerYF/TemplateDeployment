# 阶段6：场景统一化整改

> 任务ID：03-20-10-00-P01-stage6-scene-unification
> 风险等级：L2（高风险 — 涉及公共代码变更 + 跨模块联动 + 预设数据结构变更）
> 流程路径：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成** ✅（2026-03-20）

## 目标

将同类预设合并为"统一场景 + 条件选择"模式，对齐需求文档"选模型 → 设条件 → 自动受力"的交互设想。

## 背景

审查发现当前"每种条件组合 = 独立预设"的模式与需求文档存在根本偏差（详见 `docs/lessons/预设划分教训.md`）。现有架构已具备实现条件的基础设施（`select`/`toggle` 参数类型、求解器多分支），只需：
1. 公共层追加 `visibleWhen` 参数联动
2. 重组预设和求解器

## 前置依赖（阶段1~5产出）

- ✅ block + surface + slope 实体和渲染器
- ✅ pivot + rope + rod 实体和渲染器
- ✅ force-viewport + 标签防重叠 + 正交分解
- ✅ motion-viewport + v-t / a-t / x-t 图表
- ✅ 交互系统（实体选中、力箭头浮动菜单）
- ✅ ParamPanel schema 驱动渲染（slider / toggle / select / input）
- ✅ 4 个水平面求解器 + 1 个斜面统一求解器（内部4分支）+ 3 个悬挂求解器

## 公共代码影响评估

**本阶段需要修改公共代码**：

| 文件 | 变更 | 影响 |
|------|------|------|
| `src/core/types.ts` | `ParamSchemaBase` 追加可选 `visibleWhen` 字段 | 新增可选字段，不破坏已有代码 |
| `src/core/types.ts` | `PresetData` 追加可选 `group`/`groupLabel`/`groupOrder` 字段 | 新增可选字段，不破坏已有代码 |
| `src/shell/panels/ParamPanel.tsx` | 渲染前检查 `visibleWhen` 条件，不满足则跳过 | 已有参数无 `visibleWhen`，行为不变 |
| `src/shell/pages/PresetGallery.tsx` | 按 `group` 字段合并显示 + 子类型选择器 | 无 group 的预设行为不变 |

**需在 `docs/public-api-changelog.md` 记录变更。**

## 子任务清单（串行）

---

### 子任务6.1：ParamSchemaBase 追加 `visibleWhen`

**文件**：`src/core/types.ts`（修改）

在 `ParamSchemaBase` 追加：

```typescript
export interface ParamSchemaBase {
  key: string;
  label: string;
  group?: string;
  targetEntityId?: EntityId;
  targetProperty?: string;
  /** 参数联动显隐：当指定的其他参数满足条件时才显示本参数 */
  visibleWhen?: Record<string, unknown>;  // 新增
}
```

**语义**：`visibleWhen: { "frictionToggle": true }` 表示"当 frictionToggle 为 true 时才显示本参数"。多个 key 时为 AND 关系。

**验证**：`pnpm tsc --noEmit` 通过（纯追加可选字段）。

---

### 子任务6.2：ParamPanel 适配 `visibleWhen`

**文件**：`src/shell/panels/ParamPanel.tsx`（修改）

在 `group.schemas.map` 渲染前，过滤掉不满足 `visibleWhen` 条件的参数：

```typescript
// 在 ParamControl 渲染之前过滤
const visibleSchemas = group.schemas.filter((schema) => {
  if (!schema.visibleWhen) return true;
  return Object.entries(schema.visibleWhen).every(
    ([k, v]) => values[k] === v
  );
});
```

将 `group.schemas.map` 替换为 `visibleSchemas.map`。

**验证**：
- 无 `visibleWhen` 的已有预设行为不变
- 后续统一预设中 `frictionToggle=false` 时 μ slider 被隐藏

---

### 子任务6.3：水平面 4 预设 → 1 个统一预设

#### 6.3a：创建统一求解器

**新文件**：`src/domains/mechanics/solvers/horizontal-surface.ts`

合并 4 个求解器为 1 个。逐力判断逻辑：

| 力 | 存在条件 |
|----|---------|
| 重力 G | 始终 |
| 支持力 N | 始终（N = mg - F·sinθ，N>0 时） |
| 摩擦力 f | `frictionToggle === true` 且 N > 0 且（有外力水平分量 或 有初速度） |
| 外力 F | `hasAppliedForce === true` 且 F > 0 |

运动状态由参数自动推导：
- v₀=0 且无净水平力 → 静止
- v₀>0 且净力反向 → 减速（可能先减后加速）
- 净力正向 → 加速

注册 1 个 qualifier：`{ surface: 'horizontal' }`（删除 motion 维度）。

**关键参数来源**（从 `scene.paramValues` 读取）：

| 参数 key | 类型 | 说明 |
|----------|------|------|
| `mass` | slider | 质量 |
| `frictionToggle` | toggle | 光滑/粗糙 |
| `friction` | slider | 摩擦因数 μ（visibleWhen: frictionToggle=true） |
| `hasAppliedForce` | toggle | 有无外力 |
| `appliedForce` | slider | 外力大小 F（visibleWhen: hasAppliedForce=true） |
| `forceAngle` | slider | 外力方向角 θ（visibleWhen: hasAppliedForce=true） |
| `initialVelocity` | slider | 初速度 v₀（0=静止） |

**solveMode**：v₀=0 且净力=0 时 `analytical`（静止），否则 `numerical`。

#### 6.3b：创建统一预设 JSON

**新文件**：`src/domains/mechanics/presets/horizontal-surface.json`

参数按实体分组，条件参数归属到对应实体：

```
┌─────────────────────┐
│ 物块                │  ← targetEntityId: "block-A"
│ 质量 m [===●==] 2kg │
│ 初速度 v₀ [●==] 0   │
│ 施加外力  无 ⚪      │  ← 外力作用在物块上
│ 外力 F [●===] 10N   │  ← visibleWhen: hasAppliedForce=true
│ 方向角 θ [==●=] 0°  │  ← visibleWhen: hasAppliedForce=true
│                     │
│ 水平面              │  ← targetEntityId: "surface-A"
│ 接触面  粗糙 ⚫      │  ← 光滑/粗糙是面的属性
│ 摩擦因数 μ [=●=] 0.3│  ← visibleWhen: frictionToggle=true
└─────────────────────┘
```

对应预设 JSON 的 `paramGroups`：

```json
"paramGroups": [
  {
    "key": "block-params",
    "label": "物块",
    "params": [
      { "key": "mass", "label": "质量 m", "type": "slider", "min": 0.5, "max": 50, "step": 0.5, "default": 2, "unit": "kg", "targetEntityId": "block-A", "targetProperty": "mass" },
      { "key": "initialVelocity", "label": "初速度 v₀", "type": "slider", "min": 0, "max": 20, "step": 0.5, "default": 0, "unit": "m/s", "targetEntityId": "block-A" },
      { "key": "hasAppliedForce", "label": "施加外力", "type": "toggle", "default": false, "labelOn": "有", "labelOff": "无", "targetEntityId": "block-A" },
      { "key": "appliedForce", "label": "外力 F", "type": "slider", "min": 1, "max": 500, "step": 1, "default": 10, "unit": "N", "targetEntityId": "block-A", "visibleWhen": { "hasAppliedForce": true } },
      { "key": "forceAngle", "label": "力的方向角 θ", "type": "slider", "min": -90, "max": 90, "step": 1, "default": 0, "unit": "°", "targetEntityId": "block-A", "visibleWhen": { "hasAppliedForce": true } }
    ]
  },
  {
    "key": "surface-params",
    "label": "水平面",
    "params": [
      { "key": "frictionToggle", "label": "接触面", "type": "toggle", "default": true, "labelOn": "粗糙", "labelOff": "光滑", "targetEntityId": "surface-A" },
      { "key": "friction", "label": "摩擦因数 μ", "type": "slider", "min": 0.05, "max": 1.0, "step": 0.01, "default": 0.3, "precision": 2, "targetEntityId": "surface-A", "targetProperty": "friction", "visibleWhen": { "frictionToggle": true } }
    ]
  }
]
```

**设计原则**：
- 参数按所属实体分组（物块的参数放物块下，面的参数放面下）
- 外力作用在物块上 → 归入物块组
- 光滑/粗糙是接触面的属性 → 归入水平面组
- **不设"显示选项"组** — 力的分解通过点击力箭头的浮动菜单操作，不在参数面板暴露

**注意**：以上 JSON 仅为结构参考，实际执行时需对齐现有预设的精确字段格式。

#### 6.3c：删除旧文件 + 更新注册

**删除**：
- `solvers/block-on-surface.ts`
- `solvers/block-friction-deceleration.ts`
- `solvers/block-with-applied-force.ts`
- `solvers/block-friction-acceleration.ts`
- `presets/horizontal-block.json`
- `presets/horizontal-with-force.json`
- `presets/friction-deceleration.json`
- `presets/friction-acceleration.json`

**修改** `index.ts`：删除旧的 4 个求解器注册 + 4 个预设注册，替换为 1 个统一求解器 + 1 个统一预设。

**验证**：
- `pnpm lint && pnpm tsc --noEmit` 通过
- 切换 frictionToggle，μ slider 显隐正确
- 切换 hasAppliedForce，F 和 θ slider 显隐正确
- 设 v₀=5, F=0, μ=0.3 → 减速场景，力的方向和大小与旧 friction-deceleration 预设一致
- 设 v₀=0, F=10, μ=0.3 → 加速场景，与旧 friction-acceleration 预设一致
- 设 v₀=0, F=0, frictionToggle=false → 静止光滑，与旧 horizontal-block 预设一致
- motion 视角图表无回归

---

### 子任务6.4：斜面 4 预设 → 1 个统一预设

#### 6.4a：改造斜面求解器

**修改文件**：`src/domains/mechanics/solvers/block-on-slope.ts`

当前状态：已有 1 个统一 `solveBlockOnSlope()` 函数，但注册了 4 个 qualifier variant（`motion: 'static'/'sliding-down'/'sliding-up'/'smooth'`）。

改造：
- 注册简化为 1 个 qualifier：`{ surface: 'inclined' }`（删除 motion 维度）
- 求解器内部根据 `paramValues` 自动判断运动状态（已有逻辑，只需确认参数来源正确）
- 追加外力分支：当 `hasAppliedForce=true` 时，沿斜面方向叠加外力分量

**新增参数**：

| 参数 key | 类型 | 说明 |
|----------|------|------|
| `hasAppliedForce` | toggle | 有无沿斜面方向外力 |
| `appliedForce` | slider | 外力大小（visibleWhen: hasAppliedForce=true） |
| `forceDirection` | select | 沿斜面向上/向下（visibleWhen: hasAppliedForce=true） |

#### 6.4b：创建统一预设 JSON

**新文件**：`src/domains/mechanics/presets/inclined-surface.json`

参数按实体分组：

```
┌─────────────────────────┐
│ 物块                    │
│ 质量 m [===●==] 5kg     │
│ 初速度 v₀ [●====] 0     │
│ 施加外力  无 ⚪          │
│ 外力 F [●===] 10N       │  ← visibleWhen: hasAppliedForce=true
│ 外力方向  沿斜面向上 ▼   │  ← visibleWhen: hasAppliedForce=true
│                         │
│ 斜面                    │
│ 斜面角度 θ [==●=] 30°   │
│ 接触面  粗糙 ⚫          │
│ 摩擦因数 μ [=●===] 0.30 │  ← visibleWhen: frictionToggle=true
└─────────────────────────┘
```

对应 `paramGroups`：
- `block-params`（物块）：mass、initialVelocity、hasAppliedForce、appliedForce（visibleWhen）、forceDirection（visibleWhen）
- `slope-params`（斜面）：slopeAngle、frictionToggle、friction（visibleWhen）

#### 6.4c：删除旧文件 + 更新注册

**删除**：
- `presets/slope-static.json`
- `presets/slope-sliding-down.json`
- `presets/slope-sliding-up.json`
- `presets/slope-smooth.json`

**修改** `index.ts`：4 个预设注册 → 1 个。求解器注册从 4 个 variant → 1 个。

**验证**：
- slopeAngle=30, μ=0.3, v₀=0 → 判断是否下滑（mgsinθ vs μmgcosθ），与旧 slope-static 一致
- slopeAngle=45, μ=0.2, v₀=0 → 下滑，与旧 slope-sliding-down 一致
- slopeAngle=30, v₀=5 → 上冲然后下滑，与旧 slope-sliding-up 一致
- frictionToggle=false → 光滑下滑，与旧 slope-smooth 一致
- μ 调至 tanθ 临界值 → 从静止过渡到匀速（新增覆盖）
- motion 视角图表无回归

---

### 子任务6.5：悬挂预设优化（双绳合并）

**修改**：将 `double-rope-symmetric.json` 和 `double-rope-asymmetric.json` 合并为 1 个 `double-rope-suspension.json`。

当前差异分析：
- symmetric：angle1=45, angle2=45（默认值相等）
- asymmetric：angle1=30, angle2=60（默认值不等）

合并方案：1 个预设，angle1 和 angle2 独立可调，默认值设为 30° / 60°（不对称更通用，用户调为相等即对称）。

**删除**：
- `presets/double-rope-symmetric.json`
- `presets/double-rope-asymmetric.json`

**新增**：
- `presets/double-rope-suspension.json`

**修改** `index.ts`：2 个预设注册 → 1 个。

**预设追加 group 字段**：
- `single-rope-suspension.json`：追加 `"group": "suspension", "groupLabel": "悬挂模型", "groupOrder": 1`
- `double-rope-suspension.json`：追加 `"group": "suspension", "groupLabel": "悬挂模型", "groupOrder": 2`
- `rope-rod-suspension.json`：追加 `"group": "suspension", "groupLabel": "悬挂模型", "groupOrder": 3`

`group` 字段目前 PresetData 类型中可能不存在，需要在 `core/types.ts` 的 `PresetData` 接口追加可选字段 `group?: string; groupLabel?: string; groupOrder?: number;`。

**验证**：
- angle1=angle2=45 → 对称，T₁=T₂，与旧 symmetric 一致
- angle1=30, angle2=60 → 不对称，与旧 asymmetric 一致

---

### 子任务6.6：PresetGallery group 分组渲染

**文件**：`src/shell/pages/PresetGallery.tsx`（修改）

当前状态：每个预设独立渲染为一张卡片，无分组逻辑。

改造：
1. 预设列表渲染前，按 `group` 字段合并：有 group 的预设合为 1 个入口卡片（显示 `groupLabel`），无 group 的预设保持独立卡片
2. 点击分组卡片后，展示子类型选择器（同组预设按 `groupOrder` 排序）
3. 选择子类型 → 加载对应预设

**UI 效果**：

预设选择页：
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 水平面受力│ │ 斜面受力  │ │ 悬挂模型  │  ← 3 个入口
└──────────┘ └──────────┘ └──────────┘
```

点击「悬挂模型」后：
```
┌──────────────────────────────────┐
│ 悬挂模型                          │
│  ○ 单绳悬挂  ● 双绳悬挂  ○ 绳+杆  │  ← 子类型选择
│  ──────────────────────          │
│  （加载选中子类型的预设）           │
└──────────────────────────────────┘
```

**实现方式**：子类型选择器可以用简单的按钮组（类似 ViewportBar 的芯片样式），放在进入场景后的参数面板顶部，或作为预设选择页的二级展开。具体实现时再定。

**验证**：
- 无 group 的预设（水平面、斜面）独立显示，行为不变
- 有 group 的预设（悬挂 3 个）合并为 1 个入口
- 子类型切换后正确加载对应预设
- 同名参数（如 mass）在子类型切换后保持值

---

### 子任务6.7：全量回归验证

1. `pnpm lint && pnpm tsc --noEmit` 通过
2. 水平面统一场景：遍历所有条件组合（6 种），验证力箭头方向和大小
3. 斜面统一场景：遍历所有条件组合（8 种），验证力箭头和运动视角
4. 悬挂场景：3 个预设分别验证
5. 手算验证（至少 3 组）：
   - 水平面：m=2kg, μ=0.3, F=10N, θ=30°, v₀=0 → a = (Fcosθ - μ(mg-Fsinθ)) / m
   - 斜面：m=5kg, θ=37°, μ=0.2, v₀=0 → 判断是否下滑 + 计算 a
   - 双绳：m=2kg, α=30°, β=60° → T₁ = mg·sin(β)/sin(α+β), T₂ = mg·sin(α)/sin(α+β)
6. 更新 `docs/public-api-changelog.md`

---

## 预设变化汇总

| 整改前（12个） | 整改后（5个） |
|----------------|--------------|
| horizontal-block | → 合并为 `horizontal-surface`（水平面受力） |
| horizontal-with-force | → |
| friction-deceleration | → |
| friction-acceleration | → |
| slope-static | → 合并为 `inclined-surface`（斜面受力） |
| slope-sliding-down | → |
| slope-sliding-up | → |
| slope-smooth | → |
| single-rope-suspension | → 保留 |
| double-rope-symmetric | → 合并为 `double-rope-suspension`（双绳悬挂） |
| double-rope-asymmetric | → |
| rope-rod-suspension | → 保留 |

## 文件变化汇总

| 操作 | 文件 |
|------|------|
| 修改 | `src/core/types.ts` — ParamSchemaBase 追加 visibleWhen；PresetData 追加 group 字段 |
| 修改 | `src/shell/panels/ParamPanel.tsx` — visibleWhen 过滤逻辑 |
| 修改 | `src/shell/pages/PresetGallery.tsx` — group 分组渲染 + 子类型选择器 |
| 新增 | `src/domains/mechanics/solvers/horizontal-surface.ts` |
| 修改 | `src/domains/mechanics/solvers/block-on-slope.ts` — qualifier 简化 + 外力分支 |
| 新增 | `src/domains/mechanics/presets/horizontal-surface.json` |
| 新增 | `src/domains/mechanics/presets/inclined-surface.json` |
| 新增 | `src/domains/mechanics/presets/double-rope-suspension.json` |
| 修改 | `src/domains/mechanics/presets/single-rope-suspension.json` — 追加 group |
| 修改 | `src/domains/mechanics/presets/rope-rod-suspension.json` — 追加 group |
| 修改 | `src/domains/mechanics/index.ts` — 更新注册 |
| 删除 | 4 个旧水平面求解器 + 8 个旧预设 JSON |
| 修改 | `docs/public-api-changelog.md` — 记录公共代码变更 |
