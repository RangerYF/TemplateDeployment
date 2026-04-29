import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_PATH = path.join(__dirname, 'ai-operation-planning-cases.json');

const DEFAULT_BASE_URL = 'http://localhost:8000';
const DEFAULT_TEMPLATE_KEY = 'm01';
const DEFAULT_INSTANCE_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;

const CUBE_LABELS = ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'];
const CUBE_EDGES = [
  ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
  ['A1', 'B1'], ['B1', 'C1'], ['C1', 'D1'], ['D1', 'A1'],
  ['A', 'A1'], ['B', 'B1'], ['C', 'C1'], ['D', 'D1'],
];
const CUBE_FACES = [
  { id: 'face-bottom', labels: ['A', 'B', 'C', 'D'] },
  { id: 'face-top', labels: ['A1', 'B1', 'C1', 'D1'] },
  { id: 'face-front', labels: ['A', 'B', 'B1', 'A1'] },
  { id: 'face-right', labels: ['B', 'C', 'C1', 'B1'] },
  { id: 'face-back', labels: ['C', 'D', 'D1', 'C1'] },
  { id: 'face-left', labels: ['D', 'A', 'A1', 'D1'] },
];

function operation(type, extras = {}) {
  return { type, ...extras };
}

function caseItem(id, instruction, expectedOperationTypes, options = {}) {
  return {
    id,
    instruction,
    expectedOperationTypes,
    forbiddenOperationTypes: options.forbiddenOperationTypes ?? [],
    expectedWarnings: options.expectedWarnings ?? [],
    context: options.context ?? 'empty',
    category: options.category ?? 'general',
    notes: options.notes ?? '',
  };
}

function fromExistingCases() {
  if (!fs.existsSync(CASES_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  return raw.map((item) => ({
    id: item.id,
    instruction: item.instruction,
    expectedOperationTypes: item.expectedOperationTypes ?? [],
    forbiddenOperationTypes: item.forbiddenOperationTypes ?? [],
    expectedWarnings: item.expectedWarnings ?? [],
    context: inferContext(item),
    category: 'seed',
    notes: item.notes ?? '',
  }));
}

function inferContext(item) {
  const types = item.expectedOperationTypes ?? [];
  if (!types.includes('setGeometry') && types.length > 0) return 'cube';
  return 'empty';
}

function buildGeneratedCases() {
  const cases = [];

  const geometryCases = [
    ['gen-cube', '生成一个正方体。', 'cube'],
    ['gen-cube-side-3', '生成一个棱长为 3 的正方体。', 'cube'],
    ['gen-sphere-r2', '生成半径为 2 的球体。', 'sphere'],
    ['gen-cylinder', '生成一个底面半径为 1、高为 3 的圆柱。', 'cylinder'],
    ['gen-cone', '生成一个底面半径为 2、高为 4 的圆锥。', 'cone'],
    ['gen-cuboid', '生成长 4、宽 3、高 2 的长方体。', 'cuboid'],
    ['gen-prism', '生成一个正三棱柱。', 'prism'],
    ['gen-pyramid', '生成一个四棱锥。', 'pyramid'],
    ['gen-tetra', '生成一个正四面体。', 'regularTetrahedron'],
    ['gen-frustum', '生成一个圆台。', 'frustum'],
  ];
  for (const [id, instruction] of geometryCases) {
    cases.push(caseItem(id, instruction, ['setGeometry'], {
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'simple-geometry',
    }));
  }

  const centerCases = [
    ['center-cube-o', '生成正方体，并标出它的中心 O。', ['setGeometry', 'addCenterPoint']],
    ['center-cuboid-o', '生成长方体，并标出几何体中心 O。', ['setGeometry', 'addCenterPoint']],
    ['center-sphere-o', '生成球体，并标出球心 O。', ['setGeometry', 'addCenterPoint']],
    ['face-center-bottom-o1', '生成正方体，在底面 ABCD 的中心标 O1。', ['setGeometry', 'addFaceCenterPoint']],
    ['face-center-top-o2', '生成正方体，在上底面 A1B1C1D1 的中心标 O2。', ['setGeometry', 'addFaceCenterPoint']],
    ['face-center-side-o3', '生成正方体，在侧面 ABB1A1 的中心标 O3。', ['setGeometry', 'addFaceCenterPoint']],
    ['face-center-current-bottom', '在底面 ABCD 的中心标 O1。', ['addFaceCenterPoint'], 'cube'],
    ['center-current-cube', '标出当前正方体的中心 O。', ['addCenterPoint'], 'cube'],
  ];
  for (const item of centerCases) {
    const [id, instruction, types, context = 'empty'] = item;
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: id.includes('face-center') ? ['loadPresetScene', 'addCenterPoint'] : ['loadPresetScene', 'addFaceCenterPoint'],
      category: 'center',
    }));
  }

  const segmentCases = [
    ['seg-ac1', '生成正方体，连接 A 和 C1。', ['setGeometry', 'addSegmentByLabels']],
    ['seg-ac1-red', '生成正方体，连接 A 和 C1，并把 AC1 标红。', ['setGeometry', 'addSegmentByLabels']],
    ['seg-bd1-dashed', '生成正方体，连接 B 和 D1，画成虚线。', ['setGeometry', 'addSegmentByLabels']],
    ['seg-current-ac', '连接 A 和 C。', ['addSegmentByLabels'], 'cube'],
    ['seg-current-a1c1', '连接 A1 和 C1。', ['addSegmentByLabels'], 'cube'],
    ['seg-current-bd1', '连接 B 和 D1，作为辅助线。', ['addSegmentByLabels'], 'cube'],
    ['seg-current-ab-red', '把 AB 这条边标红。', ['setStyle'], 'cube'],
    ['seg-current-ac1-red-existing', '把 AC1 改成红色虚线。', ['setStyle'], 'cube'],
  ];
  for (const [id, instruction, types, context = 'empty'] of segmentCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'segment-style',
    }));
  }

  const pointCases = [
    ['mid-ab-m', '生成正方体，在 AB 上取中点 M。', ['setGeometry', 'addPointOnEdge']],
    ['mid-ab-m-connect-c1', '生成正方体，在 AB 上取中点 M，再连接 M 和 C1。', ['setGeometry', 'addPointOnEdge', 'addSegmentByLabels']],
    ['mid-current-ab-m', '在 AB 上取中点 M。', ['addPointOnEdge'], 'cube'],
    ['mid-current-a1c1-n', '取 A1C1 的中点 N。', ['addMidpointByLabels'], 'cube'],
    ['point-ab-t-quarter', '在 AB 上取点 P，使 AP 是 AB 的四分之一。', ['addPointOnEdge'], 'cube'],
    ['mid-free-ac-o', '取 AC 的中点 O。', ['addMidpointByLabels'], 'cube'],
    ['mid-connect-two', '取 BC 的中点 M，再连接 M 和 A1。', ['addPointOnEdge', 'addSegmentByLabels'], 'cube'],
    ['mid-top-connect', '取 B1C1 的中点 N，连接 N 和 D。', ['addPointOnEdge', 'addSegmentByLabels'], 'cube'],
  ];
  for (const [id, instruction, types, context = 'empty'] of pointCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'point',
    }));
  }

  const faceSectionCases = [
    ['section-aca1', '生成正方体，用 A、C、A1 三点作一个截面。', ['setGeometry', 'addCrossSectionByLabels']],
    ['section-current-aca1', '用 A、C、A1 三点作一个截面。', ['addCrossSectionByLabels'], 'cube'],
    ['section-current-bdb1', '过 B、D、B1 三点作截面。', ['addCrossSectionByLabels'], 'cube'],
    ['section-current-abc1', '作经过 A、B、C1 的截面。', ['addCrossSectionByLabels'], 'cube'],
    ['aux-face-acc1', '生成正方体，并用 A、C、C1 三点作辅助平面。', ['setGeometry', 'addAuxiliaryFaceByLabels']],
    ['aux-current-acc1', '用 A、C、C1 作一个辅助平面。', ['addAuxiliaryFaceByLabels'], 'cube'],
    ['aux-projection-abd1', '过 A、B、D1 作投影辅助面。', ['addAuxiliaryFaceByLabels'], 'cube'],
    ['ambiguous-section', '帮我在这个正方体里做一个截面。', [], 'cube', ['loadPresetScene', 'addCrossSectionByLabels'], ['需要确认截面经过哪些点']],
  ];
  for (const raw of faceSectionCases) {
    const [id, instruction, types, context = 'empty', forbidden = ['loadPresetScene'], warnings = []] = raw;
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: forbidden,
      expectedWarnings: warnings,
      category: 'section-face',
    }));
  }

  const measureCases = [
    ['dist-a-a1', '生成正方体，标出 A 到 A1 的距离。', ['setGeometry', 'addDistanceMeasurement']],
    ['dist-a1-bottom', '生成正方体，标出 A1 到底面 ABCD 的距离。', ['setGeometry', 'addDistanceMeasurement']],
    ['dist-current-a1-bottom', '标出 A1 到底面 ABCD 的距离。', ['addDistanceMeasurement'], 'cube'],
    ['dist-current-a-line-bc', '标出 A 到直线 BC 的距离。', ['addDistanceMeasurement'], 'cube'],
    ['dist-current-ab-cd', '标出直线 AB 和 CD 的距离。', ['addDistanceMeasurement'], 'cube'],
    ['angle-line-line', '生成正方体，标出 AB 与 CD 所成的角。', ['setGeometry', 'addAngleMeasurement']],
    ['angle-line-face', '生成正方体，标出 AC1 与底面 ABCD 所成的角。', ['setGeometry', 'addSegmentByLabels', 'addAngleMeasurement']],
    ['angle-current-line-face', '标出 AC1 与底面 ABCD 所成的角。', ['addSegmentByLabels', 'addAngleMeasurement'], 'cube'],
    ['angle-dihedral', '标出面 ABCD 与面 ABB1A1 的二面角。', ['addAngleMeasurement'], 'cube'],
    ['angle-skew', '标出 AB 与 C1D1 的夹角。', ['addAngleMeasurement'], 'cube'],
  ];
  for (const [id, instruction, types, context = 'empty'] of measureCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'measurement',
    }));
  }

  const circumsphereCases = [
    ['circ-cube', '生成正方体，并添加它的外接球。', ['setGeometry', 'addCircumsphere']],
    ['circ-cuboid', '生成长方体，并添加外接球。', ['setGeometry', 'addCircumsphere']],
    ['circ-current', '给当前正方体添加外接球。', ['addCircumsphere'], 'cube'],
    ['circ-with-center', '生成正方体，添加外接球并标出球心 O。', ['setGeometry', 'addCircumsphere', 'addCenterPoint']],
    ['preset-cube-circ', '我要讲正方体外接球通用图。', ['loadPresetScene']],
  ];
  for (const [id, instruction, types, context = 'empty'] of circumsphereCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: id.startsWith('preset') ? ['setGeometry'] : ['loadPresetScene'],
      category: 'circumsphere',
    }));
  }

  const presetCases = [
    ['preset-sphere-section', '我要讲球的截面圆面积，帮我直接进入合适的图。', ['loadPresetScene']],
    ['preset-cube-section-topic', '我要讲正方体三点截面通用图。', ['loadPresetScene']],
    ['preset-line-plane-perp', '我要讲线面垂直通用图。', ['loadPresetScene']],
    ['preset-plane-parallel', '我要讲面面平行的通用题图。', ['loadPresetScene']],
    ['preset-pyramid-height', '我要讲棱锥高线，直接给我通用图。', ['loadPresetScene']],
    ['preset-line-plane-angle', '我要讲正方体线面角专题图。', ['loadPresetScene']],
    ['preset-dihedral', '我要讲正方体二面角通用图。', ['loadPresetScene']],
    ['preset-skew', '我要讲异面直线夹角，直接进入通用图。', ['loadPresetScene']],
    ['preset-point-plane-distance-volume', '我要讲点面距离等体积法通用图。', ['loadPresetScene']],
    ['preset-projection-area', '我要讲正方体正投影面积通用图。', ['loadPresetScene']],
  ];
  for (const [id, instruction, types] of presetCases) {
    cases.push(caseItem(id, instruction, types, {
      forbiddenOperationTypes: ['setGeometry', 'addSegmentByLabels'],
      category: 'preset',
    }));
  }

  const styleLabelVisibleCases = [
    ['label-a-p', '把 A 点改名为 P。', ['setLabel'], 'cube'],
    ['style-ab-red-dashed', '把 AB 这条线改成红色虚线。', ['setStyle'], 'cube'],
    ['visible-hide-bottom', '隐藏底面 ABCD。', ['setVisible'], 'cube'],
    ['visible-only-main', '简化当前场景，只保留正方体主体。', ['setVisible'], 'cube'],
    ['style-connect-new-red', '连接 A 和 C1，并把这条线标红。', ['addSegmentByLabels'], 'cube'],
    ['label-new-midpoint', '在 AB 中点标 M。', ['addPointOnEdge'], 'cube'],
    ['label-new-face-center', '在底面中心标 O1。', ['addFaceCenterPoint'], 'cube'],
  ];
  for (const [id, instruction, types, context = 'empty'] of styleLabelVisibleCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'style-label-visible',
    }));
  }

  const negativeCases = [
    ['unknown-g', '连接 A 和 G。', [], 'cube', ['addSegmentByLabels'], ['G']],
    ['unknown-x', '连接 X 和 A。', [], 'cube', ['addSegmentByLabels'], ['X']],
    ['unknown-face-center', '在面 PQRS 的中心标 O。', [], 'cube', ['addFaceCenterPoint'], ['PQRS']],
    ['missing-face-distance', '标出点到平面的距离。', [], 'cube', ['addDistanceMeasurement'], ['需要确认']],
    ['missing-angle-objects', '标出这个图里的二面角。', [], 'cube', ['addAngleMeasurement', 'loadPresetScene'], ['需要确认']],
    ['curve-section-free', '生成球体，再随便作一个复杂截面。', [], 'empty', ['addCrossSectionByLabels'], ['需要确认']],
  ];
  for (const [id, instruction, types, context, forbidden, warnings] of negativeCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: forbidden,
      expectedWarnings: warnings,
      category: 'negative',
    }));
  }

  const comboCases = [
    ['combo-cube-center-diagonal', '生成正方体，标出中心 O，并连接 A 和 C1。', ['setGeometry', 'addCenterPoint', 'addSegmentByLabels']],
    ['combo-face-center-segment', '生成正方体，在底面 ABCD 中心标 O1，并连接 O1 和 A1。', ['setGeometry', 'addFaceCenterPoint', 'addSegmentByLabels']],
    ['combo-mid-section', '生成正方体，在 AB 中点标 M，用 M、C、A1 作截面。', ['setGeometry', 'addPointOnEdge', 'addCrossSectionByLabels']],
    ['combo-aux-angle', '生成正方体，作辅助面 ACC1，并标出 AC1 与底面 ABCD 的线面角。', ['setGeometry', 'addAuxiliaryFaceByLabels', 'addSegmentByLabels', 'addAngleMeasurement']],
    ['combo-circ-distance', '生成正方体，添加外接球，并标出 O 到 A 的距离。', ['setGeometry', 'addCircumsphere', 'addCenterPoint', 'addDistanceMeasurement']],
    ['combo-current-center-distance', '在当前正方体中标出中心 O，并标出 O 到 A 的距离。', ['addCenterPoint', 'addDistanceMeasurement'], 'cube'],
    ['combo-current-face-center-lines', '在底面 ABCD 中心标 O1，连接 O1A 和 O1C。', ['addFaceCenterPoint', 'addSegmentByLabels', 'addSegmentByLabels'], 'cube'],
    ['combo-current-mid-angle', '取 AB 中点 M，连接 MC1，并标出 MC1 与底面 ABCD 的角。', ['addPointOnEdge', 'addSegmentByLabels', 'addAngleMeasurement'], 'cube'],
    ['combo-current-section-style', '用 A、C、A1 作截面，并把 AC 标红。', ['addCrossSectionByLabels', 'setStyle'], 'cube'],
    ['combo-current-hide-add', '隐藏上底面 A1B1C1D1，然后连接 A 和 C1。', ['setVisible', 'addSegmentByLabels'], 'cube'],
    ['combo-preset-not-for-specific', '生成正方体，取 AB 中点 M，连接 M 和 C1，不要进入通用题图。', ['setGeometry', 'addPointOnEdge', 'addSegmentByLabels']],
    ['combo-specific-not-preset', '画一个正方体，在底面中心标 O1，再画外接球。', ['setGeometry', 'addFaceCenterPoint', 'addCircumsphere']],
  ];
  for (const [id, instruction, types, context = 'empty'] of comboCases) {
    cases.push(caseItem(id, instruction, types, {
      context,
      forbiddenOperationTypes: ['loadPresetScene'],
      category: 'combo',
    }));
  }

  return cases;
}

function buildCases(limit = 100) {
  const merged = [...fromExistingCases(), ...buildGeneratedCases()];
  const seen = new Set();
  const unique = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique.slice(0, limit);
}

function buildSnapshot(context) {
  return {
    envelope: {
      templateKey: DEFAULT_TEMPLATE_KEY,
      runtimeKey: 'visual_m01',
      snapshotSchemaVersion: 1,
    },
    payload: {
      scene: {
        entities: {},
        nextId: 1,
        activeGeometryId: null,
      },
    },
    context,
  };
}

function buildAiContext(context) {
  if (context !== 'cube') {
    return {
      availablePointLabels: [],
      labelProtocol: {
        plannedGeometryLabels: {
          cube: CUBE_LABELS,
        },
      },
      faces: [],
    };
  }
  return {
    availablePointLabels: CUBE_LABELS,
    availableSegmentLabels: CUBE_EDGES.map(([a, b]) => `${a}${b}`),
    faces: CUBE_FACES,
    labelProtocol: {
      plannedGeometryLabels: {
        cube: CUBE_LABELS,
      },
    },
  };
}

async function readSseResult(response) {
  const text = await response.text();
  const events = [];
  for (const block of text.split(/\n\n+/)) {
    const line = block.split(/\n/).find((item) => item.startsWith('data: '));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      events.push({ type: 'parse-error', raw: line.slice(6) });
    }
  }
  const result = events.find((event) => event.type === 'result');
  const error = events.find((event) => event.type === 'error');
  return { result, error, events, raw: text };
}

async function callAssist(testCase, options) {
  const snapshot = buildSnapshot(testCase.context);
  const body = {
    templateKey: options.templateKey,
    instanceId: options.instanceId,
    currentSnapshot: {
      envelope: snapshot.envelope,
      payload: snapshot.payload,
    },
    aiContext: buildAiContext(testCase.context),
    instruction: testCase.instruction,
  };
  const url = `${options.baseUrl.replace(/\/$/, '')}/api/v1/visual-center/assist`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const sse = await readSseResult(response);
    return {
      status: response.status,
      ok: response.ok,
      ...sse,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function scoreCase(testCase, assistResult) {
  const result = assistResult.result;
  if (!assistResult.ok || !result) {
    return {
      passed: false,
      strictPassed: false,
      semanticPassed: false,
      reason: assistResult.error?.message || `HTTP ${assistResult.status}`,
      actualOperationTypes: [],
      semanticOperationTypes: [],
      warnings: assistResult.error ? [assistResult.error.message] : [],
    };
  }

  const operations = Array.isArray(result.operations) ? result.operations : [];
  const actualOperationTypes = operations.map((item) => item?.type).filter(Boolean);
  const patchOperationTypes = inferPatchOperationTypes(result.patch);
  const semanticOperationTypes = [...actualOperationTypes, ...patchOperationTypes];
  const warnings = Array.isArray(result.warnings) ? result.warnings.map(String) : [];
  const expected = testCase.expectedOperationTypes;
  const forbidden = testCase.forbiddenOperationTypes ?? [];
  const expectedWarnings = testCase.expectedWarnings ?? [];

  const exactTypes =
    actualOperationTypes.length === expected.length &&
    actualOperationTypes.every((type, index) => type === expected[index]);
  const semanticTypes = containsExpectedTypes(expected, semanticOperationTypes);
  const noForbidden = forbidden.every((type) => !semanticOperationTypes.includes(type));
  const warningsOk =
    expectedWarnings.length === 0
      ? true
      : expectedWarnings.every((needle) => warnings.some((warning) => warning.includes(needle)));

  const strictPassed = exactTypes && noForbidden && warningsOk;
  const semanticPassed = semanticTypes && noForbidden && warningsOk;
  const failures = [];
  if (!exactTypes) failures.push(`expected ${JSON.stringify(expected)} got ${JSON.stringify(actualOperationTypes)}`);
  if (!semanticTypes) failures.push(`semantic expected ${JSON.stringify(expected)} got ${JSON.stringify(semanticOperationTypes)}`);
  if (!noForbidden) failures.push(`forbidden present ${JSON.stringify(forbidden.filter((type) => semanticOperationTypes.includes(type)))}`);
  if (!warningsOk) failures.push(`missing warnings ${JSON.stringify(expectedWarnings)}`);

  return {
    passed: semanticPassed,
    strictPassed,
    semanticPassed,
    reason: failures.join('; '),
    actualOperationTypes,
    patchOperationTypes,
    semanticOperationTypes,
    warnings,
    explanation: typeof result.explanation === 'string' ? result.explanation : '',
  };
}

function inferPatchOperationTypes(patch) {
  const types = new Set();
  const entities = patch?.scene?.entities;
  if (!entities || typeof entities !== 'object') return [];

  for (const entityPatch of Object.values(entities)) {
    if (!entityPatch || typeof entityPatch !== 'object') continue;
    if (Object.prototype.hasOwnProperty.call(entityPatch, 'visible')) {
      types.add('setVisible');
    }
    const properties = entityPatch.properties;
    if (!properties || typeof properties !== 'object') continue;
    if (Object.prototype.hasOwnProperty.call(properties, 'label')) {
      types.add('setLabel');
    }
    if (properties.style && typeof properties.style === 'object') {
      types.add('setStyle');
    }
  }
  return [...types];
}

function normalizeComparableType(type) {
  if (type === 'addMidpointByLabels') return 'addPointOnEdge';
  return type;
}

function containsExpectedTypes(expectedTypes, actualTypes) {
  const expectedCounts = countTypes(expectedTypes.map(normalizeComparableType));
  const actualCounts = countTypes(actualTypes.map(normalizeComparableType));
  for (const [type, count] of expectedCounts.entries()) {
    if ((actualCounts.get(type) || 0) < count) return false;
  }
  return true;
}

function countTypes(types) {
  const counts = new Map();
  for (const type of types) {
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return counts;
}

function summarize(results) {
  const total = results.length;
  const strictPassed = results.filter((item) => item.score.strictPassed).length;
  const semanticPassed = results.filter((item) => item.score.semanticPassed).length;
  const byCategory = new Map();
  const byReason = new Map();
  for (const item of results) {
    const category = item.case.category || 'uncategorized';
    if (!byCategory.has(category)) byCategory.set(category, { total: 0, strictPassed: 0, semanticPassed: 0 });
    const bucket = byCategory.get(category);
    bucket.total += 1;
    if (item.score.strictPassed) bucket.strictPassed += 1;
    if (item.score.semanticPassed) bucket.semanticPassed += 1;
    if (!item.score.semanticPassed) {
      const reason = item.score.reason || 'unknown';
      byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }
  }
  return {
    total,
    passed: semanticPassed,
    failed: total - semanticPassed,
    accuracy: total === 0 ? 0 : semanticPassed / total,
    strictPassed,
    semanticPassed,
    strictFailed: total - strictPassed,
    semanticFailed: total - semanticPassed,
    strictAccuracy: total === 0 ? 0 : strictPassed / total,
    semanticAccuracy: total === 0 ? 0 : semanticPassed / total,
    byCategory: Object.fromEntries(
      [...byCategory.entries()].map(([key, value]) => [
        key,
        {
          ...value,
          strictAccuracy: value.total === 0 ? 0 : value.strictPassed / value.total,
          semanticAccuracy: value.total === 0 ? 0 : value.semanticPassed / value.total,
        },
      ]),
    ),
    topFailureReasons: [...byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count })),
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 100),
    categories: (args.find((arg) => arg.startsWith('--categories='))?.split('=')[1] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    out: args.find((arg) => arg.startsWith('--out='))?.split('=')[1] || path.join(__dirname, '..', 'results', 'ai-planning-eval.json'),
  };
}

async function main() {
  const args = parseArgs();
  const allCases = buildCases(args.limit);
  const categorySet = new Set(args.categories);
  const cases = categorySet.size > 0 ? allCases.filter((item) => categorySet.has(item.category)) : allCases;

  if (args.dryRun) {
    console.log(JSON.stringify({ total: cases.length, cases }, null, 2));
    return;
  }

  const options = {
    baseUrl: process.env.M01_ASSIST_BASE_URL || DEFAULT_BASE_URL,
    token: process.env.M01_ASSIST_TOKEN || '',
    instanceId: process.env.M01_INSTANCE_ID || DEFAULT_INSTANCE_ID,
    templateKey: process.env.M01_TEMPLATE_KEY || DEFAULT_TEMPLATE_KEY,
    requestTimeoutMs: Number(process.env.M01_ASSIST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS),
  };

  if (!options.token) {
    throw new Error('Missing M01_ASSIST_TOKEN. Set it to a valid Bearer token for /api/v1/visual-center/assist.');
  }
  if (!process.env.M01_INSTANCE_ID) {
    throw new Error('Missing M01_INSTANCE_ID. Use an existing m01 visual_template_instance id owned by the token user.');
  }

  const results = [];
  for (let index = 0; index < cases.length; index += 1) {
    const testCase = cases[index];
    process.stdout.write(`[${index + 1}/${cases.length}] ${testCase.id} ... `);
    try {
      const assistResult = await callAssist(testCase, options);
      const score = scoreCase(testCase, assistResult);
      results.push({ case: testCase, score, assist: assistResult.result ?? assistResult.error ?? null });
      if (score.strictPassed) {
        console.log('PASS');
      } else if (score.semanticPassed) {
        console.log(`SEMANTIC ${score.reason}`);
      } else {
        console.log(`FAIL ${score.reason}`);
      }
    } catch (error) {
      const score = {
        passed: false,
        strictPassed: false,
        semanticPassed: false,
        reason: error instanceof Error ? error.message : String(error),
        actualOperationTypes: [],
        semanticOperationTypes: [],
        warnings: [],
      };
      results.push({ case: testCase, score, assist: null });
      console.log(`ERROR ${score.reason}`);
    }
  }

  const summary = summarize(results);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify({ summary, results }, null, 2) + '\n');

  console.log('\nSummary');
  console.log(`Total: ${summary.total}`);
  console.log(`Strict passed: ${summary.strictPassed}`);
  console.log(`Strict failed: ${summary.strictFailed}`);
  console.log(`Strict accuracy: ${(summary.strictAccuracy * 100).toFixed(1)}%`);
  console.log(`Semantic passed: ${summary.semanticPassed}`);
  console.log(`Semantic failed: ${summary.semanticFailed}`);
  console.log(`Semantic accuracy: ${(summary.semanticAccuracy * 100).toFixed(1)}%`);
  console.log(`Report: ${args.out}`);
  console.log('\nBy category');
  for (const [category, bucket] of Object.entries(summary.byCategory)) {
    console.log(
      `- ${category}: strict ${bucket.strictPassed}/${bucket.total} (${(bucket.strictAccuracy * 100).toFixed(1)}%), ` +
        `semantic ${bucket.semanticPassed}/${bucket.total} (${(bucket.semanticAccuracy * 100).toFixed(1)}%)`,
    );
  }
  if (summary.topFailureReasons.length > 0) {
    console.log('\nTop failure reasons');
    for (const item of summary.topFailureReasons) {
      console.log(`- ${item.count}x ${item.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
