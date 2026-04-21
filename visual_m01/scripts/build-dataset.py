#!/usr/bin/env python3
"""
构型数据集构建 Pipeline

用法:
  python scripts/build-dataset.py filter    # Step 1: 数据清洗与过滤
  python scripts/build-dataset.py extract   # Step 2: LLM 结构化提取
  python scripts/build-dataset.py merge     # Step 3: 构型归并 + 频率统计
  python scripts/build-dataset.py generate  # Step 4: 生成 meta/测试集/DSL 参考
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# ── 路径配置 ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "scripts" / "data"
SOURCE_FILE = Path.home() / "Documents" / "工作" / "edu" / "edu_mind" / "research" / "math_benchmark" / "data" / "geometry" / "questions_geo.jsonl"

# ── Step 1 输出 ──
FILTERED_FILE = DATA_DIR / "filtered_solid_questions.jsonl"
FILTER_LOG_FILE = DATA_DIR / "filter_log.json"

# ── Step 2 输出 ──
EXTRACTED_FILE = DATA_DIR / "extracted_configs.jsonl"

# ── Step 3 输出 ──
MERGED_FILE = DATA_DIR / "merged_configs.json"
TASKS_DIR = PROJECT_ROOT / ".tasks" / "active" / "0.6"
CONFIG_LIST_FILE = TASKS_DIR / "config-list-v3.md"

# ── Step 4 输出 ──
META_SUGGESTIONS_FILE = TASKS_DIR / "meta-suggestions.md"
DSL_HINTS_FILE = TASKS_DIR / "dsl-instruction-hints.md"
TEST_QUERIES_FILE = DATA_DIR / "test-queries.jsonl"

# ── Step 5 输出 ──
INSTRUCTIONS_FILE = DATA_DIR / "instructions-v3.json"
COMPILE_LOG_FILE = DATA_DIR / "compile_log.json"
SCENE_OUTPUT_DIR = PROJECT_ROOT / "src" / "data" / "projects" / "math" / "m01" / "scenes"

# ── LLM 配置 ──
CLAUDE_KEY_FILE = PROJECT_ROOT / "claude_key.txt"


# ═══════════════════════════════════════════════════════════════
# Step 1: 数据清洗与过滤
# ═══════════════════════════════════════════════════════════════

# 几何体关键词（必须命中至少一个）
GEO_KEYWORDS = re.compile(
    r"正方体|棱锥|棱柱|四面体|长方体|圆柱|圆锥|球"
    r"|正三棱|正四棱|直三棱柱|直棱柱|直四棱柱|平行六面体"
    r"|底面.*(?:正方形|矩形|菱形|正三角|等腰)"
)

# 任务关键词（必须命中至少一个）
TASK_KEYWORDS = re.compile(
    r"二面角|线面角|异面|垂直|平行|//|\\parallel"
    r"|距离|截面|坐标|外接球|体积|表面积|内切球"
    r"|向量|证明|面积|棱长|侧面|底面|高为"
    r"|求.*角|夹角|cos|sin|tan|法向量|中点|对角|投影"
)

# 排除关键词（命中任一即排除）
EXCLUDE_KEYWORDS = re.compile(
    r"三视图|直观图还原|射影|柱坐标|球坐标"
)

MIN_CONTENT_LENGTH = 30


def filter_questions():
    """Step 1: 从 789 道 SOLID 题中筛选高价值立体几何题"""
    if not SOURCE_FILE.exists():
        print(f"错误: 数据源不存在 {SOURCE_FILE}")
        sys.exit(1)

    # 读取所有 SOLID 题目
    solid_questions = []
    with open(SOURCE_FILE, "r", encoding="utf-8") as f:
        for line in f:
            obj = json.loads(line)
            if obj.get("geo_type") == "SOLID":
                solid_questions.append(obj)

    print(f"读取 SOLID 题目: {len(solid_questions)}")

    passed = []
    excluded = []

    for q in solid_questions:
        content = q.get("content", "")
        qid = q["id"]

        # 规则 1: 内容长度
        if len(content) <= MIN_CONTENT_LENGTH:
            excluded.append({"id": qid, "reason": "too_short", "detail": f"长度={len(content)}"})
            continue

        # 规则 2: 排除关键词
        match = EXCLUDE_KEYWORDS.search(content)
        if match:
            excluded.append({"id": qid, "reason": "excluded_keyword", "detail": match.group()})
            continue

        # 规则 3: 几何体关键词
        if not GEO_KEYWORDS.search(content):
            excluded.append({"id": qid, "reason": "no_geometry_keyword", "detail": content[:80]})
            continue

        # 规则 4: 任务关键词
        if not TASK_KEYWORDS.search(content):
            excluded.append({"id": qid, "reason": "no_task_keyword", "detail": content[:80]})
            continue

        passed.append(q)

    # 统计
    from collections import Counter
    reason_counts = Counter(e["reason"] for e in excluded)

    print(f"\n═══ 过滤结果 ═══")
    print(f"通过: {len(passed)}/{len(solid_questions)}")
    print(f"排除: {len(excluded)}")
    for reason, count in reason_counts.most_common():
        print(f"  {reason}: {count}")

    # 通过题目的几何体类型分布
    geo_types = Counter()
    for q in passed:
        content = q["content"]
        if re.search(r"正方体", content):
            geo_types["正方体"] += 1
        elif re.search(r"四面体", content):
            geo_types["四面体"] += 1
        elif re.search(r"棱锥", content):
            geo_types["棱锥"] += 1
        elif re.search(r"棱柱", content):
            geo_types["棱柱"] += 1
        elif re.search(r"长方体", content):
            geo_types["长方体"] += 1
        elif re.search(r"球", content):
            geo_types["球"] += 1
        elif re.search(r"圆柱|圆锥", content):
            geo_types["旋转体"] += 1
        else:
            geo_types["其他"] += 1

    print(f"\n几何体类型分布:")
    for geo_type, count in geo_types.most_common():
        print(f"  {geo_type}: {count}")

    # 写出结果
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(FILTERED_FILE, "w", encoding="utf-8") as f:
        for q in passed:
            f.write(json.dumps(q, ensure_ascii=False) + "\n")

    with open(FILTER_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "total_solid": len(solid_questions),
            "passed": len(passed),
            "excluded": len(excluded),
            "reason_counts": dict(reason_counts),
            "excluded_items": excluded,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n输出:")
    print(f"  通过题目: {FILTERED_FILE}")
    print(f"  过滤日志: {FILTER_LOG_FILE}")


# ═══════════════════════════════════════════════════════════════
# Step 2: LLM 结构化提取
# ═══════════════════════════════════════════════════════════════

EXTRACT_SYSTEM_PROMPT = """你是一个高中数学立体几何题目分析专家。你的任务是从立体几何题目中提取结构化信息。

## 输出格式

对每道题，输出一个 JSON 对象（不要输出其他内容）：

```json
{
  "question_id": "原始题目ID",
  "geometry_type": "几何体类型（正方体/长方体/正三棱柱/正三棱锥/正四棱锥/正四面体/圆柱/圆锥/球/组合体）",
  "geometry_params": "几何体参数描述（如'棱长a'、'底面边长a，高h'）",
  "task_type": "考查任务（求二面角/求线面角/求异面直线所成角/证明线面垂直/证明面面平行/求点面距离/求异面距离/求体积/求表面积/求外接球/建系求向量/其他）",
  "config_signature": "命名无关的构型签名（见下方规则）",
  "key_elements": ["关键元素列表"],
  "auxiliary_constructions": ["辅助构造列表"],
  "method": "解题方法（向量法/几何法/坐标法/综合法）",
  "difficulty_signal": "难度（基础/中等/较难/困难）",
  "user_query_variants": ["2-3个用户可能的自然语言查询"],
  "visualization_value": "3D可视化增值（高/中/低）",
  "skip_reason": null
}
```

## config_signature 规则（最重要）

签名必须**命名无关**——同一构型不同顶点名应产生相同签名。

格式：`{几何体类型}中，{构型描述}`

好的签名（命名无关）：
- "正方体中，对角面与底面的二面角"
- "正三棱柱中，顶面顶点到对侧面的距离"
- "正四棱锥中，侧面与底面的二面角"

坏的签名（包含具体顶点名）：
- "正方体ABCD-A₁B₁C₁D₁中，平面ABD₁与底面的二面角"  ← 不要这样
- "三棱锥P-ABC中，PA⊥底面"  ← 不要这样

## skip_reason

如果题目不适合3D可视化（纯判断题、命题真假题、没有具体几何场景），设置 skip_reason 说明原因，其他字段仍然尽量填写。

## 注意事项

1. geometry_type 使用标准化名称，不要直接复制题目文本
2. 一道题可能涉及多个任务，task_type 取主要任务
3. auxiliary_constructions 从题目和解析中提取，描述要通用（"取棱中点"而非"取AB中点"）
4. user_query_variants 模拟真实用户输入，包括完整描述和简短查询"""

EXTRACT_FEW_SHOTS = """## 示例

### 示例1
题目：在正方体 $ABCD-A_1B_1C_1D_1$ 中，$M$ 为 $AA_1$ 的中点，求平面 $BMC_1$ 与底面 $ABCD$ 所成的二面角。

```json
{
  "question_id": "example-1",
  "geometry_type": "正方体",
  "geometry_params": "棱长a",
  "task_type": "求二面角",
  "config_signature": "正方体中，过棱中点的截面与底面的二面角",
  "key_elements": ["截面", "底面", "二面角", "棱中点"],
  "auxiliary_constructions": ["取侧棱中点", "构造截面", "求二面角"],
  "method": "向量法",
  "difficulty_signal": "中等",
  "user_query_variants": ["正方体截面与底面的二面角", "正方体中过中点的截面二面角怎么求"],
  "visualization_value": "高",
  "skip_reason": null
}
```

### 示例2
题目：设 $m,n$ 是两条不同的直线，$\\alpha,\\beta$ 是两个不同的平面，下列命题正确的是...

```json
{
  "question_id": "example-2",
  "geometry_type": "其他",
  "geometry_params": "",
  "task_type": "其他",
  "config_signature": "线面位置关系判断题",
  "key_elements": ["线面关系", "命题判断"],
  "auxiliary_constructions": [],
  "method": "综合法",
  "difficulty_signal": "基础",
  "user_query_variants": ["线面位置关系"],
  "visualization_value": "低",
  "skip_reason": "纯命题判断题，无具体几何场景，不适合3D可视化"
}
```

### 示例3
题目：在正三棱柱 $ABC-A_1B_1C_1$ 中，$D$ 是 $BC$ 的中点，求证：$A_1B // $ 平面 $ACD_1$（待定）。（2）求二面角 $A-CD_1-A_1$ 的大小。

```json
{
  "question_id": "example-3",
  "geometry_type": "正三棱柱",
  "geometry_params": "底面边长a，高h",
  "task_type": "求二面角",
  "config_signature": "正三棱柱中，过底边中点的截面相关二面角",
  "key_elements": ["底边中点", "截面", "二面角", "线面平行"],
  "auxiliary_constructions": ["取底边中点", "构造截面"],
  "method": "坐标法",
  "difficulty_signal": "中等",
  "user_query_variants": ["正三棱柱中求二面角", "三棱柱底边中点二面角"],
  "visualization_value": "高",
  "skip_reason": null
}
```"""


def load_claude_config():
    """从 claude_key.txt 加载 API 配置"""
    config = {}
    with open(CLAUDE_KEY_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip().strip('"')
    return config


def call_claude(client, messages, model="claude-sonnet-4-20250514"):
    """调用 Claude API"""
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=EXTRACT_SYSTEM_PROMPT,
        messages=messages,
    )
    return response.content[0].text


def extract_batch(client, questions, batch_idx):
    """提取一批题目的结构化信息"""
    # 构建用户消息：few-shot + 当前批次题目
    questions_text = ""
    for i, q in enumerate(questions):
        content = q["content"]
        analysis = q.get("analysis", "") or ""
        questions_text += f"\n### 第{i+1}题 (ID: {q['id']})\n题目：{content}\n"
        if analysis:
            questions_text += f"解析：{analysis[:500]}\n"

    user_message = f"""{EXTRACT_FEW_SHOTS}

---

现在请对以下 {len(questions)} 道题目进行结构化提取。每道题输出一个 JSON 对象，用 ```json ``` 包裹。

{questions_text}"""

    response = call_claude(client, [{"role": "user", "content": user_message}])
    return response


def parse_extraction_response(response_text):
    """从 LLM 响应中解析 JSON 对象"""
    results = []
    # 匹配所有 ```json ... ``` 块
    pattern = r"```json\s*(.*?)\s*```"
    matches = re.findall(pattern, response_text, re.DOTALL)

    for match in matches:
        try:
            obj = json.loads(match)
            results.append(obj)
        except json.JSONDecodeError as e:
            print(f"  警告: JSON 解析失败: {e}")
            print(f"  内容: {match[:200]}")

    return results


def extract_configs():
    """Step 2: 对每道题用 LLM 提取结构化信息"""
    if not FILTERED_FILE.exists():
        print(f"错误: 请先运行 filter 命令生成 {FILTERED_FILE}")
        sys.exit(1)

    # 读取过滤后题目
    questions = []
    with open(FILTERED_FILE, "r", encoding="utf-8") as f:
        for line in f:
            questions.append(json.loads(line))

    print(f"读取过滤后题目: {len(questions)}")

    # 加载已完成的提取结果（断点续传）
    done_ids = set()
    existing_results = []
    if EXTRACTED_FILE.exists():
        with open(EXTRACTED_FILE, "r", encoding="utf-8") as f:
            for line in f:
                obj = json.loads(line)
                done_ids.add(obj["question_id"])
                existing_results.append(obj)
        print(f"已完成提取: {len(done_ids)} 题（断点续传）")

    # 过滤掉已完成的
    remaining = [q for q in questions if q["id"] not in done_ids]
    print(f"待提取: {len(remaining)} 题")

    if not remaining:
        print("所有题目已提取完成！")
        return

    # 初始化 Claude 客户端
    config = load_claude_config()
    import anthropic
    client = anthropic.Anthropic(
        base_url=config["ANTHROPIC_BASE_URL"],
        api_key=config["ANTHROPIC_AUTH_TOKEN"],
    )

    # 分批提取（每批 10 题）
    BATCH_SIZE = 10
    batches = [remaining[i:i + BATCH_SIZE] for i in range(0, len(remaining), BATCH_SIZE)]
    total_extracted = len(done_ids)

    print(f"\n═══ 开始 LLM 提取（{len(batches)} 批，每批 {BATCH_SIZE} 题）═══\n")

    for batch_idx, batch in enumerate(batches):
        print(f"批次 {batch_idx + 1}/{len(batches)}（题目 {batch[0]['id']} ~ {batch[-1]['id']}）...")

        try:
            response = extract_batch(client, batch, batch_idx)
            results = parse_extraction_response(response)

            # 写入结果（追加模式）
            with open(EXTRACTED_FILE, "a", encoding="utf-8") as f:
                for r in results:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")

            total_extracted += len(results)
            print(f"  提取 {len(results)} 条，累计 {total_extracted}/{len(questions)}")

            # 批间间隔，避免限流
            if batch_idx < len(batches) - 1:
                time.sleep(2)

        except Exception as e:
            print(f"  错误: {e}")
            print(f"  跳过该批次，可重新运行续传")
            time.sleep(5)

    print(f"\n═══ 提取完成 ═══")
    print(f"总计: {total_extracted}/{len(questions)}")
    print(f"输出: {EXTRACTED_FILE}")


# ═══════════════════════════════════════════════════════════════
# Step 3: 构型归并 + 频率统计 + 评分
# ═══════════════════════════════════════════════════════════════

MERGE_SYSTEM_PROMPT = """你是一个高中立体几何教学专家。你的任务是对一组构型签名进行聚类归并。

## 任务

输入是一组 config_signature（构型签名），每个关联了出现频率和题目ID列表。
你需要将**语义相同或高度相似**的构型合并为一个规范构型。

## 归并规则

1. **同一构型不同表述** → 合并（如"正方体对角面与底面的二面角" ≈ "正方体中对角线所在面与底面的二面角"）
2. **同一几何体+同一任务+同一关键构造** → 合并（如"正方体中过棱中点截面的二面角" ≈ "正方体截面与底面二面角"，如果截面构造相同）
3. **不同几何体** → 不合并（正方体 vs 正四棱锥）
4. **同一几何体+不同任务** → 不合并（"正方体求二面角" vs "正方体求体对角线"）
5. **同一几何体+同一任务+不同关键构造** → 不合并（"正方体面对角线异面角" vs "正方体体对角线与棱的异面角"）

## 输出格式

输出一个 JSON 数组，每个元素：

```json
{
  "config_id": "规范ID（格式：{geo}-{task}-{key}，全小写英文，用短横连接）",
  "canonical_description": "规范中文描述",
  "geometry_type": "几何体类型",
  "task_type": "主要任务类型",
  "original_signatures": ["原始签名1", "原始签名2"],
  "question_ids": ["题目ID列表"],
  "frequency": 总频率
}
```

注意：config_id 用简短英文，如 cube-dihedral-diagonal-face, pyramid4-lateral-base-dihedral"""

SCORE_WEIGHTS = {
    "exam_frequency": 0.35,
    "teaching_value": 0.25,
    "visualization_value": 0.25,
    "uniqueness": 0.15,
}


def merge_configs():
    """Step 3: 对提取结果做聚类归并和评分"""
    if not EXTRACTED_FILE.exists():
        print(f"错误: 请先运行 extract 命令生成 {EXTRACTED_FILE}")
        sys.exit(1)

    # 读取提取结果
    results = []
    with open(EXTRACTED_FILE, "r", encoding="utf-8") as f:
        for line in f:
            results.append(json.loads(line))

    print(f"读取提取结果: {len(results)}")

    # 过滤掉 skip 的
    valid = [r for r in results if not r.get("skip_reason")]
    skipped = [r for r in results if r.get("skip_reason")]
    print(f"有效: {len(valid)}, 跳过: {len(skipped)}")

    # Step 3.1: 初步按 (geometry_type, task_type, config_signature) 聚合
    from collections import defaultdict, Counter

    sig_groups = defaultdict(list)
    for r in valid:
        sig = r["config_signature"]
        sig_groups[sig].append(r)

    print(f"独立签名数: {len(sig_groups)}")

    # 准备 LLM 归并的输入：按几何体类型分组
    geo_sig_groups = defaultdict(list)
    for sig, items in sig_groups.items():
        geo_type = items[0]["geometry_type"]
        geo_sig_groups[geo_type].append({
            "signature": sig,
            "frequency": len(items),
            "question_ids": [r["question_id"] for r in items],
            "task_type": items[0]["task_type"],
            "key_elements": items[0].get("key_elements", []),
        })

    # 初始化 Claude 客户端
    config = load_claude_config()
    import anthropic
    client = anthropic.Anthropic(
        base_url=config["ANTHROPIC_BASE_URL"],
        api_key=config["ANTHROPIC_AUTH_TOKEN"],
    )

    all_merged = []

    # 按几何体类型分批让 LLM 归并
    for geo_type, sigs in sorted(geo_sig_groups.items(), key=lambda x: -len(x[1])):
        print(f"\n归并 {geo_type}（{len(sigs)} 个签名）...")

        sigs_text = json.dumps(sigs, ensure_ascii=False, indent=2)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=MERGE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"请对以下 {geo_type} 的 {len(sigs)} 个构型签名进行归并。\n\n```json\n{sigs_text}\n```\n\n输出归并后的 JSON 数组（用 ```json ``` 包裹）。"
            }],
        )

        resp_text = response.content[0].text
        merged = parse_extraction_response(resp_text)

        if merged and isinstance(merged[0], list):
            merged = merged[0]

        all_merged.extend(merged)
        print(f"  归并为 {len(merged)} 个构型")
        time.sleep(2)

    print(f"\n═══ 归并结果 ═══")
    print(f"归并前独立签名: {len(sig_groups)}")
    print(f"归并后构型数: {len(all_merged)}")

    # Step 3.2: 四维评分
    print(f"\n═══ 四维评分 ═══")

    # 为每个构型计算评分
    for cfg in all_merged:
        freq = cfg.get("frequency", 1)

        # 考试频率分 (35%)
        if freq >= 10:
            freq_score = 5
        elif freq >= 7:
            freq_score = 4
        elif freq >= 4:
            freq_score = 3
        elif freq >= 2:
            freq_score = 2
        else:
            freq_score = 1

        # 教学难度价值 (25%) - 从关联题目的 difficulty_signal 推断
        related_results = []
        for r in valid:
            if r["question_id"] in cfg.get("question_ids", []):
                related_results.append(r)

        difficulty_signals = [r.get("difficulty_signal", "中等") for r in related_results]
        diff_map = {"基础": 1, "中等": 3, "较难": 4, "困难": 5}
        if difficulty_signals:
            teach_score = round(sum(diff_map.get(d, 3) for d in difficulty_signals) / len(difficulty_signals))
        else:
            teach_score = 3

        # 可视化增值 (25%)
        viz_signals = [r.get("visualization_value", "中") for r in related_results]
        viz_map = {"高": 5, "中": 3, "低": 1}
        if viz_signals:
            viz_score = round(sum(viz_map.get(v, 3) for v in viz_signals) / len(viz_signals))
        else:
            viz_score = 3

        # 构型独特性 (15%) - 同一几何体+任务类型中的构型数决定
        same_geo_task = [c for c in all_merged
                         if c.get("geometry_type") == cfg.get("geometry_type")
                         and c.get("task_type") == cfg.get("task_type")]
        if len(same_geo_task) <= 1:
            uniq_score = 5
        elif len(same_geo_task) <= 3:
            uniq_score = 3
        else:
            uniq_score = 1

        total = (freq_score * 0.35 + teach_score * 0.25 +
                 viz_score * 0.25 + uniq_score * 0.15)

        cfg["scores"] = {
            "exam_frequency": freq_score,
            "teaching_value": teach_score,
            "visualization_value": viz_score,
            "uniqueness": uniq_score,
            "total": round(total, 2),
        }

    # 按总分排序
    all_merged.sort(key=lambda c: -c["scores"]["total"])

    # 输出评分分布
    above_threshold = [c for c in all_merged if c["scores"]["total"] >= 2.5]
    below_threshold = [c for c in all_merged if c["scores"]["total"] < 2.5]
    print(f"总分 >= 2.5: {len(above_threshold)} 个")
    print(f"总分 < 2.5: {len(below_threshold)} 个")

    # 保存 merged_configs.json
    with open(MERGED_FILE, "w", encoding="utf-8") as f:
        json.dump(all_merged, f, ensure_ascii=False, indent=2)

    # 生成构型清单 v3 Markdown
    _generate_config_list_md(all_merged)

    print(f"\n输出:")
    print(f"  归并数据: {MERGED_FILE}")
    print(f"  构型清单: {CONFIG_LIST_FILE}")


def _generate_config_list_md(configs):
    """生成构型清单 v3 的 Markdown 文件"""
    lines = [
        "# 构型清单 v3（基于真题数据）\n",
        f"> 生成时间：2026-03-19",
        f"> 数据来源：245 道立体几何真题（CMM-Math + 高考真题）",
        f"> 构型总数：{len(configs)}，其中推荐（总分≥2.5）：{sum(1 for c in configs if c['scores']['total'] >= 2.5)}\n",
    ]

    # 按几何体类型分组
    from collections import defaultdict
    by_geo = defaultdict(list)
    for c in configs:
        by_geo[c.get("geometry_type", "其他")].append(c)

    for geo_type in ["正方体", "长方体", "正三棱柱", "正三棱锥", "正四棱锥", "正四面体",
                      "四面体", "三棱柱", "三棱锥", "圆柱", "圆锥", "球", "组合体", "其他"]:
        if geo_type not in by_geo:
            continue
        group = by_geo[geo_type]
        group.sort(key=lambda c: -c["scores"]["total"])

        lines.append(f"\n## {geo_type}（{len(group)} 个构型）\n")
        lines.append("| # | config_id | 描述 | 频率 | 总分 | 推荐 |")
        lines.append("|---|-----------|------|------|------|------|")

        for i, c in enumerate(group, 1):
            score = c["scores"]["total"]
            recommend = "✅" if score >= 2.5 else "⬜"
            lines.append(
                f"| {i} | `{c.get('config_id', 'N/A')}` | {c.get('canonical_description', '')} "
                f"| {c.get('frequency', 0)} | {score} | {recommend} |"
            )

    # 处理遗漏的类型
    listed_types = {"正方体", "长方体", "正三棱柱", "正三棱锥", "正四棱锥", "正四面体",
                    "四面体", "三棱柱", "三棱锥", "圆柱", "圆锥", "球", "组合体", "其他"}
    for geo_type, group in by_geo.items():
        if geo_type not in listed_types:
            group.sort(key=lambda c: -c["scores"]["total"])
            lines.append(f"\n## {geo_type}（{len(group)} 个构型）\n")
            lines.append("| # | config_id | 描述 | 频率 | 总分 | 推荐 |")
            lines.append("|---|-----------|------|------|------|------|")
            for i, c in enumerate(group, 1):
                score = c["scores"]["total"]
                recommend = "✅" if score >= 2.5 else "⬜"
                lines.append(
                    f"| {i} | `{c.get('config_id', 'N/A')}` | {c.get('canonical_description', '')} "
                    f"| {c.get('frequency', 0)} | {score} | {recommend} |"
                )

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_LIST_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ═══════════════════════════════════════════════════════════════
# Step 4: 生成产出物
# ═══════════════════════════════════════════════════════════════

def generate_outputs():
    """Step 4: 生成 meta 建议、测试集、DSL 参考"""
    if not MERGED_FILE.exists():
        print(f"错误: 请先运行 merge 命令生成 {MERGED_FILE}")
        sys.exit(1)

    if not EXTRACTED_FILE.exists():
        print(f"错误: 缺少提取结果 {EXTRACTED_FILE}")
        sys.exit(1)

    # 读取数据
    with open(MERGED_FILE, "r", encoding="utf-8") as f:
        configs = json.load(f)

    extracted = []
    with open(EXTRACTED_FILE, "r", encoding="utf-8") as f:
        for line in f:
            extracted.append(json.loads(line))

    # 建立 question_id → extracted 索引
    extracted_map = {r["question_id"]: r for r in extracted}

    # 只处理推荐构型（总分 >= 2.5）
    recommended = [c for c in configs if c.get("scores", {}).get("total", 0) >= 2.5]
    print(f"推荐构型: {len(recommended)}")

    # ── 4.1 Meta 建议 ──
    _generate_meta_suggestions(recommended, extracted_map)

    # ── 4.2 测试集 ──
    _generate_test_queries(recommended, extracted_map)

    # ── 4.3 DSL 参考 ──
    _generate_dsl_hints(recommended, extracted_map)

    print(f"\n═══ Step 4 完成 ═══")
    print(f"  meta 建议: {META_SUGGESTIONS_FILE}")
    print(f"  测试集: {TEST_QUERIES_FILE}")
    print(f"  DSL 参考: {DSL_HINTS_FILE}")


def _generate_meta_suggestions(configs, extracted_map):
    """生成 meta 建议表"""
    lines = [
        "# Meta 建议表\n",
        "> 基于真题数据自动生成，需人工审核后合入 meta.ts\n",
    ]

    from collections import Counter

    for c in configs:
        cid = c.get("config_id", "unknown")
        desc = c.get("canonical_description", "")
        geo = c.get("geometry_type", "")

        # 从关联题目收集 tags
        all_tags = []
        all_methods = []
        all_difficulties = []
        for qid in c.get("question_ids", []):
            r = extracted_map.get(qid)
            if r:
                all_tags.extend(r.get("key_elements", []))
                if r.get("method"):
                    all_methods.append(r["method"])
                if r.get("difficulty_signal"):
                    all_difficulties.append(r["difficulty_signal"])

        # 高频 tags
        tag_counts = Counter(all_tags)
        top_tags = [t for t, _ in tag_counts.most_common(8)]

        # 难度多数投票
        if all_difficulties:
            difficulty = Counter(all_difficulties).most_common(1)[0][0]
        else:
            difficulty = "中等"

        lines.append(f"## {cid}\n")
        lines.append(f"- **title**: {geo} — {desc}")
        lines.append(f"- **description**: {desc}")
        lines.append(f"- **tags**: `{json.dumps(top_tags, ensure_ascii=False)}`")
        lines.append(f"- **difficulty**: {difficulty}")
        lines.append(f"- **frequency**: {c.get('frequency', 0)}")
        lines.append("")

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(META_SUGGESTIONS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(f"  meta 建议: {len(configs)} 个构型")


def _generate_test_queries(configs, extracted_map):
    """生成推荐测试集"""
    queries = []

    for c in configs:
        cid = c.get("config_id", "unknown")

        # 从关联题目取用户查询变体
        for qid in c.get("question_ids", [])[:2]:
            r = extracted_map.get(qid)
            if not r:
                continue

            # 完整题目作为 full_question 类型
            # 从原始过滤数据中找题目 content
            queries.append({
                "query": r.get("user_query_variants", [""])[0] if r.get("user_query_variants") else "",
                "expected_config_id": cid,
                "source": qid,
                "query_type": "short_query",
            })

            # 额外变体
            variants = r.get("user_query_variants", [])
            for v in variants[1:2]:
                queries.append({
                    "query": v,
                    "expected_config_id": cid,
                    "source": "synthetic",
                    "query_type": "keyword",
                })

    # 去重（相同 query 去重）
    seen = set()
    unique_queries = []
    for q in queries:
        if q["query"] and q["query"] not in seen:
            seen.add(q["query"])
            unique_queries.append(q)

    with open(TEST_QUERIES_FILE, "w", encoding="utf-8") as f:
        for q in unique_queries:
            f.write(json.dumps(q, ensure_ascii=False) + "\n")

    print(f"  测试集: {len(unique_queries)} 条查询")


def _generate_dsl_hints(configs, extracted_map):
    """生成 DSL 指令参考"""
    lines = [
        "# DSL 指令编写参考\n",
        "> 从真题辅助构造中提炼，编写 DSL 指令时参考\n",
    ]

    from collections import Counter

    for c in configs:
        cid = c.get("config_id", "unknown")
        desc = c.get("canonical_description", "")
        geo = c.get("geometry_type", "")

        # 收集辅助构造
        all_constructions = []
        all_elements = []
        task_type = c.get("task_type", "")
        for qid in c.get("question_ids", []):
            r = extracted_map.get(qid)
            if r:
                all_constructions.extend(r.get("auxiliary_constructions", []))
                all_elements.extend(r.get("key_elements", []))
                if not task_type:
                    task_type = r.get("task_type", "")

        # 去重
        constructions = list(dict.fromkeys(all_constructions))
        elements = list(dict.fromkeys(all_elements))

        # 推断需要的 DSL 元素
        dsl_elements = []
        for con in constructions:
            if "中点" in con:
                dsl_elements.append("midpoint")
            if "截面" in con or "平面" in con:
                dsl_elements.append("face (crossSection)")
            if "辅助线" in con or "连" in con:
                dsl_elements.append("segment")
            if "建系" in con or "坐标" in con:
                dsl_elements.append("coordinateSystem")
            if "垂线" in con or "垂足" in con:
                dsl_elements.append("free_point (foot of perpendicular)")

        if "二面角" in task_type or "二面角" in str(elements):
            dsl_elements.append("dihedral_angle")
        if "线面角" in task_type:
            dsl_elements.append("line_face_angle")
        if "异面" in task_type:
            dsl_elements.append("line_line_angle")
        if "距离" in task_type or "距离" in str(elements):
            dsl_elements.append("point_face_distance / line_line_distance")
        if "外接球" in task_type or "外接球" in str(elements):
            dsl_elements.append("circumSphere")

        dsl_elements = list(dict.fromkeys(dsl_elements))

        lines.append(f"## {cid}")
        lines.append(f"构型：{desc}")
        lines.append(f"几何体：{geo}")
        lines.append(f"辅助构造：{', '.join(constructions[:5]) if constructions else '无'}")
        lines.append(f"需要的 DSL 元素：")
        for elem in dsl_elements:
            lines.append(f"- {elem}")
        lines.append("")

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(DSL_HINTS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ═══════════════════════════════════════════════════════════════
# Step 5: 自动生成 DSL 指令 + 编译验证
# ═══════════════════════════════════════════════════════════════

# 中文几何体类型 → DSL geometry type + 默认 params
GEO_TYPE_MAP = {
    "正方体": {"type": "cube", "params": {"sideLength": 2}},
    "长方体": {"type": "cuboid", "params": {"length": 4, "width": 3, "height": 2}},
    "正四棱锥": {"type": "pyramid", "params": {"sides": 4, "sideLength": 2, "height": 2}},
    "正三棱锥": {"type": "pyramid", "params": {"sides": 3, "sideLength": 2, "height": 2}},
    "四棱锥": {"type": "pyramid", "params": {"sides": 4, "sideLength": 2, "height": 2}},
    "三棱锥": {"type": "pyramid", "params": {"sides": 3, "sideLength": 2, "height": 2}},
    "正三棱柱": {"type": "prism", "params": {"sides": 3, "sideLength": 2, "height": 2}},
    "三棱柱": {"type": "prism", "params": {"sides": 3, "sideLength": 2, "height": 2}},
    "直三棱柱": {"type": "prism", "params": {"sides": 3, "sideLength": 2, "height": 2}},
    "正四棱柱": {"type": "prism", "params": {"sides": 4, "sideLength": 2, "height": 2}},
    "直四棱柱": {"type": "prism", "params": {"sides": 4, "sideLength": 2, "height": 2}},
    "正四面体": {"type": "regularTetrahedron", "params": {"sideLength": 2}},
    "四面体": {"type": "cornerTetrahedron", "params": {"edgeA": 2, "edgeB": 2, "edgeC": 2}},
    "圆柱": {"type": "cylinder", "params": {"radius": 1, "height": 2}},
    "圆锥": {"type": "cone", "params": {"radius": 1, "height": 2}},
    "球": {"type": "sphere", "params": {"radius": 2}},
}

COMPILE_SYSTEM_PROMPT = """你是一个立体几何 DSL 指令生成专家。你的任务是根据一道具体的真题，生成可编译的 SceneInstruction JSON。

## DSL 指令格式

```typescript
interface SceneInstruction {
  id: string;                          // 作品ID
  geometry: {
    type: GeometryType;                // 几何体类型
    params: Record<string, number>;    // 参数
  };
  constructions?: Construction[];      // 有序构造步骤
  measurements?: Measurement[];        // 度量声明
  coordinateSystem?: { origin: string; mode?: 'auto' | 'upZ'; xDirection?: [string, string] };
  circumSphere?: boolean;
}
```

## 可用的构造步骤类型

1. **midpoint** - 取两点中点
   `{ "type": "midpoint", "label": "M", "of": ["A", "B"] }`

2. **edge_point** - 棱上任意比例点（t=0~1, 0.5=中点）
   `{ "type": "edge_point", "label": "E", "edge": ["A", "B"], "t": 0.333 }`

3. **free_point** - 自由点（绝对坐标）
   `{ "type": "free_point", "label": "H", "position": [1, 0, 1] }`

4. **centroid** - 多点质心
   `{ "type": "centroid", "label": "O", "of": ["A", "B", "C", "D"] }`

5. **segment** - 线段
   `{ "type": "segment", "from": "A", "to": "B₁", "color": "#e74c3c", "dashed": true }`

6. **face** - 面/截面
   `{ "type": "face", "label": "sec1", "points": ["M", "N", "P"], "style": "crossSection" }`

## 可用的度量类型

1. **dihedral_angle** - 二面角（face1/face2 是面引用，可以是内置面名如"底面"、构造面标签、或顶点数组）
   `{ "kind": "dihedral_angle", "face1": "底面", "face2": ["A", "B", "P"], "edge": ["A", "B"] }`

2. **line_face_angle** - 线面角
   `{ "kind": "line_face_angle", "line": ["A", "C₁"], "face": "底面" }`

3. **line_line_angle** - 异面直线所成角
   `{ "kind": "line_line_angle", "line1": ["A", "C₁"], "line2": ["B", "D"] }`

4. **point_face_distance** - 点面距
   `{ "kind": "point_face_distance", "point": "A", "face": "底面" }`
   `{ "kind": "point_face_distance", "point": "C", "face": "triABD" }`  (自定义面用标签)

5. **line_line_distance** - 异面距离
   `{ "kind": "line_line_distance", "line1": ["A", "B₁"], "line2": ["C", "D₁"] }`

## 重要规则

1. **只引用存在的标签**：内置顶点标签和前面构造步骤创建的标签
2. **线段引用必须存在**：度量中引用的线 ["A","B"] 必须是内置棱或前面已构造的 segment
3. **自定义面的度量**：如果要对自定义面做度量，必须先用 face 构造创建它并给 label
4. **构造顺序**：midpoint/edge_point 引用的端点必须在之前已创建
5. **颜色规范**：辅助线用 #e74c3c（红）或 #3498db（蓝），虚线用于不可见的辅助线
6. **不要构造已有的内置棱**：如正方体的 AB 棱已存在，不要再添加 segment "A"-"B"

## 输出

只输出一个 JSON 对象，用 ```json ``` 包裹。不要输出其他内容。"""


def _select_representative_question(cfg, extracted_map, questions_map, used_qids):
    """为构型选一道代表题：优先有解析、content 最长、未使用过的"""
    candidates = []
    for qid in cfg.get("question_ids", []):
        if qid in used_qids:
            continue
        q = questions_map.get(qid)
        ext = extracted_map.get(qid)
        if not q or not ext:
            continue
        has_analysis = bool(q.get("analysis"))
        content_len = len(q.get("content", ""))
        # 优先有解析的、内容长的
        score = (1000 if has_analysis else 0) + content_len
        candidates.append((score, qid, q, ext))

    if not candidates:
        return None, None, None

    candidates.sort(key=lambda x: -x[0])
    _, qid, q, ext = candidates[0]
    return qid, q, ext


def _build_compile_prompt(cfg, question, extracted, geo_info, env_hint):
    """构建让 LLM 生成 DSL 指令的 prompt"""
    content = question.get("content", "")
    analysis = question.get("analysis", "") or ""
    config_id = cfg.get("config_id", "unknown")

    prompt = f"""## 任务

为以下真题生成一个 SceneInstruction JSON 指令。

## 作品 ID
{config_id}

## 几何体信息
类型: {geo_info["type"]}
参数: {json.dumps(geo_info["params"])}

## 几何体环境（可用的内置标签）
{env_hint}

## 原题
{content}

## 解析
{analysis[:800] if analysis else "无解析"}

## 提取的关键信息
- 任务类型: {extracted.get("task_type", "?")}
- 关键元素: {json.dumps(extracted.get("key_elements", []), ensure_ascii=False)}
- 辅助构造: {json.dumps(extracted.get("auxiliary_constructions", []), ensure_ascii=False)}

## 要求

1. 根据原题中的具体几何条件（取哪些中点、连哪些线、构造什么截面）生成 constructions
2. 根据原题要求（求什么角、什么距离）生成 measurements
3. 如果原题用到坐标法，可以加 coordinateSystem
4. 确保所有标签引用正确
5. 只输出一个 JSON 对象"""

    return prompt


def compile_instructions():
    """Step 5: 自动生成 DSL 指令 + 编译验证"""
    import subprocess

    if not MERGED_FILE.exists():
        print(f"错误: 请先运行 merge 命令")
        sys.exit(1)

    # 读取数据
    with open(MERGED_FILE, "r", encoding="utf-8") as f:
        configs = json.load(f)

    extracted_map = {}
    with open(EXTRACTED_FILE, "r", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            extracted_map[r["question_id"]] = r

    questions_map = {}
    with open(FILTERED_FILE, "r", encoding="utf-8") as f:
        for line in f:
            q = json.loads(line)
            questions_map[q["id"]] = q

    # 读取已有的编译日志（断点续传）
    compile_log = {}
    if COMPILE_LOG_FILE.exists():
        with open(COMPILE_LOG_FILE, "r", encoding="utf-8") as f:
            compile_log = json.load(f)

    used_qids = set(v["representative_question_id"] for v in compile_log.values()
                     if v.get("compile_success"))

    # 筛选：推荐 + DSL 支持的几何体
    recommended = [c for c in configs if c.get("scores", {}).get("total", 0) >= 2.5]
    compilable = []
    for c in recommended:
        geo_cn = c.get("geometry_type", "")
        if geo_cn in GEO_TYPE_MAP:
            compilable.append(c)

    # 排除已成功编译的
    todo = [c for c in compilable if c["config_id"] not in compile_log
            or not compile_log[c["config_id"]].get("compile_success")]

    print(f"推荐构型: {len(recommended)}")
    print(f"DSL 可支持: {len(compilable)}")
    print(f"已编译成功: {len(compilable) - len(todo)}")
    print(f"待编译: {len(todo)}")

    if not todo:
        print("所有构型已编译完成！")
        return

    # 初始化 LLM
    config = load_claude_config()
    import anthropic
    client = anthropic.Anthropic(
        base_url=config["ANTHROPIC_BASE_URL"],
        api_key=config["ANTHROPIC_AUTH_TOKEN"],
    )

    # 读取已有指令（追加模式）
    existing_instructions = []
    if INSTRUCTIONS_FILE.exists():
        with open(INSTRUCTIONS_FILE, "r", encoding="utf-8") as f:
            existing_instructions = json.load(f)

    instructions_by_id = {inst["id"]: inst for inst in existing_instructions}

    success = 0
    failed = 0

    print(f"\n═══ 开始生成 DSL 指令（{len(todo)} 个构型）═══\n")

    for idx, cfg in enumerate(todo):
        config_id = cfg["config_id"]
        geo_cn = cfg["geometry_type"]
        geo_info = GEO_TYPE_MAP[geo_cn]

        # 选代表题
        rep_qid, question, ext = _select_representative_question(
            cfg, extracted_map, questions_map, used_qids
        )

        if not rep_qid:
            print(f"  ✗ {config_id}: 无可用代表题")
            compile_log[config_id] = {
                "representative_question_id": None,
                "compile_success": False,
                "error": "no_representative_question",
            }
            failed += 1
            continue

        # 构建 geometry env hint
        env_hint = _get_env_hint(geo_info)

        # 构建 prompt
        user_prompt = _build_compile_prompt(cfg, question, ext, geo_info, env_hint)

        print(f"  [{idx+1}/{len(todo)}] {config_id} (题目: {rep_qid})...")

        # 调 LLM 生成指令（最多重试 2 次）
        instruction = None
        compile_error = None

        for attempt in range(3):
            try:
                if attempt == 0:
                    messages = [{"role": "user", "content": user_prompt}]
                else:
                    # 重试：把编译错误反馈给 LLM
                    messages = [
                        {"role": "user", "content": user_prompt},
                        {"role": "assistant", "content": f"```json\n{json.dumps(instruction, ensure_ascii=False, indent=2)}\n```"},
                        {"role": "user", "content": f"编译失败，错误信息：{compile_error}\n\n请修正 JSON 后重新输出。只输出修正后的 JSON，用 ```json ``` 包裹。"},
                    ]

                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    system=COMPILE_SYSTEM_PROMPT,
                    messages=messages,
                )

                resp_text = response.content[0].text
                parsed = parse_extraction_response(resp_text)
                if not parsed:
                    compile_error = "LLM 返回无法解析的 JSON"
                    continue

                instruction = parsed[0]
                # 确保 id 和 geometry 正确
                instruction["id"] = config_id
                instruction["geometry"] = {"type": geo_info["type"], "params": geo_info["params"]}

                # 编译验证
                compile_error = _try_compile(instruction)
                if compile_error is None:
                    break  # 编译成功

            except Exception as e:
                compile_error = str(e)

            time.sleep(1)

        if compile_error is None:
            # 成功
            instructions_by_id[config_id] = instruction
            used_qids.add(rep_qid)
            compile_log[config_id] = {
                "representative_question_id": rep_qid,
                "compile_success": True,
                "retries": attempt,
            }
            success += 1
            print(f"    ✓ 成功 (重试{attempt}次)")
        else:
            compile_log[config_id] = {
                "representative_question_id": rep_qid,
                "compile_success": False,
                "error": compile_error,
                "retries": attempt,
            }
            failed += 1
            print(f"    ✗ 失败: {compile_error[:80]}")

        # 每 5 个保存一次（防丢失）
        if (idx + 1) % 5 == 0:
            _save_compile_results(instructions_by_id, compile_log)

        time.sleep(2)

    # 最终保存
    _save_compile_results(instructions_by_id, compile_log)

    print(f"\n═══ 编译完成 ═══")
    print(f"成功: {success}, 失败: {failed}")
    print(f"指令文件: {INSTRUCTIONS_FILE}")
    print(f"编译日志: {COMPILE_LOG_FILE}")


def _get_env_hint(geo_info):
    """获取几何体环境的文字描述（给 LLM 参考）"""
    # 通过调用 TypeScript 获取 env 太重，这里用 Python 硬编码关键信息
    t = geo_info["type"]
    p = geo_info["params"]

    if t == "cube":
        return f"""正方体 ABCD-A₁B₁C₁D₁，棱长{p['sideLength']}
顶点: A, B, C, D, A₁, B₁, C₁, D₁ (A左前、B右前、C右后、D左后)
内置棱: AB, BC, CD, DA, A₁B₁, B₁C₁, C₁D₁, D₁A₁, AA₁, BB₁, CC₁, DD₁
内置面: 底面(ADCB), 顶面(A₁B₁C₁D₁), 前面(ABB₁A₁), 后面(CDD₁C₁), 左面(DAA₁D₁), 右面(BCC₁B₁)"""

    elif t == "cuboid":
        return f"""长方体 ABCD-A₁B₁C₁D₁，长{p['length']}(AB)、宽{p['width']}(AD)、高{p['height']}(AA₁)
顶点: A, B, C, D, A₁, B₁, C₁, D₁
内置棱: AB, BC, CD, DA, A₁B₁, B₁C₁, C₁D₁, D₁A₁, AA₁, BB₁, CC₁, DD₁
内置面: 底面(ADCB), 顶面(A₁B₁C₁D₁), 前面(ABB₁A₁), 后面(CDD₁C₁), 左面(DAA₁D₁), 右面(BCC₁B₁)"""

    elif t == "pyramid":
        n = p["sides"]
        labels = list("ABCDEFGH"[:n])
        return f"""正{n}棱锥 {(''.join(labels))}-P，底面边长{p['sideLength']}，高{p['height']}
顶点: {', '.join(labels)}, P (P是顶点)
内置棱: {', '.join(f'{labels[i]}{labels[(i+1)%n]}' for i in range(n))} (底边), {', '.join(f'{l}P' for l in labels)} (侧棱)
内置面: 底面({(''.join(reversed(labels)))}), {''.join(f'面{labels[i]}{labels[(i+1)%n]}P' + (', ' if i < n-1 else '') for i in range(n))}"""

    elif t == "prism":
        n = p["sides"]
        bottom = list("ABCDEFGH"[:n])
        top = [l + "₁" for l in bottom]
        return f"""正{n}棱柱 {''.join(bottom)}-{''.join(top)}，底面边长{p['sideLength']}，高{p['height']}
顶点: {', '.join(bottom)}, {', '.join(top)}
内置棱: {', '.join(f'{bottom[i]}{bottom[(i+1)%n]}' for i in range(n))} (底边), {', '.join(f'{top[i]}{top[(i+1)%n]}' for i in range(n))} (顶边), {', '.join(f'{bottom[i]}{top[i]}' for i in range(n))} (侧棱)
内置面: 底面, 顶面, 以及 {n} 个侧面"""

    elif t == "regularTetrahedron":
        return f"""正四面体 ABCD，棱长{p['sideLength']}
顶点: A, B, C, D (底面ABC，顶点D)
内置棱: AB, BC, CA, AD, BD, CD
内置面: 底面(CBA), 面ABD, 面BCD, 面CAD"""

    elif t == "cornerTetrahedron":
        return f"""墙角四面体 OABC，三条直角棱 OA={p['edgeA']}, OB={p['edgeB']}, OC={p['edgeC']}，两两垂直
顶点: O, A, B, C (O是直角顶点)
内置棱: OA, OB, OC, AB, BC, CA
内置面: 底面(ABC), 面OAB, 面OBC, 面OCA"""

    else:
        return f"几何体类型: {t}, 参数: {json.dumps(p)}"


def _try_compile(instruction):
    """尝试编译指令，返回 None 表示成功，返回错误信息字符串表示失败"""
    import subprocess
    import tempfile

    # 写临时文件
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump([instruction], f, ensure_ascii=False, indent=2)
        tmp_path = f.name

    try:
        # 调用 compile-pilot.ts 的逻辑（写一个专用的单指令编译脚本）
        compile_script = f"""
import {{ readFileSync }} from 'fs';
import {{ compileInstruction }} from '{PROJECT_ROOT}/scripts/dsl/compiler';
const inst = JSON.parse(readFileSync('{tmp_path}', 'utf-8'))[0];
try {{
  const {{ snapshot }} = compileInstruction(inst);
  const entities = Object.values(snapshot.entities);
  const counts: Record<string, number> = {{}};
  for (const e of entities as Array<{{type: string}}>) {{ counts[e.type] = (counts[e.type] || 0) + 1; }}
  console.log(JSON.stringify({{ success: true, counts }}));
}} catch (err: unknown) {{
  const msg = err instanceof Error ? err.message : String(err);
  console.log(JSON.stringify({{ success: false, error: msg }}));
}}
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ts", delete=False, encoding="utf-8") as sf:
            sf.write(compile_script)
            script_path = sf.name

        result = subprocess.run(
            ["npx", "tsx", script_path],
            capture_output=True, text=True, timeout=30,
            cwd=str(PROJECT_ROOT),
        )

        os.unlink(script_path)
        os.unlink(tmp_path)

        if result.returncode != 0:
            stderr = result.stderr.strip()
            return f"编译进程错误: {stderr[:200]}"

        output = result.stdout.strip()
        if not output:
            return "编译无输出"

        # 可能有多行输出，取最后一行 JSON
        lines = output.strip().split("\n")
        for line in reversed(lines):
            line = line.strip()
            if line.startswith("{"):
                data = json.loads(line)
                if data.get("success"):
                    return None  # 成功
                else:
                    return data.get("error", "未知编译错误")

        return f"编译输出无法解析: {output[:200]}"

    except subprocess.TimeoutExpired:
        return "编译超时"
    except Exception as e:
        return str(e)


def _save_compile_results(instructions_by_id, compile_log):
    """保存指令文件和编译日志"""
    instructions_list = list(instructions_by_id.values())
    with open(INSTRUCTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(instructions_list, f, ensure_ascii=False, indent=2)

    with open(COMPILE_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(compile_log, f, ensure_ascii=False, indent=2)


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

COMMANDS = {
    "filter": filter_questions,
    "extract": extract_configs,
    "merge": merge_configs,
    "generate": generate_outputs,
    "compile": compile_instructions,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"用法: python {sys.argv[0]} <command>")
        print(f"可用命令: {', '.join(COMMANDS.keys())}")
        sys.exit(1)

    COMMANDS[sys.argv[1]]()


if __name__ == "__main__":
    main()
