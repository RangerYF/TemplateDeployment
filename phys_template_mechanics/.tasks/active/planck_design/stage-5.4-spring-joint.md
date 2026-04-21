# 5.4 弹簧约束 spring — 弹性距离约束

## 任务 ID
03-25-stage5.4-spring-joint

## 风险评估
- **任务类型**：新功能开发（复用 5.2/5.3 全链路，新增 descriptor + 锯齿线渲染算法）
- **风险等级**：L1（常规风险）
  - 涉及 3-4 个文件，框架已完备
  - PhysicsBridge distance 分支已在 5.3 完成，无需新增引擎代码
  - 主要工作量在锯齿线渲染算法
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

新增弹簧约束，复用全链路框架。弹簧 = DistanceJoint(frequencyHz>0)，弹性保持自然长度。

## 前置依赖

- 5.1 基础设施 ✅
- 5.2 绳约束 ✅（提供参考模式）
- 5.3 杆约束 ✅（distance 分支已就绪，sceneType 机制已建立）

## 与绳/杆的差异

| 维度 | 绳 rope | 杆 rod | 弹簧 spring |
|------|---------|--------|-------------|
| Planck Joint | RopeJoint | DistanceJoint(freq=0) | DistanceJoint(freq>0) |
| 物理行为 | 最大距离约束 | 刚性固定距离 | 弹性恢复到自然长度 |
| 渲染 | 细线+松弛下垂 | 矩形条+铰链 | 锯齿线（zigzag） |
| 颜色 | `#555` | `#555`/`#d4d4d4` | `#e67e22`（橙色） |
| 属性 | maxLength | length | springLength, stiffness, damping |
| 编辑约束 | 钳制/联动 maxLength | 钳制/联动 length | 无（弹簧可压缩可拉伸） |

## 任务清单

### 1. 实现 `spring.tsx` descriptor

**文件**：`src/models/jointTypes/spring.tsx`（新建）

从 rod.tsx 复制模式，修改：
- `type: 'spring'`，`label: '弹簧'`
- `defaults: { springLength: 2, stiffness: 4, damping: 0.5 }`
- **renderEdit**：锯齿线渲染（zigzag），颜色 `#e67e22`（橙色），选中蓝色。两端锚点圆点同绳。
- **renderSim**：同 renderEdit 逻辑，从 JointState 读锚点。仿真时弹簧可伸缩，锯齿间距随距离变化。
- **hitTest**：同绳/杆（pointToSegmentDistance）。
- **properties**：
  - `{ key: 'springLength', label: '自然长度', type: 'number', min: 0.1, step: 0.1, unit: 'm' }`
  - `{ key: 'stiffness', label: '刚度', type: 'number', min: 0.1, step: 0.5, unit: 'Hz' }`
  - `{ key: 'damping', label: '阻尼比', type: 'number', min: 0, max: 1, step: 0.1, unit: '' }`
- **toJointConfig**：返回 `{ type: 'distance', sceneType: 'spring', length: springLength, frequencyHz: stiffness, dampingRatio: damping }`

### 2. 锯齿线渲染算法

**核心算法**：在屏幕坐标下，沿 A→B 方向绘制锯齿线（zigzag）。

```
A端 ──┐   ┌──┐   ┌──┐   ┌── B端
      │   │  │   │  │   │
      └──┘   └──┘   └──┘
```

参数：
- `coilCount = 8`（锯齿数，固定）
- `amplitude = 6`（锯齿振幅 px，固定）
- 两端各留一小段直线（leadIn），约总长的 10%

步骤：
1. 计算 A→B 的屏幕方向向量和法线
2. 沿方向向量等分 coilCount 段
3. 奇数点偏移 +amplitude，偶数点偏移 -amplitude（沿法线方向）
4. 首尾连接到 A、B 锚点

仿真时弹簧伸缩：锯齿间距自动随 A-B 距离变化（coilCount 固定，间距 = 可用长度 / coilCount）。

### 3. 在 index.ts 注册

**文件**：`src/models/jointTypes/index.ts`

添加 `import './spring'`

### 4. 编辑约束

弹簧不需要拖拽钳制/联动（可压缩可拉伸），但 PropertyPanel 的 `enforceConstraintLength` 需要确保不会误触发 spring 类型。

当前 `enforceConstraintLength` 只处理 rope 和 rod，spring 不在其中，无需修改。

### 5. JointState 扩展（如需）

仿真时渲染需要知道弹簧自然长度（用于视觉区分拉伸/压缩状态），检查 JointState 是否已有 length 字段可复用。

当前 JointState 已有 `length?: number`（5.3 新增），spring 的 toJointConfig 设 `length: springLength`，getJointStates 已传递 length。可复用，无需新增字段。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/models/jointTypes/spring.tsx` | 新建 |
| `src/models/jointTypes/index.ts` | 添加 import |
| `src/components/panels/PropertyPanel.tsx` | 扩展 enforceConstraintLength + 添加"恢复自然长度"按钮 |

## 实现记录

- ✅ spring.tsx descriptor 完成（zigzag 渲染 + 属性 + toJointConfig）
- ✅ index.ts 注册完成
- ✅ 属性面板"恢复自然长度"按钮完成（用户反馈：构建场景时需要直观判断弹簧是否处于自然长度）
- ✅ `pnpm lint && pnpm tsc --noEmit` 通过

## 验收标准

- [ ] 用 JointTool 选"弹簧" → 连接两物体 → 锯齿线（橙色）显示
- [ ] 仿真模式：弹簧振动，两物体弹性恢复到自然长度
- [ ] 选中弹簧，属性面板显示 springLength / stiffness / damping 可编辑
- [ ] 属性面板"恢复自然长度"按钮可用，点击后物体移动到自然长度位置
- [ ] 仿真时锯齿线随弹簧伸缩变化（间距动态调整）
- [ ] Delete 删除弹簧，Ctrl+Z 撤销
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

## 技术备注

### Planck.js DistanceJoint 弹簧模式
```typescript
// frequencyHz > 0 时表现为弹簧
world.createJoint(new DistanceJoint({
  length: 2.0,         // 自然长度
  frequencyHz: 4.0,    // 弹簧刚度（频率越高越硬）
  dampingRatio: 0.5,   // 阻尼比（0=无阻尼振荡，1=临界阻尼）
  localAnchorA: Vec2,
  localAnchorB: Vec2,
  bodyA: Body,
  bodyB: Body,
}))
```

### 复用 5.3 已有设施
- PhysicsBridge `case 'distance'` 分支已支持 frequencyHz/dampingRatio 参数
- JointState 已有 `length` 字段
- `sceneType` 机制已建立，spring 设 `sceneType: 'spring'`
- 工具函数 localToWorld / pointToSegmentDistance 各 descriptor 独立复制
