# Stage 3.1: 布局系统重新设计

## 任务 ID
03-19-21-30-placement-redesign

## 风险等级
L1（常规风险）— 1-3 文件改动，不涉及数据链路，但影响全局视觉体验

---

## 1. 目标

设计一个**系统性的**布局方案，统一解决画布上所有浮动元素（文字标签、Popover 面板）的防遮挡定位问题。

**核心需求**：用户点击/选中一个目标后，Popover 应出现在「最近且最空」的位置，不遮挡关键内容。

---

## 2. 已做过的事（Stage 3 中的布局尝试）

### 2.1 第一版：固定方向偏移
- Popover 简单放在锚点右侧/下方
- **问题**：经常遮挡力箭头或物块

### 2.2 第二版：PlacementContext 统一障碍物系统
- 引入 `src/renderer/placement.ts`
- 所有可见元素共享障碍物列表
- 8 方向候选位置 + 贪心评分
- **评分公式**：`score = preference * 10 + 重叠面积 + 出界罚分 * 50`
- **问题**：preference 权重（10）相对于重叠面积（几百~几千 px²）太小，正方向和对角方向几乎没有区分度

### 2.3 第三版：归一化评分
- 所有因素归一到 0-1 范围
- **评分公式**：`score = 0.3 * normPref + 1.0 * normOverlap + 10.0 * normOOB`
- **问题**：下方(pref=2)仍然输给右侧(pref=1)或左下(pref=7)，权重关系不稳定

### 2.4 补丁：旋转 AABB 修正
- 发现 `CanvasContainer` 中实体 popover 的 `halfSW/halfSH` 没有考虑旋转
- 修复后候选位置偏移与障碍物 AABB 对齐
- **问题**：改善了但没根本解决

### 2.5 补丁：跳过 surface 类型障碍物
- 发现斜面三角形的 AABB（矩形包围盒）覆盖了三角形右上方的大片空白
- 让 surface 类型不注册为障碍物
- **问题**：仍然没有选到用户期望的位置

---

## 3. 遇到的各种问题（问题维度分类）

### 3.1 几何精度问题
- **AABB 过度近似**：三角形（斜面）的 AABB 是完整矩形，空白区域被错误标记为障碍
- **旋转不匹配**：候选位置偏移量没考虑旋转，但障碍物注册考虑了旋转，导致候选位置落入自身障碍物内

### 3.2 评分权重问题
- **量纲不统一**：偏好分是无量纲序号(0-7)，重叠面积是 px²，出界是 px，直接相加无法比较
- **归一化后仍不直观**：0.3 的偏好权重代表"容忍30%重叠"，但实际场景中什么才算"可接受的重叠"无法从权重直接推断
- **缺乏场景验证**：没有基准测试用例，调参全靠看截图试

### 3.3 候选位置生成问题
- **8方向固定**：候选位置是 8 个固定方向（上下左右+对角），不能适应不规则空间分布
- **锚点定义不统一**：力箭头 popover 的锚点是箭头终点，实体 popover 的锚点是实体中心，导致候选分布差异大
- **gap 参数含义模糊**：gap 是"面板到锚点边缘"还是"面板到锚点中心"不够清晰

### 3.4 障碍物注册问题
- **哪些元素该注册为障碍物**：斜面要不要？地面要不要？力箭头的文字标签要不要？目前是逐个判断，缺乏统一策略
- **障碍物形状局限**：只支持 AABB，三角形/线段/圆都会过度近似
- **帧间一致性**：PlacementContext 每帧重建，但 Popover 位置在 selection 变化时只计算一次（useMemo），导致两者时间点不同步

### 3.5 架构分层问题
- **Canvas 层 vs React 层**：文字标签在 Canvas 渲染时通过 PlacementContext 放置，Popover 在 React 层通过 `getLatestPlacementContext()` 获取上一帧的 context。两者不是同一帧、不是同一时机
- **标签和 Popover 相互不感知**：标签在渲染期间放置，Popover 在渲染完成后才计算位置，标签的障碍物信息已在 context 中，但 Popover 放置后标签不会重新调整

---

## 4. 评估维度：一个好的布局系统应满足什么

### 维度 1：位置合理性
- [ ] Popover/标签出现在目标附近「视觉上最空旷」的位置
- [ ] 不遮挡核心内容（力箭头、物体、其他标签）
- [ ] 不超出画布边界

### 维度 2：方向偏好的直觉性
- [ ] 人类直觉上的"好位置"应该得分最高
- [ ] 正方向（上下左右）应显著优于对角方向，除非正方向明显被挡
- [ ] "被挡一点点"仍应选正方向，"被挡很多"才退到对角

### 维度 3：障碍物精度
- [ ] 矩形实体：精确
- [ ] 旋转矩形：AABB 可接受（略大但方向正确）
- [ ] 三角形实体（斜面）：不应过度遮挡空白区域
- [ ] 线段（力箭头）：粗细考虑即可
- [ ] 文字标签：精确矩形

### 维度 4：可测试性
- [ ] 典型场景有对应的单元测试
- [ ] 调整权重后能快速验证是否退化
- [ ] 边界情况（画布角落、密集力分析）有覆盖

### 维度 5：架构简洁性
- [ ] Canvas 标签和 React Popover 使用同一套布局逻辑
- [ ] 障碍物注册策略明确（什么注册、什么不注册、为什么）
- [ ] 帧间一致性：Popover 定位时使用的障碍物信息与当前渲染一致

### 维度 6：扩展性
- [ ] 未来新增实体类型（圆形、弹簧等）时布局自动适配
- [ ] 电磁域的场线/等势线标签能复用同一系统
- [ ] 多物体场景下性能可接受（障碍物 < 100 个）

---

## 5. 方案评估（待研究）

### 方案 A：优化当前 PlacementContext
- 修复评分公式权重
- 增加障碍物形状支持（凸多边形或多 AABB 拼合）
- 添加单元测试基准
- **优点**：改动小
- **缺点**：根本问题（AABB 近似、评分直觉性）可能难以彻底解决

### 方案 B：视觉空间采样法
- 不用固定 8 方向候选，而是在锚点周围的环形区域均匀采样（如 16-32 个点）
- 对每个采样点计算"到最近障碍物的距离"，选距离最大的
- **优点**：天然找到最空旷的位置，无需调权重
- **缺点**：计算量稍大；需要考虑面板尺寸而非仅点采样

### 方案 C：基于空闲矩形的方法
- 计算画布中的最大空闲矩形（类似装箱问题）
- 在锚点附近选最大的空闲区域放置面板
- **优点**：精确找到空闲空间
- **缺点**：实现复杂，可能过度工程

### 方案 D：混合方案（候选 + 距离评分）
- 保留 8 方向候选生成
- 评分公式改为：**距离最近障碍物的最小间距**（而非重叠面积）
- 所有候选都不重叠时，按偏好排序
- 有重叠时，按"最小重叠面积"排序，偏好作为 tiebreaker
- **优点**：分层决策更清晰（先排除重叠，再选偏好）
- **缺点**：需要定义"可接受的微小重叠"阈值

---

## 6. 决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-03-19 | 出发点就错了：Popover 不需要全局障碍物系统 | Popover 可拖拽，用户不满意可自己拖走，不需要避开所有元素 |
| 2026-03-19 | 删除 PlacementContext 全套 | 力标签只需局部防重叠，Popover 只需简单方向选择，不需要全局共享障碍物池 |
| 2026-03-19 | 障碍物原则 A（按语义角色） | 只有前景元素注册障碍物，surface 类不注册。Phase 1 够用 |
| 2026-03-19 | Popover 方向跟随力方向 | 力指向哪边，Popover 优先出现在那边。通过 FloatingUIDescriptor.preferredDirection 传递，不耦合域逻辑到公共层 |
| 2026-03-19 | 实体选中高亮用 drawOutline 注册 | 每个实体类型提供轮廓路径，render-loop 统一描边。未来新增实体自动适配 |
| 2026-03-19 | 选中高亮样式用 shadowBlur 发光 | 与力箭头选中风格一致 |
| 2026-03-19 | DraggablePopover 用 data-drag-handle | 标题行作为拖拽手柄，删掉顶部灰色指示条 |

---

## 7. 当前状态
- **状态**：✅ 已完成
- **完成日期**：2026-03-19

## 8. 变更文件清单

| 文件 | 改动 |
|------|------|
| `src/renderer/placement.ts` | 重写：删除 PlacementContext 全套，保留 placeLabel + pickPopoverPosition + 工具函数 |
| `src/core/types.ts` | 删除 RenderContext.placementContext 字段 |
| `src/core/registries/renderer-registry.ts` | FloatingUIDescriptor 追加 anchorHalfSize + preferredDirection |
| `src/core/registries/entity-registry.ts` | EntityRegistration 追加可选 drawOutline |
| `src/renderer/render-loop.ts` | 删除障碍物注册；drawEntityBorder 改为调用 reg.drawOutline；高亮改为 shadowBlur 发光 |
| `src/domains/mechanics/viewports/force-viewport.ts` | 改用局部 occupied[] + placeLabel() |
| `src/domains/mechanics/interactions/force-interaction-handler.ts` | 同上；getFloatingUI 返回 anchorHalfSize + preferredDirection |
| `src/shell/canvas/CanvasContainer.tsx` | Popover 改用 pickPopoverPosition，不再依赖 getLatestPlacementContext |
| `src/shell/canvas/DraggablePopover.tsx` | 删掉灰色指示条，改用 data-drag-handle |
| `src/domains/mechanics/components/ForcePopover.tsx` | 标题行加 data-drag-handle + 分隔线 |
| `src/domains/mechanics/components/EntityPopover.tsx` | 同上 |
| `src/domains/mechanics/entities/block.ts` | 实现 drawOutline |
| `src/domains/mechanics/entities/slope.ts` | 实现 drawOutline |
| `src/domains/mechanics/entities/surface.ts` | 实现 drawOutline |
