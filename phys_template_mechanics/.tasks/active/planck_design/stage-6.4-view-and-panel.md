# 6.4 受力分析视角 + 面板集成

## 任务 ID
03-26-20-00-force-view-panel

## 风险评估
- **任务类型**：新功能（状态管理 + UI + 渲染条件控制）
- **风险等级**：L1（常规风险）
  - 3 个文件改动 + 1 个面板组件新建/改造
  - 无复杂算法，主要是状态联动和 UI 渲染
  - 依赖 6.1-6.3 的基础设施，数据管道已就绪
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

打通"视角切换 → 力渲染 → 面板显示"完整链路。完成后：
- 工具栏"受力"按钮可切换受力视角
- 受力视角下：编辑模式显示用户外力箭头，仿真模式显示所有力箭头
- 选中物体时，右侧面板显示双 Tab（属性 / 受力分析）
- 受力分析 Tab 显示力列表（系统力只读 + 外力可编辑）
- ForceTool 仅在受力视角下可用
- 快捷键 1/2 切换视角

## 上游依赖
- 6.1 基础设施 ✅（SceneForce + forceStore + ForceTool + RenderOptions）
- 6.2 力收集 ✅（ForceData[] 数据管道）
- 6.3 力渲染 ✅（ForceRenderer + hitTest + 分解动画）

## 下游消费
- 阶段 7 运动视角：复用 viewMode 扩展（'default' | 'forces' | 'motion'）

---

## 关键数据确认

### 当前 editorStore 状态
```typescript
mode: 'edit' | 'simulate'
simState: 'stopped' | 'playing' | 'paused'
gravity: { x: number; y: number }
// 需新增：viewMode: 'default' | 'forces'
```

### 当前 Toolbar 布局
```
物理编辑器  ↶ ↷ │ 🔘选择  🔗约束▾  💪力 │ 👁受力(disabled) │ ▶播放  编辑模式
```
- "受力"按钮已存在（Eye 图标），当前 `disabled`，需启用并绑定 viewMode

### 当前 PropertyPanel 结构
- 选中 body → PropertyPanel（属性面板）
- 选中 joint → JointPropertyPanel
- 无 Tab 机制，需新增

### 力数据来源
| 场景 | 数据 | 说明 |
|------|------|------|
| 编辑模式·受力视角 | `scene.forces`（SceneForce[]）| 仅外力，从 SceneForce 构造 ForceData |
| 仿真模式·受力视角 | `forceDataRef.current`（ForceData[]）| ForceCollector 收集的完整力数据 |

---

## 执行计划（5 步）

### 步骤 1：editorStore 扩展 viewMode

**修改文件**：`src/store/editorStore.ts`

**新增状态**：
```typescript
viewMode: 'default' | 'forces'
```

**新增方法**：
```typescript
setViewMode: (mode: 'default' | 'forces') => void
toggleForceView: () => void  // 切换受力视角
```

**行为规则**：
- `stop()` 时不重置 viewMode（视角跨编辑/仿真保持）
- viewMode 独立于 mode/simState

### 步骤 2：Toolbar 视角切换启用 + 快捷键

**修改文件**：`src/components/Toolbar.tsx`

**改动**：
- 移除"受力"按钮的 `disabled` 状态
- 绑定 `toggleForceView` 方法
- 激活时蓝色高亮（同工具选中态）
- 仿真模式下保留视角按钮可见

**修改文件**：`src/components/Canvas.tsx`

**快捷键**：
- `1` → `setViewMode('default')`
- `2` → `setViewMode('forces')`

### 步骤 3：Canvas 渲染条件控制

**修改文件**：`src/components/Canvas.tsx`

**编辑模式渲染**：
```typescript
const viewMode = useEditorStore.getState().viewMode
const showForces = viewMode === 'forces'
// renderScene 传入 showForces + sceneForces
```

**仿真模式渲染**：
```typescript
if (viewMode === 'forces' && forceDataRef.current.length > 0) {
  // 合并 BodyState 实时位置到 SceneBody
  // 调用 renderer.render 传入 simOptions
}
```

**ForceTool 限制**：
- 切换到 ForceTool 时，如果 viewMode !== 'forces'，自动切换到受力视角
- 或者：viewMode !== 'forces' 时，工具栏力按钮 disabled

### 步骤 4：PropertyPanel 双 Tab + 受力分析 Tab

**修改文件**：`src/components/panels/PropertyPanel.tsx`

**双 Tab UI**：
```
┌────────────────────────┐
│ [ 属性 ] [ 受力分析 ]    │  ← Tab 栏
│  ▔▔▔▔▔                 │     当前 Tab 蓝色下划线
├────────────────────────┤
│  （Tab 内容区）          │
└────────────────────────┘
```

**Tab 切换规则**：
- 默认视角：只显示"属性" Tab（受力 Tab 隐藏）
- 受力视角：两个 Tab 都显示，自动切到"受力分析"
- 选中约束时：只显示"属性" Tab
- 未选中物体时：受力 Tab 显示"选中物体查看受力"提示

**受力分析 Tab 内容**（仿真模式·选中物体时）：
```
物块 #1 · 受力列表

☑ 🟢 G  重力    19.6N ↓    系统力（只读）
☑ 🟣 N  支持力  19.6N ↑
☑ 🟠 f  摩擦力   5.9N ←
☑ 🔵 T  张力     8.0N ↗
☑ 🔴 F  外力    10.0N → ✎   外力（可编辑）
───────────────────────
☐ ⚫ F合 合力     4.1N →    合力（默认隐藏）
```

**编辑模式·受力视角·选中物体时**：
- 仅显示该物体的外力列表（SceneForce）
- [+ 添加外力] 按钮
- 外力可编辑大小和方向

**力列表交互**：
- 点击力列表项 → 选中对应力箭头（高亮）
- ☑ 勾选框 → 控制单个力箭头的显隐
- ✎ 编辑图标（仅外力）→ 展开大小/方向编辑

### 步骤 5：集成验证 + 清理

**验证流程**：
1. 编辑模式默认视角 → 无力箭头
2. 按 2 或点击"受力" → 切换到受力视角
3. 有外力的物体显示红色箭头
4. 切换到仿真 → 所有 dynamic 物体显示完整力箭头
5. 选中物体 → 右侧面板显示力列表
6. 面板中点击力 → 画布上对应箭头高亮
7. 按 1 → 回到默认视角，力箭头消失

---

## 涉及文件清单

### 修改文件（4个）
| 文件 | 改动 |
|------|------|
| `src/store/editorStore.ts` | 新增 viewMode 状态 + setViewMode/toggleForceView |
| `src/components/Toolbar.tsx` | 启用受力按钮 + 绑定 viewMode 切换 |
| `src/components/Canvas.tsx` | 渲染条件控制（showForces 取自 viewMode） + 仿真模式力渲染 + 快捷键 1/2 |
| `src/components/panels/PropertyPanel.tsx` | 双 Tab UI + 受力分析 Tab + 力列表 |

### 读取文件（参考）
| 文件 | 用途 |
|------|------|
| `src/renderer/ForceRenderer.ts` | renderForces API + getLastRenderItems |
| `src/engine/types.ts` | ForceData / CollectedForceType 类型 |
| `src/models/types.ts` | SceneForce 类型 |
| `stage-6-force-system.md` 6.0 设计方案 E | 面板布局参考 |

---

## 验收标准

### 视角切换
✅ 点击工具栏"受力"按钮 → 切换到受力视角（按钮蓝色高亮）
✅ 再次点击 → 回到默认视角
✅ 快捷键 1 → 默认视角，2 → 受力视角
✅ 仿真模式下视角按钮仍可用

### 力箭头显示控制
✅ 默认视角：无论编辑还是仿真，不显示力箭头
✅ 受力视角·编辑模式：显示用户外力箭头
✅ 受力视角·仿真模式：显示所有力箭头（重力/支持力/摩擦力/张力/外力）
✅ 力箭头跟随物体运动（仿真模式实时更新）

### 面板
✅ 默认视角选中物体 → 只有"属性" Tab
✅ 受力视角选中物体 → 双 Tab（属性 + 受力分析），自动切到受力 Tab
✅ 受力分析 Tab 显示力列表，系统力只读，外力可编辑
✅ 力列表按 G→N→f→T→F→F合 排序
✅ 点击力列表项 → 画布上对应箭头选中高亮

### ForceTool 限制
✅ 默认视角下 ForceTool 按钮 disabled（或点击自动切换到受力视角）

### 门禁
✅ `pnpm lint && pnpm tsc --noEmit` 通过

## 设计变更记录（用户验收反馈）

原计划基于全局 viewMode 切换（工具栏"受力"按钮），用户反馈后改为：
1. **去掉全局开关** — 删除 Toolbar 受力按钮 + editorStore viewMode
2. **面板始终可见** — 选中物体即显示双 Tab（属性/受力分析）
3. **编辑模式也显示全部力** — probeForces（save→step(5)→collect→restore）
4. **每个力可单独显隐** — forceDisplayStore.hiddenForceKeys + Eye/EyeOff checkbox
5. **批量显隐** — "全部显示"/"全部隐藏"按钮
6. **仿真模式跟随面板** — Canvas 渲染过滤 hiddenForceKeys

### 新增文件
- `src/store/forceDisplayStore.ts` — 力显示状态管理

### Bug 修复轮（2026-03-26）
7. **合力独立计算** — resultant 加入 CollectedForceType，Canvas 从全部力计算合力（不受显隐影响），面板显示合力行可独立显隐
8. **仿真模式力跟随** — sim 渲染时用 BodyState 实时位置替换 sceneBodies 静态位置
9. **力选中独立于物体选中** — selectionStore 新增 selectedForceId/hoveredForceId，与 selected(body/joint) 分离；SelectableObject 移除 'force' 类型
10. **外力方向滑轨** — ExternalForceEditor 添加 Slider ±180°，0°=物体角度（bodyAngle），编辑区默认展开
11. **外力行布局** — 删除 Pencil 编辑图标，原位改为 Trash2 删除图标；Slider+Input 同行
12. **系统力可点击** — 修复 `if(force.sourceId)` 守卫，系统力用 `${bodyId}:${forceType}` 作为 forceId
13. **外力标签序号** — F1/F2/F3 自动编号，ForceData.label 字段传递到渲染器

### Bug 修复轮续2（2026-03-26）
14. **支撑面力默认隐藏** — forceDisplayStore 新增 `_manualOverrides` 追踪用户手动操作；Canvas 用 `category === 'support'` 判断支撑类；渲染+store 双层过滤，手动覆盖后可显示
15. **摩擦力方向反转** — ForceCollector 切线公式从 `(-normal.y, normal.x)` 修正为 `(normal.y, -normal.x)`（Planck.js 约定）
16. **移除 Toolbar 力按钮** — 创建外力统一从面板操作
17. **面板 Tab 简化** — "受力分析" → "力"；外力排序提到最前
18. **滑轨 ±180° 闪烁** — ExternalForceEditor 用 local state (dragging/localDeg) 控制拖拽中的值，不从 store 反算
19. **正交分解面板入口** — forceDisplayStore 新增 `decomposedForceKeys` + `toggleDecompose`；面板力行添加 Split 图标（非合力行）
20. **分解渲染优化** — 参考 p01：线宽 1.8px/70%透明度、标签 11px 下标₁₂、引导线用力颜色、直角标记 8px 在力尖端、坐标轴 #CBD5E0 [6,4]
21. **分解持久化+仿真跟随** — decomposedForceKeys 在 store 持久化，progress=1 后保持；DecompositionState Map 每帧传给渲染器
22. **分解轴智能选择** — 有接触力时 axisAngle 从 contactNormal 推导（沿接触面），无接触时默认 0
23. **分量从物体边缘出发** — 用 getEdgeStart(body.position, compDir, geo) 计算每个分量的独立边缘起点
24. **分量共线避让** — 与其他力同向（dot > 0.87）时垂直偏移 10px；反向不避让；偏移方向与合力偏移相反
25. **面板交互优化** — 图标 hover 灰→黑、cursor-pointer；Tip 组件替代浏览器 title；行本身不变小手

### Bug 修复轮续3（2026-03-26）
26. **滑轮座力默认隐藏** — pulleyMount category 从 'mechanism' 改为 'support'
27. **滑轮绳张力方向** — ForceCollector 对 pulley 类型特殊处理：magnitude 取自 getReactionForce，方向沿绳段（锚点→groundAnchor）
28. **滑轮绳张力避让** — ForceRenderer 层2连接件方向：pulley 类型改为从物体到 pulleyMount 位置（非另一端物体）
29. **面板力数据不同步** — Canvas 编辑模式始终同步 setAvailableForces（引用比较避免重复）；forceDisplayStore.setAvailableForces 优化避免无变化时创建新 Set
30. **去掉力箭头起点圆点** — 教材无此圆点，EDGE_GAP 归零，删除 DOT_RADIUS
31. **共线避让全面修复** — 层1（力-力）、层3（合力）的共线检测从 Math.abs(dot) 改为 dot（仅同向避让）

### 当前状态
- **✅ 用户验收通过，阶段 6.4 完成**（2026-03-26）

## 不包含的内容（留给后续）
- 仿真暂停时力数据冻结展示
