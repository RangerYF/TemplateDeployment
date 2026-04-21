# 🎯 EduMind 可视化教具产品线 — 仓库划分与架构研究

## 📌 目标

为数学（6 模块）、化学（8 模块）、物理（12 模块）共 26 个可视化教具模块，确定：
1. **仓库划分** — 哪些模块放同一仓库
2. **核心架构设计** — 每个仓库的架构模式
3. **核心技术依赖** — 支撑架构的关键技术选型

每个学科独立分析、独立产出，不做跨学科合并。

## 🔄 推进流程

```
每个学科两个 Phase，三个学科之间完全并行：

数学：Phase 1（6 个模块分析） → Phase 2（综合分析）
化学：Phase 1（8 个模块分析） → Phase 2（综合分析）
物理：Phase 1（12 个模块分析）→ Phase 2（综合分析）
```

---

## 📋 数学产品线

### Phase 1：模块分析 ⏱️ 每模块 1 个会话

**目标**：逐模块独立分析，产出模块分析卡片

同学科内各模块**无依赖，可并行**。每个模块一个独立子任务、一个独立会话。

| 子任务 | 模块 | 需求文档 | 状态 | 子任务文档 | 产出 |
|--------|------|---------|------|-----------|------|
| M-01 | 立体几何展示台 | `M-01 立体几何展示台 — 几何体数据 (1).md` + 数学PRD第3章 + 现有代码 | ✅ 已完成 | `tasks/math-M01-task.md` | `outputs/math-M01-analysis.md` |
| M-02 | 函数图像实验室 | `M-02 函数图像实验室 — 函数库数据.md` + 数学PRD第4章 | ✅ 已完成 | `tasks/math-M02-task.md` | `outputs/math-M02-analysis.md` |
| M-03 | 解析几何画板 | `M-03 解析几何画板 — 曲线数据.md` + 数学PRD第5章 | ✅ 已完成 | `tasks/math-M03-task.md` | `outputs/math-M03-analysis.md` |
| M-04 | 三角函数演示台 | `M-04 三角函数演示台 — 演示数据.md` + 数学PRD第6章 | ✅ 已完成 | `tasks/math-M04-task.md` | `outputs/math-M04-analysis.md` |
| M-05 | 概率统计模拟器 | `M-05 概率统计模拟器 — 模拟数据.md` + 数学PRD第7章 | ✅ 已完成 | `tasks/math-M05-task.md` | `outputs/math-M05-analysis.md` |
| M-06 | 向量运算演示台 | `M-06 向量运算演示台 — 演示数据.md` + 数学PRD第8章 | ✅ 已完成 | `tasks/math-M06-task.md` | `outputs/math-M06-analysis.md` |

### Phase 2：综合分析 ⏱️ 1 个会话

**目标**：基于全部模块分析卡片，产出数学产品线的仓库划分与架构方案

**依赖**：M-01 ~ M-06 全部完成

| 状态 | 子任务文档 | 产出 |
|------|-----------|------|
| ✅ 已完成 | `tasks/math-summary-task.md` | `outputs/math-summary.md` |

---

## 📋 化学产品线

### Phase 1：模块分析 ⏱️ 每模块 1 个会话

**目标**：逐模块独立分析，产出模块分析卡片

| 子任务 | 模块 | 需求文档 | 状态 | 子任务文档 | 产出 |
|--------|------|---------|------|-----------|------|
| C-02 | 分子结构查看器 | `C-02 分子结构查看器 — 分子库数据.md` + 化学PRD第6章 | ✅ 已完成 | [`tasks/chem-C02-task.md`](tasks/chem-C02-task.md) | `outputs/chem-C02-analysis.md` |
| C-03 | 化学方程式配平器 | `C-03 化学方程式配平器 — 方程式题库数据.md` + 化学PRD第4章 | ✅ 已完成 | [`tasks/chem-C03-task.md`](tasks/chem-C03-task.md) | `outputs/chem-C03-analysis.md` |
| C-04 | 元素周期表交互平台 | `C-041~C-045 元素周期表交互平台 — 元素数据.md`(5份) + 化学PRD第5章 | ✅ 已完成 | [`tasks/chem-C04-task.md`](tasks/chem-C04-task.md) | `outputs/chem-C04-analysis.md` |
| C-05 | 化学键与晶体结构查看器 | `C-05 化学键与晶体结构查看器 — 晶体结构数据.md` + 化学PRD第7章 | ✅ 已完成 | [`tasks/chem-C05-task.md`](tasks/chem-C05-task.md) | `outputs/chem-C05-analysis.md` |
| C-06 | 电化学演示台 | 化学PRD第9章 + `data/C06_电化学模型数据.md` | ✅ 已完成 | [`tasks/chem-C06-task.md`](tasks/chem-C06-task.md) | `outputs/chem-C06-analysis.md` |
| C-07 | 化学反应速率与平衡模拟器 | `C-07 化学反应速率与平衡模拟器 — 反应平衡数据.md` + 化学PRD第8章 | ✅ 已完成 | [`tasks/chem-C07-task.md`](tasks/chem-C07-task.md) | `outputs/chem-C07-analysis.md` |
| C-08 | 酸碱滴定与pH模拟器 | 化学PRD第11章（数据内置） | ✅ 已完成 | [`tasks/chem-C08-task.md`](tasks/chem-C08-task.md) | `outputs/chem-C08-analysis.md` |
| C-09 | 有机化学反应路径图 | 化学PRD第10章 + `data/C09_有机反应路径数据.md` | ✅ 已完成 | [`tasks/chem-C09-task.md`](tasks/chem-C09-task.md) | `outputs/chem-C09-analysis.md` |

### Phase 2：综合分析 ⏱️ 1 个会话

**目标**：基于全部模块分析卡片，产出化学产品线的仓库划分与架构方案

**依赖**：C-02 ~ C-09 全部完成

| 状态 | 子任务文档 | 产出 |
|------|-----------|------|
| ✅ 已完成 | `tasks/chem-summary-task.md` | `outputs/chem-summary.md` |

---

## 📋 物理产品线

### Phase 1：模块分析 ⏱️ 每模块 1 个会话

**目标**：逐模块独立分析，产出模块分析卡片

| 子任务 | 模块 | 需求文档 | 状态 | 子任务文档 | 产出 |
|--------|------|---------|------|-----------|------|
| P-01 | 受力分析器 | `P01 受力分析器 · 模型与约束条件数据.md` + 物理PRD P-01章 | ✅ 已完成 | `tasks/phys-P01-task.md` | `outputs/phys-P01-analysis.md` |
| P-02 | 运动模拟器 | `P02 运动模拟器 · 场景与参数数据.md` + 物理PRD P-02章 | ✅ 已完成 | `tasks/phys-P02-task.md` | `outputs/phys-P02-analysis.md` |
| P-03 | 光学实验台 | `P03 光学实验台 · 实验与参数数据.md` + 物理PRD P-03章 | ✅ 已完成 | `tasks/phys-P03-task.md` | `outputs/phys-P03-analysis.md` |
| P-04 | 电路搭建器 | `P04 电路搭建器 · 元件与实验数据.md` + 物理PRD P-04章 | ✅ 已完成 | `tasks/phys-P04-task.md` | `outputs/phys-P04-analysis.md` |
| P-05 | 简谐运动与弹簧振子 | `P05 简谐运动与弹簧振子 · 振动模型数据.md` + 物理PRD P-05章 | ✅ 已完成 | `tasks/phys-P05-task.md` | `outputs/phys-P05-analysis.md` |
| P-06 | 波动与振动演示台 | `P06 波动与振动演示台 · 波动参数数据.md` + 物理PRD P-06章 | ✅ 已完成 | `tasks/phys-P06-task.md` | `outputs/phys-P06-analysis.md` |
| P-07 | 热力学与气体分子模拟器 | `P07 热力学与气体分子模拟器 · 模拟数据.md` + 物理PRD P-07章 | ✅ 已完成 | `tasks/phys-P07-task.md` | `outputs/phys-P07-analysis.md` |
| P-08 | 电场与磁场可视化器 | `P08 电场与磁场可视化器 · 场景数据.md` + 物理PRD P-08章 | ✅ 已完成 | `tasks/phys-P08-task.md` | `outputs/phys-P08-analysis.md` |
| P-09 | 天体运动与引力模拟器 | `P09 天体运动与引力模拟器 · 模型数据.md` + 物理PRD P-09章 | ✅ 已完成 | `tasks/phys-P09-task.md` | `outputs/phys-P09-analysis.md` |
| P-12 | 动量定理及动量守恒 | `P12 动量定理及动量守恒 · 模型数据.md` + 物理PRD P-12章 | ✅ 已完成 | `tasks/phys-P12-task.md` | `outputs/phys-P12-analysis.md` |
| P-13 | 电磁感应 | `P13 电磁感应 · 模型数据.md` + 物理PRD P-13章 | ✅ 已完成 | `tasks/phys-P13-task.md` | `outputs/phys-P13-analysis.md` |
| P-14 | 机械能守恒 | `P14 机械能守恒 · 模型数据.md` + 物理PRD P-14章 | ✅ 已完成 | `tasks/phys-P14-task.md` | `outputs/phys-P14-analysis.md` |

### Phase 2：综合分析 ⏱️ 1 个会话

**目标**：基于全部模块分析卡片，产出物理产品线的仓库划分与架构方案

**依赖**：P-01 ~ P-14 全部完成

| 状态 | 子任务文档 | 产出 |
|------|-----------|------|
| ✅ 已完成 | `tasks/phys-summary-task.md` | `outputs/phys-summary.md` |

---

## 📊 任务依赖总览

```
数学产品线：
  M-01 ─┐
  M-02 ─┤
  M-03 ─┼─ 全部完成 → MATH-SUMMARY → outputs/math-summary.md
  M-04 ─┤    (可并行)
  M-05 ─┤
  M-06 ─┘

化学产品线：
  C-02 ─┐
  C-03 ─┤
  C-04 ─┤
  C-05 ─┼─ 全部完成 → CHEM-SUMMARY → outputs/chem-summary.md
  C-06 ─┤    (可并行)
  C-07 ─┤
  C-08 ─┤
  C-09 ─┘

物理产品线：
  P-01 ─┐
  P-02 ─┤
  P-03 ─┤
  P-04 ─┤
  P-05 ─┤
  P-06 ─┼─ 全部完成 → PHYS-SUMMARY → outputs/phys-summary.md
  P-07 ─┤    (可并行)
  P-08 ─┤
  P-09 ─┤
  P-12 ─┤
  P-13 ─┤
  P-14 ─┘

三个学科之间完全并行，无依赖。
```

---

## 📝 模块分析卡片模板

每个模块的子任务文档（`tasks/{学科}-{编号}-task.md`）会引用此模板，分析结果输出到 `outputs/{学科}-{编号}-analysis.md`。

```markdown
# [模块编号] [模块名称] — 模块分析卡片

## 1. 用户场景 & 产品价值
- 目标用户是谁？
- 解决什么教学痛点？
- 核心产品价值一句话概括

## 2. 用户实际使用方式
- 教师的典型操作流程（课前准备 / 课中演示 / 讲题）
- 怎么用才是"好用"的？
- 用户与产品的交互频率和深度

## 3. 核心功能点
- 功能清单（按重要性排序）
- 哪些功能需要实体管理（创建/选中/删除/编辑对象）
- 哪些功能需要 undo/redo
- 哪些功能是参数驱动的（调参数 → 画面实时变化）
- 哪些功能是模拟/动画驱动的（播放/暂停/逐步）

## 4. 核心依赖识别
### 技术依赖
- 渲染方式：2D Canvas / SVG / 3D WebGL / DOM
- 数学/物理计算需求
- 公式渲染需求
### 交互依赖
- 交互模式：编辑器型 / 参数驱动型 / 模拟演示型 / 混合型
- 关键交互：拖拽/点选/滑块/输入框/时间轴...
- 是否需要实体系统（统一的对象模型）
- 是否需要命令系统（undo/redo）

## 5. 竞品分析
- 类似产品有哪些？
- 它们的产品形态（Web/桌面/移动）
- 它们的技术实现方式（如果能判断）
- 它们做得好的地方 / 不足的地方
- 对我们的启示

## 6. 初步技术判断
- 推荐的渲染技术
- 推荐的架构模式
- 关键技术风险或难点
```

---

## 📝 综合分析模板

```markdown
# [学科] 产品线 — 综合分析与仓库规划

## 1. 模块间相似度评估
- 列出所有模块的关键特征对比矩阵
- 按相似度暂分组，说明分组依据

## 2. 分组验证
对每个分组：
- 共享核心层的接口定义（能否用一两句话说清楚？）
- 核心层能支撑各模块的哪些功能？（功能角度验证）
- 各模块的专属能力是什么？

## 3. 仓库划分结论
- 最终分几个仓库，每个仓库包含哪些模块
- 划分依据

## 4. 每个仓库的架构与技术方案
- 核心架构模式
- 核心技术依赖
- 通用层 vs 模块专属层的边界
- 项目结构概览
```

---

## 🚫 暂时不考虑

- AI 互动课件平台（edu-platform）
- 具体开发计划和排期
- 具体代码实现
- 跨学科仓库合并
- 部署和 CI/CD

---

## 📝 开发笔记

（预留记录空间）
