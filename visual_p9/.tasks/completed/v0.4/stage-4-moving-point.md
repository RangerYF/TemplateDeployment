# V0.4 阶段4：动点功能

> **阶段目标**：棱上/面上的点可通过参数滑块或动画控制位置，关联度量实时更新
> **预计耗时**：3-4 天
> **前置条件**：阶段3已完成
> **BACKLOG 覆盖**：F06
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.4/PROGRESSIVE-PLAN.md`
> - 功能清单：`.tasks/active/v0.4/BACKLOG.md`

---

## 一、使用场景与价值

### 典型教学场景

**场景1：动点距离最值**
> 正方体 ABCD-A₁B₁C₁D₁ 中，点 P 在棱 AA₁ 上移动，求 BP+PD₁ 的最小值。
>
> 教师操作：在棱 AA₁ 上取点 P → 开启动点 → 创建距离度量 BP 和 PD₁ → 拖动滑块观察距离变化 → 找到最小值位置

**场景2：动点角度变化**
> 三棱锥 S-ABC 中，点 M 在棱 SA 上移动，求二面角 M-BC-A 的变化范围。
>
> 教师操作：在棱 SA 上取点 M → 开启动点 → 创建二面角度量 → 播放动画观察角度变化

**场景3：截面面积变化**
> 正三棱柱中，截面过棱上一动点，观察截面面积随位置的变化。
>
> 教师操作：取动点 → 定义截面 → 移动动点观察截面形状和面积变化

### 核心价值
- **直观演示**：将抽象的"动点问题"变为可视化的动态过程
- **寻找极值**：拖动滑块直观找到最大/最小值的位置
- **理解变化规律**：观察度量值随点位置的连续变化趋势
- **高考高频题型**：动点问题是立体几何大题的常考类型

---

## 二、交互设计

### 2.1 动点控制区域（PointInspector 中）

```
┌─────────────────────────────────┐
│ 点 P                            │
│ 约束：棱 AA₁ 上                  │
│ 位置参数 t：[====●=====] 0.35   │
│                                 │
│ ┌─ 动点控制 ─────────────────┐  │
│ │ [▶ 播放]  [⏸ 暂停]  [⏹ 重置] │  │
│ │ 速度：[====●=====] 1.0x     │  │
│ └────────────────────────────┘  │
│                                 │
│ [删除点]                         │
└─────────────────────────────────┘
```

### 2.2 交互流程

1. 选中棱上/曲线上/面上的点 → Inspector 显示点属性
2. 已有的 t 参数滑块直接可用（PointInspector 已实现）
3. t 参数滑块下方新增"动点控制"区域：
   - **播放**：点自动沿约束路径运动（t 值递增/递减）
   - **暂停**：停止自动运动
   - **重置**：回到初始 t 值
   - **速度**：控制动画速度
4. 拖动 t 滑块 或 播放动画时，关联的角度/距离度量实时更新
5. 到达端点（t=0 或 t=1）时自动反向（往返运动）

### 2.3 哪些点可以成为动点

| 约束类型 | 可动点？ | 参数 | 说明 |
|----------|---------|------|------|
| vertex | ❌ | — | 顶点固定 |
| edge | ✅ | t (0~1) | 沿棱线性运动 |
| curve | ✅ | t (0~1) | 沿曲线运动 |
| face | ✅ | u, v | 在面内运动（P2，可暂缓） |
| coordinate | ❌ | — | 坐标点固定 |
| free | ❌ | — | 自由点无约束路径 |

> 面上动点（u,v 二维参数）交互复杂度高，建议 P1 先做棱上/曲线上动点（一维 t 参数），面上动点作为后续增强。

---

## 三、代码现状摘要

| 模块 | 现状 | 动点需要改动？ |
|------|------|--------------|
| PointProperties | 有 constraint.t，无 animated 标记 | 需扩展 |
| PointInspector | 已有 t 参数滑块（edge/curve），可拖动 | **已部分就绪**，需增加播放控制 |
| computePointPosition | 已支持所有约束类型的位置计算 | ✅ 无需改动 |
| AngleMeasurementRenderer | useMemo 依赖 entities，点变化自动重算 | ✅ 无需改动 |
| DistanceMeasurementRenderer | 同上 | ✅ 无需改动 |
| Slider 组件 | onValueChange/onValueCommit API 完整 | ✅ 无需改动 |
| transientDragState | 拖拽时绕过 React 直接更新位置 | 动画播放可参考此模式 |

**关键结论**：度量系统天然支持"点位置变化→度量重算"的响应链路，无需修改度量代码。主要工作在 PointInspector UI 扩展和动画播放机制。

### 现有 t 值更新链路（已验证可用）

```
PointInspector slider 拖动
  → entityStore.updateProperties({ constraint: {..., t: newT} })
    → entities 引用更新
      → PointEntityRenderer useMemo 触发 → 点位置重算
      → AngleMeasurementRenderer useMemo 触发 → 角度重算
      → DistanceMeasurementRenderer useMemo 触发 → 距离重算
        → 松手时 onValueCommit → UpdatePropertiesCommand 压入撤销栈
```

---

## 四、子任务清单（串行执行）

### T4.1 动画播放机制 ⏱️ 1天

**要做的事**：
1. 新建 `src/editor/store/animationStore.ts`（Zustand store）：
   - 状态：`playingPointId: string | null`、`speed: number`、`direction: 'forward' | 'backward'`
   - 方法：`play(pointId)`、`pause()`、`reset(pointId, initialT)`、`setSpeed(speed)`
2. 新建 `src/components/scene/AnimationDriver.tsx`（或 hook）：
   - 使用 `useFrame`（R3F）每帧检查是否有正在播放的动点
   - 每帧按 `speed * deltaTime` 递增/递减 t 值
   - t 到达 0 或 1 时反向（乒乓运动）
   - 通过 `entityStore.updateProperties()` 更新 t 值
   - 关键：使用 transient 更新（不每帧提交 Command），仅在暂停/停止时提交一次 Command
3. 性能考量：
   - 动画期间用 transient 方式更新（类似拖拽的 transientDragState）
   - 避免每帧触发完整 React 重渲染
   - 度量的 useMemo 依赖 entities，需确保更新粒度合适

**涉及文件**：
- `src/editor/store/animationStore.ts` — 新建
- `src/components/scene/AnimationDriver.tsx` — 新建
- `src/components/scene/Scene3D.tsx` — 引入 AnimationDriver

**验收**：
- [ ] 调用 `play(pointId)` 后，点开始沿棱自动运动
- [ ] t 值到 0 或 1 时自动反向
- [ ] 调用 `pause()` 后停止运动
- [ ] 调用 `reset()` 后回到初始位置
- [ ] 动画期间关联度量实时更新
- [ ] 动画流畅（60fps，无卡顿）

---

### T4.2 PointInspector 动点控制 UI ⏱️ 1天

**要做的事**：
1. 在 PointInspector 中，当约束类型为 edge/curve 时，t 参数滑块下方新增"动点控制"区域
2. 控制区域包含：
   - 播放/暂停按钮（toggle）
   - 重置按钮（回到点创建时的 t 值）
   - 速度滑块（0.1x ~ 3x，默认 1x）
3. 播放状态的视觉反馈：
   - 播放时 t 参数滑块跟随动画实时更新
   - 播放按钮变为暂停图标
4. 拖动 t 滑块时自动暂停动画（手动控制优先于自动播放）
5. 切换选中其他实体时，动画继续播放（不因 Inspector 切换而停止）

**涉及文件**：
- `src/components/panels/inspectors/PointInspector.tsx` — 扩展 UI

**验收**：
- [ ] edge/curve 约束点显示"动点控制"区域
- [ ] vertex/coordinate/free 约束点不显示
- [ ] 点击播放 → 点开始运动，按钮变为暂停图标
- [ ] 点击暂停 → 点停止，按钮变回播放图标
- [ ] 点击重置 → 点回到初始位置
- [ ] 速度滑块可调节动画快慢
- [ ] 手动拖动 t 滑块时，自动暂停播放
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

### T4.3 动画撤销与边界处理 ⏱️ 0.5天

**要做的事**：
1. 动画撤销策略：
   - 播放开始时记录初始 t 值
   - 暂停/停止时提交一次 UpdatePropertiesCommand（从初始 t 到当前 t）
   - 用户 Ctrl+Z 可撤销整段动画回到初始位置
2. 边界情况处理：
   - 动画播放中删除点 → 自动停止动画
   - 动画播放中切换几何体 → 自动停止动画
   - 动画播放中创建截面/度量 → 动画继续（新度量立即参与联动）
   - 多个点同时设为动点 → 只允许一个点播放动画（后启动的替换前一个）
3. 几何体参数变化时的处理：
   - 动画中修改几何体参数（如边长） → t 值不变，位置随几何体变化
   - 点的 t 范围始终 [0, 1]，不受几何体缩放影响

**涉及文件**：
- `src/editor/store/animationStore.ts` — 边界处理逻辑
- `src/components/scene/AnimationDriver.tsx` — 清理逻辑

**验收**：
- [ ] 播放→暂停 后 Ctrl+Z 可撤销回初始位置
- [ ] 删除动点时动画自动停止
- [ ] 切换几何体时动画自动停止
- [ ] 一次只能有一个点播放动画

---

### T4.4 集成验证 ⏱️ 0.5天

**要做的事**：
1. 端到端场景验证：
   - 场景1：正方体棱上动点 + BP 距离度量 → 拖动/播放观察距离变化
   - 场景2：三棱锥棱上动点 + 二面角度量 → 观察角度变化
   - 场景3：圆柱母线上动点 + 距离度量 → 观察距离变化（curve 约束）
2. 性能验证：
   - 1个动点 + 3个度量同时联动，动画 60fps
   - 多个度量重算不卡顿
3. 交互完整性验证：
   - 撤销/重做覆盖所有动点操作
   - 文本指令创建的线段连接动点后，线段跟随动点运动
   - 坐标系存在时，动点坐标值实时更新

**涉及文件**：
- 可能有小修复

**验收**：
- [ ] 3个典型场景端到端验证通过
- [ ] 动画播放流畅（60fps）
- [ ] 度量值实时准确更新
- [ ] 撤销/重做完整可用
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 五、执行顺序

```
T4.1 动画播放机制（animationStore + AnimationDriver）
  → T4.2 PointInspector 动点控制 UI
    → T4.3 动画撤销与边界处理
      → T4.4 集成验证
```

---

## 六、设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 面上动点（u,v） | 本阶段暂不实现 | 二维参数交互复杂，一维 t 参数已覆盖主要场景 |
| 动画更新方式 | transient + useFrame | 避免每帧 React 重渲染，参考拖拽系统设计 |
| 撤销粒度 | 播放段为一个 undo 单元 | 用户期望"撤销动画"而非"撤销每帧" |
| 多动点并发 | 一次只允许一个播放 | 简化实现，避免性能和交互复杂度 |
| 运动模式 | 乒乓（到端点反向） | 最符合教学演示需求 |

---

## 七、完成标志

- [x] 所有验收项通过
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 浏览器验收：棱上动点可拖动/播放，关联度量实时更新

## 八、实际完成记录

**完成日期**：2026-03-12

**实际变更文件**：
- `src/editor/store/animationStore.ts` — 新建，动画状态管理（playingPointId/speed/direction/initialT）
- `src/components/scene/AnimationDriver.tsx` — 新建，useFrame 驱动 t 值乒乓更新
- `src/editor/store/index.ts` — 增加 animationStore 导出
- `src/components/scene/Scene3D.tsx` — 引入 AnimationDriver
- `src/components/panels/inspectors/PointInspector.tsx` — 增加动点控制 UI（播放/暂停/重置/速度滑块）

**附带修复 Bug**：
- Ctrl+右键穿透选择时，右键菜单显示面菜单而非目标线段菜单
  - `src/components/scene/renderers/FaceEntityRenderer.tsx` — Ctrl 时不拦截 contextmenu 事件
  - `src/components/scene/ToolEventDispatcher.tsx` — 新增 onContextMenu 统一穿透处理
