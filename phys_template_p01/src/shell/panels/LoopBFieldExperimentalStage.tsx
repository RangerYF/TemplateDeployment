import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useSimulationStore } from '@/store';
import { type LoopCurrentDirection } from '@/domains/em/logic/current-direction';
import {
  computeLoopCenterField,
  getLoopFrontAxisLabel,
  getLoopTopFieldLabel,
  getLoopViewMode,
  type LoopViewMode,
} from '@/domains/em/logic/loop-current-teaching';
import {
  LOOP_CAMERA_DEFAULT_PITCH_DEG,
  LOOP_CAMERA_DEFAULT_YAW_DEG,
  LOOP_CAMERA_MAX_PITCH_DEG,
  LOOP_CAMERA_MIN_PITCH_DEG,
} from '@/domains/em/logic/loop-current-3d';
import {
  LOOP_LAB_STAGE_HEIGHT,
  LOOP_LAB_STAGE_WIDTH,
  buildLoopAxisLinePoints,
  buildLoopFieldLinePoints,
  buildProjectedLoopRing,
  findLoopWire,
  getNearestRingPoint,
  getLoopCompassVisual,
  getLoopCurrent,
  getLoopDirection,
  getLoopLabStageGeometry,
  getLoopRadius,
  getLoopVisibleSegments,
  pointsToSvgPath,
  projectLoopLabPoint,
  projectLoopLabVector,
  sampleLoopMagneticField,
  unprojectLoopLabPlanePoint,
  type LoopLabCameraState,
  type LoopLabCompassVisual,
  type LoopLabFieldSample,
  type LoopLabPoint3D,
  type LoopLabStageGeometry,
} from '@/domains/em/logic/loop-lab-visuals';

export type LoopDisplayMode = 'textbook' | 'observation' | 'direction' | 'intensity';

export interface LoopBFieldExperimentalStageProps {
  displayMode?: LoopDisplayMode;
  cameraResetVersion?: number;
}

interface StageCompassView {
  id: string;
  screen: { x: number; y: number };
  sample: LoopLabFieldSample;
  visual: LoopLabCompassVisual;
}

interface FieldLoopView {
  id: string;
  scale: number;
  planeIndex: number;
  points: Array<{ x: number; y: number; depth: number }>;
  path: string;
  visibleSegments: Array<Array<{ x: number; y: number; depth: number }>>;
}

interface FlowMarker {
  id: string;
  x: number;
  y: number;
  angleDeg: number;
  size: number;
  opacity: number;
}

interface AxisSampleView {
  id: string;
  screen: { x: number; y: number };
  projection: { from: { x: number; y: number }; to: { x: number; y: number }; angleDeg: number; length: number };
  visual: LoopLabCompassVisual;
  normalizedMagnitude: number;
}

interface LocalLoopHintView {
  hovered: boolean;
  segmentPath: string;
  orbitPaths: string[];
  orbitArrow: FlowMarker | null;
  noteScreen: { x: number; y: number };
  sample: LoopLabFieldSample;
}

const FIELD_LINE_SCALES = [0.04, 0.12, 0.22, 0.34, 0.5, 0.72, 0.98];
const CURRENT_ARROW_ANGLES = [-Math.PI / 3, Math.PI / 6, Math.PI * 5 / 6, Math.PI * 4 / 3];
const AXIS_SAMPLE_FACTORS = [-1.7, -1.25, -0.85, -0.45, 0, 0.45, 0.85, 1.25, 1.7];

const PAPER_BACKGROUND = '#f6fbff';
const PAPER_PANEL = 'rgba(255, 255, 255, 0.92)';
const PAPER_BORDER = 'rgba(117, 148, 177, 0.24)';
const PAPER_MUTED = '#69829a';
const PAPER_TEXT = '#20394f';
const FIELD_BLUE = '#2dabf8';
const FIELD_BLUE_STRONG = '#0f7ad8';
const FIELD_BLUE_LIGHT = 'rgba(45, 171, 248, 0.12)';
const CURRENT_ORANGE = '#ff8c57';
const CURRENT_ORANGE_DARK = '#c96d3e';
const NEEDLE_RED = '#e45e3a';
const NEEDLE_BLUE = '#3f6fa3';
const TEXTBOOK_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export function LoopBFieldExperimentalStage({
  displayMode = 'textbook',
  cameraResetVersion = 0,
}: LoopBFieldExperimentalStageProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const loopCompasses = useSimulationStore((s) => s.loopTeaching.compasses);
  const addLoopCompass = useSimulationStore((s) => s.addLoopCompass);
  const moveLoopCompass = useSimulationStore((s) => s.moveLoopCompass);

  const loop = useMemo(() => findLoopWire(entities), [entities]);
  const currentTarget = getLoopCurrent(loop, paramValues);
  const radiusTarget = getLoopRadius(loop, paramValues);
  const direction = getLoopDirection(loop);
  const viewMode = getLoopViewMode(paramValues);

  const animatedCurrent = useAnimatedNumber(currentTarget, 260);
  const animatedRadius = useAnimatedNumber(radiusTarget, 280);
  const time = useAnimationClock(displayMode !== 'textbook');
  const centerField = computeLoopCenterField(animatedCurrent, animatedRadius);
  const maxCenterField = computeLoopCenterField(20, 0.5);
  const fieldStrength = clamp(centerField / maxCenterField, 0, 1);
  const currentStrength = clamp((animatedCurrent - 0.5) / 19.5, 0, 1);

  const {
    camera,
    isInteracting,
    beginOrbit,
    updateOrbit,
    endOrbit,
  } = useLoopOrbitCamera(viewMode, cameraResetVersion);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const restoreLabelsTimerRef = useRef<number | null>(null);
  const [labelsDimmed, setLabelsDimmed] = useState(false);
  const [activeCompassId, setActiveCompassId] = useState<string | null>(null);
  const [hoveredRingIndex, setHoveredRingIndex] = useState<number | null>(null);
  const dragRef = useRef<{
    mode: 'none' | 'compass' | 'orbit';
    compassId: string | null;
    suppressClick: boolean;
    moved: boolean;
  }>({
    mode: 'none',
    compassId: null,
    suppressClick: false,
    moved: false,
  });

  const geometry = useMemo(() => getLoopLabStageGeometry(animatedRadius), [animatedRadius]);
  const fieldPlaneAngles = useMemo(
    () => getFieldPlaneAngles(displayMode, viewMode),
    [displayMode, viewMode],
  );
  const ringPoints = useMemo(
    () => buildProjectedLoopRing(animatedRadius, geometry, camera, 240),
    [animatedRadius, camera, geometry],
  );
  const ringVisibleSegments = useMemo(() => getLoopVisibleSegments(ringPoints, true), [ringPoints]);

  const fieldLoops = useMemo<FieldLoopView[]>(
    () =>
      fieldPlaneAngles.flatMap((azimuth, planeIndex) =>
        FIELD_LINE_SCALES.map((scale, scaleIndex) => {
          const points = buildLoopFieldLinePoints(
            azimuth,
            scale,
            geometry,
            camera,
            animatedCurrent,
            direction,
            168,
          );
          return {
            id: `field-${planeIndex}-${scaleIndex}`,
            scale,
            planeIndex,
            points,
            path: pointsToSvgPath(points, true),
            visibleSegments: getLoopVisibleSegments(points, true),
          };
        }),
      ),
    [animatedCurrent, camera, direction, fieldPlaneAngles, geometry],
  );

  const axisGuidePath = useMemo(
    () => pointsToSvgPath(buildLoopAxisLinePoints(0, geometry, camera)),
    [camera, geometry],
  );

  const currentDirectionArrows = useMemo(
    () =>
      CURRENT_ARROW_ANGLES.map((angle, index) => {
        const point = projectLoopLabPoint(
          {
            x: animatedRadius * Math.cos(angle),
            y: animatedRadius * Math.sin(angle),
            z: 0,
          },
          geometry,
          camera,
        );
        const tangent = getProjectedTangent(angle, animatedRadius, direction, geometry, camera);
        return {
          id: `current-direction-${index}`,
          point,
          angleDeg: tangent.angleDeg,
        };
      }),
    [animatedRadius, camera, direction, geometry],
  );

  const currentFlowMarkers = useMemo(
    () => buildCurrentFlowMarkers(animatedRadius, geometry, camera, direction, displayMode, currentStrength, time),
    [animatedRadius, camera, currentStrength, direction, displayMode, geometry, time],
  );

  const fieldFlowMarkers = useMemo(
    () => buildFieldFlowMarkers(fieldLoops, direction, displayMode, time),
    [direction, displayMode, fieldLoops, time],
  );

  const axisSamples = useMemo(
    () => buildAxisSamples(animatedRadius, animatedCurrent, direction, geometry, camera, centerField),
    [animatedCurrent, animatedRadius, camera, centerField, direction, geometry],
  );

  const compassViews = useMemo<StageCompassView[]>(
    () =>
      loopCompasses.map((compass) => {
        const point = { x: compass.x, y: compass.y, z: compass.z };
        const sample = sampleLoopMagneticField(point, animatedCurrent, animatedRadius, direction);
        return {
          id: compass.id,
          screen: projectLoopLabPoint(point, geometry, camera),
          sample,
          visual: getLoopCompassVisual(point, sample.vector, geometry, camera),
        };
      }),
    [animatedCurrent, animatedRadius, camera, direction, geometry, loopCompasses],
  );

  const centerProjection = useMemo(
    () => projectLoopLabVector(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: direction === 'counterclockwise' ? 1 : -1 },
      geometry,
      camera,
      0.72,
    ),
    [camera, direction, geometry],
  );

  const localHint = useMemo<LocalLoopHintView | null>(() => {
    const baseAngle = hoveredRingIndex === null
      ? getDefaultLoopHintAngle(viewMode)
      : (hoveredRingIndex / Math.max(ringPoints.length, 1)) * Math.PI * 2;
    return buildLocalLoopHint({
      angle: baseAngle,
      radius: animatedRadius,
      current: animatedCurrent,
      direction,
      geometry,
      camera,
      hovered: hoveredRingIndex !== null,
    });
  }, [animatedCurrent, animatedRadius, camera, direction, geometry, hoveredRingIndex, ringPoints.length, viewMode]);

  const modeNote = getDisplayModeNote(displayMode);
  const modeLabel = getDisplayModeLabel(displayMode);
  const currentDirectionLabel = direction === 'counterclockwise' ? '逆时针' : '顺时针';
  const centerDirectionLabel = viewMode === 'top'
    ? getLoopTopFieldLabel(direction)
    : `轴线${getLoopFrontAxisLabel(direction)}`;
  const helperOpacity = labelsDimmed ? 0.18 : 1;
  const useTextbookTopFigure = displayMode === 'textbook' && viewMode === 'top';

  useEffect(() => {
    if (!activeCompassId && compassViews.length > 0) {
      setActiveCompassId(compassViews[0]!.id);
    }
  }, [activeCompassId, compassViews]);

  useEffect(() => () => {
    if (restoreLabelsTimerRef.current !== null) {
      window.clearTimeout(restoreLabelsTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (isInteracting) {
      dimLabelsImmediately(restoreLabelsTimerRef, setLabelsDimmed);
      return;
    }
    restoreLabelsLater(restoreLabelsTimerRef, setLabelsDimmed);
  }, [isInteracting]);

  const handleStageMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (viewMode !== 'isometric') return;
    event.preventDefault();
    dragRef.current.mode = 'orbit';
    dragRef.current.compassId = null;
    dragRef.current.moved = false;
    setHoveredRingIndex(null);
    beginOrbit(event.clientX, event.clientY);
    dimLabelsImmediately(restoreLabelsTimerRef, setLabelsDimmed);
  };

  const handleStageMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragRef.current.mode === 'orbit') {
      event.preventDefault();
      dragRef.current.moved = true;
      updateOrbit(event.clientX, event.clientY);
      return;
    }

    if (dragRef.current.mode === 'compass' && dragRef.current.compassId && stageRef.current) {
      event.preventDefault();
      dragRef.current.moved = true;
      const stagePoint = getStagePoint(stageRef.current, event.clientX, event.clientY);
      const worldPoint = clampLoopPlanePoint(
        unprojectLoopLabPlanePoint(stagePoint.x, stagePoint.y, geometry, camera),
        animatedRadius,
      );
      moveLoopCompass(dragRef.current.compassId, worldPoint);
      setActiveCompassId(dragRef.current.compassId);
      setHoveredRingIndex(null);
      return;
    }

    if (!stageRef.current) return;
    const stagePoint = getStagePoint(stageRef.current, event.clientX, event.clientY);
    const nearest = getNearestRingPoint(stagePoint.x, stagePoint.y, ringPoints);
    const hoverThreshold = Math.max(18, geometry.tubeRadius * geometry.scale * 1.8);

    if (!nearest || nearest.distance > hoverThreshold) {
      setHoveredRingIndex((previous) => (previous === null ? previous : null));
      return;
    }

    setHoveredRingIndex((previous) => (previous === nearest.index ? previous : nearest.index));
  };

  const stopInteraction = (clearHover = false) => {
    if (dragRef.current.mode === 'orbit') {
      endOrbit();
    }
    dragRef.current.suppressClick = dragRef.current.moved;
    dragRef.current.mode = 'none';
    dragRef.current.compassId = null;
    dragRef.current.moved = false;
    if (clearHover) {
      setHoveredRingIndex(null);
    }
    restoreLabelsLater(restoreLabelsTimerRef, setLabelsDimmed);
  };

  const handleStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (displayMode !== 'observation') {
      dragRef.current.suppressClick = false;
      return;
    }
    if (dragRef.current.suppressClick || !stageRef.current) {
      dragRef.current.suppressClick = false;
      return;
    }

    const stagePoint = getStagePoint(stageRef.current, event.clientX, event.clientY);
    const worldPoint = clampLoopPlanePoint(
      unprojectLoopLabPlanePoint(stagePoint.x, stagePoint.y, geometry, camera),
      animatedRadius,
    );
    const id = `loop-compass-${crypto.randomUUID().slice(0, 8)}`;
    addLoopCompass({ id, ...worldPoint });
    setActiveCompassId(id);
  };

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 680,
        overflow: 'hidden',
        borderRadius: 12,
        border: `1px solid ${PAPER_BORDER}`,
        background: PAPER_BACKGROUND,
        cursor: dragRef.current.mode === 'orbit'
          ? 'grabbing'
          : viewMode === 'isometric'
            ? 'grab'
            : 'crosshair',
        touchAction: 'none',
      }}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={() => stopInteraction()}
      onMouseLeave={() => stopInteraction(true)}
      onClick={handleStageClick}
    >
      <svg
        viewBox={`0 0 ${LOOP_LAB_STAGE_WIDTH} ${LOOP_LAB_STAGE_HEIGHT}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <rect x="0" y="0" width={LOOP_LAB_STAGE_WIDTH} height={LOOP_LAB_STAGE_HEIGHT} fill={PAPER_BACKGROUND} />

        {useTextbookTopFigure ? (
          <TextbookFieldFigure
            geometry={geometry}
            direction={direction}
            displayMode="textbook"
            viewMode={viewMode}
            fieldStrength={fieldStrength}
          />
        ) : (
          <>
            {viewMode !== 'top' && fieldLoops.map((fieldLoop, index) => (
              <g key={fieldLoop.id}>
                <path
                  d={fieldLoop.path}
                  fill="none"
                  stroke={FIELD_BLUE_LIGHT}
                  strokeWidth={getFieldLineWidth(fieldLoop.scale, fieldStrength, displayMode)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={viewMode === 'isometric' ? '7 7' : undefined}
                  opacity={getHiddenFieldOpacity(fieldLoop.scale, displayMode, fieldLoop.planeIndex, viewMode)}
                />
                {fieldLoop.visibleSegments.map((segment, segmentIndex) => (
                  <path
                    key={`${fieldLoop.id}-${segmentIndex}`}
                    d={pointsToSvgPath(segment)}
                    fill="none"
                    stroke={FIELD_BLUE_STRONG}
                    strokeWidth={getFieldLineWidth(fieldLoop.scale, fieldStrength, displayMode)}
                    strokeOpacity={getVisibleFieldOpacity(
                      index,
                      fieldLoop.scale,
                      displayMode,
                      fieldStrength,
                      fieldLoop.planeIndex,
                      viewMode,
                    )}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            ))}

            {viewMode !== 'top' && (
              <path
                d={axisGuidePath}
                fill="none"
                stroke={FIELD_BLUE}
                strokeOpacity={0.14}
                strokeWidth={1.1}
                strokeLinecap="round"
                strokeDasharray="7 9"
              />
            )}

            <path
              d={pointsToSvgPath(ringPoints, true)}
              fill="none"
              stroke={CURRENT_ORANGE_DARK}
              strokeOpacity={0.42}
              strokeWidth={(geometry.tubeRadius * geometry.scale * 1.22) + 4}
              strokeLinecap="round"
            />
            {ringVisibleSegments.map((segment, index) => (
              <path
                key={`ring-front-${index}`}
                d={pointsToSvgPath(segment)}
                fill="none"
                stroke={CURRENT_ORANGE}
                strokeWidth={(geometry.tubeRadius * geometry.scale * 1.22) + 4}
                strokeLinecap="round"
                opacity={0.96}
              />
            ))}
            {ringVisibleSegments.map((segment, index) => (
              <path
                key={`ring-highlight-${index}`}
                d={pointsToSvgPath(segment)}
                fill="none"
                stroke="rgba(255, 244, 236, 0.84)"
                strokeWidth={1.6}
                strokeLinecap="round"
                opacity={0.78}
              />
            ))}

            {viewMode !== 'top' && fieldFlowMarkers.map((marker) => (
              <FieldArrowGlyph key={marker.id} marker={marker} color={FIELD_BLUE_STRONG} />
            ))}

            {currentDirectionArrows.map((arrow) => (
              <g
                key={arrow.id}
                transform={`translate(${arrow.point.x} ${arrow.point.y}) rotate(${arrow.angleDeg})`}
                opacity={0.94}
              >
                <line x1={-18} y1="0" x2={10} y2="0" stroke={CURRENT_ORANGE_DARK} strokeWidth="2.3" strokeLinecap="round" />
                <path d="M 8 -5 L 18 0 L 8 5 Z" fill={CURRENT_ORANGE_DARK} />
              </g>
            ))}

            {displayMode !== 'textbook' && currentFlowMarkers.map((marker) => (
              <FieldArrowGlyph key={marker.id} marker={marker} color={CURRENT_ORANGE_DARK} />
            ))}

            {displayMode !== 'textbook' && viewMode !== 'top' && axisSamples.map((sample) => (
              <AxisFieldMarker
                key={sample.id}
                sample={sample}
                displayMode={displayMode}
              />
            ))}

            {viewMode === 'top' ? (
              <g opacity={0.96}>
                <circle
                  cx={geometry.centerX}
                  cy={geometry.centerY}
                  r={geometry.scale * 0.16}
                  fill={FIELD_BLUE_LIGHT}
                />
                <text
                  x={geometry.centerX}
                  y={geometry.centerY + 8}
                  textAnchor="middle"
                  fill={FIELD_BLUE_STRONG}
                  fontSize="28"
                  fontFamily={TEXTBOOK_FONT}
                  fontWeight="700"
                >
                  {direction === 'counterclockwise' ? '⊙' : '⊗'}
                </text>
              </g>
            ) : (
              <g opacity={0.96}>
                <circle
                  cx={centerProjection.from.x}
                  cy={centerProjection.from.y}
                  r={16 + fieldStrength * 6}
                  fill={FIELD_BLUE_LIGHT}
                />
                <line
                  x1={centerProjection.from.x}
                  y1={centerProjection.from.y}
                  x2={centerProjection.to.x}
                  y2={centerProjection.to.y}
                  stroke={FIELD_BLUE_STRONG}
                  strokeWidth={3.2 + fieldStrength * 1.1}
                  strokeLinecap="round"
                />
                <path
                  d={buildArrowHeadPath(centerProjection.to.x, centerProjection.to.y, centerProjection.angleDeg, 11 + fieldStrength * 3)}
                  fill={FIELD_BLUE_STRONG}
                />
                <text
                  x={centerProjection.to.x + 12}
                  y={centerProjection.to.y - 12}
                  fill={FIELD_BLUE_STRONG}
                  fontSize="13"
                  fontFamily={TEXTBOOK_FONT}
                  fontWeight="700"
                >
                  中心 B
                </text>
              </g>
            )}
          </>
        )}

        {localHint && (
          <g opacity={localHint.hovered ? 1 : 0.64}>
            <path
              d={localHint.segmentPath}
              fill="none"
              stroke={CURRENT_ORANGE}
              strokeWidth={localHint.hovered ? 8 : 6}
              strokeLinecap="round"
              strokeOpacity={localHint.hovered ? 0.98 : 0.68}
            />
            <path
              d={localHint.segmentPath}
              fill="none"
              stroke="rgba(255,255,255,0.86)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeOpacity={localHint.hovered ? 0.9 : 0.56}
            />
            {localHint.orbitPaths.map((path, index) => (
              <path
                key={`local-orbit-${index}`}
                d={path}
                fill="none"
                stroke={FIELD_BLUE_STRONG}
                strokeWidth={index === 0 ? 1.7 : 1.35}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={index === 0 ? '6 6' : '4 6'}
                strokeOpacity={localHint.hovered ? 0.42 - (index * 0.08) : 0.24 - (index * 0.05)}
              />
            ))}
            {localHint.orbitArrow && (
              <FieldArrowGlyph
                marker={localHint.orbitArrow}
                color={FIELD_BLUE_STRONG}
              />
            )}
          </g>
        )}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 16,
          opacity: helperOpacity,
          transition: 'opacity 220ms ease',
          pointerEvents: 'none',
        }}
      >
        <StagePaperNote>
          {viewMode === 'isometric'
            ? '拖拽可旋转 3D 视角；悬停线圈局部可查看淡化的环绕提示'
            : viewMode === 'top'
              ? '俯视图先判断顺逆时针电流，再看中心 B 的 ⊙ / ⊗'
              : '侧视图突出中心轴线磁场最强，外部磁感线向两侧回弯闭合'}
        </StagePaperNote>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 16,
          opacity: helperOpacity,
          transition: 'opacity 220ms ease',
          pointerEvents: 'none',
          maxWidth: 280,
        }}
      >
        <StagePaperNote align="right">
          {modeLabel}
          {' · '}
          电流{currentDirectionLabel}
          {' · '}
          中心磁场{centerDirectionLabel}
        </StagePaperNote>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 20,
          bottom: 18,
          opacity: helperOpacity,
          transition: 'opacity 220ms ease',
          pointerEvents: 'none',
        }}
      >
        <StagePaperNote>
          {modeNote}
        </StagePaperNote>
      </div>

      {localHint?.hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(localHint.noteScreen.x / LOOP_LAB_STAGE_WIDTH) * 100}%`,
            top: `${(localHint.noteScreen.y / LOOP_LAB_STAGE_HEIGHT) * 100}%`,
            transform: 'translate(12px, -18px)',
            pointerEvents: 'none',
            padding: '10px 12px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.64)',
            background: 'rgba(16, 34, 58, 0.78)',
            color: '#F8FBFF',
            boxShadow: '0 14px 34px rgba(15, 26, 43, 0.20)',
            backdropFilter: 'blur(10px)',
            minWidth: 176,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(214, 231, 255, 0.72)' }}>
            LOCAL RULE
          </div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>
            磁场绕该电流元环绕
          </div>
          <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(224, 235, 249, 0.82)' }}>
            B ≈ {formatField(localHint.sample.magnitude)}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'rgba(224, 235, 249, 0.82)' }}>
            方向：{localHint.sample.directionLabel}
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {displayMode === 'observation' && compassViews.map((compass) => (
          <LoopCompassMarker
            key={compass.id}
            compass={compass}
            active={activeCompassId === compass.id}
            dragging={dragRef.current.compassId === compass.id}
            dimmed={labelsDimmed}
            onActivate={() => setActiveCompassId(compass.id)}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dragRef.current.mode = 'compass';
              dragRef.current.compassId = compass.id;
              dragRef.current.suppressClick = false;
              dragRef.current.moved = false;
              setActiveCompassId(compass.id);
              dimLabelsImmediately(restoreLabelsTimerRef, setLabelsDimmed);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function getDefaultLoopHintAngle(viewMode: LoopViewMode): number {
  if (viewMode === 'top') return Math.PI * 0.2;
  if (viewMode === 'front') return 0;
  return Math.PI * 0.15;
}

function buildLocalLoopHint({
  angle,
  radius,
  current,
  direction,
  geometry,
  camera,
  hovered,
}: {
  angle: number;
  radius: number;
  current: number;
  direction: LoopCurrentDirection;
  geometry: LoopLabStageGeometry;
  camera: LoopLabCameraState;
  hovered: boolean;
}): LocalLoopHintView | null {
  if (!Number.isFinite(radius) || radius <= 0) return null;

  const segmentSpan = hovered ? 0.3 : 0.2;
  const segmentPoints = Array.from({ length: 30 }, (_, index) => {
    const ratio = index / 29;
    const sampleAngle = angle - segmentSpan + (segmentSpan * 2 * ratio);
    return projectLoopLabPoint(
      {
        x: radius * Math.cos(sampleAngle),
        y: radius * Math.sin(sampleAngle),
        z: 0,
      },
      geometry,
      camera,
    );
  });

  const base = {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
    z: 0,
  };
  const radial = { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
  const orbitalBasis = direction === 'counterclockwise'
    ? radial
    : { x: -radial.x, y: -radial.y, z: 0 };
  const axisBasis = { x: 0, y: 0, z: 1 };
  const orbitRadii = hovered
    ? [radius * 0.16, radius * 0.24]
    : [radius * 0.18];

  const orbitPoints = orbitRadii.map((orbitRadius) =>
    Array.from({ length: 76 }, (_, index) => {
      const phi = (index / 75) * Math.PI * 2;
      return projectLoopLabPoint(
        {
          x: base.x + (axisBasis.x * Math.cos(phi) + orbitalBasis.x * Math.sin(phi)) * orbitRadius,
          y: base.y + (axisBasis.y * Math.cos(phi) + orbitalBasis.y * Math.sin(phi)) * orbitRadius,
          z: base.z + (axisBasis.z * Math.cos(phi) + orbitalBasis.z * Math.sin(phi)) * orbitRadius,
        },
        geometry,
        camera,
      );
    }),
  );

  const sampleOffset = orbitRadii[orbitRadii.length - 1] ?? radius * 0.18;
  const samplePoint = {
    x: base.x + orbitalBasis.x * sampleOffset * 0.58,
    y: base.y + orbitalBasis.y * sampleOffset * 0.58,
    z: sampleOffset * 0.78,
  };

  return {
    hovered,
    segmentPath: pointsToSvgPath(segmentPoints),
    orbitPaths: orbitPoints.map((points) => pointsToSvgPath(points, true)),
    orbitArrow: orbitPoints.length > 0
      ? {
        id: 'loop-local-orbit',
        ...sampleClosedProjectedPath(orbitPoints[0] ?? [], hovered ? 0.14 : 0.08),
        size: hovered ? 8.4 : 7,
        opacity: hovered ? 0.68 : 0.46,
      }
      : null,
    noteScreen: projectLoopLabPoint(samplePoint, geometry, camera),
    sample: sampleLoopMagneticField(samplePoint, current, radius, direction),
  };
}

function LoopCompassMarker({
  compass,
  active,
  dragging,
  dimmed,
  onActivate,
  onMouseDown,
}: {
  compass: StageCompassView;
  active: boolean;
  dragging: boolean;
  dimmed: boolean;
  onActivate: () => void;
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const entered = useEntryTransition();
  const animatedAngle = useSmoothedAngle(
    compass.visual.displayMode === 'needle' ? compass.visual.angleDeg : 0,
    dragging,
  );
  const noteOnLeft = compass.screen.x > LOOP_LAB_STAGE_WIDTH * 0.72;
  const noteOnBottom = compass.screen.y < LOOP_LAB_STAGE_HEIGHT * 0.18;

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onActivate}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${(compass.screen.x / LOOP_LAB_STAGE_WIDTH) * 100}%`,
        top: `${(compass.screen.y / LOOP_LAB_STAGE_HEIGHT) * 100}%`,
        width: 56,
        height: 56,
        transform: `translate(-50%, -50%) scale(${entered ? 1 : 0.84})`,
        opacity: entered ? 1 : 0,
        transition: dragging
          ? 'none'
          : 'left 180ms ease-out, top 180ms ease-out, transform 220ms ease-out, opacity 220ms ease-out',
        pointerEvents: 'auto',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      {compass.visual.displayMode === 'needle' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${animatedAngle}deg)`,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: 8,
              width: 2,
              height: 18,
              background: NEEDLE_RED,
              transform: 'translateX(-50%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: 22,
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `9px solid ${NEEDLE_RED}`,
              transform: 'translateX(-50%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: 29,
              width: 2,
              height: 18,
              background: NEEDLE_BLUE,
              transform: 'translateX(-50%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: 23,
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: `9px solid ${NEEDLE_BLUE}`,
              transform: 'translateX(-50%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'rgba(39, 47, 58, 0.86)',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: FIELD_BLUE_STRONG,
            fontSize: 22,
            fontFamily: TEXTBOOK_FONT,
            fontWeight: 700,
          }}
        >
          {compass.visual.displayMode === 'out' ? '⊙' : '⊗'}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: noteOnBottom ? 36 : -8,
          left: noteOnLeft ? 'auto' : 32,
          right: noteOnLeft ? 32 : 'auto',
          minWidth: 124,
          padding: '5px 8px',
          border: `1px solid ${PAPER_BORDER}`,
          background: PAPER_PANEL,
          color: PAPER_TEXT,
          fontSize: 12,
          lineHeight: 1.45,
          whiteSpace: 'nowrap',
          fontFamily: TEXTBOOK_FONT,
          opacity: active && !dimmed ? 1 : 0,
          transform: `translateY(${active && !dimmed ? 0 : 2}px)`,
          transition: 'opacity 180ms ease, transform 180ms ease',
          pointerEvents: 'none',
        }}
      >
        <div>B ≈ {formatField(compass.sample.magnitude)}</div>
        <div style={{ color: PAPER_MUTED }}>{compass.sample.directionLabel}</div>
      </div>
    </div>
  );
}

function StagePaperNote({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div
      style={{
        padding: '6px 10px',
        border: `1px solid ${PAPER_BORDER}`,
        background: PAPER_PANEL,
        color: PAPER_MUTED,
        fontSize: 12,
        lineHeight: 1.7,
        textAlign: align,
        fontFamily: TEXTBOOK_FONT,
      }}
    >
      {children}
    </div>
  );
}

function FieldArrowGlyph({
  marker,
  color,
}: {
  marker: FlowMarker;
  color: string;
}) {
  return (
    <g
      transform={`translate(${marker.x} ${marker.y}) rotate(${marker.angleDeg})`}
      opacity={marker.opacity}
    >
      <line x1={-marker.size * 0.75} y1="0" x2={marker.size * 0.28} y2="0" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path
        d={`M ${marker.size * 0.12} ${-marker.size * 0.36} L ${marker.size} 0 L ${marker.size * 0.12} ${marker.size * 0.36} Z`}
        fill={color}
      />
    </g>
  );
}

function AxisFieldMarker({
  sample,
  displayMode,
}: {
  sample: AxisSampleView;
  displayMode: LoopDisplayMode;
}) {
  if (sample.visual.displayMode === 'needle') {
    return (
      <g opacity={0.5 + sample.normalizedMagnitude * 0.42}>
        <line
          x1={sample.projection.from.x}
          y1={sample.projection.from.y}
          x2={sample.projection.to.x}
          y2={sample.projection.to.y}
          stroke={FIELD_BLUE_STRONG}
          strokeWidth={displayMode === 'direction' ? 2.4 : 1.8 + sample.normalizedMagnitude * 1.4}
          strokeLinecap="round"
        />
        <path
          d={buildArrowHeadPath(sample.projection.to.x, sample.projection.to.y, sample.projection.angleDeg, 7 + sample.normalizedMagnitude * 6)}
          fill={FIELD_BLUE_STRONG}
          opacity={0.84}
        />
      </g>
    );
  }

  return (
    <text
      x={sample.screen.x}
      y={sample.screen.y + 5}
      textAnchor="middle"
      fill={FIELD_BLUE_STRONG}
      fontSize={14 + sample.normalizedMagnitude * 8}
      opacity={0.44 + sample.normalizedMagnitude * 0.4}
      fontFamily={TEXTBOOK_FONT}
    >
      {sample.visual.displayMode === 'out' ? '⊙' : '⊗'}
    </text>
  );
}

function TextbookFieldFigure({
  geometry,
  direction,
  displayMode,
  viewMode,
  fieldStrength,
}: {
  geometry: LoopLabStageGeometry;
  direction: LoopCurrentDirection;
  displayMode: Exclude<LoopDisplayMode, 'observation'>;
  viewMode: LoopViewMode;
  fieldStrength: number;
}) {
  const cx = geometry.centerX;
  const cy = geometry.centerY - 42;
  const ringRx = geometry.scale * 0.92;
  const ringRy = viewMode === 'front' ? geometry.scale * 0.11 : geometry.scale * 0.24;
  const axisTop = cy - geometry.scale * 1.1;
  const axisBottom = cy + geometry.scale * 1.1;
  const loopSizes = [0.26, 0.46, 0.68, 0.9, 1.14];

  if (viewMode === 'top') {
    const topRadius = geometry.scale * 0.82;
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={topRadius}
          fill="none"
          stroke={CURRENT_ORANGE_DARK}
          strokeWidth={10}
          opacity={0.42}
        />
        <circle
          cx={cx}
          cy={cy}
          r={topRadius}
          fill="none"
          stroke={CURRENT_ORANGE}
          strokeWidth={7}
        />
        {[0.18, 1.48, 3.08, 4.42].map((angle, index) => (
          <g
            key={`top-current-${index}`}
            transform={`translate(${cx + Math.cos(angle) * topRadius} ${cy + Math.sin(angle) * topRadius}) rotate(${(direction === 'counterclockwise' ? angle - Math.PI / 2 : angle + Math.PI / 2) * 180 / Math.PI})`}
          >
            <line x1={-12} y1="0" x2={6} y2="0" stroke={CURRENT_ORANGE_DARK} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 4 -4 L 12 0 L 4 4 Z" fill={CURRENT_ORANGE_DARK} />
          </g>
        ))}
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fill={FIELD_BLUE_STRONG}
          fontSize="30"
          fontFamily={TEXTBOOK_FONT}
          fontWeight="700"
        >
          {direction === 'counterclockwise' ? '⊙' : '⊗'}
        </text>
        <text
          x={cx}
          y={cy - topRadius - 22}
          textAnchor="middle"
          fill={PAPER_MUTED}
          fontSize="12"
          fontFamily={TEXTBOOK_FONT}
        >
          {direction === 'counterclockwise' ? '中心 B 穿出屏幕' : '中心 B 穿入屏幕'}
        </text>
      </g>
    );
  }

  return (
    <g>
      {displayMode !== 'textbook' && (
        <line
          x1={cx}
          y1={axisTop}
          x2={cx}
          y2={axisBottom}
          stroke={FIELD_BLUE}
          strokeOpacity={displayMode === 'direction' ? 0.24 : 0.14}
          strokeWidth="1.2"
          strokeDasharray="7 8"
        />
      )}

      {loopSizes.map((size, index) => {
        const width = geometry.scale * (0.34 + size * 0.68);
        const height = geometry.scale * (0.5 + size * 0.74);
        return (
          <path
            key={`dipole-loop-${index}`}
            d={buildTextbookDipoleLoopPath(cx, cy, width, height)}
            fill="none"
            stroke={FIELD_BLUE}
            strokeWidth={1 + ((1 - index / loopSizes.length) * 0.45)}
            strokeOpacity={(0.18 + (1 - index / loopSizes.length) * 0.24) * (0.82 + fieldStrength * 0.18)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {(displayMode === 'direction' || displayMode === 'intensity') && loopSizes.slice(0, 4).map((size, index) => {
        const width = geometry.scale * (0.34 + size * 0.68);
        const height = geometry.scale * (0.5 + size * 0.74);
        const marker = sampleTextbookLoopMarker(cx, cy, width, height, 0.14 + index * 0.08);
        return (
          <FieldArrowGlyph
            key={`dipole-arrow-${index}`}
            marker={{ ...marker, id: `dipole-arrow-${index}`, size: 7, opacity: 0.74 - index * 0.1 }}
            color={FIELD_BLUE_STRONG}
          />
        );
      })}

      {displayMode === 'intensity' && [-0.78, -0.45, 0, 0.45, 0.78].map((factor, index) => {
        const strength = 1 - Math.abs(factor);
        const y = cy + factor * geometry.scale;
        return (
          <g key={`axis-sample-${index}`}>
            <circle
              cx={cx}
              cy={y}
              r={4 + strength * 6}
              fill={FIELD_BLUE}
              opacity={0.12 + strength * 0.22}
            />
            <line
              x1={cx}
              y1={y}
              x2={cx}
              y2={y + (direction === 'counterclockwise' ? -1 : 1) * (18 + strength * 22)}
              stroke={FIELD_BLUE_STRONG}
              strokeWidth={1.4 + strength * 1.2}
              strokeOpacity={0.44 + strength * 0.32}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      <ellipse
        cx={cx}
        cy={cy}
        rx={ringRx}
        ry={ringRy}
        fill="none"
        stroke={CURRENT_ORANGE_DARK}
        strokeWidth={12}
        opacity={0.38}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={ringRx}
        ry={ringRy}
        fill="none"
        stroke={CURRENT_ORANGE}
        strokeWidth={8}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={ringRx}
        ry={ringRy}
        fill="none"
        stroke="rgba(251, 235, 214, 0.74)"
        strokeWidth={1.6}
      />

      {[0.34, 2.8].map((angle, index) => {
        const point = pointOnEllipse(cx, cy, ringRx, ringRy, angle);
        return (
          <g
            key={`ring-arrow-${index}`}
            transform={`translate(${point.x} ${point.y}) rotate(${getEllipseArrowAngle(angle, ringRx, ringRy, direction)})`}
          >
            <line x1={-14} y1="0" x2={6} y2="0" stroke={CURRENT_ORANGE_DARK} strokeWidth="2.3" strokeLinecap="round" />
            <path d="M 4 -4 L 12 0 L 4 4 Z" fill={CURRENT_ORANGE_DARK} />
          </g>
        );
      })}

      <line
        x1={cx}
        y1={cy + (direction === 'counterclockwise' ? 26 : -26)}
        x2={cx}
        y2={cy + (direction === 'counterclockwise' ? -70 : 70)}
        stroke={FIELD_BLUE_STRONG}
        strokeWidth={2.6 + fieldStrength * 0.6}
        strokeLinecap="round"
      />
      <path
        d={buildArrowHeadPath(
          cx,
          cy + (direction === 'counterclockwise' ? -70 : 70),
          direction === 'counterclockwise' ? -90 : 90,
          12,
        )}
        fill={FIELD_BLUE_STRONG}
      />
      <text
        x={cx + 16}
        y={cy - 78}
        fill={FIELD_BLUE_STRONG}
        fontSize="13"
        fontFamily={TEXTBOOK_FONT}
      >
        B
      </text>
      <text
        x={cx}
        y={cy + geometry.scale * 1.46}
        textAnchor="middle"
        fill={PAPER_MUTED}
        fontSize="12"
        fontFamily={TEXTBOOK_FONT}
      >
        {direction === 'counterclockwise'
          ? '四指沿逆时针弯曲，拇指指向中心轴线向上'
          : '四指沿顺时针弯曲，拇指指向中心轴线向下'}
      </text>
    </g>
  );
}

function useLoopOrbitCamera(viewMode: LoopViewMode, cameraResetVersion: number) {
  const [camera, setCamera] = useState<LoopLabCameraState>(() => getCameraPreset(viewMode));
  const [isInteracting, setIsInteracting] = useState(false);

  const orbitRef = useRef({
    currentYaw: camera.yawDeg,
    currentPitch: camera.pitchDeg,
    targetYaw: camera.yawDeg,
    targetPitch: camera.pitchDeg,
    velocityYaw: 0,
    velocityPitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastMoveAt: 0,
  });
  const rememberedIsometricRef = useRef({
    yawDeg: LOOP_CAMERA_DEFAULT_YAW_DEG,
    pitchDeg: LOOP_CAMERA_DEFAULT_PITCH_DEG,
  });
  const resetVersionRef = useRef(cameraResetVersion);

  useEffect(() => {
    const preset = getCameraPreset(viewMode);
    const orbit = orbitRef.current;

    if (resetVersionRef.current !== cameraResetVersion) {
      rememberedIsometricRef.current = {
        yawDeg: LOOP_CAMERA_DEFAULT_YAW_DEG,
        pitchDeg: LOOP_CAMERA_DEFAULT_PITCH_DEG,
      };
      resetVersionRef.current = cameraResetVersion;
    }

    if (viewMode === 'isometric') {
      orbit.targetYaw = rememberedIsometricRef.current.yawDeg;
      orbit.targetPitch = rememberedIsometricRef.current.pitchDeg;
    } else {
      rememberedIsometricRef.current = {
        yawDeg: orbit.targetYaw,
        pitchDeg: orbit.targetPitch,
      };
      orbit.targetYaw = preset.yawDeg;
      orbit.targetPitch = preset.pitchDeg;
      orbit.velocityYaw = 0;
      orbit.velocityPitch = 0;
    }
  }, [cameraResetVersion, viewMode]);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - previousTime) / 1000, 0.05);
      previousTime = now;

      const orbit = orbitRef.current;
      if (!orbit.dragging && viewMode === 'isometric') {
        orbit.targetYaw += orbit.velocityYaw * dt * 60;
        orbit.targetPitch = clamp(
          orbit.targetPitch + orbit.velocityPitch * dt * 60,
          LOOP_CAMERA_MIN_PITCH_DEG,
          LOOP_CAMERA_MAX_PITCH_DEG,
        );

        orbit.velocityYaw *= Math.exp(-7 * dt);
        orbit.velocityPitch *= Math.exp(-7.5 * dt);
        if (Math.abs(orbit.velocityYaw) < 0.001) orbit.velocityYaw = 0;
        if (Math.abs(orbit.velocityPitch) < 0.001) orbit.velocityPitch = 0;
      }

      const preset = getCameraPreset(viewMode);
      const blend = 1 - Math.exp(-(orbit.dragging ? 18 : 10) * dt);

      orbit.currentYaw += (orbit.targetYaw - orbit.currentYaw) * blend;
      orbit.currentPitch += (orbit.targetPitch - orbit.currentPitch) * blend;

      setCamera((previous) => {
        if (
          Math.abs(previous.yawDeg - orbit.currentYaw) < 0.02 &&
          Math.abs(previous.pitchDeg - orbit.currentPitch) < 0.02 &&
          previous.perspective === preset.perspective
        ) {
          return previous;
        }
        return {
          yawDeg: orbit.currentYaw,
          pitchDeg: orbit.currentPitch,
          perspective: preset.perspective,
        };
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [viewMode]);

  const beginOrbit = (clientX: number, clientY: number) => {
    if (viewMode !== 'isometric') return;
    const orbit = orbitRef.current;
    orbit.dragging = true;
    orbit.lastX = clientX;
    orbit.lastY = clientY;
    orbit.lastMoveAt = performance.now();
    orbit.velocityYaw = 0;
    orbit.velocityPitch = 0;
    setIsInteracting(true);
  };

  const updateOrbit = (clientX: number, clientY: number) => {
    const orbit = orbitRef.current;
    if (!orbit.dragging || viewMode !== 'isometric') return;

    const dx = clientX - orbit.lastX;
    const dy = clientY - orbit.lastY;
    const now = performance.now();
    const elapsed = Math.max(now - orbit.lastMoveAt, 8);

    const yawDelta = dx * 0.28;
    const pitchDelta = dy * 0.2;

    orbit.targetYaw += yawDelta;
    orbit.targetPitch = clamp(
      orbit.targetPitch - pitchDelta,
      LOOP_CAMERA_MIN_PITCH_DEG,
      LOOP_CAMERA_MAX_PITCH_DEG,
    );
    orbit.velocityYaw = (yawDelta / elapsed) * 2.4;
    orbit.velocityPitch = (-pitchDelta / elapsed) * 2.1;
    orbit.lastX = clientX;
    orbit.lastY = clientY;
    orbit.lastMoveAt = now;
  };

  const endOrbit = () => {
    const orbit = orbitRef.current;
    if (orbit.dragging) {
      rememberedIsometricRef.current = {
        yawDeg: orbit.targetYaw,
        pitchDeg: orbit.targetPitch,
      };
    }
    orbit.dragging = false;
    setIsInteracting(false);
  };

  return {
    camera,
    isInteracting,
    beginOrbit,
    updateOrbit,
    endOrbit,
  };
}

function buildCurrentFlowMarkers(
  radius: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  direction: LoopCurrentDirection,
  displayMode: LoopDisplayMode,
  currentStrength: number,
  time: number,
): FlowMarker[] {
  if (displayMode === 'textbook') {
    return [];
  }

  const count = displayMode === 'direction'
    ? 14
    : displayMode === 'observation'
      ? 12
      : displayMode === 'intensity'
        ? 10
        : 8;

  return Array.from({ length: count }, (_, index) => {
    const progress = ((index / count) + time * 0.035) % 1;
    const phase = direction === 'counterclockwise' ? progress : (1 - progress);
    const angle = phase * Math.PI * 2;
    const point = projectLoopLabPoint(
      {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        z: 0,
      },
      geometry,
      camera,
    );
    const tangent = getProjectedTangent(angle, radius, direction, geometry, camera);
    return {
      id: `current-flow-${index}`,
      x: point.x,
      y: point.y,
      angleDeg: tangent.angleDeg,
      size: (displayMode === 'direction' ? 10 : 8) + currentStrength * 4,
      opacity: 0.56 + currentStrength * 0.28,
    };
  });
}

function buildFieldFlowMarkers(
  fieldLoops: FieldLoopView[],
  direction: LoopCurrentDirection,
  displayMode: LoopDisplayMode,
  time: number,
): FlowMarker[] {
  if (displayMode === 'textbook') return [];

  const stride = displayMode === 'direction' ? 3 : 4;
  return fieldLoops
    .filter((_, index) => index % stride === 0)
    .flatMap((fieldLoop, index) => {
      const markerCount = displayMode === 'direction' ? 2 : 1;
      return Array.from({ length: markerCount }, (_, markerIndex) => {
        const baseProgress = (time * 0.018) + (index * 0.11) + (markerIndex * 0.42);
        const progress = direction === 'counterclockwise'
          ? baseProgress % 1
          : (1 - (baseProgress % 1));
        const sample = sampleClosedProjectedPath(fieldLoop.points, progress);
        return {
          id: `${fieldLoop.id}-marker-${markerIndex}`,
          x: sample.x,
          y: sample.y,
          angleDeg: sample.angleDeg,
          size: displayMode === 'direction' ? 8 : 6.5,
          opacity: 0.28 + ((1 - fieldLoop.scale) * 0.32),
        };
      });
    });
}

function buildAxisSamples(
  radius: number,
  current: number,
  direction: LoopCurrentDirection,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  centerField: number,
): AxisSampleView[] {
  const safeCenterField = Math.max(centerField, 1e-12);
  return AXIS_SAMPLE_FACTORS.map((factor, index) => {
    const point = { x: 0, y: 0, z: radius * factor };
    const sample = sampleLoopMagneticField(point, current, radius, direction);
    const normalizedMagnitude = clamp(sample.magnitude / safeCenterField, 0.08, 1);
    const projection = projectLoopLabVector(
      point,
      sample.vector,
      geometry,
      camera,
      (0.18 + normalizedMagnitude * 0.55) / Math.max(sample.magnitude, 1e-12),
    );
    return {
      id: `axis-${index}`,
      screen: projectLoopLabPoint(point, geometry, camera),
      projection: {
        from: projection.from,
        to: projection.to,
        angleDeg: projection.angleDeg,
        length: projection.length,
      },
      visual: getLoopCompassVisual(point, sample.vector, geometry, camera),
      normalizedMagnitude,
    };
  });
}

function sampleClosedProjectedPath(
  points: Array<{ x: number; y: number }>,
  progress: number,
): { x: number; y: number; angleDeg: number } {
  const normalized = ((progress % 1) + 1) % 1;
  const scaled = normalized * points.length;
  const index = Math.floor(scaled) % points.length;
  const nextIndex = (index + 1) % points.length;
  const t = scaled - index;
  const from = points[index]!;
  const to = points[nextIndex]!;
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  return {
    x,
    y,
    angleDeg: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
  };
}

function getProjectedTangent(
  angle: number,
  radius: number,
  direction: LoopCurrentDirection,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
) {
  const point = {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
    z: 0,
  };
  const tangent = direction === 'counterclockwise'
    ? { x: -Math.sin(angle), y: Math.cos(angle), z: 0 }
    : { x: Math.sin(angle), y: -Math.cos(angle), z: 0 };
  return projectLoopLabVector(point, tangent, geometry, camera, 0.3);
}

function getCameraPreset(viewMode: LoopViewMode): LoopLabCameraState {
  if (viewMode === 'top') {
    return { yawDeg: 0, pitchDeg: 6, perspective: 0.05 };
  }
  if (viewMode === 'front') {
    return { yawDeg: 0, pitchDeg: 78, perspective: 0.08 };
  }
  return { yawDeg: -8, pitchDeg: 26, perspective: 0.1 };
}

function getFieldLineWidth(scale: number, fieldStrength: number, displayMode: LoopDisplayMode): number {
  const base = 1.05 + ((1 - scale) * 0.72) + fieldStrength * 0.28;
  if (displayMode === 'direction') return base + 0.2;
  if (displayMode === 'intensity') return base * 0.9;
  return base;
}

function getVisibleFieldOpacity(
  index: number,
  scale: number,
  displayMode: LoopDisplayMode,
  fieldStrength: number,
  planeIndex: number,
  viewMode: LoopViewMode,
): number {
  const planeFade = viewMode === 'top'
    ? 0.22
    : viewMode === 'isometric'
      ? Math.max(0.54, 1 - planeIndex * 0.12)
      : Math.max(0.4, 1 - planeIndex * 0.14);
  const base = 0.2 + ((1 - scale) * 0.24) + fieldStrength * 0.14 - index * 0.004;
  if (displayMode === 'direction') return (base + 0.08) * planeFade;
  if (displayMode === 'intensity') return (base - 0.03) * planeFade;
  if (displayMode === 'observation') return (base + 0.02) * planeFade;
  return base * planeFade;
}

function getHiddenFieldOpacity(
  scale: number,
  displayMode: LoopDisplayMode,
  planeIndex: number,
  viewMode: LoopViewMode,
): number {
  const planeFade = viewMode === 'top'
    ? 0.14
    : viewMode === 'isometric'
      ? Math.max(0.5, 1 - planeIndex * 0.12)
      : Math.max(0.34, 1 - planeIndex * 0.14);
  if (displayMode === 'observation') return (0.14 + (1 - scale) * 0.05) * planeFade;
  if (displayMode === 'direction') return (0.08 + (1 - scale) * 0.035) * planeFade;
  if (displayMode === 'intensity') return (0.04 + (1 - scale) * 0.02) * planeFade;
  return (0.07 + (1 - scale) * 0.03) * planeFade;
}

function getFieldPlaneAngles(displayMode: LoopDisplayMode, viewMode: LoopViewMode): number[] {
  if (viewMode === 'top') {
    return [-0.5, 0.5];
  }
  if (displayMode === 'observation') {
    return [0, -0.48, 0.48, -0.96, 0.96];
  }
  if (displayMode === 'direction') {
    return [0, -0.36, 0.36];
  }
  if (displayMode === 'intensity') {
    return [0, -0.26, 0.26];
  }
  return [0, -0.32, 0.32];
}

function buildTextbookDipoleLoopPath(
  cx: number,
  cy: number,
  width: number,
  height: number,
): string {
  const inner = width * 0.24;
  const shoulder = width * 0.96;
  const upper = cy - height;
  const lower = cy + height;

  return [
    `M ${cx} ${upper}`,
    `C ${cx + inner} ${upper + height * 0.18}, ${cx + shoulder} ${cy - height * 0.34}, ${cx + shoulder} ${cy}`,
    `C ${cx + shoulder} ${cy + height * 0.34}, ${cx + inner} ${lower - height * 0.18}, ${cx} ${lower}`,
    `C ${cx - inner} ${lower - height * 0.18}, ${cx - shoulder} ${cy + height * 0.34}, ${cx - shoulder} ${cy}`,
    `C ${cx - shoulder} ${cy - height * 0.34}, ${cx - inner} ${upper + height * 0.18}, ${cx} ${upper}`,
  ].join(' ');
}

function sampleTextbookLoopMarker(
  cx: number,
  cy: number,
  width: number,
  height: number,
  progress: number,
): { x: number; y: number; angleDeg: number } {
  const theta = progress * Math.PI * 2;
  const x = cx + width * 0.96 * Math.sin(theta);
  const y = cy - height * Math.cos(theta);
  const tangentX = width * 0.96 * Math.cos(theta);
  const tangentY = height * Math.sin(theta);
  return {
    x,
    y,
    angleDeg: (Math.atan2(tangentY, tangentX) * 180) / Math.PI,
  };
}

function pointOnEllipse(cx: number, cy: number, rx: number, ry: number, angle: number) {
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

function getEllipseArrowAngle(
  angle: number,
  rx: number,
  ry: number,
  direction: LoopCurrentDirection,
): number {
  const tangentX = -rx * Math.sin(angle);
  const tangentY = ry * Math.cos(angle);
  const baseAngle = (Math.atan2(tangentY, tangentX) * 180) / Math.PI;
  return direction === 'counterclockwise' ? baseAngle + 180 : baseAngle;
}

function getDisplayModeLabel(displayMode: LoopDisplayMode): string {
  if (displayMode === 'observation') return '3D观察';
  if (displayMode === 'direction') return '方向模式';
  if (displayMode === 'intensity') return '强度模式';
  return '教材图';
}

function getDisplayModeNote(displayMode: LoopDisplayMode): string {
  if (displayMode === 'observation') {
    return '圆形电流的磁场是所有电流元叠加形成的整体磁场，中心沿轴线方向最强，整体分布类似磁偶极子。';
  }
  if (displayMode === 'direction') {
    return '先看整体偶极磁场，再用悬停的局部环绕提示把右手定则和电流元方向对应起来。';
  }
  if (displayMode === 'intensity') {
    return '剖面箭头场与轴线采样共同显示中心强、远处弱的磁场强度分布。';
  }
  return '保留清晰教材图风格，但主视觉始终强调“穿过中心 + 外部回弯闭合”的偶极磁场。';
}

function buildArrowHeadPath(x: number, y: number, angleDeg: number, size: number): string {
  const angle = (angleDeg * Math.PI) / 180;
  const left = angle + Math.PI * 0.86;
  const right = angle - Math.PI * 0.86;
  const tip = { x, y };
  const p1 = {
    x: x + Math.cos(left) * size,
    y: y + Math.sin(left) * size,
  };
  const p2 = {
    x: x + Math.cos(right) * size,
    y: y + Math.sin(right) * size,
  };
  return `M ${tip.x} ${tip.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`;
}

function dimLabelsImmediately(
  timerRef: MutableRefObject<number | null>,
  setDimmed: Dispatch<SetStateAction<boolean>>,
) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
  }
  setDimmed(true);
}

function restoreLabelsLater(
  timerRef: MutableRefObject<number | null>,
  setDimmed: Dispatch<SetStateAction<boolean>>,
) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
  }
  timerRef.current = window.setTimeout(() => setDimmed(false), 180);
}

function clampLoopPlanePoint(point: LoopLabPoint3D, radius: number): LoopLabPoint3D {
  return {
    x: clamp(point.x, -radius * 2.4, radius * 2.4),
    y: clamp(point.y, -radius * 2.4, radius * 2.4),
    z: 0,
  };
}

function getStagePoint(container: HTMLElement, clientX: number, clientY: number) {
  const rect = container.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * LOOP_LAB_STAGE_WIDTH,
    y: ((clientY - rect.top) / rect.height) * LOOP_LAB_STAGE_HEIGHT,
  };
}

function formatField(value: number): string {
  if (Math.abs(value) >= 0.01) return `${value.toFixed(3)} T`;
  if (Math.abs(value) >= 0.001) return `${value.toFixed(4)} T`;
  return `${value.toExponential(2)} T`;
}

function useAnimatedNumber(target: number, durationMs = 240): number {
  const [displayValue, setDisplayValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    const startValue = valueRef.current;
    const startedAt = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - ((1 - progress) ** 3);
      const next = startValue + (target - startValue) * eased;
      valueRef.current = next;
      setDisplayValue(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs, target]);

  return displayValue;
}

function useAnimationClock(enabled = true): number {
  const [time, setTime] = useState(() => performance.now() / 1000);

  useEffect(() => {
    if (!enabled) return undefined;

    let frameId = 0;
    const tick = (now: number) => {
      setTime(now / 1000);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [enabled]);

  return time;
}

function useEntryTransition(): boolean {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frameId);
  }, []);

  return entered;
}

function useSmoothedAngle(targetAngle: number, immediate = false): number {
  const [angle, setAngle] = useState(targetAngle);
  const angleRef = useRef(targetAngle);

  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  useEffect(() => {
    if (immediate) {
      angleRef.current = targetAngle;
      setAngle(targetAngle);
      return undefined;
    }

    let frameId = 0;

    const tick = () => {
      const delta = getShortestAngleDelta(angleRef.current, targetAngle);
      const nextAngle = angleRef.current + delta * 0.14;

      if (Math.abs(delta) < 0.16) {
        angleRef.current = targetAngle;
        setAngle(targetAngle);
        return;
      }

      angleRef.current = nextAngle;
      setAngle(nextAngle);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [immediate, targetAngle]);

  return angle;
}

function getShortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
