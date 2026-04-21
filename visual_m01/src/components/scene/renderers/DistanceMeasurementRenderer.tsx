import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import type { Entity } from '@/editor/entities/types';
import { useEntityStore, useSelectionStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from './usePointPosition';
import {
  getPointPointVisData,
  getPointLineVisData,
  getPointFaceVisData,
  getLineLineVisData,
  getLineFaceVisData,
} from '@/engine/math/distanceCalculator';
import type { Vec3, BuilderResult } from '@/engine/types';
import { registerRenderer } from './index';

const DIST_COLOR = '#8b5cf6';
const DIST_SELECTED_COLOR = '#00C06B';
const DIST_WIDTH = 2;

// ─── 辅助函数 ───

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

function getPointPos(
  pointId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): Vec3 | null {
  const pe = entities[pointId];
  if (!pe || pe.type !== 'point') return null;
  return computePointPosition((pe as Entity<'point'>).properties, result);
}

// ─── 直角标记 ───

function RightAngleMark({ position, dir1, dir2, size = 0.08 }: {
  position: Vec3;
  dir1: Vec3;
  dir2: Vec3;
  size?: number;
}) {
  const points = useMemo(() => {
    const p: Vec3 = position;
    const a: Vec3 = [p[0] + dir1[0] * size, p[1] + dir1[1] * size, p[2] + dir1[2] * size];
    const c: Vec3 = [p[0] + dir2[0] * size, p[1] + dir2[1] * size, p[2] + dir2[2] * size];
    const b: Vec3 = [
      p[0] + (dir1[0] + dir2[0]) * size,
      p[1] + (dir1[1] + dir2[1]) * size,
      p[2] + (dir1[2] + dir2[2]) * size,
    ];
    return [a, b, c];
  }, [position, dir1, dir2, size]);

  return <Line points={points} color="#666" lineWidth={1.5} />;
}

// ─── 法向量工具 ───

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecNormalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ─── 主渲染器 ───

function DistanceMeasurementRenderer({ entity }: { entity: Entity }) {
  const dmEntity = entity as Entity<'distanceMeasurement'>;
  const props = dmEntity.properties;
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entity.id));
  const isHovered = useSelectionStore((s) => s.hoveredId === entity.id);

  const color = isSelected ? DIST_SELECTED_COLOR : isHovered ? '#60a5fa' : DIST_COLOR;

  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);

  const visResult = useMemo(() => {
    if (!result) return null;

    if (props.kind === 'pointPoint') {
      const [pid1, pid2] = props.entityIds;
      const pos1 = getPointPos(pid1, entities, result);
      const pos2 = getPointPos(pid2, entities, result);
      if (!pos1 || !pos2) return null;

      const vis = getPointPointVisData(pos1, pos2);
      return {
        type: 'pointPoint' as const,
        linePoints: [vis.point1, vis.point2] as [Vec3, Vec3],
        labelPos: [(vis.point1[0] + vis.point2[0]) / 2, (vis.point1[1] + vis.point2[1]) / 2, (vis.point1[2] + vis.point2[2]) / 2] as Vec3,
      };
    }

    if (props.kind === 'pointLine') {
      const [pointId, segId] = props.entityIds;
      const pointPos = getPointPos(pointId, entities, result);
      const ep = getSegmentEndpoints(segId, entities, result);
      if (!pointPos || !ep) return null;

      const vis = getPointLineVisData(pointPos, ep.start, ep.end);
      const perpDir = vecNormalize(vecSub(vis.point, vis.foot));
      const lineDir = vis.lineDir;

      return {
        type: 'pointLine' as const,
        linePoints: [vis.point, vis.foot] as [Vec3, Vec3],
        labelPos: [(vis.point[0] + vis.foot[0]) / 2, (vis.point[1] + vis.foot[1]) / 2, (vis.point[2] + vis.foot[2]) / 2] as Vec3,
        rightAngle: { position: vis.foot, dir1: perpDir, dir2: lineDir },
      };
    }

    if (props.kind === 'lineFace') {
      const [segId, faceId] = props.entityIds;
      const ep = getSegmentEndpoints(segId, entities, result);
      const facePositions = getFacePositions(faceId, entities, result);
      if (!ep || !facePositions) return null;

      const vis = getLineFaceVisData(ep.start, ep.end, facePositions);
      const perpDir = vecNormalize(vecSub(vis.linePoint, vis.foot));
      const faceDir = vecNormalize(vecSub(facePositions[1], facePositions[0]));

      return {
        type: 'lineFace' as const,
        linePoints: [vis.linePoint, vis.foot] as [Vec3, Vec3],
        labelPos: [(vis.linePoint[0] + vis.foot[0]) / 2, (vis.linePoint[1] + vis.foot[1]) / 2, (vis.linePoint[2] + vis.foot[2]) / 2] as Vec3,
        rightAngle: { position: vis.foot, dir1: perpDir, dir2: faceDir },
      };
    }

    if (props.kind === 'pointFace') {
      const [pointId, faceId] = props.entityIds;
      const pointPos = getPointPos(pointId, entities, result);
      const facePositions = getFacePositions(faceId, entities, result);
      if (!pointPos || !facePositions) return null;

      const vis = getPointFaceVisData(pointPos, facePositions);
      // 垂线方向和面法线方向（用于直角标记）
      const perpDir = vecNormalize(vecSub(vis.point, vis.foot));
      // 面上一个方向（用于直角标记的第二个方向）
      const faceDir = vecNormalize(vecSub(facePositions[1], facePositions[0]));

      return {
        type: 'pointFace' as const,
        linePoints: [vis.point, vis.foot] as [Vec3, Vec3],
        labelPos: [(vis.point[0] + vis.foot[0]) / 2, (vis.point[1] + vis.foot[1]) / 2, (vis.point[2] + vis.foot[2]) / 2] as Vec3,
        rightAngle: { position: vis.foot, dir1: perpDir, dir2: faceDir },
      };
    }

    if (props.kind === 'lineLine') {
      const [segId1, segId2] = props.entityIds;
      const ep1 = getSegmentEndpoints(segId1, entities, result);
      const ep2 = getSegmentEndpoints(segId2, entities, result);
      if (!ep1 || !ep2) return null;

      const vis = getLineLineVisData(ep1.start, ep1.end, ep2.start, ep2.end);
      // 公垂线方向
      const perpDir = vecNormalize(vecSub(vis.point2, vis.point1));
      // 线1方向（用于直角标记）
      const line1Dir = vecNormalize(vecSub(ep1.end, ep1.start));
      // 线2方向
      const line2Dir = vecNormalize(vecSub(ep2.end, ep2.start));

      return {
        type: 'lineLine' as const,
        linePoints: [vis.point1, vis.point2] as [Vec3, Vec3],
        labelPos: [(vis.point1[0] + vis.point2[0]) / 2, (vis.point1[1] + vis.point2[1]) / 2, (vis.point1[2] + vis.point2[2]) / 2] as Vec3,
        rightAngle1: { position: vis.point1, dir1: perpDir, dir2: line1Dir },
        rightAngle2: { position: vis.point2, dir1: vecNormalize(vecSub(vis.point1, vis.point2)), dir2: line2Dir },
      };
    }

    return null;
  }, [props.kind, props.entityIds, entities, result]);

  if (!visResult) return null;

  return (
    <group>
      {/* 虚线段 */}
      <Line
        points={visResult.linePoints}
        color={color}
        lineWidth={DIST_WIDTH}
        dashed
        dashSize={0.06}
        gapSize={0.04}
      />

      {/* 直角标记 */}
      {visResult.type === 'pointLine' && 'rightAngle' in visResult && (
        <RightAngleMark {...visResult.rightAngle} />
      )}
      {visResult.type === 'pointFace' && (
        <RightAngleMark {...visResult.rightAngle} />
      )}
      {visResult.type === 'lineFace' && 'rightAngle' in visResult && (
        <RightAngleMark {...visResult.rightAngle} />
      )}
      {visResult.type === 'lineLine' && (
        <>
          <RightAngleMark {...visResult.rightAngle1} />
          <RightAngleMark {...visResult.rightAngle2} />
        </>
      )}

      {/* 距离标签 */}
      <DistanceLabel
        position={visResult.labelPos}
        value={props.distanceValue}
        latex={props.distanceLatex}
        color={color}
      />

      {/* 命中体积 */}
      <DistanceHitbox entity={entity} linePoints={visResult.linePoints} />
    </group>
  );
}

// ─── 距离标签 ───

function DistanceLabel({
  position,
  value,
  latex,
  color,
}: {
  position: Vec3;
  value: number;
  latex: string;
  color: string;
}) {
  const displayText = latex.includes('\\') ? `d ≈ ${value.toFixed(2)}` : `d = ${latex}`;

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

// ─── 命中体积 ───

function DistanceHitbox({
  entity,
  linePoints,
}: {
  entity: Entity;
  linePoints: [Vec3, Vec3];
}) {
  const geometry = useMemo(() => {
    const [p1, p2] = linePoints;
    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    curvePath.add(new THREE.LineCurve3(new THREE.Vector3(...p1), new THREE.Vector3(...p2)));
    return new THREE.TubeGeometry(curvePath, 1, 0.05, 4, false);
  }, [linePoints]);

  return (
    <mesh
      geometry={geometry}
      userData={{ entityId: entity.id, entityType: 'distanceMeasurement' }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

registerRenderer('distanceMeasurement', DistanceMeasurementRenderer);

export { DistanceMeasurementRenderer };
