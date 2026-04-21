# 第1阶段：物理引擎集成与画布渲染

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：3天
- **风险等级**：L1（多文件改动，涉及物理引擎集成和坐标系转换）
- **状态**：已完成
- **前置阶段**：第0阶段（已完成）

---

## 目标
Planck.js 物理引擎跑通，Canvas 能渲染物体，实现编辑/仿真模式切换，画布可平移缩放。

---

## 子任务链路（串行）

```
T1.1 Zustand 状态管理基础
→ T1.2 Physics Bridge（物理引擎桥接层）
→ T1.3 Canvas 渲染层（坐标系 + 物体渲染 + 网格）
→ T1.4 编辑/仿真模式切换
→ T1.5 画布交互（平移 + 缩放）
→ T1.6 集成验证与提交
```

---

## T1.1 Zustand 状态管理基础

**目标**：建立编辑器全局状态架构，为后续模块提供状态基础

**任务**：
1. 创建 `src/store/editorStore.ts` — 编辑器主 store：
   - `mode`: `'edit' | 'simulate'` — 当前模式
   - `simState`: `'stopped' | 'playing' | 'paused'` — 仿真状态
   - `gravity`: `{ x: number, y: number }` — 全局重力（默认 `{ x: 0, y: -9.8 }`）
   - `actions`: `play()`, `pause()`, `stop()`, `setGravity()`
2. 创建 `src/store/viewportStore.ts` — 视口状态 store：
   - `offset`: `{ x: number, y: number }` — 画布平移偏移
   - `scale`: `number` — 缩放比例（默认 50，即 1m = 50px）
   - `actions`: `pan()`, `zoom()`, `resetView()`

**产出**：两个 Zustand store，后续模块通过 hook 消费状态

**验收**：TypeScript 类型完整，`pnpm tsc --noEmit` 通过

---

## T1.2 Physics Bridge（物理引擎桥接层）

**目标**：封装 Planck.js World，提供创建/销毁物体的接口，管理编辑态与仿真态

**任务**：
1. 创建 `src/engine/PhysicsBridge.ts` — 物理引擎桥接类：
   - `createWorld(gravity)` — 创建 Planck.js World
   - `destroyWorld()` — 销毁 World
   - `addBody(config)` — 根据配置创建 Body + Fixture，返回 body 引用
   - `removeBody(body)` — 移除 Body
   - `step(dt)` — 单步仿真（`world.step(dt)`）
   - `getBodyStates()` — 获取所有 Body 的当前位置/角度（仿真时渲染层消费）
   - `reset()` — 重置 World 到初始编辑态
2. 创建 `src/engine/types.ts` — 引擎层类型定义：
   - `BodyConfig` — 创建物体的配置（type、position、angle、shape、density、friction、restitution、isStatic、fixedRotation）
   - `BodyState` — 物体运行时状态（id、position、angle、linearVelocity）
   - `ShapeConfig` — 形状配置（`{ type: 'box', width, height }` | `{ type: 'circle', radius }`）
3. 管理编辑态快照：
   - `saveSnapshot()` — 进入仿真前保存所有 Body 初始状态
   - `restoreSnapshot()` — 停止仿真时恢复到编辑态
4. 创建默认场景：
   - 初始化时自动创建地面（水平静态 Edge，y=0，宽度 20m）
   - 创建一个测试物块（1m×1m，位于 (0, 5) 空中）

**设计约束**（来自设计文档 4.4）：
- 编辑模式：Model → World 单向同步
- 仿真模式：World → 运行时状态副本，不修改编辑态数据
- 停止仿真：丢弃运行时状态，恢复编辑态

**Planck.js API 参考**（设计文档附录A）：
```typescript
import { World, Vec2, Box, Circle, Edge } from 'planck-js'

const world = new World({ gravity: Vec2(0, -9.8) })
const body = world.createBody({ type: 'dynamic', position: Vec2(0, 5) })
body.createFixture({ shape: Box(0.5, 0.5), density: 1, friction: 0.3 })
world.step(1/60)
body.getPosition()   // Vec2
body.getAngle()      // number
```

**产出**：`PhysicsBridge` 类，可独立运行物理仿真

**验收**：
- 创建 World + 地面 + 物块不报错
- `step()` 循环后物块 y 坐标递减（自由落体）
- `reset()` 后物块回到初始位置

---

## T1.3 Canvas 渲染层

**目标**：Canvas 组件能正确渲染物体和网格，坐标系转换正确

**任务**：
1. 创建 `src/renderer/CoordinateSystem.ts` — 坐标系转换：
   - 物理世界坐标系：原点在画布中下方，y 轴向上，单位米
   - 屏幕坐标系：原点在左上角，y 轴向下，单位像素
   - `worldToScreen(worldPos, viewport)` — 世界坐标 → 屏幕像素
   - `screenToWorld(screenPos, viewport)` — 屏幕像素 → 世界坐标
   - viewport 包含：offset（平移）、scale（缩放，像素/米）、canvasSize
2. 创建 `src/renderer/CanvasRenderer.ts` — 渲染器类：
   - `render(ctx, bodies, viewport)` — 主渲染入口
   - `renderGrid(ctx, viewport)` — 背景网格线（1m 间距主线 + 0.5m 间距辅助线）
   - `renderBody(ctx, bodyState, viewport)` — 渲染单个物体
     - 矩形（box）：根据位置、角度、宽高绘制矩形
     - 圆形（circle）：根据位置、半径绘制圆
     - 地面（edge）：绘制水平线
   - `renderGround(ctx, viewport)` — 地面渲染（填充地面以下区域为浅色）
   - 物体外观：填充色 + 描边，区分动态体/静态体颜色
3. 创建 `src/components/Canvas.tsx` — React Canvas 组件：
   - 使用 `useRef` 获取 canvas 元素
   - 使用 `useEffect` 设置 canvas 尺寸（自适应父容器，监听 resize）
   - 处理 DPI 缩放（`devicePixelRatio`）
   - 每帧调用 `CanvasRenderer.render()`（编辑模式静态渲染，仿真模式 `requestAnimationFrame` 循环）

**渲染层级**（来自设计文档 4.5）：
1. 背景层：网格线
2. 物体层：物体外观
3. 教学叠加层（本阶段不实现，预留）

**物体渲染颜色方案**（使用设计系统 token）：
- 动态体填充：`COLORS.primary` 带透明度
- 动态体描边：`COLORS.primary`
- 静态体填充：`COLORS.bgMuted`
- 静态体描边：`COLORS.border`
- 网格主线：`COLORS.border`
- 网格辅助线：`COLORS.border` 带低透明度

**产出**：Canvas 组件 + 渲染器，能正确显示网格和物体

**验收**：
- 画布显示网格线，间距均匀
- 物块和地面正确渲染在画布上
- 物体位置与物理世界坐标一致（地面在底部，物块在上方）
- 浏览器窗口大小变化时 Canvas 自适应

---

## T1.4 编辑/仿真模式切换

**目标**：实现播放/暂停/停止控制，仿真时物体按物理规律运动

**任务**：
1. 实现仿真循环：
   - 点击"播放"：`editorStore.play()` → 进入 simulate 模式
   - `requestAnimationFrame` 循环中调用 `physicsBridge.step(1/60)`
   - 每帧后从 `physicsBridge.getBodyStates()` 获取最新状态 → 渲染
   - 使用固定时间步长 `1/60`（设计文档附录B提到确定性回放依赖固定时间步）
2. 实现暂停/停止：
   - "暂停"：停止 `step()` 调用，保持当前状态，物体静止在仿真位置
   - "停止"：调用 `physicsBridge.restoreSnapshot()` → 回到编辑态初始位置 → 切换回 edit 模式
3. 创建 `src/components/Toolbar.tsx` — 顶部工具栏：
   - 播放按钮（▶）：编辑模式可用，点击开始仿真
   - 暂停按钮（⏸）：仿真中可用，点击暂停
   - 停止按钮（⏹）：仿真中/暂停中可用，点击回到编辑态
   - 按钮状态与 `editorStore.mode` / `editorStore.simState` 联动
   - 使用设计系统 `Button` 组件

**设计约束**（来自设计文档 3.1）：
- 编辑模式：可选中、拖拽（本阶段不实现交互，仅静态显示）
- 仿真模式：只读，物理引擎驱动
- 停止 = 回到编辑态，角度/位置恢复到编辑时的值

**产出**：完整的编辑/仿真模式切换机制

**验收**：
- ✅ 初始状态：编辑模式，物块静止在空中（(0, 5) 位置）
- ✅ 点击"播放"：物块开始自由落体
- ✅ 物块落到地面后弹起（碰撞 + restitution）
- ✅ 点击"暂停"：物块定格在当前位置
- ✅ 再点击"播放"：从暂停位置继续
- ✅ 点击"停止"：物块回到初始空中位置

---

## T1.5 画布交互（平移 + 缩放）

**目标**：画布可平移和缩放，方便观察不同区域

**任务**：
1. 画布平移：
   - 中键拖拽：`onMouseDown`（中键）→ `onMouseMove` 更新 `viewportStore.offset` → `onMouseUp` 结束
   - 空格+左键拖拽：按住空格时左键拖拽等效中键拖拽
   - 平移时光标变为 `grab` / `grabbing`
2. 画布缩放：
   - 滚轮缩放：`onWheel` → 更新 `viewportStore.scale`
   - 缩放中心为鼠标位置（不是画布中心）
   - 缩放范围限制：最小 10 px/m，最大 200 px/m
   - 缩放时网格线密度自动适应（避免过密或过疏）
3. 在 `Canvas.tsx` 中集成交互事件

**产出**：画布平移缩放完整可用

**验收**：
- ✅ 中键拖拽画布平移
- ✅ 空格+左键拖拽画布平移
- ✅ 滚轮缩放，以鼠标位置为中心
- ✅ 缩放后网格线间距合理
- ✅ 平移缩放在编辑模式和仿真模式下均可用

---

## T1.6 集成验证与提交

**目标**：全量验证阶段1产出，确保稳定可用

**任务**：
1. 完整功能验证：
   - 启动 → 看到画布 + 网格 + 地面 + 物块
   - 播放 → 物块落体 → 碰地弹起 → 反复弹跳直到静止
   - 暂停 → 物块定格
   - 停止 → 物块回到初始位置
   - 平移缩放画布
2. 代码质量检查：
   - `pnpm lint` 通过
   - `pnpm tsc --noEmit` 通过
3. 更新 `README.md`：
   - 反映当前已实现功能（物理引擎 + Canvas 渲染 + 编辑/仿真切换）
   - 项目结构说明
   - 使用方式（`pnpm dev`）
4. Git 提交（用户确认后）

**验收**：
- ✅ 画布上能看到一个方块从空中自由落体
- ✅ 方块落到地面后弹起（碰撞检测工作）
- ✅ 点击"播放"开始仿真，点击"停止"回到初始位置
- ✅ 画布可平移和缩放
- ✅ 网格线正常显示
- ✅ `pnpm lint && pnpm tsc --noEmit` 通过
- ✅ README.md 已更新

---

## 涉及文件范围汇总

```
src/
├── engine/
│   ├── index.ts              # 导出入口
│   ├── PhysicsBridge.ts      # 物理引擎桥接类
│   └── types.ts              # 引擎层类型定义
├── renderer/
│   ├── index.ts              # 导出入口
│   ├── CanvasRenderer.ts     # Canvas 渲染器
│   └── CoordinateSystem.ts   # 坐标系转换
├── store/
│   ├── index.ts              # 导出入口
│   ├── editorStore.ts        # 编辑器主状态
│   └── viewportStore.ts      # 视口状态
├── components/
│   ├── Canvas.tsx            # 画布 React 组件
│   └── Toolbar.tsx           # 播放控制工具栏
└── App.tsx                   # 更新为编辑器布局
```

## 技术注意事项

1. **Planck.js 坐标系**：y 轴向上（与 Canvas y 轴向下相反），坐标转换必须翻转 y 轴
2. **固定时间步长**：仿真使用 `1/60` 固定步长，不用 `deltaTime`，确保确定性
3. **DPI 处理**：Canvas 需处理 `devicePixelRatio`，否则在 Retina 屏幕上模糊
4. **仿真状态隔离**：仿真不修改编辑态数据，停止时完整恢复，这是后续 Undo/Redo 正确工作的前提
5. **Planck.js 包名**：项目安装的是 `planck-js`（v1.3.0），import 语句为 `import planck from 'planck-js'` 或 `import { World, Vec2, ... } from 'planck-js'`

## 下一阶段依赖

第2阶段将在此基础上：
- 在 `src/models/` 中定义 Scene Model（独立于引擎的数据层）
- 在 `src/core/` 中实现 Tool/Selection/Command 系统
- 扩展 `Canvas.tsx` 添加 hitTest 和拖拽交互
- 添加左侧物体面板和右侧属性面板
