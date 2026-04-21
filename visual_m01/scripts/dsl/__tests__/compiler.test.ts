/**
 * DSL 编译器测试
 *
 * 运行方式：npx tsx scripts/dsl/__tests__/compiler.test.ts
 *
 * 覆盖所有指令类型和编译器功能：
 * 1. 纯几何体（无增强）
 * 2. segment 构造
 * 3. midpoint + centroid
 * 4. edge_point
 * 5. face（crossSection）
 * 6. dihedral_angle（内置面名）
 * 7. dihedral_angle（自定义面 + 交线自动计算）
 * 8. line_face_angle
 * 9. line_line_angle（内置棱）
 * 10. point_face_distance
 * 11. line_line_distance
 * 12. coordinateSystem（auto + upZ）
 * 13. circumSphere
 * 14. 编译错误（无效标签等）
 * 15. getGeometryEnv 各类型
 */

import assert from 'node:assert';
import { compileInstruction } from '../compiler';
import { getGeometryEnv, hasGeometryEnv } from '../geometry-env';
import { DSLCompileError } from '../errors';
import type { SceneInstruction } from '../types';
import type { Entity, AngleMeasurementProperties, DistanceMeasurementProperties } from '../../../src/editor/entities/types';

// ═══════════════════════════════════════════════════════════
// 测试工具
// ═══════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

function findEntity(snapshot: { entities: Record<string, unknown> }, type: string): Entity[] {
  return Object.values(snapshot.entities).filter((e) => (e as Entity).type === type) as Entity[];
}


// ═══════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════

console.log('\n=== DSL 编译器测试 ===\n');

// ─── 1. 纯几何体 ───

test('1. 纯几何体（cube 无增强）', () => {
  const instruction: SceneInstruction = {
    id: 'test-basic',
    geometry: { type: 'cube', params: { sideLength: 2 } },
  };
  const { snapshot } = compileInstruction(instruction);

  assert(snapshot.activeGeometryId, '应有 activeGeometryId');
  const points = findEntity(snapshot, 'point');
  assert.strictEqual(points.length, 8, '正方体应有8个顶点');
  const segments = findEntity(snapshot, 'segment');
  assert.strictEqual(segments.length, 12, '正方体应有12条棱');
  const faces = findEntity(snapshot, 'face');
  assert.strictEqual(faces.length, 6, '正方体应有6个面');
});

// ─── 2. segment 构造 ───

test('2. segment 构造', () => {
  const instruction: SceneInstruction = {
    id: 'test-segment',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'segment', from: 'A', to: 'C₁', color: '#e74c3c' },
      { type: 'segment', from: 'A', to: 'C', color: '#3498db', dashed: true },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const segments = findEntity(snapshot, 'segment');
  assert.strictEqual(segments.length, 14, '12条内置棱 + 2条自定义线段');
});

// ─── 3. midpoint + centroid ───

test('3. midpoint + centroid', () => {
  const instruction: SceneInstruction = {
    id: 'test-midpoint-centroid',
    geometry: { type: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 } },
    constructions: [
      { type: 'centroid', label: 'O', of: ['A', 'B', 'C', 'D'] },
      { type: 'midpoint', label: 'M', of: ['A', 'B'] },
      { type: 'segment', from: 'O', to: 'M', color: '#3498db', dashed: true },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const points = findEntity(snapshot, 'point');
  // 5个内置顶点(A,B,C,D,P) + 2个构造点(O,M)
  assert.strictEqual(points.length, 7, '应有7个点');
});

// ─── 4. edge_point ───

test('4. edge_point（棱上 1/3 处）', () => {
  const instruction: SceneInstruction = {
    id: 'test-edge-point',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'edge_point', label: 'E', edge: ['A', 'B'], t: 1 / 3 },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const points = findEntity(snapshot, 'point');
  assert.strictEqual(points.length, 9, '8个顶点 + 1个棱上点');
});

// ─── 5. face（crossSection）───

test('5. face + crossSection', () => {
  const instruction: SceneInstruction = {
    id: 'test-cross-section',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'midpoint', label: 'M₁', of: ['A', 'B'] },
      { type: 'midpoint', label: 'M₂', of: ['B', 'C'] },
      { type: 'midpoint', label: 'M₃', of: ['C', 'C₁'] },
      { type: 'segment', from: 'M₁', to: 'M₂', color: '#e74c3c' },
      { type: 'segment', from: 'M₂', to: 'M₃', color: '#e74c3c' },
      { type: 'segment', from: 'M₃', to: 'M₁', color: '#e74c3c' },
      { type: 'face', points: ['M₁', 'M₂', 'M₃'], style: 'crossSection' },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const faces = findEntity(snapshot, 'face');
  assert.strictEqual(faces.length, 7, '6个内置面 + 1个截面');
});

// ─── 6. dihedral_angle（内置面名）───

test('6. dihedral_angle + 内置面名"底面"', () => {
  const instruction: SceneInstruction = {
    id: 'test-dihedral-builtin',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'segment', from: 'B', to: 'D', color: '#3498db', dashed: true },
      { type: 'segment', from: 'B₁', to: 'D₁', color: '#3498db', dashed: true },
      { type: 'face', label: 'diagFace', points: ['B', 'D', 'D₁', 'B₁'] },
    ],
    measurements: [
      { kind: 'dihedral_angle', face1: '底面', face2: 'diagFace' },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const angles = findEntity(snapshot, 'angleMeasurement');
  assert.strictEqual(angles.length, 1, '应有1个角度度量');
  const props = (angles[0] as Entity).properties as AngleMeasurementProperties;
  assert.strictEqual(props.kind, 'dihedral');
  // 正方体中 BDD₁B₁ 是垂直面，与底面二面角 = 90°
  assert(Math.abs(props.angleDegrees - 90) < 1, `二面角应约90°，实际=${props.angleDegrees.toFixed(1)}°`);
});

// ─── 7. dihedral_angle（自定义面 + 交线自动计算）───

test('7. dihedral_angle + 交线自动计算', () => {
  const instruction: SceneInstruction = {
    id: 'test-dihedral-auto-edge',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'segment', from: 'A', to: 'D₁', color: '#e74c3c' },
      { type: 'segment', from: 'B', to: 'D₁', color: '#e74c3c' },
      { type: 'face', label: 'face1', points: ['A', 'B', 'D₁'] },
      { type: 'segment', from: 'A₁', to: 'D', color: '#3498db' },
      { type: 'segment', from: 'B', to: 'D', color: '#3498db', dashed: true },
      { type: 'face', label: 'face2', points: ['A₁', 'B', 'D'] },
    ],
    measurements: [
      { kind: 'dihedral_angle', face1: 'face1', face2: 'face2' },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const angles = findEntity(snapshot, 'angleMeasurement');
  assert.strictEqual(angles.length, 1, '应有1个角度度量');
  const props = (angles[0] as Entity).properties as AngleMeasurementProperties;
  // 这两个面 ABD₁ 和 A₁BD 的二面角应为 90°
  assert(Math.abs(props.angleDegrees - 90) < 1, `二面角应约90°，实际=${props.angleDegrees.toFixed(1)}°`);
});

// ─── 8. line_face_angle ───

test('8. line_face_angle', () => {
  const instruction: SceneInstruction = {
    id: 'test-line-face-angle',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'segment', from: 'A', to: 'C₁', color: '#e74c3c' },
    ],
    measurements: [
      { kind: 'line_face_angle', line: ['A', 'C₁'], face: '底面' },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const angles = findEntity(snapshot, 'angleMeasurement');
  assert.strictEqual(angles.length, 1);
  const props = (angles[0] as Entity).properties as AngleMeasurementProperties;
  assert.strictEqual(props.kind, 'lineFace');
  // AC₁ 与底面的夹角 = arctan(h/对角线) = arctan(2/2√2) = arctan(1/√2) ≈ 35.26°
  assert(props.angleDegrees > 30 && props.angleDegrees < 40, `线面角应在30-40°之间，实际=${props.angleDegrees.toFixed(1)}°`);
});

// ─── 9. line_line_angle（内置棱）───

test('9. line_line_angle + 内置棱自动匹配', () => {
  const instruction: SceneInstruction = {
    id: 'test-line-line-angle',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    measurements: [
      // AB 方向 [1,0,0], D₁A₁ 方向 [0,0,1]，互相垂直 → 90°
      { kind: 'line_line_angle', line1: ['A', 'B'], line2: ['D₁', 'A₁'] },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const angles = findEntity(snapshot, 'angleMeasurement');
  assert.strictEqual(angles.length, 1);
  const props = (angles[0] as Entity).properties as AngleMeasurementProperties;
  assert.strictEqual(props.kind, 'lineLine');
  // AB ⊥ D₁A₁，异面直线角 = 90°
  assert(Math.abs(props.angleDegrees - 90) < 1, `垂直线夹角应约90°，实际=${props.angleDegrees.toFixed(1)}°`);
});

// ─── 10. point_face_distance ───

test('10. point_face_distance', () => {
  const instruction: SceneInstruction = {
    id: 'test-point-face-dist',
    geometry: { type: 'regularTetrahedron', params: { sideLength: 2 } },
    constructions: [
      { type: 'centroid', label: 'H', of: ['A', 'B', 'C'] },
      { type: 'segment', from: 'D', to: 'H', color: '#e74c3c' },
    ],
    measurements: [
      { kind: 'point_face_distance', point: 'D', face: '底面' },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const dists = findEntity(snapshot, 'distanceMeasurement');
  assert.strictEqual(dists.length, 1);
  const props = (dists[0] as Entity).properties as DistanceMeasurementProperties;
  assert.strictEqual(props.kind, 'pointFace');
  // 正四面体（棱长2）的高 = 2√6/3 ≈ 1.633
  assert(Math.abs(props.distanceValue - 2 * Math.sqrt(6) / 3) < 0.01,
    `点面距应约${(2 * Math.sqrt(6) / 3).toFixed(3)}，实际=${props.distanceValue.toFixed(3)}`);
});

// ─── 11. line_line_distance ───

test('11. line_line_distance', () => {
  const instruction: SceneInstruction = {
    id: 'test-line-line-dist',
    geometry: { type: 'prism', params: { sides: 3, sideLength: 2, height: 2 } },
    measurements: [
      { kind: 'line_line_distance', line1: ['A', 'B'], line2: ['A₁', 'C₁'] },
    ],
  };
  const { snapshot } = compileInstruction(instruction);

  const dists = findEntity(snapshot, 'distanceMeasurement');
  assert.strictEqual(dists.length, 1);
  const props = (dists[0] as Entity).properties as DistanceMeasurementProperties;
  assert.strictEqual(props.kind, 'lineLine');
  assert(props.distanceValue > 0, `异面距离应 > 0，实际=${props.distanceValue}`);
});

// ─── 12. coordinateSystem ───

test('12a. coordinateSystem auto', () => {
  const instruction: SceneInstruction = {
    id: 'test-coord-auto',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    coordinateSystem: { origin: 'A' },
  };
  const { snapshot } = compileInstruction(instruction);

  const coordSys = findEntity(snapshot, 'coordinateSystem');
  assert.strictEqual(coordSys.length, 1, '应有1个坐标系');
});

test('12b. coordinateSystem upZ', () => {
  const instruction: SceneInstruction = {
    id: 'test-coord-upz',
    geometry: { type: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 } },
    constructions: [
      { type: 'centroid', label: 'O', of: ['A', 'B', 'C', 'D'] },
    ],
    coordinateSystem: { origin: 'O', mode: 'upZ', xDirection: ['A', 'B'] },
  };
  const { snapshot } = compileInstruction(instruction);

  const coordSys = findEntity(snapshot, 'coordinateSystem');
  assert.strictEqual(coordSys.length, 1, '应有1个坐标系');
});

// ─── 13. circumSphere ───

test('13. circumSphere', () => {
  const instruction: SceneInstruction = {
    id: 'test-circum-sphere',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    circumSphere: true,
  };
  const { snapshot } = compileInstruction(instruction);

  const spheres = findEntity(snapshot, 'circumSphere');
  assert.strictEqual(spheres.length, 1, '应有1个外接球');
});

// ─── 14. 编译错误 ───

test('14a. 无效标签 → 编译错误', () => {
  const instruction: SceneInstruction = {
    id: 'test-bad-label',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'segment', from: 'A', to: 'X' },  // X 不存在
    ],
  };
  try {
    compileInstruction(instruction);
    assert.fail('应抛出 DSLCompileError');
  } catch (err) {
    assert(err instanceof DSLCompileError, '应为 DSLCompileError');
    assert(err.message.includes('"X"'), `错误信息应包含标签名"X": ${err.message}`);
  }
});

test('14b. 重复标签 → 编译错误', () => {
  const instruction: SceneInstruction = {
    id: 'test-dup-label',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'midpoint', label: 'A', of: ['B', 'C'] },  // A 已是内置顶点
    ],
  };
  try {
    compileInstruction(instruction);
    assert.fail('应抛出 DSLCompileError');
  } catch (err) {
    assert(err instanceof DSLCompileError, '应为 DSLCompileError');
    assert(err.message.includes('"A"'), `错误信息应包含标签名"A": ${err.message}`);
  }
});

test('14c. 无效面名 → 编译错误', () => {
  const instruction: SceneInstruction = {
    id: 'test-bad-face',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    measurements: [
      { kind: 'line_face_angle', line: ['A', 'B'], face: '侧面' },  // cube 没有 "侧面"
    ],
  };
  try {
    compileInstruction(instruction);
    assert.fail('应抛出 DSLCompileError');
  } catch (err) {
    assert(err instanceof DSLCompileError, '应为 DSLCompileError');
  }
});

// ─── 15. getGeometryEnv 各类型 ───

test('15a. cube env', () => {
  const env = getGeometryEnv('cube', { sideLength: 2 });
  assert.strictEqual(env.vertices.length, 8);
  assert.strictEqual(env.edges.length, 12);
  assert.strictEqual(Object.keys(env.faces).length, 6);
  assert('底面' in env.faceNameToIndex);
  assert('顶面' in env.faceNameToIndex);
});

test('15b. pyramid(4) env', () => {
  const env = getGeometryEnv('pyramid', { sides: 4, sideLength: 2, height: 2 });
  assert.strictEqual(env.vertices.length, 5);  // A,B,C,D,P
  assert.strictEqual(env.edges.length, 8);      // 4底边+4侧棱
  assert.strictEqual(Object.keys(env.faces).length, 5);  // 底面+4侧面
  assert(env.vertices.includes('P'), '应包含顶点P');
});

test('15c. prism(3) env', () => {
  const env = getGeometryEnv('prism', { sides: 3, sideLength: 2, height: 2 });
  assert.strictEqual(env.vertices.length, 6);  // A,B,C,A₁,B₁,C₁
  assert.strictEqual(env.edges.length, 9);      // 3底边+3顶边+3侧棱
  assert.strictEqual(Object.keys(env.faces).length, 5);  // 底面+顶面+3侧面
});

test('15d. regularTetrahedron env', () => {
  const env = getGeometryEnv('regularTetrahedron', { sideLength: 2 });
  assert.strictEqual(env.vertices.length, 4);
  assert.strictEqual(env.edges.length, 6);
  assert.strictEqual(Object.keys(env.faces).length, 4);
});

test('15e. 不支持的类型 → 抛出错误', () => {
  assert.strictEqual(hasGeometryEnv('unknownType'), false);
  try {
    getGeometryEnv('unknownType', {});
    assert.fail('应抛出错误');
  } catch (err) {
    assert(err instanceof Error);
  }
});

// ─── 16. debug 模式 ───

test('16. debug 模式输出日志', () => {
  const instruction: SceneInstruction = {
    id: 'test-debug',
    geometry: { type: 'cube', params: { sideLength: 2 } },
    constructions: [
      { type: 'midpoint', label: 'M', of: ['A', 'B'] },
      { type: 'segment', from: 'A', to: 'C₁', color: '#e74c3c' },
    ],
    measurements: [
      { kind: 'line_face_angle', line: ['A', 'C₁'], face: '底面' },
    ],
  };
  const { logs } = compileInstruction(instruction, { debug: true });
  assert(logs.length > 0, '应有编译日志');
  assert(logs.some(l => l.includes('创建几何体')), '日志应包含"创建几何体"');
  assert(logs.some(l => l.includes('编译完成')), '日志应包含"编译完成"');
});

// ═══════════════════════════════════════════════════════════
// 结果
// ═══════════════════════════════════════════════════════════

console.log(`\n测试完成: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 个\n`);
process.exit(failed > 0 ? 1 : 0);
