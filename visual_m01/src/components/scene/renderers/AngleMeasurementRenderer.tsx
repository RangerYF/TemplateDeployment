import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import type { Entity } from '@/editor/entities/types';
import { useEntityStore, useSelectionStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from './usePointPosition';
import {
  getDihedralVisData,
  getLineFaceVisData,
  getLineLineVisData,
  generateArcPoints,
} from '@/engine/math/angleCalculator';
import type { Vec3, BuilderResult } from '@/engine/types';
import { registerRenderer } from './index';

const ARC_COLOR = '#f97316';
const ARC_SELECTED_COLOR = '#00C06B';
const ARC_WIDTH = 2.5;
const ARC_RADIUS = 0.3;

// ─── 命令式工具函数（避免 zustand 选择器产生新引用） ───

function getSegmentEndpoints(
  segmentId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): { start: Vec3; end: Vec3 } | null {
  const seg = entities[segmentId];
  if (!seg || seg.type !== 'segment') return null;
  const props = (seg as Entity<'segment'>).properties;

  const sp = entities[props.startPointId];
  const ep = entities[props.endPointId];
  if (!sp || sp.type !== 'point' || !ep || ep.type !== 'point') return null;

  const startPos = computePointPosition((sp as Entity<'point'>).properties, result);
  const endPos = computePointPosition((ep as Entity<'point'>).properties, result);
  if (!startPos || !endPos) return null;
  return { start: startPos, end: endPos };
}

function getFacePositions(
  faceId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): Vec3[] | null {
  const face = entities[faceId];
  if (!face || face.type !== 'face') return null;
  const pointIds = (face as Entity<'face'>).properties.pointIds;

  const positions: Vec3[] = [];
  for (const pid of pointIds) {
    const pe = entities[pid];
    if (!pe || pe.type !== 'point') return null;
    const pos = computePointPosition((pe as Entity<'point'>).properties, result);
    if (!pos) return null;
    positions.push(pos);
  }
  return positions.length >= 3 ? positions : null;
}

/**
 * 从两个面 ID 查找共享棱线的端点坐标
 */
function findSharedEdgeEndpoints(
  faceId1: string,
  faceId2: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): { start: Vec3; end: Vec3 } | null {
  const face1 = entities[faceId1];
  const face2 = entities[faceId2];
  if (!face1 || face1.type !== 'face' || !face2 || face2.type !== 'face') return null;

  const f1Points = (face1 as Entity<'face'>).properties.pointIds;
  const f2Points = (face2 as Entity<'face'>).properties.pointIds;
  const sharedPointIds = f1Points.filter((pid: string) => f2Points.includes(pid));
  if (sharedPointIds.length < 2) return null;

  // 查找两端点都在 sharedPointIds 中的 segment
  for (const e of Object.values(entities)) {
    if (e.type !== 'segment') continue;
    const sp = (e as Entity<'segment'>).properties;
    if (sharedPointIds.includes(sp.startPointId) && sharedPointIds.includes(sp.endPointId)) {
      return getSegmentEndpoints(e.id, entities, result);
    }
  }

  // 如果没找到 segment，直接用共享点坐标
  const p1 = entities[sharedPointIds[0]];
  const p2 = entities[sharedPointIds[1]];
  if (!p1 || p1.type !== 'point' || !p2 || p2.type !== 'point') return null;
  const pos1 = computePointPosition((p1 as Entity<'point'>).properties, result);
  const pos2 = computePointPosition((p2 as Entity<'point'>).properties, result);
  if (!pos1 || !pos2) return null;
  return { start: pos1, end: pos2 };
}

// ─── 主渲染器 ───

function AngleMeasurementRenderer({ entity }: { entity: Entity }) {
  const amEntity = entity as Entity<'angleMeasurement'>;
  const props = amEntity.properties;
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entity.id));
  const isHovered = useSelectionStore((s) => s.hoveredId === entity.id);

  const color = isSelected ? ARC_SELECTED_COLOR : isHovered ? '#60a5fa' : ARC_COLOR;

  // 唯一的响应式依赖：几何体参数变化 → builderResult 变化
  const result = useBuilderResult(props.geometryId);

  // 用 entities 快照 + result 命令式计算一切
  // entities 在 store 层是 Record，zustand 选择器直接返回引用是稳定的
  const entities = useEntityStore((s) => s.entities);

  const visResult = useMemo(() => {
    if (!result) return null;

    if (props.kind === 'dihedral') {
      const [faceId1, faceId2] = props.entityIds;
      const edgeEndpoints = findSharedEdgeEndpoints(faceId1, faceId2, entities, result);
      if (!edgeEndpoints) return null;

      const face1Pos = getFacePositions(faceId1, entities, result);
      const face2Pos = getFacePositions(faceId2, entities, result);
      if (!face1Pos || !face2Pos) return null;

      const visData = getDihedralVisData(edgeEndpoints.start, edgeEndpoints.end, face1Pos, face2Pos);
      const arcPts = generateArcPoints(visData.arcCenter, visData.dir1, visData.dir2, ARC_RADIUS, visData.angleRadians);
      return { arcPoints: arcPts };
    }

    if (props.kind === 'lineFace') {
      const [segId, faceId] = props.entityIds;
      const endpoints = getSegmentEndpoints(segId, entities, result);
      if (!endpoints) return null;

      const facePts = getFacePositions(faceId, entities, result);
      if (!facePts) return null;

      const visData = getLineFaceVisData(endpoints.start, endpoints.end, facePts);
      const arcPts = generateArcPoints(visData.arcCenter, visData.projDir, visData.lineDir, ARC_RADIUS, visData.angleRadians);
      return { arcPoints: arcPts };
    }

    if (props.kind === 'lineLine') {
      const [segId1, segId2] = props.entityIds;
      const ep1 = getSegmentEndpoints(segId1, entities, result);
      const ep2 = getSegmentEndpoints(segId2, entities, result);
      if (!ep1 || !ep2) return null;

      const visData = getLineLineVisData(ep1.start, ep1.end, ep2.start, ep2.end);
      const arcPts = generateArcPoints(visData.arcCenter, visData.dir1, visData.dir2, ARC_RADIUS, visData.angleRadians);
      return { arcPoints: arcPts };
    }

    return null;
  }, [props.kind, props.entityIds, entities, result]);

  if (!visResult || visResult.arcPoints.length < 2) return null;

  const { arcPoints } = visResult;
  const labelPos = arcPoints[Math.floor(arcPoints.length / 2)];

  return (
    <group>
      <Line points={arcPoints} color={color} lineWidth={ARC_WIDTH} />
      <AngleLabel position={labelPos} text={props.angleLatex} degrees={props.angleDegrees} color={color} />
      <AngleHitbox entity={entity} arcPoints={arcPoints} />
    </group>
  );
}

// ─── 角度标签 ───

function AngleLabel({
  position,
  text,
  degrees,
  color,
}: {
  position: Vec3;
  text: string;
  degrees: number;
  color: string;
}) {
  const displayText = text.includes('\\') ? `${degrees.toFixed(2)}°` : text;

  return (
    <Html position={position} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color,
          background: 'rgba(255,255,255,0.92)',
          padding: '1px 6px',
          borderRadius: 3,
          border: `1px solid ${color}`,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          transform: 'translateY(-14px)',
        }}
      >
        {displayText}
      </div>
    </Html>
  );
}

// ─── 不可见命中体积 ───

function AngleHitbox({
  entity,
  arcPoints,
}: {
  entity: Entity;
  arcPoints: Vec3[];
}) {
  const geometry = useMemo(() => {
    if (arcPoints.length < 2) return null;
    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < arcPoints.length - 1; i++) {
      curvePath.add(
        new THREE.LineCurve3(
          new THREE.Vector3(...arcPoints[i]),
          new THREE.Vector3(...arcPoints[i + 1]),
        ),
      );
    }
    return new THREE.TubeGeometry(curvePath, arcPoints.length - 1, 0.05, 4, false);
  }, [arcPoints]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      userData={{ entityId: entity.id, entityType: 'angleMeasurement' }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

registerRenderer('angleMeasurement', AngleMeasurementRenderer);

export { AngleMeasurementRenderer };
