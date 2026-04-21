import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import type {
  Entity,
  PointProperties,
  GeometryProperties,
  CoordinateSystemProperties,
} from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import { buildCoordinateSystem, buildCoordinateSystemFromAxes } from '@/engine/math/coordinates';
import { computePointPosition } from './usePointPosition';
import type { Vec3 } from '@/engine/types';
import { registerRenderer } from './index';

const AXIS_COLORS: [string, string, string] = ['#ef4444', '#22c55e', '#3b82f6'];
const AXIS_LABELS = ['x', 'y', 'z'];

const AXIS_LENGTH = 3;

function CoordSystemRenderer({ entity }: { entity: Entity }) {
  const csEntity = entity as Entity<'coordinateSystem'>;
  const csProps = csEntity.properties as CoordinateSystemProperties;
  const { originPointId, geometryId } = csProps;

  const entitiesMap = useEntityStore((s) => s.entities);

  const pointEntity = useMemo(() => {
    const e = entitiesMap[originPointId];
    return e?.type === 'point' ? (e as Entity<'point'>) : undefined;
  }, [entitiesMap, originPointId]);

  const geometryType = useMemo(() => {
    const e = entitiesMap[geometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).geometryType : undefined;
  }, [entitiesMap, geometryId]);

  const result = useBuilderResult(geometryId);

  // 收集该几何体的所有点（不仅 vertex，也包括 edge/curve/face/coordinate/free 点）
  const allPoints = useMemo(() => {
    const points: Entity<'point'>[] = [];
    for (const e of Object.values(entitiesMap)) {
      if (e.type !== 'point') continue;
      const p = e.properties as PointProperties;
      if (p.geometryId === geometryId) {
        points.push(e as Entity<'point'>);
      }
    }
    return points;
  }, [entitiesMap, geometryId]);

  // 计算坐标系：优先使用 csProps.axes（用户指定），否则走旧的自动推断
  const coordSystem = useMemo(() => {
    if (!pointEntity || !result) return null;

    // 获取原点 3D 位置（支持任意约束类型）
    const originPos = computePointPosition(pointEntity.properties, result);
    if (!originPos) return null;

    // 新路径：用户指定了轴方向
    if (csProps.axes) {
      const axes: [Vec3, Vec3, Vec3] = csProps.axes as [Vec3, Vec3, Vec3];
      return buildCoordinateSystemFromAxes(originPos, axes, result);
    }

    // 旧路径 fallback：仅 vertex 约束 + 自动推断
    if (!geometryType) return null;
    const constraint = pointEntity.properties.constraint;
    if (constraint.type !== 'vertex') return null;
    return buildCoordinateSystem(geometryType, result, constraint.vertexIndex);
  }, [pointEntity, geometryType, result, csProps.axes]);

  // 计算所有点的坐标值
  const pointCoordData = useMemo(() => {
    if (!coordSystem || !result) return [];
    const { origin, axes } = coordSystem;

    return allPoints
      .map((pt) => {
        // 跳过原点自身
        if (pt.id === originPointId) return null;

        const pos = computePointPosition(pt.properties, result);
        if (!pos) return null;

        const rel: Vec3 = [pos[0] - origin[0], pos[1] - origin[1], pos[2] - origin[2]];
        const coord: Vec3 = [
          rel[0] * axes[0][0] + rel[1] * axes[0][1] + rel[2] * axes[0][2],
          rel[0] * axes[1][0] + rel[1] * axes[1][1] + rel[2] * axes[1][2],
          rel[0] * axes[2][0] + rel[1] * axes[2][1] + rel[2] * axes[2][2],
        ];

        return { pos, coord, label: pt.properties.label };
      })
      .filter(Boolean) as { pos: Vec3; coord: Vec3; label: string }[];
  }, [coordSystem, result, allPoints, originPointId]);

  const axisData = useMemo(() => {
    if (!coordSystem) return [];
    const { origin, axes } = coordSystem;
    return axes.map((dir, i) => {
      const end: Vec3 = [
        origin[0] + dir[0] * AXIS_LENGTH,
        origin[1] + dir[1] * AXIS_LENGTH,
        origin[2] + dir[2] * AXIS_LENGTH,
      ];
      const ticks: Vec3[] = [];
      for (let t = 1; t <= Math.floor(AXIS_LENGTH); t++) {
        ticks.push([
          origin[0] + dir[0] * t,
          origin[1] + dir[1] * t,
          origin[2] + dir[2] * t,
        ]);
      }
      return { end, ticks, color: AXIS_COLORS[i], label: AXIS_LABELS[i] };
    });
  }, [coordSystem]);

  if (!coordSystem) return null;

  return (
    <group>
      {axisData.map((axis, i) => (
        <group key={i}>
          <Line points={[coordSystem.origin, axis.end]} color={axis.color} lineWidth={2.5} />
          <Html position={axis.end} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: axis.color, fontStyle: 'italic', pointerEvents: 'none', transform: 'translateY(-12px)' }}>
              {axis.label}
            </div>
          </Html>
          {axis.ticks.map((tick, j) => (
            <mesh key={j} position={tick}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color={axis.color} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={coordSystem.origin}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#000" />
      </mesh>
      <Html position={coordSystem.origin} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#000', pointerEvents: 'none', transform: 'translate(-14px, -12px)' }}>
          O
        </div>
      </Html>
      <VertexCoordLabels vertices={pointCoordData} />
    </group>
  );
}

function VertexCoordLabels({ vertices }: { vertices: { pos: Vec3; coord: Vec3; label: string }[] }) {
  return (
    <>
      {vertices.map(({ pos, coord }, i) => {
        const formatted = `(${fmtCoord(coord[0])}, ${fmtCoord(coord[1])}, ${fmtCoord(coord[2])})`;
        return (
          <Html key={i} position={pos} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                fontSize: 10,
                color: '#6b7280',
                background: 'rgba(255,255,255,0.85)',
                padding: '0 3px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                transform: 'translateY(14px)',
              }}
            >
              {formatted}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function fmtCoord(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

registerRenderer('coordinateSystem', CoordSystemRenderer);

export { CoordSystemRenderer };
