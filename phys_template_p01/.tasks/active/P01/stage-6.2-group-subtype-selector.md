# 阶段6.2：分组预设子类型选择器

> 任务ID：03-20-16-00-P01-stage6.2-group-subtype-selector
> 风险等级：L1（常规风险 — 2~3 文件改动，公共 Shell 层变更但不影响数据层）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成** ✅（2026-03-20）
> 前置依赖：阶段6 场景统一化整改（已完成）

## 目标

将分组预设（如「悬挂模型」）的子类型选择从 PresetGallery 页面的展开子卡片，改为参数面板顶部的芯片切换器。点击分组入口后直接进入场景，子类型在参数面板内切换。

## 背景

需求文档中「悬挂模型」是单一入口，交互流程为：

```
预设选择页 → 点击「悬挂模型」→ 直接进入场景（默认加载第一个子类型）
                                     ↓
                              参数面板顶部显示：
                              ○单绳  ●双绳  ○绳+杆
                              ─────────────────
                              质量 m  [====●===] 1.0kg
                              左绳角度 ...
```

当前实现：点击「悬挂模型」→ Gallery 页面展开子卡片 → 再点一次才进入场景。多了一步，且交互体验与需求文档不符。

## 改造方案

### 1. PresetGallery：分组入口直接加载

**文件**：`src/shell/pages/PresetGallery.tsx`

当前分组卡片点击行为：`setExpandedGroup(entry.group)` → 展开子卡片列表。

改为：点击分组卡片 → `onSelectPreset(entry.presets[0].id)` → 直接加载第一个子类型预设进入场景。

删除展开/折叠逻辑（`expandedGroup` state、展开后的子卡片渲染）。

### 2. ParamPanel：顶部子类型切换器

**文件**：`src/shell/panels/ParamPanel.tsx`

新增 props：

```typescript
interface ParamPanelProps {
  schemas: ParamSchema[];
  values: ParamValues;
  onValueChange: (key: string, value: number | boolean | string) => void;
  onBack?: () => void;
  // 新增
  groupPresets?: Array<{ id: string; name: string }>;  // 同 group 的预设列表
  activePresetId?: string;                              // 当前激活的预设 ID
  onSwitchPreset?: (presetId: string) => void;          // 切换子类型回调
}
```

当 `groupPresets` 存在且 length > 1 时，在参数面板"参数设置"标题下方渲染芯片切换器：

```tsx
{groupPresets && groupPresets.length > 1 && (
  <div className="flex gap-1.5 px-3 pb-2" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
    {groupPresets.map((p) => (
      <button
        key={p.id}
        onClick={() => onSwitchPreset?.(p.id)}
        className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
        style={{
          backgroundColor: p.id === activePresetId ? COLORS.primary : COLORS.bgMuted,
          color: p.id === activePresetId ? COLORS.white : COLORS.textSecondary,
        }}
      >
        {p.name}
      </button>
    ))}
  </div>
)}
```

### 3. App.tsx：传递分组信息 + 子类型切换

**文件**：`src/shell/App.tsx`

在 SimulatorView 中：

1. 当前预设加载后，检查是否有 `group` 字段
2. 如有，从 `presetRegistry.getAll()` 中筛选同 group 的预设，按 `groupOrder` 排序
3. 将 `groupPresets`、`activePresetId`、`onSwitchPreset` 传给 ParamPanel
4. `onSwitchPreset` 实现：加载新预设，保留同名参数的值（如 mass）

#### 切换时参数保持

切换子类型时，同名参数（如 `mass`）应保持当前值：

```typescript
function handleSwitchPreset(newPresetId: string) {
  const oldValues = { ...store.paramValues };
  // 加载新预设
  loadPreset(newPresetId);
  // 恢复同名参数
  const newPreset = presetRegistry.get(newPresetId);
  if (newPreset) {
    for (const group of newPreset.paramGroups) {
      for (const param of group.params) {
        if (param.key in oldValues && param.key in newPreset.paramValues) {
          handleParamChange(param.key, oldValues[param.key]);
        }
      }
    }
  }
}
```

## 验证要点

1. `pnpm lint && pnpm tsc --noEmit` 通过
2. 预设选择页：「悬挂模型」显示为 1 张卡片，点击直接进入场景（加载单绳悬挂）
3. 参数面板顶部出现 `○单绳 ○双绳 ○绳+杆` 芯片
4. 点击「双绳」→ 画布切换为双绳场景，参数面板更新为双绳参数，mass 保持原值
5. 点击「绳+杆」→ 同理切换
6. 无 group 的预设（水平面、斜面）行为不变，无芯片栏
7. 从场景页返回预设选择页，再次点击「悬挂模型」正常加载

## 文件变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `src/shell/pages/PresetGallery.tsx` — 分组入口直接加载首个子类型，删除展开逻辑 |
| 修改 | `src/shell/panels/ParamPanel.tsx` — 新增子类型芯片切换器 |
| 修改 | `src/shell/App.tsx` — 传递 groupPresets 信息 + handleSwitchPreset 实现 |
