# 阶段 8.1：物体交互增强

- **任务ID**: 03-28-stage8.1-interaction
- **风险等级**: L1
- **状态**: ✅ 已完成
- **前置依赖**: 8.0 Bug修复 ✅

## 目标

增加物体翻转能力和地面联动行为，提升场景搭建灵活性。

## 任务1：物体翻转

### 现状分析

- `SceneBody`（`src/models/types.ts:5-47`）无翻转相关字段
- `CanvasRenderer.ts:174-175` 渲染时只有 `translate + rotate`，无 `scale(-1,1)` 支持
- `SelectTool.ts:316-320` 的 `onKeyDown` 仅处理 Escape
- 非对称物体：slope（三角形方向）、hemisphere（弧线方向）、anchor（mountSide 方向）、conveyor（beltSpeed 方向）
- 对称物体（翻转仅改角度或无视觉变化）：block、ball、wall、bar、groove、pulley-mount

### 设计方案

**方案：SceneBody 新增 `flipped` 字段 + Canvas scale + 物理形状镜像**

1. **数据层**：`SceneBody` 新增 `flipped?: boolean`
2. **渲染层**：`CanvasRenderer` 渲染物体时，若 `body.flipped`，在 rotate 后加 `ctx.scale(-1, 1)`
3. **物理层**：`sceneSync` 创建物理形状时，若 `flipped`，镜像 x 坐标（对称物体无需处理）
4. **命令**：复用 `BatchPropertyCommand`，修改 `{ flipped: !body.flipped }`
5. **触发方式**：快捷键 H（水平翻转），选中物体时可用

### 执行步骤

```
1. types.ts 添加 flipped 字段
→ 2. CanvasRenderer 渲染时应用 scale(-1, 1)
→ 3. sceneSync 创建物理形状时镜像 x 坐标
→ 4. 各非对称 bodyType 的 getSnapSurfaces/hitTest 处理 flipped 状态
→ 5. SelectTool/Canvas 添加 H 快捷键
→ 6. 验证翻转后的物理行为正确
```

### 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/models/types.ts` | SceneBody 新增 `flipped?: boolean` |
| `src/renderer/CanvasRenderer.ts:174` | 渲染时 flipped 物体加 `ctx.scale(-1, 1)` |
| `src/engine/sceneSync.ts` | 创建物理形状时镜像 flipped 物体的几何 |
| `src/models/bodyTypes/slope.tsx` | getSnapSurfaces / hitTest 处理 flipped |
| `src/models/bodyTypes/hemisphere.tsx` | getSnapSurfaces 处理 flipped |
| `src/models/bodyTypes/anchor.tsx` | mountSide 在 flipped 时镜像 |
| `src/core/tools/SelectTool.ts:316` | onKeyDown 添加 H 键翻转 |
| `src/components/Canvas.tsx` | 键盘事件中不拦截 H 键（让 SelectTool 处理） |

### 注意事项

- 翻转后 getSnapSurfaces 返回的 contact 面也需镜像，否则吸附位置不对
- 翻转后 hitTest 也需镜像 local 坐标（或在调用前翻转坐标）
- getSelectionBounds 对对称包围盒不受影响，但 corners 类型需要镜像
- 对称物体（block/ball/wall 等）翻转只改字段，渲染和物理无额外处理
- 翻转操作通过 `BatchPropertyCommand` 实现，自动支持 Ctrl+Z 撤销

### 验收标准

- ✅ 选中斜面按 H 可翻转方向（左低右高 ↔ 右低左高）
- ✅ 翻转后斜面物理碰撞正确（物块能在翻转后的斜面上滑动）
- ✅ 翻转后吸附正常（斜面翻转后仍可吸附到地面）
- ✅ 翻转操作可 Ctrl+Z 撤销

---

## 任务2：地面联动物体上移

### 现状分析

- ground 的 `canMove: 'vertical-only'`（`ground.tsx:72`）
- `SelectTool.ts:498-510` 处理 vertical-only 拖拽，直接调用 `moveBody`
- `sceneStore.moveBody`（`sceneStore.ts:65-73`）仅修改单个物体 position
- PropertyPanel 通过 `liveUpdate` 修改地面 y 坐标，也是单物体更新
- 无任何"地面接触检测"或联动机制

### 设计方案

**方案：拖拽地面时实时检测接触物体并同步移动**

1. 拖拽开始时（`beginMoveDrag`），如果拖拽的是 ground：
   - 扫描所有物体，用 snap 引擎判断哪些物体"在地面上"（contact 面与 ground rest 面距离 < 阈值）
   - 记录这些物体的 ID 列表
2. 拖拽过程中（`handleMoveDrag`），ground 的 vertical-only 分支：
   - 移动 ground 的同时，同步移动所有接触物体（相同 dy）
3. 拖拽结束时（`finishMoveDrag`）：
   - 生成一个 `BatchMoveCommand`，包含 ground + 所有联动物体
4. PropertyPanel 修改地面 y 时，也需触发联动

### 执行步骤

```
1. 编写 getGroundContactBodyIds() 工具函数
→ 2. SelectTool beginMoveDrag 中检测接触物体
→ 3. handleMoveDrag vertical-only 分支同步移动接触物体
→ 4. finishMoveDrag 生成 BatchMoveCommand
→ 5. PropertyPanel 地面 y 修改时触发联动
→ 6. 验证联动行为
```

### 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/core/tools/SelectTool.ts` | beginMoveDrag 记录接触物体、handleMoveDrag 同步移动、finishMoveDrag 生成批量命令 |
| `src/core/snap/SnapEngine.ts`（或新文件） | 新增 `getGroundContactBodyIds()` 工具函数 |
| `src/components/panels/PropertyPanel.tsx` | 地面 y 属性修改时触发联动 |

### 接触检测逻辑

```typescript
function getGroundContactBodyIds(groundY: number, allBodies: SceneBody[]): string[] {
  const contacted: string[] = []
  for (const body of allBodies) {
    if (body.type === 'ground') continue
    // 用 computeSnap 检查：如果物体 snap 到 ground 的距离 < 阈值，说明在地面上
    // 或者简化：用物体的 contact surface y 与 groundY 的差值判断
    const desc = getBodyDescriptor(body.type)
    const surfaces = desc.getSnapSurfaces?.(body) ?? []
    for (const surf of surfaces) {
      if (surf.type === 'contact') {
        const contactY = (surf.start.y + surf.end.y) / 2
        if (Math.abs(contactY - groundY) < 0.05) {
          contacted.push(body.id)
          break
        }
      }
    }
  }
  return contacted
}
```

### 注意事项

- 接触检测的阈值（0.05m）需要与 snap 精度匹配，避免误判
- 联动物体如果本身也有约束（绳/杆/弹簧），需要考虑是否触发约束重算
- PropertyPanel 的 liveUpdate 是实时的（拖滑块时连续触发），联动性能需注意
- 只联动"直接在地面上"的物体，不递归处理（如斜面上的物块）

### 验收标准

- ✅ 拖拽地面上移时，地面上的物体一起上移
- ✅ 悬空物体不受地面移动影响
- ✅ 联动操作可 Ctrl+Z 一次性撤销（ground + 所有联动物体）
- ✅ PropertyPanel 修改地面 y 时也触发联动

---

## 执行顺序

| 步骤 | 任务 | 预计 |
|------|------|------|
| 1 | 任务2：地面联动物体上移 | 40min |
| 2 | 任务1：物体翻转 — 数据层 + 渲染层 | 30min |
| 3 | 任务1：物体翻转 — 物理层 + snap/hitTest | 40min |
| 4 | 任务1：物体翻转 — 快捷键 + 命令 | 15min |
| 5 | 回归验证 + lint + tsc | 15min |

先做地面联动（依赖已有 snap 机制，改动更独立），再做翻转（涉及多文件联动）。

## 执行记录

### 任务2：地面联动 ✅
- `SnapEngine.ts` 新增 `getGroundContactBodyIds()` — 递归检测直接和间接接触物体（斜面上的物块也跟随）
- `SelectTool.ts` — 拖拽 ground 时记录接触物体、同步移动、动态检测新接触物体（地面碰到悬空物体时纳入联动）
- `PropertyPanel.tsx` — 编辑 ground Y 时同样触发联动
- 接触检测增加 X 重叠检查，避免同一高度但水平无交集的物体被误判
- 联动物体用 `BatchMoveCommand` 打包，Ctrl+Z 一次性撤销

### 任务1：斜面拖拽自然翻转 ✅
- **方案调整**：用户明确不要快捷键/翻转按钮，改为 resize 拖过对面边界时自然镜像
- `types.ts` — SceneBody 新增 `flipped?: boolean`（内部字段）
- `SelectionHandles.ts` — `computeResize` corner + edge-w/edge-e 允许宽度越零，toggle flipped，center offset 用 rawW 保证平滑
- `CanvasRenderer.ts` — flipped 物体渲染加 `ctx.scale(-1, 1)`（编辑+仿真）
- `sceneSync.ts` — `mirrorShapeX` 镜像物理形状顶点（reverse 保持 CCW）
- `slope.tsx` — `slopeVertices()` 处理 flipped，getSnapSurfaces 翻转时交换 rest surface 顶点顺序保持法线朝外
- Bug修复：props.flipped 必须始终写入（updateBody 是 merge，不写就不清除）
