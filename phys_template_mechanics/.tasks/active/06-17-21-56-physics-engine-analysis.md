# 06-17-21-56 物理引擎分析

## 用户原文
分析下本项目用的物理引擎是啥

## 任务评估
- 任务类型：简单任务 / 代码结构分析
- 复杂度等级：简单
- 风险等级：L0
- 流程路径：MODE 0 -> MODE 1 -> MODE 6
- 强制门禁：只读分析，无业务代码修改；跳过回归命令

## 查阅证据
- `.knowledge/INDEX.md`
- `.knowledge/architecture.md`
- `.knowledge/pitfalls.md`
- `.tasks/task_evaluation_framework.md`
- `package.json`
- `src/engine/PhysicsBridge.ts`
- `src/engine/sceneSync.ts`
- `src/engine/ForceCollector.ts`

## 初步结论
项目核心物理引擎是 `planck-js`，通过 `src/engine/PhysicsBridge.ts` 封装为内部桥接层，并由 `sceneSync.ts` 将业务场景模型同步成 Planck World、Body、Shape、Joint。
