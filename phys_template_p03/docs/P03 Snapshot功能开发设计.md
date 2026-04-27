# P03 光学实验台 Snapshot 功能开发设计

## 1. 目标

为 P03 光学实验台接入平台统一的 Snapshot / Bridge 能力，使模板支持：

- 导出当前教学演示状态
- 从 snapshot 恢复到保存时状态
- 通过平台保存后再次打开继续编辑
- 在浏览器控制台完成最小自测

本设计参考 `visual_m05/docs/template-snapshot-bridge-guide.md`，目标先达到 L1 最低接入标准。

## 2. P03 当前状态来源

P03 是 React + Vite 单页模板，当前主要状态集中在 `src/app.tsx`：

| 状态 | 当前变量 | 是否进入 snapshot | 说明 |
| --- | --- | --- | --- |
| 当前模块 | `active` | 是 | 恢复后应回到保存时的模块 |
| 折射模块参数 | `refr` | 是 | 包含实验对象、折射率、光线角、显示开关、画布位置等 |
| 透镜模块参数 | `lens` | 是 | 包含透镜类型、物距、焦距、屏幕位置、显示开关等 |
| 双缝模块参数 | `dbl` | 是 | 包含缝间距、缝宽、屏距、波长、白光模式等 |
| 衍射模块参数 | `diff` | 是 | 包含单缝/圆孔、缝宽/孔径、波长、屏距、对比模式等 |
| 薄膜模块参数 | `film` | 是 | 包含模型类型、膜厚、折射率、楔角、曲率半径等 |
| 主题 | `theme` | 是 | 属于继续编辑时应恢复的展示偏好 |
| 光线粗细 | `rayThick` | 是 | 影响折射和透镜模块的显示效果 |
| Tweaks 面板开关 | `tweaksOpen` | 否 | 临时 UI 状态，不需要恢复 |
| 拖拽中状态 | 模块内部 pointer 状态 | 否 | 临时交互状态 |
| hover / pointer 位置 | DOM 运行时状态 | 否 | 不进入 snapshot |
| localStorage | `p03-*` | 否 | snapshot 不直接保存 localStorage，只保存业务状态 |

补充说明：

- 当前 P03 各模块没有大体量随机结果，也没有需要 seed 重放的模拟结果。
- 各模块图像、光路、条纹和读数都可以由参数实时计算，因此 snapshot 只需要保存参数，不保存 canvas 像素或 DOM。
- `canvasPanX/canvasPanY/canvasZoom` 属于教师调整后的演示视角，建议保存。

## 3. Snapshot 外层结构

P03 使用平台统一 envelope，payload 由 P03 自定义。

```ts
interface P03Snapshot {
  envelope: {
    templateKey: 'p03';
    runtimeKey: 'phys-template-p03';
    bridgeVersion: '1.0.0';
    snapshotSchemaVersion: 1;
    createdAt: string;
    updatedAt: string;
  };
  payload: P03SnapshotPayload;
}
```

字段约定：

| 字段 | 值 |
| --- | --- |
| `templateKey` | `p03` |
| `runtimeKey` | `phys-template-p03` |
| `bridgeVersion` | `1.0.0` |
| `snapshotSchemaVersion` | `1` |

## 4. Payload 设计

```ts
interface P03SnapshotPayload {
  activeModule: ModuleId;
  presentation: {
    theme: ThemeName;
    rayThick: number;
  };
  modules: {
    refraction: RefractionSettings;
    lens: LensSettings;
    doubleslit: DoubleSlitSettings;
    diffraction: DiffractionSettings;
    thinfilm: ThinFilmSettings;
  };
}
```

示例：

```json
{
  "envelope": {
    "templateKey": "p03",
    "runtimeKey": "phys-template-p03",
    "bridgeVersion": "1.0.0",
    "snapshotSchemaVersion": 1,
    "createdAt": "2026-04-27T10:00:00.000Z",
    "updatedAt": "2026-04-27T10:05:00.000Z"
  },
  "payload": {
    "activeModule": "refraction",
    "presentation": {
      "theme": "light",
      "rayThick": 2
    },
    "modules": {
      "refraction": {},
      "lens": {},
      "doubleslit": {},
      "diffraction": {},
      "thinfilm": {}
    }
  }
}
```

实际实现中，`modules` 内应写入对应模块的完整 settings 对象。

## 5. Bridge 对外能力

P03 需要暴露：

```ts
window.__EDUMIND_TEMPLATE_BRIDGE__ = {
  getDefaultSnapshot,
  getSnapshot,
  loadSnapshot,
  validateSnapshot
};
```

### getDefaultSnapshot()

返回 P03 默认状态：

- `activeModule` 默认为 `refraction`
- `modules` 使用 `window.P03_DEFAULTS`
- `presentation.theme` 默认为 `light`
- `presentation.rayThick` 默认为 `2`

用途：

- 平台创建新实例时获取初始状态
- 开发人员做控制台自测

### getSnapshot()

从当前 React 状态聚合 snapshot：

- 读取当前 `active`
- 读取 `refr/lens/dbl/diff/film`
- 读取 `theme/rayThick`
- 生成新的 `updatedAt`

注意：

- 不读取 DOM
- 不读取 canvas
- 不直接 dump localStorage
- 不保存 `tweaksOpen`

### loadSnapshot(snapshot)

恢复 snapshot 中的状态：

1. 调用 `validateSnapshot(snapshot)`
2. 校验失败时返回 `{ ok: false, errors }`
3. 校验成功后依次写回：
   - `setActive(payload.activeModule)`
   - `setTheme(payload.presentation.theme)`
   - `setRayThick(payload.presentation.rayThick)`
   - `setRefr(payload.modules.refraction)`
   - `setLens(payload.modules.lens)`
   - `setDbl(payload.modules.doubleslit)`
   - `setDiff(payload.modules.diffraction)`
   - `setFilm(payload.modules.thinfilm)`
4. 关闭临时面板：`setTweaksOpen(false)`
5. 返回 `{ ok: true }`

React 的 `useEffect` 会继续把恢复后的状态写入 localStorage，因此不需要在 `loadSnapshot` 中额外手动写 localStorage。

### validateSnapshot(snapshot)

最低校验规则：

- 必须是对象
- 必须包含 `envelope` 和 `payload`
- `templateKey === 'p03'`
- `runtimeKey === 'phys-template-p03'`
- `snapshotSchemaVersion === 1`
- `activeModule` 必须是合法模块：
  - `refraction`
  - `lens`
  - `doubleslit`
  - `diffraction`
  - `thinfilm`
- `presentation.theme` 必须是：
  - `light`
  - `dark`
  - `blueprint`
- `presentation.rayThick` 必须是有限数字
- `modules` 必须包含 5 个模块 settings
- 每个模块的 `experimentId` 必须存在且符合模块范围

建议增强校验：

- 对关键数值做有限范围检查，例如波长、折射率、焦距、屏距等。
- 对缺失字段使用默认值补齐，而不是让页面进入异常状态。

## 6. 推荐文件拆分

建议新增：

```text
src/snapshot-bridge.ts
```

职责：

- 定义 snapshot 类型
- 定义常量：
  - `P03_TEMPLATE_KEY`
  - `P03_RUNTIME_KEY`
  - `P03_BRIDGE_VERSION`
  - `P03_SNAPSHOT_SCHEMA_VERSION`
- 提供纯函数：
  - `createEnvelope()`
  - `createDefaultP03Snapshot(defaults)`
  - `createP03Snapshot(state)`
  - `validateP03Snapshot(snapshot)`

`src/app.tsx` 负责把 React state 和 setter 传入 bridge：

```ts
useEffect(() => {
  W.__EDUMIND_TEMPLATE_BRIDGE__ = createP03Bridge({
    getState: () => ({
      active,
      theme,
      rayThick,
      refr,
      lens,
      dbl,
      diff,
      film,
    }),
    setState: (payload) => {
      setActive(payload.activeModule);
      setTheme(payload.presentation.theme);
      setRayThick(payload.presentation.rayThick);
      setRefr(payload.modules.refraction);
      setLens(payload.modules.lens);
      setDbl(payload.modules.doubleslit);
      setDiff(payload.modules.diffraction);
      setFilm(payload.modules.thinfilm);
      setTweaksOpen(false);
    },
    defaults: DEFAULTS,
  });
}, [active, theme, rayThick, refr, lens, dbl, diff, film]);
```

也可以把 bridge 直接写在 `app.tsx` 中，但不推荐。独立文件更方便测试和后续 schema 升级。

## 7. postMessage 支持设计

L1 阶段只要求全局 bridge。为了后续 iframe 接入顺畅，建议同时支持最小 postMessage。

监听消息类型：

```ts
type P03BridgeMessage =
  | { type: 'edumind:getSnapshot'; requestId?: string }
  | { type: 'edumind:getDefaultSnapshot'; requestId?: string }
  | { type: 'edumind:validateSnapshot'; requestId?: string; snapshot: unknown }
  | { type: 'edumind:loadSnapshot'; requestId?: string; snapshot: unknown };
```

返回消息类型：

```ts
type P03BridgeResponse = {
  type: 'edumind:bridgeResponse';
  requestId?: string;
  ok: boolean;
  result?: unknown;
  errors?: string[];
};
```

处理原则：

- 所有调用都复用 `window.__EDUMIND_TEMPLATE_BRIDGE__`
- `loadSnapshot` 失败时不修改当前页面状态
- 返回中不抛出未捕获异常，统一返回 `ok/errors`

## 8. 不进入 Snapshot 的状态

明确不保存：

- 鼠标 hover 状态
- 正在拖拽的中间状态
- 当前动画帧
- DOM 尺寸
- canvas 绘制结果
- `tweaksOpen`
- undo / redo 历史
- toast、loading、临时提示

原因：

- 这些状态不能代表教师真正想保存的教学场景。
- 恢复这些状态容易导致页面残留异常交互状态。
- P03 的图形结果都可以由参数重新计算。

## 9. Schema 升级策略

一期使用：

```ts
snapshotSchemaVersion: 1
```

后续如果新增字段：

- 小字段新增：保持 `version = 1`，在 `loadSnapshot` 中用默认值补齐。
- 结构变化：升级到 `version = 2`，提供 `migrateSnapshotV1ToV2()`。
- 删除字段：恢复时忽略旧字段，不应导致加载失败。

建议保留向后兼容：

- 至少支持最近一个旧版本 snapshot。
- 校验错误要能说明具体字段，方便平台定位问题。

## 10. 开发步骤

1. 新增 `src/snapshot-bridge.ts`
2. 在 `src/main.tsx` 中确保 snapshot bridge 文件可被加载
3. 在 `src/app.tsx` 中接入 `createP03Bridge`
4. 暴露 `window.__EDUMIND_TEMPLATE_BRIDGE__`
5. 可选接入 postMessage
6. 控制台完成 L1 自测
7. 补充交付说明

## 11. 控制台自测

以下命令在浏览器 DevTools Console 中执行。

### bridge 是否存在

```js
window.__EDUMIND_TEMPLATE_BRIDGE__
Object.keys(window.__EDUMIND_TEMPLATE_BRIDGE__)
```

预期至少包含：

```js
["getDefaultSnapshot", "getSnapshot", "loadSnapshot", "validateSnapshot"]
```

### 默认快照

```js
const def = window.__EDUMIND_TEMPLATE_BRIDGE__.getDefaultSnapshot()
def
```

预期：

- 有 `envelope`
- 有 `payload`
- `templateKey` 为 `p03`
- `snapshotSchemaVersion` 为 `1`

### 当前快照是否随操作变化

```js
const snap1 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

在页面中切换模块或调节参数后：

```js
const snap2 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
JSON.stringify(snap1) !== JSON.stringify(snap2)
```

预期返回 `true`。

### 校验

```js
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot(snap2)
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot({})
```

预期：

- 合法 snapshot 返回 `{ ok: true, errors: [] }`
- 非法对象返回 `{ ok: false, errors: [...] }`

### 同页恢复

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

继续修改页面参数后：

```js
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(saved)
```

预期页面恢复到保存时状态，并且还能继续操作。

### 刷新后恢复

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
copy(JSON.stringify(saved))
```

刷新页面后：

```js
const restored = JSON.parse(`这里粘贴复制出的 JSON`)
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(restored)
```

预期页面恢复到保存时状态。

## 12. L1 验收标准

P03 Snapshot 功能完成后，应满足：

- `window.__EDUMIND_TEMPLATE_BRIDGE__` 存在
- `getDefaultSnapshot()` 返回默认合法 snapshot
- `getSnapshot()` 返回当前合法 snapshot
- `validateSnapshot()` 能通过合法 snapshot，并拦截非法 snapshot
- `loadSnapshot()` 能恢复 5 个模块参数、当前模块、主题和光线粗细
- 刷新页面后，粘贴保存的 JSON 仍可恢复
- 恢复后页面可继续编辑和调参

## 13. 交付说明模板

完成开发后，给平台侧补充：

```text
P03 Snapshot 接入说明

1. snapshotSchemaVersion: 1
2. 已保存状态：
   - 当前模块 activeModule
   - 主题 theme
   - 光线粗细 rayThick
   - refraction/lens/doubleslit/diffraction/thinfilm 五个模块 settings
3. 未保存状态：
   - 拖拽中状态
   - hover 状态
   - tweaks 面板开关
   - canvas 像素结果
   - localStorage 原始内容
4. 已通过测试：
   - bridge 存在
   - getDefaultSnapshot
   - getSnapshot
   - validateSnapshot
   - 同页 loadSnapshot
   - 刷新后 loadSnapshot
```

