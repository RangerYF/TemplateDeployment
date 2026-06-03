# 天体模板（visual_p9）方案A改造计划

> 版本：V1.0 | 日期：2026-06-03

## 0. 改造红线

以下内容**绝对不动**，改造前后行为必须完全一致：

- `src/engine/orbitalMechanics.ts`（729行）—— 轨道力学计算引擎，所有物理公式和数值求解逻辑不做任何修改
- `data/celestialModels.ts`（272行）—— 6个天体模型的定义、常量、参数范围、教学数据
- `src/store/simulationStore.ts` 中的物理计算逻辑（`tick`、`applyParamConstraints`、参数约束规则）
- `src/templateBridge.ts` —— snapshot 协议和 iframe 通信逻辑
- 所有模型的物理行为：圆轨道、椭圆轨道、霍曼转移、逃逸速度、双星系统、轨道追赶的仿真结果不变

## 1. 布局改造

### 1.1 当前布局（三栏）

```
┌──── TopBar (48px) ───────────────────────────────┐
│ [P09] 天体运动与引力模拟器  [模型Tabs...]  [▶⏸] │
├────────────┬──────────────────┬───────────────────┤
│ ModelList  │                  │ 6个折叠面板：      │
│ Panel      │     Canvas       │ · 播放与显示       │
│ (232px)    │                  │ · 参数设置         │
│            │                  │ · 实时数值         │
│ 6个模型    │                  │ · 公式与关系       │
│ 卡片       │                  │ · 教学提示         │
│            │                  │ · 数据来源         │
│            │                  │        (312px)    │
└────────────┴──────────────────┴───────────────────┘
```

### 1.2 目标布局（两栏）

```
桌面端 (≥1024px)：
┌─────────────────────────────────────────────────────────┐
│ TopBar (48px)                                            │
│ 天体运动与引力  [预设▾]       [就绪] [▶⏸↺ 速度▾] [📖] │
├───────────────────────────────────────┬──────────────────┤
│                                       │ 参数区            │
│                                       │  中心天体质量 ━━━  │
│          Canvas                       │  轨道半径   ━━━    │
│          (Three.js 3D)                │  初始速度   ━━━    │
│                                       │  [✓] 显示矢量     │
│                                       │  ▸ 高级设置       │
│                                       ├──────────────────┤
│                                       │ 读数区            │
│                                       │  轨道速度 29.8km/s │
│                                       │  周期 365.25天     │
│                                       │  离心率 0.017      │
│                                       │         (320px)   │
└───────────────────────────────────────┴──────────────────┘
```

### 1.3 具体改动

**删除左侧面板**：
- 移除 `ModelListPanel` 组件在布局中的渲染
- 模型选择功能迁移到 TopBar 的预设选择器（下拉菜单，展示模型名称）

**精简右侧面板**：
- 当前6个折叠区 → 合并为3个区域：
  - 区域1：核心参数（原"参数设置"中的参数，直接展示不折叠）
  - 区域2：高级设置（速度倍率、显示矢量/面积扇形开关，默认折叠）
  - 区域3：实时读数（原"实时数值"）
- 原"公式与关系"、"教学提示"、"数据来源" → 移到教学要点浮窗

**修改 AppLayout.tsx**：
- 移除三栏 grid 布局，改为两栏（canvas flex-1 + 右侧面板固定宽度 320px）
- 移除左侧 resize 拖拽逻辑
- 右侧 resize 改为固定宽度（或保留 resize 但去掉左侧）

## 2. TopBar 改造

### 2.1 当前 TopBar 内容
- P09 圆形 badge
- 固定标题"天体运动与引力模拟器"
- 当前模型副标题（CEL-001 · 圆轨道运动）
- 模型切换 Tab 列表（6个按钮，md以下隐藏）
- 播放/暂停按钮

### 2.2 目标 TopBar 内容

```
[天体运动与引力]  [圆轨道|椭圆|霍曼|逃逸|双星|追赶]  [就绪] [▶] [⏸] [↺] [1x ▾] [📖]
  标题(固定)       场景Tab(保留现有)                   状态    播放控制组         教学要点
```

### 2.3 具体改动

**保留元素**：
- 模型切换 Tab 列表 —— 保留现有的6个模型 Tab 切换，交互逻辑不变

**新增元素**：
- 暂停按钮（当前只有播放/暂停合一按钮，拆分为独立按钮）
- 重置按钮：调用 `simulationStore.resetTime()` + `resetActiveParams()`
- 速度选择器：下拉或按钮组，选项 0.5x / 1x / 2x / 5x / 10x（精简现有的 0.2-20 连续滑块为离散档位）
- 运行状态 badge：根据 `isPlaying` 显示"运行中"（绿）/"已暂停"（灰）/"已就绪"（蓝）
- 教学要点按钮：图标按钮，点击打开浮窗

**移除元素**：
- P09 圆形 badge（不需要在模板内部显示编号）
- 当前模型副标题文字（Tab 已直观显示当前选中模型）

## 3. 右侧面板改造

### 3.1 区域1：核心参数

**来源**：从当前 `ParameterPanel.tsx` 提取，按模型动态渲染。

**参数分层**（所有模型）：

| 模型 | 核心参数（默认展示） | 高级参数（折叠） |
|------|---------------------|------------------|
| CEL-001 圆轨道 | 中心天体质量 M、低轨卫星半径 r低、高轨卫星半径 r高 | （无） |
| CEL-002 椭圆轨道 | 近地点半径 r近、远地点半径 r远、中心天体质量 M | （无） |
| CEL-011 霍曼转移 | 低轨半径 r1、高轨半径 r2 | 地球质量 M（固定值，只读显示） |
| CEL-012 逃逸速度 | 发射速度 v | （无） |
| CEL-021 双星系统 | 星1质量 m1、星2质量 m2、两星距离 L | （无） |
| CEL-031 轨道追赶 | 内轨半径 r1、外轨半径 r2、初始角度差 Δθ | 中心天体质量 M |

**交互优化**：
- 科学记数法输入（如 6.0×10²⁴ kg）保留现有的 `ScientificInput` 组件，但优化视觉样式与统一控件对齐
- 每个参数行：标签 + 当前值（带单位）+ 滑块
- 滑块样式统一（按 plan-a-optimization-spec 中定义的规格）

### 3.2 区域2：高级设置（默认折叠）

包含：
- 速度倍率滑块（从 TopBar 的离散档位之外提供连续调节 0.2-20x）
- 显示矢量 Toggle（速度/加速度箭头）
- 显示面积扇形 Toggle（仅椭圆轨道模型可见）
- 霍曼点火按钮（仅霍曼转移模型可见）

### 3.3 区域3：实时读数

从当前 `MetricsPanel.tsx` 迁移，展示 `buildFrame()` 返回的计算结果。

格式：每行 = 颜色圆点 + 名称 + 数值 + 单位

读数随模型变化而变化（保持现有逻辑不变）。

**性能优化**：当前 `MetricsPanel` 每次渲染都独立调用 `buildFrame()`。改为从 `OrbitCanvas` 共享同一个 frame 计算结果（通过 store 或 ref 传递），避免重复计算。

## 4. 教学要点浮窗

### 4.1 内容来源

从当前右侧面板的三个折叠区迁移：
- **公式与关系**（`FormulaPanel.tsx`）—— KaTeX 渲染的物理公式
- **教学提示**（`TeachingPanel.tsx`）—— 教学要点列表
- **数据来源**（`SourcePanel.tsx`）—— 数据参考来源

### 4.2 实现方式

- TopBar 右侧教学要点按钮（📖图标）点击后，弹出模态对话框
- 对话框内用 Tab 分三个区：公式 / 教学要点 / 数据来源
- 内容按当前选中模型动态切换
- KaTeX 按需加载（动态 import），不打入主包

## 5. Three.js 画布重构

### 5.1 当前 Canvas 2D 实现

`OrbitCanvas.tsx`（363行）使用 Canvas 2D API 绘制：
- 线性渐变背景（深空）
- 程序化星空（每帧重新生成）
- 径向渐变天体 + shadowBlur 光晕
- 虚线椭圆轨道
- 矢量箭头
- 面积扇形
- HUD 信息面板

### 5.2 Three.js 重构目标

用 Three.js 重建画布，大幅提升视觉品质：

**场景元素**：

| 元素 | 当前(Canvas 2D) | 目标(Three.js) |
|------|-----------------|----------------|
| 背景 | 线性渐变色 | 深空 CubeTexture / 渐变 Shader 背景 |
| 星空 | 每帧重绘的2D圆点 | `THREE.Points` 粒子系统，带微弱闪烁动画，一次生成缓存 |
| 太阳/恒星 | 径向渐变圆 + shadowBlur | `SphereGeometry` + 自发光材质 + `UnrealBloomPass` 光晕 |
| 行星/卫星 | 径向渐变圆 + shadowBlur | `SphereGeometry` + 纹理贴图（地球/月球等）+ 法线贴图 |
| 轨道线 | Canvas 虚线椭圆 | `Line2` 或 `TubeGeometry`，支持渐变色和宽度变化 |
| 力矢量 | Canvas 直线+三角箭头 | `ArrowHelper` 或自定义 Mesh，带发光效果 |
| 速度矢量 | Canvas 直线+三角箭头 | 同上，不同颜色 |
| 面积扇形 | Canvas 填充多边形 | `ShapeGeometry` + 半透明材质 |
| 轨迹拖尾 | 无 | 新增：`Line2` 渐变尾迹，alpha 从头到尾递减 |
| HUD文字 | Canvas fillText | `CSS2DRenderer` 叠加层，HTML元素定位在3D空间 |

**后处理效果**：
- `UnrealBloomPass`：太阳/恒星光晕
- `RenderPass` + `EffectComposer`：后处理管线

**相机**：
- `OrthographicCamera`（保持2D正交视角，与当前视觉习惯一致）
- 支持鼠标滚轮缩放（替代当前 viewport.zoom）
- 支持鼠标拖拽平移（替代当前 viewport.offset）

### 5.3 实现策略

**关键原则**：渲染层与物理计算层完全解耦。

```
orbitalMechanics.ts (不动)     →  buildFrame()  →  frame 数据
                                                      ↓
                                              ThreeCanvas.tsx (新)
                                              根据 frame 数据更新
                                              Three.js 场景中各对象的位置/旋转
```

**新增文件**：
- `src/components/scene/ThreeCanvas.tsx` —— 新的 Three.js 画布组件
- `src/components/scene/three/SceneManager.ts` —— Three.js 场景管理（场景/相机/渲染器/后处理初始化）
- `src/components/scene/three/CelestialBody.ts` —— 天体3D对象（球体+材质+光晕）
- `src/components/scene/three/OrbitLine.ts` —— 轨道线对象
- `src/components/scene/three/VectorArrow.ts` —— 矢量箭头对象
- `src/components/scene/three/StarField.ts` —— 星空粒子系统
- `src/components/scene/three/HUD.ts` —— CSS2D 文字标注层

**保留文件**：
- `src/components/scene/OrbitCanvas.tsx` —— 保留不删，作为 Canvas 2D 降级方案
- 在组件层根据设备 GPU 能力选择使用 `ThreeCanvas` 还是 `OrbitCanvas`

### 5.4 动画循环

```
requestAnimationFrame loop:
  1. simulationStore.tick(delta)           -- 更新物理时间（不动）
  2. frame = buildFrame(model, params, t)  -- 计算天体位置（不动）
  3. 更新 Three.js 场景中各对象的 position/scale/opacity
  4. composer.render()                     -- Three.js 渲染（新）
```

### 5.5 GPU 降级策略

```typescript
function detectGPU(): 'high' | 'low' {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return 'low';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  // 集显/软件渲染 → low
  // 独显 → high
  return 'high';  // 简化逻辑，实际可检测 renderer string
}

// high → ThreeCanvas (Three.js + 后处理)
// low  → OrbitCanvas (Canvas 2D，保持现有逻辑)
```

## 6. 视觉主题

### 6.1 天体模板的特殊性

天体模板的画布**天然是深色**（太空背景），所以：
- **暗色主题**：画布不变，面板/TopBar 用深色背景 → 整体沉浸
- **亮色主题**：画布仍为深色太空，面板/TopBar 用浅色背景 → 画布与面板有明暗对比

### 6.2 实现方式

- 在 `<html>` 或 `<body>` 上通过 class 切换主题（`data-theme="light"` / `data-theme="dark"`）
- TopBar 和右侧面板的背景色/文字色/边框色跟随主题变量
- 画布区域不受主题影响（始终是深空背景）
- 主题偏好存入 localStorage 持久化

## 7. 响应式适配

### 7.1 断点行为

| 断点 | 画布 | 参数面板 | TopBar |
|------|------|----------|--------|
| ≥1024px | 左侧与面板并列 | 右侧固定 320px | 完整展示 |
| 768-1024px | 全宽 | 右侧抽屉，按钮触发滑出 | 预设选择器保留，教学按钮保留 |
| <768px | 全宽 | 底部半屏抽屉 | 精简为标题+播放按钮 |

### 7.2 移动端特殊处理

- 画布交互：支持触摸拖拽平移 + 双指缩放
- 底部抽屉：上滑展开参数面板，下滑收起
- 当前已有 `lg:hidden` 的移动端指标卡片 → 可保留作为移动端读数入口

## 8. 性能优化（顺手改）

| 问题 | 当前 | 改造 |
|------|------|------|
| 星空每帧重生成 | `makeStars()` 每帧调用 | Three.js Points 一次生成，或 Canvas 降级模式下缓存到 OffscreenCanvas |
| buildFrame 重复计算 | OrbitCanvas 和 MetricsPanel 各调一次 | 通过 store 或 ref 共享单次计算结果 |
| KaTeX 300KB 主包加载 | 静态 import | 迁移到教学浮窗后 `React.lazy()` 按需加载 |
| Canvas 每帧重设尺寸 | `canvas.width/height` 每帧赋值 | 仅在 ResizeObserver 触发时设置 |
| 内联 style 对象 | 每次渲染创建新对象 | 提取为常量或 useMemo |

## 9. 文件变更清单

### 新增文件
- `src/components/scene/ThreeCanvas.tsx` —— Three.js 画布组件
- `src/components/scene/three/SceneManager.ts`
- `src/components/scene/three/CelestialBody.ts`
- `src/components/scene/three/OrbitLine.ts`
- `src/components/scene/three/VectorArrow.ts`
- `src/components/scene/three/StarField.ts`
- `src/components/scene/three/HUD.ts`
- `src/components/TeachingModal.tsx` —— 教学要点浮窗

### 修改文件
- `src/components/layout/AppLayout.tsx` —— 三栏改两栏
- `src/components/layout/TopBar.tsx` —— 重写为统一规格
- `src/components/panels/ParameterPanel.tsx` —— 参数分层 + 样式对齐
- `src/components/panels/ControlPanel.tsx` —— 拆分，部分移到TopBar/高级设置
- `src/components/panels/MetricsPanel.tsx` —— 简化为读数区
- `src/App.tsx` —— 引入 GPU 检测 + Three/Canvas 选择逻辑
- `src/index.css` —— 添加主题变量
- `package.json` —— 添加 three、@types/three、postprocessing 依赖

### 保留不动的文件
- `src/engine/orbitalMechanics.ts` —— 物理引擎（不动）
- `data/celestialModels.ts` —— 模型数据（不动）
- `src/store/simulationStore.ts` —— 仿真状态（物理逻辑不动，可能添加 frame 共享）
- `src/store/uiStore.ts` —— UI状态（保留，viewport 逻辑可能微调适配 Three.js 相机）
- `src/templateBridge.ts` —— 通信协议（不动）
- `src/components/scene/OrbitCanvas.tsx` —— 保留作为 Canvas 2D 降级方案

### 可删除文件
- `src/styles/colors.ts` —— 未使用的遗留代码
- `src/styles/spacing.ts` —— 未使用的遗留代码
- `src/styles/typography.ts` —— 未使用的遗留代码

## 10. 执行顺序

1. **布局改造**（AppLayout + TopBar）—— 先出骨架
2. **右侧面板精简**（参数分层 + 读数区 + 高级折叠）
3. **教学要点浮窗**（迁移公式/教学/数据源）
4. **Three.js 画布**（核心工作量最大）
5. **主题系统**（亮色/暗色切换）
6. **响应式适配**（平板/手机断点）
7. **性能优化**（5项顺手改的问题）
8. **回归测试**（验证6个模型的物理行为完全一致）

## 11. 验收标准

- [ ] 6个天体模型物理仿真结果与改造前完全一致
- [ ] 布局为两栏（画布+右侧面板），无左侧模型列表栏
- [ ] TopBar 包含且仅包含：标题、预设选择器、状态badge、播放/暂停/重置、速度选择、教学要点按钮
- [ ] 核心参数默认展示，高级设置默认折叠
- [ ] 教学要点浮窗可打开，包含公式/要点/数据来源三个Tab
- [ ] Three.js 画布正常渲染（3D行星+星空粒子+轨道+矢量+光晕）
- [ ] 低端设备自动降级到 Canvas 2D
- [ ] 亮色/暗色主题可切换
- [ ] 桌面端（≥1024px）两栏布局正确
- [ ] 平板端（768-1024px）面板可抽屉滑出
- [ ] 手机端（<768px）不白屏，画布可见
- [ ] snapshot 读写与改造前兼容
- [ ] KaTeX 按需加载，不影响首屏
