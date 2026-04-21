# 阶段 1.2.1：场景构造指令 DSL 设计与实现

> **状态**：✅ 已完成（2026-03-19）
> **产出**：`scripts/dsl/`（types.ts, geometry-env.ts, compiler.ts, resolvers.ts, errors.ts, __tests__/compiler.test.ts）
> **验证**：23 个测试用例全通过 + pnpm lint + pnpm tsc --noEmit 通过

## 背景与动机

### 当前痛点

现有的 `scripts/generate-scenes.ts` 通过 TypeScript enhance 函数生成 scene_data，但反复出错：

1. **第一次重写**：度量实体缺失（没调 calculator）→ 重写 EntityBuilder
2. **第二次修复**：构型数据错误（cube-S09-1 线对标注错、平凡构型混入）→ 审查修复
3. **第三次推翻**：百科词条式场景混入 → 整个构型清单需要重做

**根因**：enhance 函数太底层——需要手动查顶点索引（A=0, B=1...）、face 索引（0=底面, 1=顶面...）、计算交线位置，写的人必须对引擎内部细节了如指掌。

### DSL 的价值

```
现在：人工查索引 → 写 TypeScript → 容易出错 → 调试修复
DSL后：写声明式指令 → 编译器翻译 → 引擎保证正确性
```

**DSL 不解决"写什么"的问题，但解决"写了之后能不能正确执行"的问题。**

### 后续依赖

1.2.2（从真题提取数据）完成后，每个构型需要生成 scene_data。用 DSL 可以：
- **降低出错率**：声明式指令比命令式代码更不容易写错
- **方便审核**：一眼能看出场景包含什么，而不用读 TypeScript 代码
- **未来可扩展**：v0.7 LLM 生成 scene_data 时，生成 DSL 指令比生成 JSON 更可靠

## 目标

设计并实现一套声明式指令系统，将其编译为 EntityBuilder 调用，最终产出 scene_data JSON。

**具体交付**：
1. 指令格式定义（TypeScript 类型）
2. 几何体环境注册表（`getGeometryEnv`）
3. 指令编译器（指令 → EntityBuilder 调用 → scene_data JSON）
4. 覆盖所有指令类型的测试用例
5. 更新 `scripts/generate-scenes.ts` 支持 DSL 指令输入

---

## 业界调研结论（2026-03-19）

### 第一轮调研：DSL 设计模式

覆盖 R3F、USD、glTF、OpenSCAD、CadQuery、GeoGebra、Manim、Asymptote 等方案。

关键发现：
1. **GeoGebra 最相关**：语义化命令系统（`Pyramid(A,B,C,D)`），增量构造模式
2. **CadQuery 是 LLM 生成 3D 的事实标准**：但面向机械 CAD，不适合教育几何
3. **JSON + Schema 是 LLM 输出的实用选择**：可直接用 Structured Outputs 约束解码
4. **强制 JSON 输出会降低 LLM 推理能力 10-15%**：v0.7 应采用两步法（先推理后格式化）
5. **有序构造步骤优于扁平声明**：更接近数学题目描述顺序，LLM 更易生成

### 第二轮调研：几何体环境信息方案

核心问题：几何体创建后自动生成内置元素（顶点/棱/面），LLM 写指令时如何知道可引用哪些标签？

调研覆盖 OpenAI Function Calling、Claude Tool Use、Cursor/Copilot 上下文注入、CadQuery/GeoGebra/Blender 的对象管理、JSON Schema 条件依赖等。

关键发现：
1. **业界主流**：schema 定义结构 + prompt 注入可用值，而非让输出自包含上下文
2. **动态枚举无法用 JSON Schema 优雅表达**：所有成熟系统都选择在 schema 之外提供上下文
3. **两步法显著优于一步法**：先确定几何体类型，再在有环境约束下生成构造指令
4. **核心原则**：确定性工作（列举几何体元素）交给系统，概率性工作（理解题意）交给 LLM

### 纳入的优化

1. **构造步骤语义**：用有序 `constructions` 数组替代分散的 `points/segments/faces`
2. **语义化引用**：面用顶点标签列表引用（`["A","B","C","D"]`），不用实体 ID
3. **内置面名称**：支持 `"底面"`、`"顶面"` 等中文名映射到 faceIndex
4. **高级构造语法糖**：`midpoint`、`centroid` 等语义化构造类型
5. **几何体环境注册表**：`getGeometryEnv()` 作为单一数据源，编译验证和 LLM prompt 注入共用

---

## 整体架构

### 三层分离

```
┌─────────────────────────────────────────────────────────────┐
│  几何体环境注册表（GeometryEnvRegistry）                       │
│  getGeometryEnv(type, params) → GeometryEnv                  │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ vertices: ['A','B','C','D','A₁','B₁','C₁','D₁']     │   │
│  │ edges: [['A','B'], ['B','C'], ...]                    │   │
│  │ faces: { '底面': ['A','D','C','B'], '顶面': [...] }   │   │
│  │ promptHint: '正方体ABCD-A₁B₁C₁D₁，棱长为...'         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  用途1：编译器验证标签有效性                                   │
│  用途2：v0.7 LLM prompt 注入可用标签                          │
│  用途3：人工编写指令时的参考                                   │
└─────────────────────────────────────────────────────────────┘
                        ↓ 提供环境
┌─────────────────────────────────────────────────────────────┐
│  指令（SceneInstruction）— 精简格式，不含 env                  │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ geometry: { type: 'cube', params: { sideLength: 2 } } │   │
│  │ constructions: [...]                                   │   │
│  │ measurements: [...]                                    │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  写指令的人/LLM 只需要写这一层                                 │
│  env 信息通过 prompt 上下文提供，不出现在指令输出中              │
└─────────────────────────────────────────────────────────────┘
                        ↓ 编译
┌─────────────────────────────────────────────────────────────┐
│  编译器（Compiler）                                          │
│  1. 查 env 注册表获取当前几何体环境                            │
│  2. 验证指令中所有标签引用是否合法                              │
│  3. 逐步执行 constructions → EntityBuilder 调用               │
│  4. 编译 measurements → 自动计算度量值                        │
│  5. 输出 scene_data JSON                                     │
└─────────────────────────────────────────────────────────────┘
```

### v0.7 LLM 生成管线（两步法）

```
用户题目
  ↓
[Step 1: 几何体识别]（规则引擎/小模型，准确率接近100%）
  ↓ 输出 { type, params }
[系统查表] getGeometryEnv(type, params)
  ↓ 获取 env（可用顶点/棱/面/promptHint）
[Step 2: 构造指令生成]（大模型，prompt 中注入 env）
  ↓ 输出 { constructions, measurements, ... }
[编译器] 验证 + 编译 → scene_data JSON
  ↓ 若验证失败，将错误反馈给 LLM 重试
最终输出
```

各角色分工：

| 环节 | 谁做 | 做什么 |
|------|------|--------|
| 几何体环境信息 | 系统（确定性） | getGeometryEnv() 查表 |
| 注入环境到 prompt | 系统 | 拼入 user message |
| 理解题意 + 选择构造方法 | LLM（概率性） | 输出 constructions + measurements |
| 验证标签有效性 | 编译器（确定性） | 检查所有引用是否存在 |
| 计算度量值 | 编译器（确定性） | 调用 calculator |

---

## 几何体环境注册表设计

### GeometryEnv 类型

```typescript
interface GeometryEnv {
  /** 所有内置顶点标签 */
  vertices: string[];

  /** 所有内置棱（用端点标签表示） */
  edges: [string, string][];

  /** 内置面（面名 → 顶点标签列表） */
  faces: Record<string, string[]>;

  /** 给 LLM 的自然语言描述（拼入 prompt） */
  promptHint: string;
}
```

### 注册表实现

```typescript
// scripts/dsl/geometry-env.ts

type EnvFactory = (params: Record<string, number>) => GeometryEnv;

const GEOMETRY_ENV_REGISTRY: Record<string, EnvFactory> = {

  cube: (p) => ({
    vertices: ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'],
    edges: [
      ['A','B'], ['B','C'], ['C','D'], ['D','A'],           // 底面
      ['A₁','B₁'], ['B₁','C₁'], ['C₁','D₁'], ['D₁','A₁'], // 顶面
      ['A','A₁'], ['B','B₁'], ['C','C₁'], ['D','D₁'],       // 侧棱
    ],
    faces: {
      '底面': ['A', 'D', 'C', 'B'],
      '顶面': ['A₁', 'B₁', 'C₁', 'D₁'],
      '前面': ['A', 'B', 'B₁', 'A₁'],
      '后面': ['C', 'D', 'D₁', 'C₁'],
      '左面': ['D', 'A', 'A₁', 'D₁'],
      '右面': ['B', 'C', 'C₁', 'B₁'],
    },
    promptHint: `正方体ABCD-A₁B₁C₁D₁，棱长${p.sideLength}。底面ABCD在下，顶面A₁B₁C₁D₁在上。A左前、B右前、C右后、D左后。`,
  }),

  cuboid: (p) => ({
    vertices: ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'],
    edges: [/* 同 cube */],
    faces: {/* 同 cube */},
    promptHint: `长方体ABCD-A₁B₁C₁D₁，长${p.length}、宽${p.width}、高${p.height}。AB为长，AD为宽。`,
  }),

  pyramid: (p) => {
    const n = p.sides;
    const labels = 'ABCDEFGH'.slice(0, n).split('');
    const vertices = [...labels, 'P'];
    const edges: [string, string][] = [
      ...labels.map((l, i) => [l, labels[(i + 1) % n]] as [string, string]),  // 底边
      ...labels.map((l) => [l, 'P'] as [string, string]),                      // 侧棱
    ];
    const faces: Record<string, string[]> = {
      '底面': [...labels].reverse(),
    };
    for (let i = 0; i < n; i++) {
      const faceVertices = [labels[i], labels[(i + 1) % n], 'P'];
      faces[`面${faceVertices.join('')}`] = faceVertices;
    }
    return {
      vertices, edges, faces,
      promptHint: `正${n}棱锥${labels.join('')}-P，底面边长${p.sideLength}，高${p.height}。P为顶点。`,
    };
  },

  prism: (p) => {
    const n = p.sides;
    const bottom = 'ABCDEFGH'.slice(0, n).split('');
    const top = bottom.map(l => l + '₁');
    const vertices = [...bottom, ...top];
    const edges: [string, string][] = [
      ...bottom.map((l, i) => [l, bottom[(i + 1) % n]] as [string, string]),  // 底边
      ...top.map((l, i) => [l, top[(i + 1) % n]] as [string, string]),        // 顶边
      ...bottom.map((l, i) => [l, top[i]] as [string, string]),                // 侧棱
    ];
    const faces: Record<string, string[]> = {
      '底面': [...bottom].reverse(),
      '顶面': [...top],
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const faceVertices = [bottom[i], bottom[j], top[j], top[i]];
      faces[`面${faceVertices.join('')}`] = faceVertices;
    }
    return {
      vertices, edges, faces,
      promptHint: `正${n}棱柱${bottom.join('')}-${top.join('')}，底面边长${p.sideLength}，高${p.height}。`,
    };
  },

  regularTetrahedron: (p) => ({
    vertices: ['A', 'B', 'C', 'D'],
    edges: [['A','B'], ['B','C'], ['C','A'], ['A','D'], ['B','D'], ['C','D']],
    faces: {
      '底面': ['C', 'B', 'A'],
      '面ABD': ['A', 'B', 'D'],
      '面BCD': ['B', 'C', 'D'],
      '面CAD': ['C', 'A', 'D'],
    },
    promptHint: `正四面体ABCD，棱长${p.sideLength}。底面ABC，顶点D。`,
  }),

  // cylinder, cone, sphere 等按需补充
};

export function getGeometryEnv(type: string, params: Record<string, number>): GeometryEnv {
  const factory = GEOMETRY_ENV_REGISTRY[type];
  if (!factory) throw new Error(`不支持的几何体类型: ${type}`);
  return factory(params);
}
```

### 为 LLM 构建 prompt（v0.7 预留）

```typescript
// scripts/dsl/prompt-builder.ts（v0.7 使用，当前阶段预留接口）

export function buildLLMPrompt(question: string, type: string, params: Record<string, number>): string {
  const env = getGeometryEnv(type, params);

  return `## 当前几何体环境
${env.promptHint}

可用顶点: ${env.vertices.join(', ')}
可用面:
${Object.entries(env.faces).map(([name, pts]) => `  - ${name}(${pts.join('')})`).join('\n')}
可用棱: ${env.edges.map(e => e.join('')).join(', ')}

## 题目
${question}

## 请输出 JSON 指令（只写 constructions 和 measurements，不要包含 geometry）
`;
}
```

---

## 指令格式设计

### 核心设计原则

1. **用标签引用，不用索引**：写 `A`、`B₁`、`底面` 而不是 `0`、`5`、`faceIndex:0`
2. **有序构造**：`constructions` 数组中的步骤按顺序编译，前面步骤创建的标签后面可引用
3. **度量自动计算**：只声明"测量什么"，编译器自动算出交线、角度值、距离值
4. **错误前置**：编译时检查标签是否存在、面是否合法，而不是运行时报错
5. **指令不含 env**：几何体环境信息由注册表提供，不出现在指令 JSON 中

### TypeScript 类型定义

```typescript
// ═══ 顶层指令 ═══

interface SceneInstruction {
  /** 作品 ID，如 "cube-S05-1" */
  id: string;

  /** 几何体定义 */
  geometry: {
    type: GeometryType;
    params: Record<string, number>;
  };

  /** 有序构造步骤（可选，无增强的基础场景不需要） */
  constructions?: Construction[];

  /** 度量声明（可选） */
  measurements?: Measurement[];

  /** 坐标系（可选） */
  coordinateSystem?: CoordinateSystemDecl;

  /** 外接球（可选） */
  circumSphere?: boolean;
}
```

### 构造步骤类型

```typescript
// ═══ 构造步骤（有序，前面创建的标签后面可引用）═══

type Construction =
  | MidpointConstruction      // 取中点
  | EdgePointConstruction     // 棱上任意比例点
  | FreePointConstruction     // 自由点（绝对坐标）
  | CentroidConstruction      // 多点质心
  | SegmentConstruction       // 添加线段
  | FaceConstruction;         // 添加自定义面/截面

// ─── 点构造 ───

interface MidpointConstruction {
  type: 'midpoint';
  label: string;              // 新点标签，如 "M"
  of: [string, string];       // 两端点标签，如 ["A", "B"]
}

interface EdgePointConstruction {
  type: 'edge_point';
  label: string;
  edge: [string, string];     // 棱的两端点标签
  t: number;                  // 0~1 参数，0.5=中点
}

interface FreePointConstruction {
  type: 'free_point';
  label: string;
  position: [number, number, number];
}

interface CentroidConstruction {
  type: 'centroid';
  label: string;              // 新点标签，如 "O"
  of: string[];               // 顶点标签列表，如 ["A", "B", "C", "D"]
}

// ─── 线段构造 ───

interface SegmentConstruction {
  type: 'segment';
  from: string;               // 起点标签
  to: string;                 // 终点标签
  color?: string;             // 颜色，如 "#e74c3c"
  dashed?: boolean;           // 是否虚线
}

// ─── 面构造 ───

interface FaceConstruction {
  type: 'face';
  label?: string;             // 可选标签，供度量引用
  points: string[];           // 顶点标签列表
  style?: 'crossSection' | 'custom';  // 截面 or 自定义面（默认 custom）
}
```

### 度量声明类型

```typescript
// ═══ 度量声明 ═══
// 编译器自动：1) 解析面/线引用 2) 获取坐标 3) 调用 calculator 4) 写入结果

type Measurement =
  | DihedralAngleMeasurement
  | LineFaceAngleMeasurement
  | LineLineAngleMeasurement
  | PointFaceDistanceMeasurement
  | LineLineDistanceMeasurement;

interface DihedralAngleMeasurement {
  kind: 'dihedral_angle';
  face1: FaceRef;             // 面引用
  face2: FaceRef;             // 面引用
  edge?: [string, string];    // 可选：显式指定棱（不指定时编译器自动计算交线）
}

interface LineFaceAngleMeasurement {
  kind: 'line_face_angle';
  line: LineRef;              // 线引用
  face: FaceRef;              // 面引用
}

interface LineLineAngleMeasurement {
  kind: 'line_line_angle';
  line1: LineRef;             // 线引用
  line2: LineRef;             // 线引用
}

interface PointFaceDistanceMeasurement {
  kind: 'point_face_distance';
  point: string;              // 点标签
  face: FaceRef;              // 面引用
}

interface LineLineDistanceMeasurement {
  kind: 'line_line_distance';
  line1: LineRef;             // 线引用
  line2: LineRef;             // 线引用
}

// ─── 引用类型 ───

/** 面引用：内置面名 | 构造步骤中的面标签 | 顶点标签列表 */
type FaceRef =
  | string                    // "底面" | "顶面" | "前面" | "face1"（内置面名或构造标签）
  | string[];                 // ["A", "B", "C", "D"]（顶点列表，直接引用或隐式创建面）

/** 线引用：两端点标签元组 */
type LineRef = [string, string];  // ["A", "B"]（编译器优先查找内置棱，否则查找自定义线段）
```

### 坐标系声明

```typescript
interface CoordinateSystemDecl {
  origin: string;                    // 原点标签
  mode?: 'auto' | 'upZ';            // auto=引擎自动计算, upZ=Z轴朝上
  xDirection?: [string, string];     // upZ 模式下 X 轴方向
}
```

---

## 改写示例

### 示例 1：基础场景（无增强）

```json
{
  "id": "cube-S01-1",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } }
}
```

### 示例 2：对角线（S02）

```json
{
  "id": "cube-S02-1",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } },
  "constructions": [
    { "type": "segment", "from": "A", "to": "C₁", "color": "#e74c3c" },
    { "type": "segment", "from": "A", "to": "C", "color": "#3498db", "dashed": true }
  ]
}
```

### 示例 3：截面（S04）

```json
{
  "id": "cube-S04-1",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } },
  "constructions": [
    { "type": "midpoint", "label": "M₁", "of": ["A", "B"] },
    { "type": "midpoint", "label": "M₂", "of": ["B", "C"] },
    { "type": "midpoint", "label": "M₃", "of": ["C", "C₁"] },
    { "type": "midpoint", "label": "M₄", "of": ["C₁", "D₁"] },
    { "type": "midpoint", "label": "M₅", "of": ["D₁", "A₁"] },
    { "type": "midpoint", "label": "M₆", "of": ["A", "A₁"] },
    { "type": "segment", "from": "M₁", "to": "M₂", "color": "#e74c3c" },
    { "type": "segment", "from": "M₂", "to": "M₃", "color": "#e74c3c" },
    { "type": "segment", "from": "M₃", "to": "M₄", "color": "#e74c3c" },
    { "type": "segment", "from": "M₄", "to": "M₅", "color": "#e74c3c" },
    { "type": "segment", "from": "M₅", "to": "M₆", "color": "#e74c3c" },
    { "type": "segment", "from": "M₆", "to": "M₁", "color": "#e74c3c" },
    { "type": "face", "points": ["M₁", "M₂", "M₃", "M₄", "M₅", "M₆"], "style": "crossSection" }
  ]
}
```

### 示例 4：二面角度量（S05） — 核心改进

```json
// 旧：需要手动传 Vec3 坐标 + addDihedralAngle
// 新：编译器自动计算交线和角度
{
  "id": "cube-S05-1",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } },
  "constructions": [
    { "type": "segment", "from": "B", "to": "D", "color": "#3498db", "dashed": true },
    { "type": "segment", "from": "B₁", "to": "D₁", "color": "#3498db", "dashed": true },
    { "type": "face", "label": "diagFace", "points": ["B", "D", "D₁", "B₁"] }
  ],
  "measurements": [
    { "kind": "dihedral_angle", "face1": "底面", "face2": "diagFace" }
  ]
}
```

### 示例 5：面面垂直（S14-2） — 改进最显著

```json
// 旧：需要手算交线方向 [-2, 1, -1]，极易出错
// 新：编译器自动计算交线
{
  "id": "cube-S14-2",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } },
  "constructions": [
    { "type": "segment", "from": "A", "to": "D₁", "color": "#e74c3c" },
    { "type": "segment", "from": "B", "to": "D₁", "color": "#e74c3c" },
    { "type": "face", "label": "face1", "points": ["A", "B", "D₁"] },
    { "type": "segment", "from": "A₁", "to": "D", "color": "#3498db" },
    { "type": "segment", "from": "B", "to": "D", "color": "#3498db", "dashed": true },
    { "type": "face", "label": "face2", "points": ["A₁", "B", "D"] }
  ],
  "measurements": [
    { "kind": "dihedral_angle", "face1": "face1", "face2": "face2" }
  ]
}
```

### 示例 6：棱锥 + 辅助构造 + 度量

```json
{
  "id": "pyramid4-S05-1",
  "geometry": { "type": "pyramid", "params": { "sides": 4, "sideLength": 2, "height": 2 } },
  "constructions": [
    { "type": "centroid", "label": "O", "of": ["A", "B", "C", "D"] },
    { "type": "midpoint", "label": "M", "of": ["A", "B"] },
    { "type": "segment", "from": "O", "to": "M", "color": "#3498db", "dashed": true },
    { "type": "segment", "from": "P", "to": "M", "color": "#e74c3c" }
  ],
  "measurements": [
    { "kind": "dihedral_angle", "face1": "底面", "face2": ["A", "B", "P"], "edge": ["A", "B"] }
  ]
}
```

### 示例 7：坐标系

```json
// cube 自动模式
{
  "id": "cube-S10-1",
  "geometry": { "type": "cube", "params": { "sideLength": 2 } },
  "coordinateSystem": { "origin": "A" }
}

// pyramid Z轴朝上模式
{
  "id": "pyramid4-S10-1",
  "geometry": { "type": "pyramid", "params": { "sides": 4, "sideLength": 2, "height": 2 } },
  "constructions": [
    { "type": "centroid", "label": "O", "of": ["A", "B", "C", "D"] }
  ],
  "coordinateSystem": { "origin": "O", "mode": "upZ", "xDirection": ["A", "B"] }
}
```

---

## 编译器设计

### 编译流程

```
SceneInstruction
  ↓ 1. 创建几何体
  createGeometry(type, params) → 自动创建内置实体（点/棱/面）
  ↓ 2. 加载环境
  getGeometryEnv(type, params) → 获取可用标签
  ↓ 3. 建立标签索引
  扫描内置顶点标签 → labelMap（标签→vertexIndex/pointId）
  ↓ 4. 逐步执行 constructions
  按顺序编译每个 Construction → EntityBuilder 调用，新标签加入 labelMap
  ↓ 5. 编译 measurements
  解析 FaceRef/LineRef → 获取坐标 → 调用 calculator → 写入实体
  ↓ 6. 编译 coordinateSystem / circumSphere
  ↓ 7. 输出快照
  getSnapshot() → scene_data JSON
```

### 文件结构

```
scripts/
├── generate-scenes.ts          # 主入口：读取指令 → 编译 → 输出 JSON
├── dsl/
│   ├── types.ts                # 指令类型定义
│   ├── geometry-env.ts         # 几何体环境注册表
│   ├── compiler.ts             # 编译器主体
│   ├── resolvers.ts            # 标签/面/线引用解析
│   ├── errors.ts               # 编译错误类型
│   └── __tests__/
│       └── compiler.test.ts    # 测试用例
```

### 面引用解析逻辑（resolveFaceRef）

```
输入 FaceRef
  ├── string "底面"  → env.faces 映射表 → faceIndex → faceIndexToId.get()
  ├── string "face1" → 在已编译的构造步骤中查找带此标签的 face → faceId
  └── string[] ["A","B","C","D"] → 查找已有面（内置或构造）匹配这些顶点
                                    → 若不存在，自动创建 addCustomFace()
```

### 线引用解析逻辑（resolveLineRef）

```
输入 LineRef ["A", "B"]
  ├── 1. 解析标签 → vertexIndex（如 A→0, B→1）
  ├── 2. 查找内置棱 findBuiltInSegment(0, 1)
  ├── 3. 若无内置棱，查找已有自定义线段（startLabel/endLabel 匹配）
  └── 4. 若都无 → 编译错误：引用的线段不存在
```

### 二面角交线自动计算

当 `dihedral_angle` 未指定 `edge` 时，编译器自动计算：

```typescript
function findIntersectionLine(face1Points: Vec3[], face2Points: Vec3[]): [Vec3, Vec3] {
  // 1. 计算两面法向量
  const n1 = normal(face1Points);
  const n2 = normal(face2Points);

  // 2. 交线方向 = n1 × n2
  const dir = cross(n1, n2);

  // 3. 找交线上的一个点（在两面的公共顶点中寻找）
  const commonVertex = findCommonVertex(face1Points, face2Points);
  if (commonVertex) return [commonVertex, add(commonVertex, dir)];

  // 4. 无公共顶点时，求两平面交线的参数方程
  return computePlaneIntersection(n1, face1Points[0], n2, face2Points[0], dir);
}
```

### 编译期错误检查

1. **标签存在性**：引用的点标签是否已创建（内置 or 前面的构造步骤）
2. **标签唯一性**：不允许重复标签
3. **面合法性**：面的顶点数 ≥ 3，顶点不共线
4. **度量引用有效性**：FaceRef / LineRef 能解析到有效实体
5. **构造顺序**：midpoint/edge_point 引用的端点必须在之前的步骤中已存在

---

## 实施计划

### 第一步：定义指令类型 + 环境注册表

- 创建 `scripts/dsl/types.ts`：SceneInstruction、Construction、Measurement 等
- 创建 `scripts/dsl/geometry-env.ts`：GeometryEnv 类型 + 注册表（cube/cuboid/pyramid/prism/regularTetrahedron）

### 第二步：实现编译器核心

- 创建 `scripts/dsl/compiler.ts`：`compileInstruction(instruction) → SceneSnapshot`
- 创建 `scripts/dsl/resolvers.ts`：标签解析、面引用解析、线引用解析
- 创建 `scripts/dsl/errors.ts`：编译错误类型
- 关键实现：二面角交线自动计算

### 第三步：编写测试用例

不做旧场景全量迁移（1.2.2 会产出新构型清单，届时直接用 DSL 编写）。
编写覆盖所有指令类型的代表性测试用例：

| # | 测试用例 | 覆盖能力 |
|---|---------|---------|
| 1 | 纯几何体（cube 无增强） | 基础编译 + env 加载 |
| 2 | segment 构造 | 线段 + 内置顶点引用 |
| 3 | midpoint + centroid | 语义化点构造 |
| 4 | edge_point | 棱上任意比例点 |
| 5 | face（crossSection） | 截面构造 |
| 6 | dihedral_angle（内置面名） | 二面角 + "底面"解析 |
| 7 | dihedral_angle（自定义面） | 二面角 + 交线自动计算 |
| 8 | line_face_angle | 线面角 |
| 9 | line_line_angle（内置棱） | 异面角 + LineRef 自动匹配 |
| 10 | point_face_distance | 点面距 |
| 11 | line_line_distance | 异面距离 |
| 12 | coordinateSystem（auto + upZ） | 两种坐标系模式 |
| 13 | circumSphere | 外接球 |
| 14 | 编译错误（无效标签等） | 错误前置检查 |
| 15 | getGeometryEnv 各类型 | 环境注册表正确性 |

测试文件：`scripts/dsl/__tests__/compiler.test.ts`

### 第四步：验证

- 测试用例全部通过
- `pnpm lint && pnpm tsc --noEmit` 通过
- 更新 generate-scenes.ts 主入口支持 DSL 指令输入

---

## 验收标准

1. 15 个测试用例覆盖所有指令类型和环境注册表，全部通过
2. 新增一个场景只需写 ~10 行指令，不需要查顶点索引
3. `pnpm lint && pnpm tsc --noEmit` 通过
4. 度量值由编译器自动计算，指令中不包含任何手算数值
5. 编译时检查标签有效性，无效标签报编译错误
6. getGeometryEnv 为每种几何体返回正确的顶点/棱/面信息
7. generate-scenes.ts 支持 DSL 指令输入

---

## 引擎参考（编译目标）

### 实体类型（9 种）

| 实体类型 | 用途 | 关键属性 |
|---------|------|---------|
| geometry | 基础几何体 | geometryType, params |
| point | 点（内置顶点 / 棱上点 / 自由点） | constraint: vertex/edge/free |
| segment | 线段 | startPointId, endPointId, style |
| face | 面（内置面 / 截面 / 自定义） | pointIds, source |
| coordinateSystem | 坐标系 | originPointId, axes |
| circumSphere | 外接球 | geometryId |
| angleMeasurement | 角度度量 | kind: dihedral/lineFace/lineLine |
| distanceMeasurement | 距离度量 | kind: pointFace/lineLine/pointPoint/... |
| circumCircle | 外接圆 | pointIds |

### 度量计算器

| 计算器 | 输入 | 输出 |
|--------|------|------|
| calculateDihedralAngle | 棱线两端点 + 两面顶点 | radians, latex, degrees |
| calculateLineFaceAngle | 线段两端点 + 面顶点 | 同上 |
| calculateLineLineAngle | 两线段各两端点 | 同上 |
| calculatePointFaceDistance | 点坐标 + 面顶点 | value, latex, approxStr |
| calculateLineLineDistance | 两线段各两端点 | 同上 |

### 几何体顶点布局

**正方体/长方体**（y-up）：
```
底面 y=0：A(0) B(1) C(2) D(3)   ← A左前 B右前 C右后 D左后
顶面 y=h：A₁(4) B₁(5) C₁(6) D₁(7)
面索引：0=底面(ADCB) 1=顶面 2=前面(ABB₁A₁) 3=后面 4=左面 5=右面
```

**正 n 棱锥**（底面 y=0，顶点 y=h）：
```
底面：A(0) B(1) C(2) D(3)...
顶点：P(n)
面索引：0=底面(逆序) 1=ABP 2=BCP 3=CDP 4=DAP...
```

**正三棱柱**（底面 y=0）：
```
底面：A(0) B(1) C(2)
顶面：A₁(3) B₁(4) C₁(5)
面索引：0=底面(CBA) 1=顶面(A₁B₁C₁) 2=ABB₁A₁ 3=BCC₁B₁ 4=CAA₁C₁
```

**正四面体**：
```
A(0) B(1) C(2) D(3)
面索引：0=底面(CBA) 1=ABD 2=BCD 3=CAD
```

## 上下游依赖

- **上游**：无，可独立实施
- **下游**：1.2.2 产出构型清单 v3 后，用 DSL 为每个构型编写指令并生成 scene_data

## 参考文件

| 文件 | 用途 |
|------|------|
| `scripts/generate-scenes.ts` | 现有生成脚本（803行，46个WorkSpec） |
| `src/editor/entities/types.ts` | 实体类型定义 |
| `src/engine/builders/cuboid.ts` | 正方体/长方体顶点布局 |
| `src/engine/builders/pyramid.ts` | 棱锥顶点布局 |
| `src/engine/builders/prism.ts` | 棱柱顶点布局 |
| `src/engine/builders/regularTetrahedron.ts` | 正四面体顶点布局 |
| `src/engine/math/angleCalculator.ts` | 角度计算器 |
| `src/engine/math/distanceCalculator.ts` | 距离计算器 |
| `src/engine/math/coordinates.ts` | 坐标系计算 |
