# 阶段2.1：斜面力方向修复

> 任务ID：03-18-22-00-P01-stage2.1-force-dir
> 风险等级：L1（多文件修改，核心物理逻辑）
> 流程路径：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成**

## 问题描述

斜面·静止平衡预设（slope-static, θ=30°, μ=0.7）中：
- 合力 F合=17N，但静止场景应为 0
- N=17N 方向似乎不正确
- f=9.8N 方向似乎不正确

用户截图显示三个力无法达成平衡，说明力方向向量有根本性错误。

## 研究内容

### 1. 斜面几何与力方向推导

斜面几何（我们的坐标系）：
```
  topCorner (x, y+h)
       /|
      / |
     /  | h = L·sinθ
    /θ__|
 bottomLeft     bottomRight (x+bw, y)
 (slopePos)      bw = L·cosθ
```

斜边从 bottomRight → topCorner，方向 (-cosθ, sinθ)

物理坐标系：X 向右，Y 向上

### 2. 正确的力方向

对于θ=30°斜面（从右下到左上的斜边）：

**沿斜面向上**（从 bottomRight 向 topCorner）：
- 方向 = (-cosθ, sinθ) = (-0.866, 0.5)

**沿斜面向下**（从 topCorner 向 bottomRight）：
- 方向 = (cosθ, -sinθ) = (0.866, -0.5)

**垂直斜面向外**（斜面法线，指向斜面上方）：
- 斜边方向 (-cosθ, sinθ)，法线 = 逆时针旋转90° = (-sinθ, -cosθ)？
  - 不对，(-sinθ, -cosθ) = (-0.5, -0.866) 指向右下方，这是指向斜面内部
- 正确：顺时针旋转90° = (sinθ, cosθ) = (0.5, 0.866) — 指向右上方？
  - 不对，对于从右下到左上的斜面，法线外侧应该指向右上方

验证：斜边方向 d = (-cosθ, sinθ)
- 逆时针90°旋转：(-sinθ, -cosθ) — 指向斜面内侧 ✗
- 顺时针90°旋转：(sinθ, cosθ) — 指向斜面外侧 ✓

所以 **垂直斜面向外 = (sinθ, cosθ)**

### 3. 当前代码的力方向

求解器中：
```
N direction: { x: -sinA, y: cosA }  // (-0.5, 0.866)
f direction (向上): { x: -cosA, y: sinA }  // (-0.866, 0.5)
```

### 4. 验证：(-sinθ, cosθ) vs (sinθ, cosθ)

N = (-sinθ, cosθ) = (-0.5, 0.866)
- 这个向量点乘斜边方向 (-cosθ, sinθ)：(-0.5)(-0.866) + (0.866)(0.5) = 0.433 + 0.433 = 0.866 ≠ 0
- **不垂直于斜面！这就是 bug！**

N = (sinθ, cosθ) = (0.5, 0.866)
- 点乘斜边方向 (-cosθ, sinθ)：(0.5)(-0.866) + (0.866)(0.5) = -0.433 + 0.433 = 0 ✓
- **垂直于斜面！正确！**

### 5. Bug 根因

求解器中支持力方向写成了 `(-sinA, cosA)`，实际应该是 `(sinA, cosA)`。
摩擦力方向同理：沿斜面向上写成了 `(-cosA, sinA)` 实际应该是 `(-cosA, sinA)`...

让我重新推导所有方向：

斜边方向（向上）= (-cosθ, sinθ)
- 点乘验证 (sinθ, cosθ)·(-cosθ, sinθ) = -sinθcosθ + cosθsinθ = 0 ✓ 法线正确

沿斜面向上 = (-cosθ, sinθ) — 与斜边方向一致
沿斜面向下 = (cosθ, -sinθ)
垂直斜面向外 = (sinθ, cosθ) — 顺时针90°旋转斜边方向

**当前代码错误**：
- N: `(-sinA, cosA)` ✗ → 应为 `(sinA, cosA)` ✓
- f 向上: `(-cosA, sinA)` — 这恰好是斜边方向 ✓（碰巧正确）
- f 向下: `(cosA, -sinA)` ✓

等等，让我重新检查 f 的方向：
- 沿斜面向上 = 斜边方向 = (-cosθ, sinθ)
- 代码中 f 向上: `(-cosA, sinA)` = (-cosθ, sinθ) ✓

所以**唯一的 bug 是支持力 N 的方向**：`(-sinA, cosA)` 应该是 `(sinA, cosA)`。

### 6. 合力验证

修正后 (θ=30°, μ=0.7, m=2kg):
- G = 19.6 × (0, -1) = (0, -19.6)
- N = 17.0 × (sin30°, cos30°) = 17 × (0.5, 0.866) = (8.5, 14.72)
- f = 9.8 × (-cos30°, sin30°) = 9.8 × (-0.866, 0.5) = (-8.49, 4.9)
- 合力 = (0 + 8.5 - 8.49, -19.6 + 14.72 + 4.9) = (0.01, 0.02) ≈ 0 ✓

### 7. 正交分解轴方向也需检查

axis2 (垂直斜面向外) 当前 = `(-sinA, cosA)`，同样错误，应为 `(sinA, cosA)`

## 修复计划

| # | 文件 | 改动 |
|---|------|------|
| 1 | `solvers/block-on-slope.ts` | N direction: `(-sinA, cosA)` → `(sinA, cosA)` |
| 2 | `solvers/block-on-slope.ts` | axis2: `(-sinA, cosA)` → `(sinA, cosA)` |
| 3 | `solvers/block-on-slope.ts` | decomposition component2 符号：`-mg*cosA` → 检查是否需调整 |

## 验收标准

- [x] θ=30°, μ=0.7 静止场景合力 = 0（手算验证：合力≈0）
- [x] N 方向 (sinθ, cosθ) 垂直斜面向外 ✓
- [x] f 方向 (-cosθ, sinθ) 沿斜面向上 ✓（原本就正确）
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 修复记录

仅改了 `solvers/block-on-slope.ts` 中两处：
1. N direction: `(-sinA, cosA)` → `(sinA, cosA)`
2. axis2 (分解轴): `(-sinA, cosA)` → `(sinA, cosA)`

根因：斜边方向 (-cosθ, sinθ) 的法线应该是**顺时针**旋转90° = (sinθ, cosθ)，代码错误地用了**逆时针**旋转 = (-sinθ, -cosθ) 的 y 取反版。
