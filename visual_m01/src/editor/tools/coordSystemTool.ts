import type { Tool, ToolPointerEvent } from './types';
import type {
  PointProperties,
  FaceProperties,
  GeometryProperties,
  CoordinateSystemProperties,
} from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import type { ToolStep } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { UpdatePropertiesCommand } from '../commands/updateProperties';
import { getBuilderResult } from '../builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import type { Vec3 } from '@/engine/types';

/**
 * CoordSystemTool — 坐标系工具（三步交互流程）
 *
 * 步骤1：选原点（任意 Point Entity）
 * 步骤2：选面定 Z 轴（Face Entity，法向 → Z 轴方向）
 * 步骤3：选方向定 X 轴（Point Entity ≠ 原点）
 */

type CoordStep = 'selectOrigin' | 'selectZFace' | 'selectXDir';

const STEP_LABELS: Record<CoordStep, string> = {
  selectOrigin: '选择原点',
  selectZFace: '选面定Z轴',
  selectXDir: '选点定X轴',
};

const STEP_ORDER: CoordStep[] = ['selectOrigin', 'selectZFace', 'selectXDir'];

let currentStep: CoordStep = 'selectOrigin';
let pendingOriginPointId: string | null = null;
let pendingGeometryId: string | null = null;
let pendingZFaceId: string | null = null;
let pendingZNormal: Vec3 | null = null;
/** 建系过程中累积选中的 entity IDs（退出时统一清除） */
let pendingSelectedIds: string[] = [];

function buildSteps(activeStep: CoordStep): ToolStep[] {
  const activeIdx = STEP_ORDER.indexOf(activeStep);
  return STEP_ORDER.map((step, i) => ({
    label: STEP_LABELS[step],
    status: i < activeIdx ? 'done' as const : i === activeIdx ? 'active' as const : 'pending' as const,
  }));
}

function resetState() {
  currentStep = 'selectOrigin';
  pendingOriginPointId = null;
  pendingGeometryId = null;
  pendingZFaceId = null;
  pendingZNormal = null;
  // 清除步骤提示
  const toolStore = useToolStore.getState();
  toolStore.setToolStepInfo(null);
  toolStore.setToolSteps(null);
  // 清除建系过程中的选中状态
  if (pendingSelectedIds.length > 0) {
    useSelectionStore.getState().clear();
    pendingSelectedIds = [];
  }
}

function setStep(step: CoordStep) {
  currentStep = step;
  useToolStore.getState().setToolSteps(buildSteps(step));
}

/** 添加选中高亮 */
function addPendingSelection(entityId: string) {
  pendingSelectedIds.push(entityId);
  useSelectionStore.getState().addToSelection(entityId);
}

/** 计算面法向量 */
function computeFaceNormal(faceId: string): Vec3 | null {
  const store = useEntityStore.getState();
  const face = store.getEntity(faceId);
  if (!face || face.type !== 'face') return null;
  const faceProps = face.properties as FaceProperties;
  const geometryEntity = store.getEntity(faceProps.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = getBuilderResult(faceProps.geometryId, geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const positions: Vec3[] = [];
  for (let i = 0; i < Math.min(3, faceProps.pointIds.length); i++) {
    const pe = store.getEntity(faceProps.pointIds[i]);
    if (!pe || pe.type !== 'point') return null;
    const pos = computePointPosition(pe.properties as PointProperties, result);
    if (!pos) return null;
    positions.push(pos);
  }
  if (positions.length < 3) return null;

  const [p0, p1, p2] = positions;
  const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-12) return null;
  return [nx / len, ny / len, nz / len];
}

/** 从面法向 + 参考点计算正交轴系 */
function computeAxesFromFaceAndRef(
  origin: Vec3,
  faceNormal: Vec3,
  refPoint: Vec3 | null,
): [[number, number, number], [number, number, number], [number, number, number]] {
  // Z 轴 = 面法向，确保 Y 分量 ≥ 0（朝上），否则取反
  let z: Vec3 = [...faceNormal];
  if (z[1] < 0) {
    z = [-z[0], -z[1], -z[2]];
  }

  let x: Vec3;
  if (refPoint) {
    const dir: Vec3 = [refPoint[0] - origin[0], refPoint[1] - origin[1], refPoint[2] - origin[2]];
    const dotZDir = dir[0] * z[0] + dir[1] * z[1] + dir[2] * z[2];
    const proj: Vec3 = [dir[0] - dotZDir * z[0], dir[1] - dotZDir * z[1], dir[2] - dotZDir * z[2]];
    const projLen = Math.sqrt(proj[0] * proj[0] + proj[1] * proj[1] + proj[2] * proj[2]);
    if (projLen > 1e-10) {
      x = [proj[0] / projLen, proj[1] / projLen, proj[2] / projLen];
    } else {
      x = autoInferX(z);
    }
  } else {
    x = autoInferX(z);
  }

  // Y = Z × X（右手定则）
  const y: Vec3 = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];

  return [x, y, z];
}

/** 自动推断 X 轴 */
function autoInferX(z: Vec3): Vec3 {
  const absX = Math.abs(z[0]);
  const absY = Math.abs(z[1]);
  const absZ = Math.abs(z[2]);
  let ref: Vec3;
  if (absX <= absY && absX <= absZ) {
    ref = [1, 0, 0];
  } else if (absZ <= absY) {
    ref = [0, 0, 1];
  } else {
    ref = [0, 1, 0];
  }
  const d = ref[0] * z[0] + ref[1] * z[1] + ref[2] * z[2];
  const proj: Vec3 = [ref[0] - d * z[0], ref[1] - d * z[1], ref[2] - d * z[2]];
  const len = Math.sqrt(proj[0] * proj[0] + proj[1] * proj[1] + proj[2] * proj[2]);
  return [proj[0] / len, proj[1] / len, proj[2] / len];
}

/** 获取原点 3D 位置 */
function getOriginPosition(): Vec3 | null {
  if (!pendingOriginPointId || !pendingGeometryId) return null;
  const store = useEntityStore.getState();
  const ptEntity = store.getEntity(pendingOriginPointId);
  if (!ptEntity || ptEntity.type !== 'point') return null;
  const geoEntity = store.getEntity(pendingGeometryId);
  if (!geoEntity || geoEntity.type !== 'geometry') return null;
  const geoProps = geoEntity.properties as GeometryProperties;
  const result = getBuilderResult(pendingGeometryId, geoProps.geometryType, geoProps.params);
  if (!result) return null;
  return computePointPosition(ptEntity.properties as PointProperties, result);
}

/** 完成坐标系创建/更新 */
function finalize(axes: [[number, number, number], [number, number, number], [number, number, number]]) {
  if (!pendingOriginPointId || !pendingGeometryId) return;

  const entityStore = useEntityStore.getState();
  const historyStore = useHistoryStore.getState();
  const existing = entityStore.getCoordinateSystem();

  if (existing) {
    const oldProps = { ...existing.properties } as Partial<CoordinateSystemProperties>;
    const newProps: Partial<CoordinateSystemProperties> = {
      originPointId: pendingOriginPointId,
      geometryId: pendingGeometryId,
      zFaceId: pendingZFaceId ?? undefined,
      axes,
    };
    const command = new UpdatePropertiesCommand<'coordinateSystem'>(
      existing.id,
      oldProps,
      newProps,
    );
    historyStore.execute(command);
  } else {
    const command = new CreateEntityCommand('coordinateSystem', {
      originPointId: pendingOriginPointId,
      geometryId: pendingGeometryId,
      zFaceId: pendingZFaceId ?? undefined,
      axes,
    });
    historyStore.execute(command);
  }

  resetState();
  useToolStore.getState().setActiveTool('select');
}

export const coordSystemTool: Tool = {
  id: 'coordSystem',
  label: '坐标系',

  onActivate() {
    resetState();
    setStep('selectOrigin');
  },

  onDeactivate() {
    resetState();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (!event.hitEntityId || !event.hitEntityType) return;

    const entityStore = useEntityStore.getState();

    switch (currentStep) {
      case 'selectOrigin': {
        if (event.hitEntityType !== 'point') return;
        const pointEntity = entityStore.getEntity(event.hitEntityId);
        if (!pointEntity || pointEntity.type !== 'point') return;
        const props = pointEntity.properties as PointProperties;

        pendingOriginPointId = event.hitEntityId;
        pendingGeometryId = props.geometryId;
        addPendingSelection(event.hitEntityId);
        setStep('selectZFace');
        break;
      }

      case 'selectZFace': {
        if (event.hitEntityType !== 'face') return;
        const normal = computeFaceNormal(event.hitEntityId);
        if (!normal) return;

        pendingZFaceId = event.hitEntityId;
        pendingZNormal = normal;
        addPendingSelection(event.hitEntityId);
        setStep('selectXDir');
        break;
      }

      case 'selectXDir': {
        if (event.hitEntityType !== 'point') return;
        if (event.hitEntityId === pendingOriginPointId) return;

        const origin = getOriginPosition();
        if (!origin) return;

        const ptEntity = entityStore.getEntity(event.hitEntityId);
        if (!ptEntity || ptEntity.type !== 'point') return;
        const geoEntity = entityStore.getEntity(pendingGeometryId!);
        if (!geoEntity || geoEntity.type !== 'geometry') return;
        const geoProps = geoEntity.properties as GeometryProperties;
        const result = getBuilderResult(pendingGeometryId!, geoProps.geometryType, geoProps.params);
        if (!result) return;

        const refPos = computePointPosition(ptEntity.properties as PointProperties, result);
        if (!refPos) return;

        const zNormal = pendingZNormal ?? [0, 1, 0] as Vec3;
        const axes = computeAxesFromFaceAndRef(origin, zNormal, refPos);
        finalize(axes);
        break;
      }
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      resetState();
      useToolStore.getState().setActiveTool('select');
      return;
    }

  },
};
