# M01 AI 预置场景质量梳理

## 目标

从教师使用 AI 助手的角度，梳理当前 M01 暴露给 AI 的高频预置场景，区分“可泛用教学图”和“具体题目图”，避免 AI 在用户需求较泛时直接载入过复杂或题意过窄的场景。

## 当前暴露给 AI 的预置场景

| presetId | 场景定位 | 适用性 | 结论 |
| --- | --- | --- | --- |
| `sphere-section-circle-area` | 球截面圆面积/半径关系 | 泛用教学图 | 已优先优化，适合 AI 直接调用 |
| `generic-cube-section` | 正方体三点截面 | 泛用教学图 | 新增，适合讲截面概念和三点确定截面 |
| `generic-cube-space-diagonal` | 正方体空间对角线 | 泛用教学图 | 新增，适合讲体对角线、面对角线和勾股关系 |
| `generic-cuboid-parallel-section` | 长方体平行截面 | 泛用教学图 | 新增，适合讲平行截面和对应边关系 |
| `generic-cube-line-plane-perpendicular` | 正方体线面垂直 | 泛用教学图 | 新增，适合讲侧棱垂直底面和点到平面距离 |
| `generic-cube-plane-parallel` | 正方体面面平行 | 泛用教学图 | 新增，适合讲上下底面平行和对应棱关系 |
| `generic-pyramid-height` | 棱锥高线 | 泛用教学图 | 新增，适合讲棱锥顶点到底面的高和垂足 |
| `generic-cube-line-plane-angle` | 正方体线面角 | 泛用教学图 | 新增，适合讲斜线、投影和线面角计算 |
| `generic-cube-dihedral-angle` | 正方体二面角 | 泛用教学图 | 新增，适合讲截面与底面夹角和二面角平面角 |
| `generic-cube-skew-lines-angle` | 正方体异面直线夹角 | 泛用教学图 | 新增，适合讲平移法和异面直线夹角 |
| `generic-cube-circumsphere` | 正方体外接球 | 泛用教学图 | 新增，适合讲球心、体对角线和外接球半径 |
| `generic-pyramid-dihedral-angle` | 棱锥二面角 | 泛用教学图 | 新增，适合讲侧面与底面的二面角 |
| `generic-point-plane-distance-volume` | 点面距离等体积法 | 泛用教学图 | 新增，适合讲换底求高和等体积法求距离 |
| `generic-pyramid-circumsphere` | 棱锥外接球 | 泛用教学图 | 新增，适合讲棱锥顶点共球和球半径关系 |
| `generic-prism-circumsphere` | 直棱柱外接球 | 泛用教学图 | 新增，适合讲底面外接圆、高和球半径关系 |
| `generic-cube-projection-area` | 正投影面积 | 泛用教学图 | 新增，适合讲空间图形投影面积和夹角关系 |

## 暂不暴露给 AI 默认调用的题目型场景

| presetId | 场景定位 | 适用性 | 结论 |
| --- | --- | --- | --- |
| `sphere-section-volume` | 由截面圆和球心距求球体积 | 具体题目图 | 仅在用户明确提到体积、截面圆、球心距时调用 |
| `sphere-perpendicular-chords` | 球中过一点作三条两两垂直弦 | 具体题目图 | 仅在用户明确提到垂直弦/弦长平方和时调用 |
| `cube-section-area` | 正方体过三点截面面积 | 具体题目图 | 适合明确截面面积题，不适合泛泛“正方体截面” |
| `cube-section-perimeter` | 正方体过中点截面周长 | 具体题目图 | 适合明确中点截面/周长题 |
| `cube-inscribed-sphere-section` | 正方体内接球截面形状 | 具体题目图 | 适合明确内接球/过球心截面形状判断 |
| `cuboid-parallel-plane-section` | 长方体平行平面截面关系 | 具体题目图 | 适合明确平行截面/截面面积题 |
| `regular-tetrahedron-section-area` | 正四面体外接球截面面积 | 具体题目图 | 适合明确正四面体外接球截面题 |

## 主要发现

1. 早期暴露的 8 个 preset 中，只有 `sphere-section-circle-area` 更接近泛用教学图，其余多数来自具体题目。
2. 具体题目图如果在用户需求较泛时被直接载入，容易出现“图很复杂、但教师不知道为什么是这个图”的体验问题。
3. 预置场景应当在 capability 中提供 `useWhen` 和 `teachingFocus`，让模型按知识点精确选择，而不是只根据 presetId 猜测。
4. 后续要优先建设一批“泛用教学图”，用于承接教师常见但不带具体题干的需求。

## 建议优先级

### P0：已处理

- 优化 `sphere-section-circle-area`，突出球心、截面圆心、球半径、截面半径和球心距。
- 在 `visual_m01/ai-capability.json` 中补充 `presetScenes` 说明，明确每个 preset 的适用语义和教学重点。
- 新增 `generic-cube-section`、`generic-cube-space-diagonal`、`generic-cuboid-parallel-section`、`generic-cube-line-plane-perpendicular`、`generic-cube-plane-parallel`、`generic-pyramid-height` 六个基础通用教学场景。
- 补充高考立几高频题型场景：正方体线面角、正方体二面角、正方体异面直线夹角、正方体外接球、棱锥二面角。
- 补齐 M01 收尾高频场景：点面距离等体积法、棱锥外接球、直棱柱外接球、正投影面积。
- 将题目型 preset 从 AI 默认可调用列表中移除，后续只在明确题目上下文中启用。

### P1：建议下一步处理

- 为球截面体积关系补一个泛用教学图：在 `sphere-section-circle-area` 基础上增加体积公式讲解语义。
- 为正方体内接球截面补一个泛用教学图：用于“正方体和球的关系/过球心截面”这类需求。
- 根据后续教师实测结果，决定是否补充动态最值、展开图最短路径等更窄场景；默认不进入 AI 常规 preset 列表。

### P2：后续增强

- 对所有题目型 preset 增加场景截图人工验收。
- 在 AI 助手中支持“需求过泛时先追问”，例如“你想讲截面面积、截面周长，还是截面形状？”
- 在模板能力中引入 `genericPresetScenes` 与 `problemPresetScenes` 分类。
