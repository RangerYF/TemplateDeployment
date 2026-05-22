import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import type { Entity, PointProperties } from '@/editor/entities/types';
import { useEntityStore, useSelectionStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import type { Vec3, BuilderResult, PolyhedronResult, SurfaceResult } from '@/engine/types';
import { isPolyhedronEdgeHidden, splitSurfaceCircleByVisibility, splitSurfaceLineByVisibility } from '@/engine/visibility';
import type { CurveSplit } from '@/engine/visibility';
import { usePointPosition } from './usePointPosition';
import { useContextMenuStore } from '../contextMenuStore';
import { projectPointToCurve } from '@/utils/curveProjection';
import { registerRenderer } from './index';

const EDGE_COLOR = '#1a1a1a';
const EDGE_WIDTH = 2;
const HIDDEN_EDGE_COLOR = '#b0b0b0';
const HIDDEN_EDGE_WIDTH = 1.5;
const EDGE_SELECTED_COLOR = '#00C06B';
const EDGE_SELECTED_WIDTH = 3;
const EDGE_HOVERED_COLOR = '#60a5fa';
const EDGE_HOVERED_WIDTH = 2.5;
const HITBOX_RADIUS = 0.06;
const VISIBILITY_UPDATE_INTERVAL_MS = 66;

// ─── SegmentEntityRenderer ───

function SegmentEntityRenderer({ entity }: { entity: Entity }) {
  const segEntity = entity as Entity<'segment'>;
  const props = segEntity.properties;
  const isSelected = useSelectionStore((s) => s.selectedIds.includes(entity.id));
  const isHovered = useSelectionStore((s) => s.hoveredId === entity.id);

  // 曲线段：有 lineIndex 时从 builder result 动态获取，否则用静态 curvePoints
  if (props.curvePoints || props.lineIndex !== undefined) {
    return (
      <DynamicCurveSegment
        entity={segEntity}
        isSelected={isSelected}
        isHovered={isHovered}
      />
    );
  }

  return (
    <StraightSegmentWrapper
      entity={segEntity}
      isSelected={isSelected}
      isHovered={isHovered}
    />
  );
}

/** 曲线段包装：从 builder result 动态获取 curvePoints，参数变化时自动更新 */
function DynamicCurveSegment({
  entity,
  isSelected,
  isHovered,
}: {
  entity: Entity<'segment'>;
  isSelected: boolean;
  isHovered: boolean;
}) {
  const props = entity.properties;
  const result = useBuilderResult(props.geometryId);

  const curvePoints = useMemo(() => {
    if (props.lineIndex !== undefined && result && result.kind === 'surface') {
      const line = result.lines[props.lineIndex];
      if (line) return line.points as Vec3[];
    }
    return props.curvePoints as Vec3[] | undefined;
  }, [props.lineIndex, props.curvePoints, result]);

  const lineType = useMemo(() => {
    if (props.lineIndex !== undefined && result && result.kind === 'surface') {
      return result.lines[props.lineIndex]?.type;
    }
    return undefined;
  }, [props.lineIndex, result]);

  if (!curvePoints || curvePoints.length < 2) return null;

  return (
    <CurveSegment
      entity={entity}
      curvePoints={curvePoints}
      isSelected={isSelected}
      isHovered={isHovered}
      lineType={lineType}
      surfaceResult={result?.kind === 'surface' ? result as SurfaceResult : null}
    />
  );
}

/** 直线段包装：需要查询端点位置 */
function StraightSegmentWrapper({
  entity,
  isSelected,
  isHovered,
}: {
  entity: Entity<'segment'>;
  isSelected: boolean;
  isHovered: boolean;
}) {
  const props = entity.properties;

  const startPoint = useEntityStore((s) => s.getEntity(props.startPointId)) as Entity<'point'> | undefined;
  const endPoint = useEntityStore((s) => s.getEntity(props.endPointId)) as Entity<'point'> | undefined;

  const startPos = usePointPosition(startPoint);
  const endPos = usePointPosition(endPoint);

  const result = useBuilderResult(props.builtIn ? props.geometryId : null);

  const startVertexIndex = useMemo(() => {
    if (!startPoint || startPoint.type !== 'point') return -1;
    const c = (startPoint.properties as PointProperties).constraint;
    return c.type === 'vertex' ? c.vertexIndex : -1;
  }, [startPoint]);

  const endVertexIndex = useMemo(() => {
    if (!endPoint || endPoint.type !== 'point') return -1;
    const c = (endPoint.properties as PointProperties).constraint;
    return c.type === 'vertex' ? c.vertexIndex : -1;
  }, [endPoint]);

  if (!startPos || !endPos) return null;

  if (props.builtIn) {
    return (
      <BuiltInSegment
        entity={entity}
        startPos={startPos}
        endPos={endPos}
        isSelected={isSelected}
        isHovered={isHovered}
        builderResult={result}
        startVertexIndex={startVertexIndex}
        endVertexIndex={endVertexIndex}
      />
    );
  }

  return (
    <UserSegment
      entity={entity}
      startPos={startPos}
      endPos={endPos}
      isSelected={isSelected}
      isHovered={isHovered}
    />
  );
}

// ─── builtIn 棱线 ───

const DEFAULT_BUILTIN_COLOR = '#000000';

function BuiltInSegment({
  entity,
  startPos,
  endPos,
  isSelected,
  isHovered,
  builderResult,
  startVertexIndex,
  endVertexIndex,
}: {
  entity: Entity<'segment'>;
  startPos: Vec3;
  endPos: Vec3;
  isSelected: boolean;
  isHovered: boolean;
  builderResult: BuilderResult | null;
  startVertexIndex: number;
  endVertexIndex: number;
}) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const userStyle = entity.properties.style;
  const hasCustomColor = userStyle.color !== DEFAULT_BUILTIN_COLOR;

  useFrame(({ camera }) => {
    if (!builderResult || builderResult.kind !== 'polyhedron' || startVertexIndex < 0 || endVertexIndex < 0) {
      if (hiddenRef.current) { hiddenRef.current = false; setHidden(false); }
      return;
    }
    const poly = builderResult as PolyhedronResult;
    const camPos: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    const verts = poly.vertices.map((v) => v.position);
    const h = isPolyhedronEdgeHidden(verts, poly.faces, startVertexIndex, endVertexIndex, camPos);
    if (h !== hiddenRef.current) { hiddenRef.current = h; setHidden(h); }
  });

  const interacting = isSelected || isHovered;
  const baseColor = hasCustomColor ? userStyle.color : EDGE_COLOR;
  const color = isSelected ? EDGE_SELECTED_COLOR : isHovered ? EDGE_HOVERED_COLOR : hidden && !hasCustomColor ? HIDDEN_EDGE_COLOR : baseColor;
  const lineWidth = isSelected ? EDGE_SELECTED_WIDTH : isHovered ? EDGE_HOVERED_WIDTH : hidden ? HIDDEN_EDGE_WIDTH : EDGE_WIDTH;
  const forceDashed = userStyle.dashed;
  const dashed = forceDashed || (hidden && !interacting);

  return (
    <group>
      <Line
        points={[startPos, endPos]}
        color={color}
        lineWidth={lineWidth}
        dashed={dashed}
        dashScale={dashed ? 10 : 1}
        dashSize={dashed ? 0.15 : 1}
        gapSize={dashed ? 0.1 : 0}
        opacity={hidden && hasCustomColor && !interacting ? 0.4 : 1}
        transparent={hidden && hasCustomColor && !interacting}
      />
      <SegmentHitbox entity={entity} startPos={startPos} endPos={endPos} />
      {entity.properties.label && (
        <SegmentLabel
          label={entity.properties.label}
          startPos={startPos}
          endPos={endPos}
          color={EDGE_SELECTED_COLOR}
        />
      )}
    </group>
  );
}

// ─── 用户线段 ───

function UserSegment({
  entity,
  startPos,
  endPos,
  isSelected,
  isHovered,
}: {
  entity: Entity<'segment'>;
  startPos: Vec3;
  endPos: Vec3;
  isSelected: boolean;
  isHovered: boolean;
}) {
  const props = entity.properties;
  const color = isSelected ? EDGE_SELECTED_COLOR : isHovered ? EDGE_HOVERED_COLOR : props.style.color;
  const lineWidth = isSelected ? EDGE_SELECTED_WIDTH : isHovered ? EDGE_HOVERED_WIDTH : EDGE_WIDTH;

  return (
    <group>
      <Line
        points={[startPos, endPos]}
        color={color}
        lineWidth={lineWidth}
        dashed={props.style.dashed}
        dashScale={props.style.dashed ? 10 : 1}
        dashSize={props.style.dashed ? 0.15 : 1}
        gapSize={props.style.dashed ? 0.1 : 0}
      />
      <SegmentHitbox entity={entity} startPos={startPos} endPos={endPos} />
      {props.label && (
        <SegmentLabel
          label={props.label}
          startPos={startPos}
          endPos={endPos}
          color={color}
        />
      )}
      <SegmentLengthLabel startPos={startPos} endPos={endPos} />
    </group>
  );
}

// ─── 不可见命中体积 ───

function SegmentHitbox({
  entity,
  startPos,
  endPos,
}: {
  entity: Entity<'segment'>;
  startPos: Vec3;
  endPos: Vec3;
}) {
  const openMenu = useContextMenuStore((s) => s.openMenu);

  const transform = useMemo(() => {
    const mid: Vec3 = [
      (startPos[0] + endPos[0]) / 2,
      (startPos[1] + endPos[1]) / 2,
      (startPos[2] + endPos[2]) / 2,
    ];
    const dir = new THREE.Vector3(
      endPos[0] - startPos[0],
      endPos[1] - startPos[1],
      endPos[2] - startPos[2],
    );
    const length = dir.length();
    if (length === 0) return null;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    );
    return { position: mid, quaternion: quat, length };
  }, [startPos, endPos]);

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();

      // 计算命中点在线段上的 t 参数
      const hit = e.point;
      const ax = startPos[0], ay = startPos[1], az = startPos[2];
      const bx = endPos[0], by = endPos[1], bz = endPos[2];
      const segX = bx - ax, segY = by - ay, segZ = bz - az;
      const lenSq = segX * segX + segY * segY + segZ * segZ;
      const hitT = lenSq > 0
        ? Math.max(0, Math.min(1, ((hit.x - ax) * segX + (hit.y - ay) * segY + (hit.z - az) * segZ) / lenSq))
        : 0;

      openMenu({
        screenPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        targetEntityId: entity.id,
        targetEntityType: 'segment',
        hitT,
      });
    },
    [entity.id, startPos, endPos, openMenu],
  );

  if (!transform) return null;

  return (
    <mesh
      position={transform.position}
      quaternion={transform.quaternion}
      userData={{ entityId: entity.id, entityType: 'segment' }}
      onContextMenu={handleContextMenu}
    >
      <cylinderGeometry args={[HITBOX_RADIUS, HITBOX_RADIUS, transform.length, 6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ─── 曲线段（curvePoints） ───

function CurveSegment({
  entity,
  curvePoints,
  isSelected,
  isHovered,
  lineType,
  surfaceResult,
}: {
  entity: Entity<'segment'>;
  curvePoints: Vec3[];
  isSelected: boolean;
  isHovered: boolean;
  lineType?: string;
  surfaceResult?: SurfaceResult | null;
}) {
  const openMenu = useContextMenuStore((s) => s.openMenu);
  const interacting = isSelected || isHovered;
  const baseColor = isSelected ? EDGE_SELECTED_COLOR : isHovered ? EDGE_HOVERED_COLOR : EDGE_COLOR;
  const baseLineWidth = isSelected ? EDGE_SELECTED_WIDTH : isHovered ? EDGE_HOVERED_WIDTH : EDGE_WIDTH;

  const isGeneratrix = lineType === 'generatrix';
  const isCircleLike = lineType === 'baseCircle' || lineType === 'topCircle' || lineType === 'equator' || lineType === 'meridian';
  const needsVisibility = isGeneratrix || isCircleLike;

  const [split, setSplit] = useState<CurveSplit>(() => ({
    visibleSegments: [curvePoints],
    hiddenSegments: [],
  }));
  const splitRef = useRef(split);
  const lastCameraKeyRef = useRef('');
  const lastVisibilityUpdateRef = useRef(0);

  useEffect(() => {
    if (!needsVisibility) return;
    splitRef.current = split;
    lastCameraKeyRef.current = '';
    lastVisibilityUpdateRef.current = 0;
  }, [curvePoints, needsVisibility, split, surfaceResult, lineType]);

  useFrame(({ camera, clock }) => {
    if (!needsVisibility || interacting) return;

    const now = clock.elapsedTime * 1000;
    if (now - lastVisibilityUpdateRef.current < VISIBILITY_UPDATE_INTERVAL_MS) return;
    lastVisibilityUpdateRef.current = now;

    const cameraKey = `${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`;
    if (cameraKey === lastCameraKeyRef.current) return;
    lastCameraKeyRef.current = cameraKey;

    const camPos: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    const nextSplit = isGeneratrix
      ? splitSurfaceLineByVisibility(curvePoints, camPos, surfaceResult)
      : splitSurfaceCircleByVisibility(curvePoints, camPos, lineType, surfaceResult);

    if (!areCurveSplitsEqual(splitRef.current, nextSplit)) {
      splitRef.current = nextSplit;
      setSplit(nextSplit);
    }
  });

  const handleContextMenu = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      const hit = e.point;
      const hitT = projectPointToCurve(hit.x, hit.y, hit.z, curvePoints);
      openMenu({
        screenPosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        targetEntityId: entity.id,
        targetEntityType: 'segment',
        hitT,
      });
    },
    [entity.id, curvePoints, openMenu],
  );

  if (needsVisibility) {
    return (
      <group onContextMenu={handleContextMenu}>
        {interacting && (
          <Line points={curvePoints} color={baseColor} lineWidth={baseLineWidth} />
        )}
        {!interacting && split.visibleSegments.map((segment, index) => (
          segment.length >= 2 ? (
            <Line
              key={`visible-${index}`}
              points={segment}
              color={EDGE_COLOR}
              lineWidth={EDGE_WIDTH}
            />
          ) : null
        ))}
        {!interacting && split.hiddenSegments.map((segment, index) => (
          segment.length >= 2 ? (
            <Line
              key={`hidden-${index}`}
              points={segment}
              color={HIDDEN_EDGE_COLOR}
              lineWidth={HIDDEN_EDGE_WIDTH}
              dashed
              dashScale={10}
              dashSize={0.15}
              gapSize={0.1}
            />
          ) : null
        ))}
        <CurveHitbox entity={entity} curvePoints={curvePoints} />
      </group>
    );
  }

  return (
    <group onContextMenu={handleContextMenu}>
      <Line points={curvePoints} color={baseColor} lineWidth={baseLineWidth} />
      <CurveHitbox entity={entity} curvePoints={curvePoints} />
    </group>
  );
}

function areCurveSplitsEqual(a: CurveSplit, b: CurveSplit): boolean {
  return areSegmentGroupsEqual(a.visibleSegments, b.visibleSegments)
    && areSegmentGroupsEqual(a.hiddenSegments, b.hiddenSegments);
}

function areSegmentGroupsEqual(a: Vec3[][], b: Vec3[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!arePointListsEqual(a[i], b[i])) return false;
  }
  return true;
}

function arePointListsEqual(a: Vec3[], b: Vec3[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      Math.abs(a[i][0] - b[i][0]) > 1e-4 ||
      Math.abs(a[i][1] - b[i][1]) > 1e-4 ||
      Math.abs(a[i][2] - b[i][2]) > 1e-4
    ) {
      return false;
    }
  }
  return true;
}

/** 曲线不可见命中体积（TubeGeometry 沿曲线路径） */
function CurveHitbox({
  entity,
  curvePoints,
}: {
  entity: Entity<'segment'>;
  curvePoints: Vec3[];
}) {
  const geometry = useMemo(() => {
    if (curvePoints.length < 2) return null;
    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < curvePoints.length - 1; i++) {
      curvePath.add(
        new THREE.LineCurve3(
          new THREE.Vector3(...curvePoints[i]),
          new THREE.Vector3(...curvePoints[i + 1]),
        ),
      );
    }
    return new THREE.TubeGeometry(curvePath, curvePoints.length - 1, HITBOX_RADIUS, 4, false);
  }, [curvePoints]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      userData={{ entityId: entity.id, entityType: 'segment' }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ─── 线段标签 ───

function SegmentLabel({
  label,
  startPos,
  endPos,
  color,
}: {
  label: string;
  startPos: Vec3;
  endPos: Vec3;
  color: string;
}) {
  const midPos: Vec3 = useMemo(
    () => [
      (startPos[0] + endPos[0]) / 2,
      (startPos[1] + endPos[1]) / 2,
      (startPos[2] + endPos[2]) / 2,
    ],
    [startPos, endPos],
  );

  return (
    <Html position={midPos} center distanceFactor={8}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color,
          background: 'rgba(255,255,255,0.9)',
          padding: '0 4px',
          borderRadius: 3,
          border: `1px solid ${color}`,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transform: 'translateY(-18px)',
        }}
      >
        {label}
      </div>
    </Html>
  );
}

// ─── 长度标签（用户线段） ───

function SegmentLengthLabel({
  startPos,
  endPos,
}: {
  startPos: Vec3;
  endPos: Vec3;
}) {
  const { midPos, length } = useMemo(() => {
    const dx = endPos[0] - startPos[0];
    const dy = endPos[1] - startPos[1];
    const dz = endPos[2] - startPos[2];
    return {
      midPos: [
        (startPos[0] + endPos[0]) / 2,
        (startPos[1] + endPos[1]) / 2,
        (startPos[2] + endPos[2]) / 2,
      ] as Vec3,
      length: Math.sqrt(dx * dx + dy * dy + dz * dz),
    };
  }, [startPos, endPos]);

  return (
    <Html position={midPos} center distanceFactor={8}>
      <div
        style={{
          fontSize: 10,
          color: '#6b7280',
          background: 'rgba(255,255,255,0.85)',
          padding: '0 3px',
          borderRadius: 2,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transform: 'translateY(12px)',
        }}
      >
        {length.toFixed(2)}
      </div>
    </Html>
  );
}

registerRenderer('segment', SegmentEntityRenderer);

export { SegmentEntityRenderer };
