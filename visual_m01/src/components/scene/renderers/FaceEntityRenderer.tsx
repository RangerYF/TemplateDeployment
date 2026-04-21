import { useMemo, useCallback } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import type { Entity, FaceSource } from '@/editor/entities/types';
import { useEntityStore, useSelectionStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import type { Vec3, SurfaceResult } from '@/engine/types';
import { registerRenderer } from './index';
import { computePointPosition } from './usePointPosition';
import { useContextMenuStore } from '../contextMenuStore';

const FACE_COLOR = '#9ca3af';
const FACE_OPACITY = 0.12;
const FACE_HOVERED_COLOR = '#60a5fa';
const FACE_HOVERED_OPACITY = 0.2;
const FACE_SELECTED_COLOR = '#00C06B';
const FACE_SELECTED_OPACITY = 0.25;
const CROSS_SECTION_COLOR = '#3b82f6';
const CROSS_SECTION_OPACITY = 0.35;

// ─── FaceEntityRenderer ───

function useFaceStyle(entityId: string) {
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entityId));
  const isHovered = useSelectionStore((s) => s.hoveredId === entityId);
  if (isSelected) return { color: FACE_SELECTED_COLOR, opacity: FACE_SELECTED_OPACITY };
  if (isHovered) return { color: FACE_HOVERED_COLOR, opacity: FACE_HOVERED_OPACITY };
  return { color: FACE_COLOR, opacity: FACE_OPACITY };
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
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entity.id));
  const isHovered = useSelectionStore((s) => s.hoveredId === entity.id);

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

  const meshColor = isSelected ? FACE_SELECTED_COLOR : isHovered ? FACE_HOVERED_COLOR : CROSS_SECTION_COLOR;
  const meshOpacity = isSelected ? FACE_SELECTED_OPACITY : isHovered ? FACE_HOVERED_OPACITY : CROSS_SECTION_OPACITY;

  return (
    <group>
      <FaceMesh entityId={entity.id} positions={positions} color={meshColor} opacity={meshOpacity} />
      <Line
        points={[...positions, positions[0]]}
        color={CROSS_SECTION_COLOR}
        lineWidth={2}
      />
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
