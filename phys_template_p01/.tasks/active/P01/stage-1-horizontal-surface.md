# 阶段1：水平面场景补全

> 任务ID：03-18-19-30-P01-stage1-horizontal
> 风险等级：L1（常规风险，1~3文件改动，常规功能）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成** ✅（2026-03-18）

## 目标

补全水平面全部 4 个变体预设，新增"施加外力"和"加速运动"两个求解器，使水平面受力分析场景 100% 覆盖。

## 当前状态（已有）

| 组件 | 文件 | 说明 |
|------|------|------|
| block 实体 | `entities/block.ts` | mass, width, height, initialVelocity? |
| surface 实体 | `entities/surface.ts` | length, friction |
| 静力平衡求解器 | `solvers/block-on-surface.ts` | qualifier: `{surface: "horizontal", motion: "static"}` |
| 摩擦减速求解器 | `solvers/block-friction-deceleration.ts` | qualifier: `{surface: "horizontal", motion: "friction-deceleration"}` |
| 预设 FM-001 | `presets/horizontal-block.json` | 水平面·物块受力（静止，G+N） |
| 预设 FM-002 | `presets/friction-deceleration.json` | 水平面·摩擦减速（v₀, μ） |

## 子任务清单（串行）

---

### 子任务1.1：实现"水平面施加外力"求解器

**文件**：`src/domains/mechanics/solvers/block-with-applied-force.ts`

**物理模型**：
- 物块在水平面上，受斜向外力 F、角度 θ（与水平方向夹角，向上为正）
- 竖直方向：N + F·sinθ = mg → **N = mg − F·sinθ**
- 水平方向：F·cosθ − f = ma
- 摩擦力判定：
  - 若 `frictionToggle = false`（光滑）：f = 0
  - 若 `frictionToggle = true`（粗糙）：
    - 先判断是否能静止：|F·cosθ| ≤ μN → 静摩擦 f = F·cosθ（平衡），a = 0
    - 否则：动摩擦 f = μN，a = (F·cosθ − μN) / m
- 特殊情况：若 N ≤ 0（外力竖直分量过大导致物块被提起），需处理

**求解器注册**：
```
id: 'mech-block-with-applied-force'
label: '水平面·施加外力'
pattern: {
  entityTypes: ['block', 'surface'],
  relationType: 'contact',
  qualifier: { surface: 'horizontal', motion: 'applied-force' }
}
solveMode: 'analytical'
```

**输出的力列表**：
| 力 | type | label | 方向 | 大小 |
|----|------|-------|------|------|
| 重力 | `gravity` | `G` | (0, −1) | mg |
| 支持力 | `normal` | `N` | (0, +1) | mg − F·sinθ |
| 外力 | `custom` | `F` | (cosθ, sinθ) | F |
| 摩擦力 | `friction` | `f` | (−sign, 0) | μN 或 F·cosθ |

> **注意**：外力使用 `custom` 类型（因为 ForceType 中无 `applied` 类型）。需确认 `FORCE_COLORS.custom` 的颜色（当前为灰色 `#7F8C8D`），如果不合适可考虑向 `core/visual-constants.ts` 追加或复用已有类型。
>
> **备选方案**：如果灰色不够醒目，可以在求解器中设置 label 为 `F`，颜色仍使用 `custom` 对应色。Phase 1 先保持不改 core 类型，后续如需可追加 `applied` ForceType。

**参数面板**（paramGroups）：
| key | label | type | min | max | step | default | unit |
|-----|-------|------|-----|-----|------|---------|------|
| `mass` | 质量 | slider | 0.5 | 10 | 0.1 | 2 | kg |
| `appliedForce` | 外力大小 | slider | 0 | 50 | 0.5 | 10 | N |
| `forceAngle` | 外力角度 | slider | −90 | 90 | 1 | 30 | ° |
| `frictionToggle` | 表面摩擦 | toggle | — | — | — | true | — |
| `friction` | 摩擦因数 | slider | 0.05 | 1.0 | 0.05 | 0.3 | — |

**toggle 联动**：`frictionToggle = false` 时隐藏 `friction` slider，求解器令 μ = 0。

**MotionState 计算**：
- 静止（|F·cosθ| ≤ μN 且 frictionToggle=true）：duration = 0，位移不变
- 运动（合力不为零）：
  - a = (F·cosθ − sign·μN) / m
  - v(t) = a·t, x(t) = ½a·t²
  - duration = 5（或根据场景调整）
  - 需检测：如果 a < 0 且物块初始静止，则实际不运动（静摩擦足够）

**手算验证用例**：
```
m = 2 kg, F = 10 N, θ = 30°, μ = 0.3
→ F·cosθ = 10 × cos30° = 8.66 N
→ F·sinθ = 10 × sin30° = 5.0 N
→ N = mg − F·sinθ = 19.6 − 5.0 = 14.6 N
→ μN = 0.3 × 14.6 = 4.38 N
→ F·cosθ (8.66) > μN (4.38) → 运动
→ a = (8.66 − 4.38) / 2 = 2.14 m/s²
→ 合力 = ma = 2 × 2.14 = 4.28 N
```

---

### 子任务1.2：编写"水平面·施加外力"预设 JSON

**文件**：`src/domains/mechanics/presets/horizontal-with-force.json`

**预设配置**：
```
id: "P01-FM001-horizontal-with-force"
name: "水平面·施加外力"
description: "物块在水平面上受斜向外力，分析受力与运动"
category: "P-01"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "horizontal", "motion": "applied-force" }
solveMode: "analytical"
duration: 5
```

**实体**：
- `block-A`：block，mass=2, width=0.5, height=0.5
- `surface-1`：surface，length=8, friction=0.3

**关系**：
- contact：block-A → surface-1，friction=0.3

**参数分组**：
- "外力属性"组：appliedForce, forceAngle
- "物体属性"组：mass
- "表面属性"组：frictionToggle, friction

---

### 子任务1.3：实现"水平面加速运动"求解器

**文件**：`src/domains/mechanics/solvers/block-friction-acceleration.ts`

**物理模型**：
- 物块受水平推力 F 在粗糙水平面上做匀加速运动
- 竖直方向：N = mg（水平力不影响 N）
- 水平方向：F − f = ma → a = (F − μmg) / m
- v(t) = a·t, x(t) = ½a·t²
- 边界条件：如果 F ≤ μmg，物块不动（静摩擦平衡）

**与子任务1.1的区别**：
- 1.1 是**斜向力**（有角度分量，N ≠ mg），更通用
- 1.3 是**纯水平力**（θ=0 的特例），更简单直观，适合初中/高一教学
- 两者作为独立预设存在，教学层次不同

> **实现策略决策**：子任务1.3 可以复用子任务1.1 的求解器（令 θ=0），也可以独立实现一个更简单的求解器。
>
> **推荐方案**：独立实现简单版本。原因：
> 1. 1.3 的 qualifier 不同（`motion: "friction-acceleration"`），引擎通过 qualifier 匹配
> 2. 简单版逻辑更清晰，无需处理角度分解，便于维护
> 3. 参数面板更简洁（无角度参数），教学体验更好

**求解器注册**：
```
id: 'mech-block-friction-acceleration'
label: '水平面·加速运动'
pattern: {
  entityTypes: ['block', 'surface'],
  relationType: 'contact',
  qualifier: { surface: 'horizontal', motion: 'friction-acceleration' }
}
solveMode: 'analytical'
```

**输出的力列表**：
| 力 | type | label | 方向 | 大小 |
|----|------|-------|------|------|
| 重力 | `gravity` | `G` | (0, −1) | mg |
| 支持力 | `normal` | `N` | (0, +1) | mg |
| 推力 | `custom` | `F` | (+1, 0) | F |
| 摩擦力 | `friction` | `f` | (−1, 0) | μmg |

**参数面板**：
| key | label | type | min | max | step | default | unit |
|-----|-------|------|-----|-----|------|---------|------|
| `mass` | 质量 | slider | 0.5 | 10 | 0.1 | 2 | kg |
| `appliedForce` | 推力 | slider | 1 | 50 | 0.5 | 10 | N |
| `friction` | 摩擦因数 | slider | 0.05 | 1.0 | 0.05 | 0.3 | — |

**MotionState**（解析解）：
- a = (F − μmg) / m
- 若 a ≤ 0：静止（F 不足以克服摩擦），forces 中摩擦力 = F（静摩擦平衡）
- 若 a > 0：匀加速，v(t) = at, x(t) = ½at²

**手算验证用例**：
```
m = 2 kg, F = 10 N, μ = 0.3
→ μmg = 0.3 × 2 × 9.8 = 5.88 N
→ F (10) > μmg (5.88) → 运动
→ a = (10 − 5.88) / 2 = 2.06 m/s²
→ t=2s: v = 4.12 m/s, x = 4.12 m
```

---

### 子任务1.4：编写"水平面·加速运动"预设 JSON

**文件**：`src/domains/mechanics/presets/friction-acceleration.json`

**预设配置**：
```
id: "P01-FM002-friction-acceleration"
name: "水平面·推力加速"
description: "物块受水平推力在粗糙水平面上做匀加速运动"
category: "P-01"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "horizontal", "motion": "friction-acceleration" }
solveMode: "analytical"
duration: 5
```

---

### 子任务1.5：注册 + 回归验证

**文件**：`src/domains/mechanics/index.ts`

**改动**：
1. import 新的 2 个求解器注册函数
2. import 新的 2 个预设 JSON
3. 在 `registerMechanicsDomain()` 中调用注册

**回归门禁**：
```bash
pnpm lint && pnpm tsc --noEmit
```

---

## 技术约束备忘

1. **外力颜色**：`custom` 类型对应 `FORCE_COLORS.custom = '#7F8C8D'`（灰色）。如教学效果不佳，后续可向 `ForceType` 追加 `'applied'` 类型，但需修改 `core/types.ts`（公共代码，需协商）。Phase 1 暂用 `custom`。
2. **参数读取优先级**：求解器应优先从 `scene.paramValues` 读取参数（参数面板联动），其次从实体 properties / 关系 properties 读取。参考 `block-friction-deceleration.ts` 的实现模式。
3. **toggle 联动**：预设 JSON 中 toggle 参数的 `key` 必须与 slider 的 `key` 有语义关联，求解器通过读取 `scene.paramValues[toggleKey]` 判断是否启用。
4. **角度单位**：参数面板中角度用"度"（°），求解器内部需转换为弧度（`θ_rad = θ_deg × Math.PI / 180`）。
5. **block 实体扩展属性**：block 的 `properties` 需要新增 `appliedForce` 和 `forceAngle` 字段，但无需修改 `entities/block.ts` 的 `defaultProperties`——预设 JSON 直接在 entity properties 中指定即可，求解器优先从 `paramValues` 读取。

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新增 | `src/domains/mechanics/solvers/block-with-applied-force.ts` | 施加外力求解器 |
| 新增 | `src/domains/mechanics/solvers/block-friction-acceleration.ts` | 加速运动求解器 |
| 新增 | `src/domains/mechanics/presets/horizontal-with-force.json` | 施加外力预设 |
| 新增 | `src/domains/mechanics/presets/friction-acceleration.json` | 加速运动预设 |
| 修改 | `src/domains/mechanics/index.ts` | 追加 4 项注册 |
| 修改 | `src/domains/mechanics/viewports/force-viewport.ts` | 标签防重叠系统重构 |
| 修改 | `src/shell/panels/InfoPanel.tsx` | 合力文案优化 |

## 验收标准

- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 施加外力场景：θ=30° 时 N ≠ mg，力箭头角度正确
- [x] 施加外力场景：切换光滑/粗糙，摩擦力正确出现/消失
- [x] 加速运动场景：物块位移随时间正确变化
- [x] 加速运动场景：F < μmg 时物块静止，摩擦力 = F
- [x] 手算验证通过（两组验证用例数值均正确）
- [x] 力标签防重叠：多方向候选 + 最优选择，标签不与其他箭头重叠
- [x] 外力标签显示为 `F外`，合力标签显示为 `F合`
- [x] 合力为零时画布不显示多余标签，InfoPanel 已有"合力为零，受力平衡"

## 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 外力 ForceType | `custom` | 避免修改 core/types.ts 公共代码 |
| 加速运动求解器 | 独立实现 | 比复用斜向力求解器更简洁、教学体验更好 |
| duration | 5s | 与已有摩擦减速预设一致 |
| 外力标签 | `F外` | 与合力 `F合` 命名风格一致，区分度更高 |
| 标签防重叠 | 4候选位置+最优评分 | 替代固定位置+推移，避免标签被推离自己的箭头 |
| 合力为零标签 | 不在画布显示 | InfoPanel 已有文案，画布标签多余 |
| InfoPanel 文案 | "合力为零，受力平衡" | 替代原"受力平衡，物体静止或匀速运动"，不暗示不受力 |

## 交付 DoD

### 变更摘要
- 新增 2 个求解器 + 2 个预设 JSON，水平面 4 个变体场景 100% 覆盖
- 重构 force-viewport 标签防重叠系统（多候选位置最优选择）
- 修复合力显示相关 bug 3 项（文字箭头重叠、近似同向重叠、标签远离箭头）
- 优化外力标签命名（F→F外）和 InfoPanel 合力文案

### 验证结果
| 检查项 | 命令/方式 | 结果 |
|--------|-----------|------|
| Lint | `pnpm lint` | ✅ 通过 |
| 类型检查 | `pnpm tsc --noEmit` | ✅ 通过 |
| 手算·施加外力 | m=2kg,F=10N,θ=30°,μ=0.3 → a=2.14m/s² | ✅ 正确 |
| 手算·推力加速 | m=2kg,F=10N,μ=0.3 → a=2.06m/s² | ✅ 正确 |

### 风险与回滚
- 风险等级：低
- 回滚方式：git revert 即可

### 任务完成质量
- 求解器功能完整，含边界处理（N≤0、静摩擦平衡）
- 标签防重叠系统可被后续所有阶段复用
- 公共代码修改仅 InfoPanel 文案一处，不影响结构
