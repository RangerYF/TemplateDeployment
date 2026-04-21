# 阶段1：重写生成脚本 + 产出正确的作品数据

## 目标

所有预置作品的 scene_data 包含正确的实体（含度量实体），在编辑器中加载后角度弧线、距离标注、坐标系等全部正确渲染。

## 已完成的工作

### 基础设施（可复用）
- `src/data/projects/types.ts` — ProjectMeta + SceneSnapshot 类型定义 ✅
- `src/data/projects/index.ts` — 注册表（getAllProjectMetas / loadSceneData / filterProjects）✅
- `src/data/projects/math/m01/meta.ts` — 53 个作品 meta（需清理 S11/S12）
- `src/data/projects/math/m01/scenes/*.json` — 53 个场景 JSON（大部分需重新生成）
- `scripts/generate-scenes.ts` — 生成脚本（需重写）

### 作品库 DEV UI（可复用）
- 工作台左侧"作品库 DEV"菜单 ✅
- 按几何体分组 + 难度筛选 + 复制 ID + 点击加载到编辑器 ✅

## 当前问题

### 问题1：度量实体缺失
angleMeasurement 和 distanceMeasurement 实体需要预计算精确值（angleRadians/angleLatex/angleDegrees 或 distanceValue/distanceLatex/distanceApprox），当前生成脚本未调用 calculator 函数，导致 S05~S09 场景只画了辅助线，没有真正的度量实体。

**正确做法**：EntityBuilder 需要：
1. 保存 builder 输出的顶点坐标（Vec3[]）
2. 提供方法通过 label/vertexIndex 查找顶点坐标
3. 调用 `calculateDihedralAngle()` / `calculateLineFaceAngle()` / `calculateLineLineAngle()` 预计算角度
4. 调用 `calculatePointFaceDistance()` / `calculateLineLineDistance()` 预计算距离
5. 创建包含预计算值的度量实体

### 问题2：度量实体的 entityIds 引用
- angleMeasurement 的 entityIds 引用的是 **face 实体 ID** 或 **segment 实体 ID**（不是 point）
  - dihedral: `[faceId1, faceId2]` — 两个相邻面
  - lineFace: `[segmentId, faceId]` — 线段和面
  - lineLine: `[segmentId1, segmentId2]` — 两条线段
- distanceMeasurement 的 entityIds 引用的是 **point/segment/face 实体 ID**
  - pointFace: `[pointId, faceId]`
  - lineLine: `[segmentId1, segmentId2]`
- EntityBuilder 需要提供按 faceIndex / 端点对 查找实体 ID 的方法

### 问题3：截面实体结构
crossSection 不是独立实体类型，而是 face 实体的一种 source：
```typescript
{
  type: 'face',
  properties: {
    builtIn: false,
    geometryId: string,
    pointIds: string[],         // 截面多边形所有顶点 ID
    source: {
      type: 'crossSection',
      definingPointIds: string[] // 定义截面的原始点 ID
    }
  }
}
```
截面的顶点可能是：
- 已有顶点（vertex 约束）
- 棱上新取的点（edge 约束）

### 问题4：不需要的作品类型
- S11（展开图）：展开图是辅助功能面板的能力，不需要单独作品
- S12（三视图）：三视图同理
- 需从 meta.ts 中删除这 8 个条目，从 scenes/ 中删除对应 JSON

## 各场景类型的正确实体组成

| 场景 | 基础实体 | 额外实体 | calculator 依赖 |
|------|---------|---------|----------------|
| S01 基础 | geometry + points + segments + faces | 无 | 无 |
| S02 对角线 | 同上 | segment(builtIn=false) | 无 |
| S03 外接球 | 同上 | circumSphere | 无（渲染时自动算） |
| S04 截面 | 同上 | point(edge约束) + face(crossSection) | 无（截面几何需手动计算顶点） |
| S05 二面角 | 同上 | angleMeasurement(dihedral) | calculateDihedralAngle |
| S06 线面角 | 同上 | angleMeasurement(lineFace) | calculateLineFaceAngle |
| S07 异面角 | 同上 | angleMeasurement(lineLine) | calculateLineLineAngle |
| S08 点面距 | 同上 | distanceMeasurement(pointFace) | calculatePointFaceDistance |
| S09 异面距离 | 同上 | distanceMeasurement(lineLine) | calculateLineLineDistance |
| S10 坐标系 | 同上 | coordinateSystem | buildCoordinateSystem（可选，渲染时可自动推断） |
| S13 中点连线 | 同上 | point(edge约束) + segment(builtIn=false) | 无 |

## 执行计划

### 步骤1：清理 meta 和 scenes
- 从 meta.ts 删除所有 sceneType 为 S11 和 S12 的条目
- 删除 scenes/ 目录中对应的 JSON 文件
- 预期：53 → 45 个作品

### 步骤2：重写 EntityBuilder 类
核心改造：
1. 保存 builderResult（含顶点坐标），提供 `getVertexPosition(vertexIndex)` 方法
2. 提供 `findFaceByIndex(faceIndex)` / `findSegmentByEndpoints(startLabel, endLabel)` 查找方法
3. 新增 `addAngleMeasurement(kind, entityIds, vertexPositions)` — 内部调用 angleCalculator
4. 新增 `addDistanceMeasurement(kind, entityIds, positions)` — 内部调用 distanceCalculator
5. 改进 `addCoordinateSystem()` — 调用 buildCoordinateSystem 预计算 axes

### 步骤3：按几何体逐个重写 enhance 函数
顺序：cube → cuboid → pyramid → prism → cylinder/cone/sphere → regTet
每完成一种几何体，在编辑器中加载验证。

### 步骤4：最终回归
- 运行 `pnpm lint && pnpm tsc --noEmit`
- 在作品库 DEV 中快速过一遍所有作品

## 关键参考文件

| 文件 | 用途 |
|------|------|
| `src/engine/math/angleCalculator.ts` | 角度预计算（导出 calculateDihedralAngle 等） |
| `src/engine/math/distanceCalculator.ts` | 距离预计算（导出 calculatePointPointDistance 等） |
| `src/engine/math/coordinates.ts` | 坐标系计算（导出 buildCoordinateSystem） |
| `src/engine/builders/index.ts` | buildGeometry 入口 |
| `src/engine/builders/cuboid.ts` | 顶点坐标定义（A=0,B=1,...D₁=7） |
| `src/engine/builders/pyramid.ts` | 棱锥顶点定义（底面 A~H, 顶点 P） |
| `src/editor/entities/types.ts` | 所有实体属性接口 |

## 进度

- [x] 步骤1：清理 S11/S12（删除 8 个条目 + JSON 文件，53→45）
- [x] 步骤2：重写 EntityBuilder（保存 builderResult、顶点/面/线段查找、度量方法）
- [x] 步骤3：逐几何体重写 enhance
  - [x] cube 系列（10 个：S01/S02/S03/S04/S05/S06/S07/S09/S10/S13）
  - [x] cuboid 系列（7 个：S01/S02/S03/S06/S07/S09/S10）
  - [x] pyramid4 系列（6 个：S01/S03/S05/S06/S08/S10）
  - [x] pyramid3 系列（5 个：S01/S03/S05/S08/S10）
  - [x] prism3 系列（8 个：S01/S02/S04/S05/S07/S09/S10/S13）
  - [x] cylinder/cone/sphere/regTet（9 个）
- [x] 步骤4：回归验证（pnpm lint ✅ / pnpm tsc --noEmit ✅）

### 度量值验证
| 场景 | 类型 | 结果 |
|------|------|------|
| cube-S05-1 | 二面角 | 90° |
| cube-S06-1 | 线面角 | arctan(√2/2) ≈ 35.26° |
| cube-S07-1 | 线线角 | 90° |
| cube-S09-1 | 异面距离 | 2 |
| pyramid4-S05-1 | 二面角 | arctan(3) ≈ 71.57° |
| pyramid4-S08-1 | 点面距 | 3 |
| prism3-S05-1 | 二面角 | 90° |
| prism3-S07-1 | 线线角 | 60° |
| regTet-S08-1 | 点面距 | 2√6/3 ≈ 1.633 |
