# 第3阶段：物体类型扩展

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：3天
- **风险等级**：L1（多文件改动，涉及物理 Shape 映射和渲染扩展）
- **状态**：已完成
- **前置阶段**：第2阶段（已完成）

---

## 目标
实现全部 MVP 基础物体类型（斜面、墙壁、固定锚点、杆件），每种物体有正确的物理形状、Canvas 渲染外观和属性面板编辑。

---

## 阶段2现状（依赖分析）

当前已有物体类型：
- `block`（矩形物块）：Box Shape，动态体
- `ball`（球体）：Circle Shape，动态体
- `ground`（地面）：Edge Shape，静态体，内置不可删除

需要扩展的 MVP 物体类型（来自设计文档 5.1）：
- `slope`（斜面）：三角形，静态体
- `wall`（墙壁）：竖直矩形，静态体
- `anchor`（固定锚点）：小圆点，静态体 — 第4阶段约束系统的挂载点
- `bar`（杆件）：细长矩形，动态体 — 杠杆模型

扩展涉及的代码路径（每种新物体类型都需改动）：
1. `models/types.ts` — BodyType 联合类型
2. `models/defaults.ts` — 默认值工厂函数
3. `engine/types.ts` — ShapeConfig 联合类型
4. `engine/sceneSync.ts` — SceneBody → BodyConfig 转换
5. `engine/PhysicsBridge.ts` — createShape 方法
6. `renderer/CanvasRenderer.ts` — renderSceneBody + renderBody
7. `core/hitTest.ts` — hitTestBody 形状检测
8. `components/panels/ObjectPanel.tsx` — 物体面板新增项
9. `components/panels/PropertyPanel.tsx` — 特有属性编辑

---

## 子任务链路（串行）

```
T3.1 类型定义与默认值扩展
→ T3.2 斜面（slope）完整实现
→ T3.3 墙壁（wall）完整实现
→ T3.4 固定锚点（anchor）完整实现
→ T3.5 杆件（bar）完整实现
→ T3.6 面板扩展 + 集成验证 + 提交
```

---

## T3.1 类型定义与默认值扩展

**目标**：一次性完成所有新物体类型的类型定义和默认值，为后续逐一实现做准备

**任务**：
1. 扩展 `src/models/types.ts`：
   - BodyType 增加：`'slope' | 'wall' | 'anchor' | 'bar'`
   - SceneBody 增加特有属性：
     ```typescript
     // slope (斜面)
     baseLength?: number    // 底边长度 (m)
     slopeHeight?: number   // 斜面高度 (m)

     // wall
     wallWidth?: number     // 墙壁宽度 (m，默认较薄 0.2)
     wallHeight?: number    // 墙壁高度 (m)

     // anchor
     anchorRadius?: number  // 锚点半径 (m，默认 0.1)
     mountSide?: 'top' | 'left' | 'right'  // 挂载侧

     // bar
     barLength?: number     // 杆件长度 (m)
     barThickness?: number  // 杆件厚度 (m，默认 0.1)
     ```
2. 扩展 `src/models/defaults.ts`：
   - `createDefaultSlope()` — baseLength=3, slopeHeight=2, isStatic=true, friction=0.4
   - `createDefaultWall()` — wallWidth=0.2, wallHeight=3, isStatic=true
   - `createDefaultAnchor()` — anchorRadius=0.1, isStatic=true, mountSide='top'
   - `createDefaultBar()` — barLength=2, barThickness=0.1, isStatic=false
   - 扩展 `generateLabel()` 支持新类型名称映射（斜面、墙壁、锚点、杆件）
3. 扩展 `src/engine/types.ts` — ShapeConfig 增加：
   ```typescript
   | { type: 'polygon'; vertices: Array<{ x: number; y: number }> }
   ```
   polygon 类型用于斜面的三角形 Shape

**产出**：完整类型定义 + 默认值，后续子任务逐一实现物理/渲染/hitTest

**验收**：`pnpm tsc --noEmit` 通过

---

## T3.2 斜面（slope）完整实现

**目标**：斜面可创建、渲染、物理碰撞正确，物块能沿斜面下滑

**任务**：
1. **物理 Shape 映射**（`engine/sceneSync.ts`）：
   - 斜面 = 三角形 Polygon Shape
   - 顶点计算（以物体 position 为重心/参考点）：
     ```
     右三角形，底边在下方，直角在左下：
     v0 = (-baseLength/2, -slopeHeight/3)    // 左下角
     v1 = (baseLength/2, -slopeHeight/3)     // 右下角
     v2 = (-baseLength/2, 2*slopeHeight/3)   // 左上角（直角顶点在左上方）
     ```
     注意：Planck.js Polygon 顶点需逆时针排列
   - density=0（静态体）
2. **PhysicsBridge.createShape**（`engine/PhysicsBridge.ts`）：
   - 增加 `polygon` case：使用 `PolygonShape` 从顶点数组创建
   - 需要导入 `PolygonShape` from planck-js
3. **Canvas 渲染**（`renderer/CanvasRenderer.ts`）：
   - `renderSceneBody` 增加 slope case：
     - 计算三角形三个顶点的屏幕坐标
     - 填充 + 描边三角形
     - 静态体颜色方案
   - `renderBody` 增加 polygon case（仿真模式）：
     - 从 BodyState.shape.vertices 读取顶点渲染
4. **hitTest**（`core/hitTest.ts`）：
   - 增加 slope case：点在三角形内检测
   - 使用重心坐标法或叉积法判断点是否在三角形内
5. **斜面方向**：
   - 默认直角在左下（从左到右上升）
   - 通过 angle 属性旋转可改变朝向（如设 angle=π 则变为从右到左上升）
   - 属性面板中角度控制即可实现方向翻转

**验收**：
- ✅ 从面板拖出斜面到画布，显示为三角形
- ✅ 选中斜面可编辑底边长度、高度
- ✅ 仿真模式：物块放在斜面上能沿斜面下滑
- ✅ 斜面 hitTest 正确（点击三角形内部可选中）

---

## T3.3 墙壁（wall）完整实现

**目标**：墙壁可创建，竖直矩形静态体

**任务**：
1. **物理 Shape 映射**（`engine/sceneSync.ts`）：
   - 墙壁 = Box Shape（wallWidth × wallHeight），与 block 类似
   - isStatic=true, density=0
2. **Canvas 渲染**：
   - 复用矩形渲染逻辑，使用 wallWidth/wallHeight
   - 静态体颜色方案（与 block 的动态体颜色区分）
3. **hitTest**：
   - 复用矩形检测逻辑，使用 wallWidth/wallHeight

**设计说明**：
- 墙壁本质是静态矩形，与物块共享渲染逻辑，区别仅在于默认参数（薄而高）和颜色
- 用户也可将 block 设为 isStatic=true 来当墙壁用，但 wall 类型提供更合理的默认值

**验收**：
- ✅ 从面板拖出墙壁，显示为竖直细长矩形
- ✅ 仿真模式：物体撞到墙壁会被阻挡

---

## T3.4 固定锚点（anchor）完整实现

**目标**：锚点可创建，用于第4阶段作为绳/杆/弹簧的固定端

**任务**：
1. **物理 Shape 映射**（`engine/sceneSync.ts`）：
   - 锚点 = Circle Shape（anchorRadius），isStatic=true
2. **Canvas 渲染**：
   - 小实心圆 + 外圈描边
   - 使用深色填充，与动态球体区分
   - 根据 mountSide 渲染挂载标记（顶部=倒三角、左侧=右箭头、右侧=左箭头）
3. **hitTest**：
   - 圆形检测，但增加最小点击区域（锚点很小，hitTest 半径至少 0.2m 方便点击）
4. **属性面板**：
   - 特有属性：mountSide 下拉选择（顶部/左侧/右侧）
   - 锚点无需质量属性（静态体，质量=0，隐藏质量输入）

**设计说明**：
- 锚点在编辑模式下显示为可见的小圆点+挂载标记
- 第4阶段实现 JointTool 时，锚点是 Joint 的常见连接目标
- mountSide 目前仅影响视觉渲染，不影响物理行为

**验收**：
- ✅ 从面板拖出锚点，显示为小实心圆+挂载标记
- ✅ 锚点是静态的，仿真时不动
- ✅ 可修改 mountSide，渲染标记随之变化

---

## T3.5 杆件（bar）完整实现

**目标**：杆件可创建，细长矩形动态体，为杠杆模型准备

**任务**：
1. **物理 Shape 映射**（`engine/sceneSync.ts`）：
   - 杆件 = Box Shape（barLength × barThickness），动态体
   - density 从 mass 和面积计算
2. **Canvas 渲染**：
   - 细长矩形，使用 barLength/barThickness
   - 动态体颜色方案，与 block 区分（可用不同透明度或色调）
3. **hitTest**：
   - 复用矩形检测逻辑，使用 barLength/barThickness

**验收**：
- ✅ 从面板拖出杆件，显示为细长矩形
- ✅ 可设置杆件长度和厚度
- ✅ 仿真模式：杆件受重力下落，可旋转（除非 fixedRotation）

---

## T3.6 面板扩展 + 集成验证 + 提交

**目标**：更新物体面板和属性面板，完成全量验证

**任务**：
1. **扩展 ObjectPanel**（`components/panels/ObjectPanel.tsx`）：
   - "支撑面"分组不再是占位，填充内容：
     ```
     ▼ 基础物体
       [□] 物块
       [○] 球体
       [━] 杆件
     ▼ 支撑面
       [△] 斜面
       [│] 墙壁
       [•] 固定锚点
     ```
   - 为每种新物体类型创建 SVG 图标
   - DraggableItem 支持新的物体类型
2. **扩展 PropertyPanel**（`components/panels/PropertyPanel.tsx`）：
   - 斜面特有属性：底边长度、斜面高度
   - 墙壁特有属性：墙壁宽度、墙壁高度
   - 锚点特有属性：mountSide 下拉选择
   - 杆件特有属性：杆件长度、杆件厚度
   - 静态体隐藏/禁用质量和初速度输入
3. **扩展 Canvas.tsx onDrop 处理**：
   - 支持新物体类型的拖拽创建（调用对应的 createDefault* 工厂）
4. **完整功能验证**：
   - 拖拽斜面到画布 → 选中编辑属性 → 放物块到斜面上方 → 播放 → 物块沿斜面下滑
   - 墙壁阻挡物体
   - 球体在斜面上滚动
   - 杆件自由落体可旋转
   - 锚点固定不动
   - 所有新物体的 Undo/Redo 正常
5. **代码质量检查**：
   - `pnpm lint` 通过
   - `pnpm tsc --noEmit` 通过
6. **更新 README.md**
7. **Git 提交**（用户确认后）

**验收**：
- ✅ 可从面板拖出斜面、墙壁、固定锚点、球体、杆件到画布
- ✅ 斜面显示为三角形，可设置底边长度和高度
- ✅ 物块放在斜面上能沿斜面下滑（仿真模式）
- ✅ 球体在斜面上能滚动
- ✅ 固定锚点显示为小圆点，固定不动
- ✅ `pnpm lint && pnpm tsc --noEmit` 通过
- ✅ README.md 已更新

---

## 涉及文件范围汇总

```
修改文件（8个）：
├── src/models/types.ts               # BodyType 扩展 + 特有属性字段
├── src/models/defaults.ts            # 4 个新 createDefault* + generateLabel 扩展
├── src/engine/types.ts               # ShapeConfig 增加 polygon
├── src/engine/sceneSync.ts           # 4 种新物体的 SceneBody → BodyConfig 转换
├── src/engine/PhysicsBridge.ts       # createShape 增加 polygon case
├── src/renderer/CanvasRenderer.ts    # renderSceneBody/renderBody 增加 4 种渲染
├── src/core/hitTest.ts               # 增加斜面三角形 hitTest
├── src/components/panels/ObjectPanel.tsx   # 新物体分组 + SVG 图标
└── src/components/panels/PropertyPanel.tsx # 新物体特有属性编辑

新增文件：无（全部是扩展现有文件）
```

---

## 技术注意事项

1. **Planck.js PolygonShape 顶点顺序**：必须逆时针排列，否则碰撞检测异常。创建前可用叉积验证 winding order。
2. **斜面三角形 hitTest**：使用叉积法（三条边的叉积符号一致则点在三角形内）比重心坐标法更简单直接。
3. **静态体属性面板**：当 isStatic=true 时，质量和初速度无意义，应禁用或隐藏对应输入（避免用户困惑）。
4. **物体渲染颜色区分**：
   - 动态体：`COLORS.primary` 系
   - 静态体（面/墙）：`COLORS.bgMuted` + `COLORS.border`
   - 锚点：`COLORS.dark` 填充（更醒目，因为很小）
   - 杆件：`COLORS.primary` 系（动态体），但可用略不同的透明度与 block 区分
5. **斜面 density 应为 0**：所有静态体（slope/wall/anchor）的 density 强制为 0，不需要质量转换。

## 下一阶段依赖

第4阶段将在此基础上：
- 使用锚点作为绳/杆/弹簧的固定端（JointTool 选中 anchor → 选中 block → 创建 Joint）
- 扩展 `models/types.ts` 中的 SceneJoint 完整定义
- 扩展 `engine/sceneSync.ts` 添加 Joint 同步
- 扩展 `renderer/CanvasRenderer.ts` 渲染连接线
- 扩展 `core/hitTest.ts` 支持 Joint hitTest
