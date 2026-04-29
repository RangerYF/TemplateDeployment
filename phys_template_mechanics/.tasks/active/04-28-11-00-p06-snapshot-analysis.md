# P06 snapshot 功能分析

## 用户原始需求

用户要求：分析 P06，本次任务是对于 P06 开发 snapshot 功能，并参考 visual_m05 试点文档，实现模板导出当前状态、恢复当前状态、通过平台保存后继续编辑的最小能力。

## 任务评估

- 任务类型：功能开发
- 复杂度等级：中等
- 风险等级：L2 高风险
- 推荐流程路径：MODE 0 -> MODE 1 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- 强制门禁：
  - 数据契约校验：确认 P06 状态字段、类型、嵌套层级后再实现
  - `src/` 变更后执行 `pnpm lint && pnpm tsc --noEmit`
  - 浏览器 DevTools Console 执行 bridge 自测

## 当前分析结论草稿

- P06 是独立公式驱动模块，不走普通力学模板 `Scene/Body/Joint` 链路。
- 仓库已有普通模板侧 `src/templates/templateBridge.ts` 与 `src/templates/snapshot.ts`，但 P06 需要独立接入或抽象复用 bridge 类型。
- P06 snapshot 一期应优先保存最小可恢复状态，不保存动画逐帧状态。

## P06 状态结构样例

真实状态来源位于 `src/components/p06/P06WavePage.tsx`：

- `activeModuleId`：由路由 `#p06?module=...` 的 `moduleId` 归一化得到。
- `singleParams: WaveParams`：单波传播/横纵波/平移相关参数。
- `superpositionParams: SuperpositionParams`：同频干涉/异频拍相关参数。
- `standingParams: StandingParams`：驻波相关参数。
- `dopplerParams: DopplerParams`：多普勒相关参数。
- `displayOptions`：分量波/合成波/驻波标记/方向箭头显示开关。
- `selectedIndex`：当前观察质点索引。
- `direction: WaveDirection`：波传播方向。
- `timeS`：当前演示时间。
- `isPlaying`：是否播放。
- `playbackRate`：播放速度倍率。

派生状态不应进入 snapshot：

- `selectedX`、波长、周期、相位、叠加结果、驻波波节波腹、多普勒波前数组等都可由参数和 `timeS` 重算。
- SVG/DOM、hover、动画 raf id 不进入 snapshot。

## 建议 snapshot payload

```ts
interface P06SnapshotPayload {
  activeModuleId: P06ModuleId
  params: {
    single: WaveParams
    superposition: SuperpositionParams
    standing: StandingParams
    doppler: DopplerParams
  }
  ui: {
    displayOptions: {
      showComponents: boolean
      showCombined: boolean
      showStandingMarkers: boolean
      showDirectionArrows: boolean
    }
    selectedIndex: number
    direction: WaveDirection
  }
  playback: {
    timeS: number
    isPlaying: boolean
    playbackRate: 0.25 | 0.5 | 1 | 1.5 | 2
  }
}
```

## 实现建议

- 新增 `src/components/p06/snapshot.ts`：定义 P06 snapshot 类型、默认快照、clone、validate、normalize。
- 在 `P06WavePage.tsx` 内用当前 state 实现 `getSnapshot/loadSnapshot/getDefaultSnapshot/validateSnapshot`，并通过 effect 挂载 `window.__EDUMIND_TEMPLATE_BRIDGE__`。
- P06 进入/离开时要清理 bridge，避免与普通模板 `templateBridge` 互相污染。
- `loadSnapshot` 后应同步路由到 `#p06?module=<activeModuleId>`，并恢复 state；`selectedIndex` 需按当前模块粒子数 clamp。
- 可选支持与现有 bridge 相同 namespace 的 `postMessage`：`edumind.templateBridge`。

## 执行记录

- 已新增 `src/components/p06/snapshot.ts`，定义 P06 snapshot envelope/payload、默认快照、解析和校验。
- 已修改 `src/components/p06/P06WavePage.tsx`：
  - 用最新运行态 ref 导出 snapshot，避免动画时间更新导致 bridge 每帧重装。
  - 实现 `getDefaultSnapshot/getSnapshot/loadSnapshot/validateSnapshot`。
  - 挂载 `window.__EDUMIND_TEMPLATE_BRIDGE__`，并支持 `edumind.templateBridge` postMessage 调用。
  - `loadSnapshot` 恢复模块、参数、显示选项、选中质点、方向、时间、播放状态和播放倍率。
- 已修改 `src/types/templateBridge.d.ts`，将全局 bridge 类型改为普通模板和 P06 都能兼容的通用接口。

## 验证记录

- `pnpm lint`：通过。
- `pnpm tsc --noEmit`：通过。
- 浏览器 Console 自测：未在本轮执行，需启动页面后按接入文档测试。

## 审查结论

`:white_check_mark: 实现完全匹配计划`

## 2026-04-28 报错修复记录

用户在浏览器 Console 自测时发现：

- `window.__EDUMIND_TEMPLATE_BRIDGE__` 初始存在。
- `getDefaultSnapshot()` 可正常返回。
- 后续再次调用 `getSnapshot()` / `validateSnapshot()` 时，报 `Cannot read properties of undefined`。

根因：

- `src/App.tsx` 中普通模板 bridge 的安装/卸载 effect 对所有非 `module/module-scene` 路由都会调用 `uninstallTemplateBridge()`。
- P06 页面自己安装 bridge 后，父级 `App` 的非普通模板路由分支又把全局 `window.__EDUMIND_TEMPLATE_BRIDGE__` 删除。

修复：

- 在 `src/App.tsx` 的普通模板 bridge 卸载逻辑中排除 `route.page === 'p06'`，P06 路由下由 `P06WavePage` 自己管理 bridge 生命周期。

验证：

- `pnpm lint`：通过。
- `pnpm tsc --noEmit`：通过。
