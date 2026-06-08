import { useMemo, useCallback } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Entity, FaceSource, PointProperties, SegmentProperties } from '@/editor/entities/types';
import { useEntityStore, useSelectionStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import type { Vec3, PolyhedronResult, SurfaceResult } from '@/engine/types';
import type { PointConstraint } from '@/editor/entities/types';
import { registerRenderer } from './index';
import { computePointPosition } from './usePointPosition';
import { useContextMenuStore } from '../contextMenuStore';
import {
  computeEdgeIntersections,
  dot as vecDot,
  cross as vecCross,
  sub as vecSub,
  vecLen,
  type Plane,
} from '@/editor/crossSectionHelper';

const FACE_COLOR = '#9ca3af';
const FACE_OPACITY = 0.12;
const FACE_HOVERED_COLOR = '#60a5fa';
const FACE_HOVERED_OPACITY = 0.2;
const FACE_SELECTED_COLOR = '#00C06B';
const FACE_SELECTED_OPACITY = 0.25;
const CROSS_SECTION_COLOR = '#3b82f6';
const CROSS_SECTION_OPACITY = 0.35;
const EXTENDED_PLANE_OPACITY = 0.12;

// ─── FaceEntityRenderer ───

function useFaceStyle(
  entityId: string,
  defaults: { color: string; opacity: number } = { color: FACE_COLOR, opacity: FACE_OPACITY },
) {
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entityId));
  const isHovered = useSelectionStore((s) => s.hoveredId === entityId);
  const customStyle = useEntityStore((s) => {
    const entity = s.entities[entityId];
    if (entity?.type === 'face') {
      return (entity.properties as import('@/editor/entities/types').FaceProperties).style;
    }
    return undefined;
  });
  if (isSelected) {
    if (customStyle) return { color: customStyle.color, opacity: customStyle.opacity };
    return { color: FACE_SELECTED_COLOR, opacity: FACE_SELECTED_OPACITY };
  }
  if (isHovered) return { color: FACE_HOVERED_COLOR, opacity: FACE_HOVERED_OPACITY };
  return {
    color: customStyle?.color ?? defaults.color,
    opacity: customStyle?.opacity ?? defaults.opacity,
  };
}

function FaceEntityRenderer({ entity }: { entity: Entity }) {
  const faceEntity = entity as Entity<'face'>;
  const props = faceEntity.properties;

  if (props.source.type === 'geometry') {
    return <GeometryFace entity={faceEntity} />;
  }

  if (props.source.type === 'surface') {
    return <SurfaceFace entity={faceEntity} />;
  }

  if (props.source.type === 'crossSection') {
    return <CrossSectionFace entity={faceEntity} />;
  }

  if (props.source.type === 'perpendicularPlane') {
    return <PerpendicularPlaneFace entity={faceEntity} />;
  }

  return <GenericFace entity={faceEntity} />;
}

// ─── 几何体面（builtIn） ───

function GeometryFace({ entity }: { entity: Entity<'face'> }) {
  const props = entity.properties;
  const result = useBuilderResult(props.geometryId);
  const style = useFaceStyle(entity.id);

  const entities = useEntityStore((s) => s.entities);
  const positions = useMemo(() => {
    if (!result) return null;
    const pts: Vec3[] = [];
    for (const pointId of props.pointIds) {
      const pointEntity = entities[pointId];
      if (!pointEntity || pointEntity.type !== 'point') return null;
      const pos = computePointPosition(
        pointEntity.properties as Entity<'point'>['properties'],
        result,
      );
      if (!pos) return null;
      pts.push(pos);
    }
    return pts;
  }, [props.pointIds, entities, result]);

  if (!positions || positions.length < 3) return null;

  return <FaceMesh entityId={entity.id} positions={positions} color={style.color} opacity={style.opacity} />;
}

// ─── 曲面体面（surface） ───

function SurfaceFace({ entity }: { entity: Entity<'face'> }) {
  const props = entity.properties;
  const source = props.source as Extract<FaceSource, { type: 'surface' }>;
  const result = useBuilderResult(props.geometryId);
  const style = useFaceStyle(entity.id);

  if (!result || result.kind !== 'surface') return null;

  const surfaceResult = result as SurfaceResult;
  const face = surfaceResult.faces[source.faceIndex];
  if (!face) return null;

  // 圆盘面：用采样点渲染多边形
  if (source.surfaceType === 'disk' && face.samplePoints && face.samplePoints.length >= 3) {
    return <FaceMesh entityId={entity.id} positions={face.samplePoints} color={style.color} opacity={style.opacity} />;
  }

  // 侧面/球面：用 Three.js 原生几何体渲染
  if (source.surfaceType === 'lateral' || source.surfaceType === 'sphere') {
    return <CurvedSurfaceMesh entity={entity} result={surfaceResult} style={style} />;
  }

  return null;
}

/** 曲面面渲染（侧面/球面），使用 Three.js 原生几何体 */
function CurvedSurfaceMesh({
  entity,
  result,
  style,
}: {
  entity: Entity<'face'>;
  result: SurfaceResult;
  style: { color: string; opacity: number };
}) {
  const openMenu = useContextMenuStore((s) => s.openMenu);

  const geometry = useMemo(() => {
    const [a0, a1, a2, a3] = result.geometryArgs;
    switch (result.geometryType) {
      case 'cone':
        // openEnded=true → 只有侧面，底面由 disk Face 渲染
        return new THREE.ConeGeometry(a0, a1, a2, 1, true);
      case 'cylinder':
        // openEnded=true → 只有侧面
        return new THREE.CylinderGeometry(a0, a0, a1, a2, 1, true);
      case 'truncatedCone':
        // CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, true)
        return new THREE.CylinderGeometry(a0, a1, a2, a3 ?? 64, 1, true);
      case 'sphere':
        return new THREE.SphereGeometry(a0, a1, a2);
      default:
        return null;
    }
  }, [result.geometryType, result.geometryArgs]);

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // Ctrl 穿透时不拦截，让事件冒泡到 ToolEventDispatcher 统一处理
      if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) {
        e.nativeEvent.preventDefault();
        return;
      }
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      openMenu({
        screenPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        targetEntityId: entity.id,
        targetEntityType: 'face',
        hitPoint: [e.point.x, e.point.y, e.point.z],
      });
    },
    [entity.id, openMenu],
  );

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      position={result.positionOffset}
      renderOrder={-1}
      userData={{ entityId: entity.id, entityType: 'face' }}
      onContextMenu={handleContextMenu}
    >
      <meshBasicMaterial
        transparent
        opacity={style.opacity}
        color={style.color}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── 截面面 ───

function CrossSectionFace({ entity }: { entity: Entity<'face'> }) {
  const props = entity.properties;
  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);
  const style = useFaceStyle(entity.id, {
    color: CROSS_SECTION_COLOR,
    opacity: CROSS_SECTION_OPACITY,
  });

  const positions = useMemo(() => {
    if (!result) return null;
    const pts: Vec3[] = [];
    for (const pointId of props.pointIds) {
      const pointEntity = entities[pointId];
      if (!pointEntity || pointEntity.type !== 'point') return null;
      const pos = computePointPosition(
        pointEntity.properties as Entity<'point'>['properties'],
        result,
      );
      if (!pos) return null;
      pts.push(pos);
    }
    return pts;
  }, [props.pointIds, entities, result]);

  if (!positions || positions.length < 3) return null;

  return (
    <group>
      <FaceMesh entityId={entity.id} positions={positions} color={style.color} opacity={style.opacity} />
      <Line
        points={[...positions, positions[0]]}
        color={style.color}
        lineWidth={2}
      />
      {props.showPlane && <ExtendedPlane positions={positions} color={style.color} />}
    </group>
  );
}

function ExtendedPlane({ positions, color }: { positions: Vec3[]; color: string }) {
  const planeData = useMemo(() => {
    const len = positions.length;
    const cx = positions.reduce((s, p) => s + p[0], 0) / len;
    const cy = positions.reduce((s, p) => s + p[1], 0) / len;
    const cz = positions.reduce((s, p) => s + p[2], 0) / len;

    let normal = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < len; i++) {
      const j = (i + 1) % len;
      const k = (i + 2) % len;
      const v1 = new THREE.Vector3(
        positions[j][0] - positions[i][0],
        positions[j][1] - positions[i][1],
        positions[j][2] - positions[i][2],
      );
      const v2 = new THREE.Vector3(
        positions[k][0] - positions[i][0],
        positions[k][1] - positions[i][1],
        positions[k][2] - positions[i][2],
      );
      const n = new THREE.Vector3().crossVectors(v1, v2);
      if (n.length() > 1e-8) {
        normal = n.normalize();
        break;
      }
    }

    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal,
    );

    const maxRadius = Math.max(
      ...positions.map((p) =>
        Math.sqrt((p[0] - cx) ** 2 + (p[1] - cy) ** 2 + (p[2] - cz) ** 2),
      ),
    );

    return {
      centroid: [cx, cy, cz] as [number, number, number],
      quaternion,
      size: Math.max(maxRadius * 5, 15),
    };
  }, [positions]);

  return (
    <mesh position={planeData.centroid} quaternion={planeData.quaternion} renderOrder={-2}>
      <planeGeometry args={[planeData.size, planeData.size]} />
      <meshBasicMaterial
        transparent
        opacity={EXTENDED_PLANE_OPACITY}
        color={color}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── 垂直平面（动态截面） ───

function deriveDirection(
  constraint: PointConstraint,
  result: PolyhedronResult,
  entities: Record<string, Entity>,
): Vec3 | null {
  if (constraint.type === 'segment') {
    const segEntity = entities[constraint.segmentId];
    if (!segEntity || segEntity.type !== 'segment') return null;
    const segProps = segEntity.properties as SegmentProperties;
    const startPt = entities[segProps.startPointId];
    const endPt = entities[segProps.endPointId];
    if (!startPt || startPt.type !== 'point' || !endPt || endPt.type !== 'point') return null;
    const startPos = computePointPosition(startPt.properties as PointProperties, result);
    const endPos = computePointPosition(endPt.properties as PointProperties, result);
    if (!startPos || !endPos) return null;
    return vecSub(endPos, startPos);
  }
  if (constraint.type === 'edge') {
    const va = result.vertices[constraint.edgeStart]?.position;
    const vb = result.vertices[constraint.edgeEnd]?.position;
    if (!va || !vb) return null;
    return vecSub(vb, va);
  }
  return null;
}

function deduplicatePositions(
  intersections: { edgeStart: number; edgeEnd: number; t: number }[],
  result: PolyhedronResult,
): Vec3[] {
  const EPSILON = 1e-6;
  const positions: Vec3[] = [];
  for (const inter of intersections) {
    const a = result.vertices[inter.edgeStart].position;
    const b = result.vertices[inter.edgeEnd].position;
    const pos: Vec3 = [
      a[0] + inter.t * (b[0] - a[0]),
      a[1] + inter.t * (b[1] - a[1]),
      a[2] + inter.t * (b[2] - a[2]),
    ];
    const isDuplicate = positions.some((existing) => {
      const dx = pos[0] - existing[0];
      const dy = pos[1] - existing[1];
      const dz = pos[2] - existing[2];
      return dx * dx + dy * dy + dz * dz < EPSILON * EPSILON;
    });
    if (!isDuplicate) positions.push(pos);
  }
  return positions;
}

function sortPositionsByAngle(positions: Vec3[], plane: Plane): void {
  const n = positions.length;
  if (n < 3) return;
  const cx = positions.reduce((s, p) => s + p[0], 0) / n;
  const cy = positions.reduce((s, p) => s + p[1], 0) / n;
  const cz = positions.reduce((s, p) => s + p[2], 0) / n;
  const d0: Vec3 = [positions[0][0] - cx, positions[0][1] - cy, positions[0][2] - cz];
  const d0Len = vecLen(d0);
  if (d0Len < 1e-10) return;
  const u: Vec3 = [d0[0] / d0Len, d0[1] / d0Len, d0[2] / d0Len];
  const v = vecCross(plane.normal, u);
  positions.sort((a, b) => {
    const ax = a[0] - cx, ay = a[1] - cy, az = a[2] - cz;
    const bx = b[0] - cx, by = b[1] - cy, bz = b[2] - cz;
    const angleA = Math.atan2(ax * v[0] + ay * v[1] + az * v[2], ax * u[0] + ay * u[1] + az * u[2]);
    const angleB = Math.atan2(bx * v[0] + by * v[1] + bz * v[2], bx * u[0] + by * u[1] + bz * u[2]);
    return angleA - angleB;
  });
}

function PerpendicularPlaneFace({ entity }: { entity: Entity<'face'> }) {
  const props = entity.properties;
  const source = props.source as Extract<FaceSource, { type: 'perpendicularPlane' }>;
  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);
  const style = useFaceStyle(entity.id, {
    color: CROSS_SECTION_COLOR,
    opacity: CROSS_SECTION_OPACITY,
  });

  const polygon = useMemo(() => {
    if (!result || result.kind !== 'polyhedron') return null;

    const pointEntity = entities[source.pointId];
    if (!pointEntity || pointEntity.type !== 'point') return null;
    const pointProps = pointEntity.properties as PointProperties;

    const throughPos = computePointPosition(pointProps, result);
    if (!throughPos) return null;

    const direction = deriveDirection(pointProps.constraint, result, entities);
    if (!direction) return null;

    const len = vecLen(direction);
    if (len < 1e-10) return null;
    const normal: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
    const d = vecDot(normal, throughPos);
    const plane: Plane = { normal, d };

    const intersections = computeEdgeIntersections(result, plane);
    if (intersections.length < 3) return null;

    const positions = deduplicatePositions(intersections, result);
    if (positions.length < 3) return null;

    sortPositionsByAngle(positions, plane);
    return positions;
  }, [result, entities, source.pointId]);

  if (!polygon || polygon.length < 3) return null;

  return (
    <group>
      <FaceMesh entityId={entity.id} positions={polygon} color={style.color} opacity={style.opacity} />
      <Line points={[...polygon, polygon[0]]} color={style.color} lineWidth={2} />
      {props.showPlane && <ExtendedPlane positions={polygon} color={style.color} />}
    </group>
  );
}

// ─── 通用面（custom 等） ───

function GenericFace({ entity }: { entity: Entity<'face'> }) {
  const props = entity.properties;
  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);
  const style = useFaceStyle(entity.id);

  const positions = useMemo(() => {
    if (!result) return null;
    const pts: Vec3[] = [];
    for (const pointId of props.pointIds) {
      const pointEntity = entities[pointId];
      if (!pointEntity || pointEntity.type !== 'point') return null;
      const pos = computePointPosition(
        pointEntity.properties as Entity<'point'>['properties'],
        result,
      );
      if (!pos) return null;
      pts.push(pos);
    }
    return pts;
  }, [props.pointIds, entities, result]);

  if (!positions || positions.length < 3) return null;

  return <FaceMesh entityId={entity.id} positions={positions} color={style.color} opacity={style.opacity} />;
}

// ─── 通用面 Mesh（三角扇） ───

function FaceMesh({
  entityId,
  positions,
  color,
  opacity,
}: {
  entityId: string;
  positions: Vec3[];
  color: string;
  opacity: number;
}) {
  const openMenu = useContextMenuStore((s) => s.openMenu);

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // Ctrl 穿透时不拦截，让事件冒泡到 ToolEventDispatcher 统一处理
      if (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey) {
        e.nativeEvent.preventDefault();
        return;
      }
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      openMenu({
        screenPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        targetEntityId: entityId,
        targetEntityType: 'face',
        hitPoint: [e.point.x, e.point.y, e.point.z],
      });
    },
    [entityId, openMenu],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(positions.length * 3);
    for (let i = 0; i < positions.length; i++) {
      posArr[i * 3] = positions[i][0];
      posArr[i * 3 + 1] = positions[i][1];
      posArr[i * 3 + 2] = positions[i][2];
    }
    const indices: number[] = [];
    for (let i = 1; i < positions.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [positions]);

  return (
    <mesh
      geometry={geometry}
      renderOrder={-1}
      userData={{ entityId, entityType: 'face' }}
      onContextMenu={handleContextMenu}
    >
      <meshBasicMaterial
        transparent
        opacity={opacity}
        color={color}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

registerRenderer('face', FaceEntityRenderer);

export { FaceEntityRenderer };
