# 修复绳张力方向

> 任务ID：03-20-21-00-P01-fix-tension-direction
> 风险等级：L1（1~3 文件改动，常规功能修复）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**待执行**
> 关联：阶段7 连接体模型

## 问题描述

用户反馈：水平绳连场景中，绳张力方向显示错误。

**当前行为**：
- T 在 block-A（左）上方向为 ← 左（从物体向外推）
- T 在 block-B（右）上方向为 → 右（从物体向外推）
- 视觉效果像是"杆在推物体"

**正确行为**：
- T 在 block-A（左）上方向为 → 右（绳拉 A 向右，朝绳/B 的方向）
- T 在 block-B（右）上方向为 ← 左（绳拉 B 向左，朝绳/A 的方向）
- 视觉效果应为"绳在拉物体"

**物理原理**：
绳只能提供拉力（tension），力的方向从物体指向绳的连接点，即从物体指向另一个物体的方向。杆则可以提供推力（compression）和拉力，推力方向从物体向外。

## 根因分析

当前求解器中张力方向的设定：

```
F → [A]——rope——[B]
```

### 当前代码（错误）

`rope-connected-horizontal.ts`:
```typescript
// Block A: T 向左
forcesA.push({ type: 'tension', label: 'T', direction: { x: -1, y: 0 } });
// Block B: T 向右
forcesB.push({ type: 'tension', label: 'T', direction: { x: 1, y: 0 } });
```

### 修正方案

```typescript
// Block A: T 向右（绳拉 A 朝向 B）
forcesA.push({ type: 'tension', label: 'T', direction: { x: 1, y: 0 } });
// Block B: T 向左（绳拉 B 朝向 A）
forcesB.push({ type: 'tension', label: 'T', direction: { x: -1, y: 0 } });
```

### 牛顿方程也需同步修正

当前：
- A: F - T - fA = m₁a → T 在等式中被减去（T 反向于 F）
- B: T - fB = m₂a → T 在等式中为正（T 同向于运动）

修正后张力方向翻转，但力学方程不变（只是箭头渲染方向变了，数学求解逻辑不需改）。

**关键**：求解器中的力方程本身是标量方程，T 的大小和加速度的计算都是正确的。只是 `direction` 字段（用于箭头渲染）需要翻转。合力计算需要用修正后的 direction 重新算。

## 影响范围

| 文件 | 修改内容 |
|------|---------|
| `solvers/rope-connected-horizontal.ts` | 翻转 T 的 direction，重算合力 |
| `solvers/rope-connected-incline.ts` | 同理翻转 T 在 block-B 上的方向（朝向滑轮→朝向物块？需确认） |
| `solvers/spring-connected-horizontal.ts` | 弹簧力方向同理检查（弹簧可推可拉，方向逻辑可能不同） |

## 验证要点

1. 水平绳连隔离法：T 在 A 上指向右（朝 B），T 在 B 上指向左（朝 A）
2. 斜面绳连隔离法：T 在 A 上指向滑轮，T 在 B 上指向上方（绳拉 B 向上）— 这个已经正确
3. 合力计算结果不变（T 大小不变，方向翻转后向量合力需重算）
4. 弹簧连两物体：F弹方向确认（弹簧被拉伸时，弹力方向应从物体指向弹簧=指向对方物块）
5. `pnpm lint && pnpm tsc --noEmit` 通过
