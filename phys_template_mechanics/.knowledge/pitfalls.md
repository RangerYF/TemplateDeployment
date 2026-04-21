# 经验教训与已知陷阱

## 旋转

### 旋转方向计算
- **现象**：鼠标顺时针移动，物体逆时针旋转
- **原因**：`atan2(dx, dy)` 计算的是从 Y+ 轴到鼠标向量的顺时针角度，但物理引擎 angle 为 CCW 正方向。物体局部 Y-up = `(-sin(a), cos(a))`，要让它指向鼠标需取反 dx
- **修复**：使用 `Math.atan2(-dx, dy)` 而非 `Math.atan2(dx, dy)`
- **文件**：SelectTool.ts

### 旋转开始跳变
- **现象**：开始旋转一瞬间物体角度跳变
- **原因**：绝对角度计算，鼠标在旋转柄位置的角度与 body 当前 angle 差距大
- **修复**：dragStart 时记录 `rotateAngleOffset = body.angle - mouseAngle`，每帧 `newAngle = mouseAngle + offset`（相对旋转）
- **文件**：SelectTool.ts

## 缩放

### 累积误差导致灵敏度过高
- **现象**：鼠标轻微移动，物体尺寸剧烈变化
- **原因**：每帧用累积增量叠加到已被修改的当前 body 尺寸（二次叠加）
- **修复**：保存 `dragStartBody` 快照，始终基于原始尺寸 + 总增量计算绝对值
- **适用范围**：所有基于拖拽的连续变换都应使用快照模式
- **文件**：SelectionHandles.ts

### 视口缩放中心偏移（未以鼠标为锚点）
- **现象**：滚轮缩放时画面会“漂移”，缩放中心不在鼠标位置
- **原因**：`zoom` 偏移公式只按 offset 与缩放比换算，未完整纳入画布中心基准与 Y 轴翻转坐标系
- **修复**：先用旧视口反算鼠标点对应世界坐标，再用新 scale 反推 offset，保持同一世界点映射到同一屏幕鼠标点
- **教训**：涉及 world/screen 双向换算的缩放逻辑，必须以“不变世界点”约束推导公式，不能直接套比例
- **文件**：src/store/viewportStore.ts

## 选中框

### Corners 格式的 AABB 中心偏移
- **现象**：斜面/半球面的手柄位置与形状不匹配
- **原因**：`getSelectionBBox` 对 corners 格式计算 AABB 时，只返回 halfW/halfH 忽略了中心与原点的偏移（斜面中心在 y=-h/6，半球面在 y=r/2）
- **修复**：SelectionBBox 增加 centerX/centerY 偏移字段，所有坐标计算应用偏移
- **文件**：SelectionHandles.ts

## 吸附

### 法线方向取决于顶点顺序
- **问题**：`createSnapSurface('rest', v1, v2)` 的左手法线可能指向形状内部
- **规则**：顶点顺序 v1→v2 的左手法线指内部，v2→v1 指外部。rest 面（承载面）法线必须指向外部
- **修复示例**：slope.tsx 中交换为 `createSnapSurface('rest', v2, v1, ...)`
- **flipped 注意**：镜像顶点 x 坐标后绕向反转，必须同时交换 rest surface 顶点顺序以保持法线朝外
- **文件**：各物体类型的 getSnapSurfaces

### 描边重叠补偿
- **现象**：物块吸附到斜面后有 2px 视觉重叠
- **原因**：Canvas lineWidth=2 描边以边界为中心线±1px。球体是点接触（不可见），物块是线接触（可见）
- **修复**：非球体的 offsetDist += 0.008m 补偿
- **文件**：SnapEngine.ts

### 固定面吸附的几何不一致
- **现象**：锚点/滑轮座吸附到地面或斜面后，固定墙面会悬空或埋入目标面
- **原因**：`renderEdit` 使用的视觉固定面几何与 `getSnapSurfaces` 使用的 contact 几何不一致；同时通用 `VISUAL_GAP` 会给“必须贴合”的固定面额外制造缝隙
- **修复**：将固定面几何抽成共享函数，`renderEdit` 与 `getSnapSurfaces` 共同使用；对 anchor / pulley-mount 这类固定面驱动的物体禁用通用 visual gap
- **文件**：anchor.tsx, pulleyMount.tsx, SnapEngine.ts

## 渲染

## 模板数据

### 手工内置模板场景与编辑器行为漂移
- **现象**：模板初始位姿与编辑器拖拽吸附结果不一致（如“看起来贴地但仍有视觉偏差”），或教学语义与场景行为偏离（如名为“匀速直线”但行为不符合预期）。
- **原因**：在 `catalog` 里手工拼装 `scene`，关键位姿/关系依赖人工估值而非编辑器同源算法，验收迭代中容易反复漂移。
- **修复**：阶段一回收内置 `scene` 数据，仅保留模板 `meta`；后续统一由指令系统生成场景，并复用编辑器同源逻辑（`descriptor defaults + computeSnap`）构建关键关系。
- **文件**：`src/templates/catalog.ts`、`.tasks/active/template/PROGRESSIVE-PLAN.md`、`.tasks/active/template/2-template-command-system.md`

### 指令程序与 JSON 资产漂移
- **现象**：模板能加载，但实际行为与命令定义不一致；问题常在后续手改 JSON 时才暴露。
- **原因**：`commandProgram`（生成真值）与 `sceneJsonPath`（运行资产）缺少自动一致性校验，二者可独立演进导致漂移。
- **修复**：一致性校验迁移到生成阶段：`templates:generate-json` 对 `sceneSource=command` 模板执行命令生成与校验；运行时 loader 仅做 scene sanity，不承担命令 diff。
- **文件**：`scripts/generate-template-scene-json.mjs`、`src/templates/commands/validator.ts`、`src/templates/loader.ts`、`src/templates/catalog-data/templates.json`

### snapTo 阈值导致模板生成失败
- **现象**：执行 JSON 生成脚本时，模板指令在 `snapTo` 步骤报错（`snap target not found`），导致产物中断。
- **原因**：`computeSnap` 默认阈值 0.3m；若 `addBody` 初始位姿离目标承载面过远，吸附不会命中。
- **修复**：模板命令作者需将初始位姿预置到阈值附近，或显式传入更大的 `snapTo.threshold`（必要时允许 `allowNoSnap`）。
- **文件**：`src/templates/commands/executor.ts`、`src/templates/commands/examples.ts`、`src/core/snap/SnapEngine.ts`

### 悬挂模板画面紧凑导致受力箭头可读性差
- **现象**：锚点悬挂类模板中，绳/杆看起来过短、物体靠得太近，受力箭头与标签拥挤，教学演示难读。
- **原因**：早期模板锚点高度普遍偏低（约 2~3m），且锚点到悬挂体的静止几何链路过短，场景布局空间不足。
- **修复**：把可读性约束纳入 sanity gate：固定锚点 `y > 9`；静止悬挂（anchor-dynamic 的 rope/rod）链路 `d > 4`；并回调模板布局参数到该基线。
- **文件**：`src/templates/commands/validator.ts`、`src/templates/commands/examples.ts`

### 模板隐式初速度/尺寸漂移
- **现象**：部分模板在未明确教学意图时带有非零初速度或非默认尺寸，导致“为什么会动/为什么大小不同”难以解释。
- **原因**：缺少模板级策略声明，sanity 校验无法区分“教学需要的偏离”和“无意引入的偏离”。
- **修复**：在 `TemplateCommandProgram` 增加策略位：`allowNonZeroInitialVelocity`、`allowCustomBodySize`；默认从严校验，只有显式声明才允许偏离。
- **文件**：`src/templates/commands/schema.ts`、`src/templates/commands/validator.ts`、`scripts/generate-template-scene-json.mjs`、`src/templates/loader.ts`

### 手写 constructionSteps 与命令序列容易漂移
- **现象**：模板的构造步骤文案与实际命令执行顺序不一致，教学说明与场景行为对不上。
- **原因**：`constructionSteps` 由人工维护，命令调整后未同步更新文案。
- **修复**：`ready` 模板的 `constructionSteps` 统一由 `commandProgram.commands` 自动推导；`planned` 模板只保留占位步骤。
- **文件**：`src/templates/catalog.ts`、`src/templates/schema.ts`、`src/templates/presets/*/*.json`

### 教学元信息字段同质化会增加维护噪音
- **现象**：`curriculumContext/usageGuide/knowledgePoints` 在大量模板中重复率极高，卡片展示和配置维护负担高，但教学增益有限。
- **原因**：字段设计偏大而缺少“差异性价值”准入标准，导致信息冗余。
- **修复**：模板教学元信息收敛为最小字段集：`teachingObjective + constructionSteps`；工作台卡片仅保留 `name + id + status`。
- **文件**：`src/templates/schema.ts`、`src/templates/presets/*/*.json`、`src/components/workbench/WorkbenchPage.tsx`

### 运行时继续消费 preset 会导致职责耦合与资产覆盖风险
- **现象**：模板链路难以理解（运行时和生成态耦合）；并且脚本/回写容易误改手工模板资产。
- **原因**：`preset` 同时承担“命令输入 + 运行态目录”两类职责，`catalog` 与 `preset` 的边界不清晰。
- **修复**：拆分为“运行态只读 `catalog-data + scene`，生成态只读 `preset(commandProgram)`”；生成脚本仅处理 `sceneSource=command`，显式跳过 `manual`；开发态保存改为回写 `catalog-data/templates.json + public scene json`。
- **文件**：`src/templates/catalog-data/*.json`、`src/templates/catalog.ts`、`src/templates/loader.ts`、`scripts/generate-template-scene-json.mjs`、`vite.template-preset-save-plugin.ts`

### 开发态写盘能力若泄露到生产会造成模板资产被误改
- **现象**：若生产环境也暴露“保存预置”入口，普通用户可直接覆盖模板配置与场景 JSON。
- **原因**：本地回写依赖 Vite middleware 文件系统写入能力，天然属于开发工具链，不应进入教学运行态。
- **修复**：保存/导出入口仅在 `import.meta.env.DEV` 显示；写盘接口仅 `apply: 'serve'` 挂载开发服务器。
- **文件**：`vite.template-preset-save-plugin.ts`、`vite.config.ts`、`src/components/layout/TemplateDevActions.tsx`

### 本体颜色与选中颜色耦合
- **现象**：统一改成教材式黑线后，选中蓝框也被改黑；或者为了恢复蓝框，不得不让某些物体读取外层 `strokeStyle`
- **根因**：`renderEdit()` 同时承担“绘制本体”和“表达选中态”两种职责，CanvasRenderer 通过改写同一个 `ctx.strokeStyle` 驱动两种语义，自定义物体内部再覆盖颜色后就会互相污染
- **修复**：将编辑态渲染拆成两层：`renderEdit()` 固定绘制黑色本体，`renderSelectionOutline()` 单独绘制蓝色 hover / selected overlay；CanvasRenderer 统一控制 overlay 层
- **教训**：对象语义色和交互语义色必须分层，不能复用同一条颜色状态链路。凡是 descriptor 内部存在固定色或装饰线条的物体，都应优先实现独立 selection outline
- **文件**：src/renderer/CanvasRenderer.ts, src/models/bodyTypes/descriptor.ts, src/models/bodyTypes/wall.tsx, src/models/bodyTypes/halfSphere.tsx, src/models/bodyTypes/anchor.tsx, src/models/bodyTypes/pulleyMount.tsx

### 非 React 状态变化不触发重绘
- **现象**：Tool 的属性变化后画布视觉不更新
- **原因**：Tool 属性不是 React state，变化不触发 re-render
- **修复**：在 handleMouseMove 中 tool 处理后主动调用 `renderFrame()`
- **文件**：Canvas.tsx

### Canvas cursor 同步
- **现象**：切换工具或 hover 不同物体后，鼠标光标样式不变
- **原因**：Canvas 的 cursor 样式取自 React state，但 Tool 的 cursor 属性是普通字段，变化后不会触发 React 更新
- **修复**：在 handleMouseMove 中 tool 处理后，手动读取 `activeTool.cursor` 并同步到 canvas element 的 style.cursor
- **文件**：Canvas.tsx

## 仿真

### toUserData 必须返回 bodyType
- **问题**：Ground 在仿真模式不显示正确形状
- **原因**：renderBody 通过 `userData.bodyType` 查找 descriptor 的 renderSim。如果 toUserData 不返回 bodyType，走通用 shape 渲染
- **修复**：descriptor 的 `toUserData` 必须包含 `bodyType` 字段
- **文件**：各物体类型 descriptor

### body.type 是 Planck 类型
- **注意**：Planck.js 的 `body.type` 返回 `'static'`/`'dynamic'`/`'kinematic'`，不是业务物体类型
- **获取业务类型**：通过 `body.userData.bodyType`
- **文件**：CanvasRenderer.ts（原 `body.type === 'dynamic'` 是 bug，应为 `body.type !== 'static'`）

## Planck.js Joint API

### RopeJoint 构造函数不接受两个锚点
- **现象**：绳约束创建后不连接在物体上，仿真时绳断开
- **原因**：`new RopeJoint(opts, bodyA, bodyB, anchorA, anchorB)` 的第4参数是单个 anchor（可选），不是两个锚点。正确做法是用 `RopeJointDef` 形式，传 `localAnchorA` / `localAnchorB`（**局部坐标**）
- **修复**：使用 `new RopeJoint({ maxLength, localAnchorA, localAnchorB, bodyA, bodyB })` 形式，世界坐标需通过 `worldToLocal` 转为局部坐标
- **文件**：PhysicsBridge.ts

### Joint.getAnchorA/B 返回世界坐标
- **现象**：仿真时绳的渲染位置与物体脱离
- **原因**：`getJointStates` 把 JointConfig 中的世界坐标锚点当作局部坐标做旋转变换
- **修复**：直接调用 `joint.getAnchorA()` / `joint.getAnchorB()` 读取实时世界坐标，不要手动变换
- **文件**：PhysicsBridge.ts

### 引擎 type 与场景 type 不一致导致仿真渲染丢失
- **现象**：杆约束在编辑模式正常显示，播放仿真后消失
- **原因**：rod descriptor 注册 type='rod'（场景层），但 toJointConfig 返回 type='distance'（引擎层，映射到 Planck DistanceJoint）。getJointStates 把引擎层 type 传给 JointState，渲染器用 'distance' 查 getJointDescriptor 找不到
- **修复**：JointConfig/JointState 新增 `sceneType` 字段，toJointConfig 设置 `sceneType: 'rod'`，渲染器优先用 `sceneType ?? type` 查找 descriptor
- **规则**：当一个约束的场景类型和引擎 Joint 类型不一致时（如 rod→DistanceJoint, spring→DistanceJoint），必须设置 sceneType
- **文件**：engine/types.ts, PhysicsBridge.ts, rod.tsx, CanvasRenderer.ts

### JointTypeDescriptor 接口需要完整 Viewport
- **现象**：descriptor 的 renderEdit/renderSim 拿不到 worldToScreen 所需的 offset 和 canvasSize
- **原因**：5.1 设计时接口只传了 `scale: number`，但约束渲染需要将世界坐标转屏幕坐标
- **修复**：接口参数从 `scale: number` 改为 `viewport: Viewport`
- **文件**：descriptor.ts, CanvasRenderer.ts

## 弹簧物理量

### stiffness 字段是 frequencyHz 不是弹簧常数 k
- **现象**：弹性势能 `½ × stiffness × Δx²` 计算结果数量级不对
- **原因**：`SceneJoint.stiffness` 存的是 Planck.js DistanceJoint 的 `frequencyHz`（单位 Hz），不是弹簧常数 k（N/m）
- **换算**：`k = m_eff × (2π × frequencyHz)²`，其中 `m_eff` = 约化质量（两端都动态时 `1/(1/m_A + 1/m_B)`，一端静态时取另一端质量）
- **文件**：AnalysisRecorder.ts, spring.tsx

## Canvas 渲染链路

### useCallback 闭包导致 store 变化不触发重绘
- **现象**：在属性面板修改 joint 属性后，画布不刷新；但拖拽物体后变化生效
- **原因**：`renderFrame` 用 `useCallback` 闭包捕获 `scene`，依赖链 scene→renderFrame→useEffect 在某些情况下不可靠
- **修复**：`renderFrame` 改为无依赖稳定函数（`useCallback(fn, [])`），内部通过 `store.getState()` 读取最新数据；渲染触发的 useEffect 直接依赖 `scene` 对象
- **根本原则**：Canvas 的命令式渲染应读 store 最新值，不依赖 React 闭包
- **文件**：Canvas.tsx

## 物体默认属性

### 支撑类物体缺少 isStatic 默认值
- **现象**：anchor / pulley-mount 在仿真时掉落
- **原因**：descriptor 的 defaults 不含 `isStatic: true`，创建物体时默认 `isStatic: false`
- **修复**：defaults 添加 `isStatic: true, fixedRotation: true`
- **教训**：所有支撑类物体的 defaults 必须显式设置 `isStatic: true`。已修复：anchor.tsx、pulleyMount.tsx
- **文件**：anchor.tsx, pulleyMount.tsx

## 边缘检测

### hitTestHandle 返回值与 getHandles 不匹配
- **问题**：边框 hover 返回 `edge-n/s/e/w`，但不在 `getHandles()` 数组中，导致 cursor 回退为 default
- **修复**：导出 `CURSOR_MAP`，直接查表而非通过 handles 数组 find
- **附带 bug**：原代码中左右边判断重复（左边检测两次，右边漏掉），需仔细检查边界条件
- **文件**：SelectionHandles.ts

## 仿真模式渲染

### flipped 物体仿真渲染双重镜像
- **现象**：编辑模式下翻转后的物体在仿真模式视觉上恢复为未翻转状态
- **原因**：`sceneSync.mirrorShapeX` 已镜像物理顶点，通用形状渲染直接画这些顶点即可。但 `ctx.scale(-1, 1)` 在 renderSimBody 中无条件应用，导致双重镜像
- **修复**：`ctx.scale(-1, 1)` 仅在 `renderSim`（自定义渲染）分支内应用，通用形状渲染（polygon/chain 顶点已镜像）不加额外镜像
- **规则**：仿真渲染有两条路径——renderSim（用原始公式画，需 ctx.scale 镜像）和 generic（用物理顶点画，已镜像不需 ctx.scale）。新增 body type 的 renderSim 中若涉及不对称形状，需确认 flipped 处理
- **文件**：CanvasRenderer.ts

### SceneBody 位置在仿真时不更新
- **现象**：渲染层使用 SceneBody 位置数据，仿真模式下图形（如力箭头）停留在编辑时位置不跟随物体运动
- **原因**：SceneBody 是编辑模式的持久化数据，仿真时 Planck.js 更新的是 BodyState（通过 `getBodyStates()`）。SceneBody.position 不会被仿真引擎修改
- **修复**：仿真渲染时，用 BodyState 的实时 position/angle 合并到 SceneBody：`const merged = sceneBodies.map(sb => { const sim = simMap.get(sb.id); return sim ? { ...sb, position: sim.position, angle: sim.angle } : sb })`
- **规则**：任何仿真模式下需要物体位置的渲染模块，都必须使用 BodyState 的实时数据，不能直接读 SceneBody
- **文件**：Canvas.tsx, ForceRenderer.ts

## Planck.js PulleyJoint

### groundAnchor 参数名
- **现象**：PulleyJoint 创建后约束不生效，物体自由坠落
- **原因**：传了 `groundA`/`groundB`，但 API 要求 `groundAnchorA`/`groundAnchorB`
- **修复**：使用正确字段名 `groundAnchorA`/`groundAnchorB`
- **文件**：PhysicsBridge.ts

### groundAnchor 不能共点
- **现象**：两个物体摆动到对面时互换位置
- **原因**：定滑轮将 groundAnchorA = groundAnchorB = 同一点，两段绳从同一点出发，物体摆过中线时绳交叉
- **修复**：groundAnchorA/B 分别放在滑轮圆的左右两侧（当前用 ±30° 偏离垂直）
- **文件**：pulley.tsx toJointConfig

### 滑轮绳出绳侧跳变（拓扑离散选择问题）
- **现象**：仿真时绳忽左忽右跳动；创建时绳默认交叉
- **根因**：外部点到圆有两条切线，选哪条是离散的二选一。现实中由绳的物理路径决定（路径依赖），但代码每帧重算丢失历史信息，在边界处跳变
- **修复**：`SceneJoint.sideA: 'left'|'right'` 创建时确定并持久化，渲染时只读取不重算。切点本身（`θ ± acos(r/d)`）仍然每帧动态计算，保持视觉正确
- **教训**：凡是涉及离散选择（二选一/多选一）的渲染参数，如果选择结果应保持连续性，必须在创建时固定并持久化，不能每帧从位置重新推导
- **文件**：pulley.tsx, types.ts, JointTool.ts

## 选中系统

### 单槽位选中导致子操作丢失主选中
- **现象**：在受力分析面板点击力/添加力 → 物体选中状态丢失，面板消失
- **根因**：selectionStore 只有一个 `selected` 槽位，body/joint/force 共用。选力时 `select({ type: 'force' })` 踢掉了 body
- **修复**：力选中 (`selectedForceId`/`hoveredForceId`) 独立于物体/约束选中 (`selected`)，两者互不影响
- **教训**：当 UI 有主从层级关系（物体→其上的力）时，从属对象的选中不应占用主对象的选中槽位。子选中需要独立状态字段
- **文件**：selectionStore.ts, SelectTool.ts, Canvas.tsx, PropertyPanel.tsx

### 系统力面板点击无反应
- **现象**：面板中外力可点击，系统力（重力/支持力等）点不了
- **根因**：`onClick` 中 `if (force.sourceId)` 守卫——系统力没有 sourceId，被直接跳过
- **修复**：系统力用 `${bodyId}:${forceType}` 作为 forceId
- **教训**：ForceData 中 sourceId 是可选字段（仅外力和约束力有），面板操作不能依赖它作为唯一标识

## 力渲染

### 隐藏力导致合力消失
- **现象**：隐藏重力后合力也消失了
- **根因**：Canvas 先过滤掉隐藏力再传给 ForceRenderer，合力是从传入的力计算的
- **修复**：合力始终从全部力计算（Canvas 层 `computeResultants`），显隐过滤在合力计算之后
- **教训**：派生数据（合力）的计算输入应是完整数据集，显示过滤应在计算之后而非之前

### 仿真模式力箭头不跟随物体
- **现象**：播放后力箭头停在物体初始位置
- **根因**：`CanvasRenderer.render()` 用 `sceneBodies`（场景编辑时位置）算力箭头起点，仿真中物体已移动
- **修复**：仿真渲染前将 `bodiesRef.current`（物理引擎实时位置）合并到 sceneBodies
- **文件**：Canvas.tsx

### 力分解箭头未使用仿真位姿覆盖
- **现象**：主力箭头能跟随物体运动，但正交分解分量在播放时会出现位置滞后或错位
- **原因**：分解绘制链路仍读取 `SceneBody.position/angle`，没有复用仿真态实时位姿
- **修复**：在 `renderForces` 增加 `bodyPoseOverrides`，并在 `drawDecomposition` / `getBodyGeometry` / `getEdgeStart` 全链路使用覆盖位姿
- **教训**：仿真态中“主渲染”和“派生渲染”（分解、标注等）必须共用同一位姿源，避免只修主链路
- **文件**：src/renderer/ForceRenderer.ts, src/components/Canvas.tsx

### 同帧重复读取 BodyState 引发性能抖动
- **现象**：20+ 物体场景下播放时出现可感知卡顿，尤其在力显示与数据记录同时开启时更明显
- **原因**：同一仿真帧内多处重复调用 `getBodyStates()`，并在力收集/渲染路径重复构建中间对象
- **修复**：仿真主循环改为单帧读取一次 `bodyStates` 并复用；`collectForces` 接收 `bodyStates` 参数；初始加速度施力改为遍历 `scene.bodies` + 按 ID 取 body
- **教训**：引擎状态快照应作为“单帧共享输入”在渲染、力收集、分析记录之间复用，不要让每个模块各自拉取
- **文件**：src/components/Canvas.tsx, src/engine/ForceCollector.ts, src/engine/PhysicsBridge.ts

### 摩擦力方向反转
- **现象**：所有摩擦力箭头方向反了 180°
- **根因**：切线方向公式写反——代码用 `(-normal.y, normal.x)`，Planck.js 约定切线 = `cross(normal, 1)` = `(normal.y, -normal.x)`
- **修复**：`tfx = tangentForce * normal.y`，`tfy = tangentForce * (-normal.x)`
- **文件**：ForceCollector.ts

### 支撑面力判断用 isStatic 遗漏斜面
- **现象**：地面力隐藏了但斜面力仍显示
- **根因**：用 `body.isStatic` 判断支撑面，但斜面 category='support' 而 isStatic 可能为 false
- **修复**：用 `getBodyDescriptor(body.type).category === 'support'` 判断
- **教训**：支撑面类型由 descriptor.category 定义，不等同于 isStatic 属性

### Slider ±180° 边界闪烁
- **现象**：方向滑轨拖到 ±180° 时来回跳变
- **根因**：每次渲染从 store 反算 `normalizeAngle(direction - bodyAngle)` 产生环路——180° 和 -180° 是同一角度但 normalizeAngle 只能选一边
- **修复**：拖拽时用 local state 控制滑轨值（`dragging` + `localDeg`），松手后恢复从 store 同步
- **教训**：双向绑定 + 不可逆归一化 = 闪烁。拖拽中应断开 store→UI 反向同步

### 共线检测误判反向力（全层级）
- **现象**：层1（力-力）、层3（合力）、分解层均误判反向力为共线
- **根因**：所有层级都用 `Math.abs(dot) > 0.87`，反方向力也触发避让偏移
- **修复**：全面改为 `dot > 0.87`（仅同向）。反向力从边缘出发各走各的不重叠
- **教训**：共线检测修改时必须排查全部层级（层1力-力、层2力-连接件、层3合力、分解层），避免只修一处

### 滑轮绳张力方向 ≠ getReactionForce 方向
- **现象**：滑轮两端物体张力箭头方向不沿绳方向
- **根因**：`getReactionForce()` 返回的是约束内部求解器的力向量，不一定沿绳段方向。普通绳/杆两点直连时方向碰巧正确，但滑轮绳经过滑轮转向
- **修复**：滑轮类型特殊处理——magnitude 取 `getReactionForce`，方向取绳段单位向量（锚点→groundAnchor）
- **教训**：约束力方向不能统一用 getReactionForce，经过转向的约束（如滑轮）需按几何关系重建方向
- **文件**：ForceCollector.ts

### 弹簧压缩场景力方向不能沿用统一反力方向
- **现象**：弹簧被压缩时，受力箭头仍指向弹簧内部（表现为“继续拉向中心”）
- **根因**：直接复用通用约束反力方向，未结合弹簧形变量（压缩/拉伸）判断“推/拉”语义
- **修复**：按当前长度与自然长度比较：压缩时两端外推，拉伸时两端内拉；力大小仍取 `getReactionForce` 的模长
- **教训**：同属 DistanceJoint 的约束（rod/spring）在“方向语义”上可能不同，不能只按引擎类型统一处理
- **文件**：src/engine/ForceCollector.ts

### 滑轮绳连接件方向 ≠ 两端物体间方向
- **现象**：张力箭头与滑轮绳重叠，避让未触发
- **根因**：层2连接件方向用 `otherBody.position - body.position`（两端物体间直线），但滑轮绳的绳段方向是从物体到滑轮座
- **修复**：pulley 类型用 `mount.position - body.position` 作连接件方向
- **教训**：连接件方向计算须考虑实际绳线路径，滑轮绳两段分别指向滑轮座而非另一端
- **文件**：ForceRenderer.ts

### 物理引擎浮点噪声污染图表
- **现象**：静止物体（如固定斜面）在图表上显示极小的速度/加速度值（如 0.000003 m/s）
- **根因**：物理引擎对静止物体有极微小的数值抖动（浮点精度限制）
- **修复**：AnalysisRecorder 中加阈值消除——速度 < 1e-6 m/s 归零，加速度 < 1e-4 m/s² 归零
- **教训**：物理引擎输出不可信赖绝对零值，需要在数据记录层做阈值过滤
- **文件**：AnalysisRecorder.ts

### forceDisplayStore 与 probe 数据不同步
- **现象**：画布显示了全部力（probe 数据正确），但面板只显示重力
- **根因**：`setAvailableForces` 仅在 `scene !== lastProbedScene` 时调用；仿真→编辑切换后 scene 引用未变，store 残留仿真数据
- **修复**：编辑模式每次 renderFrame 都检查 store 引用是否匹配 probe 数据，不匹配则同步；同时优化 setAvailableForces 避免无变化时创建新 Set 引用
- **教训**：渲染用 ref、面板用 store 的双数据源架构中，任何可能导致不一致的路径（模式切换、初始化）都需要同步守卫
- **文件**：Canvas.tsx, forceDisplayStore.ts

## 仿真循环

### useEffect 依赖 simState 导致暂停恢复重新初始化
- **现象**：暂停后恢复播放，帧历史和数据源勾选被重置
- **根因**：仿真循环 useEffect 依赖 `[mode, simState]`，`paused→playing` 触发 effect 重新执行，初始化代码无条件运行
- **修复**：用 `useRef(prevSimState)` 区分首次播放（从 stopped）和暂停恢复（从 paused），仅首次播放时清空和初始化
- **教训**：仿真循环 useEffect 中的初始化逻辑必须区分"开始"和"恢复"，不能仅靠 `mode === 'simulate' && simState === 'playing'` 判断
- **文件**：Canvas.tsx

## Tooltip

### overflow:auto 容器裁剪 absolute 定位的 tooltip
- **现象**：数据源区域的分析组 Tip 被容器截断
- **根因**：Tip 用 `position: absolute` + `overflow: hidden/auto` 的父容器 = 裁剪
- **修复**：Tip 改用 `position: fixed` + `createPortal(document.body)`，完全脱离 DOM 层叠
- **教训**：任何可能出现在 overflow 容器内的浮层（tooltip/dropdown/popover）都应使用 fixed + Portal
- **文件**：src/components/ui/Tip.tsx

### fixed + Portal 后仍可能越过视口边缘
- **现象**：对象面板左侧卡片的 Tooltip 在靠近屏幕左边时超出视口，被裁掉一部分
- **根因**：虽然已改为 `position: fixed` + Portal，但定位仍使用触发器中心点 + 固定 transform，未结合 tooltip 实际宽度做边界钳制
- **修复**：在 `useLayoutEffect` 中读取 trigger/tip 的 `getBoundingClientRect()`，对 `left/top` 执行视口钳制（保留边距 `EDGE_GAP`）
- **教训**：浮层定位要同时处理两类问题：容器裁剪（fixed+Portal）和视口越界（基于实际尺寸的 clamp）
- **文件**：src/components/ui/Tip.tsx

## 全局快捷键

### Delete/Backspace 键与输入框冲突
- **现象**：选中物体后在属性面板输入框中按 Delete/Backspace，物体被删除
- **根因**：Canvas.tsx 全局键盘监听直接处理 Delete 键，未检查 `e.target` 是否为输入元素
- **修复**：在 Delete 处理逻辑开头检查 `e.target.tagName`，INPUT/TEXTAREA/SELECT 中直接 return
- **教训**：全局快捷键监听必须排除输入元素焦点状态，否则会拦截正常的文本编辑操作
- **文件**：src/components/Canvas.tsx

## 地面穿透限制

### AABB 估算 vs Snap 引擎精确计算
- **现象**：用 AABB 半高度估算物体底部来做 clamp，对斜面等非对称形状不准确，导致物体与地面保持不正确的距离
- **根因**：斜面的 position 不在 AABB 几何中心，用 `position.y - rotH` 估算底部有偏差；且 clamp 在 snap 之前执行会干扰吸附
- **修复**：去掉 AABB 估算的 clampAboveGround，改为：普通 snap 失败时用 `threshold=Infinity` 重新调用 `computeSnap`，若 snap 位置高于鼠标位置说明穿透了，强制使用 snap 结果
- **教训**：物体定位优先复用已有的精确系统（snap 引擎），不要另起一套估算逻辑
- **文件**：src/core/tools/SelectTool.ts, src/core/snap/SnapEngine.ts

## Resize 翻转（flipped）

### updateBody merge 不清除未设字段
- **现象**：拖拽翻转后拖回来，形状不恢复
- **根因**：`computeResize` 只在 flipped 变化时写入 props；但 `updateBody` 是 merge 操作，上一帧设了 `flipped: true`，这一帧不写 `flipped: false` 就不会清除
- **修复**：`props.flipped = flipped` 始终写入，不做条件判断
- **教训**：对于 merge 型 store 更新，boolean 字段必须始终显式写入，不能依赖"不写就不变"
- **文件**：SelectionHandles.ts

### center offset 必须用未钳制值
- **现象**：resize 拖到最小后视觉上"拖不动了"
- **根因**：MIN_SIZE 钳制让 newW 和 center offset 在接近零点时变成常量，body 位置不跟踪鼠标
- **修复**：center offset 用 rawW（带符号未钳制值），不用 newW（钳制后）
- **教训**：视觉位置跟踪和尺寸钳制应独立——位置用 raw 值保证平滑，尺寸用 clamped 值保证最小可见
- **文件**：SelectionHandles.ts

### edge handle 也需要翻转支持
- **现象**：用户拖左边缘无法翻转物体
- **根因**：翻转逻辑只在 corner handle 的 `if (handle in cornerSigns)` 分支，edge-w/edge-e 走的是没有翻转逻辑的 else 分支
- **修复**：edge-e/edge-w 加入与 corner 相同的越零翻转逻辑
- **教训**：hitTest 返回的 handle 类型（corner vs edge）由用户点击位置决定，不能假设用户一定走某个分支
- **文件**：SelectionHandles.ts

## HTML5 Drag and Drop

### getData 在 dragenter/dragover 中返回空字符串
- **现象**：Canvas 的 dragEnter 处理器中 `e.dataTransfer.getData('application/x-body-type')` 始终返回 `''`
- **根因**：浏览器安全策略——HTML5 DnD 的 `getData()` 仅在 `drop` 事件中可用，`dragenter/dragover` 中始终返回空字符串（仅 `types` 数组可读）
- **修复**：用模块级变量传递拖拽数据（`dragState.ts`），ObjectPanel dragStart 写入，Canvas dragEnter 读取
- **教训**：跨组件 DnD 通信不能依赖 `dataTransfer.getData()`，需要额外的同步机制
- **文件**：src/components/panels/dragState.ts, ObjectPanel.tsx, Canvas.tsx

### react-hooks/immutability 禁止在 useCallback 中修改 ref
- **现象**：lint 报 `dragPreviewRef cannot be modified` inside useCallback
- **根因**：自定义 eslint 规则 `react-hooks/immutability` 禁止在 hook 回调中修改 ref.current
- **修复**：用模块级变量（`let _dragPreview`）替代 useRef
- **教训**：本项目 eslint 配置对 ref 修改有严格限制，需注意在 event handler callback 中不能直接写 ref

### 连接件拖拽提示晚于交互时机
- **现象**：用户拖拽连接件进入画布时，光标已变加号，但步骤提示要等 drop 后才出现
- **根因**：引导流程只在 `drop` 后切换到 JointTool，`dragEnter/dragOver` 阶段没有独立提示状态
- **修复**：增加连接件拖拽态 `currentDragJointType`，在 `Canvas.dragEnter/dragOver` 直接渲染引导浮层（含 `Esc` 退出）
- **教训**：对“先选目标再创建”的工具，提示应跟随拖拽生命周期前置到 hover 阶段，不能等到创建动作之后
- **文件**：src/components/panels/dragState.ts, src/components/Canvas.tsx

### 连接件点击激活与拖拽激活是两条入口
- **现象**：只支持拖拽连接件创建，不支持“点击卡片后进入画布开始选择”
- **根因**：系统只有 DnD 通道状态，没有“待激活工具”的跨组件状态
- **修复**：新增 `pendingJointType`，ObjectPanel 点击写入，Canvas 首次 mouseMove 消费并切到 JointTool 引导态
- **教训**：当同一功能同时有 click 与 drag 两种入口时，需要显式区分“拖拽进行中”和“点击待激活”两类状态，避免互相覆盖
- **文件**：src/components/panels/dragState.ts, src/components/panels/ObjectPanel.tsx, src/components/Canvas.tsx

### 设备工具栏触摸语义下原生 DnD 不可靠
- **现象**：在浏览器 DevTools 设备工具栏（触摸模拟）下，左侧物体卡片无法稳定拖拽到画布；但桌面模式正常
- **根因**：HTML5 Drag and Drop 依赖鼠标语义，触摸/设备模拟环境下 `dragstart/dragover/drop` 与 `dataTransfer` 行为不稳定或不可用
- **修复**：保留桌面 DnD 通道，同时增加触摸兜底路径（pointer/tap 点击创建）；drop 阶段再加 `dragState` 类型兜底
- **教训**：涉及跨端交互时，不能把 HTML5 DnD 当作唯一创建链路；至少要有 pointer 驱动的等效兜底
- **文件**：src/components/panels/ObjectPanel.tsx, src/components/Canvas.tsx

## 缩略图生成

### getSelectionBounds 多用途冲突（像素下限 + 框选 + 缩略图 + 手柄）
- **现象 1**：小物体缩略图中几乎看不见（像素下限在 scale=1 被当米数）
- **现象 2**：框选时锚点/滑轮座碰撞框巨大（4m/6m）导致误选
- **现象 3**：手柄框覆盖墙壁/连杆时，resize 行为与圆的实际尺寸不匹配
- **根因**：getSelectionBounds 同时服务框选(scale=1)、手柄(scale=40-200)、缩略图(scale=1000)，但各场景对 bounds 的需求不同
- **修复**：按 scale 分三层返回不同 bounds：
  - `scale ≤ 10`：物理尺寸（框选/对齐/吸附）
  - `10 < scale ≤ 500`：圆的 bounds + 像素下限（手柄/渲染）
  - `scale > 500`：完整视觉 bounds 含装饰（缩略图）
- **教训**：当一个函数服务多个上下文（渲染/碰撞/缩放计算），要么分函数，要么用参数区分用途。单一返回值无法同时满足像素保护、物理精度和视觉完整性
- **文件**：anchor.tsx, pulleyMount.tsx

## 球体 Resize

### 对角锚定时的速度匹配
- **现象**：球体 resize 时手柄移动速度与鼠标不一致（过快或过慢）
- **根因**：圆形只有一个 radius 参数，无法同时完美匹配 X/Y 两个轴的鼠标位移。需正确推导 `deltaR` 和 `centerOffset` 的关系
- **正确公式**：`deltaR = (localDx * sx + localDy * sy) / 4`，`centerOffset = sx * deltaR`（全量，不是半量）
- **推导**：手柄跟随鼠标要求 `centerDx + sx * deltaR = localDx`，锚点固定要求 `centerDx = sx * deltaR`，联立得 `deltaR = localDx / (2*sx)`；取 X/Y 平均得 `/4`
- **教训**：对角方向完美跟随，纯水平/垂直约半速，这是圆形单参数的固有限制
- **适用范围**：所有单 radius 参数的圆形体都应走此逻辑（ball、anchor、pulley-mount），不能走 block 的双轴独立缩放
- **文件**：src/core/handles/SelectionHandles.ts
- **注意**：8.3.2 重构后，此逻辑已统一到 `resizeMode: 'radius'` 路径，不再需要在 computeResize 中 hardcode body.type

## Chain 形状的物理限制

### Chain 不能作为动态物体的碰撞体
- **现象**：球槽（hemisphere）播放后直接穿过地面掉落
- **根因**：Planck.js 的 chain shape 没有面积和质量概念，只能作为 static fixture 的碰撞面
- **修复**：需要同时返回 chain（弧面碰撞）+ polygon（块体实体）组合。球槽拆为 chain + 左壁/右壁/底板三个矩形 polygon
- **教训**：凡是 chain 形状的物体，如果要支持动态模式（非强制 static），必须额外提供 polygon 来给物理引擎面积和质量
- **文件**：src/models/bodyTypes/hemisphere.tsx toShapeConfig

## 初始运动可视化

### 零速度场景角度语义丢失
- **现象**：物体放在斜面上且初速度为 0 时，角度输入默认回到 0°（世界 X 轴），与用户预期“沿接触面方向”不一致
- **根因**：极坐标角度直接由 `atan2(vy,vx)` 推导；当 `v=0` 时方向信息不可定义，被固定成默认值
- **修复**：零速度分支改为读取当前接触法线并换算切线方向作为默认角；无接触再回退世界 X 轴
- **教训**：向量大小为 0 时，角度必须从场景语义补足（接触面/约束方向），不能直接沿用数学默认值
- **文件**：src/components/panels/PropertyPanel.tsx

### 箭身穿过箭头尖端
- **现象**：速度箭头中，线段端点超过了三角箭头尖端，视觉上出现“穿出”效果
- **根因**：箭身终点直接画到 `endX/endY`，与箭头头部使用同一尖端坐标，未预留头部长度
- **修复**：按箭头方向将箭身终点回退到箭头底边（`shaftEnd = tip - dir * headLen`）
- **教训**：任何“线段+箭头头部”组合都应分离“尖端坐标”和“箭身终点坐标”
- **文件**：src/renderer/CanvasRenderer.ts

## 非对称物体的 Resize 系统

### origin ≠ bbox center 导致 resize 漂移
- **现象**：球槽拖动 resize 锚点时，整个物体跟着漂移
- **根因**：computeResize 的中心偏移公式 `localCenterDy = ΔH * sy / 2` 假设 body origin 在 bbox 正中心。球槽 origin 在 rim 顶部（bbox 顶边），偏移计算错误
- **通用公式**：anchor 位置 = centerOffset + (-sx) * halfW, centerOffset + (-sy) * halfH；body shift = oldAnchor - newAnchor
- **修复**（8.3.2 重构）：引入 `getLocalBBox` 声明 `centerOffsetX/Y`，computeResize 用 anchor 公式计算位移，完全不依赖 body.type
- **教训**：新增非对称物体（origin 不在视觉中心）时，只需在 descriptor 的 `getLocalBBox` 中声明 centerOffset，无需修改 computeResize
- **文件**：src/core/handles/SelectionHandles.ts, src/models/bodyTypes/descriptor.ts

## 边界与异常处理

### 仿真循环未熔断会放大异常
- **现象**：仿真帧内出现异常或 NaN 后，循环中断或状态污染，用户只看到“停止更新”且无反馈。
- **根因**：`step/collect/render` 缺少统一 `try/catch` 与 finite 校验，异常仅落到控制台。
- **修复**：在仿真主循环增加 `try/catch + isFiniteBodyStates/isFiniteForces`；异常时执行 `stopAtCurrent` 并用节流 toast 提示。
- **文件**：src/components/Canvas.tsx

### 约束长度计算的零除路径
- **现象**：调整绳/杆/弹簧长度或拖拽约束时，偶发 `NaN/Infinity`，物体位置跳变。
- **根因**：`dist=0` 或 `distMy=0` 时仍做归一化除法（`dx/dist`），且缺少最小长度钳制。
- **修复**：统一引入 `epsilon` 与安全方向向量回退；约束长度做最小值钳制，避免零长度和近零长度路径。
- **文件**：src/components/panels/PropertyPanel.tsx, src/core/tools/SelectTool.ts

### 删除主对象未级联清理
- **现象**：删除 body 后，关联 joint/force 残留为悬挂引用，后续表现为“静默失效”。
- **根因**：`RemoveBodyCommand` 只移除 body，未处理依赖对象生命周期。
- **修复**：删除时同步清理关联 joints/forces；undo 时对称恢复 body + joints + forces。
- **文件**：src/core/commands/RemoveBodyCommand.ts

### 力显示状态键未回收会积累脏状态
- **现象**：长会话下 `hidden/_manualOverrides/decomposed` 中残留失效 key，导致显隐表现不稳定。
- **根因**：`setAvailableForces` 仅追加可见 key，不清理已失效 key。
- **修复**：以当前 `availableForces` 的 active keys 做集合过滤（compaction），再应用默认隐藏策略。
- **文件**：src/store/forceDisplayStore.ts

## 模板系统（T3.1 根因修复）

### 约束默认长度若按物体中心距推导，开仿真会“自动变长/变短”
- **现象**：模板进入编辑器时杆/绳看似正常，点击仿真后长度突变（尤其是有非零锚点偏移时）。
- **根因**：模板执行器默认长度使用 `body.position` 中心距，而物理引擎约束长度基于锚点世界坐标。
- **修复**：执行器默认推导统一改为“世界锚点距离”（rope.maxLength / rod.length / spring.springLength / pulley.totalLength 全部按锚点几何计算）。
- **文件**：`src/templates/commands/executor.ts`

### 编辑态受力探测与仿真首帧采样时刻不一致会导致“开仿真前后受力变了”
- **现象**：模板打开后看到的力箭头与点击仿真后第一帧不一致，用户误判为力学计算错误。
- **根因**：`probeForces` 默认先跑多步再采样（历史默认 5 步），采样时刻滞后于仿真首帧。
- **修复**：探测默认步数改为 1，并在探测前后重置 EMA，保证编辑态与仿真首帧对齐。
- **文件**：`src/engine/PhysicsBridge.ts`

### 支撑体手工坐标易导致“部分压入地面”
- **现象**：斜面/球槽/传送带/V 槽在模板初始状态与地面重叠，出现部分位于地面以下。
- **根因**：模板位姿采用手填估值，未复用吸附引擎计算接触面位置。
- **修复**：支撑体统一通过 `snapTo -> ground` 生成位姿，并在场景健全性校验中增加 `body_below_ground` 检查阻断不合法产物。
- **文件**：`src/templates/commands/examples.ts`, `src/templates/commands/validator.ts`

### 竖直圆周模板初速度不足会退化为“摆几下”
- **现象**：标注为竖直圆周的模板无法完成整圈，运行表现退化为摆动。
- **根因**：初始速度未按圆周最小闭环条件设置（rope 与 rod 的下限不同）。
- **修复**：模板参数按 `rope: sqrt(5gR)` / `rod: sqrt(4gR)` 并加安全系数设置；sanity 校验新增 `vertical_circle_speed_insufficient`。
- **文件**：`src/templates/commands/examples.ts`, `src/templates/commands/validator.ts`

### 重力箭头用 destination-over 会出现“虚线感”
- **现象**：重力箭头看起来像断线/虚线，且不同缩放下观感不稳定。
- **根因**：`destination-over` 让箭杆被物体区域遮挡，视觉上只剩外部段，产生“非实线”错觉。
- **修复**：取消 `destination-over`；改为 gravity 专用 `evenodd` 外部裁剪，只隐藏物体内部段且保持外部实线连续。
- **文件**：`src/renderer/ForceRenderer.ts`

### 双绳张力避让若只做固定方向偏移，会出现单侧仍贴绳
- **现象**：双绳/绳杆悬挂时，一侧张力箭头已避让，另一侧仍与绳线重合。
- **根因**：避让方向固定，未结合具体锚点方位；再叠加严格同向阈值，会出现单侧漏判或偏错侧。
- **修复**：张力按 `sourceId -> jointId` 绑定对应连接件，使用宽松同线判定（`abs(dot)>0.6`），并根据 `anchorVector` 选择外偏方向。
- **文件**：`src/renderer/ForceRenderer.ts`

### 为避免绳长漂移而整体禁用吸附，会引发交互回归
- **现象**：物体一旦被绳连接就完全失去吸附，同时拖拽联动时仍可能穿入地面。
- **根因**：将“吸附冲突”用全局禁用规避，而不是在约束回收阶段统一收敛；地面钳制未覆盖联动写回链路。
- **修复**：恢复吸附，统一走“候选位姿 -> 约束回收 -> 地面钳制”链路，并对联动体 `moveBody` 同步做 clamp。
- **文件**：`src/core/tools/SelectTool.ts`
