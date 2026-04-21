# 阶段6 p01 实战参考文档

> 来源：`/Users/cjn/Documents/工作/edu/phys_template_p01/`
> 用途：阶段6各子阶段实施时的详细技术参考，包含 p01 中经过验证的算法和参数。

---

## 一、对应子阶段索引

| 参考内容 | 对应子阶段 | p01 源文件 |
|---------|-----------|-----------|
| 对数缩放 | 6.3 力渲染 | `force-viewport.ts:138-142` |
| 边缘起点计算 | 6.3 力渲染 | `force-viewport.ts:144-185` |
| 共线防重叠 | 6.3 力渲染 | `force-viewport.ts:454-532` |
| 标签候选生成 | 6.3 力渲染 | `force-viewport.ts:75-133` |
| 标签布局算法 | 6.3 力渲染 | `placement.ts:35-54` |
| 合力渲染 | 6.3 力渲染 | `force-viewport.ts:577-620` |
| 分解动画 | 6.3 力渲染+分解 | `force-interaction-handler.ts:146-408` |
| 物体中心计算 | 6.3 力渲染 | `force-viewport.ts:426-433` |

---

## 二、对数缩放算法（6.3 力渲染）

### 问题
线性映射 `length = magnitude × factor` 导致小力（1N）和大力（50N）共存时，小力箭头几乎不可见。

### 解决方案
```typescript
const MIN_LENGTH = 30;   // px
const MAX_LENGTH = 180;  // px
const BASE = 100;        // 力的典型范围参考值

export function forceToLength(magnitude: number): number {
  if (magnitude <= 0) return 0;
  const len = MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) *
              Math.log(1 + magnitude) / Math.log(1 + BASE);
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, len));
}
```

### 效果对比
| 力大小 | 线性(3px/N) | 对数缩放 |
|--------|------------|---------|
| 1N | 3px（不可见）| 34px |
| 5N | 15px（很短）| 55px |
| 10N | 30px | 73px |
| 20N | 60px | 97px |
| 50N | 150px | 133px |
| 100N | 300px（超出）| 180px |

### 适配建议
- 我们的场景力量级通常在 1-100N，BASE=100 合适
- 如果未来需要处理更大力（如天体引力），可调整 BASE
- 速度/加速度矢量（阶段7）可用不同 BASE（p01 分别用 50 和 30）

---

## 三、物体边缘起点计算（6.3 力渲染）

### 问题
从质心出发的力箭头会被物体本身遮挡。

### 算法：getEdgeStart
```typescript
const EDGE_GAP = 0.02; // 米（世界坐标），约 2px

export function getEdgeStart(
  center: Vec2,       // 物体几何中心（世界坐标）
  direction: Vec2,    // 力方向（单位向量）
  entity: { radius?: number; width?: number; height?: number; rotation?: number }
): Vec2 {
  const dx = direction.x, dy = direction.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return center;

  let offset: number;

  if (entity.radius != null && entity.radius > 0) {
    // ─── 圆形 ───
    offset = entity.radius + EDGE_GAP;

  } else if (entity.width != null && entity.height != null) {
    // ─── 矩形（需处理旋转）───
    const rot = entity.rotation ?? 0;

    // 将力方向转到物体局部坐标系
    let localDx = dx, localDy = dy;
    if (Math.abs(rot) > 1e-6) {
      const cosR = Math.cos(-rot);
      const sinR = Math.sin(-rot);
      localDx = dx * cosR - dy * sinR;
      localDy = dx * sinR + dy * cosR;
    }

    // 射线参数法求与矩形边界的交点
    const halfW = entity.width / 2;
    const halfH = entity.height / 2;
    const tX = Math.abs(localDx) > 1e-9 ? halfW / Math.abs(localDx) : Infinity;
    const tY = Math.abs(localDy) > 1e-9 ? halfH / Math.abs(localDy) : Infinity;
    offset = Math.min(tX, tY) + EDGE_GAP;

  } else {
    return center;
  }

  const len = Math.hypot(dx, dy);
  return {
    x: center.x + (dx / len) * offset,
    y: center.y + (dy / len) * offset,
  };
}
```

### 注意：block 的中心计算
p01 中 block 的 `position` 是底边中心，几何中心需偏移半高：
```typescript
const center = {
  x: pos.x + (-Math.sin(rotation)) * (height / 2),
  y: pos.y + Math.cos(rotation) * (height / 2),
};
```

**我们的项目需验证**：检查 `SceneBody.position` 的约定（底边中心 vs 几何中心），在 6.3 实施前通过读取实际数据确认。

---

## 四、共线防重叠算法（6.3 力渲染）

### 三层分层策略

#### 层1：力-力共线偏移
```typescript
const COLLINEAR_THRESHOLD = 0.87; // cos(30°)
const COLLINEAR_OFFSET = 10;      // px（屏幕空间）

function resolveForceForceCollinear(
  forces: ForceRenderData[],       // 该物体所有可见力
): ForceRenderData[] {
  const result = [...forces];

  for (let i = 1; i < result.length; i++) {
    let slot = 0;
    for (let j = 0; j < i; j++) {
      const dot = Math.abs(
        result[i].direction.x * result[j].direction.x +
        result[i].direction.y * result[j].direction.y
      );
      if (dot > COLLINEAR_THRESHOLD) {
        slot++;
      }
    }
    if (slot > 0) {
      // 垂直于力方向偏移
      const perpX = -result[i].direction.y * slot * COLLINEAR_OFFSET;
      const perpY = result[i].direction.x * slot * COLLINEAR_OFFSET;
      result[i].screenFrom.x += perpX;
      result[i].screenFrom.y += perpY;
      result[i].screenTo.x += perpX;
      result[i].screenTo.y += perpY;
    }
  }
  return result;
}
```

#### 层2：力-连接件共线偏移
```typescript
function resolveForceConnectorCollinear(
  force: ForceRenderData,
  connectorDirs: Vec2[],  // 该物体关联的所有绳/杆/弹簧方向
): number {
  let connSlot = 0;
  for (const connDir of connectorDirs) {
    const dot = Math.abs(
      force.direction.x * connDir.x + force.direction.y * connDir.y
    );
    if (dot > COLLINEAR_THRESHOLD) {
      connSlot++;
    }
  }
  return connSlot * COLLINEAR_OFFSET;
}
```

#### 层3：合力特殊偏移
```typescript
const RESULTANT_OFFSET = 14; // px，比独立力的 10px 稍大

// 合力偏移到"负方向轨道"（与独立力正方向相反）
if (isCollinearWithAnyForceOrConnector) {
  perpX = -resultantDir.y * RESULTANT_OFFSET;  // 注意负号
  perpY = -resultantDir.x * RESULTANT_OFFSET;  // 与独立力偏移方向相反
}
```

### 关键参数总结
| 参数 | 值 | 含义 |
|------|------|------|
| COLLINEAR_THRESHOLD | 0.87 (cos30°) | 共线判定阈值 |
| COLLINEAR_OFFSET | 10px | 力-力/力-连接件偏移步长 |
| RESULTANT_OFFSET | 14px | 合力偏移距离 |

---

## 五、标签候选位置生成（6.3 力渲染）

### 核心逻辑：根据力方向选择不同的标签放置策略

```typescript
const LABEL_OFFSET = 12;      // 基础偏移距离 px
const LABEL_EXTRA_OFFSET = 4; // 竖直力额外偏移 px
const TENSION_EXTRA = 6;      // 张力/弹簧力额外偏移 px

interface LabelCandidate {
  x: number;
  y: number;
  align: 'left' | 'center' | 'right';
}

export function generateLabelCandidates(
  screenFrom: Vec2,
  screenTo: Vec2,
  direction: Vec2,
): LabelCandidate[] {
  const mid = {
    x: (screenFrom.x + screenTo.x) / 2,
    y: (screenFrom.y + screenTo.y) / 2,
  };
  const tip = screenTo;
  const off = LABEL_OFFSET;

  const isHorizontal = Math.abs(direction.x) > Math.abs(direction.y);
  const goesRight = direction.x > 0;
  const goesUp = direction.y > 0;

  const candidates: LabelCandidate[] = [];

  if (isHorizontal) {
    // 水平力：优先尖端外侧，备选中点
    candidates.push({
      x: tip.x + (goesRight ? off : -off),
      y: tip.y - off,
      align: goesRight ? 'left' : 'right',
    });
    candidates.push({
      x: tip.x + (goesRight ? off : -off),
      y: tip.y + off,
      align: goesRight ? 'left' : 'right',
    });
    candidates.push({ x: mid.x, y: mid.y - off, align: 'center' });
    candidates.push({ x: mid.x, y: mid.y + off, align: 'center' });
  } else {
    // 竖直力：优先中点侧面，备选尖端侧面
    const extraOff = off + LABEL_EXTRA_OFFSET;
    candidates.push({ x: mid.x + extraOff, y: mid.y, align: 'left' });
    candidates.push({ x: mid.x - extraOff, y: mid.y, align: 'right' });
    candidates.push({
      x: tip.x + extraOff,
      y: tip.y + (goesUp ? -off : off),
      align: 'left',
    });
    candidates.push({
      x: tip.x - extraOff,
      y: tip.y + (goesUp ? -off : off),
      align: 'right',
    });
  }

  return candidates;
}
```

### 张力/弹簧力的额外偏移
```typescript
// 在候选生成后，对张力/弹簧力整体偏移
if (forceType === 'tension' || forceType === 'spring') {
  const sdx = screenTo.x - screenFrom.x;
  const sdy = screenTo.y - screenFrom.y;
  const slen = Math.hypot(sdx, sdy);
  if (slen > 1) {
    const px = -sdy / slen * TENSION_EXTRA;
    const py = sdx / slen * TENSION_EXTRA;
    candidates = candidates.map(c => ({
      ...c, x: c.x + px, y: c.y + py,
    }));
  }
}
```

---

## 六、标签贪心布局算法（6.3 力渲染）

```typescript
const LABEL_PAD = 6; // 标签间最小间距 px

interface PlacementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxesOverlap(a: PlacementBox, b: PlacementBox, pad: number): boolean {
  return !(
    a.left + a.width + pad < b.left ||
    b.left + b.width + pad < a.left ||
    a.top + a.height + pad < b.top ||
    b.top + b.height + pad < a.top
  );
}

export function placeLabel(
  candidates: LabelCandidate[],
  labelWidth: number,
  labelHeight: number,
  occupied: PlacementBox[],
): { left: number; top: number } {
  for (const cand of candidates) {
    const box: PlacementBox = {
      left: cand.x,
      top: cand.y,
      width: labelWidth,
      height: labelHeight,
    };
    const overlaps = occupied.some(obs => boxesOverlap(box, obs, LABEL_PAD));
    if (!overlaps) {
      occupied.push(box);
      return { left: cand.x, top: cand.y };
    }
  }
  // 全部重叠 → 选最高偏好
  const fallback = candidates[0];
  occupied.push({
    left: fallback.x,
    top: fallback.y,
    width: labelWidth,
    height: labelHeight,
  });
  return { left: fallback.x, top: fallback.y };
}
```

### 使用流程
```
对于每个物体：
  1. occupied = []（每个物体独立防重叠）
  2. 按力排列顺序遍历（重力→支持力→摩擦力→张力→外力→合力）
  3. 每个力：generateLabelCandidates → placeLabel
  4. 已放置的标签加入 occupied，影响后续标签
```

---

## 七、合力渲染策略（6.3 力渲染）

### 冗余检测
```typescript
function isResultantRedundant(
  resultantMag: number,
  resultantDir: Vec2,
  forces: ForceData[],
): boolean {
  if (resultantMag < 0.01) return true; // 合力为零不画

  return forces.some(f =>
    Math.abs(f.magnitude - resultantMag) < 0.01 &&
    Math.abs(f.direction.x - resultantDir.x) < 0.01 &&
    Math.abs(f.direction.y - resultantDir.y) < 0.01
  );
}
```

### 渲染样式
- 虚线 `setLineDash([8, 4])`
- 颜色：深灰 `#374151`
- 箭头头部同样实心三角形
- 偏移到负轨道（14px，与独立力方向相反）

---

## 八、分解动画分阶段渐进（6.3 力渲染+分解）

### 状态管理
```typescript
interface DecompositionState {
  forceId: string;
  progress: number;       // 0~1
  direction: 'in' | 'out';
  axisAngle: number;      // 分解坐标系角度（0=水平竖直，θ=沿斜面）
}

function updateProgress(state: DecompositionState, dt: number): void {
  if (state.direction === 'in') {
    state.progress = Math.min(1, state.progress + dt / 0.8);  // 0.8s 渐入
  } else {
    state.progress = Math.max(0, state.progress - dt / 0.3);  // 0.3s 渐出
  }
}
```

### 渲染各阶段
```typescript
function renderDecomposition(
  ctx: CanvasRenderingContext2D,
  state: DecompositionState,
  force: ForceRenderData,
  components: { along: Vec2; perp: Vec2 },  // 分量向量
): void {
  const p = state.progress;

  // ─── 阶段1：坐标轴参考线（0%-30%）───
  if (p > 0) {
    const axisAlpha = Math.min(1, p / 0.3) * 0.3;
    ctx.globalAlpha = axisAlpha;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    // 画两条过起点的参考线（沿分解方向 + 垂直分解方向）
    drawAxisLine(ctx, force.screenFrom, state.axisAngle);
    drawAxisLine(ctx, force.screenFrom, state.axisAngle + Math.PI / 2);
    ctx.setLineDash([]);
  }

  // ─── 阶段2：分量箭头 + 引导虚线（30%-60%）───
  if (p > 0.3) {
    const growFactor = Math.min(1, (p - 0.3) / 0.3);
    ctx.globalAlpha = growFactor;

    // 分量箭头（从零长度生长）
    drawComponentArrow(ctx, force, components.along, growFactor);
    drawComponentArrow(ctx, force, components.perp, growFactor);

    // 引导虚线：原力终点到分量轴的投影线
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    drawProjectionLine(ctx, force.screenTo, components.along, state.axisAngle);
    drawProjectionLine(ctx, force.screenTo, components.perp, state.axisAngle);
    ctx.setLineDash([]);
  }

  // ─── 阶段3：直角标记（50%-80%）───
  if (p > 0.5) {
    const markAlpha = Math.min(1, (p - 0.5) / 0.3);
    ctx.globalAlpha = markAlpha;
    drawRightAngleMark(ctx, force.screenFrom, state.axisAngle, 6);
  }

  // ─── 阶段4：分量标签（60%-100%）───
  if (p > 0.6) {
    const labelAlpha = Math.min(1, (p - 0.6) / 0.4);
    ctx.globalAlpha = labelAlpha;
    drawComponentLabel(ctx, components.along, force.forceType);
    drawComponentLabel(ctx, components.perp, force.forceType);
  }

  ctx.globalAlpha = 1; // 恢复
}
```

### 关键参数
| 参数 | 值 | 含义 |
|------|------|------|
| 渐入总时长 | 0.8s | 从触发到完全显示 |
| 渐出总时长 | 0.3s | 从取消到完全消失 |
| 参考线 alpha | 0.3 | 参考线最大不透明度（不抢主角） |
| 引导虚线 | [3,3], 1px | 细而轻的视觉引导 |
| 直角标记 | 6×6px | 小方块 |
| 标签延迟 | 60% 时开始 | 最后出现，避免信息过载 |

---

## 九、参数速查表

| 参数名 | 值 | 用途 | 所属子阶段 |
|--------|------|------|-----------|
| MIN_LENGTH | 30px | 箭头最小长度 | 6.3 |
| MAX_LENGTH | 180px | 箭头最大长度 | 6.3 |
| BASE | 100 | 对数缩放参考值 | 6.3 |
| EDGE_GAP | 2px / 0.02m | 箭头起点到物体表面间距 | 6.3 |
| COLLINEAR_THRESHOLD | 0.87 (cos30°) | 共线判定阈值 | 6.3 |
| COLLINEAR_OFFSET | 10px | 力-力共线偏移步长 | 6.3 |
| RESULTANT_OFFSET | 14px | 合力偏移距离 | 6.3 |
| LABEL_OFFSET | 12px | 标签基础偏移 | 6.3 |
| LABEL_EXTRA_OFFSET | 4px | 竖直力标签额外偏移 | 6.3 |
| TENSION_EXTRA | 6px | 张力标签远离连接件偏移 | 6.3 |
| LABEL_PAD | 6px | 标签间最小间距 | 6.3 |
| 分解渐入 | 0.8s | 分解动画总时长 | 6.3 |
| 分解渐出 | 0.3s | 取消分解动画时长 | 6.3 |
| 参考线 max alpha | 0.3 | 不抢视觉焦点 | 6.3 |
