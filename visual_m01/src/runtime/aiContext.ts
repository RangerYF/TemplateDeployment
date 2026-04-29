import type { Entity, FaceProperties, GeometryProperties, PointProperties, SegmentProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store/entityStore';

type AiContextPoint = {
  id: string;
  label: string;
  kind: PointProperties['constraint']['type'];
  vertexIndex?: number;
  edge?: { start: number; end: number; t: number };
  builtIn: boolean;
  visible: boolean;
};

type AiContextSegment = {
  id: string;
  label?: string;
  labels?: [string, string];
  builtIn: boolean;
  visible: boolean;
  style: SegmentProperties['style'];
};

type AiContextFace = {
  id: string;
  labels: string[];
  builtIn: boolean;
  visible: boolean;
};

export type M01AiContext = {
  templateKey: 'm01';
  summary: string;
  geometry: {
    id: string;
    type: GeometryProperties['geometryType'];
    params: GeometryProperties['params'];
  } | null;
  availablePointLabels: string[];
  points: AiContextPoint[];
  segments: AiContextSegment[];
  faces: AiContextFace[];
  counts: {
    points: number;
    segments: number;
    faces: number;
  };
  labelProtocol: {
    actualPointLabels: string[];
    plannedGeometryLabels: Record<string, string[]>;
    instruction: string;
  };
  constraints: string[];
};

const PLANNED_GEOMETRY_LABELS: Record<string, string[]> = {
  cube: ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'],
  cuboid: ['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1'],
  prism: ['A', 'B', 'C', '...', 'A1', 'B1', 'C1', '...'],
  pyramid: ['A', 'B', 'C', '...', 'P'],
  regularTetrahedron: ['A', 'B', 'C', 'D'],
  cornerTetrahedron: ['A', 'B', 'C', 'D'],
  isoscelesTetrahedron: ['A', 'B', 'C', 'D'],
  orthogonalTetrahedron: ['A', 'B', 'C', 'D'],
  sphere: ['O'],
  cylinder: ['O', 'O1'],
  cone: ['O', 'P'],
  truncatedCone: ['O', 'O1'],
  frustum: ['A', 'B', 'C', '...', 'A1', 'B1', 'C1', '...'],
};

function pointLabelById(points: Entity<'point'>[]): Map<string, string> {
  return new Map(points.map((point) => [point.id, (point.properties as PointProperties).label]));
}

function describeGeometry(geometry: Entity<'geometry'> | undefined) {
  if (!geometry) return null;
  const props = geometry.properties as GeometryProperties;
  return {
    id: geometry.id,
    type: props.geometryType,
    params: props.params,
  };
}

function describePoint(point: Entity<'point'>): AiContextPoint {
  const props = point.properties as PointProperties;
  const item: AiContextPoint = {
    id: point.id,
    label: props.label,
    kind: props.constraint.type,
    builtIn: props.builtIn,
    visible: point.visible,
  };

  if (props.constraint.type === 'vertex') {
    item.vertexIndex = props.constraint.vertexIndex;
  }
  if (props.constraint.type === 'edge') {
    item.edge = {
      start: props.constraint.edgeStart,
      end: props.constraint.edgeEnd,
      t: props.constraint.t,
    };
  }
  return item;
}

function describeSegment(segment: Entity<'segment'>, labelsById: Map<string, string>): AiContextSegment {
  const props = segment.properties as SegmentProperties;
  const startLabel = labelsById.get(props.startPointId);
  const endLabel = labelsById.get(props.endPointId);
  return {
    id: segment.id,
    label: props.label,
    labels: startLabel && endLabel ? [startLabel, endLabel] : undefined,
    builtIn: props.builtIn,
    visible: segment.visible,
    style: props.style,
  };
}

function describeFace(face: Entity<'face'>, labelsById: Map<string, string>): AiContextFace {
  const props = face.properties as FaceProperties;
  return {
    id: face.id,
    labels: props.pointIds.map((pointId) => labelsById.get(pointId)).filter((label): label is string => Boolean(label)),
    builtIn: props.builtIn,
    visible: face.visible,
  };
}

export function buildM01AiContext(): M01AiContext {
  const store = useEntityStore.getState();
  const geometry = store.getActiveGeometry();
  const entities = Object.values(store.entities);
  const points = entities.filter((entity): entity is Entity<'point'> => entity.type === 'point');
  const segments = entities.filter((entity): entity is Entity<'segment'> => entity.type === 'segment');
  const faces = entities.filter((entity): entity is Entity<'face'> => entity.type === 'face');
  const labelsById = pointLabelById(points);
  const pointItems = points.map(describePoint);
  const segmentItems = segments.map((segment) => describeSegment(segment, labelsById));
  const faceItems = faces.map((face) => describeFace(face, labelsById));
  const availablePointLabels = pointItems.map((point) => point.label).filter(Boolean);
  const geometryInfo = describeGeometry(geometry);

  return {
    templateKey: 'm01',
    summary: geometryInfo
      ? `当前是 ${geometryInfo.type}，可用点：${availablePointLabels.join('、') || '无'}。`
      : '当前没有主几何体。',
    geometry: geometryInfo,
    availablePointLabels,
    points: pointItems,
    segments: segmentItems,
    faces: faceItems,
    counts: {
      points: pointItems.length,
      segments: segmentItems.length,
      faces: faceItems.length,
    },
    labelProtocol: {
      actualPointLabels: availablePointLabels,
      plannedGeometryLabels: PLANNED_GEOMETRY_LABELS,
      instruction: '生成点相关 operations 时，点名必须来自当前 availablePointLabels，或来自本次 setGeometry 计划创建几何体的 plannedGeometryLabels。不要根据常见教材命名习惯自动猜测不存在的点名；如果用户点名不存在，请返回 warnings 让用户确认。',
    },
    constraints: [
      '不要使用当前点集或计划几何体标准点集之外的点名。',
      '如果用户要求连接、取点或作截面但点名不存在，不要生成对应 operation，返回 warnings。',
      '涉及面、角度或点面距离时，优先使用 aiContext.faces 中的 face id 或 face labels，不要猜测不存在的面。',
      '只有用户明确指定当前存在的点，或指令不依赖具体点名时，才生成点相关 operation。',
    ],
  };
}
