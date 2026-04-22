# 物理教具可视化产品线 — 综合技术规划

> 融合 deep-research-report.md 调研结论与 tech_plan.md 实施方案

---

## 一、产品定位

为初中/高中物理教师构建浏览器端可视化教学工具，覆盖14个物理模块。
**每个模块输出为单个自包含 HTML 文件**，教师无需安装任何软件，浏览器打开即用。

---

## 二、调研结论

### 2.1 现有平台评估

| 平台 | 优点 | 不采用原因 |
|------|------|-----------|
| PhET (Colorado) | 教育物理模拟金标准，HTML5，97种语言，MIT许可 | 模块固定，无法定制中国高中课纲；不支持自由组合受力模型；无法产出单HTML |
| Concord Lab | MIT许可，交互组件丰富，WebGL加速 | 框架较重，JSON配置模式不适合单文件产出 |
| GeoGebra / oPhysics | 免费，覆盖面广 | 嵌入受限，无法实现电路/粒子模拟等复杂交互 |
| Academo | MIT许可，开源演示集 | 功能基础，不支持自定义参数面板和数据导出 |
| Algodoo | 优秀的2D物理沙盒 | 桌面应用，非浏览器端 |

### 2.2 不使用通用物理引擎

Matter.js / Planck.js / Cannon.js / p2.js 等刚体引擎均不适用：
- 受力分析是静态约束求解，不是动力学模拟
- 光学需要光线追踪，不是碰撞检测
- 电路需要 MNA，与刚体物理无关
- 电磁场需要场线计算，不是粒子碰撞
- 碰撞可用解析公式直接求解

**结论：每个模块使用领域专用求解器（custom solver）**

### 2.3 可借鉴的开源项目

| 项目 | 用途 | 许可 |
|------|------|------|
| Ray Optics Simulation (ricktu288/ray-optics) | P-03 光线追踪参考 | MIT |
| CircuitJS1 (sharpie7/circuitjs1) | P-04 MNA求解器参考 | GPL |
| Falstad Ripple Tank | P-06 波动可视化参考 | GPL |
| jsOrrery (mgvez/jsorrery) | P-09 轨道渲染参考 | MIT |
| PhET Scenery | 2D/3D场景图形库参考 | MIT |
| Concord Energy2D | WebGL加速热传导参考 | MIT |

### 2.4 无障碍与本地化考虑
- 界面语言：简体中文（主），英文（可选扩展）
- 键盘操作：Tab切换控件，空格/回车触发，方向键调参
- 色彩对比度：高对比暗色主题，色盲友好配色
- 最小字号：18px正文 / 24px标签 / 32px标题（1080p投影仪清晰可辨）

---

## 三、技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 语言 | TypeScript | 类型安全，避免物理计算中的单位/向量错误 |
| 构建 | Vite + vite-plugin-singlefile | 开发时模块化，构建时内联为单HTML |
| 渲染 | 原生 Canvas 2D + 轻量封装 | 文件小（<50KB），时间控制完全可控 |
| 图表 | 自研 Canvas 图表 | 避免 Plotly.js 800KB 体积 |
| UI | Vanilla TS + CSS | React 40KB+ 运行时不值得 |
| 数学 | 自研 Vector2D + RK4 | math.js 700KB 太重 |
| 包管理 | pnpm workspaces (monorepo) | 14模块共享 core 包 |
| 流程图 | draw.io 本地绘制 | 分辨率可控，无需在线服务 |

---

## 四、项目结构

```
physics_anim/
├── package.json              # pnpm monorepo
├── pnpm-workspace.yaml
├── tsconfig.json
├── tech_plan.md              # 本文件
├── diagrams/                 # draw.io 流程图/架构图
├── packages/
│   ├── core/                 # @physics/core 共享基础设施
│   │   └── src/
│   │       ├── ui/           # ParameterPanel, PlaybackControls, Layout
│   │       ├── physics/      # Vector2D, RK4Solver, Constants
│   │       ├── rendering/    # ArrowRenderer, GridRenderer, CanvasManager
│   │       ├── graphs/       # SyncedGraph, EnergyBar
│   │       └── simulation/   # SimLoop, StateHistory
│   ├── p01-force-analysis/
│   ├── p02-motion-simulation/
│   ├── p03-optics/
│   ├── p04-circuit-builder/
│   ├── p05-harmonic-motion/
│   ├── p06-wave-propagation/
│   ├── p07-thermodynamics/
│   ├── p08-em-fields/
│   ├── p09-celestial-mechanics/
│   ├── p11-nuclear-physics/
│   ├── p12-momentum/
│   ├── p13-em-induction/
│   └── p14-mechanical-energy/
├── scripts/
│   └── validate-output.ts
└── dist/                     # 产出：每模块一个HTML
```

---

## 五、核心共享组件 (@physics/core)

### 5.1 SimLoop — 仿真循环引擎
- 播放/暂停/单步前进/单步后退/调速（0.1x ~ 5x）
- StateHistory 环形缓冲区（10000帧），支持回退和时刻跳转
- requestAnimationFrame 驱动，固定物理 dt + 可变渲染帧率

### 5.2 CanvasManager — 坐标系管理
- 世界坐标 ↔ 屏幕像素转换，y轴向上
- 可配置原点位置和缩放比例

### 5.3 ArrowRenderer — 矢量绘制
- 力=绿色，速度=蓝色，加速度=红色，动量=紫色
- 正交分解动画，数值/角度标注

### 5.4 SyncedGraph — 时间同步图表
- Canvas原生实现，竖线游标标注当前时刻
- 点击图表跳转仿真到对应时刻

### 5.5 EnergyBar — 能量柱状图
- 实时堆叠柱状图（动能/势能/总能/耗散热）

### 5.6 ParameterPanel — 声明式参数面板
- slider / select / checkbox 三种控件
- 参数变更自动触发仿真重算

### 5.7 Layout — 1080p投影仪优化布局
- 左侧面板280px + 中央画布 + 底部图表区280px

---

## 六、14个模块技术方案

### P-01 受力分析器
- **求解器**：解析约束求解（水平面/斜面/悬挂/连接体/圆周/浮力/滑轮/杠杆）
- **意图识别**：LLM API (Claude/GPT) + 手动勾选 fallback
- **渲染**：ArrowRenderer + 正交分解动画

### P-02 运动模拟器
- 匀变速解析公式；抛体参数方程；圆周参数化；通用 RK4
- 多物体对比，轨迹点击读数

### P-03 光学实验台
- 自研2D光线追踪：参数直线与界面求交，Snell定律
- 薄透镜：1/f = 1/u + 1/v，三条特征光线
- 双缝干涉/单缝衍射解析强度公式

### P-04 电路搭建器
- MNA求解器 + 高斯消元
- 栅格化画布拖拽元件，自动识别节点
- 滑动变阻器实时重算

### P-05 简谐运动
- 弹簧振子解析解 x = A·sin(ωt+φ)
- 大角度单摆 RK4
- x-t / v-t / a-t 三图同步

### P-06 波动演示
- 离散粒子链波动方程叠加
- 点击质点显示y-t振动图
- 驻波、多普勒效应

### P-07 热力学
- 50~200个2D理想气体分子弹性碰撞
- 温度映射为平均动能
- 布朗运动可视化

### P-08 电场磁场
- 流线积分绘制电场线，点电荷矢量叠加
- 等势面等高线图
- 洛伦兹力：r = mv/(qB)，几何求解
- 速度选择器、回旋加速器

### P-09 天体运动
- 椭圆轨道：开普勒参数方程 / Verlet积分
- 霍曼转移变轨
- 双星系统，面积定律验证

### P-11 核物理
- 蒙特卡洛半衰期模拟
- 光电效应阈值判断
- 玻尔模型轨道跃迁

### P-12 动量守恒
- 解析碰撞 + 恢复系数 e (0~1)
- 人船模型动画
- 动量矢量实时标注

### P-13 电磁感应
- 耦合ODE：ε=BLv, ε=IR, ma=F-BIL-f
- RK4求解，楞次定律逐步动画
- 终态分析 (a=0)

### P-14 机械能守恒 ✅
- 自由落体/斜面/弹簧/单摆四场景
- 能量柱状图 + 能量-时间图实时联动
- 有/无摩擦对比

---

## 七、开发阶段

### Phase 1：基础设施 + P-14 ✅ 已完成
- [x] monorepo + Vite + singlefile 构建流水线
- [x] @physics/core 全部共享组件
- [x] P-14 机械能守恒（28KB，4场景）
- [x] validate-output.ts 验证自包含

### Phase 2：力学核心
- P-01 受力分析器
- P-02 运动模拟器
- P-12 动量守恒

### Phase 3：振动与波动
- P-05 简谐运动
- P-06 波动演示

### Phase 4：电磁
- P-08 电场磁场
- P-13 电磁感应

### Phase 5：专项
- P-03 光学
- P-04 电路
- P-07 热力学
- P-09 天体

### Phase 6：收尾
- P-11 核物理
- 全模块测试

---

## 八、构建与验证

```
pnpm dev:pXX      →  Vite dev server + HMR
pnpm build:pXX    →  dist/P-XX-名称.html
pnpm build:all    →  并行构建全部模块
pnpm validate     →  验证无外部引用
```

---

## 九、质量保证

| 层 | 方法 |
|----|------|
| 物理精度 | 已知解析解对比，守恒定律逐帧验证（误差<0.1%） |
| 渲染质量 | 1080p投影仪实测，文字/箭头清晰可辨 |
| 文件体积 | 单文件 < 200KB（无Plotly），< 2MB（含Plotly） |
| 性能 | 60fps维持，10分钟无内存泄漏 |
| 兼容性 | Chrome/Edge/Firefox 90+ |

---

## 十、部署

- 交付物：dist/ 下14个独立HTML文件
- 分发：U盘/网盘/静态网站CDN
- 入口：index.html 索引页链接到14个模块
