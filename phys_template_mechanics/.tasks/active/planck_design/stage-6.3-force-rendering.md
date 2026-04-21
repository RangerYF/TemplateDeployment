# 6.3 力的可视化渲染 + 正交分解 ✅ 已完成

## 任务 ID
03-26-16-00-force-rendering

## 完成日期
2026-03-26

## 风险评估
- **任务类型**：新功能（渲染层 + 交互 + 动画）
- **风险等级**：L2（高风险）
  - 新增渲染模块，算法较多（对数缩放、边缘起点、共线防重叠、标签布局、分解动画）
  - 跨模块联动：renderer + Canvas hitTest + ForceCollector 数据消费
  - 与 6.2 ForceData[] 数据对接（编辑模式用 SceneForce，仿真模式用 ForceData[]）
  - 分解动画涉及帧间状态管理
- **流程路径**：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

在画布上渲染力箭头和标签，实现防重叠策略、力的 hitTest、正交分解及分解动画。本阶段完成后：
- 编辑模式受力视角下：外力显示带颜色的箭头+标签
- 仿真模式受力视角下：所有力（重力/支持力/摩擦力/张力/外力）显示箭头+标签
- 力箭头从物体边缘出发，长度对数缩放
- 方向相近的力箭头自动偏移防重叠
- 可选中力箭头（hitTest）
- 可对力进行正交分解（水平/竖直 或 沿斜面/垂直斜面），有四阶段渐入动画
- 合力箭头渲染（虚线+深灰+冗余检测）
- 移除 6.2 的调试文字渲染（用正式箭头替代）

## 上游依赖
- 6.1 基础设施 ✅（SceneForce + forceStore + ForceTool + RenderOptions）
- 6.2 力收集 ✅（ForceData[] 数据管道 + 调试渲染）

## 下游消费
- 6.4 视角+面板：消费 ForceRenderer，力列表面板中点击力项高亮画布对应箭头

---

## 关键数据确认

### 坐标约定
- **我们的 SceneBody.position = 几何中心**（与 p01 不同，p01 的 block 是底边中心）
- 因此 6.3 边缘起点计算不需要 p01 中的"偏移半高"修正
- 已验证：block/ball/wall/conveyor 的 hitTest 和 getSelectionBounds 均以 position 为中心

### 力数据来源
| 场景 | 数据来源 | ForceData 构造 |
|------|---------|---------------|
| 编辑模式·受力视角 | `scene.forces`（SceneForce[]） | 从 SceneForce 构造 ForceData（仅 external 类型） |
| 仿真模式·受力视角 | `forceDataRef.current`（ForceData[]） | ForceCollector 已收集完整 |

### 物体几何信息获取
渲染力箭头需要知道物体的几何中心和形状参数（用于边缘起点计算）。
- 编辑模式：直接读 SceneBody
- 仿真模式：读 BodyState（包含 position、angle、shape、userData.bodyType）

---

## 执行计划（8 步）

### 步骤 1：创建 ForceRenderer 模块 + 基础工具函数

**新建文件**：`src/renderer/ForceRenderer.ts`

**工具函数**：
```typescript
// 对数缩放：力大小 → 箭头像素长度
function forceToLength(magnitude: number): number
// MIN=30, MAX=180, BASE=100

// 边缘起点计算：从物体边缘出发而非质心
function getEdgeStart(
  center: { x: number; y: number },
  direction: { x: number; y: number },
  entity: { radius?: number; width?: number; height?: number; rotation?: number }
): { x: number; y: number }
// EDGE_GAP = 2px（屏幕空间）
// 圆形：offset = radius + gap
// 矩形：射线与旋转后矩形边界交点 + gap

// 力类型 → 颜色/标签
function getForceVisual(forceType: CollectedForceType): {
  color: string; label: string; chineseName: string
}
```

**颜色映射**（来自设计方案 A）：
| forceType | color | label | chineseName |
|-----------|-------|-------|-------------|
| gravity | `#16a34a` | G | 重力 |
| normal | `#8b5cf6` | N | 支持力 |
| friction | `#f97316` | f | 摩擦力 |
| tension | `#0891b2` | T | 张力 |
| external | `#ef4444` | F | 外力 |

### 步骤 2：实现力箭头和标签渲染

**在 ForceRenderer 中实现**：

```typescript
interface ForceRenderItem {
  bodyId: string
  forceType: CollectedForceType
  vector: { x: number; y: number }
  magnitude: number
  sourceId?: string
  // 渲染计算后的屏幕坐标
  screenFrom: { x: number; y: number }
  screenTo: { x: number; y: number }
  direction: { x: number; y: number } // 单位向量
  color: string
  label: string
}
```

**渲染流程**：
1. 将 ForceData[] 转为 ForceRenderItem[]（计算屏幕坐标、边缘起点、箭头长度）
2. 执行共线防重叠偏移（步骤 3）
3. 绘制每个箭头：
   - 起点圆点（3px 实心）
   - 箭杆直线（2px 线宽）
   - 箭头实心三角形（长 10px，底宽 8px）
4. 绘制标签（步骤 4 的标签布局后）

**箭头绘制函数**：
```typescript
function drawForceArrow(
  ctx: CanvasRenderingContext2D,
  item: ForceRenderItem,
  options: { selected?: boolean; hovered?: boolean; dashed?: boolean }
): void
```

### 步骤 3：实现共线防重叠

**三层策略**（来自 p01 参考文档）：

**层1：力-力共线偏移**
- 遍历同一物体的所有力
- 两力方向点积绝对值 > 0.87（cos30°）→ 后一个垂直偏移 `slot × 10px`
- 多个共线力递增轨道

**层2：力-连接件共线偏移**
- 获取物体关联的约束方向（从 scene.joints 中找关联 joint，计算连线方向）
- 力方向与约束方向点积 > 0.87 → 偏移到远离连接件一侧

**层3：合力特殊偏移**
- 合力与某独立力共线 → 偏移到"负方向轨道"（14px，方向相反）

**参数常量**：
```typescript
const COLLINEAR_THRESHOLD = 0.87  // cos(30°)
const COLLINEAR_OFFSET = 10       // px
const RESULTANT_OFFSET = 14       // px
```

### 步骤 4：实现标签布局

**标签候选位置生成**（来自 p01 参考文档）：
- 水平力（|dx| > |dy|）：尖端外侧上→尖端外侧下→中点上→中点下
- 竖直力（|dy| ≥ |dx|）：中点右→中点左→尖端右→尖端左
- 张力/弹簧力额外垂直偏移 TENSION_EXTRA=6px

**贪心布局**：
- 每个物体独立维护 occupied 列表
- 按力排列顺序（G→N→f→T→F→合力）逐一选第一个不重叠的候选
- AABB 包围盒 + LABEL_PAD=6px 间距
- 全部重叠时选最高偏好

**标签渲染**：
```
格式：「G 重力 = 19.6N」
字号：11px
颜色：与箭头同色
```

### 步骤 5：实现合力渲染

**合力计算**：
- 对每个物体所有可见力向量求和
- 冗余检测：合力≈某独立力（大小和方向差值 < 0.01）→ 不渲染
- 合力为零（< 0.01N）→ 不渲染箭头

**合力样式**：
- 虚线 `setLineDash([8, 4])`
- 颜色：深灰 `#374151`
- 标签：`F合 合力 = X.XN`

### 步骤 6：实现力的 hitTest

**在 Canvas.tsx 中扩展 hitTest 流程**：
- 在 SelectTool 的 hitTest 中（或 Canvas 的 hover 检测中）增加力箭头检测
- 检测逻辑：点到线段距离 < 5px（屏幕空间）
- 优先级：力箭头 hitTest 在物体 hitTest 之前（力在物体上方渲染）

**ForceRenderer 导出 hitTest 函数**：
```typescript
function hitTestForce(
  screenX: number, screenY: number,
  forceItems: ForceRenderItem[]
): string | null  // 返回匹配的 forceId 或 null
```

**选中态渲染**：
- 选中的力箭头变为蓝色 `#3b82f6`
- hover 态线宽从 2px → 2.5px

### 步骤 7：实现正交分解计算 + 渲染

**分解计算**：
```typescript
function decompose(
  vector: { x: number; y: number },
  axisAngle: number  // 0=水平竖直，θ=沿斜面
): { along: { x: number; y: number }; perp: { x: number; y: number } }
```
- `along` = vector 在 axis 方向的投影
- `perp` = vector 在 axis⊥ 方向的投影
- 向量投影公式：`proj = (v·â) × â`

**分解渲染**：
- 分量箭头：虚线 `setLineDash([6,4])`，颜色为原力颜色 50% 透明度
- 直角标记：小方块 6×6px，浅灰 `#94a3b8`
- 引导虚线：从原力终点到分量轴的垂直投影线

**分解状态管理**：
- 每个物体每个力的分解状态：`Map<string, DecompositionState>`
- `DecompositionState: { forceId, progress: 0-1, direction: 'in'|'out', axisAngle }`
- 由 Canvas 仿真/渲染循环驱动 progress 更新

### 步骤 8：分解动画 + 集成渲染管线

**四阶段渐入动画**（来自 p01 参考文档）：
- 总时长 0.8s 渐入，0.3s 渐出
- 阶段1（0-30%）：坐标轴参考线淡入（alpha=0.3）
- 阶段2（30-60%）：分量箭头从零长度生长 + 引导虚线
- 阶段3（50-80%）：直角标记淡入
- 阶段4（60-100%）：分量标签淡入

**集成到 CanvasRenderer**：
- `renderScene`（编辑模式）中替换 `// TODO 6.3` 注释为实际调用
- `render`（仿真模式）中移除 `renderForceDebug`，改为正式 ForceRenderer 调用
- 受力视角 flag 通过 RenderOptions 传入（`showForces: boolean`）

**RenderOptions 扩展**：
```typescript
showForces?: boolean          // 是否显示力箭头（受力视角开关）
forceData?: ForceData[]       // 仿真模式力数据
decompositions?: Map<string, DecompositionState>  // 分解动画状态
```

**移除 6.2 调试渲染**：删除 `renderForceDebug` 方法和 `render` 中的调试调用

---

## 涉及文件清单

### 新建文件（1个）
| 文件 | 作用 |
|------|------|
| `src/renderer/ForceRenderer.ts` | 力渲染核心模块（箭头+标签+防重叠+分解+hitTest） |

### 修改文件（3个）
| 文件 | 改动 |
|------|------|
| `src/renderer/CanvasRenderer.ts` | 集成 ForceRenderer 到编辑+仿真渲染管线，移除 renderForceDebug |
| `src/components/Canvas.tsx` | 力 hitTest 集成 + 分解状态管理 + forceData 传递到渲染 |
| `src/engine/types.ts` | 可能需要扩展 ForceData（如增加 label 字段给 external 力） |

### 读取文件（参考）
| 文件 | 用途 |
|------|------|
| `src/models/bodyTypes/*.tsx` | 获取物体几何参数（边缘起点计算） |
| `src/core/snap/SnapEngine.ts` | 获取接触面角度（分解方向候选） |
| `stage-6-p01-reference.md` | 算法参考 |

---

## 验收标准

### 力箭头渲染
✅ 编辑模式受力视角下，用户外力显示红色箭头+标签（`F 外力 = 10.0N`）
✅ 仿真模式受力视角下，物体显示所有力箭头（颜色区分 5 种类型）
✅ 箭头从物体边缘出发，不被物体遮挡
✅ 小力（1N）和大力（50N）共存时都清晰可见（对数缩放生效）
✅ 箭头头部为实心三角形，起点有小圆点

### 防重叠
✅ 水平面上物块的重力（↓）和支持力（↑）不重叠（共线偏移生效）
✅ 约束张力与绳/杆方向共线时，箭头偏移到一侧
✅ 标签不互相重叠（贪心布局生效）

### 合力
✅ 合力用虚线深灰箭头显示
✅ 合力≈某独立力时自动不显示（冗余检测）
✅ 受力平衡时（合力≈0）不显示合力箭头

### hitTest
✅ 鼠标 hover 力箭头时箭头加粗
✅ 点击力箭头可选中，选中后变蓝色

### 正交分解
✅ 对重力进行水平/竖直分解，分量箭头为原力色 50% 透明虚线
✅ 分解有四阶段渐入动画（参考线→分量→直角标记→标签）
✅ 取消分解有 0.3s 渐出
✅ 斜面上物体可选择"沿斜面/垂直斜面"分解方向

### 门禁
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 6.2 的调试文字渲染已移除

## 验收中发现的 Bug 及修复

### Bug 1：仿真模式力箭头不跟随物体运动
- **现象**：播放仿真后力箭头停留在编辑时的位置
- **原因**：`renderForces` 接收 `SceneBody[]`（编辑时静态位置），仿真时 position/angle 不更新
- **修复**：Canvas.tsx 中用 `BodyState[]` 的实时 position/angle 合并到 SceneBody 后再传入

### Bug 2：力箭头默认全部显示
- **现象**：仿真播放后所有物体（含地面）都显示力箭头
- **原因**：`showForces` 被硬编码为 `true`，应默认 `false` 等 6.4 视角开关控制
- **修复**：编辑模式 `showForces: false`，仿真模式不传 forceData 给 renderForces

## 不包含的内容（留给 6.4）
- viewMode 状态管理（editorStore 扩展）
- 视角切换 UI 按钮
- 属性面板「受力分析」Tab
- 力列表面板中的显隐控制和编辑交互
- 快捷键 1/2 切换视角
- ForceTool 仅在受力视角下可用的限制
