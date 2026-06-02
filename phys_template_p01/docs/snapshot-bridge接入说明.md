# Snapshot Bridge 接入说明

当前模板已接入平台 L1 bridge：

- `window.__EDUMIND_TEMPLATE_BRIDGE__.getDefaultSnapshot()`
- `window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()`
- `window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(snapshot)`
- `window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot(snapshot)`

## 已保存状态

### 通用

- 当前模板 key：`p04` / `p08` / `p13`
- 当前 hash 路由
- 通用 simulator 场景实体、关系、参数、视角与显示选项
- P08 场线、等势线、电势图、轨迹、测量点、场线密度
- 电路 builder 工作区实体、连线、参数、模板上下文、画布视角

### P04

- 电学实验预设页的通用 simulator 状态
- 电路 builder 工作区状态
- 伏阻法专题页参数
- 安阻法专题页参数

### P08

- `#p08` 预设场景通用状态
- `#p08-builder` 场搭建器实体、参数、显示与测量状态

### P13

- `P13-BASE-001` 参数、播放时间、分析步骤、显示选项
- 单棒三类页面参数、播放时间、分析步骤、电容情形、显示选项
- 双棒基础与双棒恒外力参数、播放时间、分析步骤、显示选项
- 竖直导轨参数、播放时间、分析步骤、显示选项
- `#p13-builder` 当前模型族、变体、参数、播放时间、分析步骤、显示选项

## 暂未完整保存

- P04 其他专题页中仍放在组件本地 `useState` 的细粒度 UI 状态
- hover、toast、拖拽中、播放动画中间帧、undo/redo 历史
- 大体量计算结果；恢复时优先依据参数重新计算

## 自测

在浏览器 DevTools Console 中执行：

```js
Object.keys(window.__EDUMIND_TEMPLATE_BRIDGE__)
```

预期至少包含：

```js
["getDefaultSnapshot", "getSnapshot", "loadSnapshot", "validateSnapshot"]
```

基础恢复测试：

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot(saved)
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(saved)
```

刷新后恢复：

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
copy(JSON.stringify(saved))
```

刷新页面后：

```js
const restored = JSON.parse(`粘贴 JSON`)
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(restored)
```
