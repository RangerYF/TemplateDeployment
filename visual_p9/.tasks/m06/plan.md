╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 M-06 向量模式实现计划（方案A扩展）

 Context

 用户希望在现有 M-01 立体几何展示台基础上增加一个"向量模式"，方案A思路：复用 M-01 的
 Entity/Command/Tool 架构，新增 vector 实体类型和专属工具，通过 UIStore
 开关控制向量模式的激活，激活后显示世界坐标系并显示向量工具。2D 部分另建仓库，本次仅做 3D
 集成。

 ---
 新增文件（5个）

 1. src/components/scene/renderers/VectorEntityRenderer.tsx

 - 读取 startPointId / endPointId 对应的点实体，通过 usePointPosition 取世界坐标
 - 绘制：<Line> 射杆（终点留 arrowLen 余量）+ <mesh><coneGeometry> 箭头（对齐向量方向）+
 <Html> 标签
 - 选中/悬停状态同步 selectionStore（颜色加粗）
 - 文件末尾调用 registerRenderer('vector', VectorEntityRenderer) 自注册
 - 依赖：@react-three/drei Line/Html、usePointPosition、registerRenderer

 2. src/components/scene/WorldCoordSystem.tsx

 - 纯展示组件（无实体，无交互），用于向量模式中显示世界原点坐标轴
 - 显示 X(红)/Y(绿)/Z(蓝) 三条轴，各 3 个单位长，末端 Html 标签
 - 原点显示小黑球（radius 0.04）
 - 在 Scene3D.tsx 中通过 vectorModeEnabled 条件渲染

 3. src/editor/tools/createVectorTool.ts

 两步工具，与 angleTool 结构完全相同：
 - Step 1（selectStart）：点击 point 类型实体 → 记录 startPointId，高亮该点
 - Step 2（selectEnd）：点击另一个 point 类型实体 → 执行 CreateEntityCommand('vector', props)
 → 自动切回 select
 - 非 point 实体点击：useNotificationStore 提示"请点击顶点或已有点"
 - onKeyDown Escape 重置到 Step 1
 - onDeactivate 清除悬停与步骤状态
 - 自动标签：getNextVectorLabel()，第 1 条='a', 第 2 条='b'...
 - 颜色：预设 ['#FF6B6B','#4ECDC4','#FFD700','#A78BFA','#FB923C'] 循环选取

 4. src/editor/tools/normalVectorTool.ts

 一步工具，点击面实体生成法向量：
 - onPointerDown 接收 face 类型实体点击
 - 计算面法向量：取面的前 3 个点位置，cross(p1-p0, p2-p0).normalize()
 - 计算面重心：所有点坐标均值
 - 创建 CreateNormalVectorCommand（自定义 Command 类，内联在此文件）：
   - execute：创建 startPoint（free，重心）+ endPoint（free，重心+法向）+ vector 实体
   - undo：反序 deleteEntity(vectorId), deleteEntity(endId), deleteEntity(startId)
   - redo 路径：store.restoreEntity
 - 箭头长度：取向量方向 1.5 单位，颜色 #4ECDC4（青色，区别于普通向量）
 - 标签：getNextNormalLabel() = 'n', 'n₁', 'n₂'...
 - 非 face 点击：通知"请点击一个面"

 5. src/components/panels/inspectors/VectorInspector.tsx

 - 显示向量标签（可编辑 Input → UpdatePropertiesCommand）
 - 颜色选择器（5 个预设色块点选）
 - 实时显示起点、终点坐标（从 point 实体读取 computePointPosition）
 - 实时显示向量分量 (dx, dy, dz) 和模长 |v|
 - 若 isNormal 显示"派生自面"标注
 - 文件末尾 registerInspector('vector', VectorInspector) 注册

 ---
 修改文件（7个）

 1. src/editor/entities/types.ts

 新增接口：
 export interface VectorProperties {
   startPointId: string;
   endPointId: string;
   color: string;
   label: string;
   showLabel: boolean;
   isNormal: boolean;
   faceId?: string;   // 仅 isNormal=true 时填入
 }

 EntityPropertiesMap 新增一行：
 vector: VectorProperties;

 新增类型守卫：
 export function isVectorEntity(e: Entity): e is Entity<'vector'> {
   return e.type === 'vector';
 }

 2. src/editor/entities/index.ts

 - 在 export type { ... } 追加 VectorProperties
 - 在 export { ... } 追加 isVectorEntity

 3. src/editor/store/uiStore.ts

 interface UIState {
   // 已有字段不变
   vectorModeEnabled: boolean;                           // ← 新增
   setVectorModeEnabled: (enabled: boolean) => void;     // ← 新增
 }
 // 初始值 vectorModeEnabled: false

 4. src/editor/tools/index.ts

 在 registerAllTools() 中追加两行：
 store.registerTool(createVectorTool);
 store.registerTool(normalVectorTool);
 同时从对应文件 import。

 5. src/components/scene/Scene3D.tsx

 - 追加 side-effect import：import './renderers/VectorEntityRenderer';
 - 在 SceneContent 或 Canvas 内，条件渲染 WorldCoordSystem：
 {vectorModeEnabled && <WorldCoordSystem />}
 - 需从 uiStore 读取 vectorModeEnabled

 6. src/components/scene/ToolBar.tsx

 - 新增常量 VECTOR_TOOLS = [{id:'createVector', label:'画向量', Icon:VectorArrowIcon},
 {id:'normalVector', label:'法向量', Icon:NormalVectorIcon}]
 - 在组件内读取 vectorModeEnabled
 - 当 vectorModeEnabled=true 时，在现有工具按钮组后追加分隔线 + vector 工具按钮
 - VectorArrowIcon 和 NormalVectorIcon 为内联 SVG 函数组件（15×15px 箭头/法向量图标）

 7. src/components/panels/AuxiliaryTools.tsx

 在现有开关列表末尾追加：
 <div className="flex items-center justify-between">
   <span style={{ fontSize: 13, color: COLORS.text }}>向量模式</span>
   <Switch checked={vectorModeEnabled} onCheckedChange={setVectorModeEnabled} />
 </div>

 ---
 不需要修改的文件

 - src/editor/store/entityStore.ts：entityReferences 已通用检查
 startPointId/endPointId，级联删除自动支持 vector 实体（无需修改）
 - src/editor/commands/ 所有现有命令：直接复用
 CreateEntityCommand、UpdatePropertiesCommand、DeleteEntityCascadeCommand

 ---
 文档化

 创建 .tasks/m06/ 目录，写入以下文件：
 - 01-向量模式概览.md — 功能说明、与需求文档的对应关系、范围限制
 - 02-变更清单.md — 每个改动文件 + 改动内容 + 改动理由 + 对应需求

 ---
 实现顺序

 1. types.ts + entities/index.ts（类型基础）
 2. uiStore.ts（开关基础）
 3. VectorEntityRenderer.tsx（可见验证）
 4. Scene3D.tsx（接入渲染器 + WorldCoordSystem）
 5. AuxiliaryTools.tsx（开关可用）
 6. createVectorTool.ts + normalVectorTool.ts（工具逻辑）
 7. tools/index.ts（注册工具）
 8. ToolBar.tsx（工具按钮可用）
 9. VectorInspector.tsx（属性面板）
 10. .tasks/m06/ 文档

 ---
 验证方法

 1. pnpm lint && pnpm tsc --noEmit（门禁）
 2. 浏览器中打开应用：右侧面板 → 辅助功能 → 开启"向量模式" → 坐标轴出现
 3. ToolBar 中出现"画向量"+"法向量"按钮
 4. 选择"画向量"→ 点击几何体顶点 A → 点击顶点 B → 带箭头的有色线段出现
 5. 选择"法向量"→ 点击一个面 → 法向量箭头出现（青色）
 6. 选中向量实体 → 右侧 Inspector 显示分量、模长
 7. Ctrl+Z 撤销向量创建 → 向量消失（含法向量所创的自由点）
 8. 关闭向量模式 → 坐标轴隐藏，向量工具隐藏（向量实体仍存在）