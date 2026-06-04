# 折射实验1（单平面界面）3D场景实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为折射实验的"单平面界面"子实验添加Three.js 3D渲染模式，展示光线穿过透明介质的空间效果。

**Architecture:** 复用已有的SnellSceneManager（通用Three.js场景管理器），新建InterfaceScene3D组件。使用已有的solveInterface物理求解器，将2D结果映射到3D坐标。通过uiStore.renderMode切换2D/3D。

**Tech Stack:** Three.js (MeshPhysicalMaterial透明介质 + MeshBasicMaterial发光光线 + CSS2DRenderer标注), React, Zustand

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/scene/InterfaceScene3D.tsx` | 新建 | 单平面界面3D React组件 |
| `src/components/scene/three/SnellSceneManager.ts` | 修改 | 添加CSS2DRenderer支持 |
| `src/components/scene/RefractionSvgCanvas.tsx` | 修改 | 添加2D/3D切换按钮 |
| `src/App.tsx` | 修改 | RefractionRouter增加interface 3D路由 |

---

### Task 1: 给SnellSceneManager添加CSS2DRenderer

当前的SnellSceneManager没有CSS2DRenderer，3D角度标注需要它。

**Files:**
- Modify: `src/components/scene/three/SnellSceneManager.ts`

- [ ] **Step 1: 添加CSS2DRenderer导入和字段**

在SnellSceneManager中添加CSS2DRenderer，跟P09的SceneManager一样的模式：

```typescript
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// 在class中添加字段：
readonly css2d: CSS2DRenderer;

// 在constructor中WebGLRenderer之后：
this.css2d = new CSS2DRenderer();
this.css2d.setSize(w, h);
this.css2d.domElement.style.position = 'absolute';
this.css2d.domElement.style.top = '0';
this.css2d.domElement.style.left = '0';
this.css2d.domElement.style.pointerEvents = 'none';
container.appendChild(this.css2d.domElement);

// 在动画循环的render之后：
this.css2d.render(this.scene, this.camera);

// 在resize中：
this.css2d.setSize(width, height);

// 在dispose中：
if (this.css2d.domElement.parentNode) this.css2d.domElement.parentNode.removeChild(this.css2d.domElement);
```

- [ ] **Step 2: 验证编译**

Run: `cd d:/repo/Template/visual_p03 && npx tsc --noEmit`
Expected: 零错误（CSS2DRenderer不影响现有SnellWindowCanvas）

- [ ] **Step 3: 提交**

```bash
git add src/components/scene/three/SnellSceneManager.ts
git commit -m "feat(p03): SnellSceneManager添加CSS2DRenderer支持"
```

---

### Task 2: 创建InterfaceScene3D组件

核心3D渲染组件。从solveInterface获取物理数据，转换为3D场景。

**Files:**
- Create: `src/components/scene/InterfaceScene3D.tsx`

- [ ] **Step 1: 创建组件骨架**

```typescript
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useSimulationStore } from '@/store/simulationStore';
import { solveInterface } from '@/engine/refractionSolver';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import { SnellSceneManager } from './three/SnellSceneManager';
import { SceneOverlay } from '../overlay/SceneOverlay';
import type { Point, SolveResult } from '@/data/refractionData';

// 坐标映射：2D像素 → 3D世界
// 2D: x=0-1000, y=0-620, 界面在y=elementCenterY(~250)
// 3D: 界面在y=0平面, x映射到x轴, 2D的y映射到z轴
// 缩放因子: 1px ≈ 0.05 world units (1000px → 50 units)
const PX_TO_WORLD = 0.05;

function px2world(p: Point, interfaceY: number): THREE.Vector3 {
  return new THREE.Vector3(
    (p.x - 500) * PX_TO_WORLD,  // 居中
    -(p.y - interfaceY) * PX_TO_WORLD,  // y翻转，界面为y=0
    0
  );
}
```

组件结构跟SnellWindowCanvas一样：
- useRef管理SceneManager
- useEffect创建/销毁
- useEffect监听settings变化重建场景
- buildScene函数构建所有3D对象

- [ ] **Step 2: 实现buildScene函数**

buildScene核心逻辑：

```typescript
function buildScene(
  dyn: THREE.Group,
  settings: RefractionSettings,
  result: SolveResult,
  rayColor: string,
) {
  SnellSceneManager.disposeGroup(dyn);
  dyn.clear();

  const interfaceY = settings.elementCenterY ?? 250;
  const n1 = settings.medium1N;
  const n2 = settings.medium2N;

  // 1. 下方介质块（透明玻璃/水）
  const mediumGeo = new THREE.BoxGeometry(40, 12, 20);
  const mediumMat = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff,
    transmission: 0.92,
    ior: n2,
    roughness: 0,
    thickness: 5,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const medium = new THREE.Mesh(mediumGeo, mediumMat);
  medium.position.set(0, -6, 0);  // 界面以下
  dyn.add(medium);

  // 2. 界面平面（半透明网格）
  const planeGeo = new THREE.PlaneGeometry(40, 20);
  planeGeo.rotateX(-Math.PI / 2);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x44aa88,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  dyn.add(new THREE.Mesh(planeGeo, planeMat));

  // 3. 界面边框线
  const edgeGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(40, 20));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x44aa88, opacity: 0.5, transparent: true });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.rotation.x = -Math.PI / 2;
  dyn.add(edges);

  // 4. 光线渲染（从solveResult.segments）
  const tubeRadius = 0.08;
  for (const seg of result.segments) {
    const from = px2world(seg.from, interfaceY);
    const to = px2world(seg.to, interfaceY);
    // 限制光线长度避免太长
    const dir = to.clone().sub(from).normalize();
    const length = Math.min(from.distanceTo(to), 25);
    const actualTo = from.clone().add(dir.multiplyScalar(length));
    
    const path = new THREE.LineCurve3(from, actualTo);
    const tubeGeo = new THREE.TubeGeometry(path, 1, tubeRadius, 8, false);
    
    let color: THREE.Color;
    let opacity = 1;
    if (seg.kind === 'incident') {
      color = new THREE.Color(rayColor);
    } else if (seg.kind === 'refracted') {
      color = new THREE.Color(rayColor);
    } else if (seg.kind === 'reflected') {
      color = new THREE.Color(rayColor).multiplyScalar(0.6);
      opacity = 0.7;
    } else {
      color = new THREE.Color(rayColor);
    }
    
    const tubeMat = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
    });
    dyn.add(new THREE.Mesh(tubeGeo, tubeMat));
  }

  // 5. 法线虚线
  if (settings.showNormals && result.normals.length > 0) {
    for (const [p1, p2] of result.normals) {
      const from = px2world(p1, interfaceY);
      const to = px2world(p2, interfaceY);
      const points = [from, to];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x99aabb,
        dashSize: 0.3,
        gapSize: 0.2,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      dyn.add(line);
    }
  }

  // 6. 角度标注（CSS2DObject）
  if (settings.showAngles && result.angleMarks.length > 0) {
    for (const mark of result.angleMarks) {
      const pos = px2world(mark.at, interfaceY);
      const div = document.createElement('div');
      div.textContent = mark.label;
      div.style.cssText = 'color:rgba(255,255,255,0.8);font-size:12px;font-family:Inter,system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.8)';
      const label = new CSS2DObject(div);
      label.position.copy(pos);
      label.position.y += 0.5;
      dyn.add(label);
    }
  }

  // 7. 介质标签
  const addLabel = (text: string, x: number, y: number) => {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = 'color:rgba(255,255,255,0.5);font-size:11px;font-family:Inter,system-ui,sans-serif;pointer-events:none';
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, 0);
    dyn.add(obj);
  };
  addLabel(`n₁ = ${n1.toFixed(3)}`, 18, 3);
  addLabel(`n₂ = ${n2.toFixed(3)}`, 18, -3);

  // 8. 光源标记（小球）
  const sourcePos = px2world(
    { x: settings.sourceAnchorX, y: settings.sourceY ?? 86 },
    interfaceY
  );
  const srcGeo = new THREE.SphereGeometry(0.25, 16, 16);
  const srcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(rayColor), toneMapped: false });
  const srcMesh = new THREE.Mesh(srcGeo, srcMat);
  srcMesh.position.copy(sourcePos);
  dyn.add(srcMesh);

  // 9. 命中点标记
  if (result.hitPoint) {
    const hitPos = px2world(result.hitPoint, interfaceY);
    const hitGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.copy(hitPos);
    dyn.add(hitMesh);
  }
}
```

- [ ] **Step 3: 实现React组件**

```typescript
export function InterfaceScene3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mgrRef = useRef<SnellSceneManager | null>(null);
  const settings = useSimulationStore((s) => s.settings);

  // 初始化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mgr = new SnellSceneManager(el);
    mgrRef.current = mgr;
    // 调整相机位置适合平面界面场景
    mgr.camera.position.set(0, 12, 25);
    mgr.controls.target.set(0, 0, 0);
    mgr.controls.update();

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        mgr.resize(e.contentRect.width, e.contentRect.height);
      }
    });
    ro.observe(el);
    return () => { ro.disconnect(); mgr.dispose(); mgrRef.current = null; };
  }, []);

  // 重建场景
  useEffect(() => {
    const mgr = mgrRef.current;
    if (!mgr) return;

    const source = {
      x: Math.max(40, Math.min(960, settings.sourceAnchorX)),
      y: Math.max(20, Math.min(600, settings.sourceY ?? 86)),
    };
    const result = solveInterface(settings, source);
    const color = settings.showColor
      ? wavelengthToColor(settings.wavelength)
      : '#44cc88';

    buildScene(mgr.dyn, settings, result, color);
  }, [
    settings.sourceAngleDeg,
    settings.medium1N,
    settings.medium2N,
    settings.sourceAnchorX,
    settings.sourceY,
    settings.elementCenterY,
    settings.wavelength,
    settings.showColor,
    settings.showAngles,
    settings.showNormals,
  ]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <SceneOverlay />
    </div>
  );
}
```

- [ ] **Step 4: 验证编译**

Run: `cd d:/repo/Template/visual_p03 && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 5: 提交**

```bash
git add src/components/scene/InterfaceScene3D.tsx
git commit -m "feat(p03): 单平面界面3D场景组件"
```

---

### Task 3: 添加2D/3D切换路由

让用户在折射实验的SVG画布上切换到3D模式。

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/overlay/SceneOverlay.tsx`
- Modify: `src/store/uiStore.ts`

- [ ] **Step 1: 修改RefractionRouter**

在App.tsx中，RefractionRouter增加interface形状的3D判断：

```typescript
import { InterfaceScene3D } from '@/components/scene/InterfaceScene3D';
import { useUIStore } from '@/store/uiStore';

function RefractionRouter() {
  const shape = useSimulationStore((s) => s.settings.shape);
  const renderMode = useUIStore((s) => s.renderMode);

  if (shape === 'snellwindow') return <SnellWindowCanvas />;
  if (shape === 'interface' && renderMode === '3d') return <InterfaceScene3D />;
  return <RefractionSvgCanvas />;
}
```

- [ ] **Step 2: SceneOverlay添加2D/3D切换按钮**

在SceneOverlay的header行中，给支持3D的实验（目前只有interface和snellwindow）添加一个小的2D/3D toggle：

```typescript
import { useUIStore } from '@/store/uiStore';

// 在SceneOverlay组件内：
const renderMode = useUIStore((s) => s.renderMode);
const setRenderMode = useUIStore((s) => s.setRenderMode);
const supports3D = shape === 'interface' || shape === 'snellwindow';

// 在header按钮旁边：
{supports3D && (
  <div style={{ display: 'flex', gap: 2 }}>
    {(['2d', '3d'] as const).map(mode => (
      <button
        key={mode}
        onClick={(e) => { e.stopPropagation(); setRenderMode(mode); }}
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          background: renderMode === mode ? 'rgba(255,255,255,0.2)' : 'transparent',
          color: renderMode === mode ? '#fff' : 'rgba(255,255,255,0.4)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {mode}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: 验证编译并测试**

Run: `cd d:/repo/Template/visual_p03 && npx tsc --noEmit`
Expected: 零错误

浏览器测试：
1. 折射模块 → 单平面界面 → 点击"3D"按钮 → 应显示Three.js 3D场景
2. 透明介质块可见，光线穿过界面折射
3. OrbitControls可旋转视角
4. 右侧面板调n₁/n₂/角度 → 3D场景实时更新
5. 点击"2D"按钮 → 回到SVG画布

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx src/components/overlay/SceneOverlay.tsx
git commit -m "feat(p03): 折射单平面界面2D/3D切换"
```

---

### Task 4: 视觉打磨

根据用户反馈调整3D场景的视觉效果。

**Files:**
- Modify: `src/components/scene/InterfaceScene3D.tsx`
- Possibly modify: `src/components/scene/three/SnellSceneManager.ts`

- [ ] **Step 1: 调整场景背景和光照**

根据"拟真、炫酷"的标准：
- 背景改为深色（`0x0a0e1a`）以突出光线
- 增强方向光强度
- 介质块的transmission/ior参数微调

```typescript
// 在SnellSceneManager或InterfaceScene3D中覆盖背景色
mgr.scene.background = new THREE.Color(0x0a0e1a);
mgr.renderer.setClearColor(0x0a0e1a);
```

- [ ] **Step 2: 增强光线视觉效果**

- 光线管径加粗（0.08 → 0.12）
- 入射点添加发光效果（发光小球）
- 全反射状态下反射光更亮

- [ ] **Step 3: 添加网格地面**

在界面平面上添加半透明网格线，增加空间感：

```typescript
const gridHelper = new THREE.GridHelper(40, 20, 0x334455, 0x1a2233);
gridHelper.position.y = 0.01;
dyn.add(gridHelper);
```

- [ ] **Step 4: 验证并提交**

Run: `cd d:/repo/Template/visual_p03 && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(p03): 单平面界面3D视觉打磨"
```
