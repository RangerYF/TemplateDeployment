import type { Tool, ToolPointerEvent } from './types';
import type { SegmentProperties, PointProperties, GeometryProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import type { ToolStep } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { getBuilderResult } from '@/editor/builderCache';
import { pickPointPreviewState } from '@/components/scene/pickPointPreviewState';

const STEP_LABELS = ['选择线段', '移动鼠标取点，点击放置'];

let selectedSegmentId: string | null = null;
let currentT = 0.5;
let nextLabel = 1;

function buildSteps(activeIdx: number): ToolStep[] {
  return STEP_LABELS.map((label, i) => ({
    label,
    status: i < activeIdx ? 'done' as const : i === activeIdx ? 'active' as const : 'pending' as const,
  }));
}

function resetState() {
  selectedSegmentId = null;
  currentT = 0.5;
  const toolStore = useToolStore.getState();
  toolStore.setToolStepInfo(null);
  toolStore.setToolSteps(null);
  useSelectionStore.getState().clear();
  pickPointPreviewState.active = false;
  pickPointPreviewState.position = null;
  pickPointPreviewState.startPosition = null;
  pickPointPreviewState.distance = 0;
}

function getSegmentEndpoints(segmentId: string): {
  startPos: [number, number, number];
  endPos: [number, number, number];
  geometryId: string;
} | null {
  const store = useEntityStore.getState();
  const seg = store.getEntity(segmentId);
  if (!seg || seg.type !== 'segment') return null;
  const segProps = seg.properties as SegmentProperties;

  const startPt = store.getEntity(segProps.startPointId);
  const endPt = store.getEntity(segProps.endPointId);
  if (!startPt || startPt.type !== 'point' || !endPt || endPt.type !== 'point') return null;

  const geoEntity = store.getEntity(segProps.geometryId);
  if (!geoEntity || geoEntity.type !== 'geometry') return null;
  const geoProps = geoEntity.properties as GeometryProperties;
  const result = getBuilderResult(segProps.geometryId, geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const startPos = computePointPosition(startPt.properties as PointProperties, result);
  const endPos = computePointPosition(endPt.properties as PointProperties, result);
  if (!startPos || !endPos) return null;

  return {
    startPos: startPos as [number, number, number],
    endPos: endPos as [number, number, number],
    geometryId: segProps.geometryId,
  };
}

function computeHitT(
  hitPoint: { x: number; y: number; z: number },
  startPos: [number, number, number],
  endPos: [number, number, number],
): number {
  const sx = endPos[0] - startPos[0];
  const sy = endPos[1] - startPos[1];
  const sz = endPos[2] - startPos[2];
  const lenSq = sx * sx + sy * sy + sz * sz;
  if (lenSq <= 0) return 0.5;
  const t = ((hitPoint.x - startPos[0]) * sx + (hitPoint.y - startPos[1]) * sy + (hitPoint.z - startPos[2]) * sz) / lenSq;
  return Math.max(0.01, Math.min(0.99, t));
}

function updatePreview(t: number, startPos: [number, number, number], endPos: [number, number, number]) {
  const pos: [number, number, number] = [
    startPos[0] + t * (endPos[0] - startPos[0]),
    startPos[1] + t * (endPos[1] - startPos[1]),
    startPos[2] + t * (endPos[2] - startPos[2]),
  ];
  const dx = pos[0] - startPos[0];
  const dy = pos[1] - startPos[1];
  const dz = pos[2] - startPos[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  pickPointPreviewState.active = true;
  pickPointPreviewState.position = pos;
  pickPointPreviewState.startPosition = startPos;
  pickPointPreviewState.distance = distance;
}

export const pickPointTool: Tool = {
  id: 'pickPoint',
  label: '取点',
  needsHoverMove: true,

  onActivate() {
    resetState();
    useToolStore.getState().setToolSteps(buildSteps(0));
  },

  onDeactivate() {
    resetState();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (selectedSegmentId === null) {
      // Step 0: 选择线段
      if (!event.hitEntityId || event.hitEntityType !== 'segment') return;
      selectedSegmentId = event.hitEntityId;

      // 立即根据点击位置计算 t 并显示预览
      const endpoints = getSegmentEndpoints(event.hitEntityId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const intersection = event.intersection as any;
      if (endpoints && intersection?.point) {
        currentT = computeHitT(intersection.point, endpoints.startPos, endpoints.endPos);
        updatePreview(currentT, endpoints.startPos, endpoints.endPos);
      }

      useSelectionStore.getState().select(event.hitEntityId);
      useToolStore.getState().setToolSteps(buildSteps(1));
    } else {
      // Step 1: 放置点
      const endpoints = getSegmentEndpoints(selectedSegmentId);
      if (!endpoints) {
        resetState();
        useToolStore.getState().setActiveTool('select');
        return;
      }

      const command = new CreateEntityCommand('point', {
        builtIn: false,
        geometryId: endpoints.geometryId,
        constraint: {
          type: 'segment' as const,
          segmentId: selectedSegmentId,
          t: currentT,
        },
        label: `M${nextLabel++}`,
      });

      useHistoryStore.getState().execute(command);
      resetState();
      useToolStore.getState().setActiveTool('select');
    }
  },

  onPointerMove(event: ToolPointerEvent) {
    if (selectedSegmentId === null) return;

    const endpoints = getSegmentEndpoints(selectedSegmentId);
    if (!endpoints) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intersection = event.intersection as any;
    if (!intersection?.point) {
      // 鼠标不在任何对象上，保持最后的预览
      return;
    }

    const t = computeHitT(intersection.point, endpoints.startPos, endpoints.endPos);
    currentT = t;
    updatePreview(t, endpoints.startPos, endpoints.endPos);
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      resetState();
      useToolStore.getState().setActiveTool('select');
    }
  },

  renderOverlay() {
    return null;
  },
};
