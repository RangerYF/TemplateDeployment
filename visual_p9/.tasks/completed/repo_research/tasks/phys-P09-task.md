# P-09 天体运动与引力模拟器 — 模块分析任务

## 任务信息

- **所属**：物理产品线 Phase 1
- **产出**：`outputs/phys-P09-analysis.md`
- **状态**：✅ 已完成

## 输入材料

- 需求文档：`docs/需求文档md/P09 天体运动与引力模拟器 · 模型数据.md`
- PRD：`docs/需求文档md/P物理教具产品线 · 产品需求文档.md` P-09 章节

## 分析要求

按照 `PROGRESSIVE-PLAN.md` 中的**模块分析卡片模板**，逐项分析并输出 `outputs/phys-P09-analysis.md`。

### 特别注意

- 开普勒定律演示、卫星变轨、双星系统 — 轨道模拟需要数值积分（Euler/RK4），与 P-02 运动模拟的技术底层有共性
- 天体追及问题的可视化方式
- 渲染维度：天体运动直觉上像 2D 俯视图，但某些场景（卫星绕地球）可能需要 3D 视角？
- 时间尺度问题：天体运动周期可能很长，如何在动画中合理展示
- 竞品分析重点关注：PhET 引力模块（Gravity and Orbits）、Solar System Scope、Universe Sandbox
