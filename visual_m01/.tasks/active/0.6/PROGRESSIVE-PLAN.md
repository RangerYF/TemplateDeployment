# 🎯 V0.6 渐进式开发计划 — AI 作品推荐

## 📌 版本目标
用户在工作台输入自然语言（知识点、题目、可视化需求），AI 从预置作品库中推荐最匹配的完整 3D 场景，用户点击即可加载使用。

## 🔄 开发流程总览
```
阶段1：重写生成脚本，产出正确的作品数据（含度量实体）
  → 阶段2：人工校验 + 修复问题作品
    → 阶段3：LLM API 基础设施（客户端 + 密钥管理 + Prompt 设计）
      → 阶段4：AI 推荐功能对接工作台 UI
```

## 📋 串行执行阶段

### 第1阶段：重写生成脚本 + 产出正确的作品数据 ⏱️ 2-3天

**目标**：所有预置作品的 scene_data 包含正确的度量实体（angleMeasurement / distanceMeasurement），在编辑器中加载后角度弧线、距离标注、坐标系等全部正确渲染。

**主要任务**：

子任务链路：清理作品清单 → 重写 EntityBuilder → 逐类型生成 + 单元验证 → 更新 meta

1. 清理作品清单：删除 S11（展开图）和 S12（三视图）类作品（辅助功能，不需要单独作品），更新 meta.ts
2. 重写 `scripts/generate-scenes.ts` 中的 EntityBuilder 类：
   - 新增 `addAngleMeasurement()` 方法：接收 kind + entityIds，调用 `angleCalculator` 预计算 angleRadians/angleLatex/angleDegrees
   - 新增 `addDistanceMeasurement()` 方法：接收 kind + entityIds，调用 `distanceCalculator` 预计算 distanceValue/distanceLatex/distanceApprox
   - 新增 `addCrossSectionFace()` 方法：根据定义点创建 crossSection 类型的 face 实体
   - 改进 `addCoordinateSystem()` 方法：预计算并缓存 axes 轴方向
   - 所有方法需访问 builder 输出的顶点坐标（Vec3），以便传给 calculator 函数
3. 为每个 enhance 函数编写正确的实体创建逻辑，按几何体类型逐个生成：
   - S01（基础）：无额外实体，直接生成
   - S02（对角线）：自定义 segment，引用正确的顶点 label
   - S03（外接球）：circumSphere 实体
   - S04（截面）：棱上取点 + crossSection face 实体
   - S05（二面角）：angleMeasurement(kind='dihedral', entityIds=[faceId1, faceId2])
   - S06（线面角）：angleMeasurement(kind='lineFace', entityIds=[segmentId, faceId])
   - S07（异面角）：angleMeasurement(kind='lineLine', entityIds=[segmentId1, segmentId2])
   - S08（点面距）：distanceMeasurement(kind='pointFace', entityIds=[pointId, faceId])
   - S09（异面距离）：distanceMeasurement(kind='lineLine', entityIds=[segmentId1, segmentId2])
   - S10（坐标系）：coordinateSystem 实体，预计算 axes
   - S13（中点连线）：棱上取点 + 自定义 segment + 辅助线标注平行关系
4. 每种场景类型生成后立即在编辑器中加载验证，确认渲染正确
5. 更新 `src/data/projects/math/m01/meta.ts`，删除 S11/S12 条目

**涉及文件范围**：
- `scripts/generate-scenes.ts` - 核心生成脚本重写
- `src/data/projects/math/m01/scenes/*.json` - 重新生成的场景数据
- `src/data/projects/math/m01/meta.ts` - 删除 S11/S12 条目，更新总数

**验收标准**：
✅ 所有 S05/S06/S07 作品在编辑器中显示角度弧线和精确角度值
✅ 所有 S08/S09 作品在编辑器中显示距离虚线、垂足标记和精确距离值
✅ S04 截面作品显示正确的截面多边形（如正方体正六边形截面）
✅ S10 坐标系作品显示三轴和各顶点坐标值
✅ 不存在 S11/S12 类型的作品
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
约 45 个质量正确的 scene_data JSON + 对应 meta 数据。下一阶段在此基础上进行人工校验。

---

### 第2阶段：人工校验 + 修复问题作品 ⏱️ 1-2天

**目标**：用户（你）在编辑器中逐个加载作品，确认所有视觉表现符合教学预期，反馈问题后由我修复。

**主要任务**：

子任务链路：分批校验 → 记录问题 → 逐个修复 → 回归验证

1. 按复杂度分批校验：
   - A 级（S01/S02/S03）：基础几何体 + 对角线 + 外接球，快速过一遍
   - B 级（S10/S13）：坐标系 + 中点连线，确认轴方向和辅助线正确
   - C 级（S04~S09）：截面 + 度量，逐个确认数值和可视化正确
2. 你在作品库 DEV 中逐个点击作品，通过复制 ID 记录有问题的作品
3. 我根据反馈逐个修复生成脚本中对应 enhance 函数，重新生成问题作品
4. 修复后回归验证，直到全部通过

**涉及文件范围**：
- `scripts/generate-scenes.ts` - 修复问题 enhance 函数
- `src/data/projects/math/m01/scenes/*.json` - 重新生成问题作品

**验收标准**：
✅ 你确认所有作品在编辑器中视觉表现正确
✅ 所有度量数值与手算结果一致
✅ 作品库 DEV 中所有卡片可正常加载和使用

**本阶段产出**：
经过人工验证的高质量作品数据集。下一阶段开始接入 LLM。

---

### 第3阶段：LLM API 基础设施 ⏱️ 1-2天

**目标**：前端具备调用 LLM API 的能力，包括客户端封装、API Key 管理和基础 Prompt 模板。

**主要任务**：

子任务链路：确认 LLM 选型 → API Key 管理方案 → 封装调用客户端 → 设计 Prompt 模板 → 端到端冒烟测试

1. 确认 LLM 选型（Claude / OpenAI / 其他），确定 SDK 或 REST API 调用方式
2. 设计 API Key 管理方案：环境变量存储 + 前端安全传递（注意：前端直调需考虑 Key 暴露风险，需确认是否可接受）
3. 封装 LLM 调用客户端（`src/lib/ai/`）：统一的请求/响应接口、错误处理、超时控制
4. 设计推荐 Prompt 模板：
   - System Prompt：角色定义 + 作品 meta 列表（作为知识库）
   - User Prompt：用户原始输入
   - 输出格式：结构化 JSON（推荐的作品 ID 列表 + 匹配理由）
5. 冒烟测试：hardcode 一个用户输入，调用 LLM API，确认能返回正确格式的推荐结果

**涉及文件范围**：
- `src/lib/ai/` - LLM 调用客户端、Prompt 模板、类型定义
- `.env.development` - LLM API Key 配置

**验收标准**：
✅ 调用 LLM API 返回结构化推荐结果（作品 ID 列表）
✅ 推荐结果中的 ID 能在作品库中找到对应 meta
✅ 网络异常和超时有友好的错误处理

**本阶段产出**：
可用的 LLM 调用客户端 + Prompt 模板。下一阶段将其对接到工作台 UI。

---

### 第4阶段：AI 推荐功能对接工作台 UI ⏱️ 2-3天

**目标**：用户在工作台 AI 面板输入自然语言，点击搜索后 LLM 返回推荐的作品卡片列表，点击即可加载到编辑器。

**主要任务**：

子任务链路：替换 Mock 逻辑 → 渲染推荐作品卡片 → 点击加载场景 → 加载状态与错误处理 → 端到端测试

1. 替换 `WorkspacePage` 中 `handleAiSearch()` 的 Mock 实现为真实 LLM 调用
2. 改造 AI 面板的结果展示：从展示 Template 改为展示 ProjectMeta 卡片（标题、描述、标签、难度）
3. 点击推荐的作品卡片 → 加载 scene_data → 跳转编辑器（复用作品库的加载逻辑）
4. 添加加载状态（LLM 思考中...）和错误处理（API 调用失败、无匹配结果）
5. 优化 Prompt：根据实际测试调整 System Prompt 和输出格式，提升匹配准确度
6. 端到端测试：多种输入场景（知识点、题目、几何体名称、模糊描述）

**涉及文件范围**：
- `src/pages/WorkspacePage.tsx` - AI 面板逻辑和 UI 改造
- `src/lib/ai/` - Prompt 调优

**验收标准**：
✅ 输入"正方体外接球"能推荐 `cube-S03-1`
✅ 输入"二面角怎么求"能推荐包含 S05 场景类型的作品
✅ 输入"高中立体几何体积"能推荐基础认知类作品
✅ 点击推荐结果能成功加载 3D 场景
✅ LLM 调用超时或失败时 UI 有友好提示
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
完整可用的 AI 推荐功能。用户可以通过自然语言搜索获得推荐的教学场景。V0.6 交付完成。

---

## 🎯 当前焦点

### 阶段进展总览

| 阶段 | 状态 | 完成日期 | 备注 |
|------|------|---------|------|
| 1 - 重写生成脚本 + 产出作品数据 | ✅ 完成 | 2026-03-22 | 108 个 scene_data + meta |
| 2 - 人工校验 + 修复 | ⏭️ 跳过 | 2026-03-23 | 用户简单校验，质量基本合格，未来另行优化 |
| 3 - LLM API 基础设施 | ✅ 完成 | 2026-03-23 | Claude Haiku 4.5 + Anthropic 代理 |
| 4 - AI 推荐对接 UI | ✅ 完成 | 2026-03-23 | API 代理层 + UI 改造 + 右键新标签页支持 |
| 附加 - 自动化缩略图 | ✅ 完成 | 2026-03-23 | Playwright 生成 108 个缩略图，作品库 + AI 推荐卡片展示 |

### 第3阶段：LLM API 基础设施 ✅

**子任务链路**：
- [x] 3.1 确认 LLM 选型：Claude Haiku 4.5，Anthropic Messages API 格式
- [x] 3.2 API Key 管理方案：环境变量 `VITE_AI_API_KEY`
- [x] 3.3 封装 LLM 调用客户端（`src/lib/ai/`）
- [x] 3.4 设计推荐 Prompt 模板
- [x] 3.5 端到端冒烟测试（3/3 通过，所有推荐 ID 有效）

### 第4阶段：AI 推荐对接 UI ✅

**子任务链路**：
- [x] 4.1 替换 handleAiSearch Mock → 真实 recommend() 调用
- [x] 4.2 改造结果状态类型与卡片渲染（ProjectMeta + 推荐理由）
- [x] 4.3 点击卡片 → 加载 scene_data → 跳转编辑器
- [x] 4.4 加载状态优化 + 错误处理 UI
- [x] 4.5 更新热门推荐词 + 去 Mock 标记 + 隐藏 AI 生成按钮
- [x] 4.6 端到端测试（用户验收）
- [x] 4.7 API 代理层（Vercel Edge Function + Vite dev proxy，解决 CORS + Key 安全）
- [x] 4.8 作品卡片右键"在新标签页中打开"支持（`<a href>` + EditorPage `?preset=xxx`）

## ✅ 阶段检查点

| 阶段 | 检查方式 | 通过标准 |
|------|---------|---------|
| 1 | 编辑器加载每个场景 | 度量弧线/虚线/数值全部正确渲染 |
| 2 | 用户逐个确认 | 所有作品视觉表现符合教学预期 |
| 3 | 控制台测试 LLM 调用 | 返回结构化推荐结果 |
| 4 | 工作台端到端操作 | 输入→推荐→点击→加载完整链路通畅 |

## 🚫 暂时不考虑

- AI 作品生成（V0.7 范围）
- 多学科扩展（物理/化学模块的作品数据）
- 用户发布作品到推荐池（community source）
- 推荐算法优化（向量相似度、embedding 等）
- 作品数据后端存储（当前静态 JSON）
- 性能优化（大量作品 meta 的加载策略）

## 📝 开发笔记

### 2026-03-19：1.2.1 DSL 指令系统

**关键架构决策**：

1. **方案C（精简指令 + 编译期环境注入）**：指令不含 env 信息，env 由 `getGeometryEnv()` 注册表提供。编译器查表验证 + v0.7 LLM prompt 注入共用同一数据源。

2. **两步法管线（v0.7 预留）**：Step 1 识别几何体类型（小模型）→ Step 2 注入 env 到 prompt 后生成构造指令（大模型）。确定性工作交给系统，概率性工作交给 LLM。

3. **有序构造步骤**：借鉴 GeoGebra 增量构造模式，用 `constructions` 有序数组替代分散的 points/segments/faces。支持 midpoint/centroid/edge_point/segment/face 六种构造类型。

**文件清单**：
```
scripts/dsl/
├── types.ts           # 指令类型定义
├── geometry-env.ts    # 几何体环境注册表（9种几何体）
├── compiler.ts        # 编译器主体
├── resolvers.ts       # 标签/面/线引用解析 + 交线自动计算
├── errors.ts          # 编译错误（精确到标签名和步骤索引）
└── __tests__/
    └── compiler.test.ts  # 23 个测试用例
```
