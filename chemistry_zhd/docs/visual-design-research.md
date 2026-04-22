# 物理模拟可视化 — 视觉设计调研报告

日期：2026-03-06

---

## 一、顶级参考对象

### 1. PhET Interactive Simulations（公认教育模拟金标准）

- **网址**: https://phet.colorado.edu/
- **风格**: 卡通 + 极简混合风格，**浅色/亮色背景**，手绘感的物体
- **关键设计点**:
  - 物体是**彩色卡通风格**（不是暗色科技风），拖拽式交互
  - 力箭头清晰巨大，有真实感的物体图片（木箱、冰箱、人物等）
  - PhET 好看的核心不是科技感，而是**物体有实物质感** — 木头纹理的箱子、真实比例的人物、地面有砖石纹理
- **Forces and Motion: Basics**: https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html
  - 拖拽式交互，可选显示力值、质量、速度、加速度
  - 速度表盘显示在"云朵"图形中
  - 物体可放到滑板车上

### 2. Ray Optics Simulation (PhyDemo)

- **网址**: https://phydemo.app/ray-optics/
- **GitHub**: https://github.com/ricktu288/ray-optics
- **风格**: **白色/浅灰背景**，纯几何线条，光线用高饱和度彩色
- **Gallery**: https://phydemo.app/ray-optics/gallery/ — 大量预制精美光学场景
- **启发**: 光学场景用亮色背景反而更清晰；线条干净利落
- **支持功能**: 平面/曲面镜、折射、全反射、自定义方程定义曲面

### 3. Nicky Case 的 Explorable Explanations

- **网址**: https://ncase.me/projects/
- **博客设计模式**: https://blog.ncase.me/explorable-explanations-4-more-design-patterns/
- **风格**: **手绘插画风格**，emoji/简笔画，极简但极其有辨识度
- **关键设计模式**:
  1. **Start concrete, then go abstract** — 先给具体体验再抽象
  2. **Build up to a sandbox** — 渐进式展开，sandbox 放最后
  3. **Let explorers create their own data** — 用户自己生成数据
  4. **Simulations excel at explaining processes** — 模拟擅长解释过程
- **启发**: 不追求照片级真实，**有个性的简笔画反而比假3D更好看**
- **代表作**: Parable of the Polygons, The Evolution of Trust

### 4. myPhysicsLab

- **网址**: https://www.myphysicslab.com/
- **架构文档**: https://www.myphysicslab.com/develop/docs/Architecture.html
- **风格**: 纯功能性极简，白底，简单几何形状
- **渲染架构**: Model-View 分离，DisplaySpring/DisplayShape/DisplayRope 等
- **启发**: 清晰 > 花哨，但太极简也缺乏吸引力

### 5. 其他参考

| 平台 | 网址 | 特点 |
|------|------|------|
| oPhysics | https://ophysics.com/ | 基于 GeoGebra，清晰的图表式风格 |
| 3JCN Physics | https://www.new3jcn.com/simulation.html | 300+ 免费 3D 模拟 |
| Effectual Learning | https://effectuall.github.io/ | Three.js 驱动的 3D STEM 模拟 |
| Falstad Circuit | https://www.falstad.com/circuit/ | 经典电路模拟，颜色编码（绿=正压，红=负压，黄点=电流） |
| physics-simulations.org | https://physics-simulations.org/ | PhET 启发的免费模拟集 |
| Explorabl.es | https://explorabl.es/ | 互动可探索解释汇总站 |
| Awesome Explorables | https://github.com/blob42/awesome-explorables | 精选互动解释列表 |
| ConceptViz | https://conceptviz.app/tools/free-body-diagram-generator | AI 驱动的受力图生成器 |

---

## 二、关键视觉设计发现

### 核心结论：暗色科技风可能是错误方向

| 方案 | 优点 | 缺点 |
|------|------|------|
| **暗色科技风**（当前） | 看起来"高级"、投影仪暗室效果好 | 物体缺乏质感、力箭头在暗底上不够突出、像游戏UI而非教具 |
| **PhET式亮色卡通风** | 物体辨识度极高、教育效果最好 | 投影仪明亮教室中可能反光 |
| **深色+高质量物体渲染**（推荐） | 兼顾投影仪效果和美观 | 需要精细的物体纹理渲染 |

### 2025 设计趋势 — "Vivid Glow Aesthetics"

- 来源: https://ecommercewebdesign.agency/vivid-glow-aesthetics-how-bright-colors-and-light-effects-define-2025-web-design/
- **暗色背景 + 高饱和度霓虹光效** 是 2025 年的主流趋势
- 70% 用户偏好暗色模式
- 关键技术：`shadowBlur` + 径向渐变 = 霓虹发光效果
- **但教育领域更倾向"温馨极简"风格** — 圆角、柔和配色、organic motion

### 教育模拟的最佳视觉风格（行业共识）

- **极简 + 清晰 > 炫酷 + 花哨**
- 减少认知负担，让学生聚焦于物理概念
- 2025 新趋势："Cozy Minimalist" — 柔和边角、温暖配色、有机运动
- PhET 的 "cartoon-minimalist hybrid" 被广泛认为是教育模拟的金标准

---

## 三、Canvas 2D 关键视觉技术

### 运动拖尾 (Motion Trails)

- 来源: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Advanced_animations
- 来源: https://www.kirupa.com/canvas/creating_motion_trails.htm
- **核心技术**: 不用 `clearRect()`，改用半透明 `fillRect()` 覆盖
- `ctx.fillStyle = "rgba(0, 0, 0, 0.05)"; ctx.fillRect(0, 0, w, h);`
- 物体留下渐隐轨迹，无需复杂粒子系统
- **调优**: 透明度 0.03-0.1 平衡拖尾长度和帧率
- **最佳实践**: 多层 Canvas — 拖尾在底层，物体在上层

### 后处理 Bloom

- 我们已有实现 (`applyBloom`)
- 可以加强：使用多次模糊叠加

### 多层渲染

- 阴影层 -> 主体层 -> 高光层 -> 发光层
- 每层使用不同 `globalCompositeOperation`

### 发光效果 (Neon Glow)

- 来源: https://miguelmota.com/bytes/canvas-glowing-particles/
- `shadowColor` + `shadowBlur` 组合模拟霓虹效果
- `createRadialGradient` 创建发光粒子
- 暗色背景下效果最佳

### 粒子系统

- 碰撞时的火花效果
- 力的作用点粒子效果
- 轨迹粒子

---

## 四、JavaScript 动画库与物理引擎参考

### 动画库 (2025)

| 库 | 特点 | 适用场景 |
|---|---|---|
| **GSAP** | 高性能通用动画 | UI 过渡、时间线动画 |
| **Popmotion** | 函数式响应式，物理动画 | 交互式物理动画 |
| **Mo.js** | 运动图形，可定制 | 装饰性动画效果 |
| **Theatre.js** | 现代动画库，带可视化编辑器 | 开发者-设计师协作 |
| **Lottie** | After Effects 导出的矢量动画 | 预制动画播放 |

来源: https://dev.to/hadil/top-10-javascript-animation-libraries-in-2025-2ch5
来源: https://www.devkit.best/blog/mdx/javascript-animation-libraries-physics-engines-2025

### 物理引擎

| 引擎 | 说明 |
|------|------|
| **Matter.js** | 2D 刚体物理引擎，最流行 |
| **p2.js** | 2D 物理引擎，约束支持好 |
| **Cannon.js** | 3D 物理引擎 |
| **Rapier** | Rust 编写，WASM 运行，高性能 |

**我们的决策**: 不使用通用物理引擎，每个模块使用领域专用求解器（更精确、更小、更可控）

### p5.js + Matter.js 组合

- p5-matter 库: https://github.com/pzp1997/p5-matter
- Nature of Code 物理库章节: https://natureofcode.com/physics-libraries/
- 适合快速原型，但我们的 TypeScript + Canvas 方案更轻量

---

## 五、CodePen / 社区精选物理动画

| 项目 | 链接 | 亮点 |
|------|------|------|
| Canvas Particle Animation | https://codepen.io/JulianLaval/pen/KpLXOO/ | 粒子网络，基于速度运动 |
| Canvas Particle Physics | https://codepen.io/programking/pen/dsaHF | 引力粒子系统，彩色 |
| Particle Constellation Sphere | https://codepen.io/micjamking/pen/oZNQBM | 粒子星座动画，弹簧/弹跳物理 |
| Shoot Cannon Ball | https://codepen.io/LFCProductions/pen/PoWVBdw | 抛射物理+弹性碰撞 |
| Hack Physics JS (Rachel Smith) | https://codepen.io/rachsmith/post/hack-physics-and-javascript-1 | "hack physics" 教程 |
| Exploring Physics in Canvas | https://codepen.io/collection/fukEr | Adobe 物理动画合集 |

---

## 六、3D / WebGL 参考（如需未来升级）

| 工具 | 说明 |
|------|------|
| **Three.js** | WebGL 3D 渲染标准库 |
| **Babylon.js** | 内置 WebGPU 支持，粒子系统强大 |
| **Plotly.js** | 交互式图表，支持 WebGL 加速 |
| **vtk.js** | 科学可视化库 |

### 粒子效果参考

- Dreamy Particle Effect with GPGPU: https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/
- Interactive Particles with Three.js: https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/
- Motion Blur: https://threejsdemos.com/demos/postfx/motion-blur

---

## 七、改进方案总结

### 核心问题诊断

当前问题不是技术效果不够，而是**物体渲染缺乏"实物质感"**。物块只是半透明矩形——没有人会认为它是物理意义上的"物体"。

### 具体改进方向

| 元素 | 当前 | 目标 |
|------|------|------|
| **物块** | 半透明蓝色矩形 | 有木纹/金属纹理的实体箱子，带铆钉、边缘、阴影 |
| **地面** | 一条线 + 淡斜线 | 有材质的地面（砖石/混凝土纹理），清晰的剖面线 |
| **斜面** | 半透明三角形 | 实心三角体，带材质纹理和厚度 |
| **弹簧** | 简单锯齿线 | 3D 螺旋效果（用椭圆+渐变模拟） |
| **绳索** | 虚线 | 实线+编织纹理感+端点连接球 |
| **力箭头** | 细小渐变箭头 | 更粗更大，箭头更饱满，标签字号 14-16px |
| **整体比例** | 物体小，画面空旷 | 物体放大，填充更多画面 |

### 技术实现策略

1. **保留暗色背景** — 投影仪效果好，符合 2025 趋势
2. **让物体本身有强烈实物质感** — Canvas 2D 纹理绘制
3. **加大物体比例** — 在投影仪上更清晰
4. **力箭头加粗加大** — 教育重点在力分析，箭头必须醒目
5. **标签更大更清晰** — 最小 14px，重要信息 16px+

### 实现方式

在 `@physics/core` 的 `CanvasManager` 中添加共享绘图方法：
- `drawCrate(wx, wy, halfW, halfH, label, rotation?)` — 木箱
- `drawMetalBlock(wx, wy, halfW, halfH, label, rotation?)` — 金属块
- `drawTexturedGround(left, right, y, material)` — 纹理地面
- `drawIncline(origin, length, angle, material)` — 斜面体
- `drawCoilSpring(x1, y1, x2, y2, coils, amplitude)` — 3D 弹簧
- `drawRope(x1, y1, x2, y2)` — 编织绳索
- `drawPulley(cx, cy, radius)` — 滑轮
- `drawWall(x, y, height)` — 墙壁
- `drawWater(left, right, top, bottom, time)` — 水体

所有方法接受世界坐标，内部转换为屏幕坐标。
