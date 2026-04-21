# 模板 Snapshot / Bridge 接入指南

基于 `visual_m05` 试点整理。  
这份文档是给模板负责人的**接入方法说明**，不是固定代码模板。

文档目标只有一句话：

> 让每个模板都具备“导出当前状态、恢复当前状态、通过平台保存后继续编辑”的最小能力。

---

## 1. 先说结论

模板负责人一期只需要先完成 4 件事：

1. 实现 `getSnapshot()`
2. 实现 `loadSnapshot(snapshot)`
3. 实现 `validateSnapshot(snapshot)`
4. 暴露 `window.__EDUMIND_TEMPLATE_BRIDGE__`

只要这 4 件事完成，并通过文档中的自测，模板就达到了 **L1 最低接入标准**。

---

## 2. 这份文档怎么用

这份文档**不是要求所有模板写成一样的代码**。

因为当前模板库的实际情况是：

- 不同同学负责不同模板
- 技术栈版本不完全一致
- 代码组织方式不同
- 很多开发会借助 AI 完成

所以本文档分成两类内容：

### 必须严格一致的部分

- snapshot 外层结构
- 必须暴露的 bridge 能力
- 自测方式
- 验收标准

### 可以灵活实现的部分

- 内部 store 怎么组织
- 文件怎么拆
- 局部函数怎么命名
- 代码风格长什么样
- 是一个 store 还是多个 store

一句话理解：

> **结果必须一致，代码细节不要求一致。**

---

## 3. 谁负责什么

### 模板负责人负责

- 梳理模板里哪些状态要保存
- 实现 `getSnapshot()`
- 实现 `loadSnapshot(snapshot)`
- 实现 `validateSnapshot(snapshot)`
- 暴露 `window.__EDUMIND_TEMPLATE_BRIDGE__`
- 跑完自测并给平台侧反馈

### 平台负责人负责

- 模板目录后端化
- 实例后端化
- 工作台接入
- iframe / 宿主侧 bridge 调度
- 数据库存储与版本控制

所以模板负责人要解决的是：

> “我的模板如何可保存、可恢复、可继续编辑”

而不是：

> “平台整体怎么建”

---

## 4. 先理解 3 个核心概念

### 4.1 snapshot 是什么

snapshot 本质上就是模板当前状态的一份 JSON 存档。

可以把它理解为：

- 游戏的存档文件
- 编辑器的恢复点
- 下次继续编辑时要读取的状态

平台后续做“继续编辑”，本质就是：

1. 模板导出 snapshot
2. 平台把 snapshot 存到后端
3. 下次打开实例时，再把 snapshot 传回模板
4. 模板恢复到上次状态

---

### 4.2 bridge 是什么

bridge 是模板和平台之间约定好的调用接口。

当前试点里最简单的做法是，先把它挂在浏览器全局对象上：

```ts
window.__EDUMIND_TEMPLATE_BRIDGE__
```

后续如果模板通过 iframe 接入平台，也会通过 `postMessage` 调用同样的能力。

所以：

- `window.__EDUMIND_TEMPLATE_BRIDGE__` 是本地调试入口
- `postMessage` 是后续远程调用方式

底层能力是同一套。

---

### 4.3 为什么不是保存整个页面

因为真正要持久化的不是 DOM，而是“继续编辑所需的业务状态”。

一般来说：

### 不建议保存

- hover
- loading
- toast
- 正在拖拽
- 正在播放动画的某一帧
- undo / redo 历史

### 建议优先保存

- 当前内容
- 当前参数
- 当前结果
- 必要的 UI 模式

### 关于“大结果”的额外原则

如果模板运行后会产生大量结果数据，例如：

- 10000 次抛硬币结果
- 大量随机点
- 大量轨迹点
- 大量逐帧中间值

不建议默认把这些数据完整塞进 snapshot。  
更推荐的思路是：

1. 优先保存“最小可恢复状态”
2. 能重算的结果尽量不直接存
3. 对随机模拟类模板，优先考虑保存：
   - `seed`
   - `params`
   - `engineVersion`
   - `resultSummary`

这样恢复时可以通过相同的 seed 和算法版本，重新生成同样的结果，而不是把大体量结果完整写入 snapshot。

---

## 5. 平台统一要求什么

平台不会要求所有模板内部数据结构都一样。  
平台只要求统一两件事：

1. snapshot 的外层结构
2. 对外暴露的最小 bridge 能力

也就是说：

- 模板内部 payload 可以不同
- 但模板导出的 snapshot 文档必须长得“像同一种文档”
- 对于大体量结果数据，模板应优先考虑“可重放”而不是“全量内嵌”

---

## 6. 统一 snapshot 结构

统一的是外层结构，不要求所有模板内部 payload 一样。

推荐结构如下：

```json
{
  "envelope": {
    "templateKey": "m05",
    "runtimeKey": "visual-m05",
    "bridgeVersion": "1.0.0",
    "snapshotSchemaVersion": 1,
    "createdAt": "2026-04-09T12:00:00.000Z",
    "updatedAt": "2026-04-09T12:05:00.000Z"
  },
  "payload": {}
}
```

### 约束

- `envelope` 由平台规范统一
- `payload` 由模板自己定义
- 必须有 `snapshotSchemaVersion`
- `payload` 中保存什么，由模板负责人根据“继续编辑需要恢复什么”来决定

### 最实用的判断标准

如果用户下次打开模板时，希望这个状态还在，那它就应该考虑进入 snapshot。  
如果这个状态只是运行时临时现象，就不要放进去。

### 对大结果的判断标准

如果某段数据满足下面任意一个条件，建议不要默认全量存入 snapshot：

1. 可以通过参数重新计算
2. 可以通过随机种子重放
3. 只是中间过程数据，不是最终编辑语义
4. 会导致 snapshot 明显膨胀

---

## 7. 模板必须暴露哪些能力

模板最少需要对平台暴露这 4 个能力：

```ts
getDefaultSnapshot()
getSnapshot()
loadSnapshot(snapshot)
validateSnapshot(snapshot)
```

这里的重点是：

> **能力必须存在，不要求所有模板内部按同一套代码写法实现。**

---

## 8. 模板负责人接入方法

下面是推荐方法，不是唯一实现方式。

### 步骤 1：先梳理哪些状态必须恢复

先回答两个问题：

1. 用户下次继续编辑时，必须恢复哪些状态？
2. 哪些状态只是临时运行时状态，不需要恢复？

不要一上来就 dump 整个 store。

---

### 步骤 2：找到模板真正的状态来源

有的模板是一个 store，  
有的模板是多个 store，  
有的模板甚至没有明显 store。

没关系，你只需要回答：

1. 当前编辑状态从哪里读出来？
2. 恢复时应该写回哪里？

---

### 步骤 3：聚合成模板级 snapshot

不管内部状态有几个来源，最后都要聚合成一份模板级 snapshot：

- 上层是统一 envelope
- 下层是模板自定义 payload

---

### 步骤 4：实现恢复逻辑

`loadSnapshot(snapshot)` 的目标不是“还原一切运行时细节”，而是：

1. 恢复内容
2. 恢复参数
3. 恢复结果
4. 恢复必要 UI 状态
5. 清理不该恢复的临时态

如果模板里存在大体量随机结果，恢复逻辑还要回答一个问题：

> 这些结果是直接从 snapshot 里恢复，还是通过 seed 重放恢复？

推荐优先选择后者。

---

### 步骤 5：暴露 bridge

最简单的做法是先挂到浏览器全局对象：

```ts
window.__EDUMIND_TEMPLATE_BRIDGE__
```

这样平台联调前，模板负责人自己就能先在控制台调通。

---

### 步骤 6：可选增加最小 postMessage 支持

这不是一期强制项，但如果做了，后续 iframe 接入会更顺。

M-05 当前已经支持通过消息请求：

- `getSnapshot`
- `loadSnapshot`
- `validateSnapshot`

---

## 9. 用 M-05 做例子说明

`visual_m05` 当前的思路是：

### 9.1 它的核心状态来源

- `simulationStore`
- `uiStore`
- `animationStore`

其中 `historyStore` 没有进入 snapshot，只在加载时清空。

### 9.2 它保存了什么

- 当前模拟实体集合
- 当前激活模拟
- 参数
- 模拟结果
- 当前分类
- 结果面板状态
- 动画模式偏好
- 单次模拟积累结果

### 9.2.1 当前优化方向

`M-05` 这类随机模拟模板，后续推荐把大结果改成：

- `seed + params + engineVersion + resultSummary`

而不是默认把 10000 条随机结果完整写入 snapshot。

这样做的好处：

- snapshot 更小
- 自动保存更轻
- 网络与数据库压力更小
- 更适合长期平台化

### 9.3 它没有保存什么

- undo / redo 历史
- 播放中的动画中间帧
- hover / toast / loading

### 9.4 这意味着什么

恢复后能做到：

- 回到保存时状态
- 继续编辑
- 继续运行

但不保证恢复到“动画播放到一半”的瞬时状态。  
这是一期最推荐的做法。

---

## 10. 模板负责人自测方法

以下测试必须在 **浏览器 DevTools Console** 中完成，不是在 PowerShell 终端。

### 测试 1：bridge 是否存在

```js
window.__EDUMIND_TEMPLATE_BRIDGE__
```

预期：返回对象，而不是 `undefined`。

再执行：

```js
Object.keys(window.__EDUMIND_TEMPLATE_BRIDGE__)
```

预期至少包含：

```js
["getDefaultSnapshot", "getSnapshot", "loadSnapshot", "validateSnapshot"]
```

---

### 测试 2：默认快照是否可导出

```js
const snap = window.__EDUMIND_TEMPLATE_BRIDGE__.getDefaultSnapshot()
snap
```

预期：

- 有 `envelope`
- 有 `payload`
- `templateKey` 正确
- `snapshotSchemaVersion` 为数字

---

### 测试 3：当前快照是否随操作变化

```js
const snap1 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

然后在页面中：

- 改参数
- 切模式
- 运行一次模拟

再执行：

```js
const snap2 = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

预期：

- `snap2` 与 `snap1` 不同
- 新参数和结果已经进入 snapshot

---

### 测试 4：validateSnapshot 是否正常

```js
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot(snap2)
```

预期：

```js
{ ok: true, errors: [] }
```

再执行：

```js
window.__EDUMIND_TEMPLATE_BRIDGE__.validateSnapshot({})
```

预期：

```js
{ ok: false, errors: [...] }
```

---

### 测试 5：同页恢复测试

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
```

然后继续修改页面状态，最后执行：

```js
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(saved)
```

预期：

- 页面恢复到保存时状态
- 恢复后还能继续编辑

---

### 测试 6：刷新后恢复测试

```js
const saved = window.__EDUMIND_TEMPLATE_BRIDGE__.getSnapshot()
copy(JSON.stringify(saved))
```

刷新页面后执行：

```js
const restored = JSON.parse(`这里粘贴复制出的 JSON`)
window.__EDUMIND_TEMPLATE_BRIDGE__.loadSnapshot(restored)
```

预期：

- 页面恢复
- 能继续操作

---

## 11. 自测验收标准

### L1 最低通过标准

1. `window.__EDUMIND_TEMPLATE_BRIDGE__` 存在
2. `getSnapshot()` 能返回合法对象
3. `loadSnapshot(snapshot)` 能恢复状态
4. `validateSnapshot(snapshot)` 能通过合法快照、拦截非法快照
5. 刷新后重新加载 snapshot 仍能恢复
6. 恢复后还能继续编辑

### L2 建议通过标准

1. 能识别 dirty 状态
2. 明确哪些状态进入 snapshot，哪些不进入
3. 恢复后没有异常动画或中间状态残留

---

## 12. 交付给平台同学时需要补充的说明

模板负责人完成接入后，至少补 4 条说明：

1. 当前 snapshot 保存了哪些状态
2. 哪些状态没有保存
3. 当前 `snapshotSchemaVersion`
4. 是否已通过“刷新后恢复”测试

---

## 13. 当前 M-05 试点结论

`visual_m05` 已完成模板侧最小 snapshot 接入，具备：

- 导出当前编辑状态
- 从 JSON 恢复继续编辑
- 基础 snapshot 校验
- bridge 暴露

因此它可以作为其他模板接入 `getSnapshot/loadSnapshot` 的参考样板。

---

## 14. 给模板负责人的一句话提醒

你不需要把模板改成和 M-05 一模一样。  
你只需要保证：

1. 能导出当前状态
2. 能恢复当前状态
3. snapshot 外层结构正确
4. 自测通过

做到这 4 点，就已经满足一期接入要求。
