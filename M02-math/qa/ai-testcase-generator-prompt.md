# AI Testcase Generator Prompt

Use this file when you want AI to generate a user-specific testing checklist and detailed cases.

## What This Prompt Is For

Use it when:

- the target user is specific
- the classroom or self-study context matters
- you need edge cases beyond the default regression list
- you want AI to suggest likely bug hotspots and usability risks

Do not use it as a replacement for real manual testing. Use it to expand coverage and prioritize effort.

## Product Context Summary

Give AI this product summary before the user profile.

```text
这是一个高中数学交互式可视化产品，包含三个模块：
1. M02 函数图形实验室：表达式输入、参数变换、特征点、导数、切线、分段函数、动画、视窗控制。
2. M03 解析几何画板：圆锥曲线、直线、交点、焦点准线、离心率、隐式曲线、动点与轨迹、光学反射。
3. M04 三角函数演示台：单位圆、三角函数图像联动、五点法、辅助角公式、三角形解算、特殊值表。

请从真实用户任务出发，而不是只检查控件是否存在。重点关注：
- 首次使用是否容易上手
- 输入错误后是否容易恢复
- 用户是否能理解当前模式和当前选中对象
- 课堂演示时是否会卡住、迷失、或产生误解
- 哪些地方虽然 technically correct，但从用户视角依然复杂或费劲
```

## User Profile Template

Fill this in before sending to AI.

```json
{
  "module": "m02",
  "persona": "高中数学老师",
  "experienceLevel": "low",
  "device": "laptop + projector",
  "usageContext": "45分钟课堂演示",
  "timePressure": "high",
  "topTasks": [
    "快速画出函数并讲解平移伸缩",
    "演示导数和切线",
    "出错后快速恢复"
  ],
  "habits": [
    "喜欢直接输入自然表达式而不是严格语法",
    "不喜欢层级太深的设置",
    "更依赖可见按钮而不是快捷键"
  ],
  "knownPainPoints": [
    "图像消失后不知道怎么找回",
    "不确定当前编辑的是哪条函数"
  ],
  "mustNotFail": [
    "核心图像必须立刻出现",
    "撤销和重做必须可靠",
    "课堂中不能因为模式混乱卡住"
  ]
}
```

## Copyable Prompt

```text
你现在是这个数学可视化产品的资深产品 QA 和教学体验设计师。

我会给你产品背景和用户画像。你不要只做技术正确性测试，而要从真实用户视角设计测试。

你的任务：
1. 先总结该用户最关键的 5 个使用目标。
2. 生成一份按优先级排序的测试清单。
3. 为最高优先级场景写出详细测试用例。
4. 额外指出最可能出现的 bug、可用性问题、复杂度问题、恢复问题。
5. 对每个高风险问题给出修复建议方向。

输出要求：
1. 明确写出你的用户假设和风险假设。
2. 优先覆盖首次使用、出错恢复、模式理解、状态可见性、课堂演示流畅性。
3. 测试清单按 P0 / P1 / P2 分类。
4. 每条测试用例必须包含：
   - 用例 ID
   - 测试目标
   - 前置条件
   - 操作步骤
   - 期望结果
   - 如果失败，对用户的伤害
   - 问题类型：bug / usability / complexity / recovery
5. 不要只写 happy path，必须包含误操作、极端输入、切换场景和恢复场景。
6. 如果你认为某个模块本身信息架构过重，请直接指出，并解释用户为什么会觉得复杂。

最后追加一个“建议优先修复清单”，只列最值得先修的 5 项。
```

## Recommended Output Format

Ask AI to follow this structure.

```text
一、用户关键目标

二、测试范围与风险假设

三、优先级测试清单
| Priority | ID | Scenario | Why It Matters | Risk Type |

四、详细测试用例
| ID | Goal | Preconditions | Steps | Expected | User Impact if Failed | Type |

五、复杂度与易用性观察

六、建议优先修复清单
```

## Prompt Add-Ons

Use one of these add-ons when needed.

### Add-On: First-Time User

```text
请把“第一次打开产品、没有读过说明文档”的路径单独加粗分析。
如果一个任务需要用户先理解太多概念，直接判为复杂度风险。
```

### Add-On: Classroom Demo

```text
请额外检查：老师在 2 到 3 分钟内能否完成关键演示。
任何会导致老师停下来寻找按钮、怀疑当前状态、或无法快速恢复的点，都应提高优先级。
```

### Add-On: Student Self-Study

```text
请额外检查：没有老师解释时，界面是否足以让学生自己猜对下一步。
如果只是“功能存在但不易理解”，也要算问题。
```

## Good Review Standard

AI output is useful only if it does all of the following:

- focuses on user tasks instead of only UI controls
- distinguishes bug risk from usability burden
- includes recovery paths and wrong-input cases
- explains why a problem hurts the user
- gives fix directions, not just problem statements
