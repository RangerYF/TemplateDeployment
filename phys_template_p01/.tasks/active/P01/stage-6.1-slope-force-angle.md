# 阶段6.1：斜面外力角度化改造

> 任务ID：03-20-14-00-P01-stage6.1-slope-force-angle
> 风险等级：L1（常规风险 — 1~3文件改动，无跨模块联动）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成**
> 前置依赖：阶段6 场景统一化整改（已完成）

## 目标

将斜面外力从"select 选方向"改为"大小 + 角度 slider"，与水平面外力交互体验统一，同时解决沿斜面力与摩擦力/重力分量重叠的问题。

## 背景

阶段6 中斜面统一预设的外力实现为：
- `hasAppliedForce` toggle：有/无外力
- `appliedForce` slider：力的大小
- `forceDirection` select：沿斜面向上/向下（仅 2 个方向）

存在的问题：
1. **交互不一致**：水平面外力有角度 slider（-90°~90°），斜面只有 select
2. **力重叠**：沿斜面方向的外力箭头与摩擦力/重力沿斜面分量方向一致，视觉重叠
3. **需求覆盖不足**：需求文档 FM-011 要求外力方向支持"沿斜面/垂直斜面/任意角度"，当前只覆盖"沿斜面"

## 改造方案

### 角度定义

以**沿斜面向上**为 0°，逆时针为正：
- 0° = 沿斜面向上
- 90° = 垂直斜面向外（离开斜面）
- 180° / -180° = 沿斜面向下
- -90° = 垂直斜面向内（压入斜面）

### 预设参数变更

**文件**：`src/domains/mechanics/presets/inclined-surface.json`

替换：
```json
// 删除
{ "key": "forceDirection", "type": "select", ... }

// 替换为
{
  "key": "forceAngle",
  "label": "力的方向角 α",
  "type": "slider",
  "min": -180,
  "max": 180,
  "step": 1,
  "default": 0,
  "unit": "°",
  "targetEntityId": "block-A",
  "visibleWhen": { "hasAppliedForce": true }
}
```

`paramValues` 中：删除 `"forceDirection": "up"`，新增 `"forceAngle": 0`。

### 求解器变更

**文件**：`src/domains/mechanics/solvers/block-on-slope.ts`

当前逻辑：`FextSigned = appliedF * (forceDir === 'up' ? 1 : -1)`，外力只有沿斜面分量。

改为：
```typescript
// 读取角度
const forceAngleDeg = (scene.paramValues.forceAngle as number) ?? 0;
const forceAngleRad = (forceAngleDeg * Math.PI) / 180;

// 外力沿斜面分量（正=向上）和垂直斜面分量（正=离开斜面）
const FalongSlope = appliedF * Math.cos(forceAngleRad);  // 沿斜面向上为正
const FperpSlope = appliedF * Math.sin(forceAngleRad);    // 垂直斜面向外为正

// 支持力受影响：N = mg·cosθ - FperpSlope（外力垂直分量减小法向力）
let N = mg * cosA - FperpSlope;
if (N < 0) N = 0;

// 沿斜面净驱动力：重力下滑分量 - 外力沿斜面向上分量
const netDriveDown = mg * sinA - FalongSlope;
```

外力箭头方向向量（世界坐标系）：
```typescript
// 沿斜面向上方向 = (-cosA, sinA)
// 垂直斜面向外方向 = (sinA, cosA)  [已有 axis2]
// 外力方向 = cos(α) * 沿斜面向上 + sin(α) * 垂直斜面向外
const forceDirX = FalongSlope / appliedF * (-cosA) + FperpSlope / appliedF * sinA;
const forceDirY = FalongSlope / appliedF * sinA + FperpSlope / appliedF * cosA;
// 简化为：
const forceDirX = Math.cos(forceAngleRad) * (-cosA) + Math.sin(forceAngleRad) * sinA;
const forceDirY = Math.cos(forceAngleRad) * sinA + Math.sin(forceAngleRad) * cosA;
```

### 正交分解扩展

当外力不沿斜面方向时（`|forceAngleDeg| > 0.5`），外力也需要加入正交分解：
```typescript
decomposition.components.push({
  force: appliedForce,
  component1: -FalongSlope,   // 沿斜面分量（axis1 是向下，所以取反）
  component2: FperpSlope,     // 垂直斜面分量
  label1: 'F沿斜面',
  label2: 'F垂直斜面',
});
```

## 验证要点

1. `pnpm lint && pnpm tsc --noEmit` 通过
2. α=0° → 等价于旧"沿斜面向上"，行为不变
3. α=180° → 等价于旧"沿斜面向下"
4. α=90° → 外力垂直斜面向外，N 减小，纯分解场景
5. α=-90° → 外力压入斜面，N 增大
6. 力箭头方向与角度一致，不与其他力完全重叠（除非 α=0/180）
7. 手算验证：m=5kg, θ=30°, F=20N, α=60°, μ=0.2
   - F沿斜面 = 20·cos60° = 10N（向上）
   - F垂直斜面 = 20·sin60° = 17.32N（向外）
   - N = 5×9.8×cos30° - 17.32 = 42.43 - 17.32 = 25.11N
   - 净驱动力 = 5×9.8×sin30° - 10 = 24.5 - 10 = 14.5N（向下）
   - μN = 0.2×25.11 = 5.02N
   - 14.5 > 5.02 → 下滑，a = (14.5-5.02)/5 = 1.90 m/s²

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `src/domains/mechanics/presets/inclined-surface.json` — forceDirection select → forceAngle slider |
| 修改 | `src/domains/mechanics/solvers/block-on-slope.ts` — 外力分解为沿斜面+垂直斜面分量 |
| 修改 | `src/domains/mechanics/viewports/force-viewport.ts` — 独立力共线偏移防重合 |

## 交付 DoD

### 变更摘要
1. 预设 JSON：`forceDirection` select → `forceAngle` slider（-180°~180°, default 0°）
2. 求解器：外力按角度分解为沿斜面（cos α）+ 垂直斜面（sin α）分量，N 受垂直分量影响，摩擦力改用 μN
3. 正交分解：外力不沿斜面时（|α| > 0.5° 且 |α| 不近 180°）自动加入分解展示
4. 力箭头防重合：独立力渲染增加共线检测（|dot| > 0.87），后渲染的力垂直偏移 10px

### 验证结果
- `pnpm lint` ✅
- `pnpm tsc --noEmit` ✅
- 手算验证（m=5, θ=30°, F=20N, α=60°, μ=0.2）→ a=1.90 m/s² ✅
- 退化验证（α=0°/180°/90°/-90°）全部 ✅

### 风险与回滚
改动限于力学域 3 个文件，git revert 即可回滚。共线偏移逻辑独立于已有 tension/合力偏移，不影响已有行为。

### 审查结论
:white_check_mark: 实现完全匹配计划，额外修复了独立力共线重合问题
