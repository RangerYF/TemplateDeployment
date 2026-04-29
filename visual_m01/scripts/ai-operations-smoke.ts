import { applyAiOperations } from '../src/runtime/aiOperations';
import { resetEditor } from '../src/editor/init';
import { useEntityStore } from '../src/editor/store/entityStore';
import { useHistoryStore } from '../src/editor/store/historyStore';
import type {
  AngleMeasurementProperties,
  DistanceMeasurementProperties,
  Entity,
  FaceProperties,
  GeometryProperties,
  PointProperties,
  SegmentProperties,
} from '../src/editor/entities/types';

type Operation = Record<string, unknown>;

interface SmokeCase {
  name: string;
  operations: Operation[];
  assert: (ctx: CaseContext) => void;
  skipUndoRedo?: boolean;
}

interface CaseContext {
  result: Awaited<ReturnType<typeof applyAiOperations>>;
  beforeSnapshot: string;
  afterSnapshot: string;
  entities: Entity[];
}

function resetAll(): void {
  resetEditor();
  useHistoryStore.setState({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });
}

function snapshotString(): string {
  return JSON.stringify(useEntityStore.getState().getSnapshot());
}

function entities(): Entity[] {
  return Object.values(useEntityStore.getState().entities);
}

function byType<T extends Entity['type']>(type: T): Extract<Entity, { type: T }>[] {
  return entities().filter((entity) => entity.type === type) as Extract<Entity, { type: T }>[];
}

function labels(): string[] {
  return byType('point')
    .map((point) => (point.properties as PointProperties).label)
    .sort();
}

function faceIdByLabels(requiredLabels: string[]): string {
  const required = new Set(requiredLabels.map(normalizeLabel));
  const pointLabelById = new Map(
    byType('point').map((point) => [point.id, normalizeLabel((point.properties as PointProperties).label)]),
  );

  const face = byType('face').find((item) => {
    const itemLabels = (item.properties as FaceProperties).pointIds
      .map((id) => pointLabelById.get(id))
      .filter((label): label is string => Boolean(label));
    return itemLabels.length === required.size && itemLabels.every((label) => required.has(label));
  });

  if (!face) {
    throw new Error(`missing face ${requiredLabels.join('')}`);
  }
  return face.id;
}

function normalizeLabel(label: string): string {
  return label
    .replaceAll('₀', '0')
    .replaceAll('₁', '1')
    .replaceAll('₂', '2')
    .replaceAll('₃', '3')
    .replaceAll('₄', '4')
    .replaceAll('₅', '5')
    .replaceAll('₆', '6')
    .replaceAll('₇', '7')
    .replaceAll('₈', '8')
    .replaceAll('₉', '9')
    .toUpperCase();
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectOk(ctx: CaseContext, applied: number): void {
  expect(ctx.result.ok, `expected ok, got errors: ${ctx.result.errors.join('; ')}`);
  expect(ctx.result.applied === applied, `expected applied=${applied}, got ${ctx.result.applied}`);
  expect(!ctx.result.rolledBack, 'successful case should not be marked rolledBack');
  expect(useHistoryStore.getState().undoStack.length === 1, 'successful pipeline should be one undo command');
}

function summarize(): Record<string, unknown> {
  const all = entities();
  const geometry = byType('geometry')[0];
  const distances = byType('distanceMeasurement').map((item) => item.properties as DistanceMeasurementProperties);
  const angles = byType('angleMeasurement').map((item) => item.properties as AngleMeasurementProperties);
  const segments = byType('segment').map((item) => item.properties as SegmentProperties);

  return {
    total: all.length,
    geometryType: geometry ? (geometry.properties as GeometryProperties).geometryType : null,
    pointLabels: labels(),
    segments: segments
      .map((segment) => segment.label)
      .filter(Boolean),
    faces: byType('face').length,
    circumSpheres: byType('circumSphere').length,
    distances: distances.map((item) => ({
      kind: item.kind,
      value: Number(item.distanceValue.toFixed(6)),
      latex: item.distanceLatex,
    })),
    angles: angles.map((item) => ({
      kind: item.kind,
      degrees: Number(item.angleDegrees.toFixed(6)),
      latex: item.angleLatex,
    })),
    history: {
      undo: useHistoryStore.getState().undoStack.length,
      redo: useHistoryStore.getState().redoStack.length,
      canUndo: useHistoryStore.getState().canUndo,
      canRedo: useHistoryStore.getState().canRedo,
    },
  };
}

const cases: SmokeCase[] = [
  {
    name: 'simple setGeometry sphere stays single operation',
    operations: [
      { type: 'setGeometry', geometryType: 'sphere', params: { radius: 2 } },
    ],
    assert(ctx) {
      expectOk(ctx, 1);
      expect(byType('geometry')[0]?.properties.geometryType === 'sphere', 'expected sphere geometry');
    },
  },
  {
    name: 'cube circumsphere pipeline builds center, diagonal, sphere, distance',
    operations: [
      { type: 'setGeometry', geometryType: 'cube', params: { sideLength: 2 } },
      { type: 'addCenterPoint', label: 'O' },
      { type: 'addSegmentByLabels', labels: ['A', 'C1'], label: 'AC1', style: { color: '#e74c3c', dashed: false } },
      { type: 'addCircumsphere' },
      { type: 'addDistanceMeasurement', kind: 'pointPoint', labels: ['O', 'A'] },
    ],
    assert(ctx) {
      expectOk(ctx, 5);
      expect(labels().includes('O'), 'expected center label O');
      expect(byType('circumSphere').length === 1, 'expected one circumsphere');
      expect(byType('distanceMeasurement').length === 1, 'expected one distance measurement');
    },
  },
  {
    name: 'midpoint and helper segment pipeline',
    operations: [
      { type: 'setGeometry', geometryType: 'cube', params: { sideLength: 2 } },
      { type: 'addMidpointByLabels', labels: ['A', 'B'], label: 'M' },
      { type: 'addSegmentByLabels', labels: ['M', 'C1'], label: 'MC1', style: { color: '#e74c3c', dashed: true } },
    ],
    assert(ctx) {
      expectOk(ctx, 3);
      expect(labels().includes('M'), 'expected midpoint M');
      expect(byType('segment').some((segment) => (segment.properties as SegmentProperties).label === 'MC1'), 'expected segment MC1');
    },
  },
  {
    name: 'face center, auxiliary face, distance and line-face angle',
    operations: [
      { type: 'setGeometry', geometryType: 'cube', params: { sideLength: 2 } },
      { type: 'addFaceCenterPoint', faceLabels: ['A', 'B', 'C', 'D'], label: 'O1' },
      { type: 'addAuxiliaryFaceByLabels', labels: ['A', 'C', 'C1'] },
      { type: 'addSegmentByLabels', labels: ['A', 'C1'], label: 'AC1' },
      { type: 'addDistanceMeasurement', kind: 'pointFace', labels: ['C1', 'A', 'B', 'C', 'D'] },
      { type: 'addAngleMeasurement', kind: 'lineFace', labels: ['A', 'C1', 'A', 'B', 'C', 'D'] },
    ],
    assert(ctx) {
      expectOk(ctx, 6);
      expect(labels().includes('O1'), 'expected face center O1');
      expect(byType('distanceMeasurement').some((item) => (item.properties as DistanceMeasurementProperties).kind === 'pointFace'), 'expected pointFace distance');
      expect(byType('angleMeasurement').some((item) => (item.properties as AngleMeasurementProperties).kind === 'lineFace'), 'expected lineFace angle');
    },
  },
  {
    name: 'dihedral accepts two face entity ids',
    skipUndoRedo: true,
    operations: [
      { type: 'setGeometry', geometryType: 'cube', params: { sideLength: 2 } },
    ],
    assert(ctx) {
      expectOk(ctx, 1);
      const faceA = faceIdByLabels(['A', 'B', 'C', 'D']);
      const faceB = faceIdByLabels(['A', 'B', 'B1', 'A1']);
      const before = snapshotString();
      return applyAiOperations([
        { type: 'addAngleMeasurement', kind: 'dihedral', entityIds: [faceA, faceB] },
      ]).then((result) => {
        expect(result.ok, `expected dihedral ok, got ${result.errors.join('; ')}`);
        expect(byType('angleMeasurement').some((item) => (item.properties as AngleMeasurementProperties).kind === 'dihedral'), 'expected dihedral angle');
        expect(snapshotString() !== before, 'expected dihedral to mutate snapshot');
      });
    },
  },
  {
    name: 'invalid point rolls back whole multi-step pipeline',
    operations: [
      { type: 'setGeometry', geometryType: 'cube', params: { sideLength: 2 } },
      { type: 'addSegmentByLabels', labels: ['A', 'X'], label: 'AX' },
    ],
    assert(ctx) {
      expect(!ctx.result.ok, 'expected failure');
      expect(ctx.result.rolledBack === true, 'expected rolledBack=true');
      expect(ctx.beforeSnapshot === ctx.afterSnapshot, 'expected snapshot restored after failed pipeline');
      expect(useHistoryStore.getState().undoStack.length === 0, 'expected no history after rollback');
    },
  },
];

async function runCase(testCase: SmokeCase): Promise<void> {
  resetAll();
  const beforeSnapshot = snapshotString();
  const result = await applyAiOperations(testCase.operations);
  const afterSnapshot = snapshotString();
  const ctx: CaseContext = {
    result,
    beforeSnapshot,
    afterSnapshot,
    entities: entities(),
  };

  await testCase.assert(ctx);

  if (result.ok && !testCase.skipUndoRedo) {
    const beforeUndo = snapshotString();
    useHistoryStore.getState().undo();
    expect(snapshotString() === beforeSnapshot, 'undo should restore pre-pipeline snapshot');
    useHistoryStore.getState().redo();
    expect(snapshotString() === beforeUndo, 'redo should restore post-pipeline snapshot');
  }

  console.log(JSON.stringify({
    name: testCase.name,
    result,
    summary: summarize(),
  }, null, 2));
}

async function main(): Promise<void> {
  let failed = 0;
  for (const testCase of cases) {
    try {
      await runCase(testCase);
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        name: testCase.name,
        error: error instanceof Error ? error.message : String(error),
        result: summarize(),
      }, null, 2));
    }
  }

  if (failed > 0) {
    throw new Error(`${failed} smoke case(s) failed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
