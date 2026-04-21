# 阶段 1.2：从真题反向归纳 — 构型清单 + 推荐系统素材

## 背景

### 为什么需要 1.2

阶段 1.1 采用"知识驱动正向推导"方法（从知识体系让 LLM 枚举构型），生成了 66 个构型。但审查发现严重问题：

1. **混入大量百科词条式场景**：如"展示正方体基本结构"、"直棱柱侧面⊥底面=90°"等，用户不会搜索这类内容
2. **缺少教学频率信号**：LLM 无法判断哪些构型是高考高频、哪些是冷门
3. **根因**：让 LLM 做"创造者"（凭空枚举构型），而非"提取器"（从真题中归纳构型）

### 方法论转换

业内教育 AI 构建数据集的标准做法是**反向归纳为主，正向补盲为辅**：

```
真实题目 → LLM 提取/分类 → 频率统计排序 → 知识补盲 → 场景库
```

核心原则：**LLM 的角色是"分类器/提取器"，不是"创造者"。**

## 数据源

已有现成的真题数据集（来自 edu_mind 项目的 benchmark）：

- **路径**：`/Users/cjn/Documents/工作/edu/edu_mind/research/math_benchmark/data/geometry/questions_geo.jsonl`
- **总量**：3147 道几何题，其中 **789 道标记为 SOLID（立体几何）**
- **关键词筛选后**：约 **453 道**确认为立体几何题
- **来源**：CMM-Math（766 道）+ 高考真题（23 道）
- **字段**：id, source, type, content, options, answer, analysis, difficulty, geo_type, geo_topic, has_figure, figure_description, dataset_origin, year

## 一鱼多吃：真题的全部价值

真题中不仅有构型信息，还有大量直接服务于 v0.6 "AI 作品推荐"目标的数据：

| 真题字段 | 提取什么 | 服务于什么 |
|---------|---------|-----------|
| content（题目原文） | 用户输入的真实样本 | 推荐测试集 |
| content | 几何体类型 + 条件组合 | 构型定义 |
| content | 考查目标（求二面角/证垂直/...） | meta 的 tags/description |
| analysis（解析） | 解题方法（向量法/几何法） | meta 的 tags |
| analysis | 关键辅助构造（取中点/建系/作垂线） | scene_data 的 enhance 函数 |
| difficulty | 难度分级 | meta 的 difficulty |
| 出现频率（统计得到） | 作品优先级排序 | 决定哪些构型值得做 |

## 产物架构

```
                    真题 ~450 道
                        │
                   ┌────┴────┐
                   ▼         ▼
             [中间产物]    [中间产物]
          结构化提取结果   过滤排除记录
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
     [持久产物A] [持久产物B] [持久产物C]
      构型清单v3  推荐测试集  meta建议表
          │        │         │
          ▼        ▼         ▼
     [工程产物]  [工程产物]  [工程产物]
     WORK_SPECS  Prompt测试  meta.ts
```

### 持久数据资产（长期有用）

| 产物 | 文件 | 说明 |
|------|------|------|
| **A. 构型清单 v3** | `config-list-v3.md` | 决定"做哪些作品"的权威清单，后续扩充作品库时持续参考 |
| **B. 推荐测试集** | `test-queries.jsonl` | 验证 LLM 推荐准确性的回归测试集，每次调 Prompt 都要跑 |
| **C. 结构化提取结果** | `extracted_configs.jsonl` | 每道题的归一化数据，未来扩展数据集时可复用 pipeline |

### 一次性中间产物（用完即弃或合入代码）

| 产物 | 说明 |
|------|------|
| 过滤排除记录 | 调试用，确认没误排好题 |
| meta 建议表 | 合入 meta.ts 后不再独立维护 |

## 执行计划

### Step 1：数据清洗与过滤（~2h，90% 自动化）

**输入**：789 道 SOLID 题目
**输出**：~200-250 道高价值立体几何题

**过滤规则**（写成脚本）：

```
保留条件（必须同时满足）：
├── 包含几何体关键词：正方体|棱锥|棱柱|四面体|长方体|圆柱|圆锥|球
├── 包含任务关键词：二面角|线面角|异面|垂直|平行|距离|截面|坐标|外接球|体积|表面积
└── content 长度 > 30 字符（排除纯概念题）

排除条件（命中任一即排除）：
├── 纯类比推理题（包含"类比""联想"关键词且无具体计算）
├── 纯命题判断题（"下列命题正确的是"且无具体几何场景）
└── 三视图/直观图还原题（"三视图""直观图"且不涉及空间关系）
```

**人工介入点**：花 15 分钟扫一遍排除列表，把误排除的好题捞回来。

**产出文件**：
- `scripts/data/filtered_solid_questions.jsonl`
- `scripts/data/filter_log.json`

### Step 2：LLM 结构化提取（~4h，70% 自动化）

**输入**：~200-250 道清洗后的题目
**输出**：每道题的结构化提取结果

对每道题提取：

```json
{
  "question_id": "geo-cmm-21089",
  "geometry_type": "正方体",
  "geometry_params": "棱长a",
  "task_type": "求二面角",
  "config_signature": "正方体中，截面与底面的二面角",
  "key_elements": ["截面", "底面", "二面角"],
  "auxiliary_constructions": ["取棱中点", "连辅助线"],
  "method": "向量法",
  "difficulty_signal": "中等",
  "user_query_variants": [
    "正方体中截面与底面的二面角怎么求",
    "求正方体截面二面角"
  ],
  "skip_reason": null
}
```

**Prompt 设计要点**：
- 提供 3-5 个 few-shot 示例（好的提取 vs 坏的提取）
- `config_signature` 必须**命名无关**——同一构型不同顶点名应产生相同签名
- 明确告诉 LLM："你是在从题目中提取信息，不是在创造新内容"
- 对不适合 3D 可视化的题目，允许标记 `skip_reason`
- 分批调用（每批 20 道），留存原始响应

**人工介入点**：抽检 10%（~25 道），重点看 config_signature 是否准确归一化。系统性问题则调 Prompt 重跑。

**成本估算**：~250 道 × ~2000 token/道 = ~500K token，约 $1.5

**产出文件**：
- `scripts/data/extracted_configs.jsonl`（持久产物 C）

### Step 3：构型归并、频率统计与评分（~3h，50% 自动化）

**3.1 构型归并**

让 LLM 对所有 config_signature 做聚类归并：

```json
{
  "merged_config_id": "cube-dihedral-crosssection-base",
  "canonical_description": "正方体中截面与底面的二面角",
  "original_signatures": ["正方体中，过三棱中点截面与底面所成二面角", "..."],
  "question_ids": ["geo-cmm-15439", "..."],
  "frequency": 7
}
```

**3.2 四维评分**

| 维度 | 权重 | 评分方式 |
|------|------|---------|
| 考试频率 | 35% | frequency: 1次=1分，2-3次=2分，4-6次=3分，7-10次=4分，>10=5分 |
| 教学难度价值 | 25% | LLM 根据 difficulty_signal 评分：普遍困难=5，常规=3，直观=1 |
| 可视化增值 | 25% | 3D 比文字/平面图理解增益：高=5，中=3，低=1 |
| 构型独特性 | 15% | 不可替代=5，部分重叠=3，高度重叠=1 |

**筛选线**：总分 >= 12 分纳入最终清单。预计保留 **40-60 个构型**。

**3.3 知识补盲（用 1.1 对照）**

- 真题中高频但 1.1 缺失的 → **必须补充**
- 1.1 中存在但真题中 0 频率的 → **考虑删除**（除非大纲明确要求）
- 1.1 中的"百科词条式"构型 → 用频率验证，0 频率果断删

**人工介入点**：
- 审核归并结果（防过度/不足归并）
- 12 分临界线附近的构型做人工裁决
- 补盲"删还是留"需教学判断

**产出文件**：
- `scripts/data/merged_configs.json`
- `.tasks/active/0.6/config-list-v3.md`（持久产物 A）

### Step 4：生成 meta 建议 + 测试集（~2h，80% 自动化）

**4.1 Meta 数据生成**

从每个构型关联的真题中提取高频词，生成 meta 建议：

- **title**：`{几何体} — {核心构型描述}`
- **description**：从真题的考查目标和解析中提取关键句
- **tags**：从关联题的 key_elements + method 中提取高频词
- **difficulty**：从关联题的 difficulty_signal 多数投票

**关键区别**：meta 的 description 和 tags 来自**真题中的真实词汇**，不是 LLM 自由发挥。这确保 LLM 推荐时用的"语言"与用户输入天然匹配。

**4.2 测试集构建**

每个构型生成 2-3 条测试查询，覆盖三种类型：

```jsonl
{"query": "正方体中截面与底面的二面角怎么求", "expected_config_id": "cube-dihedral-crosssection-base", "source": "geo-cmm-15439", "query_type": "short_query"}
{"query": "在正方体ABCD-A₁B₁C₁D₁中，M是AA₁中点，求平面BMC₁与底面的二面角", "expected_config_id": "cube-dihedral-crosssection-base", "source": "geo-cmm-15439", "query_type": "full_question"}
{"query": "正方体截面二面角", "expected_config_id": "cube-dihedral-crosssection-base", "source": "synthetic", "query_type": "keyword"}
```

三种类型确保测试覆盖：
- `full_question`：完整题目原文（测试理解能力）
- `short_query`：简化描述（测试匹配精度）
- `keyword`：关键词/口语化（测试模糊匹配）

总计预估 **80-150 条**。

**产出文件**：
- `.tasks/active/0.6/meta-suggestions.md`（一次性，合入 meta.ts 后废弃）
- `scripts/data/test-queries.jsonl`（持久产物 B）

## 质量保证：五层验证

| 层级 | 验证什么 | 怎么验证 | 谁来做 |
|------|---------|---------|--------|
| L1 数据清洗 | 过滤规则是否合理 | 扫排除列表 15min | 人工 |
| L2 结构化提取 | config_signature 是否准确 | 抽检 10% 提取结果 | 人工 |
| L3 构型归并 | 归并粒度是否合适 | 全量审核归并结果 | 人工 |
| L4 评分排序 | 优先级是否合理 | 与教学直觉对照 | 人工 |
| L5 端到端 | 测试集能否正确匹配 | 用测试集跑推荐 | 自动化（阶段 3/4）|

### 完整性三重交叉验证

1. **真题覆盖率**：构型清单覆盖清洗后题目的百分比（目标 >= 85%）
2. **大纲对齐度**：与高中数学课标对照，确认无遗漏
3. **现有作品回溯**：当前 46 个作品在新清单中是否都能找到位置

## 脚本化 Pipeline

```bash
python scripts/build-dataset.py filter    # Step 1: 数据清洗
python scripts/build-dataset.py extract   # Step 2: LLM 结构化提取
python scripts/build-dataset.py merge     # Step 3: 构型归并 + 评分
python scripts/build-dataset.py generate  # Step 4: 生成 meta 和测试集
```

每步输入输出都是文件，可单独重跑。LLM 调用步骤支持断点续传。

## 工作量估算

| 步骤 | 耗时 | 自动化程度 | 人工介入 |
|------|------|-----------|---------|
| Step 1 数据清洗 | 2h | 90% | 扫排除列表 15min |
| Step 2 LLM 提取 | 4h | 70% | 抽检 25 道 ~30min |
| Step 3 归并+评分 | 3h | 50% | 审核归并 + 裁决临界构型 ~1h |
| Step 4 meta+测试集 | 2h | 80% | 抽检产出质量 ~15min |
| **总计** | **~11h** | | **~2h 人工** |

预计 2-3 天完成。LLM 调用成本约 $1.5。

## 与 1.1 的关系

- **1.1 保留不删除**：手算验证、实体类型分析、builder 顶点布局等工程参考仍有价值
- **1.2 的产出 A 替换 1.1 的构型清单**：v3 基于真题数据，取代 v2 的知识推导清单
- **1.2 完成后**：用 v3 清单 + 1.1 的工程信息，重写 generate-scenes.ts 和 meta.ts
