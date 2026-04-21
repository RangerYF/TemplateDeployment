# 第3.2阶段：扩展物体类型

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：2天
- **风险等级**：L2（涉及新的 Planck.js 特性：ChainShape、pre-solve 事件）
- **状态**：✅ 已完成
- **完成日期**：2026-03-24
- **前置阶段**：第3阶段（已完成 block/ball/ground/slope/wall/anchor/bar）
- **来源**：stage-3.1 物体库分析 → 决策记录

---

## 执行结果

最终实现 **4 种**新物体（pulley-mount、conveyor、hemisphere、groove），共 **11 种**物体可用。

**turntable（转盘）已移除**：2D 侧视图引擎无法模拟俯视图水平圆周运动场景，经决策移除。

**额外改进**：
- 传送带仿真模式增加动画履带效果（滚筒 + 对角线纹理动画 + 方向箭头）
- 半球面选中框位置修正（对齐弧线实际包围盒）

---

## 原始目标

~~实现第二、三梯队的 5 种物体类型（turntable、pulley-mount、conveyor、hemisphere、groove），补全物体库，为阶段4约束系统铺路。~~

实现 4 种物体类型（pulley-mount、conveyor、hemisphere、groove），补全物体库，为阶段4约束系统铺路。

---

## 阶段3现状（依赖分析）

### 已有物体类型（7种）
- `block`（矩形物块）：Box Shape，动态体
- `ball`（球体）：Circle Shape，动态体
- `ground`（地面）：Edge Shape，静态体，内置不可删除
- `slope`（斜面）：Polygon Shape（三角形），用户设定
- `wall`（墙壁）：Box Shape，用户设定
- `anchor`（固定锚点）：Circle Shape，用户设定
- `bar`（杆件）：Box Shape，动态体

### 已有引擎能力
- ShapeConfig：`box | circle | edge | polygon`
- BodyConfig.type：`static | dynamic | kinematic`（类型定义已支持，但 sceneSync 只映射 `static | dynamic`）

### 需要新增的引擎能力
1. **ShapeConfig 增加 `chain` 类型**：用于 hemisphere 的弧线形状
2. **sceneSync 支持 `kinematic` 映射**：用于 turntable
3. **PhysicsBridge 增加 `ChainShape` 创建**
4. **PhysicsBridge 增加 `setAngularVelocity` 接口**：用于 turntable 的匀速旋转
5. **PhysicsBridge 增加 `pre-solve` 事件监听 + `setTangentSpeed`**：用于 conveyor 的表面速度

---

## 新增物体类型详情

### 1. turntable（转盘）— Kinematic 体

**物理特性**：
- Planck.js body type = `kinematic`（不受力和碰撞影响位置，但有速度，能推动动态体）
- Circle Shape，通过 `setAngularVelocity(ω)` 实现匀速旋转
- 放在转盘上的物体靠摩擦力获得向心力

**场景模型属性**：
```typescript
// turntable
turntableRadius?: number   // 转盘半径 (m，默认 1.0)
angularVelocity?: number   // 角速度 (rad/s，默认 2.0)
```

**默认值**：`turntableRadius=1.0, angularVelocity=2.0, isStatic=false（kinematic不算static）, friction=0.5`

**特殊处理**：
- sceneSync 需要新增映射：当 `type === 'turntable'` 时，BodyConfig.type = `'kinematic'`
- PhysicsBridge.addBody 后，需要调用 `body.setAngularVelocity(angularVelocity)` 设置旋转
- syncSceneToWorld 中需要在 addBody 后设置 angularVelocity
- 编辑模式下不旋转（静态显示），仿真模式才旋转

**渲染**：
- 圆形 + 内部放射线（表示旋转方向）
- 仿真模式：圆形随 body.getAngle() 旋转，放射线跟着转
- 颜色：kinematic 体用独特颜色区分（如 `COLORS.warning` 系橙色调）

### 2. pulley-mount（滑轮座）— Static 体

**物理特性**：
- 本质是固定锚点的变体，Circle Shape，static
- 与 anchor 的区别：渲染为滑轮轮盘（圆环 + 中心轴），阶段4 配合 PulleyJoint 使用
- 在阶段4之前，pulley-mount 单独存在就是一个"看起来像滑轮"的固定点

**场景模型属性**：
```typescript
// pulley-mount
pulleyRadius?: number      // 滑轮半径 (m，默认 0.15)
```

**默认值**：`pulleyRadius=0.15, isStatic=false, friction=0.1, mass=1`

**渲染**：
- 外圆环（粗描边）+ 中心小圆点（轴）
- 顶部三角形支架（表示固定在天花板/墙上）
- 静态体颜色方案

### 3. conveyor（传送带）— Static 体 + pre-solve

**物理特性**：
- Box Shape（长而扁的矩形），static
- 通过 Planck.js `pre-solve` 事件，对接触该物体的动态体设置 `contact.setTangentSpeed(beltSpeed)`
- 这会让接触面有一个切向速度，模拟传送带表面运动

**场景模型属性**：
```typescript
// conveyor
conveyorWidth?: number     // 传送带宽度 (m，默认 5.0)
conveyorHeight?: number    // 传送带厚度 (m，默认 0.3)
beltSpeed?: number         // 皮带速度 (m/s，默认 2.0，正=向右)
```

**默认值**：`conveyorWidth=5.0, conveyorHeight=0.3, beltSpeed=2.0, isStatic=false, friction=0.5, mass=10`

**特殊处理**：
- PhysicsBridge 需要维护 conveyor body ID 列表 + 对应的 beltSpeed
- 在 `createWorld` 时注册 `world.on('pre-solve', ...)` 事件监听
- pre-solve 回调中：检查 contact 的 fixtureA/fixtureB 是否属于 conveyor body，如果是则 `contact.setTangentSpeed(beltSpeed)`
- 需要在 BodyConfig 或 PhysicsBridge 中存储每个 conveyor 的 beltSpeed 元数据

**渲染**：
- 矩形 + 表面箭头标记（表示传送方向和速度）
- 箭头方向 = beltSpeed 正负
- 顶部画几个小箭头（等距排列）

### 4. hemisphere（半球面）— Static 体 + ChainShape

**物理特性**：
- ChainShape（弧线采样点），static
- 用半圆弧的采样点（如 20-30 个点）近似半球面
- 物体可以在弧面上滑动

**场景模型属性**：
```typescript
// hemisphere
hemisphereRadius?: number  // 半球半径 (m，默认 1.5)
hemisphereAngle?: number   // 弧线张角 (rad，默认 π，即半圆)
```

**默认值**：`hemisphereRadius=1.5, hemisphereAngle=π, isStatic=false, friction=0.3, mass=10`

**特殊处理**：
- ShapeConfig 新增 `chain` 类型：`{ type: 'chain'; vertices: Array<{ x: number; y: number }>; loop: boolean }`
- sceneSync 中计算弧线采样点：从 `-angle/2` 到 `+angle/2`，`N` 个点，`x = r*sin(θ), y = -r*cos(θ)`
- PhysicsBridge.createShape 新增 `chain` case：用 `ChainShape(vertices, loop)` 创建
- 弧线开口朝上（碗形），物体放在里面会滑到最低点

**渲染**：
- 编辑模式：绘制弧线（连接采样点）+ 填充弧内区域
- 仿真模式：从 BodyState.shape.vertices 读取点绘制弧线

### 5. groove（V形槽）— Static 体 + Polygon

**物理特性**：
- Polygon Shape（V形三角形，开口朝上），static
- 两条边组成V形，物体放在里面两侧受力

**场景模型属性**：
```typescript
// groove
grooveWidth?: number       // V形槽开口宽度 (m，默认 2.0)
grooveDepth?: number       // V形槽深度 (m，默认 1.5)
grooveThickness?: number   // 槽壁厚度 (m，默认 0.15)
```

**默认值**：`grooveWidth=2.0, grooveDepth=1.5, grooveThickness=0.15, isStatic=false, friction=0.3, mass=5`

**物理实现方案**：
- 使用两个 Polygon 组成V形的两条壁（左壁 + 右壁），每个壁是一个细长四边形
- 或者用两条 EdgeShape 组成V形（更简单但没有厚度）
- **推荐**：用单个凹形 Polygon 不可行（Planck.js Polygon 必须凸多边形），所以用 **两个 Fixture** 分别是左壁和右壁的凸多边形
- 方案：一个 Body 上挂两个 Fixture，每个 Fixture 是一条梯形（有厚度的壁）

**渲染**：
- V形开口朝上，两条斜边 + 底部连接
- 填充壁的厚度区域

---

## 子任务链路

```
T3.2.1 类型定义与引擎能力扩展
→ T3.2.2 groove（V形槽）实现 — 最简单，Polygon 方案
→ T3.2.3 hemisphere（半球面）实现 — 新增 ChainShape
→ T3.2.4 pulley-mount（滑轮座）实现 — 简单 Circle，渲染特殊
→ T3.2.5 turntable（转盘）实现 — 新增 kinematic 支持
→ T3.2.6 conveyor（传送带）实现 — 最复杂，需要 pre-solve 事件
→ T3.2.7 面板扩展 + 集成验证 + 提交
```

排序逻辑：从简单到复杂，逐步引入新引擎能力。

---

## T3.2.1 类型定义与引擎能力扩展

**目标**：一次性完成所有新物体的类型定义、默认值、引擎能力扩展

**任务**：

1. **扩展 `src/models/types.ts`**：
   - BodyType 增加：`'turntable' | 'pulley-mount' | 'conveyor' | 'hemisphere' | 'groove'`
   - SceneBody 增加特有属性（如上文所列）

2. **扩展 `src/models/defaults.ts`**：
   - `createDefaultTurntable()` / `createDefaultPulleyMount()` / `createDefaultConveyor()` / `createDefaultHemisphere()` / `createDefaultGroove()`
   - `generateLabel()` 已泛化，只需补充 LABEL_PREFIX 映射

3. **扩展 `src/engine/types.ts`** — ShapeConfig 增加：
   ```typescript
   | { type: 'chain'; vertices: Array<{ x: number; y: number }>; loop: boolean }
   ```

4. **扩展 `src/engine/types.ts`** — BodyConfig 增加可选字段：
   ```typescript
   angularVelocity?: number   // kinematic body 的角速度
   userData?: {               // 传送带等需要的元数据
     bodyType?: string
     beltSpeed?: number
   }
   ```

5. **扩展 `src/engine/PhysicsBridge.ts`**：
   - import `ChainShape` from planck-js
   - `createShape` 增加 `chain` case
   - `addBody` 增加：如果 config.angularVelocity 存在，调用 `body.setAngularVelocity()`
   - 增加 conveyor pre-solve 机制（详见 T3.2.6）

6. **扩展 `src/engine/sceneSync.ts`**：
   - turntable case：BodyConfig.type = `'kinematic'`，传递 angularVelocity
   - 其他新物体：根据类型计算 shape 和 density

**验收**：`pnpm tsc --noEmit` 通过

---

## T3.2.2 groove（V形槽）实现

**目标**：V形槽可创建，球体放入 V 形槽能被两侧壁支撑

**任务**：
1. **物理 Shape 映射**（`sceneSync.ts`）：
   - V形槽 = 两个 Polygon Fixture
   - 左壁：从(开口左边缘)到(底部中心)的梯形
   - 右壁：从(底部中心)到(开口右边缘)的梯形
   - 需要在 ShapeConfig 中支持**多 Fixture**，或改用新方案
   - **简化方案**：只用两条 EdgeShape（无厚度但碰撞正确），渲染时画出厚度视觉
   - **推荐方案**：使用 `polygon` 类型，左壁和右壁各一个 Fixture。BodyConfig 改为支持 `shapes: ShapeConfig[]`（多fixture）

   > **决策点**：当前 BodyConfig 只有一个 `shape` 字段。V形槽需要两个 Fixture。
   > 方案A：BodyConfig.shape 改为 `shape: ShapeConfig | ShapeConfig[]`
   > 方案B：groove 特殊处理，在 PhysicsBridge.addBody 中检测 groove 类型创建两个 fixture
   > **推荐方案A**：更通用，未来复合 fixture 也能用

2. **Canvas 渲染**（`CanvasRenderer.ts`）：
   - renderSceneBody：画 V 形（两条斜边 + 底部，填充壁厚区域）
   - renderBody（仿真）：从 shape vertices 画两个多边形

3. **hitTest**（`hitTest.ts`）：
   - V形区域检测：点在左壁梯形内 OR 右壁梯形内

**验收**：
- ✅ 拖出 V 形槽到画布，显示 V 形
- ✅ 球体放入 V 形槽，被两壁支撑

---

## T3.2.3 hemisphere（半球面）实现

**目标**：半球面可创建，球体放在弧面上能沿弧面滑动

**任务**：
1. **物理 Shape 映射**（`sceneSync.ts`）：
   - hemisphere = ChainShape（弧线采样）
   - 采样点计算（N=24）：
     ```
     for i in 0..N:
       θ = -angle/2 + i * angle / N
       x = radius * sin(θ)
       y = -radius * cos(θ)    // 开口朝上
     ```
   - shape = `{ type: 'chain', vertices: [...], loop: false }`

2. **PhysicsBridge.createShape**：
   - `chain` case：`new ChainShape(vertices.map(v => Vec2(v.x, v.y)), config.loop)`

3. **Canvas 渲染**：
   - 编辑模式：连接弧线采样点，填充弧线下方区域
   - 仿真模式：从 BodyState.shape.vertices 画弧线

4. **hitTest**：
   - 近似检测：点到弧线最近点的距离 < 阈值（如 0.3m）
   - 或者简单用包围盒（弧线的矩形边界）

**验收**：
- ✅ 拖出半球面，显示弧线
- ✅ 球体放在弧面顶部，沿弧面滑到最低点

---

## T3.2.4 pulley-mount（滑轮座）实现

**目标**：滑轮座可创建，为阶段4 PulleyJoint 做准备

**任务**：
1. **物理 Shape 映射**：
   - Circle Shape（pulleyRadius），同 anchor
   - isStatic 时 density=0

2. **Canvas 渲染**：
   - 外圆环（粗描边 3px）+ 中心小圆点（实心，表示轴）
   - 顶部倒三角支架（表示固定在天花板上）
   - 与 anchor 区分：anchor 是实心小圆，pulley-mount 是空心圆环 + 中心点

3. **hitTest**：
   - 圆形检测，最小点击半径 0.3m

**验收**：
- ✅ 拖出滑轮座，显示圆环+支架
- ✅ 静态时固定不动

---

## T3.2.5 turntable（转盘）实现

**目标**：转盘可创建，仿真时匀速旋转，放上物块靠摩擦力绕转

**任务**：
1. **物理 Shape 映射**（`sceneSync.ts`）：
   - Circle Shape（turntableRadius）
   - BodyConfig.type = `'kinematic'`（非 static/dynamic）
   - 需修改 sceneSync：turntable 映射为 kinematic
   - 传递 angularVelocity 到 BodyConfig

2. **PhysicsBridge.addBody 扩展**：
   - 检查 `config.angularVelocity`，如有则调用 `body.setAngularVelocity(config.angularVelocity)`

3. **Canvas 渲染**：
   - 圆形 + 内部 4 条放射线（十字形，随角度旋转）
   - kinematic 体颜色方案（橙色调，区分于 static 和 dynamic）
   - 编辑模式：显示旋转方向箭头（顺/逆时针弧形箭头）

4. **hitTest**：
   - 圆形检测

5. **属性面板**：
   - 特有属性：角速度 ω (rad/s)，正=逆时针
   - 半径

**验收**：
- ✅ 拖出转盘，显示圆形+放射线
- ✅ 仿真模式：转盘匀速旋转
- ✅ 物块放在转盘上，被摩擦力带着转（如果摩擦力不够则飞出）

---

## T3.2.6 conveyor（传送带）实现

**目标**：传送带可创建，物块放上后被表面速度带动

**任务**：
1. **物理 Shape 映射**：
   - Box Shape（conveyorWidth × conveyorHeight），static
   - 需要在 BodyConfig 中传递 beltSpeed 元数据

2. **PhysicsBridge pre-solve 机制**：
   - 在 PhysicsBridge 中新增 `private conveyorSpeeds: Map<string, number>`
   - `addBody` 时检查 config.userData?.beltSpeed，如有则存入 conveyorSpeeds
   - `createWorld` 后注册 `world.on('pre-solve', callback)`
   - callback 逻辑：
     ```typescript
     const fixtureA = contact.getFixtureA()
     const fixtureB = contact.getFixtureB()
     const bodyA = fixtureA.getBody()
     const bodyB = fixtureB.getBody()
     // 查找哪个是 conveyor
     for (const [id, entry] of this.bodies) {
       if (entry.body === bodyA || entry.body === bodyB) {
         const speed = this.conveyorSpeeds.get(id)
         if (speed !== undefined) {
           contact.setTangentSpeed(speed)
           break
         }
       }
     }
     ```
   - `destroyWorld` 时清空 conveyorSpeeds
   - `removeBody` 时删除对应 conveyorSpeeds 条目

3. **Canvas 渲染**：
   - 矩形 + 表面箭头（4-5 个等距小三角形，方向 = beltSpeed 正负）
   - 仿真模式：箭头可以做简单动画（沿表面移动）

4. **hitTest**：
   - 矩形检测（conveyorWidth × conveyorHeight）

5. **属性面板**：
   - 特有属性：传送带宽度、高度、皮带速度
   - 速度正负影响方向（正=向右，负=向左）

**验收**：
- ✅ 拖出传送带，显示矩形+箭头
- ✅ 仿真模式：物块放到传送带上，被表面速度带动移动
- ✅ 修改 beltSpeed 为负值，物块反方向移动

---

## T3.2.7 面板扩展 + 集成验证 + 提交

**目标**：更新面板，完成验证

**任务**：
1. **扩展 ObjectPanel**：
   ```
   ▼ 基础物体
     [□] 物块
     [○] 球体
     [━] 杆件
   ▼ 支撑面
     [△] 斜面
     [│] 墙壁
     [•] 固定锚点
   ▼ 机构
     [◎] 转盘
     [⊙] 滑轮座
   ▼ 特殊表面
     [≈] 传送带
     [⌒] 半球面
     [∨] V形槽
   ```

2. **扩展 PropertyPanel**：
   - turntable：半径、角速度
   - pulley-mount：半径
   - conveyor：宽度、高度、皮带速度
   - hemisphere：半径、弧线张角
   - groove：开口宽度、深度、壁厚

3. **扩展 Canvas.tsx onDrop**：
   - 支持 5 种新物体类型的拖拽创建

4. **代码质量检查**：
   - `pnpm lint` 通过
   - `pnpm tsc --noEmit` 通过

5. **Git 提交**（用户确认后）

**验收**：
- ✅ 12 种物体类型全部可从面板拖出
- ✅ 每种物体选中后属性面板显示正确的特有属性
- ✅ 仿真模式行为正确（转盘旋转、传送带带动、半球面滑动、V形槽支撑）
- ✅ `pnpm lint && pnpm tsc --noEmit` 通过

---

## 涉及文件范围汇总

```
修改文件（9个）：
├── src/models/types.ts               # BodyType 扩展 + 5 种新属性字段
├── src/models/defaults.ts            # 5 个新 createDefault* + LABEL_PREFIX
├── src/engine/types.ts               # ShapeConfig 增加 chain；BodyConfig 增加 angularVelocity/userData；支持多 fixture
├── src/engine/sceneSync.ts           # 5 种新物体的 Shape 映射 + kinematic 支持
├── src/engine/PhysicsBridge.ts       # ChainShape 创建 + angularVelocity 设置 + pre-solve conveyor 机制
├── src/renderer/CanvasRenderer.ts    # renderSceneBody/renderBody 增加 5 种渲染
├── src/core/hitTest.ts               # 5 种新物体的 hitTest
├── src/components/panels/ObjectPanel.tsx   # 新分组 + 5 种 SVG 图标
└── src/components/panels/PropertyPanel.tsx # 5 种新物体特有属性编辑

可能新增文件：无
```

---

## 技术注意事项

1. **Planck.js ChainShape 构造函数**：`new ChainShape(vertices: Vec2[], loop: boolean)`，已验证可用。hemisphere 用 `loop=false`（开放弧线）。
2. **Planck.js kinematic body**：不受力和碰撞影响位移，但速度会影响接触的动态体。`setAngularVelocity` 让它匀速旋转。已验证可用。
3. **Planck.js pre-solve + setTangentSpeed**：已验证可用。`contact.setTangentSpeed(speed)` 设置接触面的切线速度，模拟传送带表面运动。
4. **多 Fixture**：Planck.js 一个 Body 可以挂多个 Fixture。V形槽的两壁各一个 Fixture，需要 BodyConfig 支持 `shape: ShapeConfig | ShapeConfig[]`。PhysicsBridge.addBody 需要遍历数组创建多个 Fixture。
5. **V形槽 Polygon 凸性要求**：Planck.js PolygonShape 必须是凸多边形。V形是凹的，所以必须拆成两个凸多边形（左壁 + 右壁）。
6. **conveyor pre-solve 性能**：pre-solve 每次碰撞都会触发。需要快速查找 conveyor body（用 Map 查找 O(1)）。如果场景中没有 conveyor，可以跳过检查。
7. **hemisphere hitTest**：弧线没有面积，hitTest 用"点到弧线最近点距离"判断。可以简化为"点到弧线中心距离在 (r-threshold, r+threshold) 之间且角度在弧线张角范围内"。

---

## 下一阶段依赖

第4阶段（约束系统）将在此基础上：
- pulley-mount 配合 PulleyJoint 实现定滑轮/动滑轮
- anchor + RevoluteJoint 实现铰链/枢轴
- turntable + 摩擦 实现水平圆周运动场景
- conveyor 的 beltSpeed 配合受力分析展示摩擦力方向变化
