# Playbook：新增物体类型

## 1. 设计阶段

### 1.1 确定基本信息
- 物体分类：`basic`（基础体）/ `support`（支撑面）/ `mechanism`（机构）/ `surface`（特殊表面）
- 是否为静态物体（影响 `toPhysicsType` 和 `interaction.canMove`）
- 物体的默认尺寸和属性

### 1.2 设计属性面板
- 确定 `properties: PropertyDef[]` 字段列表
- 每个属性：name, label, type (number/boolean/select), min, max, step, unit
- 参考已有物体的 properties 定义

### 1.3 设计交互能力
确定 `interaction: InteractionCapability` 配置：
- canMove：true / false / 'vertical-only' / 'horizontal-only'
- canResize / canRotate / canDelete
- showRotateHandle / showResizeHandles
- 是否需要 constrainMove / constrainRotation

### 1.4 设计吸附行为
- 是否提供承载面（rest surface）供其他物体吸附
- 是否提供接触面（contact surface）用于自身吸附到其他物体
- 法线方向：rest 面法线必须指向形状外部（注意顶点顺序）

### 1.5 设计渲染
- 编辑模式渲染（renderEdit）：物体在编辑器中的外观
- 仿真模式渲染（renderSim，可选）：仿真运行时的外观
- 选中边界格式：BBox（矩形）还是 Corners（多边形顶点）

## 2. 实现阶段

### 2.1 创建描述符文件
在 `src/models/bodyTypes/` 创建 `yourType.tsx`（如需 JSX 图标则用 .tsx）。

实现必需接口：
```typescript
const yourTypeDescriptor: BodyTypeDescriptor = {
  type: 'yourType',
  label: '显示名称',
  category: 'basic', // basic/support/mechanism/surface
  defaults: { /* 默认属性 */ },
  toShapeConfig(body) { /* 返回 ShapeConfig */ },
  toDensity(body) { /* 返回密度 */ },
  renderEdit(ctx, body, scale) { /* Canvas 2D 渲染 */ },
  getSelectionBounds(body, scale) { /* 返回 { halfW, halfH } */ },
  hitTest(localX, localY, body) { /* 返回 boolean */ },
  properties: [ /* PropertyDef[] */ ],
  icon: ({ size }) => <svg>...</svg>,
}
```

实现可选接口（按需）：
- `interaction` — 交互能力配置
- `getSnapSurfaces(body)` — 吸附面定义
- `renderSim(ctx, bodyState, scale)` — 仿真渲染（注意：flipped 物体由 CanvasRenderer 在调用 renderSim 前自动处理 ctx.scale(-1,1)）
- `toPhysicsType(body)` — 覆盖物理类型
- `toUserData(body)` — 必须包含 `bodyType` 字段
- `resizeMode` — 缩放模式：'independent'（默认，双轴独立）/ 'radius'（单半径等比）/ 'uniform'（保持宽高比）
- `getLocalBBox(body)` — 局部 bbox（物理单位），包含 centerOffset（body origin 到 bbox 中心的屏幕偏移）
- `applyResize(body, newHalfW, newHalfH)` — 将新 bbox 尺寸映射为 body props

### 2.2 注册到 Registry
在 `src/models/bodyTypes/registry.ts` 添加 import：
```typescript
import './yourType'
```

描述符文件内部调用注册：
```typescript
registerBodyType(yourTypeDescriptor)
```

### 2.3 添加类型定义
在 `src/models/types.ts` 的 `BodyType` 联合类型中添加新类型。

## 3. 验证清单

- [ ] 从左侧面板拖出到画布，物体正确显示
- [ ] 选中后右侧属性面板显示所有配置的 properties
- [ ] 修改属性后画布实时更新
- [ ] 选中手柄位置正确（如用 Corners 格式，检查 centerX/centerY 偏移）
- [ ] 缩放/旋转/移动行为符合 interaction 配置
- [ ] 吸附行为正确（如配置了 getSnapSurfaces）
- [ ] 对齐辅助线正常工作
- [ ] 仿真模式行为正确（如配置了 renderSim）
- [ ] Undo/Redo 正常
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

## 4. 常见问题

- **手柄偏移**：origin 不在 bbox 中心的物体，`getLocalBBox` 必须返回正确的 `centerOffsetX/Y`（屏幕 Y-down），否则手柄位置和 resize 定位都会错
- **仿真模式不显示**：toUserData 必须返回 `{ bodyType: 'yourType' }`
- **仿真 flipped 渲染双重镜像**：通用形状渲染使用已镜像的物理顶点，不需要 ctx.scale(-1,1)。只有 renderSim 需要（由 CanvasRenderer 自动处理）
- **吸附法线反向**：rest 面的顶点顺序需使左手法线指向外部
- **描边重叠**：非球体吸附到斜面时可能需要 +0.008m 法线偏移补偿
- **resize 不需修改 SelectionHandles.ts**：只需在 descriptor 中实现 `getLocalBBox` + `applyResize` + `resizeMode`
