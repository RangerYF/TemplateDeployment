# 阶段 1.2.2：从真题提取数据 — 构型清单 + 推荐素材 + 场景指令

## 背景

### v0.6 的核心目标

用户输入自然语言（如"求正四棱锥侧面与底面的二面角"）→ AI 从预置作品库中匹配最合适的 3D 场景返回。

为此需要：
1. **确定作品库内容**（构型清单）— 做哪些作品
2. **高质量的 meta 数据**（title/description/tags）— 供 LLM 匹配
3. **推荐测试集** — 验证 LLM 推荐的准确性
4. **场景构造指令** — 用 DSL 生成 scene_data（依赖 1.2.1）

### 方法论

业内教育 AI 数据集构建的标准做法：**反向归纳为主，正向补盲为辅**。

核心原则：LLM 做"分类器/提取器"，不做"创造者"。从真题中**提取**信息，而不是让 LLM **发明**信息。

### 与 1.1 的区别

| | 1.1 方法 | 1.2.2 方法 |
|---|---------|-----------|
| 数据来源 | LLM 的知识体系（正向推导） | 450 道真题（反向归纳） |
| LLM 角色 | 创造者（枚举构型） | 提取器（从题目中标注） |
| 质量保证 | 人工审查 | 频率统计 + 交叉验证 |
| 产出 | 构型清单（含百科词条） | 构型清单 + 测试集 + meta 建议 |

## 数据源

### 真题数据集

- **路径**：`/Users/cjn/Documents/工作/edu/edu_mind/research/math_benchmark/data/geometry/questions_geo.jsonl`
- **总量**：3147 道几何题，其中 789 道标记为 `geo_type=SOLID`
- **关键词筛选后**：约 453 道确认为立体几何题
- **来源构成**：CMM-Math 766 道 + 高考真题 23 道
- **数据字段**：

```json
{
  "id": "geo-cmm-21089",
  "source": "CMM-Math",
  "type": "choice",                    // choice / fill_blank / open_ended
  "content": "在正方体ABCD-A₁B₁C₁D₁中...",  // LaTeX 格式题目原文
  "options": "A. ... B. ...",           // 选择题选项（可能为空）
  "answer": "B",
  "analysis": "解：建立空间直角坐标系...",    // 解题过程（关键信息源）
  "difficulty": "medium",
  "geo_type": "SOLID",
  "has_figure": true,
  "figure_description": "正方体示意图",
  "dataset_origin": "cmm-math",
  "year": "2019"
}
```

### 数据价值地图（一鱼多吃）

| 真题字段 | 提取什么 | 服务于哪个产出 |
|---------|---------|--------------|
| content | 几何体类型 + 条件组合 → 构型定义 | 产出 A（构型清单） |
| content | 用户输入的真实样本 | 产出 B（测试集） |
| content | 考查目标（求二面角/证垂直/...） | 产出 C（meta 的 tags） |
| analysis | 解题方法（向量法/几何法） | 产出 C（meta 的 tags） |
| analysis | 辅助构造（取中点/建系/作垂线） | 产出 D（DSL 指令参考） |
| difficulty | 难度分级 | 产出 C（meta 的 difficulty） |
| 频率统计 | 作品优先级排序 | 产出 A（筛选标准） |

## 产出物清单

### 持久数据资产

| 产出 | 文件 | 说明 | 用在哪里 |
|------|------|------|---------|
| **A. 构型清单 v3** | `.tasks/active/0.6/config-list-v3.md` | 带频率排序的构型清单，每个构型关联真题出处 | 驱动 scene_data 生成、meta 编写 |
| **B. 推荐测试集** | `scripts/data/test-queries.jsonl` | 80-150 条 query→config 映射 | v0.6 阶段 3/4 的 Prompt 测试 |
| **C. 结构化提取结果** | `scripts/data/extracted_configs.jsonl` | 每道题的归一化数据 | 未来扩展数据集可复用 pipeline |

### 一次性产物

| 产出 | 文件 | 去向 |
|------|------|------|
| D. meta 建议表 | `.tasks/active/0.6/meta-suggestions.md` | 合入 meta.ts |
| E. DSL 指令参考 | `.tasks/active/0.6/dsl-instruction-hints.md` | 编写 DSL 指令时参考 |
| 过滤日志 | `scripts/data/filter_log.json` | 调试完即弃 |
| 归并中间数据 | `scripts/data/merged_configs.json` | 被清单 v3 吸收 |

## 执行计划

### Step 1：数据清洗与过滤（~2h，90% 自动化）

**输入**：789 道 SOLID 题目
**输出**：~200-250 道高价值立体几何题

**保留条件**（必须同时满足）：
- 包含几何体关键词：`正方体|棱锥|棱柱|四面体|长方体|圆柱|圆锥|球`
- 包含任务关键词：`二面角|线面角|异面|垂直|平行|距离|截面|坐标|外接球|体积|表面积`
- content 长度 > 30 字符

**排除条件**（命中任一即排除）：
- 三视图/直观图还原题
- 纯类比推理题（"类比""联想"且无具体计算）
- 纯命题判断题（"下列命题正确的是"且无具体几何场景）
- 射影/柱坐标/球坐标等超纲内容

**人工介入**：扫排除列表 15 分钟，捞回误排除的好题。

**产出**：`scripts/data/filtered_solid_questions.jsonl` + `scripts/data/filter_log.json`

### Step 2：LLM 结构化提取（~4h，70% 自动化）

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
- 3-5 个 few-shot 示例（好的 vs 坏的提取对比）
- `config_signature` 必须**命名无关**——同一构型不同顶点名应产生相同签名
- 分批调用（每批 20 道），留存原始响应
- 对不适合 3D 可视化的题目允许标记 `skip_reason`

**人工介入**：抽检 10%（~25 道），重点看 config_signature 归一化质量。

**产出**：`scripts/data/extracted_configs.jsonl`（持久产物 C）

### Step 3：构型归并、频率统计与评分（~3h，50% 自动化）

**3.1 归并**：LLM 对所有 config_signature 做聚类，相同构型合并。

```json
{
  "config_id": "cube-dihedral-crosssection-base",
  "canonical_description": "正方体中截面与底面的二面角",
  "original_signatures": ["...", "..."],
  "question_ids": ["geo-cmm-15439", "..."],
  "frequency": 7,
  "representative_question": "在正方体ABCD-A₁B₁C₁D₁中，M为AA₁中点..."
}
```

**3.2 四维评分**：

| 维度 | 权重 | 评分标准 |
|------|------|---------|
| 考试频率 | 35% | 1次=1, 2-3次=2, 4-6次=3, 7-10次=4, >10次=5 |
| 教学难度价值 | 25% | 普遍难点=5, 常规=3, 直观=1 |
| 可视化增值 | 25% | 3D增益高=5, 中=3, 低=1 |
| 构型独特性 | 15% | 不可替代=5, 部分重叠=3, 高度重叠=1 |

筛选线：总分 >= 12。预计保留 40-60 个构型。

**3.3 知识补盲**：与 1.1 构型清单对照。
- 真题高频但 1.1 缺失 → 必须补充
- 1.1 存在但真题 0 频率 → 考虑删除
- 1.1 的"百科词条式" → 频率验证，0 频率果断删

**人工介入**：审核归并结果 + 临界线裁决 + 补盲决策，约 1h。

**产出**：`scripts/data/merged_configs.json` + `.tasks/active/0.6/config-list-v3.md`（产出 A）

### Step 4：生成 meta 建议 + 测试集 + DSL 参考（~2h，80% 自动化）

**4.1 Meta 建议**

从每个构型关联的真题中提取高频词生成：
- **title**：`{几何体} — {核心构型描述}`
- **description**：从真题考查目标和解析提取关键句
- **tags**：从 key_elements + method 提取高频词（**来自真题真实词汇，不是 LLM 自由发挥**）
- **difficulty**：从关联题 difficulty_signal 多数投票

**4.2 测试集**

每个构型 2-3 条查询，覆盖三种类型：

```jsonl
{"query": "在正方体ABCD-A₁B₁C₁D₁中，M是AA₁中点，求平面BMC₁与底面ABCD的二面角", "expected_config_id": "cube-dihedral-crosssection-base", "source": "geo-cmm-15439", "query_type": "full_question"}
{"query": "正方体中截面与底面的二面角怎么求", "expected_config_id": "cube-dihedral-crosssection-base", "source": "synthetic", "query_type": "short_query"}
{"query": "正方体截面二面角", "expected_config_id": "cube-dihedral-crosssection-base", "source": "synthetic", "query_type": "keyword"}
```

总计 80-150 条。

**4.3 DSL 指令参考**

从每个构型的 `auxiliary_constructions` 和 `key_elements` 提炼，给出 DSL 指令编写提示：

```markdown
## cube-dihedral-crosssection-base
构型：正方体中截面与底面的二面角
辅助构造：取棱中点M、连AM、连截面
需要的 DSL 元素：
- points: edge midpoint
- faces: custom cross-section
- measurements: dihedral_angle
```

这不是最终 DSL 指令，而是编写指令时的参考信息。

**产出**：
- `.tasks/active/0.6/meta-suggestions.md`（产出 D）
- `scripts/data/test-queries.jsonl`（产出 B）
- `.tasks/active/0.6/dsl-instruction-hints.md`（产出 E）

## 质量保证

### 五层验证

| 层级 | 验证什么 | 怎么验证 | 谁来做 |
|------|---------|---------|--------|
| L1 | 过滤规则合理性 | 扫排除列表 15min | 人工 |
| L2 | config_signature 准确性 | 抽检 10% | 人工 |
| L3 | 归并粒度合适性 | 全量审核归并结果 | 人工 |
| L4 | 优先级排序合理性 | 与教学直觉对照 | 人工 |
| L5 | 端到端推荐准确性 | 用测试集跑推荐 | 自动化（阶段 3/4） |

### 完整性三重交叉验证

1. **真题覆盖率**：构型清单覆盖清洗后题目的比例（目标 >= 85%）
2. **大纲对齐度**：与高中数学课标对照
3. **现有作品回溯**：当前 46 个作品在新清单中能否找到位置

## 脚本化 Pipeline

```bash
python scripts/build-dataset.py filter    # Step 1
python scripts/build-dataset.py extract   # Step 2
python scripts/build-dataset.py merge     # Step 3
python scripts/build-dataset.py generate  # Step 4
```

每步输入输出都是文件，可单独重跑。LLM 调用支持断点续传。

## 工作量

| 步骤 | 耗时 | 自动化 | 人工 |
|------|------|--------|------|
| Step 1 | 2h | 90% | 15min |
| Step 2 | 4h | 70% | 30min |
| Step 3 | 3h | 50% | 1h |
| Step 4 | 2h | 80% | 15min |
| **总计** | **~11h** | | **~2h** |

LLM 调用成本约 $1.5，分 2-3 天完成。

## 上下游依赖

### 上游
- **1.2.1（DSL）**：✅ 已完成（2026-03-19）。编译器和环境注册表就绪，1.2.2 产出的构型清单可直接用 DSL 编写指令生成 scene_data

### 下游（1.2.2 产出如何驱动后续阶段）

```
产出 A（构型清单 v3） ──→ 用 DSL 编写每个构型的指令 → 生成 scene_data
产出 B（推荐测试集）  ──→ v0.6 阶段 3: Prompt 设计的验证基准
                         → v0.6 阶段 4: 端到端测试的回归用例
产出 C（提取结果）    ──→ 未来扩展数据集时复用 pipeline
产出 D（meta 建议）   ──→ 重写 meta.ts
产出 E（DSL 参考）    ──→ 编写 DSL 指令时的辅助信息
```

## 与 1.1 的关系

- **1.1 保留不删除**：手算验证、实体类型分析、顶点布局等工程参考仍有价值
- **1.2.2 的产出 A 替换 1.1 的构型清单**：v3 基于真题数据，取代 v2
- **1.1 的工程信息 + 1.2.1 的 DSL + 1.2.2 的构型清单**：三者结合生成最终 scene_data
