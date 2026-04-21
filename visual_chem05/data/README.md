# Unified Crystal Data

本目录为 C-05 统一晶体数据层。

## 设计原则

- 顶层字段对齐 `C-05 化学键与晶体结构查看器 — 晶体结构数据.md` 的字段命名与教学口径。
- `render` 段维护渲染必需的结构化字段，避免运行时再依赖 CIF 模式推断。
- `provenance` 段维护字段来源，用于生成字段来源对照文档。

## 文件结构

- `crystals/*.json`: 每个晶体一个 JSON。
- `crystal-manifest.json`: 列表索引。

## 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 编号 `CRY-XXX` |
| `name_cn` | `string` | 中文名 |
| `formula` | `string` | 化学式 |
| `level` | `string` | 学段 |
| `crystal_system` | `string` | 晶系（按 C-05 文档中文口径） |
| `space_group` | `string` | 空间群（含 No. 编号） |
| `lattice_params` | `object` | 晶胞参数 a, b, c (pm), α, β, γ (°) |
| `atoms` | `array` | 原子分数坐标与电荷信息 |
| `bond_type` | `string` | 教学展示主键类型 / 组合键类型 |
| `coord_number` | `string` | 配位数展示值 |
| `z` | `number` | 每晶胞化学式单位数 |
| `teaching_points` | `array` | 教学要点 |
| `key_parameters` | `array` | C-05 文档中各晶体额外参数行的结构化维护 |
| `render` | `object` | 渲染层字段 |
| `provenance` | `object` | 字段来源引用 |

## 统计

- 晶体总数: 21
- 覆盖 C-05 文档模型: 14
