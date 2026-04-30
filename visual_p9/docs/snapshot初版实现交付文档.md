# visual_p09 Snapshot 初版实现交付文档

## 接入结论

`visual_p09` 已按 `接入snapshot的指导.md` 完成 L1 Snapshot 最小接入，并补充了与 `visual_m05` 一致的 postMessage 调用入口。

- Bridge 全局入口：`window.__EDUMIND_TEMPLATE_BRIDGE__`
- postMessage namespace：`edumind.templateBridge`
- templateKey：`phys-P09`
- runtimeKey：`visual-p09`
- bridgeVersion：`1.0.0`
- snapshotSchemaVersion：`2`

## 已暴露能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| `getDefaultSnapshot()` | 已实现 | 返回 P09 默认模型、默认参数、默认 UI 视图，不依赖当前编辑状态 |
| `getSnapshot()` | 已实现 | 导出当前可恢复状态 |
| `loadSnapshot(snapshot)` | 已实现 | 校验通过后恢复业务状态和必要 UI 状态；恢复时清空动画瞬时帧 |
| `validateSnapshot(snapshot)` | 已实现 | 校验 envelope、schema、payload.simulation、payload.ui 的基础结构 |
| postMessage `getSnapshot` | 已实现 | 对齐 M05 的 `edumind.templateBridge` 消息入口 |
| postMessage `loadSnapshot` | 已实现 | 加载失败时返回 `success: false` 和错误信息 |
| postMessage `validateSnapshot` | 已实现 | 返回 `{ ok, errors }` |

## Snapshot 保存了哪些状态

### `payload.simulation`

- 当前模型 ID：`currentModelId`
- 所有 P09 模型的参数：`paramsByModel`
- 播放状态：`isPlaying`
- 播放倍率：`speedMultiplier`
- 显示开关：`showVectors`、`showAreaSectors`
- 霍曼转移阶段：`hohmannPhase`
- 霍曼点火角：`hohmannIgnitionAngle`

### `payload.ui`

- 左侧模型栏宽度：`layout.leftWidth`
- 右侧参数栏宽度：`layout.rightWidth`
- Canvas 平移与缩放：`viewport.offsetX`、`viewport.offsetY`、`viewport.zoom`

## 没有保存哪些状态

- `elapsedSeconds` 动画瞬时帧：恢复时重置为 `0`，避免继续编辑时卡在半帧状态。
- 拖拽中的临时状态：例如栏宽拖拽过程、Canvas pointer 捕获状态。
- hover、临时高亮、浏览器滚动条位置。
- Canvas 轨迹点、实时数值面板计算结果：这些都可由参数和当前模型重新计算。

## 与指导文档的一致性

| 指导文档要求 | 实现情况 |
| --- | --- |
| 统一 `envelope + payload` 外层结构 | 一致 |
| envelope 包含 `templateKey/runtimeKey/bridgeVersion/snapshotSchemaVersion/createdAt/updatedAt` | 一致 |
| 暴露 `getDefaultSnapshot/getSnapshot/loadSnapshot/validateSnapshot` | 一致 |
| 保存最小可恢复业务状态，不保存中间帧和临时交互态 | 一致 |
| 合法 snapshot 可恢复，非法 snapshot 可拦截 | 一致 |
| 可选 postMessage 支持 | 已补充 |

## 与 visual_m05 接入方式的一致性

| 对照项 | visual_m05 | visual_p09 |
| --- | --- | --- |
| 全局 bridge 名称 | `window.__EDUMIND_TEMPLATE_BRIDGE__` | 一致 |
| postMessage namespace | `edumind.templateBridge` | 一致 |
| Snapshot 外层结构 | `envelope + payload` | 一致 |
| 多 store 聚合 | simulation / ui / animation | simulation / ui |
| 加载时清理不保存的运行时状态 | 重置 history 等临时状态 | 重置 `elapsedSeconds` |
| 大结果压缩/重放 | M05 对随机结果做 compact/hydrate | P09 无大结果，轨迹和数值按参数重算 |

## 自动检查记录

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript 类型检查 | `PATH=/root/.nvm/versions/node/v22.22.1/bin:$PATH pnpm tsc --noEmit` | 通过 |
| Snapshot 契约检查 | 使用 esbuild 临时打包 `src/templateBridge.ts` 到 `/tmp/visual_p09_snapshot_bridge_test.mjs` 后执行 Node 脚本 | 通过 |

契约检查覆盖：

- 默认快照 `templateKey === "phys-P09"`
- 默认快照 `runtimeKey === "visual-p09"`
- 默认快照 `snapshotSchemaVersion === 2`
- `getSnapshot()` 导出的当前快照可通过 `validateSnapshot()`
- `validateSnapshot({})` 可返回失败并报告 `缺少 envelope / 缺少 payload`
- 修改后的模拟状态可通过 `loadSnapshot()` 恢复
- 修改后的栏宽和 Canvas 视口可通过 `loadSnapshot()` 恢复

## 需要人工在浏览器中检查的内容

以下检查必须在浏览器 DevTools Console 中执行，终端无法完全替代：

1. 启动页面：`pnpm dev`
2. 打开 DevTools Console，执行：

```js
window.__EDUMIND_TEMPLATE_BRIDGE__
Object.keys(window.__EDUMIND_TEMPLATE_BRIDGE__)
```

预期：返回 bridge 对象，keys 至少包含 `getDefaultSnapshot/getSnapshot/loadSnapshot/validateSnapshot`。

3. 默认快照检查：

```js
const defaultSnap = window.__EDUMIND_TEMPLATE_BRIDGE__.getDefaultSnapshot()
defaultSnap
```

预期：包含 `envelope` 和 `payload`，`templateKey` 为 `phys-P09`，`snapshotSchemaVersion` 为 `2`。

4. 当前快照随操作变化：

```js
const snap1 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

然后在页面修改模型、参数、栏宽或 Canvas 缩放，再执行：

```js
const snap2 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot(snap2)
```

预期：`snap2` 与 `snap1` 不同，校验返回 `{ ok: true, errors: [] }`。

5. 同页恢复：

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
// 再修改页面状态
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(saved)
```

预期：模型、参数、播放设置、栏宽、Canvas 平移缩放恢复到保存状态，并且恢复后可以继续操作。

6. 刷新后恢复：

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
copy(JSON.stringify(saved))
```

刷新页面后：

```js
const restored = JSON.parse(`粘贴复制出的 JSON`)
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(restored)
```

预期：页面恢复，且可继续编辑。

## 当前注意事项

- 本实现只负责模板侧 Snapshot 接入，不包含数据库写入、实例 ID 管理或平台后端持久化。
- `snapshotSchemaVersion` 已升级为 `2`，因为新增了 `payload.ui`；加载 schema 1 的旧快照时，UI 会回退到默认值。
- 如果平台侧希望 `loadSnapshot` 在失败时抛异常而不是返回 `{ ok: false }`，需要在宿主侧做适配；当前 P09 保留返回结果方式，便于控制台自测。
