import { useMemo } from 'react';
import type { Entity, SegmentProperties, PointProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import {
  calculatePointPointDistance,
  calculatePointLineDistance,
  calculatePointFaceDistance,
  calculateLineLineDistance,
  calculateLineFaceDistance,
} from '@/engine/math/distanceCalculator';
import type { Vec3, BuilderResult } from '@/engine/types';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const KIND_LABELS: Record<string, string> = {
  pointPoint: '点到点距离',
  pointLine: '点到线距离',
  pointFace: '点到面距离',
  lineLine: '异面直线距离',
  lineFace: '线到面距离',
};

function getSegEndpoints(
  segId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): { start: Vec3; end: Vec3 } | null {
  const seg = entities[segId];
  if (!seg || seg.type !== 'segment') return null;
  const sp = (seg as Entity<'segment'>).properties;
  if (sp.startPointId && sp.endPointId) {
    const s = entities[sp.startPointId];
    const e = entities[sp.endPointId];
    if (s && s.type === 'point' && e && e.type === 'point') {
      const sPos = computePointPosition((s as Entity<'point'>).properties, result);
      const ePos = computePointPosition((e as Entity<'point'>).properties, result);
      if (sPos && ePos) return { start: sPos, end: ePos };
    }
  }
  if (sp.curvePoints && sp.curvePoints.length === 2) {
    return { start: sp.curvePoints[0], end: sp.curvePoints[1] };
  }
  return null;
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

function getFacePos(
  faceId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): Vec3[] | null {
  const face = entities[faceId];
  if (!face || face.type !== 'face') return null;
  const fp = (face as Entity<'face'>).properties;
  if (fp.pointIds.length > 0) {
    const positions: Vec3[] = [];
    for (const pid of fp.pointIds) {
      const pe = entities[pid];
      if (!pe || pe.type !== 'point') return null;
      const pos = computePointPosition((pe as Entity<'point'>).properties, result);
      if (!pos) return null;
      positions.push(pos);
    }
    return positions.length >= 3 ? positions : null;
  }
  const src = fp.source;
  if (src.type === 'surface' && src.surfaceType === 'disk' && result.kind === 'surface') {
    const sf = result.faces[src.faceIndex];
    if (sf?.samplePoints && sf.samplePoints.length >= 3) return sf.samplePoints.slice(0, 3);
  }
  return null;
}

function DistanceMeasurementInspector({ entity }: { entity: Entity }) {
  const dmEntity = entity as Entity<'distanceMeasurement'>;
  const props = dmEntity.properties;
  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);

  const liveDistance = useMemo(() => {
    if (!result) return null;
    if (props.kind === 'pointPoint') {
      const [pid1, pid2] = props.entityIds;
      const p1 = getPointPos(pid1, entities, result);
      const p2 = getPointPos(pid2, entities, result);
      if (!p1 || !p2) return null;
      return calculatePointPointDistance(p1, p2);
    }
    if (props.kind === 'pointLine') {
      const [pointId, segId] = props.entityIds;
      const pp = getPointPos(pointId, entities, result);
      const ep = getSegEndpoints(segId, entities, result);
      if (!pp || !ep) return null;
      return calculatePointLineDistance(pp, ep.start, ep.end);
    }
    if (props.kind === 'pointFace') {
      const [pointId, faceId] = props.entityIds;
      const pp = getPointPos(pointId, entities, result);
      const fp = getFacePos(faceId, entities, result);
      if (!pp || !fp) return null;
      return calculatePointFaceDistance(pp, fp);
    }
    if (props.kind === 'lineFace') {
      const [segId, faceId] = props.entityIds;
      const ep = getSegEndpoints(segId, entities, result);
      const fp = getFacePos(faceId, entities, result);
      if (!ep || !fp) return null;
      return calculateLineFaceDistance(ep.start, ep.end, fp);
    }
    if (props.kind === 'lineLine') {
      const [sId1, sId2] = props.entityIds;
      const ep1 = getSegEndpoints(sId1, entities, result);
      const ep2 = getSegEndpoints(sId2, entities, result);
      if (!ep1 || !ep2) return null;
      return calculateLineLineDistance(ep1.start, ep1.end, ep2.start, ep2.end);
    }
    return null;
  }, [props.kind, props.entityIds, entities, result]);

  const distanceValue = liveDistance?.value ?? props.distanceValue;
  const distanceLatex = liveDistance?.latex ?? props.distanceLatex;
  const distanceApprox = liveDistance?.approxStr ?? props.distanceApprox;

  const relatedLabelsStr = useEntityStore((s) => {
    return props.entityIds.map((id) => {
      const e = s.entities[id];
      if (!e) return '?';

      if (e.type === 'point') {
        return (e.properties as PointProperties).label || `点${e.id}`;
      }

      if (e.type === 'segment') {
        const segProps = e.properties as SegmentProperties;
        if (segProps.label) return segProps.label;
        const sp = s.entities[segProps.startPointId];
        const ep = s.entities[segProps.endPointId];
        const sl = sp?.type === 'point' ? (sp.properties as PointProperties).label : '?';
        const el = ep?.type === 'point' ? (ep.properties as PointProperties).label : '?';
        return `${sl}${el}`;
      }

      if (e.type === 'face') {
        const faceProps = e.properties as { pointIds: string[] };
        const labels = faceProps.pointIds.map((pid: string) => {
          const pe = s.entities[pid];
          return pe?.type === 'point' ? (pe.properties as PointProperties).label : '';
        }).filter(Boolean);
        return labels.length > 0 ? `面${labels.join('')}` : '面';
      }

      return '?';
    }).join('\0');
  });
  const relatedLabels = relatedLabelsStr.split('\0');

  let relatedDesc = '';
  if (props.kind === 'pointPoint' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 点 ${relatedLabels[1]}`;
  } else if (props.kind === 'pointLine' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 线段 ${relatedLabels[1]}`;
  } else if (props.kind === 'pointFace' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineLine' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 与 线段 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineFace' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 到 ${relatedLabels[1]}`;
  }

  const hasLatex = distanceLatex.includes('\\');
  const kindLabel = KIND_LABELS[props.kind] || '距离度量';

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={kindLabel}
        displayName={relatedDesc || kindLabel}
        canDelete={true}
        deleteLabel="删除度量"
        canRename={false}
      />

      {relatedDesc && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          {relatedDesc}
        </div>
      )}

      <div className="text-sm" style={{ color: COLORS.text }}>
        距离：<strong style={{ color: '#8b5cf6' }}>{distanceValue.toFixed(4)}</strong>
      </div>

      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        {hasLatex ? `精确值：${distanceLatex}` : `= ${distanceLatex}`}
      </div>

      {hasLatex && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          {distanceApprox}
        </div>
      )}
    </div>
  );
}

registerInspector('distanceMeasurement', DistanceMeasurementInspector);

export { DistanceMeasurementInspector };
