# 作品数据生成 Pipeline

## 概述

从真题数据集出发，自动生成立体几何 3D 作品的 scene_data。

```
真题数据集(3147道)
  → Step 1 过滤(245道)
    → Step 2 LLM提取(结构化信息)
      → Step 3 归并+评分(157个构型,129个推荐)
        → Step 4 生成测试集/meta建议
          → Step 5 LLM生成DSL指令 + 编译验证(108个作品)
            → compile-all.ts 批量输出 scene_data JSON
```

## 执行方式

```bash
# 按顺序执行（每步可单独重跑，支持断点续传）
python3 scripts/build-dataset.py filter     # Step 1
python3 scripts/build-dataset.py extract    # Step 2（需要 LLM API）
python3 scripts/build-dataset.py merge      # Step 3（需要 LLM API）
python3 scripts/build-dataset.py generate   # Step 4
python3 scripts/build-dataset.py compile    # Step 5（需要 LLM API）

# 最终输出 scene_data
npx tsx scripts/compile-all.ts
```

LLM API 配置在 `claude_key.txt`（项目根目录），格式：
```
ANTHROPIC_BASE_URL="https://xxx"
ANTHROPIC_AUTH_TOKEN="sk-xxx"
```

## 各 Step 详解

### Step 1: filter — 数据清洗与过滤

**输入**: 真题数据集 `~/Documents/工作/edu/edu_mind/research/math_benchmark/data/geometry/questions_geo.jsonl`（3147 道几何题，其中 789 道 geo_type=SOLID）

**过滤规则**:
- 必须包含几何体关键词（正方体/棱锥/棱柱/四面体/...）
- 必须包含任务关键词（二面角/垂直/距离/截面/体积/...）
- content 长度 > 30
- 排除三视图/直观图/射影等非可视化题型

**输出**:
| 文件 | 内容 |
|------|------|
| `scripts/data/filtered_solid_questions.jsonl` | 245 道通过过滤的题目（每行一个 JSON 对象） |
| `scripts/data/filter_log.json` | 过滤日志（每道被排除的题目及原因） |

### Step 2: extract — LLM 结构化提取

**输入**: `filtered_solid_questions.jsonl`

**处理**: 每批 10 道题发给 LLM，提取结构化信息。支持断点续传（已提取的题目不会重复调用）。

**输出**:
| 文件 | 内容 |
|------|------|
| `scripts/data/extracted_configs.jsonl` | 245 条提取结果（每行一个 JSON） |

每条记录的关键字段:
```json
{
  "question_id": "geo-cmm-15526",
  "geometry_type": "正方体",
  "task_type": "求二面角",
  "config_signature": "正方体中，对角截面与底面的二面角",
  "key_elements": ["截面", "底面", "二面角"],
  "auxiliary_constructions": ["连对角线", "取中点"],
  "user_query_variants": ["正方体截面二面角怎么求"],
  "skip_reason": null
}
```

### Step 3: merge — 构型归并 + 频率统计 + 评分

**输入**: `extracted_configs.jsonl`

**处理**:
1. 按 `config_signature` 分组
2. LLM 对同一几何体类型的签名做语义聚类归并
3. 四维评分（考试频率 35% + 教学价值 25% + 可视化增值 25% + 独特性 15%）

**输出**:
| 文件 | 内容 |
|------|------|
| `scripts/data/merged_configs.json` | 157 个归并后构型（含评分、关联题目ID列表） |
| `.tasks/active/0.6/config-list-v3.md` | 构型清单 v3（人可读 Markdown 表格） |

`merged_configs.json` 每个构型的关键字段:
```json
{
  "config_id": "cube-dihedral-diagonal-face",
  "canonical_description": "正方体中对角截面与底面的二面角",
  "geometry_type": "正方体",
  "task_type": "求二面角",
  "question_ids": ["geo-cmm-15526", "geo-cmm-15790", "geo-cmm-15780"],
  "frequency": 3,
  "scores": { "total": 3.15 }
}
```

### Step 4: generate — 生成测试集 / meta 建议 / DSL 参考

**输入**: `merged_configs.json` + `extracted_configs.jsonl`

**输出**:
| 文件 | 内容 |
|------|------|
| `scripts/data/test-queries.jsonl` | 319 条推荐测试集（query → expected_config_id 映射） |
| `.tasks/active/0.6/meta-suggestions.md` | 每个构型的 title/tags/difficulty 建议 |
| `.tasks/active/0.6/dsl-instruction-hints.md` | 每个构型需要的 DSL 元素提示 |

### Step 5: compile — 自动生成 DSL 指令 + 编译验证

**输入**: `merged_configs.json` + `filtered_solid_questions.jsonl` + `extracted_configs.jsonl`

**处理**:
1. 筛选推荐构型（总分 ≥ 2.5）且几何体类型被 DSL 支持的
2. 为每个构型**选一道代表题**（优先有解析、内容最长、未使用过的）
3. 给 LLM 发送：原题 + 解析 + DSL 语法文档 + 几何体环境信息 → 生成 SceneInstruction JSON
4. 调用 DSL 编译器验证，失败则把错误反馈给 LLM 重试（最多 2 次）
5. 记录溯源信息（哪个构型用了哪道题）

**输出**:
| 文件 | 内容 |
|------|------|
| `scripts/data/instructions-v3.json` | 108 个编译通过的 DSL 指令（JSON 数组） |
| `scripts/data/compile_log.json` | 编译溯源日志（每个构型 → 代表题ID + 成功/失败） |

`compile_log.json` 每个构型的记录:
```json
{
  "cube-dihedral-diagonal-face": {
    "representative_question_id": "geo-cmm-15526",
    "compile_success": true,
    "retries": 0
  }
}
```

**断点续传**: 再次运行 Step 5 时，已成功编译的构型会跳过。已用过的题目 ID 不会被其他构型选为代表题。

### compile-all.ts — 批量输出 scene_data

**输入**: `scripts/data/instructions-v3.json`

**处理**: 调用 DSL 编译器，把每条指令编译为 scene_data JSON

**输出**: `src/data/projects/math/m01/scenes/{config_id}.json`（108 个文件）

同时需要更新 `src/data/projects/math/m01/meta.ts` 中的作品元数据。

## 溯源查询

### 从作品 ID 查原题

```bash
python3 -c "
import json
config_id = 'cube-dihedral-diagonal-face'  # 替换为作品 ID

# 1. 查代表题 ID
with open('scripts/data/compile_log.json') as f:
    qid = json.load(f)[config_id]['representative_question_id']
print(f'代表题 ID: {qid}')

# 2. 查原题内容
with open('scripts/data/filtered_solid_questions.jsonl') as f:
    for line in f:
        q = json.loads(line)
        if q['id'] == qid:
            print(f'原题: {q[\"content\"]}')
            if q.get('analysis'):
                print(f'解析: {q[\"analysis\"][:300]}')
            break
"
```

### 从作品 ID 查所有关联题目

```bash
python3 -c "
import json
config_id = 'cube-dihedral-diagonal-face'  # 替换为作品 ID

# 查归并后的关联题目列表
with open('scripts/data/merged_configs.json') as f:
    for c in json.load(f):
        if c['config_id'] == config_id:
            print(f'描述: {c[\"canonical_description\"]}')
            print(f'频率: {c[\"frequency\"]}')
            print(f'关联题目: {c[\"question_ids\"]}')
            break
"
```

### 从题目 ID 查提取信息

```bash
python3 -c "
import json
qid = 'geo-cmm-15526'  # 替换为题目 ID

with open('scripts/data/extracted_configs.jsonl') as f:
    for line in f:
        r = json.loads(line)
        if r['question_id'] == qid:
            print(json.dumps(r, ensure_ascii=False, indent=2))
            break
"
```

## 文件清单

```
scripts/
├── build-dataset.py              # Pipeline 主脚本（filter/extract/merge/generate/compile）
├── compile-all.ts                 # 批量编译 DSL 指令 → scene_data JSON
├── README.md                      # 本文档
├── dsl/                           # DSL 编译器（1.2.1 产出）
│   ├── types.ts                   # 指令类型定义
│   ├── geometry-env.ts            # 几何体环境注册表（9种几何体）
│   ├── compiler.ts                # 编译器主体
│   ├── resolvers.ts               # 标签/面/线引用解析
│   ├── errors.ts                  # 编译错误类型
│   └── __tests__/
│       └── compiler.test.ts       # 编译器测试（23个用例）
├── data/                          # Pipeline 中间产物和最终产物
│   ├── filtered_solid_questions.jsonl   # Step 1: 245 道过滤后题目
│   ├── filter_log.json                  # Step 1: 过滤日志
│   ├── extracted_configs.jsonl          # Step 2: 245 条结构化提取结果
│   ├── merged_configs.json              # Step 3: 157 个归并后构型（含评分）
│   ├── test-queries.jsonl               # Step 4: 319 条推荐测试集
│   ├── instructions-v3.json             # Step 5: 108 个 DSL 指令
│   └── compile_log.json                 # Step 5: 编译溯源日志
└── generate-scenes.ts             # 旧版生成脚本（已被 DSL Pipeline 替代）
```

## DSL 支持的几何体类型

| 中文名 | DSL type | 默认参数 |
|--------|----------|---------|
| 正方体 | cube | sideLength: 2 |
| 长方体 | cuboid | length: 4, width: 3, height: 2 |
| 正三/四棱锥 | pyramid | sides: 3/4, sideLength: 2, height: 2 |
| 正三/四棱柱 | prism | sides: 3/4, sideLength: 2, height: 2 |
| 正四面体 | regularTetrahedron | sideLength: 2 |
| 墙角四面体 | cornerTetrahedron | edgeA/B/C: 2 |
| 圆柱 | cylinder | radius: 1, height: 2 |
| 圆锥 | cone | radius: 1, height: 2 |
| 球 | sphere | radius: 2 |

不支持的类型（组合体、特殊体等）在 Step 5 中会自动跳过。
