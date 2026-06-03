# 天体模板 Three.js 重写 — 新会话交接文档

> 日期：2026-06-03 | 分支：feat/frontend-restructure

## 1. 当前状态

`feat/frontend-restructure` 分支上已完成的改动（10个commit）：

- Task 1: Three.js + postprocessing 依赖已安装
- Task 2: CSS亮色/暗色主题系统 + useTheme hook
- Task 3: 三栏→两栏布局（去掉左侧模型列表）
- Task 4: TopBar重设计（保留场景Tab + 播放控制 + 速度 + 主题切换 + 教学按钮）
- Task 5: 教学要点浮窗（公式/要点/数据源三Tab + KaTeX懒加载）
- Task 6: 右侧面板精简为3区（参数 + 高级设置折叠 + 读数）
- Task 7: Three.js渲染系统（已实现但效果极差，需要重写）
- Task 8: 响应式布局（移动端抽屉面板）
- Task 9: 性能优化（星空缓存 + Canvas resize优化）
- Task 10: 清理无用文件 + build验证
- 额外commit: 尝试sci-fi风格重写（效果仍差，核心问题未解决）

**现有问题**：Task 7的Three.js渲染效果很差（棕色方块、黑色小点、极小天体、极细轨道线、无文字标签），需要完全重写。

## 2. 重写目标

参考 SoumyaEXE/3d-Solar-System-ThreeJS 的渲染方案，重写 `src/components/scene/three/` 下的所有文件和 `ThreeCanvas.tsx`，达到高清科幻风格。

## 3. 参考项目技术要点（SoumyaEXE方案）

源码已克隆到 `d:\repo\soumya-solar-ref\main.js`（3107行单文件）。

### 必须采纳的核心技术：

| 技术 | 具体做法 |
|------|----------|
| **相机** | `PerspectiveCamera(75°)` + `OrbitControls`（enableDamping, dampingFactor:0.08, rotateSpeed:0.3, zoomSpeed:0.8） |
| **渲染器** | antialias + `PCFSoftShadowMap` + `ACESFilmicToneMapping` + exposure:1.2 + sRGB + pixelRatio≤2 |
| **星空** | 双层天空球（外层r=200 SphereGeometry+BackSide星空纹理 + 内层r=190半透明叠加）+ 1500粒子星Points |
| **太阳** | `MeshBasicMaterial`(map:sun.jpg, toneMapped:false, emissive) + `Lensflare`（4层镜头光晕，从three/examples/jsm/objects/Lensflare导入） |
| **行星** | `SphereGeometry(size, 64, 64)` + `MeshStandardMaterial`(map:纹理, roughness, metalness) + castShadow + receiveShadow |
| **灯光** | `AmbientLight(0x131313, 0.5)` + `PointLight(白, intensity:10, distance:1000, decay:0.5)` 在太阳位置 + `PointLight(蓝, intensity:2)` 补光 |
| **后处理** | 使用 `three/examples/jsm/postprocessing/` 的 `EffectComposer` + `RenderPass` + `UnrealBloomPass(strength:0.5, radius:0.6, threshold:0.05)` + `OutputPass` |
| **轨道线** | `RingGeometry(dist-0.05, dist+0.05, 128)` 做成有宽度的环面，半透明 + emissive微发光 |
| **距离自适应bloom** | 相机离太阳越近bloom越强（strength: 0.5 + (1-normalizedDist)*1.0） |

### 关键差异：后处理库的选择

我们之前用的是 `postprocessing` 库（EffectComposer/BloomEffect/EffectPass），SoumyaEXE用的是 `three/examples/jsm/postprocessing/`（EffectComposer/RenderPass/UnrealBloomPass/OutputPass）。**建议改用后者**，因为：
1. SoumyaEXE的效果已验证视觉品质好
2. Three.js官方examples的API更稳定
3. 避免两个库的API混淆

## 4. 需要重写的文件

```
src/components/scene/three/
├── SceneManager.ts      ← 重写（PerspectiveCamera + OrbitControls + 三灯 + UnrealBloomPass）
├── StarField.ts         ← 重写（双层天空球 + 粒子星）
├── CelestialBody.ts     ← 重写（SphereGeometry + 纹理 + Lensflare太阳）
├── OrbitLine.ts          ← 重写（RingGeometry环面代替Line）
└── VectorArrow.ts        ← 微调（修正XZ平面映射）

src/components/scene/ThreeCanvas.tsx  ← 重写（使用OrbitControls替代手写拖拽，集成新组件）
```

## 5. 2D/3D切换功能

**需求**：TopBar增加2D/3D切换按钮，用户可以在两种渲染模式间切换。

- **3D模式**（默认）：使用新的Three.js渲染（ThreeCanvas）
- **2D模式**：使用原版Canvas 2D渲染（OrbitCanvas.tsx，已保留在代码中）
- 共用同一套UI外壳（TopBar + 右侧面板 + 响应式布局）
- 切换状态可存入uiStore或useState

**实现方式**：
- TopBar中添加一个 toggle/segmented control（2D | 3D）
- App.tsx根据状态条件渲染 `<ThreeCanvas />` 或 `<OrbitCanvas />`
- 2D模式下OrbitCanvas的所有物理逻辑不变（buildFrame + Canvas 2D渲染）

## 6. 坐标映射说明

物理引擎 `buildFrame()` 输出的是2D像素坐标（Vec2: {x, y}），其中：
- x: 水平方向像素
- y: 垂直方向像素（屏幕坐标，y向下）
- radiusPx: 天体半径像素值（如地球约28px）
- 坐标原点在画布中心

**映射到3D空间的建议**：
- x → Three.js的x轴
- y → Three.js的-z轴（翻转，因为屏幕y向下而3D z向画面内）
- 保持y=0（XZ平面作为轨道平面）
- radiusPx需要乘以一个缩放因子使天体在3D场景中看起来大小合适（SoumyaEXE的地球size=1，我们的radiusPx约28，可能需要 scale = 1/28 之类的映射）

## 7. 纹理资源

已下载到 `visual_p9/public/textures/`：
- sun.jpg (822KB) — 太阳表面
- earth_day.jpg (463KB) — 地球日面
- earth_night.jpg (255KB) — 地球夜面
- earth.jpg (1.4MB) — 地球蓝色大理石
- moon.jpg (1MB) — 月球表面
- stars_milky.jpg (251KB) — 银河系星空

**还需要下载**：
- lensflare0.png — 太阳镜头光晕主纹理
- lensflare2.png — 辅助光晕纹理

可从 Three.js 官方examples获取：
```
https://threejs.org/examples/textures/lensflare/lensflare0.png
https://threejs.org/examples/textures/lensflare/lensflare2.png
```

## 8. 不可修改的文件（红线）

- `src/engine/orbitalMechanics.ts` — 物理引擎
- `data/celestialModels.ts` — 模型数据
- `src/templateBridge.ts` — iframe通信协议
- `src/store/simulationStore.ts` — 物理状态逻辑

## 9. 验收标准

- [ ] 3D模式下星空背景有层次感（双层天空球 + 粒子星）
- [ ] 太阳有镜头光晕（Lensflare）和bloom光晕
- [ ] 行星是带纹理的3D球体，有光照明暗面
- [ ] 轨道线有宽度，半透明发光
- [ ] 可以用鼠标拖拽旋转视角（OrbitControls）
- [ ] 滚轮缩放流畅，放大到单个天体仍然高清
- [ ] 6个模型全部正确渲染，物理行为与2D模式完全一致
- [ ] 2D/3D切换按钮在TopBar中，点击可平滑切换
- [ ] 2D模式下OrbitCanvas正常工作
- [ ] build成功无报错
